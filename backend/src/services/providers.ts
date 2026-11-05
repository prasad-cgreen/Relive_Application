import { randomUUID } from "node:crypto";
import { production } from "../database/clients.js";
import { ProviderError } from "../lib/errors.js";

export type MockScenario = "success" | "business_failure" | "technical_failure" | "timeout" | "invalid_response";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function execute<T>(options: {
  provider: string;
  operation: string;
  userId?: string;
  idempotencyKey?: string;
  timeoutMs?: number;
  retries?: number;
  action: (attempt: number) => Promise<T>;
}) {
  const timeoutMs = options.timeoutMs ?? 2_000;
  const retries = options.retries ?? 1;
  let lastError: ProviderError | undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt += 1) {
    const started = Date.now();
    try {
      const timeout = new Promise<never>((_, reject) => setTimeout(
        () => reject(new ProviderError("TIMEOUT", "PROVIDER_TIMEOUT", `${options.provider} timed out`, true)),
        timeoutMs,
      ));
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

export const providers = {
  sendOtp: (userId: string, scenario: MockScenario) => execute({
    provider: "MOCK_OTP", operation: "SEND_OTP", userId,
    action: async (attempt) => { await simulate(scenario, attempt); return { providerRef: `otp_${randomUUID()}` }; },
  }),
  nsdl: (userId: string, scenario: MockScenario) => execute({
    provider: "MOCK_NSDL", operation: "FETCH_PROFILE", userId,
    action: async (attempt) => {
      await simulate(scenario, attempt);
      return { firstName: "Aarav", lastName: "Sharma", email: "aarav.demo@relive.test", dateOfBirth: "1992-06-14" };
    },
  }),
  kyc: (userId: string, pan: string, scenario: MockScenario) => execute({
    provider: "MOCK_KYC", operation: "VERIFY_PAN", userId,
    action: async (attempt) => {
      await simulate(scenario, attempt);
      if (pan === "AAAAA0000A") throw new ProviderError("BUSINESS_FAILURE", "IDENTITY_MISMATCH", "PAN details do not match the profile", false);
      return { verified: true, providerRef: `kyc_${randomUUID()}` };
    },
  }),
  experian: (userId: string, idempotencyKey: string, scenario: MockScenario) => execute({
    provider: "MOCK_EXPERIAN", operation: "CREDIT_REPORT", userId, idempotencyKey,
    action: async (attempt) => {
      await simulate(scenario, attempt);
      return {
        providerRef: `exp_${randomUUID()}`,
        score: 782,
        summary: { openAccounts: 3, closedAccounts: 2, totalBalance: 184500, onTimePayments: 98 },
        accounts: [
          { type: "Home Loan", lender: "Demo Bank", balance: 162000, status: "Current" },
          { type: "Credit Card", lender: "Demo Finance", balance: 22500, status: "Current" },
        ],
        insights: ["Payment history is strong", "Credit utilization is within a healthy range"],
      };
    },
  }),
};
