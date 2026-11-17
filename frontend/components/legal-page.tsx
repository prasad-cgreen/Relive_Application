import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentType } from "react";
import { LEGAL } from "../lib/legal";
import { ThemeToggle } from "./theme-toggle";

/** A paragraph (string) or a bulleted list (string[]). */
export type LegalBlock = string | string[];
export type LegalSection = { heading: string; content: LegalBlock[] };

interface LegalPageProps {
  title: string;
  intro: string;
  icon: ComponentType<{ className?: string }>;
  sections: LegalSection[];
}

/** Shared layout for the privacy and terms pages. */
export function LegalPage({ title, intro, icon: Icon, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-[#f8faf6] text-[#183b2f] dark:bg-[#070e0a] dark:text-[#f0fdf4]">
      <header className="sticky top-0 z-10 border-b border-[#e5ede7] bg-white/90 backdrop-blur-md dark:border-[#14261c] dark:bg-[#070e0a]/90">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:h-20 sm:px-6">
          <Link href="/" aria-label="Relive home">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/relive-logo.svg" alt="Relive" width={98} height={28} className="h-7 w-auto dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/relive-logo-light.svg" alt="Relive" width={98} height={28} className="hidden h-7 w-auto dark:block" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#216b49] hover:underline dark:text-emerald-400">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to Relive
        </Link>

        <div className="mt-6 rounded-3xl border border-[#dce5d8] bg-white p-5 sm:mt-8 sm:p-10 dark:border-[#162a1f] dark:bg-[#0c1a12]">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e9f1e2] text-[#216b49] dark:bg-emerald-950 dark:text-emerald-300">
              <Icon className="size-5" />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400">Last updated {LEGAL.lastUpdated}</p>
          </div>
          <h1 className="mt-5 text-[28px] font-bold leading-tight tracking-[-0.02em] sm:text-4xl dark:text-white">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-[#5c7366] dark:text-[#8ba295]">{intro}</p>

          <nav aria-label="Contents" className="mt-6 rounded-2xl bg-[#f4f8f1] p-4 dark:bg-[#0a160f]">
            <p className="text-xs font-semibold uppercase tracking-[1px] text-[#183b2f] dark:text-emerald-300">Contents</p>
            <ol className="mt-2 grid gap-1 text-sm text-[#216b49] sm:grid-cols-2 dark:text-emerald-400">
              {sections.map(({ heading }, i) => (
                <li key={heading}>
                  <a href={`#section-${i + 1}`} className="hover:underline">
                    {i + 1}. {heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="mt-8 divide-y divide-[#eef3f0] border-t border-[#eef3f0] dark:divide-[#16291e] dark:border-[#16291e]">
            {sections.map(({ heading, content }, i) => (
              <section key={heading} id={`section-${i + 1}`} className="scroll-mt-24 py-5 sm:py-6">
                <h2 className="text-base font-semibold sm:text-lg dark:text-white">
                  {i + 1}. {heading}
                </h2>
                <div className="mt-2 space-y-2.5 text-sm leading-relaxed text-[#4f6358] dark:text-[#a0b8ab]">
                  {content.map((block, j) =>
                    typeof block === "string" ? (
                      <p key={j}>{block}</p>
                    ) : (
                      <ul key={j} className="list-disc space-y-1.5 pl-5 marker:text-emerald-600">
                        {block.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </article>
    </main>
  );
}
