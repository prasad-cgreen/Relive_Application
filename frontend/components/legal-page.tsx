import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ComponentType } from "react";
import { LEGAL } from "../lib/legal";
import { ThemeToggle } from "./theme-toggle";

/** A paragraph (string) or a bulleted list (string[]). */
export type LegalBlock = string | string[];
export type LegalSection = { heading: string; content: LegalBlock[] };

interface LegalPageProps {
  title: string;
  intro: string;
  icon?: ComponentType<{ className?: string }>;
  sections: LegalSection[];
}

/** Shared full-width layout for the privacy and terms pages. */
export function LegalPage({ title, intro, sections }: LegalPageProps) {
  return (
    <main className="min-h-screen bg-white text-[#183b2f] dark:bg-[#070e0a] dark:text-[#f0fdf4]">
      <header className="sticky top-0 z-10 border-b border-[#e5ede7] bg-white/90 backdrop-blur-md dark:border-[#14261c] dark:bg-[#070e0a]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-20 sm:px-8">
          <Link href="/" aria-label="Relive home">
            {/* eslint-disable-next-line @next/next/no-img-element -- static SVG */}
            <img src="/relive-logo.svg" alt="Relive" width={112} height={32} className="h-7 w-auto sm:h-8 dark:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/relive-logo-light.svg" alt="Relive" width={112} height={32} className="hidden h-7 w-auto sm:h-8 dark:block" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="hidden rounded-full bg-[#216b49] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1b5a3d] sm:inline-flex dark:bg-emerald-500 dark:text-[#04130b] dark:hover:bg-emerald-400"
            >
              Get started
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="border-b border-[#e5ede7] bg-[#f4f8f1] dark:border-[#14261c] dark:bg-[#0a160f]">
        <nav aria-label="Breadcrumb" className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 text-sm font-semibold sm:px-8">
          <Link href="/" className="text-[#216b49] hover:underline dark:text-emerald-400">
            Home
          </Link>
          <ChevronRight className="size-3.5 text-[#8aa395]" aria-hidden="true" />
          <span aria-current="page" className="text-[#183b2f] dark:text-white">
            {title}
          </span>
        </nav>
      </div>

      <article className="mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-8 sm:pt-16">
        <div className="text-center">
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.02em] sm:text-5xl dark:text-white">{title}</h1>
          <p className="mt-3 text-xs font-bold uppercase tracking-[1.5px] text-emerald-700 dark:text-emerald-400">Last updated {LEGAL.lastUpdated}</p>
        </div>

        <p className="mt-8 text-base leading-relaxed text-[#3f5447] sm:mt-12 sm:text-lg dark:text-[#a0b8ab]">{intro}</p>

        <nav aria-label="Contents" className="mt-8 rounded-2xl border border-[#e5ede7] bg-[#f8faf6] p-5 sm:p-6 dark:border-[#14261c] dark:bg-[#0a160f]">
          <p className="text-xs font-semibold uppercase tracking-[1px] text-[#183b2f] dark:text-emerald-300">Contents</p>
          <ol className="mt-3 grid gap-x-8 gap-y-1.5 text-sm text-[#216b49] sm:grid-cols-2 lg:grid-cols-3 dark:text-emerald-400">
            {sections.map(({ heading }, i) => (
              <li key={heading}>
                <a href={`#section-${i + 1}`} className="hover:underline">
                  {i + 1}. {heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-4">
          {sections.map(({ heading, content }, i) => (
            <section key={heading} id={`section-${i + 1}`} className="scroll-mt-24 pt-10 sm:pt-12">
              <h2 className="text-2xl font-bold tracking-[-0.01em] sm:text-3xl dark:text-white">
                {i + 1}. {heading}
              </h2>
              <div className="mt-4 space-y-4 text-base leading-relaxed text-[#3f5447] sm:text-lg dark:text-[#a0b8ab]">
                {content.map((block, j) =>
                  typeof block === "string" ? (
                    <p key={j}>{block}</p>
                  ) : (
                    <ul key={j} className="list-disc space-y-2 pl-6 marker:text-emerald-600">
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
      </article>
    </main>
  );
}
