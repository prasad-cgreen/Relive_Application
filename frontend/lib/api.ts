import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4100/api/v1",
  withCredentials: true,
  // Must outlast the backend's worst case, or the browser gives up while the server still sends the OTP:
  // Turnstile 10s + INDICONNECT_TIMEOUT_MS 30s (PAN retries once: 2 x 30s). /credit/report sets its own longer timeout.
  timeout: 90_000,
  headers: { "Content-Type": "application/json" },
});

export function apiErrorCode(error: unknown): string | undefined {
  return axios.isAxiosError(error) ? error.response?.data?.error?.code : undefined;
}

export function apiRetryAfter(error: unknown): number | undefined {
  return axios.isAxiosError(error) ? error.response?.data?.error?.details?.retryAfterSeconds : undefined;
}

export function apiMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message ?? (error.code === "ECONNABORTED" ? "The request timed out. Please try again" : "Unable to reach Relive securely");
  return "Something went wrong. Please try again";
}
