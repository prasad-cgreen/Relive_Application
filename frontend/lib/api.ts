import axios from "axios";

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api/v1",
  withCredentials: true,
  timeout: 10_000,
  headers: { "Content-Type": "application/json" },
});

export function apiMessage(error: unknown) {
  if (axios.isAxiosError(error)) return error.response?.data?.error?.message ?? (error.code === "ECONNABORTED" ? "The request timed out. Please try again" : "Unable to reach Relive securely");
  return "Something went wrong. Please try again";
}
