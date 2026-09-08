import { redirect, notFound } from "next/navigation";
import { normalizeTrackedTicker } from "@/lib/earning-report/web/ticker.ts";

export const dynamic = "force-dynamic";

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const ticker = normalizeTrackedTicker((await params).ticker);
  if (!ticker) notFound();
  redirect(`/positions/${encodeURIComponent(ticker)}`);
}
