import type { SecFilingFeed, SecFilingWithSummary } from "./sec.ts";

const SEC_WEB_ORIGIN = "https://earning-report-analysis-sec-web.max-zhangyuchen.workers.dev";

type PublicFiling = {
  accessionNumber: string;
  ticker: string;
  form: string;
  filingDate: string;
  reportDate: string;
  description: string;
  summary: SecFilingWithSummary["summary"];
  analysis: SecFilingWithSummary["analysis"];
  edgarUrl: string;
  documentUrl: string;
};

type PublicCompany = { ticker: string; name: string; cik: string } | null;

export async function getCloudflareSecFeed(ticker: string): Promise<SecFilingFeed> {
  const response = await fetch(`${SEC_WEB_ORIGIN}/api/v1/companies/${encodeURIComponent(ticker)}/filings?limit=50`, { cache: "no-store" });
  if (!response.ok) throw new Error("SEC Cloudflare feed is unavailable");
  const page = await response.json() as { company: PublicCompany; filings: PublicFiling[]; checkedAt: string | null };
  return {
    ticker,
    company: page.company,
    filings: page.filings.map((filing) => mapFiling(filing, page.company)),
    fetchedAt: page.checkedAt,
    status: page.filings.length ? "ready" : "empty",
  };
}

export async function getCloudflareSecFiling(ticker: string, accession: string): Promise<{ company: PublicCompany; filing: SecFilingWithSummary } | null> {
  const response = await fetch(`${SEC_WEB_ORIGIN}/api/v1/companies/${encodeURIComponent(ticker)}/filings/${encodeURIComponent(accession)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("SEC Cloudflare report is unavailable");
  const detail = await response.json() as { company: PublicCompany; filing: PublicFiling };
  return { company: detail.company, filing: mapFiling(detail.filing, detail.company) };
}

function mapFiling(filing: PublicFiling, company: PublicCompany): SecFilingWithSummary {
  const cik = company?.cik ?? "";
  return {
    ticker: filing.ticker,
    cik,
    cikNumber: Number(cik.replace(/\D/g, "")) || 0,
    companyName: company?.name ?? filing.ticker,
    form: filing.form,
    filingDate: filing.filingDate,
    reportDate: filing.reportDate,
    accessionNumber: filing.accessionNumber,
    primaryDocument: filing.documentUrl.split("/").at(-1) ?? "",
    description: filing.description,
    items: "",
    documentUrl: filing.documentUrl,
    indexUrl: filing.edgarUrl,
    summary: filing.summary,
    analysis: filing.analysis,
  };
}
