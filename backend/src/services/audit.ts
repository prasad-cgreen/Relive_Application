import { audit } from "../database/clients.js";
import type { Prisma } from "../generated/audit/client.js";

type AuditEvent = {
  eventType: string;
  userRef?: string;
  transactionId?: string;
  status: string;
  requestId?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAudit(event: AuditEvent) {
  await audit.auditLog.create({ data: event });
}

export type JourneyStep = "MOBILE" | "OTP" | "PAN" | "DETAILS" | "REPORT" | "ALT_MOBILE" | "DASHBOARD";
type Counter = "otpSends" | "otpFailures" | "panAttempts" | "reportAttempts";

/**
 * Records one login/onboarding step: an audit_logs event (full history) plus the user's
 * onboarding_journeys row (current position, counters). Never pass full mobile/PAN numbers.
 */
export async function trackJourney(event: {
  userRef: string;
  eventType: string;
  step: JourneyStep; // where the user is after this event
  outcome: string; // "SUCCESS" or an error code
  requestId?: string;
  transactionId?: string;
  metadata?: Record<string, Prisma.InputJsonValue | null>;
  increment?: Counter[];
  set?: {
    mobileLast4?: string;
    status?: "IN_PROGRESS" | "COMPLETED" | "NO_CREDIT_HISTORY";
    identitySource?: "PAN" | "MANUAL";
    panLast4?: string;
    altMobileLast4?: string;
    bureau?: string;
  };
}) {
  const { userRef, eventType, step, outcome, increment = [], set = {} } = event;
  const now = new Date();
  await writeAudit({
    eventType, userRef, status: outcome, requestId: event.requestId, transactionId: event.transactionId,
    metadata: { step, ...event.metadata },
  });
  const counters = Object.fromEntries(increment.map((counter) => [counter, { increment: 1 }]));
  const finished = set.status && set.status !== "IN_PROGRESS" ? { completedAt: now } : {};
  await audit.onboardingJourney.upsert({
    where: { userRef },
    create: {
      userRef, currentStep: step, lastEvent: eventType, lastOutcome: outcome, lastActivityAt: now, ...set, ...finished,
      ...Object.fromEntries(increment.map((counter) => [counter, 1])),
    },
    update: { currentStep: step, lastEvent: eventType, lastOutcome: outcome, lastActivityAt: now, ...set, ...finished, ...counters },
  });
}

/** Maps the workflow stage to the journey step the user lands on. */
export const stepForStage = (stage: string): JourneyStep =>
  stage === "DASHBOARD" ? "DASHBOARD" : stage === "REPORT" ? "REPORT" : "PAN";
