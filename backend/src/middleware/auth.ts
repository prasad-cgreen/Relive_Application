import type { NextFunction, Request, Response } from "express";
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
  return session && !session.revokedAt && session.expiresAt > new Date() ? session : null;
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
