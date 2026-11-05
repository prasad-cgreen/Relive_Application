import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const hashMobile = (value: string) => createHmac("sha256", env.SESSION_SECRET).update(`mobile:${value}`).digest("hex");
export const hashPan = (value: string) => createHmac("sha256", env.SESSION_SECRET).update(`pan:${value}`).digest("hex");
export const hashOtp = (transactionId: string, otp: string) => createHmac("sha256", env.OTP_PEPPER).update(`${transactionId}:${otp}`).digest("hex");
export const hashToken = (token: string) => createHmac("sha256", env.SESSION_SECRET).update(`session:${token}`).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const secureEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
