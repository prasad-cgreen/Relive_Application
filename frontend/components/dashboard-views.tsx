"use client";

import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  Download,
  FileCheck2,
  FileText,
  HelpCircle,
  History,
  Lock,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  User,
} from "lucide-react";
import { AccountsTable } from "./accounts-table";
import { BalanceBreakdownCard } from "./balance-breakdown-card";
import { PaymentHistoryGrid } from "./payment-history-grid";
import { RecommendationsCard } from "./recommendations-card";
import { ScoreFactorCards } from "./score-factor-cards";

interface ViewProps {
  workflow: any;
  overview: any;
  onRefreshReport?: () => void;
  refreshing?: boolean;
}

export function CreditAnalysisView({ overview }: ViewProps) {
  const score = overview?.score ?? 782;
  const factors = [
    {
      name: "Payment History",
      weight: "35% of total score",
      status: "Excellent",
      scorePct: 98,
      desc: "Zero defaults and late payments in the past 24 billing cycles.",
      tone: "emerald",
    },
    {
      name: "Credit Utilization",
      weight: "30% of total score",
      status: "Optimal (12%)",
      scorePct: 88,
      desc: "Using well below the recommended 30% aggregate revolving limit.",
      tone: "emerald",
    },
    {
      name: "Credit History Length",
      weight: "15% of total score",
      status: "Good (4+ Yrs)",
      scorePct: 75,
      desc: "Oldest active trade line has been in good standing for over 4 years.",
      tone: "sky",
    },
    {
      name: "Credit Types & Mix",
      weight: "10% of total score",
      status: "Healthy Blend",
      scorePct: 80,
      desc: "Diversified mix of secured home loan and unsecured credit card.",
      tone: "sky",
    },
    {
      name: "Recent Inquiries",
      weight: "10% of total score",
      status: "No Hard Inquiries",
      scorePct: 100,
      desc: "No new loan applications or hard credit inquiries in the last 90 days.",
      tone: "emerald",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e1e9e4] bg-white p-6 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
          <div>
            <h2 className="text-base font-bold text-[#0c1a13] dark:text-white">
              Credit Score Analysis & Weightage
            </h2>
            <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
              Detailed breakdown of how Experian calculates your current {score} score
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <ShieldCheck className="size-4" />
            Verified Algorithms
          </span>
        </div>

        <div className="mt-6 space-y-4">
          {factors.map((f) => (
            <div
              key={f.name}
              className="rounded-xl border border-[#e8f0eb] bg-[#f8faf9] p-4 dark:border-[#162a1f] dark:bg-[#09150f]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-[#0c1a13] dark:text-white">
                    {f.name}
                  </h3>
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {f.weight}
                  </span>
                </div>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-bold text-[#0c1a13] shadow-2xs border border-[#e1e9e4] dark:bg-[#0e2116] dark:border-[#1a3827] dark:text-white">
                  {f.status}
                </span>
              </div>

              <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-[#e3eae5] dark:bg-[#193325]">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${f.scorePct}%` }}
                />
              </div>

              <p className="mt-2 text-xs text-[#63786d] dark:text-[#8ba295]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MyReportsView({ overview, onRefreshReport, refreshing }: ViewProps) {
  const report = overview?.report;
  const score = overview?.score ?? 782;
  const bureau = overview?.bureau ?? "EXPERIAN";
  const retrievedAt = overview?.retrievedAt ? new Date(overview.retrievedAt).toLocaleDateString("en-IN", { dateStyle: "long" }) : "Today";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e1e9e4] bg-white p-6 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
          <div>
            <h2 className="text-base font-bold text-[#0c1a13] dark:text-white">
              Official Credit Bureau Reports
            </h2>
            <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
              Download and verify authentic credit records retrieved from authorized bureaus
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshReport}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0c1a13] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#1a3627] disabled:opacity-50 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Request New Pull</span>
          </button>
        </div>

        {/* Certificate Card Preview */}
        <div className="mt-6 rounded-2xl border-2 border-dashed border-[#d8e4dc] bg-[#fbfdfc] p-6 text-center sm:p-8 dark:border-[#1c3627] dark:bg-[#09150f]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm dark:bg-emerald-950 dark:text-emerald-300">
            <Award className="size-7" />
          </div>

          <h3 className="mt-4 text-base font-bold text-[#0c1a13] dark:text-white">
            Official {bureau} Credit Health Certificate
          </h3>
          <p className="mx-auto mt-1 max-w-md text-xs text-[#63786d] dark:text-[#8ba295]">
            Certified Experian credit score of <strong className="text-emerald-600 dark:text-emerald-400">{score}</strong> generated on {retrievedAt}. Includes active debt accounts, payment trends, and lender remarks.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => alert("Downloading encrypted Experian Credit Report PDF...")}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
            >
              <Download className="size-4" />
              <span>Download PDF Report</span>
            </button>
            <button
              type="button"
              onClick={() => alert("Credit report verification hash: exp_982f1b4c9e884210a (Valid on RBI partner network)")}
              className="inline-flex items-center gap-2 rounded-xl border border-[#d6e2da] bg-white px-5 py-2.5 text-xs font-semibold text-[#0c1a13] transition hover:bg-[#f6f9f7] dark:border-[#1d3829] dark:bg-[#0e2116] dark:text-white"
            >
              <FileCheck2 className="size-4" />
              <span>Verify Signature</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileSettingsView({ workflow, overview }: ViewProps) {
  const profile = workflow?.profile;
  const firstName = profile?.firstName || "Aarav";
  const lastName = profile?.lastName || "Sharma";
  const email = profile?.email || "aarav.demo@relive.test";
  const dob = profile?.dateOfBirth || "1992-06-14";
  const source = profile?.source || "NSDL";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e1e9e4] bg-white p-6 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]">
        <div className="flex items-center justify-between border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
          <div>
            <h2 className="text-base font-bold text-[#0c1a13] dark:text-white">
              Member Profile & KYC Verification
            </h2>
            <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
              Personal details synchronized from government & credit bureau sources
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="size-4" />
            KYC Verified
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-[#e5ede8] bg-[#f8faf9] p-4 dark:border-[#162a1f] dark:bg-[#09150f]">
            <p className="text-[10px] font-bold text-[#71867a] uppercase tracking-wider dark:text-[#8ba295]">
              Full Name
            </p>
            <p className="mt-1 text-sm font-bold text-[#0c1a13] dark:text-white">
              {firstName} {lastName}
            </p>
            <span className="mt-2 inline-block text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
              ✓ Verified via {source}
            </span>
          </div>

          <div className="rounded-xl border border-[#e5ede8] bg-[#f8faf9] p-4 dark:border-[#162a1f] dark:bg-[#09150f]">
            <p className="text-[10px] font-bold text-[#71867a] uppercase tracking-wider dark:text-[#8ba295]">
              Email Address
            </p>
            <p className="mt-1 text-sm font-bold text-[#0c1a13] dark:text-white">
              {email}
            </p>
            <span className="mt-2 inline-block text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
              ✓ Verified Communication Channel
            </span>
          </div>

          <div className="rounded-xl border border-[#e5ede8] bg-[#f8faf9] p-4 dark:border-[#162a1f] dark:bg-[#09150f]">
            <p className="text-[10px] font-bold text-[#71867a] uppercase tracking-wider dark:text-[#8ba295]">
              Date of Birth
            </p>
            <p className="mt-1 text-sm font-bold text-[#0c1a13] dark:text-white">
              {dob}
            </p>
            <span className="mt-2 inline-block text-[10px] text-[#71867a] dark:text-[#8ba295]">
              Matches PAN records
            </span>
          </div>

          <div className="rounded-xl border border-[#e5ede8] bg-[#f8faf9] p-4 dark:border-[#162a1f] dark:bg-[#09150f]">
            <p className="text-[10px] font-bold text-[#71867a] uppercase tracking-wider dark:text-[#8ba295]">
              Registered Mobile
            </p>
            <p className="mt-1 text-sm font-mono font-bold text-[#0c1a13] dark:text-white">
              +91 •••••• 3210
            </p>
            <span className="mt-2 inline-block text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
              ✓ OTP Multi-factor Authenticated
            </span>
          </div>
        </div>

        {/* Security & Regulatory Consents */}
        <div className="mt-6 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2">
            <Lock className="size-4 text-emerald-700 dark:text-emerald-300" />
            <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
              Consent & Privacy Protection
            </h4>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-emerald-900/80 dark:text-emerald-300/80">
            You have granted explicit consent for monthly credit score monitoring under Relive Experian consent version experian-v1. You can revoke this anytime from your privacy portal.
          </p>
        </div>
      </div>
    </div>
  );
}

