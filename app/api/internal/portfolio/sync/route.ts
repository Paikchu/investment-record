import { getD1 } from "@/db";
import type { FlexRawSyncInput } from "@/lib/ibkr-flex";
import { publishFlexSnapshot, readPortfolioSnapshot } from "@/lib/portfolio-store";

export const dynamic = "force-dynamic";

async function authorized(request: Request): Promise<boolean> {
  const { env } = await import("cloudflare:workers");
  const secret = (env as unknown as { PORTFOLIO_SYNC_KEY?: string }).PORTFOLIO_SYNC_KEY;
  return Boolean(secret && request.headers.get("x-portfolio-sync-key") === secret);
}

export async function GET(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const snapshot = await readPortfolioSnapshot(await getD1());
  return Response.json({
    generatedAt: snapshot.generatedAt,
    reportDate: snapshot.source?.reportDate ?? null,
    lastSuccessfulTradeAt: snapshot.tradeSync.lastSuccessfulTradeAt,
  }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  if (!await authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  let raw: FlexRawSyncInput;
  try {
    raw = await request.json() as FlexRawSyncInput;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    const result = await publishFlexSnapshot(await getD1(), raw);
    return Response.json({
      status: result.status,
      reportDate: result.snapshot.source?.reportDate ?? null,
      generatedAt: result.snapshot.generatedAt,
      positions: result.snapshot.positions.length,
      trades: result.snapshot.trades.length,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error(JSON.stringify({ event: "portfolio-flex-publish-failed", error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ error: "Portfolio snapshot validation failed" }, { status: 422 });
  }
}
