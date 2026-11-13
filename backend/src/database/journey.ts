// Prints login/onboarding history from the audit database.
//   npm run journey -w backend -- 9876543210   one user's summary + full timeline
//   npm run journey -w backend                 everyone with unfinished onboarding
import { audit, production } from "./clients.js";
import { hashMobile } from "../lib/crypto.js";

const mobile = process.argv[2]?.replace(/\D/g, "");

if (mobile) {
  const user = await production.user.findUnique({ where: { mobileHash: hashMobile(mobile) }, select: { id: true } });
  if (!user) {
    console.log(`No user for mobile ending ${mobile.slice(-4)}`);
  } else {
    const [journey, events] = await Promise.all([
      audit.onboardingJourney.findUnique({ where: { userRef: user.id } }),
      audit.auditLog.findMany({ where: { userRef: user.id }, orderBy: { createdAt: "asc" } }),
    ]);
    console.log("Journey:", journey ?? "(none recorded)");
    console.table(events.map((event) => ({
      at: event.createdAt.toISOString().replace("T", " ").slice(0, 19),
      event: event.eventType,
      outcome: event.status,
      step: (event.metadata as { step?: string } | null)?.step ?? "",
      details: JSON.stringify(event.metadata ?? {}).slice(0, 120),
    })));
  }
} else {
  const unfinished = await audit.onboardingJourney.findMany({ where: { status: "IN_PROGRESS" }, orderBy: { lastActivityAt: "desc" }, take: 100 });
  console.log(`${unfinished.length} unfinished onboarding journeys (latest first):`);
  console.table(unfinished.map((journey) => ({
    mobile: journey.mobileLast4 ? `••••${journey.mobileLast4}` : "",
    step: journey.currentStep,
    lastEvent: journey.lastEvent,
    lastOutcome: journey.lastOutcome,
    otpSends: journey.otpSends,
    panTries: journey.panAttempts,
    reportTries: journey.reportAttempts,
    lastActivity: journey.lastActivityAt.toISOString().replace("T", " ").slice(0, 16),
  })));
}

await Promise.all([production.$disconnect(), audit.$disconnect()]);
