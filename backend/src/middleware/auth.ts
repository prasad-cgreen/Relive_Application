import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { production } from "../database/clients.js";
import { hashToken } from "../lib/crypto.js";
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

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.cookies?.[SESSION_COOKIE]) throw new HttpError(401, "AUTH_REQUIRED", "Please log in to continue");
    const session = await findSession(req);
    if (!session) throw new HttpError(401, "SESSION_EXPIRED", "Your session has expired. Please log in again");
    req.userId = session.userId;
    next();
  } catch (error) { next(error); }
}
