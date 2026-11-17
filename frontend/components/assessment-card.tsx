"use client";

import { ChevronRight, Info, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import type { AccountItem } from "./accounts-table";
import { formatDay } from "./score-hero";

type Summary = { creditUtilization?: number | null; enquiriesLast6Months?: number | null } | undefined;

const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold text-[#183b2f] dark:text-white">{children}</strong>;

/** Plain-language reading of the report. Rule-based: every sentence comes straight from reported numbers. */
export function buildAssessment(accounts: AccountItem[], summary: Summary) {
  const overdue = accounts.filter((a) => (a.pastDue ?? 0) > 0);
  const pastDue = overdue.reduce((total, a) => total + (a.pastDue ?? 0), 0);
  const lateOnRecord = accounts.filter((a) => (a.history ?? []).some((m) => m.status === "late"));
  // history is newest first, so [0] is the latest reported month
  const delays = overdue.map((a) => a.history?.[0]?.daysPastDue ?? 0).filter((d) => d > 0);
  const utilisation = summary?.creditUtilization ?? null;
  const enquiries = summary?.enquiriesLast6Months ?? null;

  if (overdue.length > 0) {
    const min = Math.min(...delays);
    const max = Math.max(...delays);
    return {
      tone: "attention" as const,
      title: "Your overdue debt needs a clear resolution plan.",
      body: [
        <>
          Your report shows <B>{plural(overdue.length, "overdue account")}</B> with <B>{rupees(pastDue)} past due</B>.
          {delays.length > 0 && (
            <>
              {" "}The latest reported {delays.length === 1 || min === max ? "delay is" : "delays range from"}{" "}
              <B>{min === max ? `${max} days` : `${min} to ${max} days`}</B>.
            </>
          )}
        </>,
        <>Start by confirming current dues and what you can manage. Then explore lender discussions and resolution options, one account at a time.</>,
      ],
      action: "View overdue accounts",
    };
  }

  if (lateOnRecord.length > 0) {
    return {
      tone: "watch" as const,
      title: "Nothing is overdue, but past delays are still on record.",
      body: [
        <>
          <B>{plural(lateOnRecord.length, "account")}</B> {lateOnRecord.length === 1 ? "shows" : "show"} late payments in the reported history. No amount is overdue today.
        </>,
        <>Keep every account on time. The impact of older delays fades as on-time months build up.</>,
      ],
      action: "View accounts with late payments",
    };
  }

  const tips: ReactNode[] = [];
  if (utilisation != null && utilisation > 30) tips.push(<>Your card utilisation is <B>{utilisation}%</B>. Bringing it under 30% can lift your score.</>);
  if (enquiries != null && enquiries > 3) tips.push(<>You have <B>{plural(enquiries, "enquiry")}</B> in 6 months. Spacing out new applications protects your score.</>);
  return {
    tone: "good" as const,
    title: "Your accounts are in good standing.",
    body: [
      <>No overdue amounts or late payments are reported across your <B>{plural(accounts.length, "account")}</B>.</>,
      ...(tips.length ? tips : [<>Keep paying on time and using a small share of your card limits to stay here.</>]),
    ],
    action: null,
  };
}

/** AI-written from the customer's answers (selected_concern, customer_text) and their report: GET /credit/insight. */
export type PersonalInsight = { title: string; insights: string[]; recommendations: string[] };

interface AssessmentCardProps {
  accounts: AccountItem[];
  summary: Summary;
  bureau: string;
  retrievedAt: string | null;
  insight?: PersonalInsight | null;
  personalizing?: boolean;
  /** First name from the verified profile; the greeting is hidden without it. */
  firstName?: string | null;
  onViewAccounts: () => void;
}

export function AssessmentCard({ accounts, summary, bureau, retrievedAt, insight, personalizing, firstName, onViewAccounts }: AssessmentCardProps) {
  // Tone and the accounts link stay rule-based (straight from the numbers); the words come from the AI when available.
  const rules = buildAssessment(accounts, summary);
  const { action, tone } = rules;
  const title = insight?.title ?? rules.title;
  const body: ReactNode[] = insight?.insights ?? rules.body;
  const steps = insight?.recommendations ?? [];
  // Names arrive in capitals from PAN ("PRASAD"); greet as "Prasad".
  const name = firstName?.trim().split(/\s+/)[0]?.toLowerCase().replace(/^./, (c) => c.toUpperCase());

  return (
    <section className="flex h-full flex-col rounded-3xl border border-[#d5e3c8] bg-[#edf3e6] p-5 sm:p-7 dark:border-[#1a3827] dark:bg-[#0c1a12]">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[1.5px] text-[#183b2f] dark:text-emerald-300">
          <span className="grid size-8 place-items-center rounded-lg bg-white/70 text-[#216b49] dark:bg-emerald-950 dark:text-emerald-400">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          Relive assessment
        </p>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
            tone === "attention"
              ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
              : tone === "watch"
                ? "bg-[#f7f9ef] text-[#5a7550] dark:bg-white/5 dark:text-[#b0c8bb]"
                : "bg-white/70 text-[#216b49] dark:bg-emerald-500/15 dark:text-emerald-300"
          }`}
        >
          {insight ? "Personalised for you" : personalizing ? "Personalising…" : "Initial review"}
        </span>
      </div>

      {name && <p className="mt-5 text-base font-medium text-[#216b49] dark:text-emerald-300">Hi, {name}</p>}

      <div key={insight ? "personal" : "rules"} className="animate-in fade-in duration-500">
        <h2 className={`${name ? "mt-1.5" : "mt-5"} max-w-lg text-2xl font-semibold leading-tight tracking-tight text-[#183b2f] sm:text-[28px] dark:text-white`}>{title}</h2>

        <div className="mt-4 max-w-xl space-y-3 text-sm leading-relaxed text-[#465a50] dark:text-[#a0b8ab]">
          {body.map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>

        {steps.length > 0 && (
          <div className="mt-5 max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[1px] text-[#183b2f] dark:text-emerald-300">Your next steps</p>
            <ol className="mt-2 space-y-2 text-sm leading-relaxed text-[#465a50] dark:text-[#a0b8ab]">
              {steps.map((step, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-white/70 text-[11px] font-semibold text-[#216b49] dark:bg-emerald-950 dark:text-emerald-400">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={onViewAccounts}
          className="mt-5 inline-flex w-fit items-center gap-1 text-sm font-semibold text-[#216b49] hover:underline dark:text-emerald-400"
        >
          {action}
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      )}

      {/* Pinned to the bottom so the card matches the score card's height */}
      <div className="mt-auto pt-6">
        <p className="flex items-start gap-2 border-t border-[#d5e3c8] pt-4 text-xs text-[#63776b] dark:border-[#1a3827] dark:text-[#8ba295]">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Based on your {bureau} report{retrievedAt ? ` from ${formatDay(retrievedAt)}` : ""}
          {insight ? " and what you told us, summarised with AI" : ""}. Current balances and lender terms are not yet confirmed.
        </p>
      </div>
    </section>
  );
}
