"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// 1800 x 1200 pamphlet pictures in public/hero: the left 46% is plain background, the artwork sits in the right 54%.
const SLIDES = [
  { src: "/hero/dashboard-wide.webp", alt: "A payment recovery dashboard with totals, a rising trend line and a payment reminder on a phone" },
  { src: "/hero/recovery-growth-wide.webp", alt: "A rising bar chart with an upward arrow and a recovery rate badge" },
  { src: "/hero/ai-recommendation-wide.webp", alt: "An AI recommendation card listing reminders sent and the suggested next step" },
  { src: "/hero/assistant-wide.webp", alt: "A friendly assistant robot holding a growth chart, beside four feature labels" },
  { src: "/hero/multi-channel-wide.webp", alt: "A phone showing a payment reminder chat, surrounded by WhatsApp, email, SMS and call icons" },
];
const AUTOPLAY_MS = 5000;
const SWIPE_PX = 40;

/** The cross-fading pictures; fills its (positioned) parent. `cover` crops to the artwork side, otherwise the whole picture shows. */
function Slides({ index, cover = false }: { index: number; cover?: boolean }) {
  return (
    <>
      {SLIDES.map((slide, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- static files in public/, nothing for next/image to optimise
        <img
          key={slide.src}
          src={slide.src}
          alt={i === index ? slide.alt : ""}
          width={1800}
          height={1200}
          loading={i === 0 ? "eager" : "lazy"}
          draggable={false}
          aria-hidden={i !== index}
          className={`absolute inset-0 size-full select-none object-right transition-[opacity,transform] duration-[1200ms] ease-out motion-reduce:transition-none ${cover ? "object-cover" : "object-contain"} ${
            i === index ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"
          }`}
        />
      ))}
    </>
  );
}

/**
 * Hero panel: the intro text (`children`) with a cross-fading picture carousel. The text never sits on the artwork:
 *  - side by side (tablets, and desktops from 1280px): the picture is sized by the panel's width so that its artwork
 *    half lands in the right half of the panel, next to the text;
 *  - stacked (phones, and small desktops where the column is narrow): the picture sits under the text.
 * The pictures keep their own proportions (never stretched); only their outer edges fade into the panel's background.
 * It advances by itself; dots, swipe and (with a dot focused) the arrow keys also change the picture.
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
      aria-label="How Relive works, in pictures"
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
      // @container: the side-by-side picture and text are sized from this panel's width (cqw). The background runs from the page's
      // mint on the text side to the pictures' own lavender on the artwork side, so the pictures blend in without a visible edge.
      className={`@container relative isolate flex flex-col overflow-hidden rounded-[22px] border border-[#dbe7e0] bg-[linear-gradient(100deg,#f5fbf7_0%,#f2f7f8_44%,#e2e5fc_100%)] shadow-[0_10px_35px_rgba(28,62,44,0.06)] ${className}`}
    >
      {/* Side by side: whole picture, right-aligned and vertically centred, 94% of the panel wide (or as tall as the panel if that
          is smaller), so its artwork starts just past the middle. Top, bottom and left edges fade into the background. */}
      <div
        aria-hidden="true"
        className="absolute right-0 top-1/2 -z-10 hidden aspect-[3/2] h-[min(100%,62.6cqw)] -translate-y-1/2 [mask-composite:intersect] [mask-image:linear-gradient(to_bottom,transparent,#000_10%,#000_82%,transparent),linear-gradient(to_right,transparent_30%,#000_50%)] sm:block lg:hidden xl:block"
      >
        <Slides index={index} />
      </div>

      <div className="relative min-w-0 sm:my-auto lg:my-0 xl:my-auto">{children}</div>

      {/* Stacked: the picture in its own space under the text; its top and bottom edges fade into the panel */}
      <div className="relative -mt-2 aspect-[4/3] w-full [mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_88%,transparent)] sm:hidden lg:block lg:aspect-[3/2] xl:hidden">
        <Slides index={index} cover />
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
