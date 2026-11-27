// An agent's QR code opens "/?login=1&ref=<their mobile>". The landing page keeps that number for this tab
// (sessionStorage: it survives a refresh mid-signup, not a shared phone's next visitor), and onboarding shows it
// as a locked referral code.
const KEY = "relive:qr-referral";
const MOBILE = /^[6-9]\d{9}$/;

export const isReferralMobile = (value: string) => MOBILE.test(value);

export function rememberQrReferral(value: string | null) {
  const mobile = (value ?? "").replace(/\D/g, "").slice(-10);
  if (!isReferralMobile(mobile)) return;
  try {
    sessionStorage.setItem(KEY, mobile);
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

/** After a QR number was rejected (e.g. the agent was deactivated): stop locking it in. */
export function forgetQrReferral() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
