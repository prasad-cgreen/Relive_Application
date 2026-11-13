import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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

// AES-256-GCM for values we must read back (e.g. the mobile number sent to bureaus). Format: iv.tag.ciphertext (base64url)
const dataKey = createHash("sha256").update(env.DATA_ENCRYPTION_KEY).digest();
export const encrypt = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey, iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString("base64url")).join(".");
};
export const decrypt = (sealed: string) => {
  const [iv, tag, body] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", dataKey, iv!);
  decipher.setAuthTag(tag!);
  return Buffer.concat([decipher.update(body!), decipher.final()]).toString("utf8");
};
