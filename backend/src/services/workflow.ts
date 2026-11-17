import { production } from "../database/clients.js";

/**
 * PROFILE: needs PAN (or name as on PAN) -> REPORT: profile known, no report yet -> DASHBOARD.
 * Any saved report (current or expired) means an existing user: the dashboard handles refresh.
 */
export async function getWorkflow(userId: string) {
  const [user, profile, kyc, report] = await Promise.all([
    production.user.findUnique({ where: { id: userId }, select: { mobileLast4: true } }),
    production.userProfile.findUnique({ where: { userId } }),
    production.kycVerification.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    production.creditReport.findFirst({ where: { userId }, orderBy: { retrievedAt: "desc" } }),
  ]);
  const stage = report ? "DASHBOARD" : !profile ? "PROFILE" : "REPORT";
  const current = report && report.status === "CURRENT" && report.expiresAt > new Date();
  const reportStatus = !report ? null : report.status === "NO_RECORD" ? "NO_RECORD" : current ? "CURRENT" : "EXPIRED";
  return {
    stage,
    mobileLast4: user?.mobileLast4 ?? null, // lets the UI show who is signed in
    profile: profile && { ...profile, dateOfBirth: profile.dateOfBirth?.toISOString().slice(0, 10) ?? null },
    kycStatus: kyc?.status ?? null,
    // Verified PAN usable for bureau pulls. False for PANs verified before it was stored: they re-verify once.
    panOnFile: kyc?.status === "VERIFIED" && Boolean(kyc.panEncrypted),
    reportStatus,
  };
}
