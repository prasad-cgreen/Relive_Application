import { z } from "zod";

export const mobileSchema = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine((value) => /^[6-9]\d{9}$/.test(value), "Enter a valid mobile number");

export const requestOtpSchema = z.object({
  mobile: mobileSchema,
  // One checkbox covers: terms/privacy + OTP, credit-bureau report fetch, and marketing communication.
  consent: z.literal(true, { error: "Consent is required" }),
  consentVersion: z.string().min(1).default("relive-consent-v3"),
  // Cloudflare Turnstile token; required by the backend when TURNSTILE_SECRET_KEY is set.
  turnstileToken: z.string().max(2048).optional(),
});

export const bureauMobileSchema = z.object({ mobile: mobileSchema });

export const verifyOtpSchema = z.object({
  transactionId: z.string().uuid(),
  otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit OTP"),
});

// Optional referral, sent with the PAN or the name-as-on-PAN form. The code is the referrer's mobile number:
// a company agent's (benefit) or another Relive user's (no benefit). QR = prefilled from an agent's QR code.
export const referralSchema = z.object({
  mobile: mobileSchema,
  source: z.enum(["QR", "MANUAL"]).default("MANUAL"),
});

// A company agent, added on the admin page (/admin/agents). Their mobile number is their referral code.
export const agentSchema = z.object({
  name: z.string().trim().min(2, "Enter the agent's name").max(80),
  mobile: mobileSchema,
});

// The agents admin page's shared password (stored hashed in the database). The database is shared with the live
// site, so the rule is the same everywhere.
export const adminPasswordSchema = z.string().min(8, "Use at least 8 characters").max(200, "Use at most 200 characters");
export const changeAdminPasswordSchema = z.object({ current: z.string().max(200), next: adminPasswordSchema });

// Several agents from a CSV file (admin page), sent in batches. Each row is checked on its own with agentSchema.
export const AGENT_IMPORT_BATCH = 200;
export const agentImportSchema = z.object({
  rows: z.array(z.object({ row: z.number().int().positive(), name: z.string().max(200), mobile: z.string().max(40) })).min(1).max(AGENT_IMPORT_BATCH),
});

/**
 * Reads agents from a CSV file's text: a name column and a mobile column. With a header row (one cell says mobile,
 * phone or number) the columns are found by name, in any order; without one, name is column 1 and mobile column 2.
 * `row` is the spreadsheet row number. Mobiles lose spaces, dashes, +91 and a leading 0. Quoted cells are allowed.
 */
export function agentCsvRows(text: string) {
  // Split on commas outside quotes (an even number of quotes follows them).
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((line) =>
    line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((cell) => cell.trim().replace(/^"([\s\S]*)"$/, "$1").replace(/""/g, '"').trim()));
  const header = lines[0] ?? [];
  const mobileAt = header.findIndex((cell) => /mobile|phone|number/i.test(cell));
  const nameAt = mobileAt >= 0 ? Math.max(0, header.findIndex((cell) => /name/i.test(cell))) : 0;
  const mobile = (value: string) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits.length === 11 && digits.startsWith("0") ? digits.slice(1) : digits;
  };
  return lines
    .map((cells, index) => ({ row: index + 1, name: cells[nameAt] ?? "", mobile: mobile(cells[mobileAt >= 0 ? mobileAt : 1] ?? "") }))
    .slice(mobileAt >= 0 ? 1 : 0)
    .filter((row) => row.name || row.mobile);
}

export const manualProfileSchema = z.object({
  referral: referralSchema.optional(),
  // Bureaus match on the full name as on PAN; single-name PANs have no last name.
  firstName: z.string().trim().min(1, "Enter your first name").max(80),
  lastName: z.string().trim().max(120).default(""),
  email: z.string().trim().email().or(z.literal("")).default(""),
  // Optional: blank -> null. When given, it's used to check the bureau report is this user's.
  dateOfBirth: z.string().date().or(z.literal("")).optional().transform((value) => value || null),
});

export const panSchema = z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN");

export const kycSchema = z.object({ pan: panSchema, referral: referralSchema.optional() });

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
