import { redirect, notFound } from "next/navigation";
import { normalizeTrackedTicker } from "@/lib/earning-report/web/ticker";

export default async function SecReportPage({ params }: { params: Promise<{ ticker: string; accession: string }> }) {
  const route = await params;
  const ticker = normalizeTrackedTicker(route.ticker);
  const accession = /^\d{10}-\d{2}-\d{6}$/.test(route.accession) ? route.accession : "";
  if (!ticker || !accession) notFound();
  redirect(`/analysis/stocks/${encodeURIComponent(ticker)}/sec/${encodeURIComponent(accession)}`);
}
