-- Schema cleanup: drop the unused app_status table, unused columns (otp channel/failed_attempts,
-- kyc attempts, api_transactions metadata) and never-set enum values; timestamps become timestamptz.
-- Existing timestamp columns hold UTC (Prisma writes UTC): read them as UTC while converting to timestamptz.
SET timezone = 'UTC';

-- AlterEnum
BEGIN;
CREATE TYPE "KycStatus_new" AS ENUM ('VERIFIED', 'FAILED', 'MANUAL_REVIEW');
ALTER TABLE "kyc_verifications" ALTER COLUMN "status" TYPE "KycStatus_new" USING ("status"::text::"KycStatus_new");
ALTER TYPE "KycStatus" RENAME TO "KycStatus_old";
ALTER TYPE "KycStatus_new" RENAME TO "KycStatus";
DROP TYPE "public"."KycStatus_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "OtpStatus_new" AS ENUM ('PENDING', 'USED', 'EXPIRED', 'BLOCKED');
ALTER TABLE "public"."otp_transactions" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "otp_transactions" ALTER COLUMN "status" TYPE "OtpStatus_new" USING ("status"::text::"OtpStatus_new");
ALTER TYPE "OtpStatus" RENAME TO "OtpStatus_old";
ALTER TYPE "OtpStatus_new" RENAME TO "OtpStatus";
DROP TYPE "public"."OtpStatus_old";
ALTER TABLE "otp_transactions" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ReportStatus_new" AS ENUM ('CURRENT', 'NO_RECORD');
ALTER TABLE "public"."credit_reports" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "credit_reports" ALTER COLUMN "status" TYPE "ReportStatus_new" USING ("status"::text::"ReportStatus_new");
ALTER TYPE "ReportStatus" RENAME TO "ReportStatus_old";
ALTER TYPE "ReportStatus_new" RENAME TO "ReportStatus";
DROP TYPE "public"."ReportStatus_old";
ALTER TABLE "credit_reports" ALTER COLUMN "status" SET DEFAULT 'CURRENT';
COMMIT;

-- AlterTable
ALTER TABLE "api_transactions" DROP COLUMN "metadata",
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "credit_reports" ALTER COLUMN "retrieved_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "kyc_verifications" DROP COLUMN "attempts",
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "otp_transactions" DROP COLUMN "channel",
DROP COLUMN "failed_attempts",
ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "resend_after" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "verified_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "support_requests" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_consents" ALTER COLUMN "granted_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "withdrawn_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_profiles" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "user_sessions" ALTER COLUMN "expires_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "revoked_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "blocked_until" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMPTZ(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMPTZ(3);

-- DropTable
DROP TABLE "app_status";

-- DropEnum
DROP TYPE "OtpChannel";

