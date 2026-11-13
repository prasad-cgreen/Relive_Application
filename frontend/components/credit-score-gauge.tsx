"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

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
  delta?: number | null; // change since the previous report; hidden when null/0
  inverted?: boolean; // drawn on a dark surface
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
  // Red (0-30%) -> Orange (30-50%) -> Yellow (50-70%) -> Lime Green (70-100%)
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
  bands,
  loading = false,
  bureau,
  onRefresh,
  refreshing = false,
  delta = null,
  inverted = false,
}: CreditScoreGaugeProps) {
  const safeMin = min ?? 300;
  const safeMax = max ?? 900;
  const targetPct = score == null || safeMax <= safeMin ? 0 : clamp((score - safeMin) / (safeMax - safeMin), 0, 1);

  const [animPct, setAnimPct] = useState(0);
  const [displayScore, setDisplayScore] = useState<number | null>(null);
  useEffect(() => {
    if (loading || score == null) {
      setAnimPct(0);
      setDisplayScore(null);
      return;
    }

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
      // The bureau's own bands when known, so the arc colour matches the category label.
      const value = safeMin + t * (safeMax - safeMin);
      const color = bands?.find((band) => value < band.max + 1 && value >= band.min)?.color ?? getTickColor(t);

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
  }, [bands, safeMin, safeMax]);

  // Compute position for indicator pill at current score
  const indicatorAngleDeg = 180 + animPct * 180;
  const indicatorRad = (indicatorAngleDeg * Math.PI) / 180;
  const indicatorX = CX + (RADIUS_OUTER + 8) * Math.cos(indicatorRad);
  const indicatorY = CY + (RADIUS_OUTER + 8) * Math.sin(indicatorRad);


  return (
    <div className="relative flex w-full flex-col items-center">
      {/* The bureau this score came from (no switching: one report = one bureau) */}
      {bureau && (
        <div className="mb-4 inline-flex items-center rounded-full border border-black/5 bg-[#f4f6f5] px-3.5 py-1 text-xs font-semibold text-emerald-950 dark:border-white/10 dark:bg-emerald-500/20 dark:text-emerald-300">
          {bureau}
        </div>
      )}

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
            className={inverted ? "text-white/10" : "text-[#e2e8e4] dark:text-[#1e3025]"}
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
                  : inverted ? "text-white/10" : "text-[#dbe3de] opacity-40 dark:text-[#25392d]"
                  }`}
              />
            );
          })}

          {/* Reference score milestones along arc */}
          <text x={CX - RADIUS_OUTER - 4} y={CY + 18} textAnchor="middle" className={`${inverted ? "fill-white/50" : "fill-[#84958c]"} text-[11px] font-semibold`}>
            {safeMin}
          </text>
          {[0.25, 0.5, 0.75].map((t) => {
            const rad = ((180 + t * 180) * Math.PI) / 180;
            return (
              <text key={t} x={CX + (RADIUS_OUTER + 16) * Math.cos(rad)} y={CY + (RADIUS_OUTER + 16) * Math.sin(rad) + 4} textAnchor="middle" className={`${inverted ? "fill-white/50" : "fill-[#84958c]"} text-[10px] font-medium`}>
                {Math.round((safeMin + t * (safeMax - safeMin)) / 10) * 10}
              </text>
            );
          })}
          <text x={CX + RADIUS_OUTER + 6} y={CY + 18} textAnchor="middle" className={`${inverted ? "fill-white/50" : "fill-[#84958c]"} text-[11px] font-semibold`}>
            {safeMax}
          </text>

          {/* Dynamic indicator badge on arc  */}
          {!loading && score != null && delta != null && delta !== 0 && (
            <g
              transform={`translate(${indicatorX}, ${indicatorY})`}
              className="transition-transform duration-300 ease-out"
            >
              <g transform="translate(-24, -14)">
                <rect
                  width="48"
                  height="22"
                  rx="11"
                  className={`${delta > 0 ? "fill-emerald-500 dark:fill-emerald-400" : "fill-rose-500 dark:fill-rose-400"} stroke-2 ${inverted ? "stroke-[#0b2416]" : "stroke-white dark:stroke-[#0a140f]"}`}
                />
                <text
                  x="24"
                  y="14"
                  textAnchor="middle"
                  className="fill-white text-[10px] font-bold tracking-tight dark:fill-emerald-950"
                >
                  {delta > 0 ? `▲ +${delta}` : `▼ ${delta}`} pts
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
                <span className={`text-[clamp(2.5rem,11vw,3.5rem)] font-semibold tabular-nums tracking-[-0.06em] ${inverted ? "text-white" : "text-[#0d1f17] dark:text-[#f0fdf4]"}`}>
                  {displayScore ?? score ?? "—"}
                </span>
              </div>
              {category && (
                <span
                  className="mt-0.5 inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: `${category.color}18`, color: category.color }}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: category.color }} />
                  {category.label}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing || loading}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0d1f17] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#163327] disabled:opacity-60 sm:w-auto dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Updating score…" : "Update credit score"}
        </button>
      )}
    </div>
  );
}
