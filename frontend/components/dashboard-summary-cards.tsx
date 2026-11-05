"use client";

import { CreditCard, FileSearch, Percent, ShieldCheck, Wallet } from "lucide-react";

interface DashboardSummaryCardsProps {
  totalAccounts?: number;
  totalBalance?: number;
  onTimePercent?: number;
  inquiriesCount?: number;
}

export function DashboardSummaryCards({
  totalAccounts = 5,
  totalBalance = 184500,
  onTimePercent = 98,
  inquiriesCount = 0,
}: DashboardSummaryCardsProps) {
  const cards = [
    {
      title: "Total Credit Accounts",
      value: String(totalAccounts),
      subtext: "Open & closed portfolio",
      icon: CreditCard,
      // Soft Lavender / Purple pastel
      cardBg: "bg-[#f5f3ff] border-[#e4dcfb] dark:bg-[#150f24] dark:border-[#2b1f48]",
      iconBg: "bg-[#ede9fe] text-[#7c3aed] dark:bg-[#251744] dark:text-[#a78bfa]",
      valColor: "text-[#3b1275] dark:text-[#ddd6fe]",
    },
    {
      title: "Total Outstanding",
      value: `₹${totalBalance.toLocaleString("en-IN")}`,
      subtext: "Across all active lenders",
      icon: Wallet,
      // Soft Sky Blue pastel
      cardBg: "bg-[#f0f9ff] border-[#d8effe] dark:bg-[#091a24] dark:border-[#14374d]",
      iconBg: "bg-[#e0f2fe] text-[#0284c7] dark:bg-[#123147] dark:text-[#38bdf8]",
      valColor: "text-[#074668] dark:text-[#bae6fd]",
    },
    {
      title: "On-Time Payments",
      value: `${onTimePercent}%`,
      subtext: "Timely repayment rate",
      icon: ShieldCheck,
      // Soft Mint Green pastel
      cardBg: "bg-[#ecfdf5] border-[#d1fae5] dark:bg-[#072115] dark:border-[#12422c]",
      iconBg: "bg-[#d1fae5] text-[#059669] dark:bg-[#0e3b25] dark:text-[#34d399]",
      valColor: "text-[#064e3b] dark:text-[#a7f3d0]",
    },
    {
      title: "Credit Enquiries",
      value: `${inquiriesCount}`,
      subtext: "Recent hard pulls",
      icon: FileSearch,
      // Soft Amber / Lemon pastel
      cardBg: "bg-[#fefce8] border-[#fef08a] dark:bg-[#211c05] dark:border-[#42370c]",
      iconBg: "bg-[#fef9c3] text-[#ca8a04] dark:bg-[#382f09] dark:text-[#facc15]",
      valColor: "text-[#713f12] dark:text-[#fef08a]",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className={`relative rounded-2xl border p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md ${card.cardBg}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#4e6357] dark:text-[#9bb2a5]">
                {card.title}
              </span>
              <span className={`grid size-9 place-items-center rounded-xl ${card.iconBg}`}>
                <Icon className="size-4.5" />
              </span>
            </div>

            <div className="mt-4">
              <p className={`text-2xl font-extrabold tracking-tight ${card.valColor}`}>
                {card.value}
              </p>
              <p className="mt-1 text-xs text-[#62776c] dark:text-[#8ba295]">
                {card.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

