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
