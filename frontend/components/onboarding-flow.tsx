"use client";

import { ArrowRight, CircleAlert, LoaderCircle, Lock, RefreshCw, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, apiErrorCode, apiMessage } from "../lib/api";
import { forgetQrReferral, isAgentId, isReferralMobile, qrReferral, qrReferralBody } from "../lib/referral";

export type Workflow = {
  stage: "PROFILE" | "REPORT" | "DASHBOARD";
  mobileLast4?: string | null;
  profile?: { firstName: string; lastName: string; email: string; dateOfBirth: string | null; source: string; verified: boolean } | null;
};

// Experian, then CRIF on failure: each can take up to a minute.
const postReport = () => api.post("/credit/report", { idempotencyKey: crypto.randomUUID() }, { timeout: 150_000 });
// Logs out and reopens the login dialog at the mobile step.
const restartLogin = () => void api.post("/auth/logout").finally(() => window.location.assign("/?login=1"));

/**
 * What the user can do after each error. Anything not listed (outages, timeouts, network) is retryable.
 * details = name-as-on-PAN form, altMobile = OTP-verify another number, noHistory = confirm new to credit,
 * relogin = start again, [] = nothing now (daily limit).
 */
type Action = "details" | "retry" | "relogin" | "altMobile" | "noHistory";
const ACTIONS: Record<string, Action[]> = {
  PAN_NOT_VERIFIED: ["details", "retry"],
  PAN_UNAVAILABLE: ["details"],
  PAN_ATTEMPT_LIMIT: ["details"],
  PAN_ALREADY_LINKED: ["retry", "relogin"], // retry = maybe a typo in the PAN
  PAN_MOBILE_MISMATCH: ["details", "relogin"], // PAN belongs to another number: log in with it, or enter details
  NO_CREDIT_RECORD: ["altMobile", "details", "noHistory"],
  // Report's PAN/DOB isn't this user's: fix the DOB, or use the number registered with the bank. Never a plain
  // retry: that repeats a billed pull that would return the same report.
  REPORT_IDENTITY_MISMATCH: ["details", "altMobile"],
  REPORT_ATTEMPT_LIMIT: [],
  CONSENT_REQUIRED: ["relogin"],
  MOBILE_REVERIFY_REQUIRED: ["relogin"],
  SESSION_EXPIRED: ["relogin"],
  AUTH_REQUIRED: ["relogin"],
};

type View = "main" | "details" | "altMobile";
type Phase = "pan" | "details" | "altMobile" | "report" | "noHistory";

const inputClass =
  "mt-1.5 h-11 w-full rounded-xl border border-[#d8e2dc] bg-white px-3 text-xs outline-none focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 dark:focus:ring-emerald-950 dark:border-[#1e3829] dark:bg-[#07120b] dark:text-white";
const primaryButton =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#216b49] text-sm font-semibold text-white transition hover:bg-[#155438] disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400";
const secondaryButton =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#d8e3dc] text-xs font-bold text-[#0c1a13] transition hover:bg-[#f6f9f7] dark:border-[#1a3526] dark:text-white dark:hover:bg-[#12241a]";
const linkButton = "text-xs font-semibold text-[#5a7063] hover:text-emerald-600 dark:text-[#8ba295] dark:hover:text-emerald-400";
const labelClass = "text-xs font-bold text-[#35483d] dark:text-[#a0b8ab]";

const PHASE_TITLES: Record<Phase, string> = {
  pan: "Verifying your PAN",
  details: "Saving your details",
  altMobile: "Verifying your number",
  report: "Fetching your credit report",
  noHistory: "Setting up your account",
};

/** After OTP for users without a report: PAN (or name as on PAN) -> credit report (Experian, CRIF fallback). */
export function OnboardingFlow({ initial, onComplete }: { initial: Workflow; onComplete: () => void }) {
  const [workflow, setWorkflow] = useState(initial);
  const [view, setView] = useState<View>("main");
  const [phase, setPhase] = useState<Phase | null>(null);
  const [error, setError] = useState<{ code: string; message: string; actions: Action[] } | null>(null);
  // Alternate-mobile sub-flow
  const [alt, setAlt] = useState<{ mobile: string; transactionId?: string; devOtp?: string }>({ mobile: "" });
  const [altBusy, setAltBusy] = useState(false);
  // Optional referral code (the referrer's mobile number), shared by the PAN and name-as-on-PAN forms.
  // From an agent's QR code it is filled in and locked; otherwise the user may type one.
  const [referral, setReferral] = useState(qrReferral);
  const [referralLocked, setReferralLocked] = useState(() => referral !== "");
  // The number shown in the locked field: the QR link carries the agent's id, so their number is fetched here.
  const [qrMobile, setQrMobile] = useState(() => (isReferralMobile(referral) ? referral : ""));
  // The referrer's (agent's) name, fetched alongside their number for the "Referred by …" line under the field.
  const [referrerName, setReferrerName] = useState("");
  // What was last typed in the PAN / details forms: they are replaced by a spinner while saving, so after an error
  // (e.g. a referral number not found) they come back with the user's input instead of empty.
  const [draft, setDraft] = useState<Record<string, string>>({});

  const busy = phase !== null;
  const showError = (requestError: unknown) => {
    const code = apiErrorCode(requestError) ?? "";
    // A rejected QR number (e.g. a deactivated agent) must not block signup: let the user change or clear it.
    if (code.startsWith("REFERRAL_") && referralLocked) {
      forgetQrReferral();
      setReferralLocked(false);
      setReferral("");
      setQrMobile("");
    }
    setError({ code, message: apiMessage(requestError), actions: ACTIONS[code] ?? ["retry"] });
  };
  useEffect(() => {
    if (!referralLocked || !isAgentId(referral)) return;
    let current = true;
    api.get<{ mobile: string; name: string }>(`/referral/agents/${referral}`)
      .then(({ data }) => {
        if (!current) return;
        setQrMobile(data.mobile);
        setReferrerName(data.name);
      })
      .catch((requestError) => current && apiErrorCode(requestError) === "REFERRAL_NOT_FOUND" && showError(requestError));
    return () => { current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, for the QR code this tab opened with
  }, []);
  /** The referral for a PAN / details request, or null (with the error shown) when the typed number isn't valid. */
  const referralBody = () => {
    if (!referral) return {};
    if (referralLocked) return { referral: qrReferralBody(referral) };
    if (!isReferralMobile(referral)) {
      setError({ code: "REFERRAL_INVALID", message: "Enter the referrer's 10-digit mobile number, or leave the referral code blank", actions: ["retry"] });
      return null;
    }
    return { referral: { mobile: referral, source: "MANUAL" } };
  };
  const switchView = (next: View) => {
    setView(next);
    setError(null);
  };

  /**
   * Runs an optional save step, then fetches the report (consent was given at signup).
   * If the save step fails the user stays on the same form; if the report fails, the report options show.
   */
  const run = async (step: Phase, save?: () => Promise<unknown>, fetchReport = true) => {
    setError(null);
    let failedOnSave = false;
    try {
      if (save) {
        setPhase(step);
        failedOnSave = true;
        await save();
        failedOnSave = false;
      }
      if (fetchReport) {
        setPhase("report");
        await postReport();
      }
    } catch (requestError) {
      showError(requestError);
    }
    try {
      const { data } = await api.get<Workflow>("/workflow");
      setWorkflow(data);
      if (data.stage === "DASHBOARD") return onComplete(); // keep the spinner while navigating
      if (!failedOnSave) setView("main");
    } catch {
      /* keep the current step */
    }
    setPhase(null);
  };

  const submitPan = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const pan = String(new FormData(event.currentTarget).get("pan") ?? "");
    setDraft((current) => ({ ...current, pan }));
    const extra = referralBody();
    if (extra) void run("pan", () => api.post("/kyc/verify", { pan, ...extra }));
  };

  const submitDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const details = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]));
    setDraft((current) => ({ ...current, ...details }));
    const extra = referralBody();
    if (extra) void run("details", () => api.post("/profile/manual", { ...details, ...extra }));
  };

  const referralField = (
    <div>
      <label htmlFor="referral" className={labelClass}>
        Referral code <span className="font-normal text-[#71867a]">(optional)</span>
      </label>
      <div
        className={`mt-1.5 flex h-11 items-center rounded-xl border border-[#d8e2dc] dark:border-[#1e3829] ${
          referralLocked ? "bg-[#f3f6f4] dark:bg-[#0c1a12]" : "bg-white focus-within:border-emerald-500 dark:bg-[#07120b]"
        }`}
      >
        <span className="border-r border-[#e5ece7] px-3 text-xs font-bold text-[#556b5e] dark:border-[#1e3829] dark:text-[#8ba295]">+91</span>
        {/* No name attribute: sent as { referral: {...} }, not as a form field. Locked (from a QR code): shows the
            agent's number, but sends what the QR code carried. */}
        <input
          id="referral"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          value={referralLocked ? qrMobile : referral}
          readOnly={referralLocked}
          onChange={(e) => setReferral(e.target.value.replace(/\D/g, ""))}
          placeholder="Mobile number of who referred you"
          aria-describedby="referral-help"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-xs font-semibold outline-none placeholder:font-normal dark:text-white"
        />
        {referralLocked && <Lock className="mr-3 size-4 shrink-0 text-[#71867a]" aria-label="Locked" />}
      </div>
      {referralLocked && referrerName && (
        <p className="mt-1.5 text-xs font-semibold text-[#216b49] dark:text-emerald-400">
          Referred by {referrerName}
        </p>
      )}
      <p id="referral-help" className="mt-1 text-[11px] text-[#71867a] dark:text-[#8ba295]">
        {referralLocked ? "Added from the QR code you scanned." : "Were you referred? Enter their mobile number."}
      </p>
    </div>
  );

  const sendAltOtp = async (mobile: string) => {
    setError(null);
    setAltBusy(true);
    try {
      const { data } = await api.post("/credit/bureau-mobile/request-otp", { mobile });
      setAlt({ mobile, transactionId: data.transactionId, devOtp: data.devOtp });
    } catch (requestError) {
      showError(requestError);
    } finally {
      setAltBusy(false);
    }
  };

  const submitAltMobile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const mobile = String(new FormData(event.currentTarget).get("altMobile") ?? "").replace(/\D/g, "");
    if (!/^[6-9]\d{9}$/.test(mobile)) return setError({ code: "", message: "Enter a valid 10-digit mobile number", actions: [] });
    void sendAltOtp(mobile);
  };

  const submitAltOtp = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const otp = String(new FormData(event.currentTarget).get("altOtp") ?? "");
    void run("altMobile", async () => {
      try {
        await api.post("/credit/bureau-mobile/verify", { transactionId: alt.transactionId, otp });
      } catch (requestError) {
        // Lockout or a dead OTP: start the number step again.
        const code = apiErrorCode(requestError);
        if (code === "OTP_ATTEMPTS_EXCEEDED" || code === "OTP_EXPIRED" || code === "OTP_ALREADY_USED") setAlt({ mobile: alt.mobile });
        throw requestError;
      }
    });
  };

  const confirmNoHistory = () => void run("noHistory", () => api.post("/credit/no-history"), false);

  const showPan = workflow.stage === "PROFILE" && view === "main";
  const showReportActions = workflow.stage === "REPORT" && view === "main";
  const header = busy
    ? { icon: LoaderCircle, title: PHASE_TITLES[phase], text: phase === "report" ? "Checking Experian, then CRIF High Mark if needed. This can take up to a minute; please keep this window open." : "" }
    : view === "details"
      ? { icon: UserRound, title: "Your name as on PAN", text: "Credit bureaus match your record on your full name and mobile number, so enter it exactly as printed on your PAN." }
      : view === "altMobile"
        ? { icon: Smartphone, title: "Try another mobile number", text: "Bureaus find your record using the mobile number you gave your bank or lender. We'll verify it with an OTP first." }
        : showPan
          ? { icon: ShieldCheck, title: "Enter your PAN", text: "We fetch your name from your PAN, then your credit report from the bureaus." }
          : { icon: RefreshCw, title: error ? "We couldn't fetch your credit report" : "Fetch your credit report", text: "" };

  return (
    <div>
      <span className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
        <header.icon className={`size-5 ${busy ? "animate-spin" : ""}`} />
      </span>
      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
        Step {workflow.stage === "PROFILE" && phase !== "report" ? 2 : 3} of 3
      </p>
      <h2 id="login-title" className="mt-1 text-xl font-bold tracking-tight text-[#0c1a13] dark:text-white">
        {header.title}
      </h2>
      {header.text && <p className="mt-1 text-xs text-[#5c7366] dark:text-[#8ba295]" aria-live="polite">{header.text}</p>}
      {workflow.mobileLast4 && !busy && (
        <p className="mt-3 text-[11px] text-[#71867a] dark:text-[#8ba295]">
          Signed in as +91 ••••••{workflow.mobileLast4} ·{" "}
          <button type="button" onClick={restartLogin} className="font-bold text-emerald-700 hover:underline dark:text-emerald-400">
            Use a different number
          </button>
        </p>
      )}

      {error && !busy && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{error.message}</span>
        </div>
      )}

      {busy && (
        <div className="mt-6 flex items-center gap-3 text-xs text-[#5d7367] dark:text-[#8ba295]">
          <LoaderCircle className="size-5 animate-spin text-emerald-600" />
          <span>Please wait…</span>
        </div>
      )}

      {/* Step 1: PAN */}
      {showPan && !busy && (
        <form onSubmit={submitPan} className="mt-6">
          <label htmlFor="pan" className={labelClass}>PAN</label>
          <input
            id="pan"
            required
            autoFocus
            name="pan"
            pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
            title="10 characters, e.g. ABCDE1234F"
            maxLength={10}
            autoComplete="off"
            defaultValue={draft.pan ?? ""}
            onInput={(e) => (e.currentTarget.value = e.currentTarget.value.toUpperCase())}
            placeholder="ABCDE1234F"
            className={`${inputClass} px-4 font-mono text-sm uppercase tracking-wider`}
          />
          <div className="mt-4">{referralField}</div>
          {(!error || error.actions.includes("retry")) && (
            <button type="submit" className={`mt-5 ${primaryButton}`}>
              {error ? "Try again" : "Verify PAN"} <ArrowRight className="size-4" />
            </button>
          )}
          {error?.actions.includes("relogin") && (
            <button type="button" onClick={restartLogin} className={`mt-3 ${secondaryButton}`}>
              Log in with a different mobile number
            </button>
          )}
          {/* When PAN can't be verified at all, entering the name is the main action, not a footnote */}
          {error?.actions.includes("details") && !error.actions.includes("retry") ? (
            <button type="button" onClick={() => switchView("details")} className={`mt-5 ${primaryButton}`}>
              Enter my name as on PAN <ArrowRight className="size-4" />
            </button>
          ) : (
            <button type="button" onClick={() => switchView("details")} className={`mt-4 w-full text-center ${linkButton}`}>
              Don’t have your PAN handy? Enter your name as on PAN
            </button>
          )}
        </form>
      )}

      {/* Name as on PAN (no PAN, PAN not found, or correcting the name after "no record") */}
      {view === "details" && !busy && (
        <form onSubmit={submitDetails} className="mt-6 grid gap-3">
          <label className={labelClass}>
            First name
            <input required name="firstName" autoComplete="given-name" defaultValue={draft.firstName ?? workflow.profile?.firstName ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Middle and last name <span className="font-normal text-[#71867a]">(as on PAN)</span>
            <input name="lastName" autoComplete="family-name" defaultValue={draft.lastName ?? workflow.profile?.lastName ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Date of birth <span className="font-normal text-[#71867a]">(optional)</span>
            <input type="date" name="dateOfBirth" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} defaultValue={draft.dateOfBirth ?? workflow.profile?.dateOfBirth ?? ""} className={inputClass} />
          </label>
          <label className={labelClass}>
            Email <span className="font-normal text-[#71867a]">(optional)</span>
            <input type="email" name="email" autoComplete="email" defaultValue={draft.email ?? workflow.profile?.email ?? ""} className={inputClass} />
          </label>
          {referralField}
          <button type="submit" className={`mt-2 ${primaryButton}`}>
            Fetch my credit report <ArrowRight className="size-4" />
          </button>
          <button type="button" onClick={() => switchView("main")} className={`mt-1 ${linkButton}`}>
            {workflow.stage === "PROFILE" ? "I have my PAN, verify with PAN instead" : "Back"}
          </button>
        </form>
      )}

      {/* Alternate mobile: number -> OTP -> report */}
      {view === "altMobile" && !busy && (
        alt.transactionId ? (
          <form onSubmit={submitAltOtp} className="mt-6 grid gap-3">
            <label className={labelClass}>
              OTP sent to +91 ••••••{alt.mobile.slice(-4)}
              <input
                required
                autoFocus
                name="altOtp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                placeholder="••••••"
                className={`${inputClass} text-center text-lg font-bold tracking-[0.4em]`}
              />
            </label>
            {alt.devOtp && (
              <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                Test Mode OTP: <strong className="font-mono">{alt.devOtp}</strong>
              </p>
            )}
            <button type="submit" className={`mt-2 ${primaryButton}`}>
              Verify and fetch my report <ArrowRight className="size-4" />
            </button>
            <div className="flex justify-between">
              <button type="button" onClick={() => { setAlt({ mobile: alt.mobile }); setError(null); }} className={linkButton}>
                Change number
              </button>
              <button type="button" disabled={altBusy} onClick={() => void sendAltOtp(alt.mobile)} className={linkButton}>
                Resend OTP
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={submitAltMobile} className="mt-6 grid gap-3">
            <label className={labelClass}>
              Mobile number registered with your bank or lender
              <div className="mt-1.5 flex h-11 items-center rounded-xl border border-[#d8e2dc] bg-white focus-within:border-emerald-500 dark:border-[#1e3829] dark:bg-[#07120b]">
                <span className="border-r border-[#e5ece7] px-3 text-xs font-bold text-[#556b5e] dark:border-[#1e3829] dark:text-[#8ba295]">+91</span>
                <input
                  required
                  autoFocus
                  name="altMobile"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  defaultValue={alt.mobile}
                  placeholder="10-digit mobile number"
                  className="h-full min-w-0 flex-1 bg-transparent px-3 text-xs font-semibold outline-none dark:text-white"
                />
              </div>
            </label>
            <button type="submit" disabled={altBusy} className={`mt-2 ${primaryButton}`}>
              {altBusy ? <LoaderCircle className="size-4 animate-spin" /> : null} Send OTP
            </button>
            <button type="button" onClick={() => switchView("main")} className={linkButton}>
              Back
            </button>
          </form>
        )
      )}

      {/* Step 2: report options, depending on why the last attempt failed */}
      {showReportActions && !busy && (
        <div className="mt-6 grid gap-3">
          {(!error || error.actions.includes("retry")) && (
            <button type="button" onClick={() => void run("report")} className={primaryButton}>
              <RefreshCw className="size-4" /> {error ? "Try again" : "Fetch my credit report"}
            </button>
          )}
          {error?.actions.includes("altMobile") && (
            <button type="button" onClick={() => switchView("altMobile")} className={primaryButton}>
              <Smartphone className="size-4" /> Try another mobile number
            </button>
          )}
          {error?.actions.includes("details") && (
            <button type="button" onClick={() => switchView("details")} className={secondaryButton}>
              Edit my name as on PAN
            </button>
          )}
          {error?.actions.includes("noHistory") && (
            <button type="button" onClick={confirmNoHistory} className={linkButton}>
              I don’t have another number, or I’ve never had a loan or credit card
            </button>
          )}
          {error?.actions.includes("relogin") && (
            <button type="button" onClick={restartLogin} className={secondaryButton}>
              Log in again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
