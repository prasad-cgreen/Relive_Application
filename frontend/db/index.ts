import { neon } from "@neondatabase/serverless";
import { parseEnv } from "@neon/env";
import { drizzle } from "drizzle-orm/neon-http";
import config from "../neon";
import * as schema from "./schema";

/**
 * Creates a request-safe Drizzle client using Neon's pooled HTTP endpoint.
 * The URL is validated against neon.ts and never exposed to client modules.
 */
export function getDb() {
  const { postgres } = parseEnv(config, ["DATABASE_URL"]);
  const sql = neon(postgres.databaseUrl);

  return drizzle(sql, { schema });
}
