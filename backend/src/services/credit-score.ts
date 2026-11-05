import { production } from "../database/clients.js";
import { getWorkflow } from "./workflow.js";

type ScoreBand = {
  key: "POOR" | "FAIR" | "GOOD" | "VERY_GOOD" | "EXCELLENT";
  label: string;
  min: number;
  max: number;
  color: string;
  insight: string;
};

const bureauScoreConfig: Record<string, { min: number; max: number; bands: ScoreBand[] }> = {
  EXPERIAN: {
    min: 300,
    max: 900,
    bands: [
      { key: "POOR", label: "Poor", min: 300, max: 579, color: "#ef4444", insight: "Start with your payment history and review your report for issues that need attention." },
      { key: "FAIR", label: "Fair", min: 580, max: 669, color: "#f97316", insight: "You are building momentum. Timely payments and lower balances can help strengthen your score." },
      { key: "GOOD", label: "Good", min: 670, max: 739, color: "#eab308", insight: "Your score is in a healthy range. Keep balances controlled and payments consistent." },
      { key: "VERY_GOOD", label: "Very Good", min: 740, max: 799, color: "#84cc16", insight: "Your score is very good. Continue your strong payment and credit-use habits." },
      { key: "EXCELLENT", label: "Excellent", min: 800, max: 900, color: "#22c55e", insight: "Your score is excellent. Keep maintaining your healthy credit habits." },
    ],
  },
};

function scoreConfig(bureau: string) {
  return bureauScoreConfig[bureau.toUpperCase()] ?? null;
}

function categoryFor(score: number, bands: ScoreBand[]) {
  return bands.find((band) => score >= band.min && score <= band.max) ?? null;
}

export async function getCreditOverview(userId: string) {
  const [latestReport, workflow] = await Promise.all([
    production.creditReport.findFirst({ where: { userId }, orderBy: { retrievedAt: "desc" } }),
    getWorkflow(userId),
  ]);

  if (!latestReport) {
    return {
      status: "MISSING" as const,
      score: null,
      bureau: null,
      scoreRange: null,
      category: null,
      insight: "Complete the secure setup to retrieve your credit score.",
      retrievedAt: null,
      expiresAt: null,
      report: null,
      nextStage: workflow.stage,
    };
  }

  const config = scoreConfig(latestReport.bureau);
  const expired = latestReport.expiresAt <= new Date() || latestReport.status === "EXPIRED";
  const category = config ? categoryFor(latestReport.score, config.bands) : null;

  return {
    status: expired ? ("EXPIRED" as const) : latestReport.status,
    score: latestReport.score,
    bureau: latestReport.bureau,
    scoreRange: config && { min: config.min, max: config.max, bands: config.bands.map(({ insight: _insight, ...band }) => band) },
    category: category && { key: category.key, label: category.label, color: category.color },
    insight: category?.insight ?? "Your credit score is available. Review your report for more detail.",
    retrievedAt: latestReport.retrievedAt,
    expiresAt: latestReport.expiresAt,
    report: latestReport.reportJson,
    nextStage: workflow.stage,
  };
}
