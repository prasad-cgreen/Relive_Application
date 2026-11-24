// Exports the users table to a CSV file (opens in Excel) with the full 10-digit mobile number.
//   npm run export-users -w backend                 every user
//   npm run export-users -w backend -- today        signed up today (Indian time)
//   npm run export-users -w backend -- 2026-11-19   signed up on that day (Indian time)
// The number stays encrypted in the database (users.mobile_encrypted); it is decrypted only into the file,
// so this needs the same DATA_ENCRYPTION_KEY the live server uses. Each export is written to the audit log.
// The file holds personal data: files land in backend/exports/, which Git ignores.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit, production } from "./clients.js";
import { decrypt } from "../lib/crypto.js";

const IST = "Asia/Kolkata";
const istDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: IST }); // YYYY-MM-DD
const istTime = (date: Date | null | undefined) =>
  date ? date.toLocaleString("en-IN", { timeZone: IST, day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "";
const mobileOf = (sealed: string | null) => {
  if (!sealed) return "";
  try {
    return decrypt(sealed);
  } catch {
    return "(cannot decrypt)"; // DATA_ENCRYPTION_KEY differs from the one it was saved with
  }
};
// Quoted, and a leading = + - @ is neutralised so Excel never runs a typed-in value as a formula.
const cell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
};

const arg = process.argv[2]?.trim();
const day = arg === "today" ? istDay(new Date()) : arg;
if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.log('Give no argument (all users), "today", or a date like 2026-11-19.');
} else {
  const start = day ? new Date(`${day}T00:00:00+05:30`) : undefined;
  const users = await production.user.findMany({
    where: start ? { createdAt: { gte: start, lt: new Date(start.getTime() + 24 * 3_600_000) } } : {},
    orderBy: { createdAt: "desc" },
    include: {
      profile: true,
      kycs: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, panLast4: true } },
      reports: { where: { status: "CURRENT" }, orderBy: { retrievedAt: "desc" }, take: 1, select: { score: true, bureau: true, retrievedAt: true } },
    },
  });

  const header = ["User ID", "Mobile", "Alternate mobile (bureau)", "First name", "Last name", "Email", "Date of birth", "Account status", "Signed up (IST)", "PAN status", "PAN last 4", "Credit score", "Bureau", "Report fetched (IST)"];
  const rows = users.map((user) => [
    user.id,
    mobileOf(user.mobileEncrypted) || `••••••${user.mobileLast4}`,
    mobileOf(user.bureauMobileEncrypted),
    user.profile?.firstName,
    user.profile?.lastName,
    user.profile?.email,
    user.profile?.dateOfBirth?.toISOString().slice(0, 10),
    user.status,
    istTime(user.createdAt),
    user.kycs[0]?.status,
    user.kycs[0]?.panLast4,
    user.reports[0]?.score,
    user.reports[0]?.bureau,
    istTime(user.reports[0]?.retrievedAt),
  ]);

  const folder = join(process.cwd(), "exports");
  mkdirSync(folder, { recursive: true });
  const stamp = new Date().toLocaleString("sv-SE", { timeZone: IST }).replace(" ", "_").replace(/:/g, "").slice(0, 15);
  const file = join(folder, `users_${day ?? "all"}_exported-${stamp}.csv`);
  // The BOM makes Excel read the file as UTF-8.
  writeFileSync(file, `﻿${[header, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")}\r\n`, "utf8");

  await audit.auditLog.create({ data: { eventType: "USERS_EXPORTED", status: "SUCCESS", metadata: { users: users.length, day: day ?? "all" } } });
  console.log(`${users.length} user${users.length === 1 ? "" : "s"} exported to:\n${file}`);
}

await Promise.all([production.$disconnect(), audit.$disconnect()]);
