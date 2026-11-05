"use client";

import { CheckCircle2, ChevronDown, ChevronUp, FileSearch, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PaymentHistoryGrid } from "./payment-history-grid";

export interface AccountItem {
  type: string;
  lender: string;
  balance: number;
  status: string;
  accountNumber?: string;
  creditLimit?: number;
  openDate?: string;
  onTimeRate?: number;
}

interface AccountsTableProps {
  accounts?: AccountItem[];
  onTimePayments?: number;
}

export function AccountsTable({ accounts = [], onTimePayments = 98 }: AccountsTableProps) {
  const [activeTab, setActiveTab] = useState<"negative" | "active" | "inquiries">("active");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Normalize accounts with fallback fields
  const formattedAccounts: AccountItem[] = accounts.length > 0 ? accounts.map((acc, idx) => ({
    ...acc,
    accountNumber: acc.accountNumber ?? `30285260338${idx}xxxx`,
    creditLimit: acc.creditLimit ?? (acc.type.toLowerCase().includes("card") ? 150000 : 2500000),
    openDate: acc.openDate ?? "12 Jan, 2021",
    onTimeRate: onTimePayments,
  })) : [
    {
      type: "Home Loan",
      lender: "State Bank of India",
      balance: 162000,
      status: "Current",
      accountNumber: "302852603380xxxx",
      creditLimit: 2500000,
      openDate: "22 Jan, 2020",
      onTimeRate: 100,
    },
    {
      type: "Credit Card",
      lender: "HDFC Bank",
      balance: 22500,
      status: "Current",
      accountNumber: "453278901234xxxx",
      creditLimit: 150000,
      openDate: "15 Jun, 2022",
      onTimeRate: 98,
    },
  ];

  const negativeAccounts = formattedAccounts.filter((a) =>
    a.status.toLowerCase().includes("default") ||
    a.status.toLowerCase().includes("overdue") ||
    a.status.toLowerCase().includes("late")
  );

  return (
    <div className="space-y-4">
      {/* DisputeFox Style Tabs with Badge Counters */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[#e5ece8] pb-3 dark:border-[#162a1f]">
        <button
          type="button"
          onClick={() => setActiveTab("negative")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "negative"
              ? "bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-900/50 dark:text-rose-300"
              : "text-[#657a6f] hover:bg-[#f3f7f4] dark:text-[#8ba295] dark:hover:bg-[#0e1d15]"
          }`}
        >
          <span className="flex size-4.5 items-center justify-center rounded-full bg-rose-500 font-bold text-white text-[10px]">
            {negativeAccounts.length}
          </span>
          <span>Negative Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "active"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-900/50 dark:text-emerald-300"
              : "text-[#657a6f] hover:bg-[#f3f7f4] dark:text-[#8ba295] dark:hover:bg-[#0e1d15]"
          }`}
        >
          <span className="flex size-4.5 items-center justify-center rounded-full bg-emerald-500 font-bold text-white text-[10px]">
            {formattedAccounts.length}
          </span>
          <span>All Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("inquiries")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === "inquiries"
              ? "bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:border-amber-900/50 dark:text-amber-300"
              : "text-[#657a6f] hover:bg-[#f3f7f4] dark:text-[#8ba295] dark:hover:bg-[#0e1d15]"
          }`}
        >
          <span className="flex size-4.5 items-center justify-center rounded-full bg-amber-500 font-bold text-white text-[10px]">
            0
          </span>
          <span>Inquiries</span>
        </button>
      </div>

      {/* Content based on tab */}
      {activeTab === "negative" && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-6 text-center dark:border-rose-900/30 dark:bg-rose-950/20">
          <ShieldCheck className="mx-auto size-10 text-emerald-600 dark:text-emerald-400" />
          <h4 className="mt-2 text-sm font-bold text-[#0c1a13] dark:text-white">
            Zero Negative Accounts Found
          </h4>
          <p className="mt-1 text-xs text-[#5d7367] dark:text-[#8ba295]">
            Congratulations! All your reported accounts are in good standing with no defaults or write-offs.
          </p>
        </div>
      )}

      {activeTab === "inquiries" && (
        <div className="rounded-2xl border border-[#e2eae5] bg-[#f8faf9] p-6 text-center dark:border-[#162a1f] dark:bg-[#09150f]">
          <FileSearch className="mx-auto size-10 text-[#71867a] dark:text-[#8ba295]" />
          <h4 className="mt-2 text-sm font-bold text-[#0c1a13] dark:text-white">
            0 Hard Inquiries in the Last 90 Days
          </h4>
          <p className="mt-1 text-xs text-[#5d7367] dark:text-[#8ba295]">
            No financial institutions have made recent hard pulls on your credit report.
          </p>
        </div>
      )}

      {activeTab === "active" && (
        <div className="overflow-hidden rounded-2xl border border-[#e1e9e4] bg-white shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#eef3f0] bg-[#f8faf9] text-[11px] font-bold text-[#62776c] uppercase tracking-wider dark:border-[#162a1f] dark:bg-[#09160f] dark:text-[#8ba295]">
                <tr>
                  <th className="px-5 py-3.5">Date Open</th>
                  <th className="px-4 py-3.5">Name / Lender</th>
                  <th className="px-4 py-3.5">Account Number</th>
                  <th className="px-4 py-3.5">Balance</th>
                  <th className="px-4 py-3.5">Credit Limit</th>
                  <th className="px-4 py-3.5">Type</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-3 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef3f0] dark:divide-[#162a1f]">
                {formattedAccounts.map((account, idx) => {
                  const isExpanded = expandedIndex === idx;
                  return (
                    <tr
                      key={account.accountNumber}
                      onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                      className={`cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-[#f2f7f4] dark:bg-[#102419]"
                          : "hover:bg-[#f9fbf9] dark:hover:bg-[#0f2016]"
                      }`}
                    >
                      <td className="px-5 py-4 font-medium text-[#465a50] dark:text-[#9bb2a5]">
                        {account.openDate}
                      </td>
                      <td className="px-4 py-4 font-bold text-[#0c1a13] dark:text-white">
                        {account.lender}
                      </td>
                      <td className="px-4 py-4 font-mono text-[#586c62] dark:text-[#8ba295]">
                        {account.accountNumber}
                      </td>
                      <td className="px-4 py-4 font-bold text-[#0c1a13] dark:text-white">
                        ₹{account.balance.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-4 text-[#586c62] dark:text-[#8ba295]">
                        ₹{account.creditLimit?.toLocaleString("en-IN")}
                      </td>
                      <td className="px-4 py-4 font-medium text-[#0c1a13] dark:text-white">
                        {account.type}
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          {account.status}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <button
                          type="button"
                          className="rounded-lg p-1 text-[#62776c] hover:bg-black/5 dark:text-[#8ba295] dark:hover:bg-white/5"
                        >
                          {isExpanded ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded Drawer / Payment History Grid */}
          {expandedIndex !== null && formattedAccounts[expandedIndex] && (
            <div className="border-t border-[#e2ebe5] bg-[#f8faf9] p-4 sm:p-6 dark:border-[#162a1f] dark:bg-[#07110b]">
              <PaymentHistoryGrid
                accountName={formattedAccounts[expandedIndex].lender}
                accountNumber={formattedAccounts[expandedIndex].accountNumber}
                accountType={formattedAccounts[expandedIndex].type}
                totalBalance={formattedAccounts[expandedIndex].balance}
                highestBalance={formattedAccounts[expandedIndex].creditLimit}
                status={formattedAccounts[expandedIndex].status}
                openedDate={formattedAccounts[expandedIndex].openDate}
                onTimePercent={formattedAccounts[expandedIndex].onTimeRate}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

