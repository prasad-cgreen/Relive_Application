-- Existing timestamp columns hold UTC (Prisma writes UTC): read them as UTC while converting to timestamptz.
SET timezone = 'UTC';

-- AlterTable
ALTER TABLE "audit_logs" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "error_logs" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "onboarding_journeys" ALTER COLUMN "started_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "last_activity_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "completed_at" SET DATA TYPE TIMESTAMPTZ(3);

