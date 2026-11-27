import { env } from "../config/env.js";

/**
 * Turns a QR scan's coordinates into a readable address (e.g. "D-Mart, Andheri West, Mumbai"). Best-effort: a failure,
 * a timeout, or geocoding being switched off returns null, and the coordinates are still stored. Only the coordinates
 * are sent to the geocoder — never the customer's name, number or any other detail.
 *
 * Default provider: OpenStreetMap Nominatim. LocationIQ, MapTiler and other Nominatim-compatible services return the
 * same { display_name } shape, so switching is just GEOCODE_URL + GEOCODE_API_KEY.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  if (!env.GEOCODE_ENABLED) return null;
  const url = new URL(env.GEOCODE_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "18"); // building / street level
  if (env.GEOCODE_API_KEY) url.searchParams.set("key", env.GEOCODE_API_KEY);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), env.GEOCODE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      // Nominatim's usage policy asks for an identifying User-Agent; a generic app name, never any user detail.
      headers: { "User-Agent": "ReliveApp/1.0 (+https://relive.co.in)", Accept: "application/json" },
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { display_name?: unknown; error?: unknown };
    return typeof body.display_name === "string" && body.display_name.trim() ? body.display_name.trim().slice(0, 300) : null;
  } catch {
    return null; // network error, timeout/abort, or bad JSON: coordinates alone are still useful
  } finally {
    clearTimeout(timer);
  }
}
