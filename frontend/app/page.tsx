"use client";

import {
  ArrowRight,
  Award,
  BadgeCheck,
  Check,
  ChevronRight,
  CreditCard,
  Eye,
  FileCheck2,
  FileSearch,
  Fingerprint,
  Gauge,
  HelpCircle,
  History,
  LockKeyhole,
  Menu,
  Percent,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { CreditScoreGauge } from "../components/credit-score-gauge";
import { ThemeToggle } from "../components/theme-toggle";
import { api, apiMessage } from "../lib/api";

type LoginStep = "mobile" | "otp" | "success";

const pillars = [
  {
    title: "Payment History",
    weight: "35% Weight",
    text: "Consistent on-time repayments across credit cards and loans form the largest single foundation of your score.",
    icon: History,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50",
  },
  {
    title: "Credit Utilization",
    weight: "30% Weight",
    text: "Keeping revolving credit balances under 30% of total available limits signals low financial distress.",
    icon: Percent,
    tone: "bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/50",
  },
  {
    title: "Credit Age",
    weight: "15% Weight",
    text: "Older accounts demonstrate an established track record and strengthen lender underwriting confidence.",
    icon: Gauge,
    tone: "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50",
  },
  {
    title: "Credit Mix & Inquiries",
    weight: "20% Weight",
    text: "A balanced ratio of secured vs unsecured borrowing with minimal hard inquiries protects score momentum.",
    icon: Sparkles,
    tone: "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/50",
  },
];

const steps = [
  {
    number: "01",
    title: "Secure OTP Authentication",
    text: "Enter your registered mobile number and confirm a one-time passcode. No passwords or sensitive tokens stored.",
    icon: Fingerprint,
  },
  {
    number: "02",
    title: "Instant Identity Verification",
    text: "Safe PAN and demographic verification directly against NSDL records with explicit, auditable user consent.",
    icon: ShieldCheck,
  },
  {
    number: "03",
    title: "Experian Bureau Insights",
    text: "Unlock your verified credit rate, open credit accounts, on-time history, and customized improvement paths.",
    icon: FileSearch,
  },
];

const features = [
  {
    title: "Real-Time Experian Bureau Sync",
    desc: "Direct integration with authorized bureau networks ensures your score and account status are always exact.",
    icon: RefreshCw,
  },
  {
    title: "Negative Account & Dispute Radar",
    desc: "Instantly detect inaccuracies, late payment flags, or fraudulent inquiries with one-click dispute assistance.",
    icon: Eye,
  },
  {
    title: "Personalized Score Simulator",
    desc: "Actionable recommendations guide you on which card balances to pay down first for maximum score impact.",
    icon: TrendingUp,
  },
  {
    title: "Zero Impact on Your Credit Score",
    desc: "All score pulls generated through Relive are classified as soft checks and will never lower your score.",
    icon: Award,
  },
];

function Brand() {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Relive home">
      <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-lime-500 text-[#07130c] shadow-md shadow-emerald-500/20">
        <span className="text-xl font-black">◈</span>
      </div>
      <span className="text-xl font-bold tracking-tight text-[#0c1a13] dark:text-white">relive</span>
    </Link>
  );
}

export default function Home() {
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [step, setStep] = useState<LoginStep>("mobile");
  const [mobile, setMobile] = useState("");
  const [consent, setConsent] = useState(false);
  const [mobileError, setMobileError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [seconds, setSeconds] = useState(10);
  const [transactionId, setTransactionId] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loginOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setLoginOpen(false);
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [loginOpen]);

  useEffect(() => {
    if (!loginOpen || step !== "otp" || seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [loginOpen, seconds, step]);

  const openLogin = () => {
    setLoginOpen(true);
    setMenuOpen(false);
  };

  const closeLogin = () => {
    setLoginOpen(false);
    window.setTimeout(() => {
      setStep("mobile");
      setOtp("");
      setOtpError("");
    }, 200);
  };

  const requestOtp = async (channel: "SMS" | "CALL" | "WHATSAPP" = "SMS") => {
    const response = await api.post("/auth/request-otp", {
      mobile,
      consent: true,
      consentVersion: "login-v1",
      channel,
    });
    setTransactionId(response.data.transactionId);
    setDevOtp(response.data.devOtp ?? "");
    setSeconds(response.data.resendAfterSeconds ?? 10);
    setStep("otp");
  };

  const submitMobile = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = mobile.replace(/\D/g, "");
    setMobileError("");
    setConsentError("");
    if (!normalized) return setMobileError("Mobile number is required");
    if (!/^[6-9]\d{9}$/.test(normalized)) return setMobileError("Enter a valid 10-digit mobile number");
    if (!consent) return setConsentError("Consent is required to proceed");
    setMobile(normalized);
    setBusy(true);
    try {
      await requestOtp();
    } catch (error) {
      setMobileError(apiMessage(error));
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
      await api.post("/auth/verify-otp", { transactionId, otp });
      window.location.assign("/portal");
    } catch (error) {
      setOtpError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const resendOtp = async (channel: "SMS" | "CALL" | "WHATSAPP") => {
    if (seconds > 0) return;
    setBusy(true);
    setOtp("");
    setOtpError("");
    try {
      await requestOtp(channel);
    } catch (error) {
      setOtpError(apiMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#f8faf9] text-[#0c1a13] transition-colors dark:bg-[#070e0a] dark:text-[#f0fdf4]">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-[#e5ede7] bg-white/90 backdrop-blur-md dark:border-[#14261c] dark:bg-[#070e0a]/90">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Brand />

          <nav className="hidden items-center gap-8 text-xs font-semibold text-[#5a7063] md:flex dark:text-[#90a89b]" aria-label="Main navigation">
            <a href="#how-it-works" className="transition hover:text-emerald-600 dark:hover:text-emerald-400">
              How It Works
            </a>
            <a href="#health-factors" className="transition hover:text-emerald-600 dark:hover:text-emerald-400">
              Credit Factors
            </a>
            <a href="#features" className="transition hover:text-emerald-600 dark:hover:text-emerald-400">
              Features
            </a>
            <a href="#security" className="transition hover:text-emerald-600 dark:hover:text-emerald-400">
              Security
            </a>
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <button
              onClick={openLogin}
              className="rounded-xl border border-[#d2ded6] px-5 py-2.5 text-xs font-bold text-[#0c1a13] transition hover:bg-[#f1f6f3] dark:border-[#1a3827] dark:text-white dark:hover:bg-[#0e2116]"
            >
              Log In
            </button>
            <button
              onClick={openLogin}
              className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm shadow-emerald-600/30 transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
            >
              Check Free Score
              <ArrowRight className="size-3.5 transition group-hover:translate-x-0.5" />
            </button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle />
            <button
              onClick={() => setMenuOpen((value) => !value)}
              className="grid size-10 place-items-center rounded-xl border border-[#d2ded6] text-[#4d6356] dark:border-[#1a3827] dark:text-[#a0b8ab]"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {menuOpen && (
          <div className="border-t border-[#e2ebe4] bg-white px-5 py-5 md:hidden dark:border-[#14261c] dark:bg-[#070e0a]">
            <nav className="mx-auto flex max-w-7xl flex-col gap-4 text-xs font-semibold text-[#5a7063] dark:text-[#90a89b]">
              <a href="#how-it-works" onClick={() => setMenuOpen(false)}>
                How It Works
              </a>
              <a href="#health-factors" onClick={() => setMenuOpen(false)}>
                Credit Factors
              </a>
              <a href="#features" onClick={() => setMenuOpen(false)}>
                Features
              </a>
              <a href="#security" onClick={() => setMenuOpen(false)}>
                Security
              </a>
              <button
                onClick={openLogin}
                className="mt-2 w-full rounded-xl bg-emerald-600 py-3 font-bold text-white dark:bg-emerald-500 dark:text-[#07130c]"
              >
                Log In Securely
              </button>
            </nav>
          </div>
        )}
      </header>

      {/* Hero Section with DisputeFox Style Score Card Preview */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-32 overflow-hidden">
        {/* Glow ambient background accents */}
        <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 size-[650px] rounded-full bg-emerald-400/10 blur-[120px] dark:bg-emerald-500/10" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            {/* Pill badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-emerald-50/80 px-3.5 py-1.5 text-xs font-bold text-emerald-800 shadow-2xs dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Free Official Experian & RBI-Compliant Credit Check</span>
            </div>

            <h1 className="max-w-2xl text-[clamp(2.5rem,5.5vw,4.5rem)] font-extrabold leading-[1.02] tracking-tight text-[#0c1a13] dark:text-white">
              Master your credit. <br />
              <span className="text-emerald-600 dark:text-emerald-400">Shape what’s next.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-[#597063] dark:text-[#8ba295]">
              Relive combines certified credit bureau insights with proactive dispute tools, repayment matrixes, and actionable recommendations—free forever.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={openLogin}
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-7 py-4 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:-translate-y-0.5 hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
              >
                <span>Check Your Credit Score</span>
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </button>
              <a
                href="#how-it-works"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#d2ded6] bg-white px-6 py-4 text-xs sm:text-sm font-bold text-[#0c1a13] transition hover:bg-[#f1f6f3] dark:border-[#1a3827] dark:bg-[#0c1a12] dark:text-white dark:hover:bg-[#12241a]"
              >
                <span>Explore Features</span>
                <ChevronRight className="size-4" />
              </a>
            </div>

            {/* Micro Trust Indicators */}
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-[#62776b] dark:text-[#8ba295]">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                Zero Impact on Score
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                256-Bit Bank Grade Encryption
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                RBI & NSDL Verified
              </span>
            </div>
          </div>

          {/* DisputeFox Interactive Score Card Preview */}
          <div className="relative mx-auto w-full max-w-[500px]">
            <div className="relative rounded-3xl border border-[#dce6df] bg-white p-6 sm:p-7 shadow-2xl dark:border-[#162a1f] dark:bg-[#0c1a12]">
              {/* Header inside preview */}
              <div className="flex items-center justify-between border-b border-[#eef3f0] pb-4 dark:border-[#16291e]">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Live Member Snapshot
                  </p>
                  <p className="text-sm font-bold text-[#0c1a13] dark:text-white">
                    Hello, Alex <span className="text-xs">🙂</span>
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Verified Active
                </span>
              </div>

              {/* DisputeFox Rainbow Arc Gauge */}
              <div className="mt-4">
                <CreditScoreGauge
                  score={803}
                  min={300}
                  max={850}
                  category={{ label: "Excellent", color: "#22c55e" }}
                  bureau="Experian"
                  delta={6}
                />
              </div>

              {/* Factors Mini Preview */}
              <div className="mt-6 grid grid-cols-2 gap-3 border-t border-[#eef3f0] pt-4 dark:border-[#16291e]">
                <div className="rounded-xl border border-emerald-100 bg-[#f0fdf4] p-3 dark:border-emerald-900/40 dark:bg-[#081e13]">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                    <span>Payment History</span>
                    <span className="rounded-full bg-emerald-200/80 px-1.5 py-0.2 text-[9px] font-bold">100%</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#0c1a13] dark:text-white">All on time</p>
                </div>

                <div className="rounded-xl border border-sky-100 bg-[#f0f9ff] p-3 dark:border-sky-900/40 dark:bg-[#081b24]">
                  <div className="flex justify-between items-center text-[10px] font-semibold text-sky-800 dark:text-sky-300">
                    <span>Credit Card Use</span>
                    <span className="rounded-full bg-sky-200/80 px-1.5 py-0.2 text-[9px] font-bold">2%</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-[#0c1a13] dark:text-white">Optimal balance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Credit Score & Financial Health Introduction (The 4 Pillars) */}
      <section id="health-factors" className="border-t border-[#e5ece7] bg-white py-20 dark:border-[#14261c] dark:bg-[#070e0a]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Credit Score Intelligence
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0c1a13] sm:text-4xl dark:text-white">
              The 4 Pillars of Financial Health
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5c7366] dark:text-[#8ba295]">
              Learn exactly how bureau algorithms grade your creditworthiness so you can take strategic steps to reach the 800+ tier.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-[#e1e9e4] bg-[#f8faf9] p-6 shadow-xs transition-all hover:-translate-y-1 hover:border-emerald-300 dark:border-[#162a1f] dark:bg-[#0c1a12] dark:hover:border-emerald-700"
                >
                  <div className="flex items-center justify-between">
                    <span className={`grid size-11 place-items-center rounded-xl border ${item.tone}`}>
                      <Icon className="size-5" />
                    </span>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {item.weight}
                    </span>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-[#0c1a13] dark:text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#5c7366] dark:text-[#8ba295]">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How the Application Works (3-Step Flow) */}
      <section id="how-it-works" className="border-t border-[#e5ece7] bg-[#f8faf9] py-20 dark:border-[#14261c] dark:bg-[#09150f]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Transparent & Deliberate
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0c1a13] sm:text-4xl dark:text-white">
              How Relive Works
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#5c7366] dark:text-[#8ba295]">
              No passwords, no unwanted agent calls, and zero hidden credit card signups. A seamless 3-minute flow.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((st) => {
              const Icon = st.icon;
              return (
                <div
                  key={st.number}
                  className="rounded-2xl border border-[#e1e9e4] bg-white p-7 shadow-xs dark:border-[#162a1f] dark:bg-[#0c1a12]"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      <Icon className="size-6" />
                    </span>
                    <span className="text-sm font-extrabold text-[#92a89c] dark:text-[#688274]">{st.number}</span>
                  </div>
                  <h3 className="mt-6 text-base font-bold text-[#0c1a13] dark:text-white">{st.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#5c7366] dark:text-[#8ba295]">{st.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features & Benefits */}
      <section id="features" className="border-t border-[#e5ece7] bg-white py-20 dark:border-[#14261c] dark:bg-[#070e0a]">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Enterprise Grade FinTech
            </span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0c1a13] sm:text-4xl dark:text-white">
              Built for Complete Credit Clarity
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="rounded-2xl border border-[#e1e9e4] bg-[#f8faf9] p-6 dark:border-[#162a1f] dark:bg-[#0c1a12]"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-[#0c1a13] dark:text-white">{feat.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#5c7366] dark:text-[#8ba295]">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Security & Privacy Banner */}
      <section id="security" className="py-20 px-5 sm:px-8">
        <div className="mx-auto max-w-7xl rounded-3xl bg-[#07130c] p-8 sm:p-12 text-white">
          <div className="grid items-center gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <span className="grid size-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <LockKeyhole className="size-6" />
              </span>
              <h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight">
                Your Financial Privacy is Non-Negotiable
              </h2>
              <p className="mt-3 text-xs sm:text-sm leading-relaxed text-[#8ca898]">
                We do not sell user data to telemarketers or third-party lenders. All credit pulls require explicit, time-stamped digital consent and are encrypted with SHA-256 and AES-256 bit algorithms.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {[
                "256-Bit Bank-Grade Data Transit",
                "Explicit Consent Architecture",
                "Soft Inquiries with 0 Score Penalty",
                "Full Audit Trail & Cryptographic Logs",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/30 px-4 py-3 text-xs font-semibold text-[#d4e8dd]"
                >
                  <ShieldCheck className="size-4.5 text-emerald-400 shrink-0" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="border-t border-[#e5ece7] bg-emerald-500/10 py-16 text-center dark:border-[#14261c] dark:bg-emerald-950/20">
        <div className="mx-auto max-w-3xl px-5">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0c1a13] dark:text-white">
            Ready to Take Control of Your Financial Future?
          </h2>
          <p className="mt-2 text-xs sm:text-sm text-[#5c7366] dark:text-[#8ba295]">
            Get your comprehensive credit analysis in less than 2 minutes. Free forever.
          </p>
          <button
            onClick={openLogin}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-7 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-700 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
          >
            <span>Get Started Now</span>
            <ArrowRight className="size-4" />
          </button>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="border-t border-[#e5ece7] bg-white py-12 dark:border-[#14261c] dark:bg-[#070e0a]">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 sm:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <Brand />
            <p className="mt-2 text-xs text-[#6e8577] dark:text-[#8ba295]">
              Empowering consumers with transparent credit score monitoring and dispute intelligence.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs font-medium text-[#6e8577] dark:text-[#8ba295]">
            <Link href="/privacy" className="hover:text-emerald-600 dark:hover:text-emerald-400">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-emerald-600 dark:hover:text-emerald-400">
              Terms of Service
            </Link>
            <span>© 2026 Relive Inc. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Auth / OTP Modal */}
      {loginOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-0 backdrop-blur-xs sm:place-items-center sm:p-5"
          onMouseDown={(e) => e.target === e.currentTarget && closeLogin()}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-title"
            className="w-full max-w-[440px] rounded-t-[26px] bg-white p-6 shadow-2xl sm:rounded-[26px] sm:p-8 dark:bg-[#0c1a12] dark:border dark:border-[#162a1f]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="mb-4 grid size-11 place-items-center rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  {step === "success" ? (
                    <BadgeCheck className="size-5" />
                  ) : step === "otp" ? (
                    <Fingerprint className="size-5" />
                  ) : (
                    <LockKeyhole className="size-5" />
                  )}
                </span>
                <h2 id="login-title" className="text-xl font-bold tracking-tight text-[#0c1a13] dark:text-white">
                  {step === "mobile" ? "Welcome to Relive" : step === "otp" ? "Verify It’s You" : "Authentication Success"}
                </h2>
                <p className="mt-1 text-xs text-[#5c7366] dark:text-[#8ba295]">
                  {step === "mobile"
                    ? "Enter your registered mobile number to access your credit score."
                    : step === "otp"
                    ? `Enter the 6-digit OTP sent to +91 ••••••${mobile.slice(-4)}`
                    : "Redirecting to your dashboard..."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeLogin}
                className="grid size-8 place-items-center rounded-lg text-[#687e71] hover:bg-black/5 dark:text-[#8ba295] dark:hover:bg-white/5"
                aria-label="Close dialog"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Mobile Input Form */}
            {step === "mobile" && (
              <form onSubmit={submitMobile} className="mt-6" noValidate>
                <label htmlFor="mobile" className="text-xs font-bold text-[#35483d] dark:text-[#a0b8ab]">
                  Registered Mobile Number
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

                {/* Consent checkbox */}
                <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#e5ede8] bg-[#f8faf9] p-3 dark:border-[#162a1f] dark:bg-[#08150f]">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked);
                      setConsentError("");
                    }}
                    className="mt-0.5 size-4 accent-emerald-600"
                  />
                  <span className="text-[11px] leading-relaxed text-[#55695d] dark:text-[#8ba295]">
                    I agree to Relive’s{" "}
                    <Link href="/terms" target="_blank" className="font-bold text-emerald-600 hover:underline dark:text-emerald-400">
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" target="_blank" className="font-bold text-emerald-600 hover:underline dark:text-emerald-400">
                      Privacy Policy
                    </Link>{" "}
                    for authentication.
                  </span>
                </label>
                {consentError && <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{consentError}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
                >
                  {busy ? "Sending OTP..." : "Continue"}
                  {!busy && <ArrowRight className="size-4" />}
                </button>

                <p className="mt-3 text-center text-[10px] text-[#71867a] dark:text-[#8ba295]">
                  Demo registered account: <strong className="text-[#0c1a13] dark:text-white">9876543210</strong>
                </p>
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
                  <span className="text-[#71867a] dark:text-[#8ba295]">
                    {seconds > 0 ? `Resend in 00:${String(seconds).padStart(2, "0")}` : "Resend OTP via:"}
                  </span>
                </div>

                {seconds <= 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["SMS", "CALL", "WHATSAPP"] as const).map((ch) => (
                      <button
                        key={ch}
                        type="button"
                        disabled={busy}
                        onClick={() => resendOtp(ch)}
                        className="rounded-lg border border-[#d8e3dc] py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 dark:border-[#1d3829] dark:text-emerald-300 dark:hover:bg-[#12241a]"
                      >
                        {ch === "WHATSAPP" ? "WhatsApp" : ch === "CALL" ? "Call" : "SMS"}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
                >
                  {busy ? "Verifying..." : "Verify & Access Report"}
                  {!busy && <ArrowRight className="size-4" />}
                </button>

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
