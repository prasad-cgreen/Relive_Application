"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, RefreshCw } from "lucide-react";

export type ScoreBand = {
  key: string;
  label: string;
  min: number;
  max: number;
  color: string;
};

type CreditScoreGaugeProps = {
  score: number | null;
  min: number | null;
  max: number | null;
  category?: { key?: string; label: string; color: string } | null;
  bands?: ScoreBand[];
  loading?: boolean;
  bureau?: string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  delta?: number;
};

const CX = 200;
const CY = 175;
const RADIUS_OUTER = 140;
const TICK_LENGTH = 20;
const TOTAL_TICKS = 60;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTickColor(pct: number): string {
  // DisputeFox rainbow gradient: Red (0-30%) -> Orange (30-50%) -> Yellow (50-70%) -> Lime Green (70-100%)
  if (pct < 0.3) return "#f43f5e"; // rose/red
  if (pct < 0.5) return "#fb923c"; // orange
  if (pct < 0.7) return "#eab308"; // warm yellow
  if (pct < 0.85) return "#84cc16"; // light lime
  return "#22c55e"; // bright green
}

export function CreditScoreGauge({
  score,
  min = 300,
  max = 900,
  category,
  loading = false,
  bureau = "Experian",
  onRefresh,
  refreshing = false,
  delta = 6,
}: CreditScoreGaugeProps) {
  const safeMin = min ?? 300;
  const safeMax = max ?? 900;
  const targetPct = score == null || safeMax <= safeMin ? 0 : clamp((score - safeMin) / (safeMax - safeMin), 0, 1);

  const [animPct, setAnimPct] = useState(0);
  const [displayScore, setDisplayScore] = useState<number | null>(null);
  const [activeBureau, setActiveBureau] = useState(bureau || "Experian");

  useEffect(() => {
    if (bureau) setActiveBureau(bureau);
  }, [bureau]);

  useEffect(() => {
    if (loading || score == null) {
      setAnimPct(0);
      setDisplayScore(null);
      return;
    }

    let start = 0;
    const duration = 900;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setAnimPct(targetPct * ease);
      setDisplayScore(Math.round(safeMin + (score! - safeMin) * ease));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    const frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [score, safeMin, targetPct, loading]);

  const ticks = useMemo(() => {
    const list = [];
    // Arc spans from 180 degrees (left) to 360 degrees (right)
    for (let i = 0; i < TOTAL_TICKS; i++) {
      const t = i / (TOTAL_TICKS - 1);
      const angleDeg = 180 + t * 180;
      const rad = (angleDeg * Math.PI) / 180;
      const color = getTickColor(t);

      const xOuter = CX + RADIUS_OUTER * Math.cos(rad);
      const yOuter = CY + RADIUS_OUTER * Math.sin(rad);
      const xInner = CX + (RADIUS_OUTER - TICK_LENGTH) * Math.cos(rad);
      const yInner = CY + (RADIUS_OUTER - TICK_LENGTH) * Math.sin(rad);

      list.push({
        id: i,
        t,
        xOuter,
        yOuter,
        xInner,
        yInner,
        color,
      });
    }
    return list;
  }, []);

  // Compute position for indicator pill at current score
  const indicatorAngleDeg = 180 + animPct * 180;
  const indicatorRad = (indicatorAngleDeg * Math.PI) / 180;
  const indicatorX = CX + (RADIUS_OUTER + 8) * Math.cos(indicatorRad);
  const indicatorY = CY + (RADIUS_OUTER + 8) * Math.sin(indicatorRad);

  const bureauList = ["Experian", "CIBIL"];

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* Bureau selector tabs matching reference */}
      <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-black/5 bg-[#f4f6f5] p-1 text-xs dark:border-white/10 dark:bg-[#121c16]">
        {bureauList.map((b) => {
          const isSelected = activeBureau.toUpperCase() === b.toUpperCase();
          return (
            <button
              key={b}
              type="button"
              onClick={() => setActiveBureau(b)}
              className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${isSelected
                ? "bg-white text-emerald-950 font-semibold shadow-xs dark:bg-emerald-500/20 dark:text-emerald-300"
                : "text-[#62736b] hover:text-[#0b1712] dark:text-[#889890] dark:hover:text-white"
                }`}
            >
              {b}
            </button>
          );
        })}
      </div>

      {/* Score Arc SVG */}
      <div className="relative mx-auto w-full max-w-[380px]">
        <svg
          viewBox="0 0 400 230"
          className="block h-auto w-full overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="scoreGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#eab308" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#22c55e" stopOpacity="0.25" />
            </linearGradient>
            <filter id="shadowFilter" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Background subtle arc track */}
          <path
            d={`M ${CX - RADIUS_OUTER} ${CY} A ${RADIUS_OUTER} ${RADIUS_OUTER} 0 0 1 ${CX + RADIUS_OUTER} ${CY}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="2 6"
            className="text-[#e2e8e4] dark:text-[#1e3025]"
          />

          {/* Dense Segmented Ticks */}
          {ticks.map((tick) => {
            const isActive = !loading && animPct >= tick.t;
            return (
              <line
                key={tick.id}
                x1={tick.xInner}
                y1={tick.yInner}
                x2={tick.xOuter}
                y2={tick.yOuter}
                stroke={isActive ? tick.color : "currentColor"}
                strokeWidth={isActive ? 2.8 : 2}
                strokeLinecap="round"
                className={`transition-opacity duration-300 ${isActive
                  ? "opacity-100"
                  : "text-[#dbe3de] opacity-40 dark:text-[#25392d]"
                  }`}
              />
            );
          })}

          {/* Reference score milestones along arc */}
          <text x={CX - RADIUS_OUTER - 4} y={CY + 18} textAnchor="middle" className="fill-[#84958c] text-[11px] font-semibold">
            {safeMin}
          </text>
          <text x={CX - 110} y={CY - 105} textAnchor="middle" className="fill-[#84958c] text-[10px] font-medium">
            450
          </text>
          <text x={CX} y={CY - RADIUS_OUTER - 8} textAnchor="middle" className="fill-[#84958c] text-[10px] font-medium">
            580
          </text>
          <text x={CX + 110} y={CY - 80} textAnchor="middle" className="fill-[#84958c] text-[10px] font-medium">
            700
          </text>
          <text x={CX + RADIUS_OUTER + 6} y={CY + 18} textAnchor="middle" className="fill-[#84958c] text-[11px] font-semibold">
            {safeMax}
          </text>

          {/* Dynamic indicator badge on arc (matching DisputeFox delta pill) */}
          {!loading && score != null && (
            <g
              transform={`translate(${indicatorX}, ${indicatorY})`}
              className="transition-transform duration-300 ease-out"
            >
              <g transform="translate(-24, -14)">
                <rect
                  width="48"
                  height="22"
                  rx="11"
                  className="fill-emerald-500 stroke-white stroke-2 shadow-md dark:fill-emerald-400 dark:stroke-[#0a140f]"
                />
                <text
                  x="24"
                  y="14"
                  textAnchor="middle"
                  className="fill-white text-[10px] font-bold tracking-tight dark:fill-emerald-950"
                >
                  ▲ {delta > 0 ? `+${delta}` : delta} pts
                </text>
              </g>
            </g>
          )}
        </svg>

        {/* Central Score Display */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex flex-col items-center justify-center text-center">
          {loading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-16 w-32 animate-pulse rounded-2xl bg-black/5 dark:bg-white/10" />
              <div className="h-4 w-24 animate-pulse rounded-full bg-black/5 dark:bg-white/10" />
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-center">
                <span className="text-[clamp(3.2rem,8vw,4.75rem)] font-bold tracking-[-0.06em] text-[#0d1f17] dark:text-[#f0fdf4]">
                  {displayScore ?? score ?? "—"}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: category?.color ? `${category.color}18` : "#22c55e18",
                    color: category?.color ?? "#16a34a",
                  }}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: category?.color ?? "#16a34a" }}
                  />
                  {category?.label ?? "Good Standing"}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* CTA Button: Update Your Credit Score matching DisputeFox dark pill */}
      <div className="mt-2">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="group inline-flex items-center gap-2 rounded-full bg-[#0d1f17] px-6 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-[#163327] hover:shadow-lg disabled:opacity-60 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
        >
          <RefreshCw
            className={`size-3.5 transition-transform group-hover:rotate-180 ${refreshing ? "animate-spin" : ""
              }`}
          />
          <span>{refreshing ? "Updating score..." : "Update your credit score"}</span>
        </button>
      </div>
    </div>
  );
}
