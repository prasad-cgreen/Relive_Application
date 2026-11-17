"use client";

import { AlertTriangle, CalendarCheck, CircleAlert, FileSearch, Wallet } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AccountSummaryCards } from "../../components/account-summary-cards";
import { AccountsTable } from "../../components/accounts-table";
import { AssessmentCard, type PersonalInsight } from "../../components/assessment-card";
import { type ScoreBand } from "../../components/credit-score-gauge";
import { DebtSummaryCard } from "../../components/debt-summary-card";
import { DashboardHeader } from "../../components/dashboard-header";
import { DashboardSidebar, MobileBottomNav, TAB_TITLES, type SidebarTab } from "../../components/dashboard-sidebar";
import {
  CreditAnalysisView,
  MyReportsView,
  ProfileSettingsView,
} from "../../components/dashboard-views";
import { type HistoryMonth } from "../../components/payment-history-grid";
import { ScoreHero } from "../../components/score-hero";
import { SupportRequestView } from "../../components/support-request";
import { api, apiMessage } from "../../lib/api";
import { logout, redirectToLogin, setSignedInHint, useSessionGuard } from "../../lib/session";

type Stage = "PROFILE" | "REPORT" | "DASHBOARD";

type Workflow = {
  stage: Stage;
  mobileLast4?: string | null;
  profile?: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string | null;
    source: string;
    verified: boolean;
  } | null;
  kycStatus?: string | null;
  panOnFile?: boolean;
  reportStatus?: string | null;
};

type CreditAccountItem = {
  type: string;
  lender: string;
  balance: number;
  status: string;
  accountNumber?: string;
  creditLimit?: number;
  sanctionedAmount?: number;
  pastDue?: number;
  openDate?: string;
  history?: HistoryMonth[];
};

type CreditReportData = {
  summary?: {
    openAccounts: number;
    closedAccounts: number;
    totalBalance: number;
    onTimePayments: number;
    // Added with the bureau parser; older stored reports may not have them (shown as "—").
    creditUtilization?: number | null;
    creditAgeMonths?: number | null;
    enquiriesLast6Months?: number | null;
    highestCredit?: number | null;
    lateMonths?: { upTo30: number; upTo60: number; over60: number };
  };
  accounts?: CreditAccountItem[];
  paymentHistory?: HistoryMonth[];
  insights?: string[];
};

type CreditOverview = {
  status: "MISSING" | "CURRENT" | "EXPIRED" | "NO_RECORD";
  score: number | null;
  bureau: string | null;
  scoreRange: { min: number; max: number; bands: ScoreBand[] } | null;
  category: { key: string; label: string; color: string } | null;
  insight: string;
  retrievedAt: string | null;
  expiresAt: string | null;
  scoreChange?: number | null;
  report: CreditReportData | null;
  nextStage: Stage;
};

/** Shared card surface for every dashboard panel. */
const CARD = "rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-6 dark:border-[#162a1f] dark:bg-[#0c1a12]";
/** Lists of cards: on phones drop the outer card so the items aren't boxed twice. */
const FLAT_ON_PHONE = "max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none max-sm:dark:bg-transparent";

function CardHeader({ eyebrow, title, aside }: { eyebrow?: string; title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">{eyebrow}</p>}
        <h2 className="text-base font-semibold text-[#0c1a13] dark:text-white">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

/** Each dashboard tab is its own history entry (/portal?tab=accounts), so Back moves between tabs. */
function tabFromUrl(): SidebarTab {
  const tab = new URLSearchParams(window.location.search).get("tab");
  return tab && tab in TAB_TITLES ? (tab as SidebarTab) : "overview";
}

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default function PortalPage() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [overview, setOverview] = useState<CreditOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountsFilter, setAccountsFilter] = useState<"all" | "negative">("all");
  const [focusAccount, setFocusAccount] = useState<CreditAccountItem | null>(null);
  // AI summary written from the customer's own answers; null keeps the rule-based summary.
  const [insight, setInsight] = useState<PersonalInsight | null>(null);
  const [personalizing, setPersonalizing] = useState(false);

  useSessionGuard();

  // Loaded after the dashboard so a slow (or failed) AI call never holds the page up.
  const loadInsight = useCallback(async () => {
    setPersonalizing(true);
    try {
      const { data } = await api.get<{ insight: PersonalInsight | null }>("/credit/insight", { timeout: 120_000 });
      setInsight(data.insight);
    } catch {
      /* keep the rule-based summary */
    } finally {
      setPersonalizing(false);
    }
  }, []);

  // Open the tab named in the URL (refresh, shared link) and follow Back/Forward between tabs.
  useEffect(() => {
    const syncTab = () => {
      setActiveTab(tabFromUrl());
      setAccountsFilter("all");
      setFocusAccount(null);
      setMobileMenuOpen(false);
    };
    syncTab();
    window.addEventListener("popstate", syncTab);
    return () => window.removeEventListener("popstate", syncTab);
  }, []);

  const load = useCallback(async () => {
    try {
      const [workflowResponse, overviewResponse] = await Promise.all([
        api.get<Workflow>("/workflow"),
        api.get<CreditOverview>("/credit/overview"),
      ]);
      // Onboarding happens in the login dialog; an expired report still shows the dashboard (with refresh).
      if (workflowResponse.data.stage !== "DASHBOARD" && overviewResponse.data.status !== "EXPIRED") {
        window.location.replace("/?onboarding=1");
        return;
      }
      setSignedInHint(true);
      setWorkflow(workflowResponse.data);
      setOverview(overviewResponse.data);
      setError("");
      setLoading(false);
      if (overviewResponse.data.score != null) void loadInsight();
    } catch (requestError: unknown) {
      const status = (requestError as { response?: { status?: number } }).response?.status;
      if (status === 401) {
        redirectToLogin();
        return;
      }
      setError(apiMessage(requestError));
      setLoading(false);
    }
  }, [loadInsight]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (operation: () => Promise<unknown>) => {
      setBusy(true);
      setError("");
      try {
        await operation();
        await load();
        return true;
      } catch (requestError) {
        setError(apiMessage(requestError));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  // Experian, then CRIF on failure: each can take up to a minute, so this call gets a long timeout.
  const postReport = () => api.post("/credit/report", { idempotencyKey: crypto.randomUUID() }, { timeout: 150_000 });

  const retrieveReport = useCallback(() => run(postReport), [run]);

  const changeTab = (tab: SidebarTab, filter: "all" | "negative" = "all", account: CreditAccountItem | null = null) => {
    if (tab !== tabFromUrl()) window.history.pushState(null, "", tab === "overview" ? "/portal" : `/portal?tab=${tab}`);
    setActiveTab(tab);
    setAccountsFilter(filter);
    setFocusAccount(account);
    window.scrollTo({ top: 0 });
  };
  const closeMenu = useCallback(() => setMobileMenuOpen(false), []);

  const report = overview?.report;
  const summary = report?.summary;
  const accounts = report?.accounts ?? [];

  const firstName = workflow?.profile?.firstName;
  const userName = firstName ? `${firstName} ${workflow?.profile?.lastName ?? ""}`.trim() : "Member"; // never show a made-up identity
  const userEmail = workflow?.profile?.email ?? "";

  const openAccountsCount = summary?.openAccounts ?? accounts.length;
  const totalBalance = summary?.totalBalance ?? 0;
  const onTimePayments = summary?.onTimePayments ?? 0;
  const enquiries = summary?.enquiriesLast6Months ?? null;
  const bureauLabel = overview?.bureau === "CRIF" ? "CRIF High Mark" : "Experian";
  const current = overview?.status === "CURRENT";
  const overdue = accounts.filter((account) => (account.pastDue ?? 0) > 0);
  const pastDueTotal = overdue.reduce((total, account) => total + (account.pastDue ?? 0), 0);

  // workflow is only set client-side, so the time-based greeting never mismatches the server render.
  const heading =
    activeTab === "overview" && workflow
      ? { title: `${greeting()}${firstName ? `, ${firstName}` : ""}`, description: `Your ${bureauLabel} credit snapshot` }
      : TAB_TITLES[activeTab];

  return (
    <div className="portal-root flex min-h-screen bg-[#f6f8f7] text-[#0c1a13] dark:bg-[#070e0a] dark:text-[#f0fdf4]">
      <DashboardSidebar
        currentTab={activeTab}
        onTabChange={(tab) => changeTab(tab)}
        open={mobileMenuOpen}
        onClose={closeMenu}
        userName={userName}
        userEmail={userEmail}
        onLogout={logout}
        badgeCount={{
          accounts: accounts.length || openAccountsCount,
        }}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader
          title={heading.title}
          description={heading.description}
          userName={userName}
          userEmail={userEmail}
          bureau={overview?.score != null ? bureauLabel : null}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={logout}
          onOpenProfile={() => changeTab("profile")}
        />

        <main className="mx-auto w-full max-w-[1400px] flex-1 space-y-4 p-4 pb-24 sm:space-y-6 sm:p-6 sm:pb-24 lg:p-8">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <CircleAlert className="mt-0.5 size-4.5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Unable to process request</p>
                <p className="mt-0.5 break-words">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="shrink-0 rounded-lg bg-red-100 px-3 py-1 text-xs font-semibold text-red-800 transition hover:bg-red-200 dark:bg-red-900 dark:text-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {loading && (
            <div className="space-y-4 animate-pulse sm:space-y-6" aria-busy="true" aria-label="Loading dashboard">
              <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-[1.45fr_1fr]">
                <div className="h-80 rounded-3xl bg-black/5 sm:h-96 dark:bg-white/5" />
                <div className="h-80 rounded-3xl bg-black/5 sm:h-96 dark:bg-white/5" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-24 rounded-2xl bg-black/5 sm:h-28 dark:bg-white/5" />
                ))}
              </div>
            </div>
          )}

          {/* Both bureaus confirmed no record and the user has no other number: new to credit */}
          {!loading && overview?.status === "NO_RECORD" && (
            <div className={CARD}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Your credit profile</p>
              <h2 className="mt-1 text-xl font-semibold text-[#0c1a13] dark:text-white">No credit history yet</h2>
              <p className="mt-2 max-w-2xl text-sm text-[#5d7367] dark:text-[#8ba295]">{overview.insight}</p>
              <ul className="mt-6 grid gap-3 text-sm text-[#2d4236] sm:grid-cols-3 dark:text-[#b0c8bb]">
                {[
                  ["Start small", "A secured credit card against a fixed deposit is the easiest first step."],
                  ["Pay on time, every time", "Your payment history is the biggest factor in your score."],
                  ["Check back in 6 months", "Bureaus usually generate a score after about 6 months of activity."],
                ].map(([title, text]) => (
                  <li key={title} className="rounded-xl border border-[#eef3f0] bg-[#f8faf9] p-4 dark:border-[#16291e] dark:bg-[#08150f]">
                    <p className="font-semibold text-[#0c1a13] dark:text-white">{title}</p>
                    <p className="mt-1 text-xs">{text}</p>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={busy}
                onClick={() => void retrieveReport()}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d8e3dc] px-5 text-sm font-medium text-[#0c1a13] transition hover:bg-[#f6f9f7] disabled:opacity-60 sm:w-auto dark:border-[#1a3526] dark:text-white dark:hover:bg-[#12241a]"
              >
                {busy ? "Checking…" : "Check the bureaus again"}
              </button>
            </div>
          )}

          {!loading && overview?.score != null && overview.status !== "NO_RECORD" && (
            // Re-keyed per tab so each tab fades in when opened
            <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-2 space-y-4 duration-300 sm:space-y-6">
              {activeTab === "overview" && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 items-stretch gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
                    <AssessmentCard
                      accounts={accounts}
                      summary={summary}
                      bureau={bureauLabel}
                      retrievedAt={overview.retrievedAt}
                      insight={insight}
                      personalizing={personalizing}
                      firstName={firstName}
                      onViewAccounts={() => changeTab("accounts", "negative")}
                    />
                    <ScoreHero
                      score={overview.score}
                      min={overview.scoreRange?.min ?? 300}
                      max={overview.scoreRange?.max ?? 900}
                      bands={overview.scoreRange?.bands ?? []}
                      category={overview.category}
                      delta={overview.scoreChange ?? null}
                      bureau={bureauLabel}
                      retrievedAt={overview.retrievedAt}
                      expiresAt={overview.expiresAt}
                      current={current}
                      refreshing={busy}
                      onRefresh={() => void retrieveReport()}
                      onViewReport={() => changeTab("reports")}
                    />
                  </div>

                  <dl className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                    {[
                      { label: "Outstanding", value: `₹${totalBalance.toLocaleString("en-IN")}`, hint: "Across all lenders", icon: Wallet },
                      {
                        label: "Accounts overdue",
                        value: String(overdue.length),
                        hint: overdue.length ? `₹${pastDueTotal.toLocaleString("en-IN")} past due` : "Nothing overdue",
                        icon: AlertTriangle,
                        alert: overdue.length > 0,
                        onClick: () => changeTab("accounts", "negative"),
                      },
                      { label: "On-time payments", value: `${onTimePayments}%`, hint: "Repayment rate", icon: CalendarCheck, onClick: () => changeTab("analysis") },
                      { label: "Enquiries", value: enquiries == null ? "—" : String(enquiries), hint: "Last 6 months", icon: FileSearch, onClick: () => changeTab("analysis") },
                    ].map(({ label, value, hint, icon: Icon, alert, onClick }) => (
                      <div key={label} className={`relative min-w-0 rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-5 dark:border-[#162a1f] dark:bg-[#0c1a12] ${onClick ? "transition duration-200 hover:-translate-y-0.5 hover:border-[#b8cdb0] hover:shadow-md hover:shadow-black/5 dark:hover:border-emerald-800" : ""}`}>
                        <dt className="flex items-center justify-between gap-2 text-xs text-[#63786d] dark:text-[#8ba295]">
                          {onClick ? (
                            // Stretched link: the whole card is the click target
                            <button type="button" onClick={onClick} className="text-left after:absolute after:inset-0 after:rounded-2xl">
                              {label}
                            </button>
                          ) : (
                            label
                          )}
                          <Icon className={`size-4 shrink-0 ${alert ? "text-rose-600 dark:text-rose-400" : "text-[#8aa094]"}`} aria-hidden="true" />
                        </dt>
                        <dd className={`mt-2 truncate text-xl font-semibold tracking-tight tabular-nums sm:text-2xl ${alert ? "text-rose-700 dark:text-rose-300" : "text-[#0c1a13] dark:text-white"}`} title={value}>
                          {value}
                        </dd>
                        <p className="mt-0.5 truncate text-xs text-[#8aa094] dark:text-[#688274]">{hint}</p>
                      </div>
                    ))}
                  </dl>

                  <div className="grid grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-12">
                    <section className={`lg:col-span-8 ${CARD} ${FLAT_ON_PHONE}`}>
                      <div className="flex items-center justify-between gap-2 border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
                        <div>
                          <h2 className="text-base font-semibold text-[#0c1a13] dark:text-white">My accounts</h2>
                          <p className="mt-0.5 text-sm text-[#63786d] dark:text-[#8ba295]">Most urgent first</p>
                        </div>
                        <button type="button" onClick={() => changeTab("accounts")} className="shrink-0 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                          View all ({accounts.length})
                        </button>
                      </div>
                      <div className="mt-4">
                        <AccountSummaryCards accounts={accounts} onView={(account) => changeTab("accounts", "all", account)} />
                      </div>
                    </section>

                    <div className="lg:col-span-4">
                      <DebtSummaryCard totalBalance={totalBalance} accounts={accounts} />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "analysis" && <CreditAnalysisView workflow={workflow} overview={overview} />}

              {activeTab === "accounts" && (
                <section className={`${CARD} ${FLAT_ON_PHONE}`}>
                  <CardHeader
                    title={`All credit accounts (${accounts.length || openAccountsCount})`}
                    aside={<span className="text-xs text-[#63786d] dark:text-[#8ba295]">Reported by {bureauLabel}</span>}
                  />
                  <div className="mt-4 sm:mt-6">
                    <AccountsTable
                      key={`${accountsFilter}-${focusAccount ? accounts.indexOf(focusAccount) : ""}`}
                      accounts={accounts}
                      enquiries={enquiries}
                      bureauLabel={bureauLabel}
                      defaultFilter={accountsFilter}
                      focus={focusAccount}
                      onGetHelp={(account) => changeTab("support", "all", account)}
                    />
                  </div>
                </section>
              )}

              {activeTab === "support" && (
                <SupportRequestView
                  key={focusAccount ? accounts.indexOf(focusAccount) : -1}
                  accounts={accounts}
                  account={focusAccount}
                  mobileLast4={workflow?.mobileLast4}
                  onBack={() => changeTab("accounts", "all", focusAccount)}
                />
              )}

              {activeTab === "reports" && (
                <MyReportsView workflow={workflow} overview={overview} onRefreshReport={() => void retrieveReport()} refreshing={busy} />
              )}

              {activeTab === "profile" && <ProfileSettingsView workflow={workflow} overview={overview} onUpdated={() => void load()} />}
            </div>
          )}
        </main>
      </div>

      <MobileBottomNav currentTab={activeTab} onTabChange={(tab) => changeTab(tab)} onOpenMenu={() => setMobileMenuOpen(true)} />
    </div>
  );
}
