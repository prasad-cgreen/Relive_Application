import QRCode from "qrcode";
import type { referralSchema } from "@relive/shared";
import type { z } from "zod";
import { production } from "../database/clients.js";
import { decrypt, encrypt, hashMobile } from "../lib/crypto.js";
import { HttpError } from "../lib/errors.js";
import { writeAudit } from "./audit.js";

/**
 * An agent's QR code link: the landing page opens the login with the agent locked in as the referrer. It carries the
 * agent's id, not their mobile number, so sharing the link doesn't share the number.
 */
export const referralLink = (site: string, agentId: string) => `${site.replace(/\/+$/, "")}/?login=1&ref=${agentId}`;
export const QR_OPTIONS = { width: 800, margin: 2 };
/** The agent's QR code as a PNG data URL (shown and downloaded on the admin page). */
export const agentQr = (site: string, agentId: string) => QRCode.toDataURL(referralLink(site, agentId), QR_OPTIONS);

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
 * Every agent, newest first, with the users they referred: referrals made with the agent's number since they were added
 * as an agent (earlier ones, from when the number was an ordinary user's, don't count), and how many came via their QR.
 */
export async function listAgents() {
  const [agents, counts] = await Promise.all([
    production.agent.findMany({ orderBy: { createdAt: "desc" } }),
    production.$queryRaw<{ id: string; referrals: number; via_qr: number }[]>`
      SELECT a.id::text AS id, count(*)::int AS referrals, (count(*) FILTER (WHERE r.source = 'QR'))::int AS via_qr
      FROM agents a JOIN referrals r ON r.agent_mobile_hash = a.mobile_hash AND r.created_at >= a.created_at
      GROUP BY a.id`,
  ]);
  const byAgent = new Map(counts.map((row) => [row.id, row]));
  return agents.map((agent) => ({
    id: agent.id, name: agent.name, mobile: decrypt(agent.mobileEncrypted), active: agent.active,
    referrals: byAgent.get(agent.id)?.referrals ?? 0, viaQr: byAgent.get(agent.id)?.via_qr ?? 0, createdAt: agent.createdAt.toISOString(),
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
  let mobile: string;
  if ("agentId" in input) {
    const qrAgent = await production.agent.findFirst({ where: { id: input.agentId, active: true }, select: { mobileEncrypted: true } });
    if (!qrAgent) throw new HttpError(422, "REFERRAL_NOT_FOUND", "This QR code is no longer active. Enter a referrer's number, or leave the field blank");
    mobile = decrypt(qrAgent.mobileEncrypted);
  } else {
    mobile = input.mobile;
  }
  const mobileHash = hashMobile(mobile);
  const [self, agent, referrer] = await Promise.all([
    production.user.findUnique({ where: { id: userId }, select: { mobileHash: true } }),
    production.agent.findFirst({ where: { mobileHash, active: true }, select: { id: true } }),
    production.user.findUnique({ where: { mobileHash }, select: { id: true } }),
  ]);
  if (self?.mobileHash === mobileHash) throw new HttpError(422, "REFERRAL_SELF", "You can't use your own mobile number as a referral code");
  if (!agent && !referrer) throw new HttpError(422, "REFERRAL_NOT_FOUND", "We couldn't find this referral number. Check it, or leave the field blank");
  return { mobile, agentUserId: referrer?.id ?? null, isAgent: Boolean(agent), source: input.source };
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
