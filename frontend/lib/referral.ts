// An agent's QR code opens "/?login=1&ref=<agent id>" (QR codes printed earlier carry the agent's mobile number
// instead). The landing page keeps it for this tab (sessionStorage: it survives a refresh mid-signup, not a shared
// phone's next visitor), and onboarding locks it in as the referral, showing the agent's number fetched after sign-in.
const KEY = "relive:qr-referral";
const MOBILE = /^[6-9]\d{9}$/;
const AGENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isReferralMobile = (value: string) => MOBILE.test(value);
export const isAgentId = (value: string) => AGENT_ID.test(value);

export function rememberQrReferral(value: string | null) {
  const raw = (value ?? "").trim();
  const ref = AGENT_ID.test(raw) ? raw.toLowerCase() : raw.replace(/\D/g, "").slice(-10);
  if (!AGENT_ID.test(ref) && !isReferralMobile(ref)) return;
  try {
    sessionStorage.setItem(KEY, ref);
  } catch {
    /* storage blocked: the user can still type the number */
  }
}

export function qrReferral() {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

/** The request body for a referral that came from a QR code: the agent's id, or the number on an older QR code. */
export const qrReferralBody = (ref: string) => (AGENT_ID.test(ref) ? { agentId: ref, source: "QR" } : { mobile: ref, source: "QR" });

/** After a QR referral was rejected (e.g. the agent was deactivated): stop locking it in. */
export function forgetQrReferral() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
