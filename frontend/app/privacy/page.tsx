import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";

export default function PrivacyPage() {
  return <main className="min-h-screen bg-[#f8faff] px-5 py-10 text-[#0b1739] sm:py-16"><ThemeToggle className="fixed right-5 top-5 z-10 sm:right-8 sm:top-8" /><article className="mx-auto max-w-3xl rounded-3xl border border-[#e1e7f0] bg-white p-6 shadow-[0_18px_60px_rgba(25,50,90,.07)] sm:p-12">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#155eef]"><ArrowLeft className="size-4" /> Back to Relive</Link>
    <span className="mt-10 grid size-11 place-items-center rounded-xl bg-[#eef4ff] text-[#155eef]"><ShieldCheck className="size-5" /></span>
    <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#155eef]">Draft for review</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em]">Privacy Policy</h1>
    <p className="mt-4 text-sm leading-7 text-[#637087]">This page is a design placeholder and must be replaced with counsel-approved language before production launch.</p>
    <div className="mt-10 space-y-8 text-sm leading-7 text-[#526078]"><section><h2 className="text-lg font-semibold text-[#0b1739]">Information and purpose</h2><p className="mt-2">Relive will clearly identify the personal information it requests and the purpose for which each item is processed.</p></section><section><h2 className="text-lg font-semibold text-[#0b1739]">Consent and control</h2><p className="mt-2">Identity verification and credit-report access will use separate, explicit authorization. Applicable withdrawal and grievance options will be provided.</p></section><section><h2 className="text-lg font-semibold text-[#0b1739]">Security and retention</h2><p className="mt-2">Sensitive information will be protected using access controls, encryption, retention limits and auditable security practices.</p></section></div>
  </article></main>;
}
