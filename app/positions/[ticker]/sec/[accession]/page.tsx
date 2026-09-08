import { getCloudflareSecFiling } from "@/lib/sec-cloudflare-client";
import { cleanSecAccession } from "@/lib/sec";
import { findSecurity } from "@/lib/site-data";
import { normalizeTicker } from "@/lib/symbol-directory";
import { notFound } from "next/navigation";
import { SecReportDocument } from "./SecReportDocument";

export const dynamic = "force-dynamic";

export default async function SecReportPage({ params }: { params: Promise<{ ticker: string; accession: string }> }) {
  const route = await params;
  const ticker = normalizeTicker(route.ticker);
  const accession = cleanSecAccession(route.accession);
  const security = findSecurity(ticker);
  if (!security || security.type !== "stock" || !accession) notFound();

  const result = await getCloudflareSecFiling(ticker, accession);
  if (!result) notFound();

  return <SecReportDocument companyName={security.name} filing={result.filing} />;
}
