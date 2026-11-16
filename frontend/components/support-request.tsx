"use client";

import { ArrowRight, CheckCircle2, Phone } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api, apiMessage } from "../lib/api";
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_TEL } from "../lib/contact";
import type { AccountItem } from "./accounts-table";

// Same values the backend accepts (supportRequestSchema in @relive/shared).
const TOPICS = [
  { value: "OPTIONS", title: "Understand my options", text: "Help me review the report and the steps I could take." },
  { value: "LENDER_DISCUSSION", title: "Prepare a lender discussion", text: "Help me ask the right questions about a specific account." },
  { value: "NOTICE", title: "Review a notice or disputed detail", text: "A time-sensitive issue or incorrect information needs attention." },
] as const;
const TIMES = ["No preference", "Morning", "Afternoon", "Evening"] as const;
const LANGUAGES = ["English", "Hindi", "Marathi", "Other"] as const;

const last4 = (account: AccountItem) => (account.accountNumber ?? "").replace(/\D/g, "").slice(-4);
const label = (account: AccountItem) => `${account.lender} · ${account.accountNumber || "—"}`;
const suggestion = (account: AccountItem | undefined) =>
  account ? `I need help understanding ${account.lender}${last4(account) ? `, account ending ${last4(account)}` : ""}.` : "";

const FIELD =
  "mt-1.5 block w-full rounded-xl border border-[#d8e2dc] bg-white px-3.5 text-sm text-[#183b2f] outline-none transition focus:border-emerald-500 focus:ring-3 focus:ring-emerald-100 dark:border-[#1e3829] dark:bg-[#07120b] dark:text-white dark:focus:ring-emerald-950";
const LABEL = "text-xs font-semibold text-[#183b2f] dark:text-white";

interface Props {
  accounts: AccountItem[];
  account: AccountItem | null; // pre-selected from "Get help with this account"
  mobileLast4?: string | null;
  onBack: () => void;
}

/** "Get help" questionnaire. Submitting stores a lead the Relive team calls back on. */
export function SupportRequestView({ accounts, account, mobileLast4, onBack }: Props) {
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["value"]>(account ? "LENDER_DISCUSSION" : "OPTIONS");
  const [accountIndex, setAccountIndex] = useState(account ? accounts.indexOf(account) : -1); // -1 = overall situation
  const [question, setQuestion] = useState<string | null>(null); // null = still the suggested text
  const [time, setTime] = useState<(typeof TIMES)[number]>("No preference");
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]>("English");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentId, setSentId] = useState("");

  const selected = accounts[accountIndex];
  const text = question ?? suggestion(selected);
  const phone = mobileLast4 ? `+91 ••••••${mobileLast4}` : "your registered mobile number"; // non-breaking space keeps the number on one line

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return setError("Tell us what you need help with.");
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<{ id: string }>("/support-requests", {
        topic,
        account: selected ? label(selected) : null,
        question: text.trim(),
        preferredTime: time,
        preferredLanguage: language,
      });
      setSentId(data.id);
    } catch (requestError) {
      setError(apiMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  if (sentId) {
    return (
      <section className="mx-auto max-w-xl rounded-3xl border border-[#d5e3c8] bg-[#edf3e6] p-6 text-center sm:p-10 dark:border-[#1a3827] dark:bg-[#0c1a12]">
        <span className="mx-auto grid size-14 animate-in zoom-in-50 place-items-center rounded-full bg-white text-[#216b49] duration-300 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-[#183b2f] dark:text-white">Request received</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#465a50] dark:text-[#a0b8ab]">
          The Relive team will review your question and call you on <strong className="font-semibold text-[#183b2f] dark:text-white">{phone}</strong>
          {time !== "No preference" ? `, preferably in the ${time.toLowerCase()}` : ""}, in {language === "Other" ? "a language that suits you" : language}.
        </p>
        <p className="mt-3 text-xs text-[#63776b] dark:text-[#8ba295]">Reference: {sentId.slice(0, 8).toUpperCase()}</p>
        <p className="mt-2 text-xs text-[#63776b] dark:text-[#8ba295]">
          Need us sooner? Call{" "}
          <a href={`tel:${SUPPORT_TEL}`} className="whitespace-nowrap font-semibold text-[#216b49] hover:underline dark:text-emerald-400">{SUPPORT_PHONE}</a>
          {" "}and quote this reference.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#216b49] px-5 text-sm font-semibold text-white transition hover:bg-[#155438] dark:bg-emerald-500 dark:text-[#07130c]"
        >
          Back to my accounts
        </button>
      </section>
    );
  }

  return (
    <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <form onSubmit={submit} className="rounded-2xl border border-[#e1e9e4] bg-white p-5 shadow-xs sm:p-7 dark:border-[#162a1f] dark:bg-[#0c1a12]">
        <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400">Talk to the Relive team</p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-[#183b2f] sm:text-2xl dark:text-white">What would you like help with?</h2>

        <fieldset className="mt-5 grid gap-2.5">
          <legend className="sr-only">Type of help</legend>
          {TOPICS.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e0e7dc] p-3.5 transition hover:border-[#b8cdb0] hover:bg-[#f7faf3] has-[:checked]:border-[#709e60] has-[:checked]:bg-[#edf5e7] dark:border-[#1a3827] dark:hover:bg-[#0e2116] dark:has-[:checked]:border-emerald-500 dark:has-[:checked]:bg-emerald-950/40"
            >
              <input
                type="radio"
                name="topic"
                value={option.value}
                checked={topic === option.value}
                onChange={() => setTopic(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-[#216b49]"
              />
              <span>
                <span className="block text-sm font-semibold text-[#183b2f] dark:text-white">{option.title}</span>
                <span className="mt-0.5 block text-xs text-[#63776b] dark:text-[#8ba295]">{option.text}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <label htmlFor="support-account" className={`mt-5 block ${LABEL}`}>Account to discuss</label>
        <select id="support-account" value={accountIndex} onChange={(e) => setAccountIndex(Number(e.target.value))} className={`${FIELD} h-11`}>
          <option value={-1}>My overall debt situation</option>
          {accounts.map((a, i) => (
            <option key={`${a.accountNumber}-${i}`} value={i}>
              {label(a)}
            </option>
          ))}
        </select>

        <label htmlFor="support-question" className={`mt-4 block ${LABEL}`}>Your question</label>
        <textarea
          id="support-question"
          rows={4}
          maxLength={1500}
          value={text}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Describe what you need help understanding."
          className={`${FIELD} resize-y py-3 leading-relaxed`}
        />
        <p className="mt-1 text-[11px] text-[#7c8a80] dark:text-[#688274]">Please do not include your PAN, full account numbers, passwords or OTPs.</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="support-time" className={LABEL}>Preferred time to speak</label>
            <select id="support-time" value={time} onChange={(e) => setTime(e.target.value as (typeof TIMES)[number])} className={`${FIELD} h-11`}>
              {TIMES.map((t) => <option key={t}>{t}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-[#7c8a80] dark:text-[#688274]">A preference, not a confirmed appointment.</p>
          </div>
          <div>
            <label htmlFor="support-language" className={LABEL}>Preferred language</label>
            <select id="support-language" value={language} onChange={(e) => setLanguage(e.target.value as (typeof LANGUAGES)[number])} className={`${FIELD} h-11`}>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {error && <p role="alert" className="mt-4 text-sm text-red-700 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="group mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#216b49] text-sm font-semibold text-white transition hover:bg-[#155438] disabled:opacity-60 dark:bg-emerald-500 dark:text-[#07130c] dark:hover:bg-emerald-400"
        >
          {busy ? "Sending…" : "Request a call back"}
          {!busy && <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />}
        </button>
      </form>

      <aside className="rounded-2xl border border-[#d5e3c8] bg-[#edf3e6] p-5 sm:p-6 dark:border-[#1a3827] dark:bg-[#0c1a12]">
        <h3 className="text-sm font-semibold text-[#183b2f] dark:text-white">What happens next</h3>
        <ol className="mt-4 space-y-4">
          {[
            "We review your question and the account you picked from your report.",
            `A Relive specialist calls you on ${phone}.`,
            "Together you work out the next step, such as what to ask your lender.",
          ].map((step, i) => (
            <li key={step} className="flex gap-3 text-sm text-[#465a50] dark:text-[#a0b8ab]">
              <span className="grid size-6 shrink-0 place-items-center rounded-full border border-[#b9ccaa] bg-[#f7faef] text-[11px] text-[#5a7550] dark:border-[#1e3829] dark:bg-[#07120b] dark:text-[#8ba295]">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-[#465a50] dark:text-[#a0b8ab]">
          Prefer to talk now? Call customer care on{" "}
          <a href={`tel:${SUPPORT_TEL}`} className="whitespace-nowrap font-semibold text-[#216b49] hover:underline dark:text-emerald-400">{SUPPORT_PHONE}</a>
        </p>
        <p className="mt-2 text-sm text-[#465a50] dark:text-[#a0b8ab]">
          Prefer email? Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-[#216b49] hover:underline dark:text-emerald-400">{SUPPORT_EMAIL}</a>
        </p>
        <p className="mt-5 flex items-start gap-2 border-t border-[#d5e3c8] pt-4 text-xs leading-relaxed text-[#63776b] dark:border-[#1a3827] dark:text-[#8ba295]">
          <Phone className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          Relive does not guarantee a settlement, reduced dues or a score increase. Any arrangement needs your lender&rsquo;s approval.
        </p>
      </aside>
    </div>
  );
}
