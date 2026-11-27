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

// ─── Scan location ───────────────────────────────────────────────────────────
// Where the QR code was scanned: the customer's phone GPS (optional — they can deny the prompt) plus the place printed
// into the QR (?loc=). Captured on the landing page and sent when the referral is saved, so we can see which shops and
// malls bring in leads, and spot a QR that was copied to a different place.
const LOC_KEY = "relive:qr-scan-loc";
type ScanLocation = { lat?: number; lng?: number; accuracy?: number; label?: string };

const readScan = (): ScanLocation => {
  try {
    return { ...(JSON.parse(sessionStorage.getItem(LOC_KEY) || "{}") as ScanLocation) };
  } catch {
    return {};
  }
};
const writeScan = (value: ScanLocation) => {
  try {
    if (value.lat === undefined && value.lng === undefined && !value.label) return;
    sessionStorage.setItem(LOC_KEY, JSON.stringify(value));
  } catch {
    /* storage blocked: location is optional, signup continues */
  }
};

/**
 * On a QR arrival, remember the place printed into the QR (?loc=) and silently ask the browser for the phone's
 * location. If the customer allows it, the coordinates are added; if they deny it or it's unavailable, only the
 * printed label (if any) is kept. Never blocks: geolocation resolves in the background.
 */
export function captureScanLocation(params: URLSearchParams) {
  const label = (params.get("loc") ?? "").trim().slice(0, 120);
  if (label) writeScan({ ...readScan(), label });
  // Geolocation needs a secure context (HTTPS, or localhost): on a plain-http LAN address the prompt never shows.
  if (typeof navigator === "undefined" || !navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (position) => writeScan({ ...readScan(), lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
    () => undefined, // denied or unavailable: fine, the label alone still tells us the intended place
    { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
  );
}

/** The scan location for a referral request, or undefined when nothing was captured. */
export function scanLocationBody(): ScanLocation | undefined {
  const scan = readScan();
  return scan.lat !== undefined || scan.label ? scan : undefined;
}

/** The request body for a referral that came from a QR code: the agent's id, or the number on an older QR code. */
export const qrReferralBody = (ref: string) => {
  const base = AGENT_ID.test(ref) ? { agentId: ref, source: "QR" } : { mobile: ref, source: "QR" };
  const location = scanLocationBody();
  return location ? { ...base, location } : base;
};

/** After a QR referral was rejected (e.g. the agent was deactivated): stop locking it in. */
export function forgetQrReferral() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(LOC_KEY);
  } catch {
    /* ignore */
  }
}
