import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { production } from "../database/clients.js";
import { decrypt } from "../lib/crypto.js";

const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;

const TOPIC_LABEL: Record<string, string> = {
  OPTIONS: "Understand my options",
  LENDER_DISCUSSION: "Prepare a lender discussion",
  NOTICE: "Review a notice or disputed detail",
};

/**
 * Emails a new "Get help" lead to the Relive team (LEADS_EMAIL).
 * Without SMTP_URL (local dev) it does nothing; the lead is still saved in support_requests.
 */
export async function emailLead(supportRequestId: string) {
  if (!transport) return;
  const lead = await production.supportRequest.findUniqueOrThrow({
    where: { id: supportRequestId },
    include: { user: { include: { profile: true } } },
  });
  const { user } = lead;
  const name = [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" ") || "Not given";
  const mobile = user.mobileEncrypted ? `+91 ${decrypt(user.mobileEncrypted)}` : `•••••• ${user.mobileLast4}`;
  const email = user.profile?.email || "";

  await transport.sendMail({
    from: `Relive leads <${env.LEADS_EMAIL}>`,
    to: env.LEADS_EMAIL,
    replyTo: email || undefined,
    subject: `New lead: ${name}, ${TOPIC_LABEL[lead.topic]}`,
    text: [
      "A Relive user asked for help.",
      "",
      `Name: ${name}`,
      `Mobile: ${mobile}`,
      `Email: ${email || "Not given"}`,
      "",
      `Help with: ${TOPIC_LABEL[lead.topic]}`,
      `Account: ${lead.accountLabel ?? "Overall debt situation"}`,
      `Best time to call: ${lead.preferredTime}`,
      `Language: ${lead.preferredLanguage}`,
      "",
      "Question:",
      lead.question,
      "",
      `Reference: ${lead.id.slice(0, 8).toUpperCase()} (submitted ${lead.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST)`,
    ].join("\n"),
  });
}
