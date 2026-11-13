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

type Lead = {
  ref: string;
  name: string; // "" when the user never gave one
  mobile: string; // "+91 9876543210", or masked when the number can't be decrypted
  tel: string | null; // "+919876543210"; null when masked
  email: string;
  topic: string;
  account: string;
  time: string;
  language: string;
  question: string;
  submitted: string; // IST
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
  const digits = user.mobileEncrypted ? decrypt(user.mobileEncrypted) : null;
  const l: Lead = {
    ref: lead.id.slice(0, 8).toUpperCase(),
    name: [user.profile?.firstName, user.profile?.lastName].filter(Boolean).join(" "),
    mobile: digits ? `+91 ${digits}` : `•••••• ${user.mobileLast4}`,
    tel: digits ? `+91${digits}` : null,
    email: user.profile?.email || "",
    topic: TOPIC_LABEL[lead.topic],
    account: lead.accountLabel ?? "Overall debt situation",
    time: lead.preferredTime,
    language: lead.preferredLanguage,
    question: lead.question,
    submitted: lead.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }),
  };

  await transport.sendMail({
    from: `Relive leads <${env.LEADS_EMAIL}>`,
    to: env.LEADS_EMAIL,
    replyTo: l.email || undefined,
    subject: `New lead: ${l.name || "Not given"}, ${l.topic}`,
    text: [
      "A Relive user asked for help.",
      "",
      `Name: ${l.name || "Not given"}`,
      `Mobile: ${l.mobile}`,
      `Email: ${l.email || "Not given"}`,
      "",
      `Help with: ${l.topic}`,
      `Account: ${l.account}`,
      `Best time to call: ${l.time}`,
      `Language: ${l.language}`,
      "",
      "Question:",
      l.question,
      "",
      `Reference: ${l.ref} (submitted ${l.submitted} IST)`,
    ].join("\n"),
    html: leadHtml(l),
  });
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const TABLE = 'role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"';

const row = (label: string, value: string) =>
  `<tr><td style="padding:11px 12px 11px 0;border-top:1px solid #d5e3c8;width:38%;vertical-align:top;font-size:13px;line-height:20px;color:#4f6358">${label}</td>` +
  `<td style="padding:11px 0;border-top:1px solid #d5e3c8;vertical-align:top;font-size:15px;line-height:20px;font-weight:600;color:#183b2f;word-break:break-word">${esc(value)}</td></tr>`;

const button = (href: string, label: string, primary: boolean) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 10px 0;padding:12px 22px;border:1px solid #216b49;border-radius:8px;` +
  `background:${primary ? "#216b49" : "#ffffff"};color:${primary ? "#ffffff" : "#216b49"};font-size:15px;line-height:20px;font-weight:700;text-decoration:none">${esc(label)}</a>`;

/** The HTML body of the lead email. Every user-supplied value goes through esc(). */
export function leadHtml(l: Lead) {
  const preheader = [l.name || "New lead", l.topic, l.time].join(" · ");
  const buttons =
    (l.tel ? button(`tel:${l.tel}`, `Call ${l.mobile}`, true) : "") +
    (l.email ? button(`mailto:${l.email}?subject=${encodeURIComponent("Your Relive help request")}`, "Reply by email", !l.tel) : "");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New lead</title></head>
<body style="margin:0;padding:0;background:#f4f7f2">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}${"&#847;&zwnj;&nbsp;".repeat(40)}</div>
<table ${TABLE} style="background:#f4f7f2"><tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table ${TABLE} style="max-width:600px;background:#ffffff;border:1px solid #d5e3c8;border-radius:12px;font-family:${FONT}">
<tr><td style="background:#163e2d;border-radius:12px 12px 0 0;padding:20px 28px">
  <table ${TABLE}><tr>
    <td style="font-family:${FONT};font-size:24px;line-height:28px;font-weight:700;letter-spacing:-0.5px;color:#ffffff">re·live</td>
    <td align="right" style="font-family:${FONT};font-size:12px;line-height:28px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#b9d6a8">New lead</td>
  </tr></table>
</td></tr>
<tr><td style="padding:28px 28px 10px">
  <h1 style="margin:0 0 6px;font-size:22px;line-height:29px;font-weight:700;color:#183b2f">${esc(l.name || "A Relive user")} asked for help</h1>
  <p style="margin:0 0 22px;font-size:15px;line-height:22px;color:#4f6358"><strong style="color:#216b49">${esc(l.topic)}</strong> &middot; ${esc(l.submitted)} IST</p>
  ${buttons}
</td></tr>
<tr><td style="padding:8px 28px 6px">
  <table ${TABLE}>
    ${row("Mobile", l.mobile)}
    ${row("Email", l.email || "Not given")}
    ${row("Help with", l.topic)}
    ${row("Account", l.account)}
    ${row("Best time to call", l.time)}
    ${row("Preferred language", l.language)}
  </table>
</td></tr>
<tr><td style="padding:18px 28px 28px">
  <p style="margin:0 0 8px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#4f6358">Their question</p>
  <div style="background:#edf3e6;border:1px solid #d5e3c8;border-left:4px solid #216b49;border-radius:8px;padding:16px 18px;font-size:15px;line-height:23px;color:#183b2f;word-break:break-word">${esc(l.question).replace(/\r?\n/g, "<br>")}</div>
</td></tr>
<tr><td style="background:#edf3e6;border-top:1px solid #d5e3c8;border-radius:0 0 12px 12px;padding:18px 28px;font-size:13px;line-height:20px;color:#4f6358">
  Reference <strong style="color:#183b2f;letter-spacing:0.5px">${esc(l.ref)}</strong><br>
  Reply to this email to answer the customer directly.<br>
  <span style="font-size:12px;color:#7d8f84">This email contains personal data. Please do not forward it outside the Relive team.</span>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}
