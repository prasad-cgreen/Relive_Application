// Saves a customer's stored credit report PDF (credit_report_pdfs.content) to a file.
//   npm run report-pdf -w backend -- 831ea234-c8d6-47a5-8daf-a628e90aef32    by credit_reports.id (= credit_report_pdfs.report_id)
// The file holds personal data: files land in backend/exports/, which Git ignores. Every download is written to the audit log.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit, production } from "./clients.js";

const reportId = process.argv[2]?.trim() ?? "";

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reportId)) {
  console.log("Give the report id (credit_reports.id), like 831ea234-c8d6-47a5-8daf-a628e90aef32.");
} else {
  const pdf = await production.creditReportPdf.findUnique({ where: { reportId }, include: { report: { select: { userId: true } } } });
  if (!pdf) {
    console.log(`No stored PDF for report ${reportId}.`);
  } else {
    const folder = join(process.cwd(), "exports");
    mkdirSync(folder, { recursive: true });
    const file = join(folder, `credit-report_${reportId}.pdf`);
    writeFileSync(file, pdf.content);
    await audit.auditLog.create({ data: { eventType: "REPORT_PDF_EXPORTED", userRef: pdf.report.userId, status: "SUCCESS", metadata: { reportId, via: "report-pdf script" } } });
    console.log(`PDF (${Math.round(pdf.content.length / 1024)} KB) saved to:\n${file}`);
  }
}

await Promise.all([production.$disconnect(), audit.$disconnect()]);
