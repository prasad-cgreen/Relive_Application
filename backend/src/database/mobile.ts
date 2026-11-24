// Shows a user's full mobile number (stored encrypted in users.mobile_encrypted).
//   npm run mobile -w backend -- 1908                                    by last 4 digits
//   npm run mobile -w backend -- 5003c148-7849-47f0-a310-18441ec54270    by users.id
// Needs the same DATA_ENCRYPTION_KEY the number was saved with. Every lookup is written to the audit log.
import { audit, production } from "./clients.js";
import { decrypt } from "../lib/crypto.js";

const query = process.argv[2]?.trim() ?? "";
const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

if (!byId && !/^\d{4}$/.test(query)) {
  console.log("Give the last 4 digits of the mobile number, or the user's id.");
} else {
  const users = await production.user.findMany({
    where: byId ? { id: query } : { mobileLast4: query },
    include: { profile: true },
    orderBy: { createdAt: "desc" },
  });
  if (users.length === 0) console.log(`No user found for ${query}.`);
  for (const user of users) {
    let mobile = "(not stored)";
    try {
      if (user.mobileEncrypted) mobile = decrypt(user.mobileEncrypted);
    } catch {
      mobile = "(cannot decrypt: DATA_ENCRYPTION_KEY differs from the one it was saved with)";
    }
    await audit.auditLog.create({ data: { eventType: "MOBILE_REVEALED", userRef: user.id, status: "SUCCESS", metadata: { via: "mobile script" } } });
    console.log({
      id: user.id,
      name: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || "(no profile yet)",
      mobile,
      signedUp: user.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
    });
  }
}

await Promise.all([production.$disconnect(), audit.$disconnect()]);
