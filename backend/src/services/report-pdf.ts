// The bureau's own PDF of a credit report. IndiConnect returns a temporary (pre-signed S3) link that stops
// working soon after the pull, so the PDF is copied into our database while the link is still valid.
import { production } from "../database/clients.js";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 20_000;

/** The PDF link in a stored bureau response (Experian or CRIF), if it has one. */
export function reportPdfLink(raw: unknown): string | undefined {
  const fields = raw as { experian_report_link?: unknown; credit_report_link?: unknown } | null | undefined;
  return [fields?.experian_report_link, fields?.credit_report_link].find((link): link is string => typeof link === "string" && /^https:\/\//.test(link));
}

/** Downloads the PDF. Null when the link has expired, is unreachable, or does not return a PDF. */
export async function downloadReportPdf(url: string): Promise<Buffer | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
    if (!response.ok) return null; // an expired link answers 400/403 with an XML error
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_PDF_BYTES) return null;
    return bytes.subarray(0, 5).toString("latin1") === "%PDF-" ? bytes : null;
  } catch {
    return null;
  }
}

/** Copies the report's PDF into the database. Best effort: never throws, so it cannot fail a report pull. */
export async function saveReportPdf(reportId: string, raw: unknown): Promise<Buffer | null> {
  try {
    const url = reportPdfLink(raw);
    const bytes = url ? await downloadReportPdf(url) : null;
    if (!bytes) return null;
    const content = new Uint8Array(bytes);
    await production.creditReportPdf.upsert({ where: { reportId }, create: { reportId, content }, update: { content } });
    return bytes;
  } catch {
    return null;
  }
}
