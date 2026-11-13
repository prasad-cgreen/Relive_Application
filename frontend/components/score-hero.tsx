"use client";

import { ArrowDownRight, ArrowUpRight, CalendarClock, FileText, RefreshCw } from "lucide-react";
import { CreditScoreGauge, type ScoreBand } from "./credit-score-gauge";

export const formatDay = (iso: string, withYear = true) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(withYear && { year: "numeric" }) });

interface ScoreHeroProps {
  score: number;
  min: number;
  max: number;
  bands: ScoreBand[];
  category: { label: string; color: string } | null;
  delta: number | null;
  bureau: string;
  retrievedAt: string | null;
  expiresAt: string | null;
  current: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onViewReport: () => void;
}

/** The score meter on a dark brand surface; sits beside the assessment card on the overview. */
export function ScoreHero({ score, min, max, bands, category, delta, bureau, retrievedAt, expiresAt, current, refreshing, onRefresh, onViewReport }: ScoreHeroProps) {
  // The backend reuses a current report until it expires, so refreshing before then changes nothing.
  const locked = current && !!expiresAt;
  const next = bands.find((band) => band.min > score);

  return (
    <section className="relative flex h-full flex-col overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f2e1d] via-[#0b2416] to-[#071a10] text-white shadow-sm ring-1 ring-white/5">
      <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full bg-emerald-400/15 blur-3xl" />

      {/* Top bar */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Your credit score</p>
          <p className="text-xs text-white/55">
            {bureau}
            {retrievedAt && ` · Updated ${formatDay(retrievedAt)}`}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            current ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200"
          }`}
        >
          <span className={`size-1.5 rounded-full ${current ? "bg-emerald-400" : "bg-amber-400"}`} />
          {current ? "Up to date" : "Refresh needed"}
        </span>
      </div>

      <div className="relative flex flex-1 flex-col gap-5 p-5 sm:p-7">
        {/* Score */}
        <div className="flex flex-col items-center">
          <div className="w-full max-w-[300px]">
            <CreditScoreGauge score={score} min={min} max={max} bands={bands} category={category} inverted />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm">
            {delta != null && delta !== 0 && (
              <span className={`inline-flex items-center gap-0.5 font-medium ${delta > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                {delta > 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                {Math.abs(delta)} pts since last report
              </span>
            )}
            <span className="text-white/60">
              {next ? (
                <>
                  <span className="font-semibold text-white">{next.min - score} pts</span> to {next.label}
                </>
              ) : (
                "Top score band"
              )}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-3">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={onViewReport}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#fff] px-4 py-2.5 text-sm font-semibold text-[#0b2416] transition hover:bg-emerald-50"
            >
              <FileText className="size-4" />
              View full report
            </button>
            {locked ? (
              <p className="inline-flex items-center justify-center gap-2 text-xs text-white/55">
                <CalendarClock className="size-4 shrink-0" />
                Next score update on {formatDay(expiresAt!)}
              </p>
            ) : (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
              >
                <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Updating…" : "Refresh score"}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
