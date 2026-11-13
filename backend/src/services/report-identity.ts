/**
 * Does a bureau report belong to the signed-in user?
 * The pull is keyed on name + OTP-verified mobile only, so a shared phone, a recycled number or a SIM swap
 * could return someone else's report. Before showing it, the PAN / date of birth the lenders reported must
 * match what we know about the user.
 */

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
// Echo of our own request (name + mobile we sent): never evidence of identity.
const SKIP_KEYS = /^current_?application/i;

export type ReportIdentity = { pans: Set<string>; dobs: Set<string> };

/** "19920614" | "14-06-1992" | "1992-06-14" | "14/06/1992" -> "1992-06-14" */
export function normalizeReportDob(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Collects every PAN and date of birth in the raw response, whatever the bureau's layout (Experian, CRIF). */
export function extractReportIdentity(raw: unknown): ReportIdentity {
  const identity: ReportIdentity = { pans: new Set(), dobs: new Set() };
  const walk = (node: unknown, key: string, depth: number) => {
    if (depth > 20 || node == null) return;
    if (Array.isArray(node)) return node.forEach((item) => walk(item, key, depth + 1));
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) if (!SKIP_KEYS.test(k)) walk(v, k, depth + 1);
      return;
    }
    if (typeof node !== "string" && typeof node !== "number") return;
    const value = String(node).trim().toUpperCase();
    if (/pan/i.test(key) && PAN_RE.test(value)) identity.pans.add(value);
    if (/birth|dob/i.test(key)) {
      const dob = normalizeReportDob(value);
      if (dob) identity.dobs.add(dob);
    }
  };
  walk(raw, "", 0);
  return identity;
}

/**
 * Did the bureau actually receive the PAN / DOB we sent? Experian echoes our request under Current_Application,
 * so this tells us (per pull, in the journey log) whether IndiConnect forwards those fields.
 */
export function echoedRequestIdentity(raw: unknown): { pan: boolean; dob: boolean } {
  const echo = { pan: false, dob: false };
  const walk = (node: unknown, key: string, inEcho: boolean, depth: number) => {
    if (depth > 20 || node == null) return;
    if (Array.isArray(node)) return node.forEach((item) => walk(item, key, inEcho, depth + 1));
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, k, inEcho || SKIP_KEYS.test(k), depth + 1);
      return;
    }
    if (!inEcho) return;
    const value = String(node).trim().toUpperCase();
    if (/pan/i.test(key) && PAN_RE.test(value)) echo.pan = true;
    if (/birth|dob/i.test(key) && normalizeReportDob(value)) echo.dob = true;
  };
  walk(raw, "", false, 0);
  return echo;
}

export type IdentityVerdict = "MATCH" | "MISMATCH" | "UNVERIFIABLE";

/**
 * PAN wins when both sides have one (strong). Otherwise date of birth.
 * ponytail: DOB is a weak check against someone who knows the person (family); verified PAN closes that.
 */
export function matchReportIdentity(
  identity: ReportIdentity,
  user: { verifiedPanHash: string | null; dateOfBirth: string | null },
  hashPan: (pan: string) => string,
): IdentityVerdict {
  if (user.verifiedPanHash && identity.pans.size) {
    return [...identity.pans].some((pan) => hashPan(pan) === user.verifiedPanHash) ? "MATCH" : "MISMATCH";
  }
  if (user.dateOfBirth && identity.dobs.size) return identity.dobs.has(user.dateOfBirth) ? "MATCH" : "MISMATCH";
  return "UNVERIFIABLE";
}
