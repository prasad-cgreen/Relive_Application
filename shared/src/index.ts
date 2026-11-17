import { z } from "zod";

export const mobileSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^[6-9]\d{9}$/.test(value), "Enter a valid mobile number");

export const requestOtpSchema = z.object({
  mobile: mobileSchema,
  // One checkbox covers: terms/privacy + OTP, credit-bureau report fetch, and marketing communication.
  consent: z.literal(true, { error: "Consent is required" }),
  consentVersion: z.string().min(1).default("relive-consent-v2"),
  // Cloudflare Turnstile token; required by the backend when TURNSTILE_SECRET_KEY is set.
  turnstileToken: z.string().max(2048).optional(),
});

export const bureauMobileSchema = z.object({ mobile: mobileSchema });

export const verifyOtpSchema = z.object({
  transactionId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
});

export const manualProfileSchema = z.object({
  // Bureaus match on the full name as on PAN; single-name PANs have no last name.
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().max(120).default(""),
  email: z.string().trim().email().or(z.literal("")).default(""),
  // Optional: blank -> null. When given, it's used to check the bureau report is this user's.
  dateOfBirth: z.string().date().or(z.literal("")).optional().transform((value) => value || null),
});

export const panSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN");

export const kycSchema = z.object({ pan: panSchema });

export const reportRequestSchema = z.object({ idempotencyKey: z.string().uuid() });

// "What brings you to Relive today?" on the landing page. Feeds the personalised dashboard summary.
export const CONCERN_OPTIONS = [
  "I am struggling with overdue payments",
  "I want to explore closing my debts",
  "My monthly repayments are too high",
  "Something in my report looks wrong",
  "I need help speaking to my lenders",
  "I am not sure where to start",
] as const;
export const CUSTOMER_TEXT_MAX = 800;
export const concernSchema = z.object({
  // Radio today, checkboxes later: always a list, only the fixed options (never free text).
  selected_concern: z.array(z.enum(CONCERN_OPTIONS)).max(CONCERN_OPTIONS.length).default([])
    .transform((list) => [...new Set(list)]),
  customer_text: z.string().trim().max(CUSTOMER_TEXT_MAX).default(""),
});

// "Get help" request from the dashboard (a lead for the Relive team).
export const SUPPORT_TOPICS = ["OPTIONS", "LENDER_DISCUSSION", "NOTICE"] as const;
export const CONTACT_TIMES = ["Morning", "Afternoon", "Evening", "No preference"] as const;
export const CONTACT_LANGUAGES = ["English", "Hindi", "Marathi", "Other"] as const;
export const supportRequestSchema = z.object({
  topic: z.enum(SUPPORT_TOPICS),
  account: z.string().trim().max(120).nullable().default(null), // lender + masked number; null = overall situation
  question: z.string().trim().min(1, "Tell us what you need help with").max(1500),
  preferredTime: z.enum(CONTACT_TIMES),
  preferredLanguage: z.enum(CONTACT_LANGUAGES),
});

export type WorkflowStage = "PROFILE" | "REPORT" | "DASHBOARD";

export type ApiErrorShape = {
  error: { code: string; message: string; retryable?: boolean; details?: unknown };
};

export type WorkflowResponse = {
  stage: WorkflowStage;
  mobileLast4?: string | null;
  profile?: { firstName: string; lastName: string; email: string; dateOfBirth: string | null; source: string; verified: boolean } | null;
  kycStatus?: string | null;
  reportStatus?: string | null;
};
