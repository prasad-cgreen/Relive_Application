CREATE TABLE "onboarding_journeys" (
    "user_ref" TEXT NOT NULL,
    "mobile_last4" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "current_step" TEXT NOT NULL,
    "last_event" TEXT NOT NULL,
    "last_outcome" TEXT NOT NULL,
    "identity_source" TEXT,
    "pan_last4" TEXT,
    "alt_mobile_last4" TEXT,
    "bureau" TEXT,
    "otp_sends" INTEGER NOT NULL DEFAULT 0,
    "otp_failures" INTEGER NOT NULL DEFAULT 0,
    "pan_attempts" INTEGER NOT NULL DEFAULT 0,
    "report_attempts" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "onboarding_journeys_pkey" PRIMARY KEY ("user_ref")
);
CREATE INDEX "onboarding_journeys_status_last_activity_at_idx" ON "onboarding_journeys"("status", "last_activity_at");
