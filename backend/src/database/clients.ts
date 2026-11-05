import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient as ProductionClient } from "../generated/production/client.js";
import { PrismaClient as AuditClient } from "../generated/audit/client.js";
import { databaseUrl, env } from "../config/env.js";

const globalClients = globalThis as unknown as { production?: ProductionClient; audit?: AuditClient };

export const production = globalClients.production ?? new ProductionClient({
  adapter: new PrismaNeon({ connectionString: env.DATABASE_URL }),
});

export const audit = globalClients.audit ?? new AuditClient({
  adapter: new PrismaNeon({ connectionString: databaseUrl("relive_audit") }),
});

if (env.NODE_ENV !== "production") {
  globalClients.production = production;
  globalClients.audit = audit;
}
