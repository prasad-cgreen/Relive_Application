// Personalised "Relive assessment" for the dashboard: OpenAI reads the customer's own answers
// (selected_concern, customer_text) next to their credit report and writes the summary + next steps.
// The prompt lives in backend/prompts/dashboard-summary.md and is read on every request, so edits apply directly.
// Summaries are cached per report, answers, prompt text and model, so each combination is one model call.
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import OpenAI from "openai";
import { z } from "zod";
import { env } from "../config/env.js";
import { production } from "../database/clients.js";
import { decrypt } from "../lib/crypto.js";
import type { NormalizedReport } from "./bureau.js";
import { scoreBandLabel } from "./credit-score.js";

// Relative to the backend folder (the API's working directory), like .env.
export const PROMPT_FILE = resolve(process.cwd(), "prompts/dashboard-summary.md");

// The reply shape the dashboard renders. Fixed here, not in the prompt file, so a prompt edit can't break the UI.
const InsightSchema = z.object({
  title: z.string(),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});
export type DashboardInsightContent = z.infer<typeof InsightSchema>;
const INSIGHT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    insights: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 1 }, // one paragraph: the model ignores "one" in the prompt alone
    recommendations: { type: "array", items: { type: "string" } },
  },
  required: ["title", "insights", "recommendations"],
  additionalProperties: false,
};

const rupees = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

/** What the model sees of the report: figures only. No names, PAN, mobile or account numbers. */
export function buildReportFacts(report: NormalizedReport, bureau: string, retrievedAt: Date) {
  const s = report.summary;
  const accounts = report.accounts.map((account) => {
    const late = account.history.filter((month) => month.daysPastDue > 0);
    return {
      type: account.type,
      lender: account.lender,
      status: account.status,
      outstanding_balance: rupees(account.balance),
      overdue_amount: rupees(account.pastDue),
      ...(account.creditLimit ? { credit_limit: rupees(account.creditLimit) } : {}),
      ...(account.sanctionedAmount ? { sanctioned_amount: rupees(account.sanctionedAmount) } : {}),
      ...(account.openDate ? { opened: account.openDate } : {}),
      latest_days_past_due: account.history[0]?.daysPastDue ?? 0, // history is newest first
      months_reported_late: late.length,
      worst_days_past_due: late.reduce((worst, month) => Math.max(worst, month.daysPastDue), 0),
    };
  });
  return {
    bureau: bureau === "CRIF" ? "CRIF High Mark" : "Experian",
    report_date: retrievedAt.toISOString().slice(0, 10),
    score: report.score,
    score_band: scoreBandLabel(bureau, report.score),
    total_overdue: rupees(report.accounts.reduce((sum, account) => sum + account.pastDue, 0)),
    open_accounts: s.openAccounts,
    closed_accounts: s.closedAccounts,
    total_outstanding_on_open_accounts: rupees(s.totalBalance),
    on_time_payments_percent: s.onTimePayments,
    credit_card_utilisation_percent: s.creditUtilization,
    average_open_account_age_months: s.creditAgeMonths,
    credit_enquiries_last_6_months: s.enquiriesLast6Months,
    months_with_late_payments: { up_to_30_days: s.lateMonths.upTo30, "31_to_60_days": s.lateMonths.upTo60, over_60_days: s.lateMonths.over60 },
    accounts,
  };
}

/** The prompt file without its <!-- comments -->. Read fresh each time, so edits apply to the next summary. */
export async function loadPromptTemplate() {
  return (await readFile(PROMPT_FILE, "utf8")).replace(/<!--[\s\S]*?-->/g, "").trim();
}

type PromptInputs = { selected_concern: string[]; customer_text: string; facts: ReturnType<typeof buildReportFacts> };

/** Fills {{report_facts}}, {{selected_concern}} and {{customer_text}} with this customer's actual values. */
export function renderPrompt(template: string, input: PromptInputs) {
  const values: Record<string, string> = {
    report_facts: JSON.stringify(input.facts, null, 2),
    selected_concern: input.selected_concern.length ? input.selected_concern.map((c) => `- ${c}`).join("\n") : "(none selected)",
    // Keep the customer's text inside its tags whatever they typed.
    customer_text: input.customer_text.replace(/<\/?\s*customer_text\s*>/gi, "").trim() || "(left blank)",
  };
  // One pass, so text the customer typed is never itself treated as a placeholder.
  const prompt = template.replace(/\{\{\s*(report_facts|selected_concern|customer_text)\s*\}\}/g, (_, key: string) => values[key]!);
  // A placeholder missing from the file is still passed, at the end.
  const missing = Object.keys(values).filter((key) => !new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`).test(template));
  return [prompt, ...missing.map((key) => `<${key}>\n${values[key]}\n</${key}>`)].join("\n\n");
}

let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, timeout: 90_000, maxRetries: 1 }));

export const insightsEnabled = () => Boolean(env.OPENAI_API_KEY);

async function generate(prompt: string) {
  const response = await openai().responses.create({
    model: env.OPENAI_MODEL,
    input: [{ role: "user", content: prompt }],
    text: { format: { type: "json_schema", name: "dashboard_summary", strict: true, schema: INSIGHT_JSON_SCHEMA } },
  });
  if (response.status !== "completed") {
    throw new Error(`Summary not generated (status: ${response.status}, reason: ${response.incomplete_details?.reason ?? "none"})`);
  }
  const parsed = InsightSchema.safeParse(JSON.parse(response.output_text || "null"));
  if (!parsed.success) throw new Error("Summary came back in the wrong shape");
  const clean = (text: string) => text.replace(/\s+/g, " ").trim();
  const content: DashboardInsightContent = {
    title: clean(parsed.data.title),
    insights: parsed.data.insights.map(clean).filter(Boolean).slice(0, 1), // the card shows one paragraph (see the prompt file)
    recommendations: parsed.data.recommendations.map(clean).filter(Boolean).slice(0, 3),
  };
  if (!content.title || !content.insights.length) throw new Error("Summary came back empty");
  return { content, usage: { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 } };
}

const inFlight = new Map<string, Promise<DashboardInsightContent>>();

type GeneratedMeta = { model: string; concerns: number; hasText: boolean; input: number; output: number };

/**
 * The personalised summary for the user's latest report, or null when AI summaries are off or there is no report.
 * Throws when generation fails; the dashboard then keeps the rule-based summary.
 */
export async function getDashboardInsight(userId: string, onGenerated?: (meta: GeneratedMeta) => Promise<void>) {
  if (!insightsEnabled()) return null;
  const [report, concern, template] = await Promise.all([
    production.creditReport.findFirst({ where: { userId, status: { not: "NO_RECORD" } }, orderBy: { retrievedAt: "desc" } }),
    production.userConcern.findUnique({ where: { userId } }),
    loadPromptTemplate(),
  ]);
  if (!report) return null;

  const selected_concern = concern?.selectedConcern ?? [];
  let customer_text = "";
  try {
    customer_text = concern?.customerTextEncrypted ? decrypt(concern.customerTextEncrypted) : "";
  } catch {
    customer_text = ""; // unreadable (key rotated): summarise from the selected options and report
  }

  const model = env.OPENAI_MODEL;
  const inputHash = createHash("sha256").update(JSON.stringify([template, model, selected_concern, customer_text])).digest("hex");
  const cached = await production.dashboardInsight.findUnique({ where: { reportId_inputHash: { reportId: report.id, inputHash } } });
  if (cached) return cached.content as DashboardInsightContent;

  const key = `${report.id}:${inputHash}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const job = (async () => {
    const facts = buildReportFacts(report.reportJson as NormalizedReport, report.bureau, report.retrievedAt);
    const { content, usage } = await generate(renderPrompt(template, { selected_concern, customer_text, facts }));
    await production.dashboardInsight.upsert({
      where: { reportId_inputHash: { reportId: report.id, inputHash } },
      create: { reportId: report.id, inputHash, content, model },
      update: {},
    });
    await onGenerated?.({ model, concerns: selected_concern.length, hasText: Boolean(customer_text), ...usage });
    return content;
  })();
  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
  }
}
