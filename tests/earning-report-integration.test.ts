import assert from "node:assert/strict";
import test from "node:test";
import { AnalysisBackendClient } from "../lib/earning-report/analysis-contract/client.ts";
import { proxyAnalysisRead } from "../lib/earning-report/analysis-proxy.ts";

const token = "test-only.read-secret";
function setup(status = 200, body: unknown = { filings: [], nextCursor: "next-page" }) {
  const seen: Request[] = [];
  const client = new AnalysisBackendClient({
    origin: "https://pipeline.test",
    token,
    fetcher: async (input, init) => {
      seen.push(new Request(input, init));
      return Response.json(body, { status, headers: { "cache-control": "no-store" } });
    },
  });
  const dependencies = {
    getRuntime: async () => ({ configured: true as const, client }),
    getRateLimiter: async () => null,
  };
  return { client, seen, dependencies };
}

test("tab two forwards all four read resources to the original pipeline contract", async () => {
  const { client, seen } = setup();
  await client.listFilings("BRK.B", { cursor: "page+a/b=", limit: "2" });
  await client.getCompanyAnalysis("BRK.B");
  await client.getFundamentals("BRK.B", { periodCount: "8", metrics: "revenue,netIncome" });
  await client.getFiling("BRK.B", "0000000001-26-000001");
  assert.deepEqual(seen.map(r => new URL(r.url).pathname), [
    "/api/v1/companies/BRK.B/filings", "/api/v1/companies/BRK.B/analysis",
    "/api/v1/companies/BRK.B/fundamentals", "/api/v1/companies/BRK.B/filings/0000000001-26-000001",
  ]);
  assert.equal(new URL(seen[0].url).searchParams.get("cursor"), "page+a/b=");
  assert.equal(new URL(seen[2].url).searchParams.get("periodCount"), "8");
  for (const request of seen) {
    assert.equal(request.method, "GET");
    assert.equal(request.headers.get("authorization"), `Bearer ${token}`);
  }
});

test("anonymous browser reads preserve response and paging without exposing the read credential", async () => {
  const { client, dependencies } = setup();
  const response = await proxyAnalysisRead(new Request("https://investment.test/api/analysis/v1/companies/MSFT/filings"), () => client.listFilings("MSFT"), dependencies);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const text = await response.text();
  assert.deepEqual(JSON.parse(text), { filings: [], nextCursor: "next-page" });
  assert.ok(!text.includes(token));
  assert.equal(response.headers.get("authorization"), null);
});

for (const status of [401, 403, 500]) {
  test(`backend ${status} is an unavailable state, never an empty data success`, async () => {
    const { client, dependencies } = setup(status, { error: token });
    const response = await proxyAnalysisRead(new Request("https://investment.test/api/analysis/v1/companies/MSFT/analysis"), () => client.getCompanyAnalysis("MSFT"), dependencies);
    assert.equal(response.status, 503);
    assert.equal((await response.json() as { code: string }).code, "ANALYSIS_BACKEND_UNAVAILABLE");
  });
}

test("a missing backend configuration returns 503 and never starts a read", async () => {
  const response = await proxyAnalysisRead(new Request("https://investment.test/api/analysis/v1/companies/MSFT/analysis"), () => { throw new Error("must not call"); }, {
    getRuntime: async () => ({ configured: false, reason: "missing_token" }), getRateLimiter: async () => null,
  });
  assert.equal(response.status, 503);
});

test("a public rate limit prevents upstream work", async () => {
  const response = await proxyAnalysisRead(new Request("https://investment.test/api/analysis/v1/companies/MSFT/analysis"), () => { throw new Error("must not call"); }, {
    getRuntime: async () => { throw new Error("must not call"); },
    getRateLimiter: async () => ({ limit: async () => ({ success: false }) }),
  });
  assert.equal(response.status, 429);
});
