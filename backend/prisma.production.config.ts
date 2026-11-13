import { defineConfig, env } from "prisma/config";
import { config } from "dotenv";

config({ path: [".env", "../frontend/.env.local"], quiet: true });

export default defineConfig({
  schema: "prisma/production/schema.prisma",
  migrations: { path: "prisma/production/migrations" },
  datasource: { url: env("DATABASE_URL_UNPOOLED") },
});
