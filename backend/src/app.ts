import { randomUUID } from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import {
  creditAuthorizationSchema, kycSchema, manualProfileSchema, requestOtpSchema,
  reportRequestSchema, verifyOtpSchema,
} from "@relive/shared";
import { z, ZodError } from "zod";
import { env } from "./config/env.js";
import { production } from "./database/clients.js";
import { requireAuth } from "./middleware/auth.js";
import { hashMobile, hashOtp, hashPan, hashToken, newToken, secureEqual } from "./lib/crypto.js";
import { HttpError, ProviderError } from "./lib/errors.js";
import { writeAudit } from "./services/audit.js";
import { providers, type MockScenario } from "./services/providers.js";
import { getWorkflow } from "./services/workflow.js";
import { getCreditOverview } from "./services/credit-score.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN.split(",").map((v) => v.trim()), credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  req.requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
});

const authLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false });
const sensitiveLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });

const scenarios = z.enum(["success", "business_failure", "technical_failure", "timeout", "invalid_response"]);
function scenario(req: Request): MockScenario {
  if (env.NODE_ENV === "production") return "success";
  return scenarios.catch("success").parse(req.header("x-relive-mock-scenario"));
}

function userContext(req: Request) {
  if (!req.userId) throw new HttpError(401, "AUTH_REQUIRED", "Please log in to continue");
  return req.userId;
}

app.get("/health", async (_req, res) => {
  await Promise.all([production.$queryRaw`SELECT 1`, import("./database/clients.js").then(({ audit }) => audit.$queryRaw`SELECT 1`)]);
  res.json({ status: "ok", services: { api: "ok", productionDatabase: "ok", auditDatabase: "ok" }, mode: env.PROVIDER_MODE });
});

app.post("/api/v1/auth/request-otp", authLimiter, async (req, res) => {
  const data = requestOtpSchema.parse(req.body);
  const user = await production.user.findUnique({ where: { mobileHash: hashMobile(data.mobile) } });
  if (!user) throw new HttpError(404, "MOBILE_NOT_REGISTERED", "Mobile number is not registered");
  if (user.status === "BLOCKED" || (user.blockedUntil && user.blockedUntil > new Date())) {
    throw new HttpError(429, "OTP_TEMPORARILY_BLOCKED", "OTP requests are temporarily blocked. Please try later", true);
  }
  const last = await production.otpTransaction.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  if (last?.resendAfter && last.resendAfter > new Date()) {
    throw new HttpError(429, "RESEND_TOO_SOON", "Please wait before requesting another OTP", true, { retryAfterSeconds: Math.ceil((last.resendAfter.getTime() - Date.now()) / 1000) });
  }
  const transactionId = randomUUID();
  await providers.sendOtp(user.id, scenario(req));
  const now = Date.now();
  await production.$transaction([
    production.userConsent.create({ data: {
      userId: user.id, purpose: "LOGIN", version: data.consentVersion, status: "GRANTED",
      ipAddress: req.ip, userAgent: req.header("user-agent"),
    }}),
    production.otpTransaction.create({ data: {
      id: transactionId, userId: user.id, channel: data.channel,
      otpHash: hashOtp(transactionId, env.OTP_MOCK_CODE), status: "PENDING",
      expiresAt: new Date(now + 5 * 60_000), resendAfter: new Date(now + 10_000),
    }}),
  ]);
  await writeAudit({ eventType: "OTP_REQUESTED", userRef: user.id, transactionId, status: "SUCCESS", requestId: req.requestId, metadata: { channel: data.channel, consentVersion: data.consentVersion } });
  res.status(201).json({ transactionId, expiresInSeconds: 300, resendAfterSeconds: 10, ...(env.NODE_ENV !== "production" && { devOtp: env.OTP_MOCK_CODE }) });
});

app.post("/api/v1/auth/verify-otp", authLimiter, async (req, res) => {
  const data = verifyOtpSchema.parse(req.body);
  const transaction = await production.otpTransaction.findUnique({ where: { id: data.transactionId }, include: { user: true } });
  if (!transaction) throw new HttpError(400, "OTP_TRANSACTION_NOT_FOUND", "OTP request was not found");
  if (["VERIFIED", "USED"].includes(transaction.status)) throw new HttpError(409, "OTP_ALREADY_USED", "This OTP has already been used");
  if (transaction.status === "BLOCKED") throw new HttpError(429, "OTP_ATTEMPTS_EXCEEDED", "You have exceeded the maximum number of OTP attempts");
  if (transaction.expiresAt <= new Date()) {
    await production.otpTransaction.update({ where: { id: transaction.id }, data: { status: "EXPIRED" } });
    throw new HttpError(410, "OTP_EXPIRED", "OTP has expired. Request a new OTP", true);
  }
  if (!secureEqual(transaction.otpHash, hashOtp(transaction.id, data.otp))) {
    const attempts = transaction.failedAttempts + 1;
    const blocked = attempts >= 3;
    await production.$transaction([
      production.otpTransaction.update({ where: { id: transaction.id }, data: { failedAttempts: attempts, status: blocked ? "BLOCKED" : "PENDING" } }),
      ...(blocked ? [production.user.update({ where: { id: transaction.userId }, data: { blockedUntil: new Date(Date.now() + 15 * 60_000) } })] : []),
    ]);
    await writeAudit({ eventType: "OTP_VERIFICATION", userRef: transaction.userId, transactionId: transaction.id, status: blocked ? "BLOCKED" : "FAILED", requestId: req.requestId, metadata: { attempts } });
    throw new HttpError(blocked ? 429 : 400, blocked ? "OTP_ATTEMPTS_EXCEEDED" : "INVALID_OTP", blocked ? "You have exceeded the maximum number of OTP attempts" : "Invalid OTP");
  }
  const token = newToken();
  await production.$transaction([
    production.otpTransaction.update({ where: { id: transaction.id }, data: { status: "USED", verifiedAt: new Date() } }),
    production.user.update({ where: { id: transaction.userId }, data: { failedOtpWindow: 0, blockedUntil: null } }),
    production.userSession.create({ data: { userId: transaction.userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 8 * 60 * 60_000) } }),
  ]);
  res.cookie("relive_session", token, { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax", maxAge: 8 * 60 * 60_000, path: "/" });
  await writeAudit({ eventType: "LOGIN", userRef: transaction.userId, transactionId: transaction.id, status: "SUCCESS", requestId: req.requestId });
  res.json(await getWorkflow(transaction.userId));
});

app.post("/api/v1/auth/logout", requireAuth, async (req, res) => {
  const token = req.cookies?.relive_session as string;
  await production.userSession.updateMany({ where: { tokenHash: hashToken(token) }, data: { revokedAt: new Date() } });
  res.clearCookie("relive_session", { path: "/" });
  res.status(204).end();
});

app.get("/api/v1/workflow", requireAuth, async (req, res) => res.json(await getWorkflow(userContext(req))));
app.get("/api/v1/credit/overview", requireAuth, async (req, res) => res.json(await getCreditOverview(userContext(req))));

app.post("/api/v1/profile/nsdl", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const existing = await production.userProfile.findUnique({ where: { userId } });
  if (existing) return res.json(await getWorkflow(userId));
  const details = await providers.nsdl(userId, scenario(req));
  await production.userProfile.create({ data: { userId, ...details, dateOfBirth: new Date(details.dateOfBirth), source: "NSDL", verified: true } });
  await writeAudit({ eventType: "PROFILE_RETRIEVED", userRef: userId, status: "SUCCESS", requestId: req.requestId, metadata: { source: "NSDL" } });
  res.json(await getWorkflow(userId));
});

app.post("/api/v1/profile/manual", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const data = manualProfileSchema.parse(req.body);
  const profile = await production.userProfile.upsert({
    where: { userId },
    create: { userId, ...data, dateOfBirth: new Date(data.dateOfBirth), source: "MANUAL_UNVERIFIED", verified: false },
    update: { ...data, dateOfBirth: new Date(data.dateOfBirth), source: "MANUAL_UNVERIFIED", verified: false },
  });
  await writeAudit({ eventType: "PROFILE_SAVED", userRef: userId, status: "SUCCESS", requestId: req.requestId, metadata: { source: profile.source, verified: false } });
  res.json(await getWorkflow(userId));
});

app.post("/api/v1/kyc/verify", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const { pan } = kycSchema.parse(req.body);
  const profile = await production.userProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(409, "PROFILE_REQUIRED", "Complete your profile before KYC");
  try {
    const result = await providers.kyc(userId, pan, scenario(req));
    await production.kycVerification.create({ data: { userId, panHash: hashPan(pan), panLast4: pan.slice(-4), status: "VERIFIED", providerRef: result.providerRef, verifiedAt: new Date() } });
    await writeAudit({ eventType: "KYC_VERIFICATION", userRef: userId, status: "SUCCESS", requestId: req.requestId });
    res.json(await getWorkflow(userId));
  } catch (error) {
    const reason = error instanceof ProviderError ? error.code : "KYC_ERROR";
    await production.kycVerification.create({ data: { userId, panHash: hashPan(pan), panLast4: pan.slice(-4), status: reason === "IDENTITY_MISMATCH" ? "MANUAL_REVIEW" : "FAILED", failureReason: reason } });
    throw error;
  }
});

app.post("/api/v1/credit/authorize", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const data = creditAuthorizationSchema.parse(req.body);
  const kyc = await production.kycVerification.findFirst({ where: { userId, status: "VERIFIED" }, orderBy: { createdAt: "desc" } });
  if (!kyc) throw new HttpError(409, "KYC_REQUIRED", "Successful KYC is required before authorization");
  await production.userConsent.create({ data: { userId, purpose: "CREDIT_REPORT", version: data.consentVersion, status: "GRANTED", ipAddress: req.ip, userAgent: req.header("user-agent") } });
  await writeAudit({ eventType: "CREDIT_AUTHORIZATION", userRef: userId, status: "GRANTED", requestId: req.requestId, metadata: { version: data.consentVersion } });
  res.json(await getWorkflow(userId));
});

app.post("/api/v1/credit/report", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const { idempotencyKey } = reportRequestSchema.parse(req.body);
  const duplicate = await production.creditReport.findUnique({ where: { idempotencyKey } });
  if (duplicate) {
    if (duplicate.userId !== userId) throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This request key is already in use");
    return res.json(await getWorkflow(userId));
  }
  const [kyc, authorization] = await Promise.all([
    production.kycVerification.findFirst({ where: { userId, status: "VERIFIED" }, orderBy: { createdAt: "desc" } }),
    production.userConsent.findFirst({ where: { userId, purpose: "CREDIT_REPORT", status: "GRANTED" }, orderBy: { grantedAt: "desc" } }),
  ]);
  if (!kyc) throw new HttpError(409, "KYC_REQUIRED", "Successful KYC is required before requesting a report");
  if (!authorization) throw new HttpError(409, "CREDIT_AUTHORIZATION_REQUIRED", "Credit-report authorization is required");
  const report = await providers.experian(userId, idempotencyKey, scenario(req));
  await production.creditReport.create({ data: {
    userId, bureau: "EXPERIAN", score: report.score, reportJson: report,
    providerRef: report.providerRef, idempotencyKey, status: "CURRENT",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
  }});
  await writeAudit({ eventType: "CREDIT_REPORT_RETRIEVED", userRef: userId, transactionId: idempotencyKey, status: "SUCCESS", requestId: req.requestId, metadata: { bureau: "EXPERIAN" } });
  res.json(await getWorkflow(userId));
});

app.get("/api/v1/dashboard", requireAuth, async (req, res) => {
  const userId = userContext(req);
  const report = await production.creditReport.findFirst({ where: { userId, status: "CURRENT", expiresAt: { gt: new Date() } }, orderBy: { retrievedAt: "desc" } });
  if (!report) throw new HttpError(404, "REPORT_NOT_FOUND", "No current credit report is available");
  res.json(await getCreditOverview(userId));
});

app.use((_req, _res, next) => next(new HttpError(404, "NOT_FOUND", "Route not found")));
app.use(async (error: unknown, req: Request, res: Response, _next: NextFunction) => {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong. Please try again";
  let retryable = false;
  let details: unknown;
  if (error instanceof HttpError) ({ status, code, message, retryable, details } = error);
  else if (error instanceof ZodError) { status = 400; code = "VALIDATION_ERROR"; message = error.issues[0]?.message ?? "Invalid request"; details = error.flatten(); }
  else if (error instanceof ProviderError) {
    status = error.kind === "BUSINESS_FAILURE" ? 422 : error.kind === "TIMEOUT" ? 504 : 503;
    code = error.code; message = error.message; retryable = error.retryable;
  }
  try { await writeAudit({ eventType: "API_ERROR", userRef: req.userId, status: code, requestId: req.requestId, metadata: { method: req.method, path: req.path } }); } catch { /* preserve the original response if audit storage is unavailable */ }
  res.status(status).json({ error: { code, message, retryable, ...(details !== undefined && { details }) } });
});

export { app };
