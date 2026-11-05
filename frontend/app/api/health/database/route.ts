import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "../../../../db";
import { appStatus } from "../../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();

  try {
    const db = getDb();
    const [status] = await db
      .select({
        schemaVersion: appStatus.schemaVersion,
        environment: appStatus.environment,
        deployedAt: appStatus.deployedAt,
      })
      .from(appStatus)
      .where(eq(appStatus.id, "relive"))
      .limit(1);

    if (!status) {
      return NextResponse.json(
        { status: "degraded", service: "postgres", error: "Database schema is not initialized" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        service: "postgres",
        branch: process.env.NEON_BRANCH ?? "unknown",
        schemaVersion: status.schemaVersion,
        environment: status.environment,
        deployedAt: status.deployedAt.toISOString(),
        latencyMs: Date.now() - startedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Database health check failed", error);
    return NextResponse.json(
      { status: "error", service: "postgres", error: "Database connection failed" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
