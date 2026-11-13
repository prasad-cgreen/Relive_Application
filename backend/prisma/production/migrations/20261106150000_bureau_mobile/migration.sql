CREATE TYPE "OtpPurpose" AS ENUM ('LOGIN', 'BUREAU_MOBILE');
ALTER TABLE "otp_transactions" ADD COLUMN "purpose" "OtpPurpose" NOT NULL DEFAULT 'LOGIN';
ALTER TABLE "otp_transactions" ADD COLUMN "target_mobile_encrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "bureau_mobile_encrypted" TEXT;
ALTER TABLE "users" ADD COLUMN "bureau_mobile_last4" TEXT;
