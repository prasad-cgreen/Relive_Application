"use client";

import { ArrowDown, CalendarClock, CreditCard, Layers, Search, ShieldCheck } from "lucide-react";

export type Rating = "Excellent" | "Good" | "Fair" | "Poor" | "N/A";

export type Factor = {
  key: string;
  name: string;
  impact: "High" | "Medium" | "Low";
  value: string;
  rating: Rating;
  pct: number | null; // bar fill, 100 = best
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
};

type Summary = {
  onTimePayments?: number;
  creditUtilization?: number | null;
  creditAgeMonths?: number | null;
  enquiriesLast6Months?: number | null;
  lateMonths?: { upTo30: number; upTo60: number; over60: number };
};

export const ageText = (months: number) => (months < 12 ? `${months} mo` : `${Math.floor(months / 12)}y ${months % 12}m`);

// Relive's guidance bands, not bureau-published cut-offs.
const band = (value: number, [excellent, good, fair]: number[], higherIsBetter = true): Rating => {
  const ok = (limit: number) => (higherIsBetter ? value >= limit : value <= limit);
  return ok(excellent) ? "Excellent" : ok(good) ? "Good" : ok(fair) ? "Fair" : "Poor";
};

export function buildFactors(summary: Summary | undefined, accounts: { type: string }[]): Factor[] {
  const s = summary ?? {};
  const onTime = s.onTimePayments;
  const util = s.creditUtilization;
  const age = s.creditAgeMonths;
  const enq = s.enquiriesLast6Months;
  const late = s.lateMonths ? s.lateMonths.upTo30 + s.lateMonths.upTo60 + s.lateMonths.over60 : 0;
  const types = [...new Set(accounts.map((a) => a.type))];

  return [
    {
      key: "payment",
      name: "Payment history",
      impact: "High",
      value: onTime == null ? "—" : `${onTime}%`,
      rating: onTime == null ? "N/A" : band(onTime, [100, 98, 90]),
      pct: onTime ?? null,
      // lateMonths counts each account once per late month, so these are late payments, not calendar months.
      desc: late === 0 ? "No late payments on record. Keep paying every EMI and card bill on time." : `${late} late payment${late === 1 ? "" : "s"} on record. Late payments hurt your score the most.`,
      icon: ShieldCheck,
    },
    {
      key: "utilization",
      name: "Credit card utilisation",
      impact: "High",
      value: util == null ? "—" : `${util}%`,
      rating: util == null ? "N/A" : band(util, [10, 30, 50], false),
      pct: util == null ? null : Math.max(0, 100 - util),
      desc: util == null ? "No active credit cards are reported." : "Share of your card limits in use. Keeping it under 30% is ideal.",
      icon: CreditCard,
    },
    {
      key: "age",
      name: "Credit age",
      impact: "Medium",
      value: age == null ? "—" : ageText(age),
      rating: age == null ? "N/A" : band(age, [96, 60, 24]),
      pct: age == null ? null : Math.min(100, Math.round((age / 120) * 100)),
      desc: age == null ? "No account opening dates were reported." : "Average age of your active accounts. Older accounts build trust, so avoid closing them.",
      icon: CalendarClock,
    },
    {
      key: "enquiries",
      name: "Credit enquiries",
      impact: "Medium",
      value: enq == null ? "—" : String(enq),
      rating: enq == null ? "N/A" : band(enq, [0, 2, 4], false),
      pct: enq == null ? null : Math.max(0, 100 - enq * 20),
      desc: enq == null ? "Your report did not include enquiry counts." : "Loan and card applications in the last 6 months. Space out new applications.",
      icon: Search,
    },
    {
      key: "mix",
      name: "Credit mix",
      impact: "Low",
      value: types.length ? `${types.length} type${types.length === 1 ? "" : "s"}` : "—",
      rating: types.length ? band(types.length, [3, 2, 1]) : "N/A",
      pct: types.length ? Math.min(100, types.length * 33) : null,
      desc: types.length ? types.join(", ") : "No credit accounts are reported.",
      icon: Layers,
    },
  ];
}

export const RATING_STYLE: Record<Rating, { chip: string; bar: string }> = {
  Excellent: { chip: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300", bar: "bg-emerald-500" },
  Good: { chip: "bg-lime-50 text-lime-700 dark:bg-lime-500/10 dark:text-lime-300", bar: "bg-lime-500" },
  Fair: { chip: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300", bar: "bg-amber-500" },
  Poor: { chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300", bar: "bg-rose-500" },
  "N/A": { chip: "bg-[#f1f5f2] text-[#55695d] dark:bg-white/5 dark:text-[#9bb2a5]", bar: "bg-[#c9d4cd]" },
};

const IMPACT_RANK = { High: 0, Medium: 1, Low: 2 };
const RATING_RANK: Record<Rating, number> = { Poor: 0, Fair: 1, Good: 2, Excellent: 3, "N/A": 4 };

/** The weakest factor that matters most: worst rating, ties broken by impact. Null when nothing is Fair or Poor. */
export const focusFactor = (factors: Factor[]) =>
  factors
    .filter((f) => f.rating === "Poor" || f.rating === "Fair")
    .sort((a, b) => RATING_RANK[a.rating] - RATING_RANK[b.rating] || IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact])[0] ?? null;

/** One card per factor: value, rating, a bar (100 = best) and what it means. */
export function ScoreFactorGrid({ factors }: { factors: Factor[] }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
      {factors.map((f) => {
        const Icon = f.icon;
        const style = RATING_STYLE[f.rating];
        return (
          <li key={f.key} className="flex flex-col rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-5 dark:border-[#162a1f] dark:bg-[#0c1a12]">
            <div className="flex items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f1f5f2] text-[#3d5246] dark:bg-white/5 dark:text-[#b0c8bb]" aria-hidden="true">
                <Icon className="size-4" />
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium text-[#3d5246] dark:text-[#b0c8bb]">{f.name}</p>
              <span className="shrink-0 rounded-full border border-[#e1e9e4] px-2 py-0.5 text-[11px] text-[#6b7f74] dark:border-[#1a3827] dark:text-[#8ba295]">{f.impact} impact</span>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-2xl font-semibold tracking-tight tabular-nums text-[#0c1a13] dark:text-white">{f.value}</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${style.chip}`}>{f.rating}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eef3f0] dark:bg-white/5">
              <div className={`animate-grow-x h-full rounded-full ${style.bar}`} style={{ width: `${f.pct ?? 0}%` }} />
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-[#60756a] sm:text-sm dark:text-[#8ba295]">{f.desc}</p>
            {/* Each factor has a detail section on the Credit Analysis page with id factor-<key> */}
            <a href={`#factor-${f.key}`} className="mt-auto inline-flex w-fit items-center gap-1 pt-3 text-sm font-medium text-[#216b49] hover:underline dark:text-emerald-400">
              See details<span className="sr-only"> on {f.name.toLowerCase()}</span>
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
