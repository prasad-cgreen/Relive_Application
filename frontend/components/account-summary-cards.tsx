"use client";

import { ArrowRight } from "lucide-react";
import { byPriority, LenderAvatar, priorityOf, rupees, type AccountItem, type Priority } from "./accounts-table";

const BADGE: Record<Priority, { label: string; className: string }> = {
  overdue: { label: "Overdue", className: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300" },
  late: { label: "Late payments", className: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" },
  active: { label: "On track", className: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300" },
  closed: { label: "Closed", className: "bg-[#f1f5f2] text-[#55695d] dark:bg-white/5 dark:text-[#9bb2a5]" },
};

/** What matters most about this account, in one line. */
function keyFact(account: AccountItem, priority: Priority) {
  if (priority === "overdue") {
    const days = account.history?.[0]?.daysPastDue ?? 0; // history is newest first
    return { label: "Past due", value: rupees(account.pastDue), note: days > 0 ? `${days} days late` : null, alert: true };
  }
  if (priority === "late") {
    const late = (account.history ?? []).filter((m) => m.status === "late").length;
    return { label: "Late months", value: String(late), note: "on record", alert: false };
  }
  const limit = account.creditLimit ?? account.sanctionedAmount;
  return { label: account.creditLimit ? "Limit" : "Sanctioned", value: rupees(limit), note: null, alert: false };
}

interface Props {
  accounts: AccountItem[];
  limit?: number;
  onView: (account: AccountItem) => void;
}

/** Overview cards, most urgent first; each opens that account on the Credit Accounts tab. */
export function AccountSummaryCards({ accounts, limit = 6, onView }: Props) {
  const shown = [...accounts].sort(byPriority).slice(0, limit);

  if (shown.length === 0) {
    return <p className="rounded-xl border border-dashed border-[#dbe5df] p-6 text-center text-sm text-[#63786d] dark:border-[#1d3427] dark:text-[#8ba295]">No credit accounts reported.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {shown.map((account, i) => {
        const priority = priorityOf(account);
        const badge = BADGE[priority];
        const fact = keyFact(account, priority);
        return (
          <li
            key={`${account.accountNumber}-${i}`}
            className={`flex flex-col rounded-xl border bg-white p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/5 dark:bg-[#0c1a12] ${
              priority === "overdue" ? "border-rose-200 dark:border-rose-900/50" : "border-[#e1e9e4] dark:border-[#162a1f]"
            }`}
          >
            <div className="flex items-start gap-3">
              <LenderAvatar name={account.lender} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#0c1a13] dark:text-white">{account.lender}</p>
                <p className="truncate text-xs text-[#63786d] dark:text-[#8ba295]">
                  {account.type} · <span className="font-mono">{account.accountNumber || "—"}</span>
                </p>
              </div>
              <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}>{badge.label}</span>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="min-w-0">
                <dt className="text-[#6b7f74] dark:text-[#8ba295]">Balance</dt>
                <dd className="mt-0.5 truncate text-base font-semibold tabular-nums text-[#0c1a13] dark:text-white">{rupees(account.balance)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[#6b7f74] dark:text-[#8ba295]">{fact.label}</dt>
                <dd className={`mt-0.5 truncate text-base font-semibold tabular-nums ${fact.alert ? "text-rose-700 dark:text-rose-300" : "text-[#0c1a13] dark:text-white"}`}>
                  {fact.value}
                  {fact.note && <span className="ml-1 text-xs font-normal text-[#6b7f74] dark:text-[#8ba295]">{fact.note}</span>}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={() => onView(account)}
              className="mt-4 inline-flex w-fit items-center gap-1 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
              aria-label={`View account ${account.lender} ${account.accountNumber ?? ""}`}
            >
              View account
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
