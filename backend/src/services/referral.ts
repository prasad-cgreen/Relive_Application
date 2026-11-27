import QRCode from "qrcode";
import type { referralSchema } from "@relive/shared";
import type { z } from "zod";
import { production } from "../database/clients.js";
import { decrypt, encrypt, hashMobile } from "../lib/crypto.js";
import { HttpError } from "../lib/errors.js";
import { writeAudit } from "./audit.js";

/** An agent's QR code link: the landing page opens the login, with the agent's number as the locked referral code. */
export const referralLink = (site: string, mobile: string) => `${site.replace(/\/+$/, "")}/?login=1&ref=${mobile}`;
export const QR_OPTIONS = { width: 800, margin: 2 };
/** The agent's QR code as a PNG data URL (shown and downloaded on the admin page). */
export const agentQr = (site: string, mobile: string) => QRCode.toDataURL(referralLink(site, mobile), QR_OPTIONS);

/** Adds an agent, or renames and reactivates the agent with that number. */
export function saveAgent(name: string, mobile: string) {
  const mobileHash = hashMobile(mobile);
  return production.agent.upsert({
    where: { mobileHash },
    create: { name, mobileHash, mobileLast4: mobile.slice(-4), mobileEncrypted: encrypt(mobile) },
    update: { name, active: true },
  });
}

/**
 * Every agent, newest first, with the users they referred (referrals made with the agent's number): all of them, and
 * those who signed up through the agent's QR code.
 */
export async function listAgents() {
  const agents = await production.agent.findMany({ orderBy: { createdAt: "desc" } });
  const counts = await production.referral.groupBy({
    by: ["agentMobileHash", "source"], where: { agentMobileHash: { in: agents.map((agent) => agent.mobileHash) } }, _count: { _all: true },
  });
  const count = (hash: string, source?: "QR") =>
    counts.filter((row) => row.agentMobileHash === hash && (!source || row.source === source)).reduce((sum, row) => sum + row._count._all, 0);
  return agents.map((agent) => ({
    id: agent.id, name: agent.name, mobile: decrypt(agent.mobileEncrypted), active: agent.active,
    referrals: count(agent.mobileHash), viaQr: count(agent.mobileHash, "QR"), createdAt: agent.createdAt.toISOString(),
  }));
}

export type ResolvedReferral = { mobile: string; agentUserId: string | null; isAgent: boolean; source: "QR" | "MANUAL" };

/**
 * Checks a referral code (the referrer's mobile number) before the step that saves it, so a typo is caught before a
 * billed PAN lookup. An active agent's number earns the agent a benefit; any other Relive user's number is recorded
 * without one. A number that is neither, or the user's own, is rejected.
 */
export async function resolveReferral(userId: string, input: z.infer<typeof referralSchema> | undefined): Promise<ResolvedReferral | null> {
  if (!input) return null;
  const mobileHash = hashMobile(input.mobile);
  const [self, agent, referrer] = await Promise.all([
    production.user.findUnique({ where: { id: userId }, select: { mobileHash: true } }),
    production.agent.findFirst({ where: { mobileHash, active: true }, select: { id: true } }),
    production.user.findUnique({ where: { mobileHash }, select: { id: true } }),
  ]);
  if (self?.mobileHash === mobileHash) throw new HttpError(422, "REFERRAL_SELF", "You can't use your own mobile number as a referral code");
  if (!agent && !referrer) throw new HttpError(422, "REFERRAL_NOT_FOUND", "We couldn't find this referral number. Check it, or leave the field blank");
  return { mobile: input.mobile, agentUserId: referrer?.id ?? null, isAgent: Boolean(agent), source: input.source };
}

/**
 * Records a user's referral once: the first accepted one stays, later ones are ignored. The referrer's number is stored
 * like a user's (hash, last 4, encrypted); an agent's referrals are the ones whose hash matches agents.mobile_hash.
 */
export async function saveReferral(userId: string, referral: ResolvedReferral | null, requestId?: string) {
  if (!referral) return;
  const { mobile, agentUserId, isAgent, source } = referral;
  const { count } = await production.referral.createMany({
    data: [{
      referredUserId: userId, agentUserId, source,
      agentMobileHash: hashMobile(mobile), agentMobileLast4: mobile.slice(-4), agentMobileEncrypted: encrypt(mobile),
    }],
    skipDuplicates: true,
  });
  if (count) {
    await writeAudit({ eventType: "REFERRAL_SAVED", userRef: userId, status: "SUCCESS", requestId, metadata: { source, agent: isAgent, referrerLast4: mobile.slice(-4) } });
  }
}
