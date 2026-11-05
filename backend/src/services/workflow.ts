import { production } from "../database/clients.js";

export async function getWorkflow(userId: string) {
  const [profile, kyc, report, authorization] = await Promise.all([
    production.userProfile.findUnique({ where: { userId } }),
    production.kycVerification.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    production.creditReport.findFirst({ where: { userId, status: "CURRENT", expiresAt: { gt: new Date() } }, orderBy: { retrievedAt: "desc" } }),
    production.userConsent.findFirst({ where: { userId, purpose: "CREDIT_REPORT", status: "GRANTED" }, orderBy: { grantedAt: "desc" } }),
  ]);
  const stage = report ? "DASHBOARD" : !profile ? "PROFILE" : kyc?.status !== "VERIFIED" ? "KYC" : !authorization ? "CREDIT_AUTH" : "REPORT";
  return {
    stage,
    profile: profile && { ...profile, dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10) },
    kycStatus: kyc?.status ?? null,
    reportStatus: report?.status ?? null,
  };
}
