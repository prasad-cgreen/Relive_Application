"use client";

import { Building2, CreditCard, ShieldCheck } from "lucide-react";

interface BalanceBreakdownCardProps {
  totalBalance?: number;
  accounts?: { type: string; balance: number; lender: string; status: string }[];
}

export function BalanceBreakdownCard({
  totalBalance = 184500,
  accounts = [],
}: BalanceBreakdownCardProps) {
  // Categorize accounts into Secured vs Unsecured
  // Secured: Home Loan, Auto Loan, Gold Loan, Mortgage
  // Unsecured: Credit Card, Personal Loan, Consumer Durable, Overdraft
  let securedBalance = 0;
  let unsecuredBalance = 0;

  if (accounts.length > 0) {
    for (const acc of accounts) {
      const typeLower = acc.type.toLowerCase();
      if (typeLower.includes("home") || typeLower.includes("auto") || typeLower.includes("car") || typeLower.includes("gold") || typeLower.includes("mortgage")) {
        securedBalance += acc.balance;
      } else {
        unsecuredBalance += acc.balance;
      }
    }
  } else {
    // default breakdown
    securedBalance = Math.round(totalBalance * 0.85);
    unsecuredBalance = totalBalance - securedBalance;
  }

  const safeTotal = totalBalance > 0 ? totalBalance : 1;
  const securedPct = Math.min(100, Math.round((securedBalance / safeTotal) * 100));
  const unsecuredPct = 100 - securedPct;

  return (
    <div className="rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
      <div className="flex items-center justify-between border-b border-[#eef3f0] pb-3 dark:border-[#16291e]">
        <div>
          <h3 className="text-xs font-bold text-[#0c1a13] uppercase tracking-wider dark:text-white">
            Outstanding Balance
          </h3>
          <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
            Secured vs Unsecured credit distribution
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold text-[#71867a] uppercase dark:text-[#8ba295]">Total Debt</p>
          <p className="text-base font-extrabold text-[#0c1a13] dark:text-white">
            ₹{totalBalance.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Visual Progress Bar */}
      <div className="mt-4">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#e8eee9] dark:bg-[#1a3325]">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${securedPct}%` }}
            title={`Secured: ${securedPct}%`}
          />
          <div
            className="h-full bg-sky-500 transition-all duration-500"
            style={{ width: `${unsecuredPct}%` }}
            title={`Unsecured: ${unsecuredPct}%`}
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-emerald-100 bg-[#f0fdf4] p-3 dark:border-emerald-900/30 dark:bg-[#0a1e13]">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
              <Building2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-semibold">Secured Credit</span>
            </div>
            <p className="mt-2 text-lg font-bold text-[#0c1a13] dark:text-white">
              ₹{securedBalance.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-[#60756a] dark:text-[#8ba295]">
              {securedPct}% (Home, Vehicle, Collateral)
            </p>
          </div>

          <div className="rounded-xl border border-sky-100 bg-[#f0f9ff] p-3 dark:border-sky-900/30 dark:bg-[#0a1b24]">
            <div className="flex items-center gap-2 text-sky-800 dark:text-sky-300">
              <CreditCard className="size-4 text-sky-600 dark:text-sky-400" />
              <span className="text-xs font-semibold">Unsecured Credit</span>
            </div>
            <p className="mt-2 text-lg font-bold text-[#0c1a13] dark:text-white">
              ₹{unsecuredBalance.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-[#60756a] dark:text-[#8ba295]">
              {unsecuredPct}% (Cards, Personal loans)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

