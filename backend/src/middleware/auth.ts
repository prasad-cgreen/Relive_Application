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

// Agents admin page: one shared password (ADMIN_PASSWORD). The cookie is "<expiry>.<signature>"; the signature covers
// the password, so changing ADMIN_PASSWORD signs everyone out.
export const ADMIN_COOKIE = "relive_admin";
export const ADMIN_TTL_MS = 8 * 60 * 60_000;
export const adminToken = (expiresAt: number) =>
  `${expiresAt}.${createHmac("sha256", env.SESSION_SECRET).update(`admin:${expiresAt}:${env.ADMIN_PASSWORD}`).digest("base64url")}`;

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!env.ADMIN_PASSWORD) return next(new HttpError(404, "ADMIN_DISABLED", "The admin page is switched off. Set ADMIN_PASSWORD on the server to switch it on"));
  const token = req.cookies?.[ADMIN_COOKIE] as string | undefined;
  const expiresAt = Number(token?.split(".")[0]);
  if (!token || !(expiresAt > Date.now()) || !secureEqual(token, adminToken(expiresAt))) {
    return next(new HttpError(401, "ADMIN_AUTH_REQUIRED", "Please enter the admin password"));
  }
  next();
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
