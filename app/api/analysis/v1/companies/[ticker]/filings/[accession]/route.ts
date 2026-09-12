import { proxyAnalysisRead } from "@/lib/earning-report/web/analysis-proxy.ts";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ ticker: string; accession: string }> }) {
  const { ticker, accession } = await context.params;
  const query = new URL(request.url).searchParams;
  const snapshot = query.has("reportVersion") || query.has("reportDate")
    ? { reportVersion: query.get("reportVersion") ?? "", reportDate: query.get("reportDate") ?? "" } : undefined;
  return proxyAnalysisRead(request, (client) => client.getFiling(ticker, accession, snapshot));
}
