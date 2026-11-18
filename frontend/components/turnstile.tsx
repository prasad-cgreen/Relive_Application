"use client";

import { useEffect, useRef, useState } from "react";

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export type CaptchaState = { token: string; failed: boolean };

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};

let script: Promise<TurnstileApi> | undefined;
const loadTurnstile = () =>
  (script ??= new Promise((resolve, reject) => {
    const tag = document.createElement("script");
    tag.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    tag.async = true;
    tag.onload = () => resolve((window as unknown as { turnstile: TurnstileApi }).turnstile);
    tag.onerror = () => {
      script = undefined; // let a later mount retry
      reject(new Error("Turnstile failed to load"));
    };
    document.head.appendChild(tag);
  }));

/** Fetches Cloudflare's script ahead of time, so the check is ready sooner once the login dialog opens. */
export function preloadTurnstile() {
  if (TURNSTILE_SITE_KEY) loadTurnstile().catch(() => undefined);
}

/**
 * Cloudflare Turnstile bot check. Invisible unless Cloudflare wants the visitor to click.
 * Tokens are single-use: re-key the component (key={n}) after each use to get a fresh one.
 * Renders nothing without NEXT_PUBLIC_TURNSTILE_SITE_KEY (local dev).
 * Place it directly above the form's submit button: it takes the full form width and only adds spacing
 * (`spacing` classes) while the "Verify you are human" box is showing.
 */
export function Turnstile({ onChange, spacing = "mb-4" }: { onChange: (state: CaptchaState) => void; spacing?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let id: string | undefined;
    let cancelled = false;
    loadTurnstile().then(
      (turnstile) => {
        if (cancelled || !ref.current) return;
        id = turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action: "otp",
          appearance: "interaction-only",
          size: "flexible", // full form width, aligned with the inputs and button
          "before-interactive-callback": () => setInteractive(true),
          "after-interactive-callback": () => setInteractive(false),
          callback: (token: string) => onChange({ token, failed: false }),
          "expired-callback": () => onChange({ token: "", failed: false }),
          "error-callback": () => onChange({ token: "", failed: true }),
        });
      },
      () => onChange({ token: "", failed: true }),
    );
    return () => {
      cancelled = true;
      if (id) loadTurnstile().then((turnstile) => turnstile.remove(id!), () => undefined);
    };
  }, [onChange]);

  return TURNSTILE_SITE_KEY ? <div ref={ref} className={`w-full empty:hidden ${interactive ? spacing : ""}`} /> : null;
}
