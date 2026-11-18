-- The bureau's PDF of a report, copied while its temporary link still works (the link expires soon after the pull).
-- CreateTable
CREATE TABLE "credit_report_pdfs" (
    "report_id" UUID NOT NULL,
    "content" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_report_pdfs_pkey" PRIMARY KEY ("report_id")
);

-- AddForeignKey
ALTER TABLE "credit_report_pdfs" ADD CONSTRAINT "credit_report_pdfs_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "credit_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
