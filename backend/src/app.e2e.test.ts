import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { audit, production } from "./database/clients.js";
import { encrypt, hashMobile, hashPan } from "./lib/crypto.js";
import { ProviderError } from "./lib/errors.js";
import { setAdminPassword } from "./middleware/auth.js";
import { providers } from "./services/providers.js";
import { listAgents } from "./services/referral.js";

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

  it("records referrals: an agent's number earns a benefit, another user's is recorded without one", async () => {
    const agentMobile = "9123456790";
    const agentRow = await production.agent.upsert({
      where: { mobileHash: hashMobile(agentMobile) },
      create: { name: "E2E Agent", mobileHash: hashMobile(agentMobile), mobileLast4: agentMobile.slice(-4), mobileEncrypted: encrypt(agentMobile) },
      update: { active: true },
    });
    const signIn = async (number: string) => {
      const client = request.agent(app);
      const otp = await client.post("/api/v1/auth/request-otp").send({ mobile: number, consent: true }).expect(201);
      await client.post("/api/v1/auth/verify-otp").send({ transactionId: otp.body.transactionId, otp: "123456" }).expect(200);
      return { client, user: await production.user.findUniqueOrThrow({ where: { mobileHash: hashMobile(number) } }) };
    };
    const details = { firstName: "Asha", lastName: "Rao", dateOfBirth: "" };
    const users: string[] = [];
    try {
      const a = await signIn("9123456783");
      users.push(a.user.id);
      const own = await a.client.post("/api/v1/profile/manual").send({ ...details, referral: { mobile: "9123456783" } }).expect(422);
      expect(own.body.error.code).toBe("REFERRAL_SELF");
      const unknown = await a.client.post("/api/v1/profile/manual").send({ ...details, referral: { mobile: "9000000001" } }).expect(422);
      expect(unknown.body.error.code).toBe("REFERRAL_NOT_FOUND");
      // A bad code is rejected before the billed PAN lookup.
      await a.client.post("/api/v1/kyc/verify").send({ pan: "ABCDE1234F", referral: { mobile: "9000000001" } }).expect(422);
      expect(await production.kycVerification.count({ where: { userId: a.user.id } })).toBe(0);

      // An agent's number from their QR code: saved with the agent. A later referral doesn't replace it.
      await a.client.post("/api/v1/profile/manual").send({ ...details, referral: { mobile: agentMobile, source: "QR" } }).expect(200);
      await a.client.post("/api/v1/profile/manual").send({ ...details, referral: { mobile } }).expect(200);
      expect(await production.referral.findUnique({ where: { referredUserId: a.user.id } })).toMatchObject({ agentMobileHash: agentRow.mobileHash, agentMobileLast4: "6790", agentUserId: null, source: "QR" });

      // Another user's number, typed: recorded with no agent (no benefit).
      const b = await signIn("9123456784");
      users.push(b.user.id);
      await b.client.post("/api/v1/profile/manual").send({ ...details, referral: { mobile } }).expect(200);
      expect(await production.referral.findUnique({ where: { referredUserId: b.user.id } })).toMatchObject({ agentMobileHash: hashMobile(mobile), agentUserId: userId, source: "MANUAL" });
      // The agent's referral shows on the admin page's count.
      expect((await listAgents()).find((agent) => agent.id === agentRow.id)).toMatchObject({ referrals: 1, viaQr: 1 });
      // A number that becomes an agent's later: referrals from before that don't count as the agent's.
      const later = await production.agent.create({ data: { name: "Later Agent", mobileHash: hashMobile(mobile), mobileLast4: mobile.slice(-4), mobileEncrypted: encrypt(mobile) } });
      try {
        expect((await listAgents()).find((agent) => agent.id === later.id)).toMatchObject({ referrals: 0, viaQr: 0 });
      } finally {
        await production.agent.delete({ where: { id: later.id } });
      }
    } finally {
      await audit.auditLog.deleteMany({ where: { userRef: { in: users } } });
      await audit.onboardingJourney.deleteMany({ where: { userRef: { in: users } } });
      await production.user.deleteMany({ where: { id: { in: users } } }); // cascades to their referrals
      await production.agent.delete({ where: { id: agentRow.id } });
    }
  }, 30_000);

  it("agents admin page: password in the database, add agent, QR code, deactivate, change password", async () => {
    const agentMobile = "9123456791";
    // The test uses its own password and puts the database's back afterwards.
    const original = await production.adminPassword.findUnique({ where: { id: 1 } });
    await production.adminPassword.deleteMany();
    const off = await request(app).post("/api/v1/admin/login").send({ password: "anything" }).expect(404);
    expect(off.body.error.code).toBe("ADMIN_DISABLED");
    await setAdminPassword("test-admin-password");
    expect(await production.adminPassword.findUniqueOrThrow({ where: { id: 1 } })).toMatchObject({ password: "test-admin-password" });

    await request(app).get("/api/v1/admin/agents").expect(401);
    await request(app).post("/api/v1/admin/login").send({ password: "wrong-password" }).expect(401);
    await request(app).get("/api/v1/admin/agents").set("Cookie", "relive_admin=99999999999999.forged").expect(401);

    const staff = request.agent(app);
    await staff.post("/api/v1/admin/login").send({ password: "test-admin-password" }).expect(204);
    const added = await staff.post("/api/v1/admin/agents").send({ name: "  Admin Agent ", mobile: agentMobile }).expect(201);
    try {
      await staff.post("/api/v1/admin/agents").send({ name: "A", mobile: "12345" }).expect(400);
      const { body } = await staff.get("/api/v1/admin/agents").expect(200);
      expect(body.agents.find((a: { id: string }) => a.id === added.body.id)).toMatchObject({ name: "Admin Agent", mobile: agentMobile, active: true, referrals: 0 });

      const qr = await staff.get(`/api/v1/admin/agents/${added.body.id}/qr`).set("Origin", "http://127.0.0.1:5173").expect(200);
      expect(qr.body.link).toBe(`http://127.0.0.1:5173/?login=1&ref=${agentMobile}`);
      expect(qr.body.image).toMatch(/^data:image\/png;base64,/);
      await staff.get("/api/v1/admin/agents/not-an-id/qr").expect(400);

      await staff.post(`/api/v1/admin/agents/${added.body.id}/active`).send({ active: false }).expect(204);
      expect(await production.agent.findUnique({ where: { id: added.body.id } })).toMatchObject({ active: false });
      // Adding the same number again reactivates (and renames) the agent rather than duplicating it.
      const again = await staff.post("/api/v1/admin/agents").send({ name: "Admin Agent Two", mobile: agentMobile }).expect(201);
      expect(again.body.id).toBe(added.body.id);
      expect(await production.agent.findUnique({ where: { id: added.body.id } })).toMatchObject({ active: true, name: "Admin Agent Two" });

      // CSV upload: good rows are saved, bad rows reported by row number; uploading again updates instead of duplicating.
      const rows = [
        { row: 2, name: "Bulk One", mobile: "9123456792" },
        { row: 3, name: "", mobile: "9123456793" },
        { row: 4, name: "Bulk Two", mobile: "12345" },
        { row: 5, name: "Bulk One Renamed", mobile: "9123456792" },
        { row: 6, name: "Bulk Three", mobile: "9123456794" },
      ];
      const imported = await staff.post("/api/v1/admin/agents/import").send({ rows }).expect(200);
      expect(imported.body).toEqual({ added: 2, updated: 0, errors: [{ row: 3, message: "Enter the agent's name" }, { row: 4, message: "Enter a valid mobile number" }] });
      expect(await production.agent.findUnique({ where: { mobileHash: hashMobile("9123456792") } })).toMatchObject({ name: "Bulk One Renamed" });
      const reimported = await staff.post("/api/v1/admin/agents/import").send({ rows }).expect(200);
      expect(reimported.body).toMatchObject({ added: 0, updated: 2 });
      await staff.post("/api/v1/admin/agents/import").send({ rows: [] }).expect(400);

      // Delete: gone from the list; deleting again is a 404.
      const bulkThree = await production.agent.findUniqueOrThrow({ where: { mobileHash: hashMobile("9123456794") } });
      await staff.delete(`/api/v1/admin/agents/${bulkThree.id}`).expect(204);
      expect((await staff.get("/api/v1/admin/agents").expect(200)).body.agents.some((a: { id: string }) => a.id === bulkThree.id)).toBe(false);
      await staff.delete(`/api/v1/admin/agents/${bulkThree.id}`).expect(404);
      await request(app).delete(`/api/v1/admin/agents/${added.body.id}`).expect(401);

      // Changing the password: needs the current one and 12+ characters; this browser stays in, everyone else is out.
      const colleague = request.agent(app);
      await colleague.post("/api/v1/admin/login").send({ password: "test-admin-password" }).expect(204);
      const wrong = await staff.post("/api/v1/admin/password").send({ current: "not-it-at-all", next: "a-new-long-password" }).expect(422);
      expect(wrong.body.error.code).toBe("ADMIN_CURRENT_PASSWORD_WRONG");
      await staff.post("/api/v1/admin/password").send({ current: "test-admin-password", next: "short" }).expect(400);
      await staff.post("/api/v1/admin/password").send({ current: "test-admin-password", next: "a-new-long-password" }).expect(204);
      await staff.get("/api/v1/admin/agents").expect(200);
      await colleague.get("/api/v1/admin/agents").expect(401);
      await request(app).post("/api/v1/admin/login").send({ password: "test-admin-password" }).expect(401);
      await colleague.post("/api/v1/admin/login").send({ password: "a-new-long-password" }).expect(204);

      await staff.post("/api/v1/admin/logout").expect(204);
      await request(app).post("/api/v1/admin/agents/import").send({ rows }).expect(401);
      await staff.get("/api/v1/admin/agents").expect(401);
    } finally {
      await production.agent.deleteMany({ where: { mobileHash: { in: [agentMobile, "9123456792", "9123456794"].map(hashMobile) } } });
      await production.adminPassword.deleteMany();
      if (original) await production.adminPassword.create({ data: original });
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
      await agent.post("/api/v1/profile/manual").send({ firstName: "Ravi", lastName: "Patil", dateOfBirth: "" }).expect(200); // DOB is optional

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

    const session = await agent.get("/api/v1/auth/session").expect(200);
    expect(session.body).toMatchObject({ authenticated: true, stage: "DASHBOARD" });
    expect(new Date(session.body.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(session.headers["cache-control"]).toBe("no-store");

    await agent.post("/api/v1/auth/logout").expect(204);
    await agent.get("/api/v1/workflow").expect(401);
    expect((await agent.get("/api/v1/auth/session").expect(200)).body).toEqual({ authenticated: false });
    // Logging out again (e.g. an expired session) still succeeds, so the UI can always sign out.
    await agent.post("/api/v1/auth/logout").expect(204);
  }, 30_000);
});
