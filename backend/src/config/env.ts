import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

for (const file of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../frontend/.env.local")]) {
  if (existsSync(file)) loadEnv({ path: file, override: false });
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4100),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url(),
  AUDIT_DATABASE_URL: z.string().url().optional(),
  AUDIT_DATABASE_URL_UNPOOLED: z.string().url().optional(),
  SESSION_SECRET: z.string().min(24).default("relive-local-session-pepper-change-me"),
  OTP_PEPPER: z.string().min(24).default("relive-local-otp-pepper-change-me-now"),
  DATA_ENCRYPTION_KEY: z.string().min(24).default("relive-local-data-key-change-me-please"),
  OTP_MOCK_CODE: z.string().regex(/^\d{6}$/).default("123456"),
  // Per service: mock (local fakes, OTP = OTP_MOCK_CODE) or indiconnect (real, billed API calls).
  OTP_PROVIDER: z.enum(["mock", "indiconnect"]).default("mock"),
  PAN_PROVIDER: z.enum(["mock", "indiconnect"]).default("mock"),
  BUREAU_PROVIDER: z.enum(["mock", "indiconnect"]).default("mock"),
  INDICONNECT_BASE_URL: z.string().url().default("https://api.staging.indiconnect.in"),
  INDICONNECT_SERVICE_KEY: z.string().min(1).optional(),
  // Full Authorization header value: "x-api-access <indc_key>:<ac_key>"
  INDICONNECT_AUTHORIZATION: z.string().min(1).optional(),
  INDICONNECT_APP_ID: z.string().min(1).default("verification_v1"),
  INDICONNECT_PROVIDER_CODE: z.string().min(1).optional(),
  INDICONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000), // OTP send/verify, PAN; frontend lib/api.ts timeout must stay above 2x this
  // Bureau pulls are slow (report generation) and billable, so they get their own, longer timeout.
  INDICONNECT_BUREAU_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  // "Get help" leads are emailed here. SMTP_URL e.g. smtps://user%40domain:password@smtp.host:465; unset = no emails.
  LEADS_EMAIL: z.string().email().default("relive@cgreen.in"),
  SMTP_URL: z.string().url().optional(),
  // Cloudflare Turnstile: stops bots from triggering (billed) OTP SMS. Unset = no check (local dev, tests).
  TURNSTILE_SECRET_KEY: z.string().min(1).optional(),
  // OpenAI key for the personalised dashboard summary (prompt: prompts/dashboard-summary.md). Unset = rule-based summary.
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  // Set by the root `npm run dev` (scripts/dev.mjs): in development, sessions from earlier runs are ignored.
  RELIVE_DEV_RUN_STARTED_AT: z.coerce.number().int().positive().optional(),
}).superRefine((value, ctx) => {
  const services = ["OTP_PROVIDER", "PAN_PROVIDER", "BUREAU_PROVIDER"] as const;
  if (services.some((service) => value[service] === "indiconnect")) {
    for (const key of ["INDICONNECT_SERVICE_KEY", "INDICONNECT_AUTHORIZATION"] as const) {
      if (!value[key]) ctx.addIssue({ code: "custom", path: [key], message: `${key} is required when any *_PROVIDER=indiconnect` });
    }
  }
  if (value.NODE_ENV === "production") {
    for (const service of services) {
      if (value[service] === "mock") ctx.addIssue({ code: "custom", path: [service], message: `${service}=mock cannot run in production` });
    }
    if (!value.TURNSTILE_SECRET_KEY) ctx.addIssue({ code: "custom", path: ["TURNSTILE_SECRET_KEY"], message: "Set TURNSTILE_SECRET_KEY in production" });
    for (const key of ["SESSION_SECRET", "OTP_PEPPER", "DATA_ENCRYPTION_KEY"] as const) {
      if (value[key].includes("change-me")) ctx.addIssue({ code: "custom", path: [key], message: `Set a real ${key} in production` });
    }
  }
});

// Blank lines like `INDICONNECT_SERVICE_KEY=` in .env mean "not set", not "empty value".
export const env = schema.parse(Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== "")));

export function databaseUrl(database = "neondb", pooled = true) {
  if (database === "relive_audit") {
    const explicit = pooled ? env.AUDIT_DATABASE_URL : env.AUDIT_DATABASE_URL_UNPOOLED;
    if (explicit) return explicit;
  }
  const value = pooled ? env.DATABASE_URL : env.DATABASE_URL_UNPOOLED;
  const url = new URL(value);
  url.pathname = `/${database}`;
  return url.toString();
}
