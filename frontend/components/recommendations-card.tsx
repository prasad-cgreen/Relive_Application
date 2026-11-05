"use client";

import { ArrowRight, CheckCircle2, Lightbulb, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

interface RecommendationsCardProps {
  insights?: string[];
  score?: number | null;
  onTimePercent?: number;
}

export function RecommendationsCard({
  insights = [],
  score = 782,
  onTimePercent = 98,
}: RecommendationsCardProps) {
  // Generate actionable tailored steps based on real credit report insights
  const items = insights.length > 0 ? insights.map((text, i) => ({
    id: i,
    title: i === 0 ? "Maintain Payment Consistency" : i === 1 ? "Keep Credit Card Utilization Under 30%" : "Diversify Healthy Credit Mix",
    description: text,
    impact: "+15 to +25 points",
    priority: i === 0 ? "High" : "Medium",
  })) : [
    {
      id: 1,
      title: "Maintain Payment Consistency",
      description: "You have a 98% on-time record. Keeping auto-debit active on all loans will protect your excellent standing.",
      impact: "+10 to +20 points",
      priority: "High",
    },
    {
      id: 2,
      title: "Optimize Card Balances",
      description: "Paying your credit card balance before the statement generation date keeps reported utilization below 15%.",
      impact: "+15 to +30 points",
      priority: "High",
    },
    {
      id: 3,
      title: "Maintain Older Credit Accounts",
      description: "Keep your earliest credit card active with minor recurring expenses to preserve your 4+ years of account history.",
      impact: "+8 to +12 points",
      priority: "Medium",
    },
  ];

  return (
    <div className="rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
      <div className="flex items-center justify-between border-b border-[#eef3f0] pb-3 dark:border-[#16291e]">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
            <Sparkles className="size-4" />
          </div>
          <h3 className="text-xs font-bold text-[#0c1a13] uppercase tracking-wider dark:text-white">
            Actionable Recommendations
          </h3>
        </div>
        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Experian AI Insights
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 rounded-xl border border-[#e8f0eb] bg-[#f8faf9] p-3.5 transition-all hover:border-emerald-300 dark:border-[#162a1f] dark:bg-[#09150f] dark:hover:border-emerald-800"
          >
            <div className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-2xs">
              <CheckCircle2 className="size-3.5 stroke-[2.5]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-[#0c1a13] dark:text-white">
                  {item.title}
                </p>
                <span className="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  {item.impact}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#5c7367] dark:text-[#8ba295]">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

