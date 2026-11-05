import Link from "next/link";
import { ArrowLeft, FileCheck2 } from "lucide-react";
import { ThemeToggle } from "../../components/theme-toggle";

export default function TermsPage() {
  return <main className="min-h-screen bg-[#f8faff] px-5 py-10 text-[#0b1739] sm:py-16"><ThemeToggle className="fixed right-5 top-5 z-10 sm:right-8 sm:top-8" /><article className="mx-auto max-w-3xl rounded-3xl border border-[#e1e7f0] bg-white p-6 shadow-[0_18px_60px_rgba(25,50,90,.07)] sm:p-12">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#155eef]"><ArrowLeft className="size-4" /> Back to Relive</Link>
    <span className="mt-10 grid size-11 place-items-center rounded-xl bg-[#eef4ff] text-[#155eef]"><FileCheck2 className="size-5" /></span>
    <p className="mt-6 text-xs font-bold uppercase tracking-[.18em] text-[#155eef]">Draft for review</p><h1 className="mt-3 text-4xl font-semibold tracking-[-.05em]">Terms & Conditions</h1>
    <p className="mt-4 text-sm leading-7 text-[#637087]">This page is a design placeholder and must be replaced with counsel-approved terms before production launch.</p>
    <div className="mt-10 space-y-8 text-sm leading-7 text-[#526078]"><section><h2 className="text-lg font-semibold text-[#0b1739]">Service scope</h2><p className="mt-2">Relive is intended to help eligible users access and understand their own credit information through approved providers.</p></section><section><h2 className="text-lg font-semibold text-[#0b1739]">Account security</h2><p className="mt-2">Users are responsible for protecting their account access and must never disclose a one-time password to another person.</p></section><section><h2 className="text-lg font-semibold text-[#0b1739]">Accuracy and availability</h2><p className="mt-2">Credit information originates from authorized data providers. Provider availability and report contents may vary.</p></section></div>
  </article></main>;
}
