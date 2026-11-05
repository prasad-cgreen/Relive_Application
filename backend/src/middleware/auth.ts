import type { NextFunction, Request, Response } from "express";
import { production } from "../database/clients.js";
import { hashToken } from "../lib/crypto.js";
import { HttpError } from "../lib/errors.js";

declare global {
  namespace Express { interface Request { userId?: string; requestId?: string } }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.relive_session as string | undefined;
    if (!token) throw new HttpError(401, "AUTH_REQUIRED", "Please log in to continue");
    const session = await production.userSession.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new HttpError(401, "SESSION_EXPIRED", "Your session has expired. Please log in again");
    }
    req.userId = session.userId;
    next();
  } catch (error) { next(error); }
}
