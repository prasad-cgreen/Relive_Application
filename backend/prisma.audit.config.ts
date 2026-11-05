import { defineConfig } from "prisma/config";
import { config } from "dotenv";

config({ path: "../frontend/.env.local" });

function auditUrl() {
  if (process.env.AUDIT_DATABASE_URL_UNPOOLED) return process.env.AUDIT_DATABASE_URL_UNPOOLED;
  const source = process.env.DATABASE_URL_UNPOOLED;
  if (!source) throw new Error("DATABASE_URL_UNPOOLED is required");
  const url = new URL(source);
  url.pathname = "/relive_audit";
  return url.toString();
}

export default defineConfig({
  schema: "prisma/audit/schema.prisma",
  migrations: { path: "prisma/audit/migrations" },
  datasource: { url: auditUrl() },
});
