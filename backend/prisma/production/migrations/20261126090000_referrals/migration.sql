-- Referrals and company agents. Reconstructed from the production database: this migration was applied there on
-- 2026-11-26 from work not in this repository. If the original file turns up, keep whichever matches production.
-- CreateEnum
CREATE TYPE "ReferralSource" AS ENUM ('QR', 'MANUAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referral_code" TEXT;

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mobile_hash" TEXT NOT NULL,
    "mobile_last4" TEXT NOT NULL,
    "mobile_encrypted" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL,
    "referred_user_id" UUID NOT NULL,
    "agent_user_id" UUID,
    "agent_mobile_hash" TEXT NOT NULL,
    "agent_mobile_encrypted" TEXT,
    "agent_mobile_last4" TEXT NOT NULL,
    "source" "ReferralSource" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agents_mobile_hash_key" ON "agents"("mobile_hash");

-- CreateIndex
CREATE UNIQUE INDEX "referrals_referred_user_id_key" ON "referrals"("referred_user_id");

-- CreateIndex
CREATE INDEX "referrals_agent_user_id_created_at_idx" ON "referrals"("agent_user_id", "created_at");

-- CreateIndex
CREATE INDEX "referrals_agent_mobile_hash_idx" ON "referrals"("agent_mobile_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_referral_code_key" ON "users"("referral_code");

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_agent_user_id_fkey" FOREIGN KEY ("agent_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- A user cannot refer themselves.
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_not_self" CHECK ("agent_user_id" IS DISTINCT FROM "referred_user_id");
