import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

for (const file of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../frontend/.env.local")]) {
  if (existsSync(file)) loadEnv({ path: file, override: false });
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_ORIGIN: z.string().default("http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"),
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url(),
  AUDIT_DATABASE_URL: z.string().url().optional(),
  AUDIT_DATABASE_URL_UNPOOLED: z.string().url().optional(),
  SESSION_SECRET: z.string().min(24).default("relive-local-session-pepper-change-me"),
  OTP_PEPPER: z.string().min(24).default("relive-local-otp-pepper-change-me-now"),
  OTP_MOCK_CODE: z.string().regex(/^\d{6}$/).default("123456"),
  PROVIDER_MODE: z.literal("mock").default("mock"),
});

export const env = schema.parse(process.env);

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
