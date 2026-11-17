import { randomUUID } from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import {
  bureauMobileSchema, concernSchema, kycSchema, manualProfileSchema, requestOtpSchema,
  reportRequestSchema, supportRequestSchema, verifyOtpSchema,
} from "@relive/shared";
import { z, ZodError } from "zod";
import { env } from "./config/env.js";
import { audit, production } from "./database/clients.js";
import { findSession, requireAuth, SESSION_COOKIE } from "./middleware/auth.js";
import { decrypt, encrypt, hashMobile, hashOtp, hashPan, hashToken, newToken, secureEqual } from "./lib/crypto.js";
import { HttpError, ProviderError } from "./lib/errors.js";
import { stepForStage, trackJourney, writeAudit } from "./services/audit.js";
import { providers, type MockScenario } from "./services/providers.js";
import { getWorkflow } from "./services/workflow.js";
import { getCreditOverview } from "./services/credit-score.js";
import { getDashboardInsight } from "./services/dashboard-insight.js";
import { emailLead } from "./services/lead-email.js";
import { echoedRequestIdentity, extractReportIdentity, matchReportIdentity } from "./services/report-identity.js";

const app = express();
app.disable("x-powered-by");
// ponytail: assumes exactly one reverse proxy in production; set to the real hop count if that changes
if (env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN.split(",").map((v) => v.trim()), credentials: true }));
app.use(express.json({ limit: "32kb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  req.requestId = req.header("x-request-id") ?? randomUUID();
  res.setHeader("x-request-id", req.requestId);
  // Responses carry personal data: never let the browser or a proxy cache them (incl. back/forward cache).
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Per-IP limits. Skipped under the test runner (one IP for every test); per-user OTP/PAN/report limits still apply.
const skipInTests = () => env.NODE_ENV === "test";
const authLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false, skip: skipInTests });
const sensitiveLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false, skip: skipInTests });

const scenarios = z.enum(["success", "business_failure", "technical_failure", "timeout", "invalid_response", "no_record"]);
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
  res.json({ status: "ok", services: { api: "ok", productionDatabase: "ok", auditDatabase: "ok" }, providers: { otp: env.OTP_PROVIDER, pan: env.PAN_PROVIDER, bureau: env.BUREAU_PROVIDER } });
});

const OTP_TTL_MS = 5 * 60_000;
const OTP_RESEND_AFTER_MS = 10_000;
const OTP_MAX_FAILED_ATTEMPTS = 3; // counted per user, so resending does not reset them
const OTP_MAX_SENDS = 5; // per OTP_SEND_WINDOW_MS per user
const OTP_SEND_WINDOW_MS = 30 * 60_000;
const LOCKOUT_MS = 15 * 60_000;
const SESSION_TTL_MS = 8 * 60 * 60_000;
// Customer care number shown in user-facing errors. Keep in sync with frontend/lib/contact.ts.
const SUPPORT_PHONE = "+91 82912 11398";
// Same options when setting and clearing, or the browser keeps the old cookie.
const sessionCookie = () => ({ httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" });

const secondsUntil = (date: Date) => Math.max(1, Math.ceil((date.getTime() - Date.now()) / 1000));

function assertNotLocked(user: { status: string; blockedUntil: Date | null }) {
  if (user.status === "BLOCKED") throw new HttpError(403, "ACCOUNT_BLOCKED", `This account is blocked. Please contact customer care on ${SUPPORT_PHONE}`);
  if (user.blockedUntil && user.blockedUntil > new Date()) {
    throw new HttpError(429, "OTP_ATTEMPTS_EXCEEDED", "Too many attempts. Please try again later", true, { retryAfterSeconds: secondsUntil(user.blockedUntil) });
  }
}

async function assertCanSendOtp(userId: string) {
  const [last, recentSends] = await Promise.all([
    production.otpTransaction.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } }),
    production.otpTransaction.count({ where: { userId, createdAt: { gt: new Date(Date.now() - OTP_SEND_WINDOW_MS) } } }),
  ]);
  if (last && last.resendAfter > new Date()) {
    throw new HttpError(429, "RESEND_TOO_SOON", "Please wait before requesting another OTP", true, { retryAfterSeconds: secondsUntil(last.resendAfter) });
  }
  if (recentSends >= OTP_MAX_SENDS) {
    throw new HttpError(429, "OTP_SEND_LIMIT", "Too many OTP requests. Please try again in 30 minutes", true);
  }
}

/** Sends an OTP to `mobile` (login number or an alternate bureau number). Cooldown and limits are shared per user. */
async function issueOtp(req: Request, user: { id: string }, mobile: string, purpose: "LOGIN" | "BUREAU_MOBILE") {
  await assertCanSendOtp(user.id);
  const otpStep = purpose === "LOGIN" ? "OTP" : "ALT_MOBILE";
  const transactionId = randomUUID();
  let sent: { providerRef: string | null; otp: string | null };
  try {
    sent = await providers.sendOtp(user.id, mobile, scenario(req), transactionId);
  } catch (error) {
    await trackJourney({
      userRef: user.id, eventType: "OTP_SEND_FAILED", step: otpStep, outcome: error instanceof ProviderError ? error.code : "UNKNOWN",
      requestId: req.requestId, transactionId, metadata: { purpose, mobileLast4: mobile.slice(-4) },
    });
    throw error;
  }
  const now = Date.now();
  await production.$transaction([
    // A new OTP supersedes any earlier one still pending.
    production.otpTransaction.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "EXPIRED" } }),
    production.otpTransaction.create({ data: {
      id: transactionId, userId: user.id, status: "PENDING", purpose,
      targetMobileEncrypted: purpose === "BUREAU_MOBILE" ? encrypt(mobile) : null,
      providerRef: sent.providerRef, otpHash: sent.otp ? hashOtp(transactionId, sent.otp) : null,
      expiresAt: new Date(now + OTP_TTL_MS), resendAfter: new Date(now + OTP_RESEND_AFTER_MS),
    }}),
  ]);
  await trackJourney({
    userRef: user.id, eventType: "OTP_SENT", step: otpStep, outcome: "SUCCESS", requestId: req.requestId, transactionId,
    metadata: { purpose, mobileLast4: mobile.slice(-4), provider: env.OTP_PROVIDER.toUpperCase() }, increment: ["otpSends"],
  });
  return {
    transactionId,
    mobileLast4: mobile.slice(-4),
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_AFTER_MS / 1000,
    // Only the fixed mock code is ever echoed back; a real OTP must reach the user only by SMS.
    ...(env.NODE_ENV !== "production" && env.OTP_PROVIDER === "mock" && { devOtp: env.OTP_MOCK_CODE }),
  };
}

/**
 * Verifies an OTP and marks it used. Wrong attempts count per user across purposes and resends;
 * 3 wrong -> 15-minute lockout. `ownerId` pins the OTP to the signed-in user for non-login purposes.
 */
async function consumeOtp(req: Request, data: { transactionId: string; otp: string }, purpose: "LOGIN" | "BUREAU_MOBILE", ownerId?: string) {
  const transaction = await production.otpTransaction.findUnique({ where: { id: data.transactionId }, include: { user: true } });
  if (!transaction || transaction.purpose !== purpose || (ownerId && transaction.userId !== ownerId)) {
    throw new HttpError(400, "OTP_TRANSACTION_NOT_FOUND", "OTP request was not found. Request a new OTP");
  }
  assertNotLocked(transaction.user);
  if (transaction.status === "USED") throw new HttpError(409, "OTP_ALREADY_USED", "This OTP has already been used. Request a new OTP");
  if (transaction.status === "BLOCKED") throw new HttpError(429, "OTP_ATTEMPTS_EXCEEDED", "Too many attempts. Please try again later");
  if (transaction.status === "EXPIRED" || transaction.expiresAt <= new Date()) {
    if (transaction.status === "PENDING") await production.otpTransaction.update({ where: { id: transaction.id }, data: { status: "EXPIRED" } });
    throw new HttpError(410, "OTP_EXPIRED", "This OTP has expired. Request a new OTP", true);
  }

  let valid: boolean;
  // No stored hash = IndiConnect generated the OTP and checks it. Otherwise (mock, Smartping) Relive checks its own hash.
  if (transaction.otpHash === null && transaction.providerRef) {
    try {
      await providers.verifyOtp(transaction.userId, transaction.providerRef, data.otp);
      valid = true;
    } catch (error) {
      // Only a definite "wrong OTP" counts as an attempt; outages surface as 503/504 and are retryable.
      if (!(error instanceof ProviderError && error.kind === "BUSINESS_FAILURE")) throw error;
      valid = false;
    }
  } else {
    valid = transaction.otpHash !== null && secureEqual(transaction.otpHash, hashOtp(transaction.id, data.otp));
  }

  if (!valid) {
    // ponytail: failedOtpWindow only resets on success or lockout, add a last-failure timestamp if stale failures should expire
    const user = await production.user.update({ where: { id: transaction.userId }, data: { failedOtpWindow: { increment: 1 } } });
    const locked = user.failedOtpWindow >= OTP_MAX_FAILED_ATTEMPTS;
    if (locked) {
      await production.$transaction([
        production.user.update({ where: { id: user.id }, data: { failedOtpWindow: 0, blockedUntil: new Date(Date.now() + LOCKOUT_MS) } }),
        production.otpTransaction.updateMany({ where: { userId: user.id, status: "PENDING" }, data: { status: "BLOCKED" } }),
      ]);
    }
    await trackJourney({
      userRef: user.id, eventType: locked ? "OTP_LOCKED" : "OTP_INVALID", step: locked && purpose === "LOGIN" ? "MOBILE" : purpose === "LOGIN" ? "OTP" : "ALT_MOBILE",
      outcome: locked ? "OTP_ATTEMPTS_EXCEEDED" : "INVALID_OTP", requestId: req.requestId, transactionId: transaction.id,
      metadata: { purpose, failedAttempts: user.failedOtpWindow }, increment: ["otpFailures"],
    });
    if (locked) throw new HttpError(429, "OTP_ATTEMPTS_EXCEEDED", "Too many incorrect attempts. Please try again in 15 minutes", false, { retryAfterSeconds: LOCKOUT_MS / 1000 });
    const attemptsRemaining = OTP_MAX_FAILED_ATTEMPTS - user.failedOtpWindow;
    throw new HttpError(400, "INVALID_OTP", `Invalid OTP. ${attemptsRemaining} attempt${attemptsRemaining === 1 ? "" : "s"} left`, false, { attemptsRemaining });
  }

  // Conditional update makes the OTP single-use even under concurrent requests.
  const claimed = await production.otpTransaction.updateMany({ where: { id: transaction.id, status: "PENDING" }, data: { status: "USED", verifiedAt: new Date() } });
  if (claimed.count !== 1) throw new HttpError(409, "OTP_ALREADY_USED", "This OTP has already been used. Request a new OTP");
  await production.user.update({ where: { id: transaction.userId }, data: { failedOtpWindow: 0, blockedUntil: null } });
  return transaction;
}

/** Cloudflare Turnstile check, so bots cannot trigger billed OTP SMS. Skipped when TURNSTILE_SECRET_KEY is unset. */
async function assertHuman(token: string | undefined) {
  if (!env.TURNSTILE_SECRET_KEY) return;
  if (!token) throw new HttpError(400, "CAPTCHA_REQUIRED", "Please wait for the security check to finish, then try again");
  let result: { success?: boolean };
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
      signal: AbortSignal.timeout(10_000),
    });
    result = await response.json();
  } catch {
    throw new HttpError(503, "CAPTCHA_UNAVAILABLE", "We could not run the security check. Please try again");
  }
  if (!result.success) throw new HttpError(400, "CAPTCHA_FAILED", "The security check failed. Please try again");
}

app.post("/api/v1/auth/request-otp", authLimiter, async (req, res) => {
  const data = requestOtpSchema.parse(req.body);
  await assertHuman(data.turnstileToken);
  const mobileHash = hashMobile(data.mobile);
  // New numbers are allowed: the "existing user?" decision happens after OTP verification.
  const user = await production.user.upsert({ where: { mobileHash }, update: { mobileEncrypted: encrypt(data.mobile) }, create: { mobileHash, mobileLast4: data.mobile.slice(-4), mobileEncrypted: encrypt(data.mobile) } });
  assertNotLocked(user);

  await assertCanSendOtp(user.id);

  // The single checkbox is recorded per purpose, before the OTP leaves (consent is what authorises sending it).
  const purposes = ["LOGIN", "CREDIT_REPORT", "MARKETING"] as const;
  await production.userConsent.createMany({ data: purposes.map((purpose) => ({
    userId: user.id, purpose, version: data.consentVersion, status: "GRANTED" as const,
    ipAddress: req.ip, userAgent: req.header("user-agent"),
  }))});
  await trackJourney({
    userRef: user.id, eventType: "CONSENT_GRANTED", step: "MOBILE", outcome: "SUCCESS", requestId: req.requestId,
    metadata: { purposes: [...purposes], version: data.consentVersion, ipAddress: req.ip ?? null, userAgent: req.header("user-agent") ?? null },
    set: { mobileLast4: data.mobile.slice(-4) },
  });

  res.status(201).json(await issueOtp(req, user, data.mobile, "LOGIN"));
});

app.post("/api/v1/auth/verify-otp", authLimiter, async (req, res) => {
  const transaction = await consumeOtp(req, verifyOtpSchema.parse(req.body), "LOGIN");

  const token = newToken();
  await production.userSession.create({ data: { userId: transaction.userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
  res.cookie(SESSION_COOKIE, token, { ...sessionCookie(), maxAge: SESSION_TTL_MS });
  const workflow = await getWorkflow(transaction.userId);
  await trackJourney({
    userRef: transaction.userId, eventType: "LOGIN", step: stepForStage(workflow.stage), outcome: "SUCCESS",
    requestId: req.requestId, transactionId: transaction.id, metadata: { stage: workflow.stage, existingUser: workflow.stage === "DASHBOARD" },
  });
  res.json(workflow);
});

// Always succeeds: an already-expired session must still be able to log out and clear its cookie.
app.post("/api/v1/auth/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const session = await findSession(req);
  if (token) await production.userSession.updateMany({ where: { tokenHash: hashToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  res.clearCookie(SESSION_COOKIE, sessionCookie());
  if (session) await writeAudit({ eventType: "LOGOUT", userRef: session.userId, status: "SUCCESS", requestId: req.requestId });
  res.status(204).end();
});

// Session check for the frontend's route guards. 200 either way, so signed-out visitors don't log errors.
app.get("/api/v1/auth/session", async (req, res) => {
  const session = await findSession(req);
  if (!session) {
    if (req.cookies?.[SESSION_COOKIE]) res.clearCookie(SESSION_COOKIE, sessionCookie()); // stale cookie
    return res.json({ authenticated: false });
  }
  const { stage } = await getWorkflow(session.userId);
  res.json({ authenticated: true, stage, expiresAt: session.expiresAt.toISOString() });
});

app.get("/api/v1/workflow", requireAuth, async (req, res) => res.json(await getWorkflow(userContext(req))));
app.get("/api/v1/credit/overview", requireAuth, async (req, res) => res.json(await getCreditOverview(userContext(req))));

// "What brings you to Relive today?" answers, sent right after login. Latest answers replace earlier ones.
app.post("/api/v1/concern", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const { selected_concern, customer_text } = concernSchema.parse(req.body);
  const fields = { selectedConcern: selected_concern, customerTextEncrypted: customer_text ? encrypt(customer_text) : null };
  await production.userConcern.upsert({ where: { userId }, create: { userId, ...fields }, update: fields });
  // The options are a fixed list; the free text can hold personal details, so only its presence is logged.
  await writeAudit({ eventType: "CONCERN_SAVED", userRef: userId, status: "SUCCESS", requestId: req.requestId, metadata: { selected_concern, hasText: Boolean(customer_text) } });
  res.status(204).end();
});

// Personalised dashboard summary (AI). { insight: null } = keep the rule-based summary (AI off, no report, or it failed).
app.get("/api/v1/credit/insight", requireAuth, async (req, res) => {
  const userId = userContext(req);
  try {
    const insight = await getDashboardInsight(userId, (metadata) =>
      writeAudit({ eventType: "INSIGHT_GENERATED", userRef: userId, status: "SUCCESS", requestId: req.requestId, metadata }));
    res.json({ insight });
  } catch (error) {
    // Not an error for the user: the dashboard already shows the rule-based summary.
    const cause = error instanceof Error ? error : new Error(String(error));
    console.error(cause);
    await audit.errorLog.create({ data: {
      code: "INSIGHT_FAILED", message: cause.message.slice(0, 1000), requestId: req.requestId, userRef: userId,
      metadata: { method: req.method, path: req.path, stack: cause.stack?.slice(0, 4000) ?? null },
    }}).catch(() => undefined);
    res.json({ insight: null });
  }
});

app.post("/api/v1/profile/manual", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const data = manualProfileSchema.parse(req.body);
  const dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null; // optional
  const profile = await production.userProfile.upsert({
    where: { userId },
    create: { userId, ...data, dateOfBirth, source: "MANUAL_UNVERIFIED", verified: false },
    update: { ...data, dateOfBirth, source: "MANUAL_UNVERIFIED", verified: false },
  });
  await trackJourney({
    userRef: userId, eventType: "DETAILS_SAVED", step: "REPORT", outcome: "SUCCESS", requestId: req.requestId,
    metadata: { source: profile.source, hasEmail: Boolean(profile.email), hasDob: Boolean(profile.dateOfBirth) }, set: { identitySource: "MANUAL" },
  });
  res.json(await getWorkflow(userId));
});

app.post("/api/v1/kyc/verify", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const { pan } = kycSchema.parse(req.body);
  const panHash = hashPan(pan);
  const [linkedElsewhere, recentAttempts] = await Promise.all([
    production.kycVerification.findFirst({ where: { panHash, status: "VERIFIED", userId: { not: userId } } }),
    production.kycVerification.count({ where: { userId, createdAt: { gt: new Date(Date.now() - DAY_MS) } } }),
  ]);
  if (linkedElsewhere) {
    throw new HttpError(409, "PAN_ALREADY_LINKED", `This PAN is already registered with another mobile number. Log in with that number, or call customer care on ${SUPPORT_PHONE}`);
  }
  if (recentAttempts >= PAN_ATTEMPTS_PER_DAY) {
    throw new HttpError(429, "PAN_ATTEMPT_LIMIT", "Too many PAN attempts today. Continue by entering your name as on PAN", false);
  }

  let details;
  try {
    details = await providers.panDetails(userId, pan, scenario(req));
  } catch (error) {
    const reason = error instanceof ProviderError ? error.code : "KYC_ERROR";
    await production.kycVerification.create({ data: { userId, panHash, panLast4: pan.slice(-4), status: "FAILED", failureReason: reason } });
    await trackJourney({
      userRef: userId, eventType: "PAN_FAILED", step: "PAN", outcome: reason, requestId: req.requestId,
      metadata: { panLast4: pan.slice(-4), provider: env.PAN_PROVIDER }, increment: ["panAttempts"],
    });
    throw error;
  }
  // The PAN record is the verified identity: it fills a new profile or replaces manual details.
  const { providerRef, email, phoneLast4, phoneFormat, ...identity } = details;
  // Last 4 digits + digit-free format of the PAN record's mobile: enough to check a mismatch, never the number itself.
  const panPhone = { panPhoneLast4: phoneLast4 ?? null, panPhoneFormat: phoneFormat ?? null };
  const user = await production.user.findUniqueOrThrow({ where: { id: userId }, select: { mobileLast4: true, bureauMobileLast4: true } });
  // Anyone can type any PAN: when the PAN record names a mobile that isn't one this user proved by OTP,
  // don't reveal or adopt that identity (name, DOB, email); a person reviews it instead.
  if (phoneLast4 && phoneLast4 !== user.mobileLast4 && phoneLast4 !== user.bureauMobileLast4) {
    await production.kycVerification.create({ data: { userId, panHash, panLast4: pan.slice(-4), status: "MANUAL_REVIEW", providerRef, failureReason: "PAN_MOBILE_MISMATCH" } });
    await trackJourney({
      userRef: userId, eventType: "PAN_MOBILE_MISMATCH", step: "PAN", outcome: "MANUAL_REVIEW", requestId: req.requestId,
      metadata: { panLast4: pan.slice(-4), provider: env.PAN_PROVIDER, loginMobileLast4: user.mobileLast4, ...panPhone }, increment: ["panAttempts"],
    });
    throw new HttpError(409, "PAN_MOBILE_MISMATCH",
      "This PAN is registered with a different mobile number, so we couldn't verify it here. Log in with that number, or continue by entering your details", false);
  }
  const fields = { ...identity, dateOfBirth: new Date(identity.dateOfBirth), source: "NSDL" as const, verified: true };
  await production.$transaction([
    production.userProfile.upsert({
      where: { userId },
      create: { userId, ...fields, email },
      update: { ...fields, ...(email && { email }) },
    }),
    production.kycVerification.create({ data: { userId, panHash, panLast4: pan.slice(-4), panEncrypted: encrypt(pan), status: "VERIFIED", providerRef, verifiedAt: new Date() } }),
  ]);
  await trackJourney({
    userRef: userId, eventType: "PAN_VERIFIED", step: "REPORT", outcome: "SUCCESS", requestId: req.requestId,
    // A mismatching PAN mobile is rejected above; null = the PAN record had no mobile to compare.
    metadata: { panLast4: pan.slice(-4), provider: env.PAN_PROVIDER, panMobileMatchesLogin: phoneLast4 ? phoneLast4 === user.mobileLast4 : null, ...panPhone },
    increment: ["panAttempts"],
    set: { identitySource: "PAN", panLast4: pan.slice(-4) },
  });
  res.json(await getWorkflow(userId));
});

// ponytail: in-memory lock, single API instance only; use a DB advisory lock if the API is scaled out
const reportsInFlight = new Set<string>();
const REPORT_TTL_MS = 30 * 24 * 60 * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const PAN_ATTEMPTS_PER_DAY = 5; // PAN lookups are billed
const REPORT_ATTEMPTS_PER_DAY = 3; // each attempt = up to two billed bureau pulls

app.post("/api/v1/credit/report", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const { idempotencyKey } = reportRequestSchema.parse(req.body);
  const duplicate = await production.creditReport.findUnique({ where: { idempotencyKey } });
  if (duplicate) {
    if (duplicate.userId !== userId) throw new HttpError(409, "IDEMPOTENCY_CONFLICT", "This request key is already in use");
    return res.json(await getWorkflow(userId));
  }
  const [user, profile, authorization, current] = await Promise.all([
    production.user.findUniqueOrThrow({ where: { id: userId } }),
    production.userProfile.findUnique({ where: { userId } }),
    production.userConsent.findFirst({ where: { userId, purpose: "CREDIT_REPORT", status: "GRANTED" }, orderBy: { grantedAt: "desc" } }),
    production.creditReport.findFirst({ where: { userId, status: "CURRENT", expiresAt: { gt: new Date() } } }),
  ]);
  // Bureau pulls are billed: a current report is reused until it expires.
  if (current) return res.json(await getWorkflow(userId));
  if (!profile) throw new HttpError(409, "PROFILE_REQUIRED", "Complete your profile before requesting a report");
  // Granted with the signup checkbox; older accounts re-consent by logging in again.
  if (!authorization) throw new HttpError(409, "CONSENT_REQUIRED", "Please log out and log in again to give consent for fetching your credit report");
  const attemptsToday = await production.apiTransaction.count({
    where: { userId, operation: "CREDIT_REPORT_EXPERIAN", createdAt: { gt: new Date(Date.now() - DAY_MS) } },
  });
  if (attemptsToday >= REPORT_ATTEMPTS_PER_DAY) {
    throw new HttpError(429, "REPORT_ATTEMPT_LIMIT", "You've reached today's limit for fetching your credit report. Please try again tomorrow", false);
  }
  // Missing or unreadable (e.g. DATA_ENCRYPTION_KEY rotated): the next login re-saves it.
  let mobile: string;
  try {
    // An OTP-verified alternate number (the one the bureaus have) wins over the login number.
    mobile = decrypt(user.bureauMobileEncrypted ?? user.mobileEncrypted ?? "");
  } catch {
    throw new HttpError(409, "MOBILE_REVERIFY_REQUIRED", "Please log out and log in again to fetch your report", false);
  }
  if (reportsInFlight.has(userId)) throw new HttpError(409, "REPORT_IN_PROGRESS", "Your report is already being fetched. Please wait", true);

  // PAN-verified users: send the verified PAN + DOB too, so the bureau matches on identity, not just name + mobile.
  // Manual (unverified) details are never sent as identity: they could be someone else's.
  const verifiedKyc = await production.kycVerification.findFirst({ where: { userId, status: "VERIFIED" }, orderBy: { createdAt: "desc" } });
  let verifiedPan: string | undefined;
  try {
    verifiedPan = verifiedKyc?.panEncrypted ? decrypt(verifiedKyc.panEncrypted) : undefined;
  } catch {
    verifiedPan = undefined; // unreadable (key rotated): fall back to name + mobile; the identity check still applies
  }
  const dateOfBirth = profile.dateOfBirth?.toISOString().slice(0, 10) ?? null;
  const input = {
    name: `${profile.firstName} ${profile.lastName}`.trim(),
    mobile,
    ...(verifiedPan && profile.verified && dateOfBirth && { pan: verifiedPan, dob: dateOfBirth }),
  };
  reportsInFlight.add(userId);
  try {
    // Experian first; CRIF only when Experian fails for any reason.
    const failures: ProviderError[] = [];
    let pull;
    for (const bureau of ["EXPERIAN", "CRIF"] as const) {
      try {
        pull = await providers.bureau(bureau, userId, input, idempotencyKey, scenario(req));
        break;
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        failures.push(error);
        await trackJourney({
          userRef: userId, eventType: "BUREAU_FAILED", step: "REPORT", outcome: error.code, requestId: req.requestId, transactionId: idempotencyKey,
          metadata: { bureau, kind: error.kind, mobileLast4: mobile.slice(-4), usingAlternateMobile: Boolean(user.bureauMobileEncrypted) },
        });
      }
    }
    if (!pull) {
      // Only when BOTH bureaus answered "no record" can we tell the user to fix their details.
      // Any outage/timeout means we don't know yet, so the safe answer is "try again".
      const noRecord = failures.every((failure) => failure.kind === "BUSINESS_FAILURE");
      await trackJourney({
        userRef: userId, eventType: noRecord ? "REPORT_NO_RECORD" : "REPORT_UNAVAILABLE", step: "REPORT",
        outcome: noRecord ? "NO_CREDIT_RECORD" : "REPORT_UNAVAILABLE", requestId: req.requestId, transactionId: idempotencyKey,
        metadata: { mobileLast4: mobile.slice(-4), usingAlternateMobile: Boolean(user.bureauMobileEncrypted) }, increment: ["reportAttempts"],
      });
      if (noRecord) {
        throw new HttpError(422, "NO_CREDIT_RECORD",
          `We couldn't find a credit record for "${input.name}" with the mobile number ending ${mobile.slice(-4)}. Bureaus match on the number you gave your bank or lender, so try that number, or check your name matches your PAN`,
          false, { mobileLast4: mobile.slice(-4), triedAlternate: Boolean(user.bureauMobileEncrypted) });
      }
      throw new HttpError(503, "REPORT_UNAVAILABLE", "Credit bureaus aren't responding right now. Please try again in a few minutes", true);
    }
    // The pull is keyed on name + mobile only: never show a report whose PAN / DOB isn't this user's
    // (shared phone, recycled number, SIM swap). Mock reports carry no identity and aren't real people.
    // Date of birth is optional: with neither a verified PAN nor a DOB there's nothing to compare, so the
    // report is shown on name + OTP-verified mobile alone (product decision, accepts the recycled-number risk).
    if (!(pull.raw as { mock?: boolean } | null)?.mock && (verifiedKyc || dateOfBirth)) {
      const verdict = matchReportIdentity(
        extractReportIdentity(pull.raw),
        { verifiedPanHash: verifiedKyc?.panHash ?? null, dateOfBirth },
        hashPan,
      );
      if (verdict !== "MATCH") {
        // Not stored: the report may be someone else's. The billed call itself is already in apiTransaction.
        await trackJourney({
          userRef: userId, eventType: "REPORT_IDENTITY_MISMATCH", step: "REPORT", outcome: verdict, requestId: req.requestId, transactionId: idempotencyKey,
          metadata: { bureau: pull.bureau, panVerified: Boolean(verifiedKyc), mobileLast4: mobile.slice(-4), usingAlternateMobile: Boolean(user.bureauMobileEncrypted) },
          increment: ["reportAttempts"],
        });
        throw new HttpError(422, "REPORT_IDENTITY_MISMATCH",
          verifiedKyc
            ? "The credit report we received doesn't match your verified PAN, so we can't show it. If this mobile number was recently assigned to you, use the number registered with your bank"
            : "The credit report we received doesn't match your date of birth, so we can't show it. Check your date of birth, or verify your PAN in your profile",
          false);
      }
    }
    await production.creditReport.create({ data: {
      userId, bureau: pull.bureau, score: pull.report.score, reportJson: pull.report, rawResponse: pull.raw as object,
      providerRef: pull.providerRef, idempotencyKey, status: "CURRENT", expiresAt: new Date(Date.now() + REPORT_TTL_MS),
    }});
    await trackJourney({
      userRef: userId, eventType: "REPORT_FETCHED", step: "DASHBOARD", outcome: "SUCCESS", requestId: req.requestId, transactionId: idempotencyKey,
      metadata: {
        bureau: pull.bureau, score: pull.report.score, crifFallback: failures.length > 0, mobileLast4: mobile.slice(-4),
        // Sent PAN/DOB vs what the bureau echoes back: false/false while sent=true means IndiConnect dropped them.
        identitySent: Boolean(input.pan), ...(input.pan && { identityReceived: echoedRequestIdentity(pull.raw) }),
      },
      increment: ["reportAttempts"], set: { status: "COMPLETED", bureau: pull.bureau },
    });
    res.json(await getWorkflow(userId));
  } finally {
    reportsInFlight.delete(userId);
  }
});

// ---- "Get help" from the dashboard: stored as a lead; the team calls back on the verified login number ----
app.post("/api/v1/support-requests", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const data = supportRequestSchema.parse(req.body);
  const request = await production.supportRequest.create({
    data: {
      userId, topic: data.topic, accountLabel: data.account, question: data.question,
      preferredTime: data.preferredTime, preferredLanguage: data.preferredLanguage,
    },
  });
  // The question can hold personal details, so the audit log only records that a request was made.
  await writeAudit({ eventType: "SUPPORT_REQUESTED", userRef: userId, status: "SUCCESS", requestId: req.requestId, metadata: { supportRequestId: request.id, topic: data.topic } });
  res.status(201).json({ id: request.id });
  // Sent after replying: a slow or failing mail server must not hold up or fail the user's request.
  emailLead(request.id).catch((error: unknown) =>
    writeAudit({
      eventType: "SUPPORT_EMAIL_FAILED", userRef: userId, status: "FAILURE", requestId: req.requestId,
      metadata: { supportRequestId: request.id, reason: String(error instanceof Error ? error.message : error).slice(0, 300) },
    }).catch(() => undefined),
  );
});

// ---- No record on the login number: try the number the bureaus may have on file ----

app.post("/api/v1/credit/bureau-mobile/request-otp", requireAuth, authLimiter, async (req, res) => {
  const userId = userContext(req);
  const { mobile } = bureauMobileSchema.parse(req.body);
  const user = await production.user.findUniqueOrThrow({ where: { id: userId } });
  assertNotLocked(user);
  if (hashMobile(mobile) === user.mobileHash) {
    throw new HttpError(400, "SAME_MOBILE", "That's the number you logged in with. Enter the other number registered with your bank or lender");
  }
  res.status(201).json(await issueOtp(req, user, mobile, "BUREAU_MOBILE"));
});

app.post("/api/v1/credit/bureau-mobile/verify", requireAuth, authLimiter, async (req, res) => {
  const userId = userContext(req);
  const transaction = await consumeOtp(req, verifyOtpSchema.parse(req.body), "BUREAU_MOBILE", userId);
  const mobile = decrypt(transaction.targetMobileEncrypted!);
  await production.user.update({ where: { id: userId }, data: { bureauMobileEncrypted: transaction.targetMobileEncrypted, bureauMobileLast4: mobile.slice(-4) } });
  await trackJourney({
    userRef: userId, eventType: "ALT_MOBILE_VERIFIED", step: "REPORT", outcome: "SUCCESS", requestId: req.requestId,
    transactionId: transaction.id, set: { altMobileLast4: mobile.slice(-4) },
  });
  res.json(await getWorkflow(userId));
});

// ---- Both bureaus confirmed "no record" and the user has no other number: genuinely new to credit ----

app.post("/api/v1/credit/no-history", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const since = new Date(Date.now() - DAY_MS);
  const [experian, crif] = await Promise.all(["CREDIT_REPORT_EXPERIAN", "CREDIT_REPORT_CRIF"].map((operation) =>
    production.apiTransaction.findFirst({ where: { userId, operation, createdAt: { gt: since } }, orderBy: { createdAt: "desc" } })));
  // Only allowed right after both bureaus said "no record" (not after an outage).
  if (experian?.status !== "BUSINESS_FAILURE" || crif?.status !== "BUSINESS_FAILURE") {
    throw new HttpError(409, "NO_RECORD_UNCONFIRMED", "Please fetch your credit report first", false);
  }
  const existing = await production.creditReport.findFirst({ where: { userId } });
  if (!existing) {
    await production.creditReport.create({ data: {
      userId, bureau: "NONE", score: 0, reportJson: { noRecord: true }, status: "NO_RECORD",
      idempotencyKey: randomUUID(), expiresAt: new Date(Date.now() + REPORT_TTL_MS),
    }});
    await trackJourney({
      userRef: userId, eventType: "NO_CREDIT_HISTORY_CONFIRMED", step: "DASHBOARD", outcome: "SUCCESS", requestId: req.requestId,
      set: { status: "NO_CREDIT_HISTORY" },
    });
  }
  res.json(await getWorkflow(userId));
});

// The bureau's own PDF of the latest report (link comes from the stored IndiConnect response).
app.get("/api/v1/credit/report-pdf", requireAuth, sensitiveLimiter, async (req, res) => {
  const userId = userContext(req);
  const report = await production.creditReport.findFirst({ where: { userId, status: "CURRENT" }, orderBy: { retrievedAt: "desc" } });
  const raw = report?.rawResponse as { experian_report_link?: unknown; credit_report_link?: unknown } | null | undefined;
  const url = [raw?.experian_report_link, raw?.credit_report_link].find((link): link is string => typeof link === "string" && /^https:\/\//.test(link));
  if (!url) throw new HttpError(404, "REPORT_PDF_UNAVAILABLE", "The bureau did not provide a PDF for this report");
  await writeAudit({ eventType: "REPORT_PDF_OPENED", userRef: userId, status: "SUCCESS", requestId: req.requestId, metadata: { bureau: report!.bureau } });
  res.json({ url });
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
  // express.json(): malformed or oversized body. The client's mistake, not an internal error.
  else if (typeof (error as { status?: unknown })?.status === "number" && (error as { status: number }).status < 500) {
    status = (error as { status: number }).status; code = "BAD_REQUEST"; message = "Invalid request";
  }
  else {
    // Unexpected: the response hides the cause and API_ERROR below keeps only the code, so error_logs keeps the cause.
    console.error(error);
    const cause = error instanceof Error ? error : new Error(String(error));
    try {
      await audit.errorLog.create({ data: {
        code, message: cause.message.slice(0, 1000), requestId: req.requestId, userRef: req.userId,
        metadata: { method: req.method, path: req.path, stack: cause.stack?.slice(0, 4000) ?? null },
      }});
    } catch { /* same as below: never mask the original response */ }
  }
  try { await writeAudit({ eventType: "API_ERROR", userRef: req.userId, status: code, requestId: req.requestId, metadata: { method: req.method, path: req.path } }); } catch { /* preserve the original response if audit storage is unavailable */ }
  res.status(status).json({ error: { code, message, retryable, ...(details !== undefined && { details }) } });
});

export { app };
