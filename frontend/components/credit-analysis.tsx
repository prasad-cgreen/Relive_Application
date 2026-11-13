"use client";

import { AlertTriangle, Check, CheckCircle2 } from "lucide-react";
import { byPriority, isNegative, LenderAvatar, rupees, type AccountItem } from "./accounts-table";
import { PaymentHistoryGrid, type HistoryMonth } from "./payment-history-grid";
import { ageText, buildFactors, focusFactor, RATING_STYLE, ScoreFactorGrid, type Factor, type Rating } from "./score-factors";
import { formatDay } from "./score-hero";

type Summary = {
  openAccounts?: number;
  closedAccounts?: number;
  totalBalance?: number;
  onTimePayments?: number;
  creditUtilization?: number | null;
  creditAgeMonths?: number | null;
  enquiriesLast6Months?: number | null;
  highestCredit?: number | null;
  lateMonths?: { upTo30: number; upTo60: number; over60: number };
};

type Overview = {
  score: number | null;
  bureau: string | null;
  scoreRange?: { max: number } | null;
  category: { label: string; color: string } | null;
  retrievedAt: string | null;
  report: { summary?: Summary; accounts?: AccountItem[]; paymentHistory?: HistoryMonth[]; insights?: string[] } | null;
};

const CARD = "rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-6 dark:border-[#162a1f] dark:bg-[#0c1a12]";
const EYEBROW = "text-[11px] font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400";
const MUTED = "text-[#5c7366] dark:text-[#8ba295]";
const TILE = "rounded-xl border border-[#e5ede8] bg-[#f8faf9] p-3 dark:border-[#162a1f] dark:bg-[#09150f]";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const monthsSince = (isoDay: string) => {
  const [year, month] = isoDay.split("-").map(Number);
  const now = new Date();
  return (now.getFullYear() - year) * 12 + now.getMonth() + 1 - month;
};
const usageTone = (pct: number) => (pct <= 30 ? "bg-emerald-500" : pct <= 50 ? "bg-amber-500" : "bg-rose-500");

// Relive's guidance bands for enquiries, as used by buildFactors.
const ENQUIRY_SCALE: { range: string; rating: Rating }[] = [
  { range: "0", rating: "Excellent" },
  { range: "1–2", rating: "Good" },
  { range: "3–4", rating: "Fair" },
  { range: "5+", rating: "Poor" },
];

function FactorBadge({ factor }: { factor: Factor }) {
  return (
    <span className="flex shrink-0 items-center gap-2">
      <span className="text-lg font-semibold tabular-nums text-[#183b2f] dark:text-white">{factor.value}</span>
      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${RATING_STYLE[factor.rating].chip}`}>{factor.rating}</span>
    </span>
  );
}

function SectionHeading({ eyebrow, title, why, factor }: { eyebrow: string; title: string; why: string; factor?: Factor }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 px-1">
      <div className="min-w-0 max-w-2xl">
        <p className={EYEBROW}>{eyebrow}</p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#183b2f] dark:text-white">{title}</h2>
        <p className="mt-0.5 text-sm text-[#4f6358] dark:text-[#a0b8ab]">{why}</p>
      </div>
      {factor && <FactorBadge factor={factor} />}
    </div>
  );
}

/** The bureau report explained factor by factor. Rule-based: every number comes straight from the report. */
export function CreditAnalysisView({ overview }: { workflow?: unknown; overview: Overview | null }) {
  const report = overview?.report;
  if (!report) {
    return (
      <section className={`${CARD} text-center`}>
        <h2 className="text-base font-semibold text-[#183b2f] dark:text-white">No report to analyse yet</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>Your credit analysis appears here once your credit report is available.</p>
      </section>
    );
  }

  const summary = report.summary ?? {};
  const accounts = report.accounts ?? [];
  const insights = report.insights ?? [];
  const bureauLabel = overview?.bureau === "CRIF" ? "CRIF High Mark" : "Experian";
  const factors = buildFactors(summary, accounts);
  const factor = Object.fromEntries(factors.map((f) => [f.key, f])) as Record<string, Factor>;
  const focus = focusFactor(factors);
  const helping = factors.filter((f) => f.rating === "Excellent" || f.rating === "Good");
  const hurting = factors.filter((f) => f.rating === "Fair" || f.rating === "Poor");
  const groups = [
    { title: "Holding your score back", items: hurting },
    { title: "Helping your score", items: helping },
    { title: "Not in your report", items: factors.filter((f) => f.rating === "N/A") },
  ].filter((group) => group.items.length > 0);

  // Same basis as the bureau summary: open cards that report a limit.
  const cards = accounts.filter((a) => a.status === "Active" && /card/i.test(a.type) && a.creditLimit);
  const cardsUsed = sum(cards.map((a) => a.balance));
  const cardsLimit = sum(cards.map((a) => a.creditLimit ?? 0));
  const toThirty = (balance: number, limit: number) => Math.ceil(balance - limit * 0.3);

  const late = accounts.filter(isNegative).sort(byPriority);
  const overdue = accounts.filter((a) => (a.pastDue ?? 0) > 0);
  const dated = accounts.filter((a) => a.openDate).sort((a, b) => a.openDate!.localeCompare(b.openDate!));
  const ends: [string, AccountItem][] = [];
  if (dated.length) ends.push(["Oldest account", dated[0]]);
  if (dated.length > 1) ends.push(["Newest account", dated[dated.length - 1]]);
  const types = [...accounts.reduce((map, a) => {
    const entry = map.get(a.type) ?? { active: 0, closed: 0 };
    entry[a.status === "Active" ? "active" : "closed"] += 1;
    return map.set(a.type, entry);
  }, new Map<string, { active: number; closed: number }>())];
  const enquiries = summary.enquiriesLast6Months;

  // One concrete step for the focus factor, using the report's own numbers where it has them.
  const step: Record<string, string> = {
    payment: overdue.length
      ? `${rupees(sum(overdue.map((a) => a.pastDue ?? 0)))} is overdue on ${plural(overdue.length, "account")}. Clear it first: every month it stays unpaid is reported as late.`
      : "Pay every EMI and card bill by its due date; auto-pay helps. Each on-time month adds to your record.",
    utilization: toThirty(cardsUsed, cardsLimit) > 0
      ? `Paying ${rupees(toThirty(cardsUsed, cardsLimit))} off your cards would bring your usage down to 30% of their limits.`
      : "Keep your card balances under 30% of their limits.",
    age: "Keep your oldest accounts open: closing them lowers the average age of your credit.",
    enquiries: "Apply for new loans or cards only when you need them, and space applications out.",
    mix: "This has a low impact on your score. Don't take on a new loan just to improve it.",
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-8 duration-300 sm:space-y-10">
      {/* Summary: score, the split, and the one thing to do first */}
      <div className="space-y-5">
        <section className={CARD}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)] lg:items-center lg:gap-8">
            <div className="min-w-0">
              <p className={EYEBROW}>
                Your {bureauLabel} report{overview?.retrievedAt ? ` · ${formatDay(overview.retrievedAt)}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <p className="text-4xl font-semibold tracking-tight tabular-nums text-[#183b2f] dark:text-white">
                  {overview?.score ?? "—"}
                  {overview?.scoreRange && <span className={`ml-1 text-sm font-normal ${MUTED}`}>/ {overview.scoreRange.max}</span>}
                </p>
                {overview?.category && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d5e3c8] bg-[#edf3e6] px-2.5 py-1 text-xs font-medium text-[#183b2f] dark:border-[#1a3827] dark:bg-white/5 dark:text-[#d4e4da]">
                    <span className="size-2 rounded-full" style={{ backgroundColor: overview.category.color }} aria-hidden="true" />
                    {overview.category.label}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-[#4f6358] dark:text-[#a0b8ab]">
                {helping.length} of {factors.length} factors are helping your score
                {hurting.length ? `; ${hurting.length} ${hurting.length === 1 ? "is" : "are"} holding it back` : ""}.
              </p>
            </div>

            <div className={`flex items-start gap-3 rounded-xl p-4 ${focus ? "bg-amber-50 dark:bg-amber-500/10" : "bg-emerald-50 dark:bg-emerald-500/10"}`}>
              {focus ? (
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${focus ? "text-amber-900 dark:text-amber-200" : "text-emerald-900 dark:text-emerald-200"}`}>
                  {focus ? `Focus first: ${focus.name.toLowerCase()} (${focus.value})` : "Every factor is in good shape"}
                </p>
                <p className={`mt-0.5 text-sm ${focus ? "text-amber-800/90 dark:text-amber-300/80" : "text-emerald-800/90 dark:text-emerald-300/80"}`}>
                  {focus
                    ? `Rated ${focus.rating.toLowerCase()}, ${focus.impact.toLowerCase()} impact. ${step[focus.key]}`
                    : "Keep paying on time and using a small share of your card limits."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {groups.map((group) => (
          <section key={group.title}>
            <h2 className="mb-3 px-1 text-sm font-semibold text-[#183b2f] dark:text-white">
              {group.title} <span className={`font-normal ${MUTED}`}>· {group.items.length}</span>
            </h2>
            <ScoreFactorGrid factors={group.items} />
          </section>
        ))}
      </div>

      {/* Payment history */}
      <section id="factor-payment" className="scroll-mt-24 space-y-3">
        <SectionHeading
          eyebrow="High impact"
          title="Payment history"
          why="The biggest part of your score: whether every EMI and card bill was paid by its due date."
          factor={factor.payment}
        />
        <PaymentHistoryGrid
          history={report.paymentHistory ?? []}
          onTimePercent={summary.onTimePayments ?? 0}
          totalBalance={summary.totalBalance ?? 0}
          highestCredit={summary.highestCredit ?? null}
          openAccounts={summary.openAccounts ?? 0}
          closedAccounts={summary.closedAccounts ?? 0}
          bureauLabel={bureauLabel}
        />
        <div className={CARD}>
          {summary.lateMonths && (
            <>
              <h3 className="text-sm font-semibold text-[#183b2f] dark:text-white">Late payments by how late</h3>
              <p className={`mt-0.5 text-xs ${MUTED}`}>The later a payment, the more it hurts. Each account counts once for every month it was late.</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                {(
                  [
                    ["Up to 30 days", summary.lateMonths.upTo30, "text-amber-700 dark:text-amber-300"],
                    ["31–60 days", summary.lateMonths.upTo60, "text-orange-700 dark:text-orange-300"],
                    ["Over 60 days", summary.lateMonths.over60, "text-rose-700 dark:text-rose-300"],
                  ] as const
                ).map(([label, n, tone]) => (
                  <div key={label} className={TILE}>
                    <dt className={`text-[11px] sm:text-xs ${MUTED}`}>{label}</dt>
                    <dd className={`mt-1 text-xl font-semibold tabular-nums ${n > 0 ? tone : "text-[#183b2f] dark:text-white"}`}>{n}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}

          <h3 className={`text-sm font-semibold text-[#183b2f] dark:text-white ${summary.lateMonths ? "mt-5" : ""}`}>Accounts with late or overdue payments</h3>
          {late.length === 0 ? (
            <p className={`mt-1 text-sm ${MUTED}`}>None. No account has a late month or an overdue amount on record.</p>
          ) : (
            <ul className="mt-2 divide-y divide-[#eef3f0] dark:divide-[#16291e]">
              {late.map((a, i) => {
                const lateMonths = (a.history ?? []).filter((m) => m.status === "late");
                const worst = Math.max(0, ...lateMonths.map((m) => m.daysPastDue));
                return (
                  <li key={`${a.lender}-${a.accountNumber ?? i}`} className="flex items-center gap-3 py-3">
                    <LenderAvatar name={a.lender} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#183b2f] dark:text-white">{a.lender}</p>
                      <p className={`truncate text-xs ${MUTED}`}>{[a.type, a.accountNumber].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {lateMonths.length > 0 && (
                        <>
                          <p className="text-xs font-semibold text-[#183b2f] dark:text-white">{plural(lateMonths.length, "late month")}</p>
                          <p className={`text-xs ${MUTED}`}>worst {worst} days</p>
                        </>
                      )}
                      {(a.pastDue ?? 0) > 0 && <p className="text-xs font-semibold text-rose-700 dark:text-rose-400">{rupees(a.pastDue)} overdue now</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-6">
        {/* Card utilisation */}
        <section id="factor-utilization" className="scroll-mt-24 space-y-3">
          <SectionHeading
            eyebrow="High impact"
            title="Credit card utilisation"
            why="How much of your card limits you are using. High usage reads as stretched finances; under 30% is the usual guidance."
            factor={factor.utilization}
          />
          <div className={CARD}>
            {cards.length === 0 ? (
              <p className={`text-sm ${MUTED}`}>No open credit cards with a limit are reported, so this factor does not apply to you right now.</p>
            ) : (
              <>
                <ul className="space-y-5">
                  {cards.map((a, i) => {
                    const pct = Math.round((a.balance / a.creditLimit!) * 100);
                    return (
                      <li key={`${a.lender}-${a.accountNumber ?? i}`}>
                        <div className="flex items-center gap-3">
                          <LenderAvatar name={a.lender} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[#183b2f] dark:text-white">{a.lender}</p>
                            <p className={`truncate text-xs ${MUTED}`}>{[a.type, a.accountNumber].filter(Boolean).join(" · ")}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums text-[#183b2f] dark:text-white">{pct}% used</p>
                            <p className={`text-xs tabular-nums ${MUTED}`}>
                              {rupees(a.balance)} of {rupees(a.creditLimit)}
                            </p>
                          </div>
                        </div>
                        <div className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-[#eef3f0] dark:bg-white/5">
                          <div className={`animate-grow-x h-full rounded-full ${usageTone(pct)}`} style={{ width: `${Math.min(100, pct)}%` }} />
                          <span className="absolute inset-y-0 left-[30%] w-0.5 bg-[#183b2f]/50 dark:bg-white/40" aria-hidden="true" />
                        </div>
                        {pct > 30 && (
                          <p className="mt-1.5 text-xs text-amber-800 dark:text-amber-300">
                            Above 30%: paying {rupees(toThirty(a.balance, a.creditLimit!))} would bring this card to 30%.
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className={`mt-5 border-t border-[#eef3f0] pt-3 text-xs dark:border-[#16291e] ${MUTED}`}>
                  {cards.length > 1 && `Across ${plural(cards.length, "card")}: ${rupees(cardsUsed)} used of ${rupees(cardsLimit)}. `}
                  The line on each bar marks 30% of the limit. Closed cards do not count.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Enquiries */}
        <section id="factor-enquiries" className="scroll-mt-24 space-y-3">
          <SectionHeading
            eyebrow="Medium impact"
            title="Credit enquiries"
            why="Each loan or card application lets a lender check your report. Many in a short time can lower your score."
            factor={factor.enquiries}
          />
          <div className={CARD}>
            {enquiries == null ? (
              <p className={`text-sm ${MUTED}`}>{bureauLabel} did not include enquiry counts in your report.</p>
            ) : (
              <>
                <p className="text-sm text-[#4f6358] dark:text-[#a0b8ab]">
                  <span className="mr-1.5 text-3xl font-semibold tabular-nums text-[#183b2f] dark:text-white">{enquiries}</span>
                  {enquiries === 1 ? "enquiry" : "enquiries"} in the last 6 months, as reported by {bureauLabel}
                </p>
                <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Relive guidance for enquiries in 6 months">
                  {ENQUIRY_SCALE.map(({ range, rating }) => {
                    const current = rating === factor.enquiries.rating;
                    return (
                      <li
                        key={rating}
                        aria-current={current ? "true" : undefined}
                        className={`rounded-lg px-1 py-2 text-center ${current ? `${RATING_STYLE[rating].chip} ring-1 ring-current` : "bg-[#f4f7f5] text-[#5c7366] dark:bg-white/5 dark:text-[#8ba295]"}`}
                      >
                        <span className="block text-sm font-semibold tabular-nums">{range}</span>
                        <span className="block text-[11px]">{rating}</span>
                      </li>
                    );
                  })}
                </ol>
                <p className={`mt-3 text-xs ${MUTED}`}>Relive&apos;s guidance bands, not a bureau cut-off.</p>
              </>
            )}
          </div>
        </section>
      </div>

      {/* Credit age and mix */}
      <section id="factor-age" className="scroll-mt-24 space-y-3">
        <SectionHeading
          eyebrow="Medium and low impact"
          title="Credit age and mix"
          why="Lenders trust a long track record and experience handling different kinds of credit."
        />
        <div className={`${CARD} grid gap-6 md:grid-cols-2 md:gap-8`}>
          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#183b2f] dark:text-white">Credit age</h3>
              <FactorBadge factor={factor.age} />
            </div>
            <p className={`mt-0.5 text-xs ${MUTED}`}>Average age of your active accounts.</p>
            {ends.length === 0 ? (
              <p className={`mt-3 text-sm ${MUTED}`}>No account opening dates were reported.</p>
            ) : (
              <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                {ends.map(([label, a]) => (
                  <div key={label} className={TILE}>
                    <dt className={`text-xs ${MUTED}`}>{label}</dt>
                    <dd className="mt-1 truncate text-sm font-semibold text-[#183b2f] dark:text-white">{a.lender}</dd>
                    <dd className={`text-xs ${MUTED}`}>
                      {a.type}
                      {a.status === "Closed" ? " (closed)" : ""}
                    </dd>
                    <dd className={`text-xs ${MUTED}`}>
                      Opened {formatDay(`${a.openDate}T00:00:00`)} · {ageText(monthsSince(a.openDate!))} ago
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div id="factor-mix" className="scroll-mt-24">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#183b2f] dark:text-white">Credit mix</h3>
              <FactorBadge factor={factor.mix} />
            </div>
            <p className={`mt-0.5 text-xs ${MUTED}`}>Kinds of credit on your report, open and closed.</p>
            {types.length === 0 ? (
              <p className={`mt-3 text-sm ${MUTED}`}>No credit accounts are reported.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[#eef3f0] dark:divide-[#16291e]">
                {types.map(([type, { active, closed }]) => (
                  <li key={type} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0 truncate text-sm text-[#183b2f] dark:text-white">{type}</span>
                    <span className={`shrink-0 text-xs ${MUTED}`}>
                      {[active && `${active} active`, closed && `${closed} closed`].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Recommendations from the backend's reading of the report */}
      <section id="next-steps" className="space-y-3">
        <SectionHeading eyebrow="What you can do" title="Recommendations" why={`Generated from the numbers in your ${bureauLabel} report.`} />
        <div className={CARD}>
          {insights.length === 0 ? (
            <p className={`text-sm ${MUTED}`}>No recommendations for this report yet.</p>
          ) : (
            <ul className="space-y-2.5">
              {insights.map((text, i) => (
                <li key={i} className="flex items-start gap-3 rounded-xl border border-[#d5e3c8] bg-[#edf3e6] p-3.5 dark:border-[#1a3827] dark:bg-[#09150f]">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#216b49] text-white dark:bg-emerald-500 dark:text-[#07130c]" aria-hidden="true">
                    <Check className="size-3 stroke-[3]" />
                  </span>
                  <p className="min-w-0 flex-1 text-sm leading-relaxed text-[#183b2f] dark:text-[#b0c8bb]">{text}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
