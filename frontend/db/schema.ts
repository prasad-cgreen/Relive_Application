import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const appStatus = pgTable("app_status", {
  id: text("id").primaryKey(),
  schemaVersion: integer("schema_version").notNull(),
  environment: text("environment").notNull(),
  deployedAt: timestamp("deployed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
