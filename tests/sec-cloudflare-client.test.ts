import assert from "node:assert/strict";
import test from "node:test";

import { getCloudflareSecFeed, getCloudflareSecFiling } from "../lib/sec-cloudflare-client.ts";

const filing = {
  accessionNumber: "0001193125-26-323660",
  ticker: "MSFT",
  form: "10-K",
  filingDate: "2026-07-29",
  reportDate: "2026-06-30",
  description: "10-K",
  summary: null,
  analysis: null,
  edgarUrl: "https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm-index.html",
  documentUrl: "https://www.sec.gov/Archives/edgar/data/789019/000119312526323660/msft-20260630.htm",
};

test("maps the Cloudflare filing feed to the legacy SEC component contract", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://earning-report-analysis-sec-web.max-zhangyuchen.workers.dev/api/v1/companies/MSFT/filings?limit=50");
    return Response.json({
      company: { ticker: "MSFT", name: "Microsoft Corporation", cik: "0000789019" },
      filings: [filing],
      checkedAt: "2026-08-26T15:01:00.000Z",
    });
  };

  const feed = await getCloudflareSecFeed("MSFT");
  assert.equal(feed.status, "ready");
  assert.equal(feed.company?.name, "Microsoft Corporation");
  assert.equal(feed.filings[0]?.accessionNumber, filing.accessionNumber);
  assert.equal(feed.filings[0]?.primaryDocument, "msft-20260630.htm");
  assert.equal(feed.filings[0]?.indexUrl, filing.edgarUrl);
});

test("maps the Cloudflare report detail and preserves a missing report", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url.endsWith("/missing")) return new Response(null, { status: 404 });
    return Response.json({
      company: { ticker: "MSFT", name: "Microsoft Corporation", cik: "0000789019" },
      filing,
    });
  };

  const detail = await getCloudflareSecFiling("MSFT", filing.accessionNumber);
  assert.equal(detail?.filing.documentUrl, filing.documentUrl);
  assert.equal(detail?.filing.cikNumber, 789019);
  assert.equal(await getCloudflareSecFiling("MSFT", "missing"), null);
});
