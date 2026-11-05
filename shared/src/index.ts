import { z } from "zod";

export const mobileSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^[6-9]\d{9}$/.test(value), "Enter a valid mobile number");

export const requestOtpSchema = z.object({
  mobile: mobileSchema,
  consent: z.literal(true, { error: "Consent is required" }),
  consentVersion: z.string().min(1).default("login-v1"),
  channel: z.enum(["SMS", "CALL", "WHATSAPP"]).default("SMS"),
});

export const verifyOtpSchema = z.object({
  transactionId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
});

export const manualProfileSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.string().email(),
  dateOfBirth: z.string().date(),
});

export const panSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN");

export const kycSchema = z.object({ pan: panSchema });

export const creditAuthorizationSchema = z.object({
  authorized: z.literal(true, { error: "Credit-report authorization is required" }),
  consentVersion: z.string().min(1).default("experian-v1"),
});

export const reportRequestSchema = z.object({ idempotencyKey: z.string().uuid() });

export type WorkflowStage = "PROFILE" | "KYC" | "CREDIT_AUTH" | "REPORT" | "DASHBOARD";

export type ApiErrorShape = {
  error: { code: string; message: string; retryable?: boolean; details?: unknown };
};

export type WorkflowResponse = {
  stage: WorkflowStage;
  profile?: { firstName: string; lastName: string; email: string; dateOfBirth: string; source: string; verified: boolean } | null;
  kycStatus?: string | null;
  reportStatus?: string | null;
};
