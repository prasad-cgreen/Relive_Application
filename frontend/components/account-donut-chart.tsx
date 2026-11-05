"use client";

import { useMemo, useState } from "react";

interface AccountDonutChartProps {
  activeCount: number;
  closedCount: number;
  defaultCount?: number;
  totalBalance?: number;
}

export function AccountDonutChart({
  activeCount = 3,
  closedCount = 2,
  defaultCount = 0,
  totalBalance = 184500,
}: AccountDonutChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = activeCount + closedCount + defaultCount || 1;

  const data = useMemo(() => [
    { label: "Active", count: activeCount, color: "#10b981", percent: Math.round((activeCount / total) * 100) },
    { label: "Closed", count: closedCount, color: "#3b82f6", percent: Math.round((closedCount / total) * 100) },
    { label: "Delinquent", count: defaultCount, color: "#f43f5e", percent: Math.round((defaultCount / total) * 100) },
  ], [activeCount, closedCount, defaultCount, total]);

  // SVG Donut calculation
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative size-40 shrink-0">
        <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
          {data.map((item, idx) => {
            const strokeDasharray = `${(item.count / total) * circumference} ${circumference}`;
            const strokeDashoffset = -((cumulativePercent / 100) * circumference);
            cumulativePercent += item.percent;

            if (item.count === 0) return null;

            return (
              <circle
                key={item.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={item.color}
                strokeWidth={hoveredIdx === idx ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-[#0c1a13] dark:text-white">
            {hoveredIdx !== null ? data[hoveredIdx].count : total}
          </span>
          <span className="text-[10px] font-semibold text-[#667a6f] uppercase tracking-wider dark:text-[#8ba295]">
            {hoveredIdx !== null ? data[hoveredIdx].label : "Accounts"}
          </span>
        </div>
      </div>

      {/* Legend & Breakdown */}
      <div className="flex-1 w-full space-y-2.5">
        {data.map((item, idx) => (
          <div
            key={item.label}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            className={`flex items-center justify-between rounded-xl p-2 transition-colors cursor-pointer ${
              hoveredIdx === idx ? "bg-[#f1f6f3] dark:bg-[#12241a]" : "hover:bg-[#f8faf9] dark:hover:bg-[#0c1811]"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="size-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs font-medium text-[#2d3f35] dark:text-[#a0b5ab]">
                {item.label} Accounts
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#0c1a13] dark:text-white">
                {item.count}
              </span>
              <span className="text-[11px] font-medium text-[#7a8f83] dark:text-[#7f998c]">
                {item.percent}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

