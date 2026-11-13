import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { audit, production } from "./database/clients.js";
import { hashMobile, hashPan } from "./lib/crypto.js";
import { ProviderError } from "./lib/errors.js";
import { providers } from "./services/providers.js";

const mobile = "9123456789";
let userId = "";

beforeAll(async () => {
  const existing = await production.user.findUnique({ where: { mobileHash: hashMobile(mobile) } });
  if (existing) {
    await audit.auditLog.deleteMany({ where: { userRef: existing.id } });
    await audit.onboardingJourney.deleteMany({ where: { userRef: existing.id } });
    await production.user.delete({ where: { id: existing.id } });
  }
  const user = await production.user.create({ data: { mobileHash: hashMobile(mobile), mobileLast4: mobile.slice(-4) } });
  userId = user.id;
  // The happy-path PAN must not be linked to another test account.
  await production.kycVerification.deleteMany({ where: { panHash: hashPan("ABCDE1234F") } });
});

afterAll(async () => {
  if (userId) {
    await audit.auditLog.deleteMany({ where: { userRef: userId } });
    await audit.onboardingJourney.deleteMany({ where: { userRef: userId } });
    await production.user.deleteMany({ where: { id: userId } });
  }
  await Promise.all([production.$disconnect(), audit.$disconnect()]);
});

describe("Relive end-to-end member workflow", () => {
  it("rejects invalid mobile numbers and missing consent", async () => {
    await request(app).post("/api/v1/auth/request-otp").send({ mobile: "123", consent: true }).expect(400);
    await request(app).post("/api/v1/auth/request-otp").send({ mobile: "9123456780", consent: false }).expect(400);
  });

  it("locks the user after 3 wrong OTPs, even across resends", async () => {
    const lockMobile = "9123456781";
    const first = await request(app).post("/api/v1/auth/request-otp").send({ mobile: lockMobile, consent: true }).expect(201);
    const lockUser = await production.user.findUniqueOrThrow({ where: { mobileHash: hashMobile(lockMobile) } });
    try {
      const wrong = await request(app).post("/api/v1/auth/verify-otp").send({ transactionId: first.body.transactionId, otp: "000000" }).expect(400);
      expect(wrong.body.error.details.attemptsRemaining).toBe(2);
      await request(app).post("/api/v1/auth/verify-otp").send({ transactionId: first.body.transactionId, otp: "000000" }).expect(400);
      // A resend must not reset the counter.
      await production.otpTransaction.updateMany({ where: { userId: lockUser.id }, data: { resendAfter: new Date(0) } });
      const second = await request(app).post("/api/v1/auth/request-otp").send({ mobile: lockMobile, consent: true }).expect(201);
      await request(app).post("/api/v1/auth/verify-otp").send({ transactionId: first.body.transactionId, otp: "123456" }).expect(410);
      const locked = await request(app).post("/api/v1/auth/verify-otp").send({ transactionId: second.body.transactionId, otp: "000000" }).expect(429);
      expect(locked.body.error.code).toBe("OTP_ATTEMPTS_EXCEEDED");
      expect(await audit.onboardingJourney.findUnique({ where: { userRef: lockUser.id } })).toMatchObject({
        status: "IN_PROGRESS", currentStep: "MOBILE", lastEvent: "OTP_LOCKED", otpSends: 2, otpFailures: 3, mobileLast4: "6781",
      });
      await request(app).post("/api/v1/auth/verify-otp").send({ transactionId: second.body.transactionId, otp: "123456" }).expect(429);
    } finally {
      await audit.auditLog.deleteMany({ where: { userRef: lockUser.id } });
    await audit.onboardingJourney.deleteMany({ where: { userRef: lockUser.id } });
      await production.user.delete({ where: { id: lockUser.id } });
    }
  }, 30_000);

  it("handles provider business, technical, timeout, invalid-response, retry and recovery paths", async () => {
    await expect(providers.panDetails(userId, "ABCDE1234F", "business_failure")).rejects.toMatchObject<Partial<ProviderError>>({
      kind: "BUSINESS_FAILURE", retryable: false,
    });
    await expect(providers.panDetails(userId, "ABCDE1234F", "invalid_response")).rejects.toMatchObject<Partial<ProviderError>>({
      kind: "TECHNICAL_FAILURE", code: "INVALID_PROVIDER_RESPONSE", retryable: false,
    });
    await expect(providers.panDetails(userId, "ABCDE1234F", "technical_failure")).resolves.toMatchObject({ firstName: "Aarav" });
    await expect(providers.panDetails(userId, "ABCDE1234F", "timeout")).resolves.toMatchObject({ lastName: "Sharma" });
    const statuses = await production.apiTransaction.groupBy({
      by: ["status"], where: { userId, provider: "MOCK_NSDL" }, _count: true,
    });
    expect(statuses.map((entry) => entry.status)).toEqual(expect.arrayContaining(["SUCCESS", "BUSINESS_FAILURE", "TECHNICAL_FAILURE", "TIMEOUT"]));
  }, 15_000);

  it("lets a user without PAN reach an Experian report via manual details", async () => {
    const noPanMobile = "9123456782";
    const agent = request.agent(app);
    const otp = await agent.post("/api/v1/auth/request-otp").send({ mobile: noPanMobile, consent: true }).expect(201);
    const noPanUser = await production.user.findUniqueOrThrow({ where: { mobileHash: hashMobile(noPanMobile) } });
    try {
      await agent.post("/api/v1/auth/verify-otp").send({ transactionId: otp.body.transactionId, otp: "123456" }).expect(200);
      const profile = await agent.post("/api/v1/profile/manual")
        .send({ firstName: "Neha", lastName: "Kulkarni", email: "neha@relive.test", dateOfBirth: "1994-03-02" }).expect(200);
      expect(profile.body.stage).toBe("REPORT");
      // The single signup checkbox records every purpose, so no separate bureau authorization step is needed.
      const consents = await production.userConsent.findMany({ where: { userId: noPanUser.id } });
      expect(consents.map((consent) => consent.purpose).sort()).toEqual(["CREDIT_REPORT", "LOGIN", "MARKETING"]);

      // Billing guard: 3 bureau attempts in 24h blocks further pulls.
      const fakeAttempts = [1, 2, 3].map(() => ({ userId: noPanUser.id, provider: "MOCK_EXPERIAN", operation: "CREDIT_REPORT_EXPERIAN", status: "BUSINESS_FAILURE" as const, durationMs: 1 }));
      await production.apiTransaction.createMany({ data: fakeAttempts });
      const limited = await agent.post("/api/v1/credit/report").send({ idempotencyKey: randomUUID() }).expect(429);
      expect(limited.body.error.code).toBe("REPORT_ATTEMPT_LIMIT");
      await production.apiTransaction.deleteMany({ where: { userId: noPanUser.id, durationMs: 1 } });

      const report = await agent.post("/api/v1/credit/report").send({ idempotencyKey: randomUUID() }).expect(200);
      expect(report.body.stage).toBe("DASHBOARD");
      const stored = await production.creditReport.findFirstOrThrow({ where: { userId: noPanUser.id } });
      expect(stored).toMatchObject({ bureau: "EXPERIAN", score: 782 });
    } finally {
      await audit.auditLog.deleteMany({ where: { userRef: noPanUser.id } });
    await audit.onboardingJourney.deleteMany({ where: { userRef: noPanUser.id } });
      await production.user.delete({ where: { id: noPanUser.id } });
    }
  }, 30_000);

  it("stores a 'Get help' request as a lead for the signed-in user", async () => {
    const helpMobile = "9123456784";
    const body = { topic: "LENDER_DISCUSSION", account: "ICICI Bank · •••• 5295", question: "I need help understanding ICICI Bank.", preferredTime: "Morning", preferredLanguage: "Hindi" };
    await request(app).post("/api/v1/support-requests").send(body).expect(401);

    const agent = request.agent(app);
    const otp = await agent.post("/api/v1/auth/request-otp").send({ mobile: helpMobile, consent: true }).expect(201);
    const helpUser = await production.user.findUniqueOrThrow({ where: { mobileHash: hashMobile(helpMobile) } });
    try {
      await agent.post("/api/v1/auth/verify-otp").send({ transactionId: otp.body.transactionId, otp: "123456" }).expect(200);
      await agent.post("/api/v1/support-requests").send({ ...body, topic: "SOMETHING_ELSE" }).expect(400);
      await agent.post("/api/v1/support-requests").send({ ...body, question: "   " }).expect(400);

      const created = await agent.post("/api/v1/support-requests").send(body).expect(201);
      const lead = await production.supportRequest.findUniqueOrThrow({ where: { id: created.body.id } });
      expect(lead).toMatchObject({ userId: helpUser.id, topic: "LENDER_DISCUSSION", accountLabel: body.account, status: "NEW", preferredLanguage: "Hindi" });
    } finally {
      await audit.auditLog.deleteMany({ where: { userRef: helpUser.id } });
      await audit.onboardingJourney.deleteMany({ where: { userRef: helpUser.id } });
      await production.user.delete({ where: { id: helpUser.id } }); // cascades to the support request
    }
  }, 30_000);

  it("no record on the login number: alternate mobile via OTP, then 'no credit history'", async () => {
    const loginMobile = "9123456783";
    const otherMobile = "9123456784";
    const agent = request.agent(app);
    const otp = await agent.post("/api/v1/auth/request-otp").send({ mobile: loginMobile, consent: true }).expect(201);
    const user = await production.user.findUniqueOrThrow({ where: { mobileHash: hashMobile(loginMobile) } });
    try {
      await agent.post("/api/v1/auth/verify-otp").send({ transactionId: otp.body.transactionId, otp: "123456" }).expect(200);
      await agent.post("/api/v1/profile/manual").send({ firstName: "Ravi", lastName: "Patil", dateOfBirth: "1990-05-05" }).expect(200);

      // Both bureaus: no record for the login number.
      const noRecord = await agent.post("/api/v1/credit/report").set("x-relive-mock-scenario", "no_record").send({ idempotencyKey: randomUUID() }).expect(422);
      expect(noRecord.body.error).toMatchObject({ code: "NO_CREDIT_RECORD", details: { mobileLast4: "6783", triedAlternate: false } });

      // A login OTP can't be used for the alternate number, and the login number itself is rejected.
      await agent.post("/api/v1/credit/bureau-mobile/request-otp").send({ mobile: loginMobile }).expect(400);
      await production.otpTransaction.updateMany({ where: { userId: user.id }, data: { resendAfter: new Date(0) } });
      const altOtp = await agent.post("/api/v1/credit/bureau-mobile/request-otp").send({ mobile: otherMobile }).expect(201);
      expect(altOtp.body.mobileLast4).toBe("6784");
      await agent.post("/api/v1/auth/verify-otp").send({ transactionId: altOtp.body.transactionId, otp: "123456" }).expect(400);
      await agent.post("/api/v1/credit/bureau-mobile/verify").send({ transactionId: altOtp.body.transactionId, otp: "123456" }).expect(200);
      expect((await production.user.findUniqueOrThrow({ where: { id: user.id } })).bureauMobileLast4).toBe("6784");

      // Still no record with the alternate number -> user confirms they're new to credit.
      const again = await agent.post("/api/v1/credit/report").set("x-relive-mock-scenario", "no_record").send({ idempotencyKey: randomUUID() }).expect(422);
      expect(again.body.error.details).toMatchObject({ mobileLast4: "6784", triedAlternate: true });
      const noHistory = await agent.post("/api/v1/credit/no-history").expect(200);
      expect(noHistory.body).toMatchObject({ stage: "DASHBOARD", reportStatus: "NO_RECORD" });
      const overview = await agent.get("/api/v1/credit/overview").expect(200);
      expect(overview.body).toMatchObject({ status: "NO_RECORD", score: null });
      expect(await audit.onboardingJourney.findUnique({ where: { userRef: user.id } })).toMatchObject({
        status: "NO_CREDIT_HISTORY", currentStep: "DASHBOARD", identitySource: "MANUAL", altMobileLast4: "6784", reportAttempts: 2,
      });
      const events = await audit.auditLog.findMany({ where: { userRef: user.id }, orderBy: { createdAt: "asc" }, select: { eventType: true, metadata: true } });
      expect(events.map((event) => event.eventType)).toEqual(expect.arrayContaining([
        "CONSENT_GRANTED", "OTP_SENT", "LOGIN", "DETAILS_SAVED", "BUREAU_FAILED", "REPORT_NO_RECORD", "ALT_MOBILE_VERIFIED", "NO_CREDIT_HISTORY_CONFIRMED",
      ]));
      // Only masked numbers ever reach the audit DB.
      expect(JSON.stringify(events)).not.toContain(otherMobile);
    } finally {
      await audit.auditLog.deleteMany({ where: { userRef: user.id } });
    await audit.onboardingJourney.deleteMany({ where: { userRef: user.id } });
      await production.user.delete({ where: { id: user.id } });
    }
  }, 30_000);

  it("refuses 'no credit history' unless both bureaus actually said no record", async () => {
    const mobile2 = "9123456785";
    const agent = request.agent(app);
    const otp = await agent.post("/api/v1/auth/request-otp").send({ mobile: mobile2, consent: true }).expect(201);
    const user = await production.user.findUniqueOrThrow({ where: { mobileHash: hashMobile(mobile2) } });
    try {
      await agent.post("/api/v1/auth/verify-otp").send({ transactionId: otp.body.transactionId, otp: "123456" }).expect(200);
      const refused = await agent.post("/api/v1/credit/no-history").expect(409);
      expect(refused.body.error.code).toBe("NO_RECORD_UNCONFIRMED");
    } finally {
      await audit.auditLog.deleteMany({ where: { userRef: user.id } });
    await audit.onboardingJourney.deleteMany({ where: { userRef: user.id } });
      await production.user.delete({ where: { id: user.id } });
    }
  }, 30_000);

  it("moves from consent and OTP to a protected dashboard, falling back to CRIF", async () => {
    const agent = request.agent(app);
    // OTP sends are never retried (a retry would text the user twice), so an outage surfaces as 503.
    const outage = await agent.post("/api/v1/auth/request-otp")
      .set("x-relive-mock-scenario", "technical_failure")
      .send({ mobile, consent: true, consentVersion: "relive-consent-v2" })
      .expect(503);
    expect(outage.body.error.retryable).toBe(true);

    const otpRequest = await agent.post("/api/v1/auth/request-otp")
      .send({ mobile, consent: true, consentVersion: "relive-consent-v2" })
      .expect(201);
    expect(otpRequest.body.devOtp).toBe("123456");

    const incorrect = await agent.post("/api/v1/auth/verify-otp")
      .send({ transactionId: otpRequest.body.transactionId, otp: "000000" }).expect(400);
    expect(incorrect.body.error.code).toBe("INVALID_OTP");

    const verified = await agent.post("/api/v1/auth/verify-otp")
      .send({ transactionId: otpRequest.body.transactionId, otp: "123456" }).expect(200);
    expect(verified.body.stage).toBe("PROFILE");

    await agent.get("/api/v1/dashboard").expect(404);
    const failedPan = await agent.post("/api/v1/kyc/verify").send({ pan: "AAAAA0000A" }).expect(422);
    expect(failedPan.body.error.code).toBe("PAN_NOT_VERIFIED");

    const kyc = await agent.post("/api/v1/kyc/verify").send({ pan: "ABCDE1234F" }).expect(200);
    expect(kyc.body.stage).toBe("REPORT");
    expect(kyc.body.profile).toMatchObject({ firstName: "Aarav", source: "NSDL", verified: true });

    const idempotencyKey = randomUUID();
    // Experian fails (mock business failure) -> CRIF fallback is used.
    const report = await agent.post("/api/v1/credit/report").set("x-relive-mock-scenario", "business_failure").send({ idempotencyKey }).expect(200);
    expect(report.body.stage).toBe("DASHBOARD");
    await agent.post("/api/v1/credit/report").send({ idempotencyKey }).expect(200);
    // A current report is reused: a new key must not trigger another (billed) pull.
    await agent.post("/api/v1/credit/report").send({ idempotencyKey: randomUUID() }).expect(200);
    expect(await production.creditReport.count({ where: { userId } })).toBe(1);

    const dashboard = await agent.get("/api/v1/dashboard").expect(200);
    expect(dashboard.body).toMatchObject({ bureau: "CRIF", score: 731, status: "CURRENT", category: { label: "Good" } });
    expect(dashboard.body.report.accounts).toHaveLength(3);
    expect(dashboard.body.report.raw).toBeUndefined();

    const [auditEvents, providerTransactions] = await Promise.all([
      audit.auditLog.count({ where: { userRef: userId } }),
      production.apiTransaction.count({ where: { userId } }),
    ]);
    expect(auditEvents).toBeGreaterThanOrEqual(6);
    expect(providerTransactions).toBeGreaterThanOrEqual(5);

    await agent.post("/api/v1/auth/logout").expect(204);
    await agent.get("/api/v1/workflow").expect(401);
  }, 30_000);
});
