-- OTPs sent by IndiConnect are verified by the provider, so no local hash exists for them.
ALTER TABLE "otp_transactions" ALTER COLUMN "otp_hash" DROP NOT NULL;
ALTER TABLE "otp_transactions" ADD COLUMN "provider_ref" TEXT;
