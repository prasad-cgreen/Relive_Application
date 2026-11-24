"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

// Photos and copy from the Relive Thrive reference design (Relive_Thrive_Website.html). The photos are portrait and small
// (about 220 x 260), so they upscale on big screens: swap in larger exports under the same names to sharpen them.
const SLIDES = [
  {
    src: "/hero/story1.webp",
    alt: "A worried man with his head in his hand, reading an EMI reminder",
    tag: "Repayment difficulty",
    title: "Income down.",
    accent: "EMIs unchanged.",
    body: "Tell us what has changed. Let us help you explore a practical way forward.",
    note: "Your situation deserves to be heard.",
  },
  {
    src: "/hero/story2.webp",
    alt: "A woman holding her group-loan passbook",
    tag: "Microfinance & group loans",
    title: "Group-loan",
    accent: "instalments getting difficult?",
    body: "Reduced earnings or a payment problem? Explain it in your own words.",
    note: "Speak in a language you are comfortable with.",
  },
  {
    src: "/hero/story3.webp",
    alt: "A woman frowning at her phone, which shows her loan as overdue despite a payment receipt",
    tag: "Payment not reflected",
    title: "Payment made.",
    accent: "Still overdue?",
    body: "Get help checking the evidence and asking for your account record to be reviewed.",
    note: "Start with what does not look right.",
  },
  {
    src: "/hero/story4.webp",
    alt: "A man looking closely at an unfamiliar loan listed on his credit report",
    tag: "Unfamiliar account",
    title: "Not your loan?",
    accent: "Why is it on your report?",
    body: "Let us help verify the account and work out the next step for a dispute.",
    note: "Checking first. Not jumping to conclusions.",
  },
  {
    src: "/hero/story5.webp",
    alt: "A smiling man across the table from a lender, holding a page headed Old Loan Dues",
    tag: "Old-loan settlement",
    title: "Could not pay then.",
    accent: "Have some money now?",
    body: "Explore whether your lender will consider settling your old loan for less.",
    note: "Settlement requires lender agreement.",
  },
  {
    src: "/hero/story6.webp",
    alt: "A shopkeeper smiling, with a tablet showing a loan application",
    tag: "New-loan difficulty",
    title: "New loan",
    accent: "not getting approved?",
    body: "Understand the stated reasons and the existing account issues worth reviewing.",
    note: "A clearer next step, not a loan guarantee.",
  },
];
const AUTOPLAY_MS = 5000;
const SWIPE_PX = 40;

/** The cross-fading pictures; fills its (positioned) parent, cropped to fill it from near the top so heads are not cut off. */
function Slides({ index }: { index: number }) {
  return (
    <>
      {SLIDES.map((slide, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- static files in public/, nothing for next/image to optimise
        <img
          key={slide.src}
          src={slide.src}
          alt={i === index ? slide.alt : ""}
          width={220}
          height={260}
          loading={i === 0 ? "eager" : "lazy"}
          draggable={false}
          aria-hidden={i !== index}
          className={`absolute inset-0 size-full select-none object-cover object-[50%_15%] transition-[opacity,transform] duration-[1200ms] ease-out motion-reduce:transition-none ${
            i === index ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"
          }`}
        />
      ))}
    </>
  );
}

/**
 * Hero panel: each slide's text and photo, cross-fading together, then `children` (shown under every slide's text).
 * The text never sits on the photo:
 *  - side by side (tablets, and desktops from 1280px): the photo fills the right half of the panel, next to the text;
 *  - phones: the photo is a short banner above the text;
 *  - small desktops (1024-1279px, where the column is narrow): the photo sits under the text.
 * The photos keep their own proportions (cropped, never stretched); their inner edges fade into the panel's background.
 * It advances by itself; dots, swipe and (with a dot focused) the arrow keys also change the slide.
 */
export function HeroCarousel({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<number | null>(null);
  const go = (to: number) => setIndex((to + SLIDES.length) % SLIDES.length);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // Restarts whenever the picture changes, so one chosen by hand also stays for the full time.
  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setTimeout(() => setIndex((current) => (current + 1) % SLIDES.length), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, reducedMotion]);

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Loan problems we can help with"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(index - 1);
        if (event.key === "ArrowRight") go(index + 1);
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const moved = (event.changedTouches[0]?.clientX ?? 0) - (touchStart.current ?? 0);
        if (touchStart.current != null && Math.abs(moved) > SWIPE_PX) go(index + (moved < 0 ? 1 : -1));
        touchStart.current = null;
      }}
      // @container: the side-by-side text is sized from this panel's width (cqw). The page's mint, a touch deeper on the photo side.
      className={`@container relative isolate flex flex-col overflow-hidden rounded-[22px] border border-[#dbe7e0] bg-[linear-gradient(100deg,#f5fbf7_0%,#eef5f0_100%)] shadow-[0_10px_35px_rgba(28,62,44,0.06)] ${className}`}
    >
      {/* Side by side: the photo fills the right half, full height; its left edge fades into the background behind the text. */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 -z-10 hidden w-1/2 [mask-image:linear-gradient(to_right,transparent,#000_35%)] sm:block lg:hidden xl:block"
      >
        <Slides index={index} />
      </div>

      <div className="relative min-w-0 px-5 pt-2 sm:my-auto sm:max-w-[49%] sm:pt-[5cqw] sm:pr-0 sm:pb-14 sm:pl-[5cqw] lg:my-0 lg:max-w-none lg:px-8 lg:pt-9 lg:pb-0 xl:my-auto xl:max-w-[49%] xl:pt-[5cqw] xl:pr-0 xl:pb-14 xl:pl-[5cqw]">
        {/* Every slide's text sits in the same grid cell, so the panel is as tall as the longest one and does not jump as they change.
            Shorter slides put the spare room where it reads as breathing space, keeping the note right on top of `children`:
            on phones above the label (under the photo's fade), wider up above the divider. */}
        <div className="grid">
          {SLIDES.map((slide, i) => {
            const Title = i === index ? "h1" : "p"; // one h1 on the page: the shown slide's
            return (
              <div
                key={slide.src}
                aria-hidden={i !== index}
                className={`flex flex-col justify-end [grid-area:1/1] sm:justify-start transition-[opacity,visibility] duration-700 motion-reduce:transition-none ${i === index ? "opacity-100" : "invisible opacity-0"}`}
              >
                <p className="flex items-start gap-2 text-[11px] font-bold uppercase leading-snug tracking-[1.5px] text-emerald-700">
                  <span className="mt-[0.4em] size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                  {slide.tag}
                </p>
                <Title className="mt-3 text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] text-[#183b2f] sm:text-[clamp(1.375rem,4.5cqw,2.5rem)] lg:text-[1.875rem] xl:text-[clamp(1.375rem,4.5cqw,2.5rem)]">
                  {slide.title} <span className="block text-emerald-700">{slide.accent}</span>
                </Title>
                <p className="mt-3 mb-5 text-[15px] leading-relaxed text-[#3f5447] sm:text-[clamp(0.8125rem,2.3cqw,1.0625rem)] lg:text-[15px] xl:text-[clamp(0.8125rem,2.3cqw,1.0625rem)]">
                  {slide.body}
                </p>
                <div className="flex items-center gap-3 border-t sm:mt-auto border-[#d9e5dd] pt-4">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e6efdc] text-emerald-700">
                    <ShieldCheck className="size-4.5" aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold leading-relaxed text-[#183b2f] sm:text-[clamp(0.8125rem,2.2cqw,1rem)] lg:text-sm xl:text-[clamp(0.8125rem,2.2cqw,1rem)]">
                    {slide.note}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {children}
      </div>

      {/* Stacked, in its own space: on phones a square banner above the text (square shows most of each portrait photo), its
          bottom edge fading into the panel; on small desktops under the text, its top and bottom edges fading */}
      <div className="relative order-first aspect-square w-full [mask-image:linear-gradient(to_bottom,#000_70%,transparent)] sm:order-none sm:hidden lg:mt-4 lg:block lg:aspect-[3/2] lg:[mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_88%,transparent)] xl:hidden">
        <Slides index={index} />
      </div>

      {/* Dots, centred across the whole panel: under the picture when stacked, at the bottom edge when side by side */}
      <div className="flex justify-center px-4 pb-3 sm:absolute sm:inset-x-0 sm:bottom-3 sm:p-0 lg:static lg:px-4 lg:pb-3 xl:absolute xl:inset-x-0 xl:bottom-3 xl:p-0">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.src}
            type="button"
            onClick={() => go(i)}
            aria-label={`Picture ${i + 1} of ${SLIDES.length}`}
            aria-current={i === index ? "true" : undefined}
            // The padding gives a finger-sized target around a small dot.
            className="grid h-8 place-items-center px-1.5 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <span className={`block h-2 rounded-full transition-all duration-300 ${i === index ? "w-6 bg-[#216b49]" : "w-2 bg-[#216b49]/25"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}
