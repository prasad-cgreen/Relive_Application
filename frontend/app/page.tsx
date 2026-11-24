"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  FileSearch,
  Fingerprint,
  Info,
  LockKeyhole,
  Menu,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_TEL } from "../lib/contact";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { HeroCarousel } from "../components/hero-carousel";
import { OnboardingFlow, type Workflow } from "../components/onboarding-flow";
import { preloadTurnstile, Turnstile, TURNSTILE_SITE_KEY, type CaptchaState } from "../components/turnstile";
import { api, apiErrorCode, apiMessage, apiRetryAfter } from "../lib/api";
import { getSession, setSignedInHint, type Session } from "../lib/session";

type LoginStep = "mobile" | "otp" | "onboarding";

// Bump when the consent text below changes: the backend stores which version each user agreed to.
const CONSENT_VERSION = "relive-consent-v3"; // v3: links to the full Terms and Privacy Policy, adds the AI summary

// Same list the backend accepts (CONCERN_OPTIONS in @relive/shared); the answers personalise the dashboard summary.
const concerns = [
  "I am struggling with overdue payments",
  "I want to explore closing my debts",
  "My monthly repayments are too high",
  "Something in my report looks wrong",
  "I need help speaking to my lenders",
  "I am not sure where to start",
];

const steps = [
  {
    title: "Tell us what is weighing on you",
    text: "Choose your main concern, then verify your mobile number and PAN. It takes about three minutes.",
  },
  {
    title: "See your debt clearly",
    text: "We fetch your credit report with a soft enquiry, so your score is not affected, and arrange your accounts by what needs attention first.",
  },
  {
    title: "Get help moving forward",
    text: "Request a call from the Relive team about any account, and prepare for the conversation with your lender.",
  },
];

const trust = ["No impact on your credit score", "About three minutes", "Real people to help"];

const privacyPoints = [
  { icon: LockKeyhole, title: "Encrypted end to end", text: "Your data is encrypted in transit and at rest." },
  { icon: ShieldCheck, title: "Your consent, every time", text: "We only fetch your report with your explicit, time-stamped consent." },
  { icon: BadgeCheck, title: "Never sold", text: "We do not sell your data to telemarketers or lenders." },
  { icon: FileSearch, title: "Full audit trail", text: "Every access to your report is logged." },
];

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Relive home">
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, nothing for next/image to optimise */}
      <img src="/relive-logo.svg" alt="Relive" width={112} height={32} className="h-7 w-auto sm:h-8 dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/relive-logo-light.svg" alt="Relive" width={112} height={32} className="hidden h-7 w-auto sm:h-8 dark:block" />
    </Link>
  );
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState<LoginStep>("mobile");
  const [mobile, setMobile] = useState("");
  const [consent, setConsent] = useState(false);
  const [consentExpanded, setConsentExpanded] = useState(false);
  const [mobileError, setMobileError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [seconds, setSeconds] = useState(10);
  const [transactionId, setTransactionId] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [captcha, setCaptcha] = useState<CaptchaState>({ token: "", failed: false });
  const [captchaRound, setCaptchaRound] = useState(0); // re-keys <Turnstile> for a fresh single-use token
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  // ponytail: landing-form answers stay client-side; send them with the OTP/workflow call once the backend has a field for them.
  const [concern, setConcern] = useState("");
  const [concernDetails, setConcernDetails] = useState("");
  const [sessionNotice, setSessionNotice] = useState("");

  // The dialog closes only via its Close button or on success: no outside click / Escape, so a stray
  // click or key press can't throw away a half-entered OTP or PAN.
  useEffect(() => {
    if (!loginOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [loginOpen]);

  useEffect(preloadTurnstile, []);

  // Unfinished onboarding is kept in the URL, so a refresh reopens the dialog at the saved step.
  useEffect(() => {
    if (loginOpen && step === "onboarding" && !window.location.search.includes("onboarding=1")) {
      window.history.replaceState(null, "", "/?onboarding=1");
    }
  }, [loginOpen, step]);

  useEffect(() => {
    if (!loginOpen || step !== "otp" || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [loginOpen, seconds, step]);

  // replace, not assign: the landing page must not sit in history behind the dashboard, or Back returns to it.
  const goToPortal = () => {
    document.documentElement.setAttribute("data-auth-check", ""); // keep the landing page hidden while leaving
    window.location.replace("/portal");
  };

  // The "What brings you to Relive" answers (selected_concern, customer_text), saved once signed in.
  // Best effort: a failure only means the dashboard summary isn't personalised, so it never blocks login.
  const saveConcern = async () => {
    const customer_text = concernDetails.trim();
    if (!concern && !customer_text) return;
    try {
      await api.post("/concern", { selected_concern: concern ? [concern] : [], customer_text });
    } catch {
      /* ignore */
    }
  };

  // Signed-in users skip the mobile step: straight to the dashboard, or back into onboarding.
  const resumeSession = async () => {
    try {
      // Ask /auth/session first: probing /workflow while signed out writes a 401 into the audit log.
      if (!(await getSession()).authenticated) return false;
      await saveConcern();
      const { data } = await api.get<Workflow>("/workflow");
      if (data.stage === "DASHBOARD") return goToPortal();
      setWorkflow(data);
      setStep("onboarding");
      setLoginOpen(true);
      return true;
    } catch {
      return false; // not signed in
    }
  };

  const openLogin = () => {
    setMenuOpen(false);
    void resumeSession().then((resumed) => resumed || setLoginOpen(true));
  };

  /**
   * Route guard: members who reached the dashboard never see the landing page (including via Back or a
   * back/forward-cache restore); they go straight to /portal. Returns the session, or null if unknown.
   */
  const guardLanding = async () => {
    let session: Session | null = null;
    try {
      session = await getSession();
    } catch {
      /* API unreachable: show the landing page */
    }
    if (session?.authenticated && session.stage === "DASHBOARD") {
      goToPortal();
      return null;
    }
    if (session && !session.authenticated) setSignedInHint(false);
    document.documentElement.removeAttribute("data-auth-check");
    return session;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    void guardLanding().then((session) => {
      if (!session) return; // redirecting, or API unreachable
      if (params.has("expired")) setSessionNotice("Your session has expired. Please log in again to continue.");
      // ?login=1: after logout, session expiry or "Use a different number". ?onboarding=1: /portal or a refresh mid-onboarding.
      if (params.has("login") || params.has("onboarding")) {
        if (session.authenticated) void resumeSession();
        else setLoginOpen(true);
      }
      if (params.has("login") || params.has("expired") || (params.has("onboarding") && !session.authenticated)) {
        window.history.replaceState(null, "", "/");
      }
    });
    const onPageShow = (event: PageTransitionEvent) => event.persisted && void guardLanding();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per page load
  }, []);

  const closeLogin = () => {
    setLoginOpen(false);
    setSessionNotice("");
    if (window.location.search) window.history.replaceState(null, "", "/");
    window.setTimeout(() => {
      setStep("mobile");
      setOtp("");
      setOtpError("");
    }, 200);
  };

  // Why an OTP can't be sent yet ("" = ready): the Cloudflare bot check has no token.
  const captchaBlocker = () =>
    !TURNSTILE_SITE_KEY || captcha.token
      ? ""
      : captcha.failed
        ? "The security check could not load. Check your connection and refresh the page."
        : "Finishing a quick security check. If you see a \"Verify you are human\" box, tick it, then try again.";

  const requestOtp = async (number: string) => {
    try {
      const response = await api.post("/auth/request-otp", { mobile: number, consent: true, consentVersion: CONSENT_VERSION, turnstileToken: captcha.token || undefined });
      setTransactionId(response.data.transactionId);
      setDevOtp(response.data.devOtp ?? "");
      setSeconds(response.data.resendAfterSeconds ?? 10);
      setStep("otp");
    } finally {
      // Turnstile tokens are single-use: fetch a fresh one for the next send or resend.
      if (TURNSTILE_SITE_KEY) {
        setCaptcha({ token: "", failed: false });
        setCaptchaRound((round) => round + 1);
      }
    }
  };

  // Lockout sends the user back to the mobile step (per the login flow); other errors stay inline.
  const handleOtpError = (error: unknown, showError: (message: string) => void) => {
    const code = apiErrorCode(error);
    if (code === "OTP_ATTEMPTS_EXCEEDED") {
      setStep("mobile");
      setOtp("");
      setMobileError(apiMessage(error));
      return;
    }
    if (code === "RESEND_TOO_SOON") setSeconds(apiRetryAfter(error) ?? 10);
    if (code === "OTP_EXPIRED" || code === "OTP_ALREADY_USED" || code === "OTP_TRANSACTION_NOT_FOUND") setSeconds(0);
    showError(apiMessage(error));
  };

  const submitMobile = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = mobile.replace(/\D/g, "");
    setMobileError("");
    setConsentError("");
    if (!normalized) return setMobileError("Mobile number is required");
    if (!/^[6-9]\d{9}$/.test(normalized)) return setMobileError("Enter a valid 10-digit mobile number");
    if (!consent) return setConsentError("Consent is required to proceed");
    if (captchaBlocker()) return setMobileError(captchaBlocker());
    setMobile(normalized);
    setBusy(true);
    try {
      await requestOtp(normalized);
    } catch (error) {
      handleOtpError(error, setMobileError);
    } finally {
      setBusy(false);
    }
  };

  const submitOtp = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(otp)) return setOtpError("Enter the 6-digit OTP");
    setOtpError("");
    setBusy(true);
    try {
      const { data } = await api.post<Workflow>("/auth/verify-otp", { transactionId, otp });
      await saveConcern();
      if (data.stage === "DASHBOARD") return goToPortal(); // existing user with a current report
      setWorkflow(data);
      setStep("onboarding");
      setBusy(false);
    } catch (error) {
      setOtp("");
      handleOtpError(error, setOtpError);
      setBusy(false);
    }
  };

  const resendOtp = async () => {
    if (seconds > 0 || busy) return;
    if (captchaBlocker()) return setOtpError(captchaBlocker());
    setBusy(true);
    setOtp("");
    setOtpError("");
    try {
      await requestOtp(mobile);
    } catch (error) {
      handleOtpError(error, setOtpError);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="landing-root min-h-screen overflow-hidden bg-[#f8faf9] text-[#0c1a13] transition-colors dark:bg-[#070e0a] dark:text-[#f0fdf4]">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#e5ede7] bg-white/90 backdrop-blur-md dark:border-[#14261c] dark:bg-[#070e0a]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8 md:h-20">
          <Brand />

          <nav className="hidden items-center gap-8 text-sm font-medium text-[#4f6358] md:flex dark:text-[#90a89b]" aria-label="Main navigation">
            <a href="#how-it-works" className="transition hover:text-[#216b49] dark:hover:text-emerald-400">
              How it works
            </a>
            <a href="#security" className="transition hover:text-[#216b49] dark:hover:text-emerald-400">
              Security
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <button
              onClick={openLogin}
              className="h-10 rounded-xl border border-[#d2ded6] px-4 text-sm font-semibold text-[#183b2f] transition hover:bg-[#f1f6f3] dark:border-[#1a3827] dark:text-white dark:hover:bg-[#0e2116]"
            >
              Log in
            </button>
            <a
              href="#start"
              className="group inline-flex h-10 items-center gap-2 rounded-xl bg-[#216b49] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155438] dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
            >
              Get started
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setMenuOpen((value) => !value)}
              className="grid size-9 place-items-center rounded-xl border border-[#d2ded6] text-[#4d6356] dark:border-[#1a3827] dark:text-[#a0b8ab]"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {menuOpen && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200 border-t border-[#e2ebe4] bg-white px-5 pb-5 pt-2 shadow-lg shadow-black/5 md:hidden dark:border-[#14261c] dark:bg-[#070e0a]">
            <nav className="mx-auto flex max-w-7xl flex-col text-sm font-medium text-[#35483d] dark:text-[#c3d6cb]">
              {[
                ["#how-it-works", "How it works"],
                ["#security", "Security"],
              ].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between border-b border-[#eef3f0] py-3.5 dark:border-[#14261c]"
                >
                  {label}
                  <ChevronRight className="size-4 text-[#9aaba1]" aria-hidden="true" />
                </a>
              ))}
              <a
                href="#start"
                onClick={() => setMenuOpen(false)}
                className="mt-4 grid h-12 w-full place-items-center rounded-xl bg-[#216b49] text-sm font-semibold text-white transition hover:bg-[#155438] dark:bg-emerald-500 dark:text-[#07130c]"
              >
                Get started
              </a>
              <button
                onClick={openLogin}
                className="mt-2.5 h-12 w-full rounded-xl border border-[#d2ded6] text-sm font-semibold text-[#183b2f] transition hover:bg-[#f1f6f3] dark:border-[#1a3827] dark:text-white"
              >
                Log in
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero: intro + concern form */}
      {/* Fills exactly one screen below the 5rem header on desktop */}
      <section className="relative overflow-hidden py-8 lg:flex lg:min-h-[calc(100svh-5rem)] lg:items-center lg:py-6">
        {/* Glow ambient background accents */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-emerald-400/10 blur-[120px] dark:bg-emerald-500/10" />

        <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-8 px-4 sm:px-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-6 xl:items-stretch 2xl:max-w-[1500px]">
          {/* Hero slides (text + photo, changing together) with the trust points under them. Left 60% on desktop, the form the
              narrower 40%; full width above the form on phones and tablets */}
          <HeroCarousel className="animate-in fade-in slide-in-from-bottom-3 min-w-0 duration-500 lg:self-stretch">
            <ul className="mt-4 flex flex-col gap-2 text-xs font-medium text-[#3f5447] sm:text-[clamp(0.75rem,2cqw,0.9375rem)] lg:text-xs xl:text-[clamp(0.75rem,2cqw,0.9375rem)]">
              {trust.map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 stroke-[3] text-emerald-600" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </HeroCarousel>

          {/* Concern form: every field optional; submitting starts the normal login/signup flow */}
          <form
            id="start"
            onSubmit={(e) => {
              e.preventDefault();
              openLogin();
            }}
            className="animate-in fade-in slide-in-from-bottom-3 fill-mode-both delay-150 duration-500 relative scroll-mt-24 rounded-[22px] border border-[#d9e3d3] bg-white p-5 shadow-[0_10px_35px_rgba(28,62,44,0.06)] sm:px-6 sm:py-5 xl:flex xl:flex-col dark:border-[#162a1f] dark:bg-[#0c1a12]"
          >
            <span className="absolute -top-px left-7 h-[3px] w-12 rounded-full bg-[#8db66b]" aria-hidden="true" />
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400">Your starting point</p>
              <span className="rounded-full border border-[#e7ecdf] bg-[#f2f5ee] px-2.5 py-0.5 text-[10px] text-[#63776b] dark:border-[#1a3827] dark:bg-[#07120b] dark:text-[#8ba295]">
                Step 1 of 3
              </span>
            </div>

            <fieldset className="mt-3">
              <legend className="text-[17px] font-semibold tracking-tight text-[#183b2f] dark:text-white">What brings you to Relive today?</legend>
              <p className="mt-0.5 text-xs text-[#63776b] dark:text-[#8ba295]">Choose what fits best. You do not need to have all the answers.</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {concerns.map((option) => (
                  <label
                    key={option}
                    className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-[#e0e7dc] px-3 py-2 text-xs font-medium leading-snug text-[#465a50] transition hover:border-[#b8cdb0] hover:bg-[#f7faf3] has-[:checked]:border-[#709e60] has-[:checked]:bg-[#edf5e7] has-[:checked]:text-[#183b2f] dark:border-[#1a3827] dark:text-[#c3d6cb] dark:hover:bg-[#0e2116] dark:has-[:checked]:border-emerald-500 dark:has-[:checked]:bg-emerald-950/40"
                  >
                    <input
                      type="radio"
                      name="concern"
                      value={option}
                      checked={concern === option}
                      onChange={() => setConcern(option)}
                      className="size-4 shrink-0 accent-emerald-700"
                    />
                    {option}
                  </label>
                ))}
              </div>
            </fieldset>

            <label htmlFor="concern-details" className="mt-3.5 block text-xs font-semibold text-[#183b2f] dark:text-white">
              Tell us in your own words <span className="ml-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Optional</span>
            </label>
            <textarea
              id="concern-details"
              rows={2}
              value={concernDetails}
              onChange={(e) => setConcernDetails(e.target.value)}
              placeholder="For example: I want to close my debts, but I do not know which lender to approach first."
              maxLength={800}
              className="mt-1.5 block w-full resize-y rounded-[10px] border border-[#dce5d8] bg-white px-3.5 py-2.5 text-xs xl:min-h-16 xl:flex-1 leading-relaxed outline-none transition placeholder:text-[#a3b8ad] focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 dark:border-[#1e3829] dark:bg-[#07120b] dark:text-white dark:focus:ring-emerald-950"
            />

            <div className="mt-4 grid gap-2">
              <button
                type="submit"
                className="group inline-flex h-11 w-full items-center justify-between rounded-[10px] bg-[#216b49] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#155438] dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
              >
                Get my credit report
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </button>
              <Link
                href="/privacy-policy"
                className="inline-flex items-center justify-center gap-1.5 text-xs text-[#465a50] underline-offset-4 hover:underline dark:text-[#a0b8ab]"
              >
                How my information is used
                <Info className="size-3.5" aria-hidden="true" />
              </Link>
            </div>
          </form>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-t border-[#e5ece7] bg-white py-14 sm:py-20 dark:border-[#14261c] dark:bg-[#09150f]">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="reveal max-w-2xl">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              A practical path forward
            </p>
            <h2 className="mt-3 text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#183b2f] sm:text-4xl dark:text-white">How Relive works</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#4f6358] sm:text-base dark:text-[#8ba295]">
              From the first worry to a clear next step. No passwords, no unwanted agent calls, no hidden sign-ups.
            </p>
          </div>

          {/* Numbered steps joined by a line: down the left on phones, across on larger screens */}
          <ol className="mt-10 grid gap-8 sm:mt-12 md:grid-cols-3 md:gap-8">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="reveal relative pl-14 not-last:after:absolute not-last:after:-bottom-6 not-last:after:left-5 not-last:after:top-12 not-last:after:w-px not-last:after:bg-[#d5e2cd] md:pl-0 md:not-last:after:-right-4 md:not-last:after:bottom-auto md:not-last:after:left-14 md:not-last:after:top-5 md:not-last:after:h-px md:not-last:after:w-auto dark:not-last:after:bg-[#1a3827]"
              >
                <span className="absolute left-0 top-0 grid size-10 place-items-center rounded-full border border-[#cbdcc1] bg-[#edf3e6] text-sm font-semibold text-[#216b49] md:static dark:border-[#1e3829] dark:bg-emerald-950 dark:text-emerald-300">
                  {i + 1}
                </span>
                <h3 className="text-base font-semibold text-[#183b2f] md:mt-5 dark:text-white">{step.title}</h3>
                <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-[#5c7366] dark:text-[#8ba295]">{step.text}</p>
              </li>
            ))}
          </ol>

          <aside className="reveal mt-12 flex flex-col gap-5 rounded-2xl bg-[#163e2d] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8 dark:bg-[#0c1a12] dark:ring-1 dark:ring-[#1a3827]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#c4dba6]">One step at a time</p>
              <p className="mt-2 max-w-2xl text-lg leading-snug text-[#f0f7e9] sm:text-xl">
                You do not have to decide which lender to pay first today. <strong className="font-semibold text-[#d5e9b9]">Start by understanding your situation.</strong>
              </p>
            </div>
            <a
              href="#start"
              className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#d5e9b9] px-5 text-sm font-semibold text-[#193e29] transition hover:bg-[#e3f1ce]"
            >
              Let&rsquo;s get started
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
            </a>
          </aside>
        </div>
      </section>

      {/* Security & privacy */}
      <section id="security" className="scroll-mt-20 border-t border-[#e5ece7] py-14 sm:py-20 dark:border-[#14261c]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
          <div className="reveal">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Security &amp; privacy
            </p>
            <h2 className="mt-3 text-balance text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#183b2f] sm:text-4xl dark:text-white">
              Your financial privacy is non-negotiable
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#4f6358] sm:text-base dark:text-[#8ba295]">
              Debt is personal. Your report and what you tell us are used only to help you, and only with your permission.
            </p>
          </div>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {privacyPoints.map(({ icon: Icon, title, text }) => (
              <li key={title} className="reveal flex gap-3.5 rounded-2xl border border-[#e1e9e4] bg-white p-4 sm:p-5 dark:border-[#162a1f] dark:bg-[#0c1a12]">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f1e2] text-[#216b49] dark:bg-emerald-950 dark:text-emerald-300">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[#183b2f] dark:text-white">{title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#5c7366] dark:text-[#8ba295]">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e5ece7] bg-white dark:border-[#14261c] dark:bg-[#070e0a]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="max-w-sm">
              <Brand />
              <p className="mt-3 text-sm leading-relaxed text-[#5c7366] dark:text-[#8ba295]">
                Relive helps you understand your debt and find a practical way forward.
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#216b49] hover:underline dark:text-emerald-400">
                  {SUPPORT_EMAIL}
                </a>
                <a href={`tel:${SUPPORT_TEL}`} className="whitespace-nowrap text-[#216b49] hover:underline dark:text-emerald-400">
                  {SUPPORT_PHONE}
                </a>
              </div>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-2.5 text-sm text-[#4f6358] sm:flex sm:gap-8 dark:text-[#a0b8ab]">
              <a href="#how-it-works" className="hover:text-[#216b49] dark:hover:text-emerald-400">How it works</a>
              <a href="#security" className="hover:text-[#216b49] dark:hover:text-emerald-400">Security</a>
              <Link href="/privacy-policy" className="hover:text-[#216b49] dark:hover:text-emerald-400">Privacy Policy</Link>
              <Link href="/terms-conditions" className="hover:text-[#216b49] dark:hover:text-emerald-400">Terms of Service</Link>
            </nav>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-t border-[#eef3f0] pt-6 text-xs text-[#6e8577] md:flex-row md:justify-between dark:border-[#14261c] dark:text-[#8ba295]">
            <p>© 2026 Relive Inc. All rights reserved.</p>
            <p className="max-w-xl md:text-right">
              Relive does not guarantee a settlement, reduced dues or a score increase. Any arrangement needs your lender&rsquo;s approval.
            </p>
          </div>
        </div>
      </footer>

      {/* Auth / OTP Modal: clicking the backdrop does nothing; only the Close button (or success) closes it */}
      {loginOpen && (
        <div className="animate-in fade-in duration-200 fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-xs sm:place-items-center sm:p-5">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            className="animate-in slide-in-from-bottom-10 duration-300 sm:fade-in sm:zoom-in-95 sm:slide-in-from-bottom-0 relative max-h-[100dvh] w-full max-w-[440px] overflow-y-auto overscroll-contain rounded-t-[26px] bg-white p-6 shadow-2xl sm:rounded-[26px] sm:p-8 dark:bg-[#0c1a12] dark:border dark:border-[#162a1f]"
          >
            {/* Close button sits in the corner, so every step uses the full dialog width */}
            <button
              type="button"
              onClick={closeLogin}
              className="absolute right-4 top-4 grid size-8 place-items-center rounded-lg text-[#687e71] hover:bg-black/5 sm:right-6 sm:top-6 dark:text-[#8ba295] dark:hover:bg-white/5"
              aria-label="Close dialog"
            >
              <X className="size-4" />
            </button>
            {step === "onboarding" && workflow ? (
              <OnboardingFlow initial={workflow} onComplete={goToPortal} />
            ) : (
              <div className="pr-10">
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {step === "otp" ? (
                    <Fingerprint className="size-5" />
                  ) : (
                    <LockKeyhole className="size-5" />
                  )}
                </span>
                {/* Journey: 1 verify mobile (this screen + OTP), 2 PAN, 3 credit report (OnboardingFlow) */}
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Step 1 of 3</p>
                <h2 id="login-title" className="mt-1 text-xl font-bold tracking-tight text-[#0c1a13] dark:text-white">
                  {step === "mobile" ? "Welcome to Relive" : "Verify It’s You"}
                </h2>
                <p className="mt-1 text-xs text-[#5c7366] dark:text-[#8ba295]">
                  {step === "mobile"
                    ? "Enter the mobile number linked to your PAN. New here? We'll set you up."
                    : `Enter the 6-digit OTP sent to +91 ••••••${mobile.slice(-4)}`}
                </p>
                {sessionNotice && step === "mobile" && (
                  <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
                    {sessionNotice}
                  </p>
                )}
              </div>
            )}

            {/* Mobile Input Form */}
            {step === "mobile" && (
              <form onSubmit={submitMobile} className="mt-6" noValidate>
                <label htmlFor="mobile" className="text-xs font-bold text-[#35483d] dark:text-[#a0b8ab]">
                  Mobile number (as linked to your PAN)
                </label>
                <div
                  className={`mt-1.5 flex h-12 items-center rounded-xl border bg-white transition focus-within:ring-3 dark:bg-[#07120b] ${
                    mobileError
                      ? "border-red-400 focus-within:ring-red-100 dark:border-red-600"
                      : "border-[#d8e2dc] focus-within:border-emerald-500 focus-within:ring-emerald-100 dark:border-[#1e3829] dark:focus-within:ring-emerald-950"
                  }`}
                >
                  <span className="border-r border-[#e5ece7] px-3.5 text-xs font-bold text-[#556b5e] dark:border-[#1e3829] dark:text-[#8ba295]">
                    +91
                  </span>
                  <input
                    id="mobile"
                    autoFocus
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value.replace(/\D/g, ""));
                      setMobileError("");
                    }}
                    className="h-full min-w-0 flex-1 bg-transparent px-3 text-xs font-semibold outline-none placeholder:text-[#a3b8ad] dark:text-white"
                    placeholder="10-digit mobile number"
                    aria-invalid={Boolean(mobileError)}
                  />
                </div>
                {mobileError && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{mobileError}</p>}

                {/* Consent: one checkbox, short summary; full purposes behind "View details" */}
                <div
                  className={`mt-4 rounded-xl border bg-[#f8faf9] dark:bg-[#08150f] ${
                    consentError ? "border-red-300 dark:border-red-800" : "border-[#e5ede8] dark:border-[#162a1f]"
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-3 p-3.5">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => {
                        setConsent(e.target.checked);
                        setConsentError("");
                      }}
                      aria-describedby="consent-details"
                      className="mt-0.5 size-4 shrink-0 cursor-pointer rounded accent-emerald-600"
                    />
                    <span className="text-xs leading-5 text-[#3f5447] dark:text-[#a0b8ab]">
                      I agree to the{" "}
                      <Link href="/terms-conditions" target="_blank" className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
                        Terms of Use
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy-policy" target="_blank" className="font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400">
                        Privacy Policy
                      </Link>
                      , and consent to Relive fetching my credit report and contacting me.
                    </span>
                  </label>

                  {consentExpanded && (
                    <ul id="consent-details" className="mx-3.5 grid gap-2.5 border-t border-[#e5ede8] py-3 text-[11px] leading-4 text-[#55695d] dark:border-[#162a1f] dark:text-[#8ba295]">
                      {(
                        [
                          [Fingerprint, "Verification", "Verify my mobile number with a one-time password (OTP)."],
                          [FileSearch, "Credit report", "Fetch my credit report from Experian and CRIF High Mark using my PAN, name and mobile number, and store it securely to show my score and insights."],
                          [ShieldCheck, "AI summary", "Use an AI service to summarise my report and what I tell Relive. My name, PAN, mobile number and account numbers are not shared with it."],
                          [Sparkles, "Communication", "Contact me by SMS, WhatsApp, email and phone about my credit health and relevant offers."],
                        ] as const
                      ).map(([Icon, title, text]) => (
                        <li key={title} className="flex gap-2.5">
                          <Icon className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                          <span>
                            <span className="font-semibold text-[#2d4236] dark:text-[#c3d6cb]">{title}.</span> {text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    type="button"
                    aria-expanded={consentExpanded}
                    aria-controls="consent-details"
                    onClick={() => setConsentExpanded((value) => !value)}
                    className="flex w-full items-center gap-1 border-t border-[#e5ede8] px-3.5 py-2 text-[11px] font-semibold text-emerald-700 hover:bg-[#f1f6f3] focus-visible:outline-2 focus-visible:outline-emerald-500 dark:border-[#162a1f] dark:text-emerald-400 dark:hover:bg-[#0c1d14] rounded-b-xl"
                  >
                    {consentExpanded ? "Hide details" : "View details"}
                    <ChevronRight className={`size-3.5 transition-transform ${consentExpanded ? "-rotate-90" : "rotate-90"}`} aria-hidden="true" />
                  </button>
                </div>
                {consentError && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{consentError}</p>}

                <div className="mt-5">
                  {/* Cloudflare bot check sits above the button; only visible if Cloudflare asks for a click */}
                  <Turnstile key={captchaRound} onChange={setCaptcha} />
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#216b49] text-sm font-semibold text-white transition hover:bg-[#155438] disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
                  >
                    {busy ? "Sending OTP..." : "Continue"}
                    {!busy && <ArrowRight className="size-4" />}
                  </button>
                </div>
              </form>
            )}

            {/* OTP Form */}
            {step === "otp" && (
              <form onSubmit={submitOtp} className="mt-6" noValidate>
                <label htmlFor="otp" className="text-xs font-bold text-[#35483d] dark:text-[#a0b8ab]">
                  Enter 6-Digit OTP
                </label>
                <input
                  id="otp"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    setOtp(e.target.value.replace(/\D/g, ""));
                    setOtpError("");
                  }}
                  className={`mt-1.5 h-13 w-full rounded-xl border bg-white px-4 text-center text-xl font-bold tracking-[0.4em] outline-none transition dark:bg-[#07120b] dark:text-white ${
                    otpError
                      ? "border-red-400 focus:ring-3 focus:ring-red-100 dark:border-red-600"
                      : "border-[#d8e2dc] focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 dark:border-[#1e3829] dark:focus:ring-emerald-950"
                  }`}
                  placeholder="••••••"
                  aria-invalid={Boolean(otpError)}
                />
                {otpError && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{otpError}</p>}

                <div className="mt-3 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setStep("mobile")}
                    className="font-semibold text-[#5a7063] hover:text-emerald-600 dark:text-[#8ba295] dark:hover:text-emerald-400"
                  >
                    Change number
                  </button>
                  {seconds > 0 ? (
                    <span className="text-[#71867a] dark:text-[#8ba295]" aria-live="polite">
                      Resend in 00:{String(seconds).padStart(2, "0")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void resendOtp()}
                      className="font-bold text-emerald-700 hover:underline disabled:opacity-60 dark:text-emerald-300"
                    >
                      Resend OTP
                    </button>
                  )}
                </div>

                <div className="mt-5">
                  {/* Fresh bot check for "Resend OTP", above the button like the mobile step */}
                  <Turnstile key={captchaRound} onChange={setCaptcha} />
                  <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#216b49] text-sm font-semibold text-white transition hover:bg-[#155438] disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
                  >
                    {busy ? "Verifying..." : "Verify & Access Report"}
                    {!busy && <ArrowRight className="size-4" />}
                  </button>
                </div>

                {devOtp && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[11px] text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Test Mode OTP: <strong className="font-mono text-emerald-950 dark:text-white">{devOtp}</strong>
                  </div>
                )}
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
