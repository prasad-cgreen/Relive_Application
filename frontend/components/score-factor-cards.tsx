"use client";

import { ArrowUpRight, CheckCircle2, Info, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";
import { useState } from "react";

interface ScoreFactorCardsProps {
  onTimePercent?: number;
  openAccountsCount?: number;
  closedAccountsCount?: number;
  utilizationPercent?: number;
  creditAgeYears?: number;
}

export function ScoreFactorCards({
  onTimePercent = 98,
  openAccountsCount = 3,
  closedAccountsCount = 2,
  utilizationPercent = 12,
  creditAgeYears = 4,
}: ScoreFactorCardsProps) {
  const [showUtilTooltip, setShowUtilTooltip] = useState(false);

  const totalAccounts = openAccountsCount + closedAccountsCount;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* 1. Payment History */}
      <div className="group relative rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md dark:border-[#162a1f] dark:bg-[#0c1a12] dark:hover:border-emerald-700">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-[#0c1a13] dark:text-white">
            Payment history
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            High impact
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-[#0c1a13] dark:text-white">
            {onTimePercent}%
          </span>
          <ArrowUpRight className="size-4 text-[#8ba093] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[#60756a] dark:text-[#8ba295]">
          Percentage of payments you’ve made on time across all reporting lenders.
        </p>
      </div>

      {/* 2. Credit Card Use / Leverage with DisputeFox popup preview */}
      <div
        className="group relative rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md dark:border-[#162a1f] dark:bg-[#0c1a12] dark:hover:border-emerald-700"
        onMouseEnter={() => setShowUtilTooltip(true)}
        onMouseLeave={() => setShowUtilTooltip(false)}
      >
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-[#0c1a13] dark:text-white">
            Credit card use
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            High impact
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-[#0c1a13] dark:text-white">
            {utilizationPercent}%
          </span>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
            ▲ Optimal
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[#60756a] dark:text-[#8ba295]">
          How much credit you’re using compared to your total approved limits.
        </p>

        {/* DisputeFox Hover Tip Card */}
        {showUtilTooltip && (
          <div className="absolute right-2 -top-28 z-20 w-64 rounded-2xl border border-emerald-200 bg-white p-3.5 shadow-xl transition-all dark:border-emerald-800/80 dark:bg-[#09150f]">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <Sparkles className="size-3.5" />
              <span>Pro Tip: Keep it under 30%</span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-[#5c7367] dark:text-[#8ba295]">
              Maintaining balances below 30% signals low credit risk and helps boost your Experian score quickly.
            </p>
            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-[#e8eee9] dark:bg-[#1a3325]">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${utilizationPercent}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* 3. Credit Age / Coverage */}
      <div className="group relative rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md dark:border-[#162a1f] dark:bg-[#0c1a12] dark:hover:border-emerald-700">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-[#0c1a13] dark:text-white">
            Credit age
          </span>
          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
            Medium impact
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-[#0c1a13] dark:text-white">
            {creditAgeYears} yrs
          </span>
          <ArrowUpRight className="size-4 text-[#8ba093] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[#60756a] dark:text-[#8ba295]">
          Average age of your active accounts. Established credit profiles build trust.
        </p>
      </div>

      {/* 4. Total Accounts */}
      <div className="group relative rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md dark:border-[#162a1f] dark:bg-[#0c1a12] dark:hover:border-emerald-700">
        <div className="flex items-start justify-between">
          <span className="text-xs font-semibold text-[#0c1a13] dark:text-white">
            Total accounts
          </span>
          <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 text-[10px] font-bold dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300">
            Low impact
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold tracking-tight text-[#0c1a13] dark:text-white">
            {totalAccounts}
          </span>
          <span className="text-xs font-medium text-[#7a8f83] dark:text-[#7f998c]">
            ({openAccountsCount} active)
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[#60756a] dark:text-[#8ba295]">
          A balanced mix of credit accounts and healthy repayment records.
        </p>
      </div>
    </div>
  );
}

