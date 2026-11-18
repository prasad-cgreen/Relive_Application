"use client";

import { Check, X } from "lucide-react";

export type HistoryMonth = { month: string; status: "ontime" | "late"; daysPastDue: number };

interface PaymentHistoryGridProps {
  history: HistoryMonth[]; // from the bureau report, newest first; worst status per month across accounts
  onTimePercent: number;
  totalBalance: number;
  highestCredit: number | null;
  openAccounts: number;
  closedAccounts: number;
  bureauLabel: string;
  title?: string; // e.g. a single account's lender; defaults to all accounts
  subtitle?: string;
  /** Inside another panel (an expanded account): no card border or padding of its own. */
  embedded?: boolean;
}

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const rupees = (value: number) => `₹${value.toLocaleString("en-IN")}`;

export function PaymentHistoryGrid({
  history,
  onTimePercent,
  totalBalance,
  highestCredit,
  openAccounts,
  closedAccounts,
  bureauLabel,
  title = "All accounts",
  subtitle,
  embedded = false,
}: PaymentHistoryGridProps) {
  const byMonth = new Map(history.map((entry) => [entry.month, entry]));
  // Most recent 5 years that have any reported month.
  const years = [...new Set(history.map((entry) => Number(entry.month.slice(0, 4))))].sort((a, b) => b - a).slice(0, 5);
  const worst = history.reduce((max, entry) => Math.max(max, entry.daysPastDue), 0);
  const latest = history[0];
  const late = history.filter((entry) => entry.status === "late");
  const lateCounts = [late.filter((m) => m.daysPastDue <= 30).length, late.filter((m) => m.daysPastDue > 30 && m.daysPastDue <= 60).length, late.filter((m) => m.daysPastDue > 60).length];

  return (
    <div className={embedded ? "" : "rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-6 dark:border-[#162a1f] dark:bg-[#0c1a12]"}>
      {/* Embedded, the row/card right above already shows this; kept below xl, where the table hides Limit and Opened */}
      <div className={`flex flex-wrap items-center justify-between gap-3 border-b border-[#eef3f0] pb-4 dark:border-[#16291e] ${embedded ? "max-md:hidden xl:hidden" : ""}`}>
        <div className="min-w-0">
          <span className="text-base font-semibold text-[#0c1a13] dark:text-white">{title}</span>
          <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
            {subtitle ?? `${openAccounts} active • ${closedAccounts} closed`} • Reported by {bureauLabel}
          </p>
        </div>
        <div className="flex items-center gap-5 sm:text-right">
          <div>
            <p className="text-[11px] text-[#768a80] dark:text-[#8ba295]">Outstanding</p>
            <p className="text-sm font-semibold tabular-nums text-[#0c1a13] dark:text-white">{rupees(totalBalance)}</p>
          </div>
          <div>
            <p className="text-[11px] text-[#768a80] dark:text-[#8ba295]">Highest credit</p>
            <p className="text-sm font-semibold tabular-nums text-[#0c1a13] dark:text-white">{highestCredit == null ? "—" : rupees(highestCredit)}</p>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] ${embedded ? "md:mt-5 xl:mt-0" : "mt-5"}`}>
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0c1a13] dark:text-white">Payment history</h3>
            {history.length > 0 && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{onTimePercent}% on time</span>
            )}
          </div>

          {history.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[#dbe5df] p-6 text-center text-xs text-[#63786d] dark:border-[#1d3427] dark:text-[#8ba295]">
              Your credit report doesn’t include month-by-month payment history yet.
            </p>
          ) : (
            <>
              <p className="mt-1 text-xs text-[#63786d] dark:text-[#8ba295]">
                {title === "All accounts" ? "Each month shows the worst status reported across your accounts." : "Status reported by the lender each month."}
              </p>
              <div className="-mx-1 mt-4 overflow-x-auto">
                <table className="w-full min-w-[280px] border-collapse text-center">
                  <thead>
                    <tr>
                      <th className="w-10 pl-1 text-left sm:w-12 text-[11px] font-semibold text-[#8ca095] dark:text-[#6a8275]">Year</th>
                      {MONTHS.map((letter, index) => (
                        <th key={index} className="px-0.5 pb-2 sm:px-1 text-[10px] font-bold text-[#8ca095] dark:text-[#7f998c]">
                          {letter}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {years.map((year) => (
                      <tr key={year} className="hover:bg-[#f3f8ee] dark:hover:bg-[#11241a]">
                        <td className="py-1 pl-1 text-left text-[11px] font-semibold tabular-nums sm:text-xs text-[#44574d] dark:text-[#9bb2a6]">{year}</td>
                        {MONTHS.map((_, index) => {
                          const entry = byMonth.get(`${year}-${String(index + 1).padStart(2, "0")}`);
                          const label = `${MONTH_NAMES[index]} ${year}`;
                          return (
                            <td key={index} className="px-0.5 py-1 sm:px-1">
                              {!entry ? (
                                <span title={`${label}: not reported`} className="inline-block size-2 rounded-full bg-[#d6ded9] dark:bg-[#203629]" />
                              ) : entry.status === "ontime" ? (
                                <span title={`${label}: paid on time`} className="inline-flex size-4 items-center justify-center rounded-full bg-emerald-500 sm:size-5 text-white">
                                  <Check className="size-2.5 stroke-[3] sm:size-3" />
                                </span>
                              ) : (
                                <span title={`${label}: ${entry.daysPastDue} days past due`} className="inline-flex size-4 items-center justify-center rounded-full bg-rose-500 sm:size-5 text-white">
                                  <X className="size-2.5 stroke-[3] sm:size-3" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4 text-[11px] text-[#6b8074] dark:text-[#8ba295]">
                <span className="flex items-center gap-1.5">
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="size-2.5" /></span>
                  Paid on time
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="flex size-3.5 items-center justify-center rounded-full bg-rose-500 text-white"><X className="size-2.5" /></span>
                  Past due
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#d6ded9] dark:bg-[#203629]" />
                  Not reported
                </span>
              </div>
            </>
          )}
        </div>

        <div className="rounded-xl border border-[#e3ebdc] bg-white p-4 dark:border-[#193023] dark:bg-[#08120d]">
          <h4 className="text-sm font-semibold text-[#0c1a13] dark:text-white">Summary</h4>
          <dl className="mt-3 space-y-2 text-xs">
            {[
              ["Latest month reported", latest ? `${MONTH_NAMES[Number(latest.month.slice(5)) - 1]} ${latest.month.slice(0, 4)}` : "—"],
              ["Latest status", !latest ? "—" : latest.status === "ontime" ? "Paid on time" : `${latest.daysPastDue} days past due`],
              ["Worst delay", history.length === 0 ? "—" : worst === 0 ? "None" : `${worst} days`],
              ["Months late: ≤30 / 31–60 / 60+ days", history.length ? lateCounts.join(" / ") : "—"],
              ["Months reported", String(history.length)],
            ].map(([term, value]) => (
              <div key={term} className="flex justify-between gap-3 border-b border-[#ebf0ed] pb-1.5 last:border-0 dark:border-[#15281d]">
                <dt className="text-[#687e72] dark:text-[#87a092]">{term}</dt>
                <dd className={`text-right font-semibold ${term === "Latest status" && latest?.status === "late" ? "text-rose-600 dark:text-rose-400" : "text-[#0c1a13] dark:text-white"}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
