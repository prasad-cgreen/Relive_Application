import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { audit, production } from "./database/clients.js";
import { hashMobile } from "./lib/crypto.js";
import { ProviderError } from "./lib/errors.js";
import { providers } from "./services/providers.js";

const mobile = "9123456789";
let userId = "";

beforeAll(async () => {
  const existing = await production.user.findUnique({ where: { mobileHash: hashMobile(mobile) } });
  if (existing) {
    await audit.auditLog.deleteMany({ where: { userRef: existing.id } });
    await production.user.delete({ where: { id: existing.id } });
  }
  const user = await production.user.create({ data: { mobileHash: hashMobile(mobile), mobileLast4: mobile.slice(-4) } });
  userId = user.id;
});

afterAll(async () => {
  if (userId) {
    await audit.auditLog.deleteMany({ where: { userRef: userId } });
    await production.user.deleteMany({ where: { id: userId } });
  }
  await Promise.all([production.$disconnect(), audit.$disconnect()]);
});

describe("Relive end-to-end member workflow", () => {
  it("rejects invalid and unregistered mobile numbers", async () => {
    await request(app).post("/api/v1/auth/request-otp").send({ mobile: "123", consent: true, consentVersion: "login-v1", channel: "SMS" }).expect(400);
    const response = await request(app).post("/api/v1/auth/request-otp").send({ mobile: "9999999999", consent: true, consentVersion: "login-v1", channel: "SMS" }).expect(404);
    expect(response.body.error.code).toBe("MOBILE_NOT_REGISTERED");
  });

  it("handles provider business, technical, timeout, invalid-response, retry and recovery paths", async () => {
    await expect(providers.nsdl(userId, "business_failure")).rejects.toMatchObject<Partial<ProviderError>>({
      kind: "BUSINESS_FAILURE", retryable: false,
    });
    await expect(providers.nsdl(userId, "invalid_response")).rejects.toMatchObject<Partial<ProviderError>>({
      kind: "TECHNICAL_FAILURE", code: "INVALID_PROVIDER_RESPONSE", retryable: false,
    });
    await expect(providers.nsdl(userId, "technical_failure")).resolves.toMatchObject({ firstName: "Aarav" });
    await expect(providers.nsdl(userId, "timeout")).resolves.toMatchObject({ lastName: "Sharma" });
    const statuses = await production.apiTransaction.groupBy({
      by: ["status"], where: { userId, provider: "MOCK_NSDL" }, _count: true,
    });
    expect(statuses.map((entry) => entry.status)).toEqual(expect.arrayContaining(["SUCCESS", "BUSINESS_FAILURE", "TECHNICAL_FAILURE", "TIMEOUT"]));
  }, 15_000);

  it("moves from consent and OTP to a protected Experian dashboard", async () => {
    const agent = request.agent(app);
    const otpRequest = await agent.post("/api/v1/auth/request-otp")
      .set("x-relive-mock-scenario", "technical_failure")
      .send({ mobile, consent: true, consentVersion: "login-v1", channel: "SMS" })
      .expect(201);
    expect(otpRequest.body.devOtp).toBe("123456");

    const incorrect = await agent.post("/api/v1/auth/verify-otp")
      .send({ transactionId: otpRequest.body.transactionId, otp: "000000" }).expect(400);
    expect(incorrect.body.error.code).toBe("INVALID_OTP");

    const verified = await agent.post("/api/v1/auth/verify-otp")
      .send({ transactionId: otpRequest.body.transactionId, otp: "123456" }).expect(200);
    expect(verified.body.stage).toBe("PROFILE");

    await agent.get("/api/v1/dashboard").expect(404);
    const profile = await agent.post("/api/v1/profile/nsdl").expect(200);
    expect(profile.body.stage).toBe("KYC");
    expect(profile.body.profile.verified).toBe(true);

    const kyc = await agent.post("/api/v1/kyc/verify").send({ pan: "ABCDE1234F" }).expect(200);
    expect(kyc.body.stage).toBe("CREDIT_AUTH");

    const authorization = await agent.post("/api/v1/credit/authorize")
      .send({ authorized: true, consentVersion: "experian-v1" }).expect(200);
    expect(authorization.body.stage).toBe("REPORT");

    const idempotencyKey = randomUUID();
    const report = await agent.post("/api/v1/credit/report").send({ idempotencyKey }).expect(200);
    expect(report.body.stage).toBe("DASHBOARD");
    await agent.post("/api/v1/credit/report").send({ idempotencyKey }).expect(200);

    const dashboard = await agent.get("/api/v1/dashboard").expect(200);
    expect(dashboard.body).toMatchObject({ bureau: "EXPERIAN", score: 782, status: "CURRENT" });
    expect(dashboard.body.report.accounts).toHaveLength(2);

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
