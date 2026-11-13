"use client";

import { useEffect, useRef } from "react";

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

/**
 * Cloudflare Turnstile bot check. Invisible unless Cloudflare wants the visitor to click.
 * Tokens are single-use: re-key the component (key={n}) after each use to get a fresh one.
 * Renders nothing without NEXT_PUBLIC_TURNSTILE_SITE_KEY (local dev).
 */
export function Turnstile({ onChange }: { onChange: (state: CaptchaState) => void }) {
  const ref = useRef<HTMLDivElement>(null);

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

  return TURNSTILE_SITE_KEY ? <div ref={ref} className="mt-3 flex justify-center empty:hidden" /> : null;
}
