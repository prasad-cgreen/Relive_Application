// Test logins (OTP_PROVIDER=mock, OTP = OTP_MOCK_CODE, default 123456). Re-run to reset them.
import { randomUUID } from "node:crypto";
import { audit, production } from "./clients.js";
import { encrypt, hashMobile, hashPan } from "../lib/crypto.js";
import { demoReport } from "../services/bureau.js";

async function resetUser(mobile: string) {
  const existing = await production.user.findUnique({ where: { mobileHash: hashMobile(mobile) } });
  if (existing) {
    await audit.auditLog.deleteMany({ where: { userRef: existing.id } });
    await audit.onboardingJourney.deleteMany({ where: { userRef: existing.id } });
    await production.user.delete({ where: { id: existing.id } }); // cascades to profile, OTPs, KYC, reports
  }
}

async function createUser(mobile: string) {
  await resetUser(mobile);
  return production.user.create({ data: { mobileHash: hashMobile(mobile), mobileLast4: mobile.slice(-4), mobileEncrypted: encrypt(mobile) } });
}

// 1. Existing user, profile complete -> straight to the dashboard
const complete = await createUser("9876543210");
const pan = "ABCDE1234F";
await production.userProfile.create({ data: {
  userId: complete.id, firstName: "Aarav", lastName: "Sharma", email: "aarav.demo@relive.test",
  dateOfBirth: new Date("1992-06-14"), source: "NSDL", verified: true,
}});
await production.kycVerification.create({ data: { userId: complete.id, panHash: hashPan(pan), panLast4: pan.slice(-4), status: "VERIFIED", verifiedAt: new Date() } });
await production.userConsent.create({ data: { userId: complete.id, purpose: "CREDIT_REPORT", version: "relive-consent-v2" } });
const idempotencyKey = randomUUID();
// Always the mock bureau, even with BUREAU_PROVIDER=indiconnect: seeding must never trigger a billed pull.
const report = { bureau: "EXPERIAN", providerRef: `seed_${idempotencyKey}`, score: 782, reportJson: demoReport(782) };
await production.creditReport.create({ data: {
  userId: complete.id, bureau: report.bureau, score: report.score, reportJson: report.reportJson, providerRef: report.providerRef,
  idempotencyKey, status: "CURRENT", expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
}});

// 2. Existing user, details saved but no report yet (e.g. bureaus were down) -> resumes at "fetch score"
const partial = await createUser("9876543211");
await production.userProfile.create({ data: {
  userId: partial.id, firstName: "Priya", lastName: "Patel", email: "priya.demo@relive.test",
  dateOfBirth: new Date("1995-08-20"), source: "MANUAL_UNVERIFIED", verified: false,
}});
await production.userConsent.create({ data: { userId: partial.id, purpose: "CREDIT_REPORT", version: "relive-consent-v2" } });

// 3. New user -> nothing stored, so login starts at "Enter PAN"
await resetUser("9876543212");

// 4. A company agent: their number as the referral code earns them a benefit (any user's number works, without one)
const agentMobile = "9876500000";
await production.agent.upsert({
  where: { mobileHash: hashMobile(agentMobile) },
  create: { name: "Test Agent", mobileHash: hashMobile(agentMobile), mobileLast4: agentMobile.slice(-4), mobileEncrypted: encrypt(agentMobile) },
  update: { active: true },
});

console.table([
  { mobile: "9876543210", case: "Existing user, profile complete", lands: "Dashboard" },
  { mobile: "9876543211", case: "Existing user, no report yet", lands: "Fetch score (resumes onboarding)" },
  { mobile: "9876543212", case: "New user (reset on every seed)", lands: "Enter PAN" },
]);
console.log("OTP for all: 123456. PAN AAAAA0000A simulates a failed PAN lookup.");
console.log(`Referral codes: ${agentMobile} (Test Agent, benefit) or 9876543210 (a user, no benefit). QR link: /?login=1&ref=${agentMobile}`);
console.log("Dev only: header x-relive-mock-scenario: business_failure on /credit/report makes Experian fail, so CRIF is used.");

await Promise.all([production.$disconnect(), audit.$disconnect()]);
