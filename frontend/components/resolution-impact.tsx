"use client";

import { Check } from "lucide-react";

type Outcome = "SETTLEMENT_COMPLETED" | "FULL_REPAYMENT";
type Resolution = {
  customer: string; // distinct per customer: "2 customers"
  account: string; // distinct per account: one resolution per account is counted once
  maskedName: string;
  product: string;
  outcome: Outcome;
  amount: number; // rupees resolved
  completedAt: string;
  verifiedAt: string;
};
type PeriodTotal = { amount: number; accounts: number; customers: number };

/**
 * What the section shows. For now it comes from fictional demo events (demoSummary); once Relive has a resolutions
 * table, the API returns this same shape from the database and the "demo" labels go away.
 */
export type ResolutionSummary = {
  demo: boolean;
  feed: Pick<Resolution, "maskedName" | "product" | "outcome" | "amount" | "verifiedAt">[];
  totals: { today: PeriodTotal; month: PeriodTotal; year: PeriodTotal; yearLabel: string };
};

/** IST calendar date (YYYY-MM-DD) of an instant. */
const istDate = (value: Date | string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(value));

/** Start dates of today, this month and this Indian financial year (from 1 April), in IST. */
function periods(now: Date) {
  const today = istDate(now);
  const year = Number(today.slice(0, 4));
  const fy = Number(today.slice(5, 7)) >= 4 ? year : year - 1;
  return { today, month: `${today.slice(0, 7)}-01`, year: `${fy}-04-01`, yearLabel: `FY ${fy}-${String(fy + 1).slice(-2)}` };
}

/** Resolved amount, accounts and customers per period; each account counts once. */
function totals(events: Resolution[], now: Date): ResolutionSummary["totals"] {
  const p = periods(now);
  const sum = (from: string): PeriodTotal => {
    const accounts = new Set<string>();
    const customers = new Set<string>();
    let amount = 0;
    for (const e of events) {
      const day = istDate(e.completedAt);
      if (day < from || day > p.today || accounts.has(e.account)) continue;
      accounts.add(e.account);
      customers.add(e.customer);
      amount += e.amount;
    }
    return { amount, accounts: accounts.size, customers: customers.size };
  };
  return { today: sum(p.today), month: sum(p.month), year: sum(p.year), yearLabel: p.yearLabel };
}

/** Fictional events, dated relative to now, so the figures read like a live feed. */
function demoSummary(now: Date): ResolutionSummary {
  const p = periods(now);
  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
  const monthStart = `${p.month}T10:00:00+05:30`;
  const yearStart = `${p.year}T10:00:00+05:30`;
  const events: Resolution[] = [
    { customer: "C1", account: "A1", maskedName: "Ra••••", product: "Personal loan", outcome: "SETTLEMENT_COMPLETED", amount: 80000, completedAt: ago(60_000), verifiedAt: ago(30_000) },
    { customer: "C2", account: "A2", maskedName: "Su••••", product: "Microfinance / group loan", outcome: "FULL_REPAYMENT", amount: 24000, completedAt: ago(120_000), verifiedAt: ago(60_000) },
    { customer: "C3", account: "A3", maskedName: "Ne••••", product: "Credit card", outcome: "SETTLEMENT_COMPLETED", amount: 65000, completedAt: monthStart, verifiedAt: monthStart },
    { customer: "C4", account: "A4", maskedName: "Am••••", product: "Personal loan", outcome: "FULL_REPAYMENT", amount: 120000, completedAt: yearStart, verifiedAt: yearStart },
    { customer: "C3", account: "A5", maskedName: "Ne••••", product: "Personal loan", outcome: "FULL_REPAYMENT", amount: 45000, completedAt: monthStart, verifiedAt: monthStart },
  ];
  const feed = [...events].sort((a, b) => b.verifiedAt.localeCompare(a.verifiedAt)).slice(0, 3);
  return { demo: true, feed, totals: totals(events, now) };
}

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const shortMoney = (n: number) => (n >= 1e7 ? `₹${(n / 1e7).toFixed(2)} cr` : n >= 1e5 ? `₹${(n / 1e5).toFixed(2)} L` : money(n));

function verifiedLabel(verifiedAt: string, now: Date) {
  const minutes = Math.floor((now.getTime() - new Date(verifiedAt).getTime()) / 60_000);
  if (minutes < 1) return "Just verified";
  if (minutes < 60) return `Verified ${minutes} min ago`;
  return new Date(verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

/** "Resolution in action" on the landing page: the latest resolutions and the amounts resolved today, this month and this year. */
export function ResolutionImpact() {
  const now = new Date();
  const summary = demoSummary(now);
  const cards = [
    ["Today", summary.totals.today],
    ["This month / MTD", summary.totals.month],
    [`${summary.totals.yearLabel} / YTD`, summary.totals.year],
  ] as const;

  return (
    <section id="resolutions" className="scroll-mt-20 border-t border-[#e5ece7] bg-white py-14 sm:py-20 dark:border-[#14261c] dark:bg-[#09150f]">
      <div className="mx-auto max-w-7xl px-4 sm:px-8">
        <div className="reveal flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400">
              <Check className="size-4" aria-hidden="true" />
              Resolution in action
            </p>
            <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#183b2f] sm:text-4xl dark:text-white">Progress, as it is confirmed.</h2>
          </div>
          {summary.demo && (
            <span className="self-start rounded-full bg-[#fff1dc] px-3 py-1 text-xs font-semibold text-[#8a5a12] sm:self-auto">Simulated feed - not live DB</span>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="reveal">
            <ul className="divide-y divide-[#e5ece7] rounded-2xl border border-[#e1e9e4] bg-white px-5 dark:divide-[#162a1f] dark:border-[#162a1f] dark:bg-[#0c1a12]">
              {summary.feed.map((row) => (
                <li key={`${row.maskedName}-${row.verifiedAt}-${row.amount}`} className="flex items-center gap-3.5 py-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#e9f1e2] text-sm font-semibold text-[#216b49]" aria-hidden="true">
                    {row.maskedName[0]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[#5c7366] dark:text-[#8ba295]">
                      <span className="font-semibold text-[#183b2f] dark:text-white">{row.maskedName}</span> · {row.product}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#5c7366] dark:text-[#8ba295]">
                      {row.outcome === "FULL_REPAYMENT" ? "Full repayment completed" : "Settlement completed"}
                      {summary.demo && " · example"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-bold text-[#183b2f] dark:text-white">{money(row.amount)}</p>
                    <p className="mt-0.5 text-[11px] text-[#5c7366] dark:text-[#8ba295]">{verifiedLabel(row.verifiedAt, now)}</p>
                  </div>
                </li>
              ))}
            </ul>
            {summary.demo && (
              <p className="mt-3 text-[11px] text-[#6e8577] dark:text-[#8ba295]">Fictional examples. No lender names. Real publication requires an approved, consented public view.</p>
            )}
          </div>

          <div className="reveal">
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {cards.map(([label, total]) => (
                <li key={label} className="rounded-2xl border border-[#e1e9e4] bg-[#f5f8f2] p-4 dark:border-[#162a1f] dark:bg-[#0c1a12]">
                  <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-[#5c7366] dark:text-[#8ba295]">{label}</p>
                  <p className="mt-3 text-2xl font-bold tracking-tight text-[#183b2f] dark:text-white">{shortMoney(total.amount)}</p>
                  <p className="mt-1 text-xs text-[#5c7366] dark:text-[#8ba295]">debt resolved</p>
                  <p className="mt-3 text-[11px] text-[#5c7366] dark:text-[#8ba295]">
                    <strong className="font-semibold text-[#183b2f] dark:text-white">{total.accounts}</strong> accounts ·{" "}
                    <strong className="font-semibold text-[#183b2f] dark:text-white">{total.customers}</strong> customers
                  </p>
                </li>
              ))}
            </ul>
            {summary.demo && (
              <p className="mt-3 text-[11px] text-[#6e8577] dark:text-[#8ba295]">
                Calculated from the same demo events · IST · financial-year YTD from 1 April. Not actual CGreen performance.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
