-- Landing-page answers (selected_concern, customer_text) and the AI dashboard summaries built from them.
-- CreateTable
CREATE TABLE "user_concerns" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "selected_concern" TEXT[],
    "customer_text_encrypted" TEXT,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_concerns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_insights" (
    "id" UUID NOT NULL,
    "report_id" UUID NOT NULL,
    "input_hash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_insights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_concerns_user_id_key" ON "user_concerns"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_insights_report_id_input_hash_key" ON "dashboard_insights"("report_id", "input_hash");

-- AddForeignKey
ALTER TABLE "user_concerns" ADD CONSTRAINT "user_concerns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_insights" ADD CONSTRAINT "dashboard_insights_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "credit_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

