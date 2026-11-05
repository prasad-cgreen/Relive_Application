-- Baseline for the health-check table created before Prisma was introduced.
CREATE TABLE "app_status" (
  "id" TEXT NOT NULL,
  "schema_version" INTEGER NOT NULL,
  "environment" TEXT NOT NULL,
  "deployed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "app_status_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_status" ("id", "schema_version", "environment")
VALUES ('relive', 1, 'production');
