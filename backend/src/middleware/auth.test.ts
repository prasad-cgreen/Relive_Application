import type { Request } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const env = { NODE_ENV: "development", RELIVE_DEV_RUN_STARTED_AT: undefined as number | undefined };
const findUnique = vi.fn();
vi.mock("../config/env.js", () => ({ env }));
vi.mock("../database/clients.js", () => ({ production: { userSession: { findUnique } } }));
vi.mock("../lib/crypto.js", () => ({ hashToken: (token: string) => `hash:${token}` }));

const { findSession } = await import("./auth.js");
const req = { cookies: { relive_session: "token" } } as unknown as Request;
const runStart = Date.now();
const session = (createdAt: number) => ({ userId: "u1", revokedAt: null, expiresAt: new Date(runStart + 3_600_000), createdAt: new Date(createdAt) });

describe("findSession across dev runs", () => {
  beforeEach(() => {
    env.NODE_ENV = "development";
    env.RELIVE_DEV_RUN_STARTED_AT = runStart;
  });

  it("ignores a session from an earlier `npm run dev`", async () => {
    findUnique.mockResolvedValue(session(runStart - 1_000));
    expect(await findSession(req)).toBeNull();
  });

  it("keeps a session created during this run", async () => {
    findUnique.mockResolvedValue(session(runStart + 1_000));
    expect(await findSession(req)).not.toBeNull();
  });

  it("never applies in production or without the run marker", async () => {
    findUnique.mockResolvedValue(session(runStart - 1_000));
    env.NODE_ENV = "production";
    expect(await findSession(req)).not.toBeNull();
    env.NODE_ENV = "development";
    env.RELIVE_DEV_RUN_STARTED_AT = undefined;
    expect(await findSession(req)).not.toBeNull();
  });
});
