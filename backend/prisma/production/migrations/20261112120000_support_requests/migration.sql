-- CreateEnum
CREATE TYPE "SupportTopic" AS ENUM ('OPTIONS', 'LENDER_DISCUSSION', 'NOTICE');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('NEW', 'CONTACTED', 'CLOSED');

-- CreateTable
CREATE TABLE "support_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "topic" "SupportTopic" NOT NULL,
    "account_label" TEXT,
    "question" TEXT NOT NULL,
    "preferred_time" TEXT NOT NULL,
    "preferred_language" TEXT NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_requests_status_created_at_idx" ON "support_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
