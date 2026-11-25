"use client";

import { useEffect } from "react";
import { api } from "./api";

export type Session = { authenticated: true; stage: "PROFILE" | "REPORT" | "DASHBOARD"; expiresAt: string } | { authenticated: false };

/**
 * Browser-side hint that this visitor reached the dashboard. Not a credential (the httpOnly cookie is):
 * it only lets the landing page hide itself while it checks the session, so Back from /portal doesn't
 * flash the landing page before redirecting. The inline script in app/layout.tsx reads the same key.
 */
export const SIGNED_IN_HINT = "relive:signed-in";

export function hasSignedInHint() {
  try {
    return localStorage.getItem(SIGNED_IN_HINT) === "1";
  } catch {
    return false; // storage blocked
  }
}

export function setSignedInHint(on: boolean) {
  try {
    if (on) localStorage.setItem(SIGNED_IN_HINT, "1");
    else localStorage.removeItem(SIGNED_IN_HINT);
  } catch {
    /* storage blocked: the guard still works, just with a brief flash */
  }
}

/** Server-validated session. Throws on network errors, so being offline never logs anyone out. */
export async function getSession() {
  const { data } = await api.get<Session>("/auth/session");
  return data;
}

/**
 * No valid session on a protected page: back to the login dialog, without a history entry. "Session expired"
 * is only said when this browser was signed in (not after an explicit logout or for a first-time visitor).
 */
let redirecting = false; // several 401s can arrive together: only the first one decides where to go

export function redirectToLogin() {
  if (redirecting) return;
  redirecting = true;
  const wasSignedIn = hasSignedInHint();
  setSignedInHint(false);
  window.location.replace(wasSignedIn ? "/?login=1&expired=1" : "/?login=1");
}

export async function logout() {
  setSignedInHint(false);
  try {
    await api.post("/auth/logout");
  } finally {
    // replace: Back must not return to the dashboard page that was just left.
    window.location.replace("/");
  }
}

/**
 * Keeps a protected page honest: redirects to login on any 401, when the session's expiry time passes,
 * and re-checks when the tab regains focus, when the page is restored from the back/forward cache,
 * and when another tab logs out.
 */
export function useSessionGuard() {
  useEffect(() => {
    let timer: number | undefined;
    let stopped = false;

    const check = async () => {
      let session: Session;
      try {
        session = await getSession();
      } catch {
        return; // offline or API down: keep the page, the next check decides
      }
      if (stopped) return;
      if (!session.authenticated) return redirectToLogin();
      window.clearTimeout(timer);
      // setTimeout overflows above ~24.8 days; sessions are 8 h.
      const wait = Math.min(Math.max(new Date(session.expiresAt).getTime() - Date.now(), 0) + 1_000, 2 ** 31 - 1);
      timer = window.setTimeout(() => void check(), wait);
    };

    const interceptor = api.interceptors.response.use(undefined, (error) => {
      if (error?.response?.status === 401) redirectToLogin();
      return Promise.reject(error);
    });
    const onVisible = () => document.visibilityState === "visible" && void check();
    const onPageShow = (event: PageTransitionEvent) => event.persisted && void check();
    const onStorage = (event: StorageEvent) => event.key === SIGNED_IN_HINT && event.newValue === null && void check();

    void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("storage", onStorage);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      api.interceptors.response.eject(interceptor);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
}
