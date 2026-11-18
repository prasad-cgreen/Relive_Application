"use client";

import { ArrowRight, ChevronDown, FileSearch, ShieldCheck } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { PaymentHistoryGrid, type HistoryMonth } from "./payment-history-grid";

/** One account exactly as normalized from the bureau report. Missing fields are shown as "—". */
export interface AccountItem {
  type: string;
  lender: string;
  balance: number;
  status: string;
  accountNumber?: string;
  creditLimit?: number;
  sanctionedAmount?: number;
  pastDue?: number;
  openDate?: string; // YYYY-MM-DD
  history?: HistoryMonth[];
}

interface AccountsTableProps {
  accounts: AccountItem[];
  enquiries: number | null;
  bureauLabel: string;
  defaultFilter?: "all" | "negative";
  /** Open this account's details and scroll to them (from "View account" on the overview). */
  focus?: AccountItem | null;
  /** Shows "Get help with this account" under each account's details. */
  onGetHelp?: (account: AccountItem) => void;
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const formatDate = (iso?: string) => {
  const match = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]} ${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}` : "—";
};
export const rupees = (value?: number) => (value == null ? "—" : `₹${value.toLocaleString("en-IN")}`);
/** Overdue now, or any month reported late. */
export const isNegative = (account: AccountItem) => (account.pastDue ?? 0) > 0 || (account.history ?? []).some((month) => month.status === "late");

export type Priority = "overdue" | "late" | "active" | "closed";
export const priorityOf = (account: AccountItem): Priority =>
  (account.pastDue ?? 0) > 0 ? "overdue" : isNegative(account) ? "late" : account.status === "Active" ? "active" : "closed";
const RANK: Record<Priority, number> = { overdue: 0, late: 1, active: 2, closed: 3 };
/** Most urgent first: overdue (largest past due first), then late history, then open by balance, closed last. */
export const byPriority = (a: AccountItem, b: AccountItem) =>
  RANK[priorityOf(a)] - RANK[priorityOf(b)] || (b.pastDue ?? 0) - (a.pastDue ?? 0) || b.balance - a.balance;

const AVATAR_TONES = ["bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300", "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300", "bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300", "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300", "bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300"];
/** Lender initials in a colour that stays the same for the same lender. */
export function LenderAvatar({ name }: { name: string }) {
  const words = name.replace(/[^a-z0-9 ]/gi, " ").split(/\s+/).filter(Boolean);
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? "?").slice(0, 2)).toUpperCase();
  const tone = AVATAR_TONES[[...name].reduce((h, c) => h + c.charCodeAt(0), 0) % AVATAR_TONES.length];
  return <span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold ${tone}`}>{initials}</span>;
}

/** Credit cards only: how much of the limit is in use. */
function CardUsage({ account }: { account: AccountItem }) {
  if (!/card/i.test(account.type) || !account.creditLimit) return null;
  const pct = Math.min(100, Math.round((account.balance / account.creditLimit) * 100));
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <div className="h-1 w-16 overflow-hidden rounded-full bg-[#e8eee9] dark:bg-white/10">
        <div className={`h-full rounded-full ${pct <= 30 ? "bg-emerald-500" : pct <= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] tabular-nums text-[#6b7f74] dark:text-[#8ba295]">{pct}% used</span>
    </div>
  );
}

export function AccountsTable({ accounts: reported, enquiries, bureauLabel, defaultFilter = "all", focus = null, onGetHelp }: AccountsTableProps) {
  const accounts = [...reported].sort(byPriority);
  const [activeTab, setActiveTab] = useState<"negative" | "all" | "enquiries">(defaultFilter);
  const [expanded, setExpanded] = useState<AccountItem | null>(focus ?? accounts[0] ?? null);

  // Phones show details inside the card, larger screens below the table: scroll to whichever is visible.
  useEffect(() => {
    if (!focus) return;
    const target = [...document.querySelectorAll<HTMLElement>("[data-focused]")].find((el) => el.offsetParent !== null);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focus]);
  const negativeAccounts = accounts.filter(isNegative);
  const rows = activeTab === "negative" ? negativeAccounts : accounts;

  const tab = (key: typeof activeTab, label: string, countValue: number | string, dot: string) => (
    <button
      type="button"
      aria-pressed={activeTab === key}
      onClick={() => setActiveTab(key)}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
        activeTab === key
          ? "bg-[#0c1a13] font-medium text-white dark:bg-white dark:text-[#0c1a13]"
          : "text-[#4e6357] hover:bg-[#f1f6ec] dark:text-[#9bb2a5] dark:hover:bg-[#12241a]"
      }`}
    >
      <span className={`size-1.5 rounded-full ${dot}`} />
      {label}
      <span className="tabular-nums opacity-70">{countValue}</span>
    </button>
  );

  const statusPill = (account: AccountItem) => (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
        (account.pastDue ?? 0) > 0
          ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
          : account.status === "Active"
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "bg-[#f1f5f2] text-[#55695d] dark:bg-white/5 dark:text-[#9bb2a5]"
      }`}
    >
      {(account.pastDue ?? 0) > 0 ? `Overdue ${rupees(account.pastDue)}` : account.status}
    </span>
  );

  const latePill = (account: AccountItem) =>
    isNegative(account) && !(account.pastDue ?? 0) && <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">Late payments</span>;

  const historyPanel = (account: AccountItem) => (
    <>
    <PaymentHistoryGrid
      title={account.lender}
      subtitle={`${account.type} • ${account.accountNumber || "—"} • Opened ${formatDate(account.openDate)} • ${account.status}`}
      history={account.history ?? []}
      onTimePercent={
        account.history?.length
          ? Math.round((account.history.filter((month) => month.status === "ontime").length / account.history.length) * 100)
          : 100
      }
      totalBalance={account.balance}
      highestCredit={account.creditLimit ?? account.sanctionedAmount ?? null}
      openAccounts={account.status === "Active" ? 1 : 0}
      closedAccounts={account.status === "Active" ? 0 : 1}
      bureauLabel={bureauLabel}
      embedded
    />
    {onGetHelp && (
      <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#d5e3c8] bg-[#edf3e6] p-4 sm:flex-row sm:items-center sm:justify-between dark:border-[#1a3827] dark:bg-[#0c1a12]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#183b2f] dark:text-white">Need help with this account?</p>
          <p className="mt-0.5 text-xs text-[#4f6358] dark:text-[#8ba295]">Talk to the Relive team about your options with {account.lender}.</p>
        </div>
        <button
          type="button"
          onClick={() => onGetHelp(account)}
          className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#216b49] px-4 text-sm font-semibold text-white transition hover:bg-[#155438] dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
        >
          Get help with this account
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      </div>
    )}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {tab("all", "All", accounts.length, "bg-emerald-500")}
        {tab("negative", "Negative", negativeAccounts.length, "bg-rose-500")}
        {tab("enquiries", "Enquiries", enquiries ?? "—", "bg-amber-500")}
      </div>

      {activeTab === "enquiries" && (
        <div className="rounded-xl border border-[#e3ebdc] bg-[#f7faf3] p-6 text-center dark:border-[#162a1f] dark:bg-[#09150f]">
          <FileSearch className="mx-auto size-10 text-[#71867a] dark:text-[#8ba295]" />
          <h4 className="mt-2 text-sm font-bold text-[#0c1a13] dark:text-white">
            {enquiries == null ? "Enquiries not reported" : `${enquiries} lender ${enquiries === 1 ? "enquiry" : "enquiries"} in the last 6 months`}
          </h4>
          <p className="mt-1 text-xs text-[#5d7367] dark:text-[#8ba295]">As reported by {bureauLabel}.</p>
        </div>
      )}

      {activeTab !== "enquiries" && rows.length === 0 && (
        <div className="rounded-xl border border-[#e3ebdc] bg-[#f7faf3] p-6 text-center dark:border-[#162a1f] dark:bg-[#09150f]">
          <ShieldCheck className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" />
          <h4 className="mt-2 text-sm font-bold text-[#0c1a13] dark:text-white">
            {activeTab === "negative" ? "No negative accounts" : "No accounts reported"}
          </h4>
          <p className="mt-1 text-xs text-[#5d7367] dark:text-[#8ba295]">
            {activeTab === "negative"
              ? "None of your accounts has an overdue amount or a late month on record."
              : `${bureauLabel} did not report any credit accounts.`}
          </p>
        </div>
      )}

      {activeTab !== "enquiries" && rows.length > 0 && (
        <>
          {/* Phones: one card per account, tap to expand its payment history */}
          <ul className="space-y-3 md:hidden">
            {rows.map((account, index) => {
              const open = expanded === account;
              return (
                <li
                  key={`${account.accountNumber}-${index}`}
                  data-focused={open || undefined}
                  className="scroll-mt-24 overflow-hidden rounded-xl border border-[#e1e9e4] dark:border-[#162a1f]"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpanded(open ? null : account)}
                    className={`w-full p-4 text-left ${open ? "bg-[#f3f8ee] shadow-[inset_3px_0_0_#216b49] dark:bg-[#102419] dark:shadow-[inset_3px_0_0_#34d399]" : "bg-white dark:bg-[#0c1a12]"}`}
                  >
                    <div className="flex items-start gap-3">
                      <LenderAvatar name={account.lender} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#0c1a13] dark:text-white">{account.lender}</p>
                        <p className="mt-0.5 truncate text-xs text-[#63786d] dark:text-[#8ba295]">
                          {account.type} · <span className="font-mono">{account.accountNumber || "—"}</span>
                        </p>
                      </div>
                      <ChevronDown className={`size-4 shrink-0 text-[#62776c] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div>
                        <dt className="text-[#6b7f74] dark:text-[#8ba295]">Balance</dt>
                        <dd className="font-semibold tabular-nums text-[#0c1a13] dark:text-white">{rupees(account.balance)}</dd>
                        <CardUsage account={account} />
                      </div>
                      <div>
                        <dt className="text-[#6b7f74] dark:text-[#8ba295]">Limit / sanctioned</dt>
                        <dd className="font-medium tabular-nums text-[#3d5246] dark:text-[#b0c8bb]">{rupees(account.creditLimit ?? account.sanctionedAmount)}</dd>
                      </div>
                      <div>
                        <dt className="text-[#6b7f74] dark:text-[#8ba295]">Opened</dt>
                        <dd className="font-medium text-[#3d5246] dark:text-[#b0c8bb]">{formatDate(account.openDate)}</dd>
                      </div>
                      <div>
                        <dt className="text-[#6b7f74] dark:text-[#8ba295]">Status</dt>
                        <dd className="flex flex-wrap items-center gap-1">
                          {statusPill(account)}
                          {latePill(account)}
                        </dd>
                      </div>
                    </dl>
                  </button>
                  {open && <div className="animate-in fade-in slide-in-from-top-1 duration-200 border-t border-[#e7efe1] bg-[#fbfdf9] p-4 dark:border-[#162a1f] dark:bg-[#0c1a12]">{historyPanel(account)}</div>}
                </li>
              );
            })}
          </ul>

          {/* Tablet and up: full table */}
          <div className="hidden overflow-hidden rounded-xl border border-[#e1e9e4] bg-white md:block dark:border-[#162a1f] dark:bg-[#0c1a12]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#e7efe1] bg-[#f7faf3] text-xs text-[#62776c] dark:border-[#162a1f] dark:bg-[#09160f] dark:text-[#8ba295]">
                  <tr>
                    <th className="px-4 py-3 font-medium">Lender</th>
                    <th className="px-4 py-3 font-medium lg:max-xl:hidden">Type</th>
                    <th className="px-4 py-3 font-medium">Account</th>
                    <th className="px-4 py-3 text-right font-medium">Balance</th>
                    <th className="hidden px-4 py-3 text-right font-medium xl:table-cell">Limit / sanctioned</th>
                    <th className="hidden px-4 py-3 font-medium xl:table-cell">Opened</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="w-10 px-3 py-3"><span className="sr-only">Expand</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#eef3f0] dark:divide-[#162a1f]">
                  {rows.map((account, index) => {
                    const open = expanded === account;
                    return (
                      <Fragment key={`${account.accountNumber}-${index}`}>
                      <tr
                        onClick={() => setExpanded(open ? null : account)}
                        className={`cursor-pointer transition-colors ${open ? "bg-[#f3f8ee] dark:bg-[#102419]" : "hover:bg-[#f7faf3] dark:hover:bg-[#0f2016]"}`}
                      >
                        <td className={`px-4 py-3 ${open ? "shadow-[inset_3px_0_0_#216b49] dark:shadow-[inset_3px_0_0_#34d399]" : ""}`}>
                          <div className="flex items-center gap-3">
                            <LenderAvatar name={account.lender} />
                            <span className="min-w-0">
                              <span className="block font-medium text-[#0c1a13] dark:text-white">{account.lender}</span>
                              {/* Small laptops: the sidebar takes the room of the Type column, so the type sits here */}
                              <span className="hidden text-xs font-normal text-[#63786d] lg:max-xl:block dark:text-[#8ba295]">{account.type}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[#3d5246] lg:max-xl:hidden dark:text-[#b0c8bb]">{account.type}</td>
                        <td className="px-4 py-3.5 font-mono text-xs text-[#586c62] dark:text-[#8ba295]">{account.accountNumber || "—"}</td>
                        <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-[#0c1a13] dark:text-white">
                          {rupees(account.balance)}
                          <div className="flex justify-end"><CardUsage account={account} /></div>
                        </td>
                        <td className="hidden px-4 py-3.5 text-right tabular-nums text-[#586c62] xl:table-cell dark:text-[#8ba295]">{rupees(account.creditLimit ?? account.sanctionedAmount)}</td>
                        <td className="hidden whitespace-nowrap px-4 py-3.5 text-[#586c62] xl:table-cell dark:text-[#8ba295]">{formatDate(account.openDate)}</td>
                        <td className="px-4 py-3.5">
                          <span className="flex flex-wrap items-center gap-1.5">
                            {statusPill(account)}
                            {latePill(account)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} payment history for ${account.lender}`} className="rounded-md p-1 text-[#62776c] dark:text-[#8ba295]">
                            <ChevronDown className={`size-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
                          </button>
                        </td>
                      </tr>
                      {/* Details open right under the clicked account, not after the whole list */}
                      {open && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <div data-focused className="animate-in fade-in slide-in-from-top-1 duration-200 scroll-mt-24 border-t border-[#e7efe1] bg-[#fbfdf9] p-4 sm:p-6 dark:border-[#162a1f] dark:bg-[#07110b]">
                              {historyPanel(account)}
                            </div>
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
