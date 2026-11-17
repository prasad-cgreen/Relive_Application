import { randomInt, randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { production } from "../database/clients.js";
import { ProviderError } from "../lib/errors.js";
import { demoReport, normalizeCrif, normalizeExperian, type NormalizedReport } from "./bureau.js";

export type MockScenario = "success" | "business_failure" | "technical_failure" | "timeout" | "invalid_response" | "no_record";

export type Bureau = "EXPERIAN" | "CRIF";
/** pan + dob only for PAN-verified users (YYYY-MM-DD). */
export type BureauInput = { name: string; mobile: string; pan?: string; dob?: string };
export type BureauPull = { bureau: Bureau; providerRef: string; report: NormalizedReport; raw: unknown };
/** phone: the mobile on the PAN record as IndiConnect shows it (middle masked, e.g. "91XXXXXX81"); see normalizePanPhone. */
export type PanProfile = { firstName: string; lastName: string; email: string; dateOfBirth: string; providerRef: string; phone?: string | null };

/** Digits and mask characters of the last 10 positions (drops +91 and spaces); null when no digit is visible (nothing to compare). */
export function normalizePanPhone(value: unknown) {
  const phone = String(value ?? "").replace(/[^0-9Xx*]/g, "").slice(-10);
  return /\d/.test(phone) ? phone : null;
}

/** True when every digit the PAN record shows equals the mobile's digit in the same position (right-aligned). */
export function panPhoneMatches(panPhone: string, mobile: string) {
  const offset = mobile.length - panPhone.length;
  return offset >= 0 && [...panPhone].every((char, i) => !/\d/.test(char) || char === mobile[offset + i]);
}

/** For logs: at most the first 2 and last 2 digits, like IndiConnect's own masking, even if it ever sends the full number. */
export const maskPanPhone = (phone: string) => phone.replace(/\d/g, (digit, i: number) => (i < 2 || i >= phone.length - 2 ? digit : "X"));

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type Service = "otp" | "pan" | "bureau";
const live = (service: Service) =>
  ({ otp: env.OTP_PROVIDER, pan: env.PAN_PROVIDER, bureau: env.BUREAU_PROVIDER })[service] === "indiconnect";

async function execute<T>(options: {
  provider: string;
  operation: string;
  userId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  retries?: number;
  action: (attempt: number) => Promise<T>;
}) {
  const timeoutMs = options.timeoutMs ?? (options.provider === "INDICONNECT" ? env.INDICONNECT_TIMEOUT_MS : 2_000);
  const retries = options.retries ?? 1;
  let lastError: ProviderError | undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const started = Date.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new ProviderError("TIMEOUT", "PROVIDER_TIMEOUT", `${options.provider} timed out`, true)),
          timeoutMs,
        );
      });
      const result = await Promise.race([options.action(attempt), timeout]);
      await production.apiTransaction.create({ data: {
        provider: options.provider, operation: options.operation, userId: options.userId,
        idempotencyKey: options.idempotencyKey, status: "SUCCESS", attempt, durationMs: Date.now() - started,
      }});
      return result;
    } catch (error) {
      const normalized = error instanceof ProviderError
        ? error
        : new ProviderError("TECHNICAL_FAILURE", "PROVIDER_ERROR", "Provider is temporarily unavailable", true);
      lastError = normalized;
      await production.apiTransaction.create({ data: {
        provider: options.provider, operation: options.operation, userId: options.userId,
        idempotencyKey: options.idempotencyKey, status: normalized.kind, attempt,
        errorCode: normalized.code, durationMs: Date.now() - started,
      }});
      if (!normalized.retryable || attempt > retries) throw normalized;
      await wait(100 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

function simulate(scenario: MockScenario, attempt: number) {
  if (scenario === "business_failure") throw new ProviderError("BUSINESS_FAILURE", "PROVIDER_REJECTED", "Provider could not verify these details", false);
  if (scenario === "invalid_response") throw new ProviderError("TECHNICAL_FAILURE", "INVALID_PROVIDER_RESPONSE", "Provider returned an invalid response", false);
  if (scenario === "technical_failure" && attempt === 1) throw new ProviderError("TECHNICAL_FAILURE", "PROVIDER_UNAVAILABLE", "Provider is temporarily unavailable", true);
  if (scenario === "timeout" && attempt === 1) return wait(2_500);
  return undefined;
}

// ---- IndiConnect (https://developer.indiconnect.in) ----

async function indiconnect(path: string, body: unknown, timeoutMs = env.INDICONNECT_TIMEOUT_MS): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "service-key": env.INDICONNECT_SERVICE_KEY!,
    Authorization: env.INDICONNECT_AUTHORIZATION!,
    myAppId: env.INDICONNECT_APP_ID,
  };
  if (env.INDICONNECT_PROVIDER_CODE) headers.providercode = env.INDICONNECT_PROVIDER_CODE;
  let response: Response;
  try {
    response = await fetch(new URL(path, env.INDICONNECT_BASE_URL), {
      method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if ((error as Error).name === "TimeoutError") throw new ProviderError("TIMEOUT", "PROVIDER_TIMEOUT", "Verification service timed out", true);
    throw new ProviderError("TECHNICAL_FAILURE", "PROVIDER_UNAVAILABLE", "Verification service is temporarily unavailable", true);
  }
  // 4xx means our credentials/payload are wrong: retrying will not help.
  if (!response.ok) {
    const code = response.status >= 500 ? "PROVIDER_UNAVAILABLE" : response.status === 401 || response.status === 403 ? "PROVIDER_AUTH_FAILED" : "PROVIDER_REQUEST_REJECTED";
    throw new ProviderError("TECHNICAL_FAILURE", code, "Verification service is temporarily unavailable", response.status >= 500);
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderError("TECHNICAL_FAILURE", "INVALID_PROVIDER_RESPONSE", "Provider returned an invalid response", false);
  }
}

/** Runs an IndiConnect GraphQL `verify` mutation and returns `result`, or throws a business failure. */
async function verifyMutation(query: string, failure: { code: string; message: string }, variables: object = {}, timeoutMs?: number) {
  const body = await indiconnect("/idverifygr/verification", { query, variables }, timeoutMs);
  if (Array.isArray(body?.errors) && body.errors.length) {
    throw new ProviderError("TECHNICAL_FAILURE", "PROVIDER_GRAPHQL_ERROR", "Verification service is temporarily unavailable", false);
  }
  const verify = body?.data?.verify ?? body;
  if (typeof verify?.ok !== "boolean") throw new ProviderError("TECHNICAL_FAILURE", "INVALID_PROVIDER_RESPONSE", "Provider returned an invalid response", false);
  if (!verify.ok || verify.error) throw new ProviderError("BUSINESS_FAILURE", failure.code, failure.message, false);
  return verify.result ?? {};
}

const gql = (value: string) => JSON.stringify(value); // safe string literal inside the GraphQL document

/** Accepts YYYY-MM-DD, DD-MM-YYYY or DD/MM/YYYY and returns YYYY-MM-DD. */
export function normalizeDob(value: unknown) {
  if (typeof value !== "string") return null;
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = value.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  const out = iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : null;
  return out && !Number.isNaN(Date.parse(out)) ? out : null;
}

export function panToProfile(data: any): Omit<PanProfile, "providerRef"> {
  const parts: string[] = (Array.isArray(data?.full_name_split) ? data.full_name_split : String(data?.full_name ?? "").split(/\s+/))
    .map((part: unknown) => String(part ?? "").trim()).filter(Boolean);
  const dateOfBirth = normalizeDob(data?.dob);
  if (!parts.length || !dateOfBirth) throw new ProviderError("TECHNICAL_FAILURE", "INVALID_PROVIDER_RESPONSE", "Provider returned an invalid response", false);
  return {
    firstName: parts[0]!,
    lastName: parts.slice(1).join(" "), // middle + last: bureaus match on the full name
    email: typeof data?.email === "string" ? data.email : "",
    dateOfBirth,
  };
}

const NO_RECORD = { code: "NO_CREDIT_RECORD", message: "No credit record was found for these details" };
const PAN_NOT_VERIFIED = { code: "PAN_NOT_VERIFIED", message: "We could not verify this PAN. Check it and try again, or continue without PAN" };

const indiconnectApi = {
  sendOtp: async (mobile: string) => {
    const result = await verifyMutation(
      `mutation { verify(input: { mobileNumber: ${gql(mobile)}, documentType: "Mobile Verification With Otp" }) {
        ok message result { ... on MobileVerificationWithOtp { requestId message } } error { status message decryptedError } } }`,
      { code: "OTP_SEND_FAILED", message: "We could not send an OTP to this number. Check the number and try again" },
    );
    if (typeof result.requestId !== "string" || !result.requestId) {
      throw new ProviderError("TECHNICAL_FAILURE", "INVALID_PROVIDER_RESPONSE", "Provider returned an invalid response", false);
    }
    return { providerRef: result.requestId as string };
  },
  verifyOtp: async (requestId: string, otp: string) => {
    await verifyMutation(
      `mutation { verify(input: { requestId: ${gql(requestId)}, otp: ${gql(otp)}, documentType: "mobile verification with status" }) {
        ok message result { ... on MobileVerificationWithStatus { provider otpValidate } } error { status message decryptedError } } }`,
      { code: "INVALID_OTP", message: "Invalid OTP" },
    );
  },
  // Verification Service V4 "PAN Premium" (developer.indiconnect.in/44970429e0): same GraphQL endpoint and keys as the bureaus.
  panDetails: async (pan: string): Promise<PanProfile> => {
    const result = await verifyMutation(
      `mutation VerifyPanPremium($input: VerifyInput!) { verify(input: $input) { ok message status
        result { ... on BTPanPremiumResult { txn_id full_name full_name_split dob email phone_number } }
        error { status message } } }`,
      PAN_NOT_VERIFIED,
      { input: { documentType: "verify-pan-premium", pan } },
    );
    if (!result.full_name && !result.full_name_split?.length) {
      throw new ProviderError("BUSINESS_FAILURE", PAN_NOT_VERIFIED.code, PAN_NOT_VERIFIED.message, false);
    }
    // Mobile on the PAN record (often masked): only the last 4 digits are kept, for the audit trail.
    return { ...panToProfile(result), providerRef: String(result.txn_id ?? `pan_${randomUUID()}`), phone: normalizePanPhone(result.phone_number) };
  },
  bureau: async (bureau: Bureau, input: BureauInput): Promise<BureauPull> => {
    const query = bureau === "EXPERIAN"
      ? `mutation VerifyBureauA($input: VerifyInput!) { verify(input: $input) { ok message status result { ... on BTBureauAResult {
          txn_id api_category api_name billable message status datetime inprofileResponse experian_report_link } } error { status message } } }`
      : `mutation VerifyBureauC($input: VerifyInput!) { verify(input: $input) { ok message status result { ... on BTBureauCResult {
          txn_id api_category api_name billable message status datetime bureauData credit_report_link } } error { status message } } }`;
    const documentType = bureau === "EXPERIAN" ? "bureau-verification-v2-experian" : "bureau-verification-crif";
    const call = (fields: BureauInput) => verifyMutation(query, NO_RECORD, { input: { documentType, ...fields } }, env.INDICONNECT_BUREAU_TIMEOUT_MS);
    let result;
    try {
      result = await call(input);
    } catch (error) {
      // Rejected as a request (unexpected field / format), i.e. before any bureau lookup: retry with the
      // name + mobile pair this integration is proven to work with. A "no record" answer is NOT retried.
      const rejected = error instanceof ProviderError && (error.code === "PROVIDER_REQUEST_REJECTED" || error.code === "PROVIDER_GRAPHQL_ERROR");
      if (!rejected || (!input.pan && !input.dob)) throw error;
      result = await call({ name: input.name, mobile: input.mobile });
    }
    const report = bureau === "EXPERIAN" ? normalizeExperian(result.inprofileResponse) : normalizeCrif(result.bureauData?.credit_report);
    if (!report) throw new ProviderError("BUSINESS_FAILURE", NO_RECORD.code, NO_RECORD.message, false);
    return { bureau, providerRef: String(result.txn_id ?? randomUUID()), report, raw: result };
  },
};

// ---- Smartping SPARC SMS (apis.sparc.smartping.io, "SMS" API): it only delivers the text; Relive generates and checks the OTP ----

const SMS_TIMEOUT_MS = 15_000;
// DLT registration for sender CGRNSR (cGreen). The text must match the approved template exactly, or operators drop the SMS.
const SMARTPING_DLT = { sender: "CGRNSR", peId: "1001680961489679847", templateId: "1007729635073898162", telemarketerId: "1702166020082452097" };
export const otpSmsText = (otp: string) => `Dear Customer, Your login OTP is ${otp}. Do not share it with anyone.-cGreen`;

/** SPARC's submit response. SUBMIT_ACCEPTED = accepted for delivery (not yet delivered). */
export function smartpingResult(body: any): { providerRef: string } {
  const state = body?.state;
  if (state === "SUBMIT_ACCEPTED") return { providerRef: String(body.transactionId ?? "") };
  if (state === "INVALID_MSISDN") throw new ProviderError("BUSINESS_FAILURE", "OTP_SEND_FAILED", "We could not send an OTP to this number. Check the number and try again", false);
  if (state === "THROTTLING_ERROR") throw new ProviderError("TECHNICAL_FAILURE", "SMS_THROTTLED", "Too many requests right now. Please try again in a minute", false);
  if (typeof state !== "string") throw new ProviderError("TECHNICAL_FAILURE", "INVALID_PROVIDER_RESPONSE", "Provider returned an invalid response", false);
  // TEMPLATE_MISSING, DLT_*_INVALID, INVALID_SOURCE_ADDRESS...: our SMS setup is wrong, not the user's input.
  throw new ProviderError("TECHNICAL_FAILURE", `SMARTPING_${state}`, "We could not send the OTP right now. Please try again later", false);
}

async function smartpingSendOtp(mobile: string, otp: string, corelationId: string) {
  let response: Response;
  try {
    response = await fetch("https://pgapi.sparc.smartping.io/fe/api/v1/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${env.SMARTPING_USERNAME}:${env.SMARTPING_PASSWORD}`).toString("base64")}`,
      },
      body: JSON.stringify({
        unicode: false,
        sender: SMARTPING_DLT.sender,
        message: { recipient: Number(`91${mobile}`), text: otpSmsText(otp), corelationId },
        extra: { dltContentId: SMARTPING_DLT.templateId, dltPrincipalEntityId: SMARTPING_DLT.peId, dltTelemarketerId: SMARTPING_DLT.telemarketerId },
      }),
      signal: AbortSignal.timeout(SMS_TIMEOUT_MS),
    });
  } catch (error) {
    if ((error as Error).name === "TimeoutError") throw new ProviderError("TIMEOUT", "PROVIDER_TIMEOUT", "SMS service timed out", false);
    throw new ProviderError("TECHNICAL_FAILURE", "PROVIDER_UNAVAILABLE", "SMS service is temporarily unavailable", false);
  }
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? "PROVIDER_AUTH_FAILED" : response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "PROVIDER_REQUEST_REJECTED";
    throw new ProviderError("TECHNICAL_FAILURE", code, "We could not send the OTP right now. Please try again later", false);
  }
  return smartpingResult(await response.json().catch(() => null));
}

// OTP calls never retry: a retried send texts the user twice, a retried verify can burn the OTP.
export const providers = {
  /** `otp` is set when Relive checks the code itself (mock, Smartping); IndiConnect checks it on its side (providerRef). */
  sendOtp: (userId: string, mobile: string, scenario: MockScenario, transactionId: string) => execute({
    provider: live("otp") ? "INDICONNECT" : env.OTP_PROVIDER === "smartping" ? "SMARTPING" : "MOCK_OTP", operation: "SEND_OTP", userId, retries: 0,
    timeoutMs: env.OTP_PROVIDER === "smartping" ? SMS_TIMEOUT_MS + 1_000 : undefined,
    action: async (attempt): Promise<{ providerRef: string | null; otp: string | null }> => {
      if (live("otp")) return { ...(await indiconnectApi.sendOtp(mobile)), otp: null };
      if (env.OTP_PROVIDER === "smartping") {
        const otp = randomInt(0, 1_000_000).toString().padStart(6, "0");
        return { ...(await smartpingSendOtp(mobile, otp, transactionId)), otp };
      }
      await simulate(scenario, attempt);
      return { providerRef: null, otp: env.OTP_MOCK_CODE };
    },
  }),
  verifyOtp: (userId: string, requestId: string, otp: string) => execute({
    provider: "INDICONNECT", operation: "VERIFY_OTP", userId, retries: 0,
    action: () => indiconnectApi.verifyOtp(requestId, otp),
  }),
  panDetails: (userId: string, pan: string, scenario: MockScenario) => execute({
    provider: live("pan") ? "INDICONNECT" : "MOCK_NSDL", operation: "PAN_DETAILED", userId,
    action: async (attempt): Promise<PanProfile> => {
      if (live("pan")) return indiconnectApi.panDetails(pan);
      // A fake PAN identity must never reach a live (billed) bureau pull under the user's real mobile.
      if (live("bureau")) {
        throw new ProviderError("BUSINESS_FAILURE", "PAN_UNAVAILABLE", "PAN verification isn't available yet. Please continue without PAN and enter your details exactly as on your PAN", false);
      }
      await simulate(scenario, attempt);
      if (pan === "AAAAA0000A") throw new ProviderError("BUSINESS_FAILURE", "PAN_NOT_VERIFIED", "We could not verify this PAN. Check it and try again, or continue without PAN", false);
      return { firstName: "Aarav", lastName: "Sharma", email: "aarav.demo@relive.test", dateOfBirth: "1992-06-14", providerRef: `pan_${randomUUID()}` };
    },
  }),
  // Bureau pulls are billable: never retried. The caller falls back from Experian to CRIF.
  bureau: (bureau: Bureau, userId: string, input: BureauInput, idempotencyKey: string, scenario: MockScenario) => execute({
    provider: live("bureau") ? "INDICONNECT" : `MOCK_${bureau}`, operation: `CREDIT_REPORT_${bureau}`, userId, idempotencyKey, retries: 0,
    timeoutMs: live("bureau") ? env.INDICONNECT_BUREAU_TIMEOUT_MS + 1_000 : undefined,
    action: async (attempt): Promise<BureauPull> => {
      if (live("bureau")) return indiconnectApi.bureau(bureau, input);
      // Mock: "no_record" fails both bureaus; other scenarios apply to Experian only (exercising the CRIF fallback).
      if (scenario === "no_record") throw new ProviderError("BUSINESS_FAILURE", NO_RECORD.code, NO_RECORD.message, false);
      if (bureau === "EXPERIAN") await simulate(scenario, attempt);
      const report = demoReport(bureau === "EXPERIAN" ? 782 : 731);
      return { bureau, providerRef: `${bureau.toLowerCase()}_${randomUUID()}`, report, raw: { mock: true } };
    },
  }),
};

