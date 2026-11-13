"use client";

import { AlertTriangle, Award, CalendarClock, CheckCircle2, Download, Lock, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { api, apiMessage } from "../lib/api";
import { formatDay } from "./score-hero";

export { CreditAnalysisView } from "./credit-analysis";

interface ViewProps {
  workflow: any;
  overview: any;
  onRefreshReport?: () => void;
  refreshing?: boolean;
  onUpdated?: () => void;
}

export function MyReportsView({ overview, onRefreshReport, refreshing }: ViewProps) {
  // A current report is reused by the backend until it expires: refreshing earlier changes nothing.
  const locked = overview?.status === "CURRENT" && !!overview?.expiresAt;
  const [pdfError, setPdfError] = useState("");
  // The bureau's own PDF, via the link stored with the report.
  const openReportPdf = async () => {
    setPdfError("");
    try {
      const { data } = await api.get<{ url: string }>("/credit/report-pdf");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setPdfError(apiMessage(error));
    }
  };
  const score = overview?.score;
  const bureau = overview?.bureau === "CRIF" ? "CRIF High Mark" : "Experian";
  const retrievedAt = overview?.retrievedAt ? new Date(overview.retrievedAt).toLocaleDateString("en-IN", { dateStyle: "long" }) : "Today";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-6 dark:border-[#162a1f] dark:bg-[#0c1a12]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
          <div>
            <h2 className="text-base font-semibold text-[#0c1a13] dark:text-white">
              Bureau report
            </h2>
            <p className="mt-0.5 text-xs text-[#63786d] dark:text-[#8ba295]">
              Your latest report as fetched from the credit bureau
            </p>
          </div>
          {/* While the report is current a refresh changes nothing, so say when it will instead of showing a dead button */}
          {locked ? (
            <p className="inline-flex items-center gap-2 rounded-lg bg-[#f1f5f2] px-3 py-2 text-xs text-[#4f6358] dark:bg-white/5 dark:text-[#a0b8ab]">
              <CalendarClock className="size-4 shrink-0" aria-hidden="true" />
              Next update available on {formatDay(overview.expiresAt)}
            </p>
          ) : (
            <button
              type="button"
              onClick={onRefreshReport}
              disabled={refreshing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d8e3dc] px-4 py-2.5 text-sm font-medium text-[#183b2f] transition hover:bg-[#f6f9f7] disabled:opacity-60 sm:w-auto dark:border-[#1a3526] dark:text-white dark:hover:bg-[#12241a]"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Fetching…" : "Fetch new report"}
            </button>
          )}
        </div>

        {/* Certificate Card Preview */}
        <div className="mt-6 rounded-xl border border-[#e1e9e4] bg-[#f8faf9] p-5 text-center sm:p-8 dark:border-[#1c3627] dark:bg-[#09150f]">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-800 shadow-sm dark:bg-emerald-950 dark:text-emerald-300">
            <Award className="size-7" />
          </div>

          <h3 className="mt-4 text-base font-semibold text-[#0c1a13] dark:text-white">
            Your {bureau} Credit Report
          </h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-[#63786d] dark:text-[#8ba295]">
            {bureau} credit score of <strong className="text-emerald-600 dark:text-emerald-400">{score ?? "—"}</strong>, fetched on {retrievedAt}. Includes your credit accounts and payment history as reported by {bureau}.
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => void openReportPdf()}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#216b49] px-5 text-sm font-medium text-white shadow-sm transition hover:bg-[#155438] sm:w-auto dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
            >
              <Download className="size-4" />
              <span>Download PDF Report</span>
            </button>
            {pdfError && <p className="w-full text-xs text-red-600 dark:text-red-400">{pdfError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Verify PAN from the profile: confirms identity and lets bureau pulls include PAN + DOB. */
function VerifyPanCard({ reverify, onVerified }: { reverify: boolean; onVerified?: () => void }) {
  const [pan, setPan] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError("");
    try {
      await api.post("/kyc/verify", { pan });
      onVerified?.();
    } catch (requestError) {
      setError(apiMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:mt-6 dark:border-amber-900/40 dark:bg-amber-950/20">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-amber-700 dark:text-amber-300" />
        <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200">{reverify ? "Re-verify your PAN" : "Verify your PAN"}</h3>
      </div>
      <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-300/80">
        {reverify
          ? "Verify your PAN once more so we can share it with the bureau for a more accurate match on your next report."
          : "Your details were entered manually. Verifying your PAN confirms your identity and gives the bureau more to match your report on."}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="profile-pan">PAN</label>
        <input
          id="profile-pan"
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
          placeholder="ABCDE1234F"
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded-xl border border-[#d8e2dc] bg-[#fff] px-3 font-mono text-sm tracking-wider text-[#0c1a13] outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 sm:max-w-56 dark:focus:ring-emerald-950 dark:border-[#1e3829] dark:bg-[#07120b] dark:text-white"
        />
        <button
          type="submit"
          disabled={!valid || busy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#216b49] px-5 text-sm font-medium text-white transition hover:bg-[#155438] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
        >
          {busy ? "Verifying…" : "Verify PAN"}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>}
    </form>
  );
}

export function ProfileSettingsView({ workflow, onUpdated }: ViewProps) {
  const profile = workflow?.profile;
  const verified = workflow?.kycStatus === "VERIFIED";
  const badge = verified
    ? { text: "PAN verified", ok: true }
    : workflow?.kycStatus === "MANUAL_REVIEW"
      ? { text: "PAN under review", ok: false }
      : profile?.source === "MANUAL_UNVERIFIED"
        ? { text: "PAN not verified · entered manually", ok: false }
        : { text: "PAN not verified", ok: false };
  // Verified before PANs were stored: one re-verify makes it usable for bureau pulls.
  const needsPan = !(verified && workflow?.panOnFile);
  const dob = profile?.dateOfBirth
    ? new Date(`${profile.dateOfBirth}T00:00:00`).toLocaleDateString("en-IN", { dateStyle: "long" })
    : "—";
  const fields: { label: string; value: string; note?: string; mono?: boolean }[] = [
    {
      label: "Full name",
      value: [profile?.firstName, profile?.lastName].filter(Boolean).join(" ") || "—",
      note: profile?.verified && profile?.source ? `Verified via ${profile.source}` : undefined,
    },
    { label: "Email address", value: profile?.email || "Not provided" },
    { label: "Date of birth", value: dob },
    {
      label: "Registered mobile",
      value: workflow?.mobileLast4 ? `+91 •••••• ${workflow.mobileLast4}` : "—",
      note: workflow?.mobileLast4 ? "Verified by OTP at sign-in" : undefined,
      mono: true,
    },
  ];

  return (
    <section className="rounded-2xl border border-[#e1e9e4] bg-white p-4 shadow-xs sm:p-6 dark:border-[#162a1f] dark:bg-[#0c1a12]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#0c1a13] dark:text-white">Personal details</h2>
          <p className="mt-0.5 text-sm text-[#63786d] dark:text-[#8ba295]">As held on your Relive account</p>
        </div>
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              badge.ok
                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300"
                : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300"
            }`}
          >
            {badge.ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
            {badge.text}
          </span>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
        {fields.map((field) => (
          <div key={field.label} className="min-w-0 rounded-xl border border-[#e5ede8] bg-[#f8faf9] p-4 dark:border-[#162a1f] dark:bg-[#09150f]">
            <dt className="text-xs text-[#6b7f74] dark:text-[#8ba295]">{field.label}</dt>
            <dd className={`mt-1 break-words text-sm font-semibold text-[#0c1a13] dark:text-white ${field.mono ? "font-mono" : ""}`}>{field.value}</dd>
            {field.note && <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">{field.note}</p>}
          </div>
        ))}
      </dl>

      {needsPan && <VerifyPanCard reverify={verified} onVerified={onUpdated} />}

      <div className="mt-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 sm:mt-6 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-emerald-700 dark:text-emerald-300" />
          <h3 className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">Consent & privacy</h3>
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-emerald-900/80 dark:text-emerald-300/80">
          You consented to Relive fetching your credit report from the bureau when you signed up. Read our{" "}
          <a href="/privacy" className="font-medium underline underline-offset-2">privacy policy</a> for how your data is used and how to withdraw consent.
        </p>
      </div>
    </section>
  );
}
