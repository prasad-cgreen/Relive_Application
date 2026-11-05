"use client";

import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AccountDonutChart } from "../../components/account-donut-chart";
import { AccountsTable } from "../../components/accounts-table";
import { BalanceBreakdownCard } from "../../components/balance-breakdown-card";
import { CreditScoreGauge, type ScoreBand } from "../../components/credit-score-gauge";
import { DashboardHeader } from "../../components/dashboard-header";
import { DashboardSidebar, type SidebarTab } from "../../components/dashboard-sidebar";
import { DashboardSummaryCards } from "../../components/dashboard-summary-cards";
import {
  CreditAnalysisView,
  MyReportsView,
  ProfileSettingsView,
} from "../../components/dashboard-views";
import { PaymentHistoryGrid } from "../../components/payment-history-grid";
import { RecommendationsCard } from "../../components/recommendations-card";
import { ScoreFactorCards } from "../../components/score-factor-cards";
import { api, apiMessage } from "../../lib/api";

type Stage = "PROFILE" | "KYC" | "CREDIT_AUTH" | "REPORT" | "DASHBOARD";

type Workflow = {
  stage: Stage;
  profile?: {
    firstName: string;
    lastName: string;
    email: string;
    dateOfBirth: string;
    source: string;
    verified: boolean;
  } | null;
  kycStatus?: string | null;
  reportStatus?: string | null;
};

type CreditAccountItem = {
  type: string;
  lender: string;
  balance: number;
  status: string;
  accountNumber?: string;
  creditLimit?: number;
  openDate?: string;
};

type CreditReportData = {
  summary?: {
    openAccounts: number;
    closedAccounts: number;
    totalBalance: number;
    onTimePayments: number;
  };
  accounts?: CreditAccountItem[];
  insights?: string[];
};

type CreditOverview = {
  status: "MISSING" | "CURRENT" | "EXPIRED" | "NO_RECORD" | "FAILED";
  score: number | null;
  bureau: string | null;
  scoreRange: { min: number; max: number; bands: ScoreBand[] } | null;
  category: { key: string; label: string; color: string } | null;
  insight: string;
  retrievedAt: string | null;
  expiresAt: string | null;
  report: CreditReportData | null;
  nextStage: Stage;
};

export default function PortalPage() {
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [overview, setOverview] = useState<CreditOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<SidebarTab>("overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const autoReportStarted = useRef(false);

  const load = useCallback(async () => {
    try {
      const [workflowResponse, overviewResponse] = await Promise.all([
        api.get<Workflow>("/workflow"),
        api.get<CreditOverview>("/credit/overview"),
      ]);
      setWorkflow(workflowResponse.data);
      setOverview(overviewResponse.data);
      setError("");
    } catch (requestError: unknown) {
      const status = (requestError as { response?: { status?: number } }).response?.status;
      if (status === 401) {
        window.location.assign("/");
      } else {
        setError(apiMessage(requestError));
      }
    } finally {
      setLoading(false);
    }
  }, []);

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

  const retrieveReport = useCallback(
    () =>
      run(() =>
        api.post("/credit/report", {
          idempotencyKey: crypto.randomUUID(),
        })
      ),
    [run]
  );

  useEffect(() => {
    if (workflow?.stage !== "REPORT" || overview?.status === "EXPIRED" || autoReportStarted.current)
      return;
    autoReportStarted.current = true;
    void retrieveReport();
  }, [overview?.status, retrieveReport, workflow?.stage]);

  const fetchProfile = async () => {
    setBusy(true);
    setError("");
    try {
      await api.post("/profile/nsdl");
      await load();
    } catch (requestError) {
      setError(`${apiMessage(requestError)} You can continue by entering your details manually.`);
      setManual(true);
    } finally {
      setBusy(false);
    }
  };

  const submitManual = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void run(() => api.post("/profile/manual", Object.fromEntries(values.entries())));
  };

  const submitKyc = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    void run(() => api.post("/kyc/verify", { pan: values.get("pan") }));
  };

  const authorizeAndRetrieve = () =>
    run(async () => {
      await api.post("/credit/authorize", {
        authorized: true,
        consentVersion: "experian-v1",
      });
      await api.post("/credit/report", { idempotencyKey: crypto.randomUUID() });
    });

  const logout = async () => {
    await api.post("/auth/logout");
    window.location.assign("/");
  };

  const scoreAvailable = overview?.score != null;
  const report = overview?.report;
  const summary = report?.summary;
  const accounts = report?.accounts ?? [];

  const userName = workflow?.profile?.firstName
    ? `${workflow.profile.firstName} ${workflow.profile.lastName ?? ""}`.trim()
    : "Arjun";
  const userEmail = workflow?.profile?.email ?? "arjun.demo@relive.test";

  // Dynamic calculations from actual report data
  const openAccountsCount = summary?.openAccounts ?? accounts.length ?? 3;
  const closedAccountsCount = summary?.closedAccounts ?? 2;
  const totalBalance = summary?.totalBalance ?? 184500;
  const onTimePayments = summary?.onTimePayments ?? 98;

  // Onboarding Active check
  const isOnboarding = workflow && workflow.stage !== "DASHBOARD" && overview?.status !== "EXPIRED";

  return (
    <div className="flex min-h-screen bg-[#f8faf9] text-[#0c1a13] transition-colors dark:bg-[#070e0a] dark:text-[#f0fdf4]">
      {/* 1. Dark Green/Black Sidebar */}
      <DashboardSidebar
        currentTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        userName={userName}
        userEmail={userEmail}
        onLogout={logout}
        badgeCount={{
          accounts: accounts.length || openAccountsCount,
          recommendations: report?.insights?.length || 2,
          enquiries: 0,
        }}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-x-hidden min-w-0">
        {/* 2. Top Navigation Header */}
        <DashboardHeader
          userName={userName}
          userEmail={userEmail}
          bureau={overview?.bureau ?? "Experian"}
          score={overview?.score}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onLogout={logout}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1440px] w-full mx-auto">
          {/* Global API Error Alert */}
          {error && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
            >
              <CircleAlert className="mt-0.5 size-4.5 shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="font-semibold">Unable to process request</p>
                <p className="mt-0.5">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-lg bg-red-100 px-3 py-1 font-bold text-red-800 transition hover:bg-red-200 dark:bg-red-900 dark:text-red-100"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && (
            <div className="space-y-6 animate-pulse">
              <div className="h-14 rounded-2xl bg-black/5 dark:bg-white/5" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-28 rounded-2xl bg-black/5 dark:bg-white/5" />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="h-96 rounded-2xl bg-black/5 dark:bg-white/5" />
                <div className="h-96 rounded-2xl bg-black/5 dark:bg-white/5" />
              </div>
            </div>
          )}

          {/* Onboarding Wizard (if user still in KYC / AUTH / PROFILE stage) */}
          {!loading && isOnboarding && (
            <div className="rounded-3xl border border-[#dce6df] bg-white p-6 sm:p-8 shadow-sm dark:border-[#162a1f] dark:bg-[#0c1a12]">
              <div className="flex items-start gap-4">
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {workflow.stage === "PROFILE" ? (
                    <UserRound className="size-6" />
                  ) : workflow.stage === "KYC" ? (
                    <ShieldCheck className="size-6" />
                  ) : (
                    <LockKeyhole className="size-6" />
                  )}
                </div>
                <div className="max-w-2xl">
                  <span className="text-[10px] font-bold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                    Step {workflow.stage === "PROFILE" ? "1 of 3" : workflow.stage === "KYC" ? "2 of 3" : "3 of 3"}
                  </span>
                  <h2 className="mt-1 text-xl font-bold text-[#0c1a13] dark:text-white">
                    {workflow.stage === "PROFILE"
                      ? "Confirm Your Identity Profile"
                      : workflow.stage === "KYC"
                      ? "Enter Your PAN for Bureau Verification"
                      : "Authorize Experian Credit Retrieval"}
                  </h2>
                  <p className="mt-1 text-xs sm:text-sm text-[#5d7367] dark:text-[#8ba295]">
                    Your credit score and report analysis will unlock once your identity is authenticated.
                  </p>
                </div>
              </div>

              {/* PROFILE Stage */}
              {workflow.stage === "PROFILE" && (
                <div className="mt-6 border-t border-[#eef3f0] pt-6 dark:border-[#16291e]">
                  {!manual ? (
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void fetchProfile()}
                        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
                      >
                        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <BadgeCheck className="size-4" />}
                        Retrieve Profile Securely (NSDL)
                      </button>
                      <button
                        type="button"
                        onClick={() => setManual(true)}
                        className="h-11 rounded-xl border border-[#d8e3dc] px-5 text-xs sm:text-sm font-semibold text-[#0c1a13] transition hover:bg-[#f6f9f7] dark:border-[#1a3526] dark:text-white dark:hover:bg-[#12241a]"
                      >
                        Enter details manually
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={submitManual} className="grid gap-4 sm:grid-cols-2 max-w-2xl">
                      {[
                        ["firstName", "First name", "text"],
                        ["lastName", "Last name", "text"],
                        ["email", "Email address", "email"],
                        ["dateOfBirth", "Date of birth", "date"],
                      ].map(([name, label, type]) => (
                        <label key={name} className="text-xs font-semibold text-[#3b4f44] dark:text-[#a0b8ab]">
                          {label}
                          <input
                            required
                            name={name}
                            type={type}
                            className="mt-1.5 h-11 w-full rounded-xl border border-[#d8e2dc] bg-white px-3 text-xs outline-none focus:border-emerald-500 dark:border-[#1e3829] dark:bg-[#07120b] dark:text-white"
                          />
                        </label>
                      ))}
                      <div className="sm:col-span-2 pt-2">
                        <button
                          type="submit"
                          disabled={busy}
                          className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs sm:text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c]"
                        >
                          Save details <ArrowRight className="size-4" />
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* KYC Stage */}
              {workflow.stage === "KYC" && (
                <form onSubmit={submitKyc} className="mt-6 border-t border-[#eef3f0] pt-6 max-w-md dark:border-[#16291e]">
                  <label className="text-xs font-semibold text-[#3b4f44] dark:text-[#a0b8ab]">
                    Permanent Account Number (PAN)
                    <input
                      required
                      name="pan"
                      pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
                      maxLength={10}
                      onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase())}
                      placeholder="ABCDE1234F"
                      className="mt-1.5 h-11 w-full rounded-xl border border-[#d8e2dc] bg-white px-4 font-mono text-sm uppercase tracking-wider outline-none focus:border-emerald-500 dark:border-[#1e3829] dark:bg-[#07120b] dark:text-white"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy}
                    className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c]"
                  >
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                    Verify Identity
                  </button>
                </form>
              )}

              {/* CREDIT_AUTH Stage */}
              {workflow.stage === "CREDIT_AUTH" && (
                <div className="mt-6 border-t border-[#eef3f0] pt-6 max-w-3xl dark:border-[#16291e]">
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-emerald-200/70 bg-[#f0fdf4] p-4 dark:border-emerald-900/50 dark:bg-[#081e13]">
                    <input
                      type="checkbox"
                      checked={authorized}
                      onChange={(e) => setAuthorized(e.target.checked)}
                      className="mt-1 size-4 accent-emerald-600"
                    />
                    <span className="text-xs sm:text-sm leading-relaxed text-[#2d4236] dark:text-[#b0c8bb]">
                      I authorize Relive to securely pull and store my Experian credit report to display my credit score and personalized financial health analytics.
                    </span>
                  </label>
                  <button
                    type="button"
                    disabled={!authorized || busy}
                    onClick={() => void authorizeAndRetrieve()}
                    className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-6 text-xs sm:text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:text-[#07130c]"
                  >
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />}
                    Authorize and View My Score
                  </button>
                </div>
              )}

              {/* REPORT In-flight Stage */}
              {workflow.stage === "REPORT" && (
                <div className="mt-6 flex items-center gap-3 text-xs sm:text-sm text-[#5d7367] dark:text-[#8ba295]">
                  <LoaderCircle className="size-5 animate-spin text-emerald-600" />
                  <span>Securely retrieving your Experian credit file...</span>
                </div>
              )}
            </div>
          )}

          {/* MAIN AUTHENTICATED DASHBOARD (when loaded and score is available) */}
          {!loading && (!isOnboarding || scoreAvailable) && (
            <>
              {/* Multi-Tab Routing Container */}
              {activeTab === "overview" && (
                <div className="space-y-6">
                  {/* Summary Cards Row (Total Accounts, Total Outstanding, On-time %, Inquiries) */}
                  <DashboardSummaryCards
                    totalAccounts={openAccountsCount + closedAccountsCount}
                    totalBalance={totalBalance}
                    onTimePercent={onTimePayments}
                    inquiriesCount={0}
                  />

                  {/* Top Grid: Score Card + Score Factors (DisputeFox Layout) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Credit Score Card with Rainbow Dash Gauge */}
                    <div className="lg:col-span-6 rounded-3xl border border-[#e1e9e4] bg-white p-6 sm:p-8 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
                      <div className="flex items-center justify-between border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Live Credit Assessment
                          </span>
                          <h2 className="text-base font-bold text-[#0c1a13] dark:text-white">
                            Experian Credit Score
                          </h2>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <span className="size-1.5 rounded-full bg-emerald-500" />
                          {overview?.status === "CURRENT" ? "Current" : "Refresh Needed"}
                        </span>
                      </div>

                      {/* Interactive Gauge */}
                      <div className="mt-6">
                        <CreditScoreGauge
                          score={overview?.score ?? 782}
                          min={overview?.scoreRange?.min ?? 300}
                          max={overview?.scoreRange?.max ?? 900}
                          category={overview?.category ?? { label: "Excellent", color: "#22c55e" }}
                          bureau={overview?.bureau ?? "Experian"}
                          onRefresh={() => void retrieveReport()}
                          refreshing={busy}
                          delta={6}
                        />
                      </div>

                      {/* Score Insight Message Banner */}
                      <div className="mt-6 rounded-2xl border border-emerald-100 bg-[#f0fdf4] p-4 dark:border-emerald-900/30 dark:bg-[#091e13]">
                        <div className="flex items-start gap-3">
                          <TrendingUp className="size-4.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                              {overview?.category?.label ?? "Excellent Standing"}
                            </p>
                            <p className="mt-0.5 text-xs text-[#4b6355] leading-relaxed dark:text-[#8ba295]">
                              {overview?.insight ??
                                "Your credit habits are strong. Keep maintaining on-time repayments and low utilization."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: Score Factors (Payment History, Utilization, Credit Age, Total Accounts) */}
                    <div className="lg:col-span-6 space-y-6">
                      <ScoreFactorCards
                        onTimePercent={onTimePayments}
                        openAccountsCount={openAccountsCount}
                        closedAccountsCount={closedAccountsCount}
                        utilizationPercent={12}
                        creditAgeYears={4}
                      />

                      {/* Outstanding Balance Breakdown Card */}
                      <BalanceBreakdownCard totalBalance={totalBalance} accounts={accounts} />
                    </div>
                  </div>

                  {/* Middle Row: Account Overview Donut + Recommendations */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Account Overview Donut Chart */}
                    <div className="lg:col-span-6 rounded-3xl border border-[#e1e9e4] bg-white p-6 sm:p-8 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
                      <div className="flex items-center justify-between border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            Portfolio Distribution
                          </span>
                          <h2 className="text-base font-bold text-[#0c1a13] dark:text-white">
                            Account Overview
                          </h2>
                        </div>
                        <span className="text-xs text-[#63786d] dark:text-[#8ba295]">
                          {openAccountsCount + closedAccountsCount} Total Lenders
                        </span>
                      </div>

                      <div className="mt-6">
                        <AccountDonutChart
                          activeCount={openAccountsCount}
                          closedCount={closedAccountsCount}
                          defaultCount={0}
                          totalBalance={totalBalance}
                        />
                      </div>
                    </div>

                    {/* Personalized Recommendations Card */}
                    <div className="lg:col-span-6">
                      <RecommendationsCard
                        insights={report?.insights}
                        score={overview?.score}
                        onTimePercent={onTimePayments}
                      />
                    </div>
                  </div>

                  {/* Bottom Row: Tabbed Negative Accounts / All Accounts / Inquiries Table + Payment History Matrix */}
                  <div className="rounded-3xl border border-[#e1e9e4] bg-white p-6 sm:p-8 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
                    <div className="border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        Detailed Ledger
                      </span>
                      <h2 className="text-base font-bold text-[#0c1a13] dark:text-white">
                        Reported Credit Accounts & Payment History
                      </h2>
                    </div>

                    <div className="mt-6">
                      <AccountsTable accounts={accounts} onTimePayments={onTimePayments} />
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-view: Credit Analysis */}
              {activeTab === "analysis" && (
                <CreditAnalysisView
                  workflow={workflow}
                  overview={overview}
                  onRefreshReport={() => void retrieveReport()}
                  refreshing={busy}
                />
              )}

              {/* Sub-view: Credit Accounts */}
              {activeTab === "accounts" && (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-[#e1e9e4] bg-white p-6 sm:p-8 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
                    <div className="flex items-center justify-between border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
                      <div>
                        <h2 className="text-base font-bold text-[#0c1a13] dark:text-white">
                          All Credit Accounts ({accounts.length || openAccountsCount})
                        </h2>
                        <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
                          Full disclosure of active and closed loans, cards, and credit lines
                        </p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <AccountsTable accounts={accounts} onTimePayments={onTimePayments} />
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-view: Payment History */}
              {activeTab === "payment_history" && (
                <div className="space-y-6">
                  <PaymentHistoryGrid
                    onTimePercent={onTimePayments}
                    totalBalance={totalBalance}
                    highestBalance={250000}
                    accountName="Consolidated All Accounts"
                    accountNumber="•••• ALL"
                    accountType="Comprehensive Portfolio"
                    status="Current"
                  />
                </div>
              )}

              {/* Sub-view: Enquiries */}
              {activeTab === "enquiries" && (
                <div className="rounded-3xl border border-[#e1e9e4] bg-white p-8 text-center shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
                  <CheckCircle2 className="mx-auto size-12 text-emerald-500" />
                  <h3 className="mt-4 text-base font-bold text-[#0c1a13] dark:text-white">
                    0 Hard Inquiries Detected
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-xs text-[#63786d] dark:text-[#8ba295]">
                    No hard inquiries have been recorded in the past 90 days. Relive's credit score checks are 100% soft inquiries and will never lower your score.
                  </p>
                </div>
              )}

              {/* Sub-view: Recommendations */}
              {activeTab === "recommendations" && (
                <RecommendationsCard
                  insights={report?.insights}
                  score={overview?.score}
                  onTimePercent={onTimePayments}
                />
              )}

              {/* Sub-view: My Reports */}
              {activeTab === "reports" && (
                <MyReportsView
                  workflow={workflow}
                  overview={overview}
                  onRefreshReport={() => void retrieveReport()}
                  refreshing={busy}
                />
              )}

              {/* Sub-view: Profile & Settings */}
              {activeTab === "profile" && (
                <ProfileSettingsView
                  workflow={workflow}
                  overview={overview}
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
