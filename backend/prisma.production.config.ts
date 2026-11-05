import { defineConfig, env } from "prisma/config";
import { config } from "dotenv";

config({ path: "../frontend/.env.local" });

export default defineConfig({
  schema: "prisma/production/schema.prisma",
  migrations: { path: "prisma/production/migrations" },
  datasource: { url: env("DATABASE_URL_UNPOOLED") },
});
