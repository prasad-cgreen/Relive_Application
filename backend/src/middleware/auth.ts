import { createHmac } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { production } from "../database/clients.js";
import { hashToken, secureEqual } from "../lib/crypto.js";
import { HttpError } from "../lib/errors.js";

declare global {
  namespace Express { interface Request { userId?: string; requestId?: string } }
}

export const SESSION_COOKIE = "relive_session";

/** The live (unrevoked, unexpired) session behind the request's cookie, or null. */
export async function findSession(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) return null;
  const session = await production.userSession.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!session || session.revokedAt || session.expiresAt <= new Date()) return null;
  // Local dev: each `npm run dev` starts signed out (sessions from earlier runs don't count). Never in production.
  if (env.NODE_ENV === "development" && env.RELIVE_DEV_RUN_STARTED_AT && session.createdAt.getTime() < env.RELIVE_DEV_RUN_STARTED_AT) return null;
  return session;
}

// Agents admin page: one shared password, stored readable in the admin_password table. The sign-in cookie is
// "<expiry>.<signature>"; the signature covers the password (it is never in the cookie itself), so changing the password
// signs everyone else out.
export const ADMIN_COOKIE = "relive_admin";
export const ADMIN_TTL_MS = 8 * 60 * 60_000;
export const adminToken = (expiresAt: number, password: string) =>
  `${expiresAt}.${createHmac("sha256", env.SESSION_SECRET).update(`admin:${expiresAt}:${password}`).digest("base64url")}`;

/** The stored admin password; none yet = the admin page is switched off. */
export async function adminPassword() {
  const row = await production.adminPassword.findUnique({ where: { id: 1 } });
  if (!row) throw new HttpError(404, "ADMIN_DISABLED", "The admin page has no password yet. A developer can set one with: npm run admin-password -w backend");
  return row.password;
}

/** Saves a new admin password (check it with adminPasswordSchema first). */
export async function setAdminPassword(password: string) {
  await production.adminPassword.upsert({ where: { id: 1 }, create: { id: 1, password }, update: { password } });
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  try {
    const password = await adminPassword();
    const token = req.cookies?.[ADMIN_COOKIE] as string | undefined;
    const expiresAt = Number(token?.split(".")[0]);
    if (!token || !(expiresAt > Date.now()) || !secureEqual(token, adminToken(expiresAt, password))) {
      throw new HttpError(401, "ADMIN_AUTH_REQUIRED", "Please enter the admin password");
    }
    next();
  } catch (error) { next(error); }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.cookies?.[SESSION_COOKIE]) throw new HttpError(401, "AUTH_REQUIRED", "Please log in to continue");
    const session = await findSession(req);
    if (!session) throw new HttpError(401, "SESSION_EXPIRED", "Your session has expired. Please log in again");
    req.userId = session.userId;
    next();
  } catch (error) { next(error); }
}
