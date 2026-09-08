import assert from "node:assert/strict";
import test from "node:test";

import { extractCapitalFlows, fetchFlexStatement, normalizeFlexStatement, parseCsv, parseFlexDateTime } from "../lib/ibkr-flex.ts";
import { publishFlexSnapshot, readPortfolioSnapshot, type PortfolioDatabase } from "../lib/portfolio-store.ts";
import { handleIbkrSyncRequest, runIbkrFlexSync, type IbkrSyncEnv } from "../workers/sec-cron/ibkr-sync.ts";

const fixture = [
  '"HEADER","ACCT","ClientAccountID","CurrencyPrimary","DateFunded"',
  '"DATA","ACCT","ACCOUNT","USD","20260101"',
  '"HEADER","CTRN","ClientAccountID","CurrencyPrimary","FXRateToBase","Type","Amount","TransactionID","ReportDate","LevelOfDetail"',
  '"DATA","CTRN","ACCOUNT","USD","1","Deposits/Withdrawals","1000","deposit1","20261201","DETAIL"',
  '"HEADER","TRFR","ClientAccountID","ReportDate","LevelOfDetail","TransactionID","FXRateToBase","CashTransfer","PositionAmountInBase"',
  '"HEADER","EQUT","ClientAccountID","ReportDate","Total"',
  '"DATA","EQUT","ACCOUNT","20261231","70000.50"',
  '"HEADER","CRTT","ClientAccountID","CurrencyPrimary","LevelOfDetail","ToDate","EndingCash","FromDate","Deposit/Withdrawals","AccountTransfers","InternalTransfers","PaxosTransfers"',
  '"DATA","CRTT","ACCOUNT","USD","BaseCurrency","20261231","12000.25","20260101","1000","0","0","0"',
  '"HEADER","POST","ClientAccountID","CurrencyPrimary","AssetClass","Symbol","Description","Conid","UnderlyingSymbol","Multiplier","ReportDate","Quantity","MarkPrice","PositionValue","CostBasisPrice","CostBasisMoney","FifoPnlUnrealized","LevelOfDetail"',
  '"DATA","POST","ACCOUNT","USD","STK","ACME","ACME, INC","123","","1","20261231","10","20","200","15","150","50","SUMMARY"',
  '"DATA","POST","ACCOUNT","USD","STK","ACME","ACME, INC","123","","1","20261231","6","20","120","14","84","36","LOT"',
  '"DATA","POST","ACCOUNT","USD","STK","ACME","ACME, INC","123","","1","20261231","4","20","80","16.5","66","14","LOT"',
  '"HEADER","TRNT","ClientAccountID","CurrencyPrimary","AssetClass","Symbol","Description","UnderlyingSymbol","TradeID","DateTime","TradeDate","Exchange","Quantity","TradePrice","IBCommission","NetCash","FifoPnlRealized","Buy/Sell","IBOrderID","LevelOfDetail"',
  '"DATA","TRNT","ACCOUNT","USD","STK","ACME","ACME, INC","","trade-summary","","20261231","","10","20","0","0","0","","","SYMBOL_SUMMARY"',
  '"DATA","TRNT","ACCOUNT","USD","STK","ACME","ACME, INC","","trade-1","20261231;233000 EST","20261231","NYSE","2","20","-0.35","-40.35","5.25","SELL","88","EXECUTION"',
].join("\n");

test("parses quoted commas without shifting Flex columns", () => {
  const rows = parseCsv('"DATA","POST","ACME, INC","10"\n');
  assert.deepEqual(rows[0], ["DATA", "POST", "ACME, INC", "10"]);
});

test("normalizes only summary positions and execution trades", () => {
  const input = normalizeFlexStatement(fixture, {
    generatedAt: "2027-01-01T14:00:00.000Z",
    queryPeriod: "DAYS_7",
    queryId: "1628251",
  });
  assert.equal(input.source.reportDate, "2026-12-31");
  assert.equal(input.summary.net_liquidation, 70_000.5);
  assert.equal(input.balances.balances[0].cash_balance, 12_000.25);
  assert.equal(input.positions.positions.length, 1);
  assert.equal(input.positions.positions[0].average_price, 15);
  assert.equal(input.positions.positions[0].symbol, "ACME");
  assert.equal(input.trades.trades.length, 1);
  assert.equal(input.trades.trades[0].trade_id, "trade-1");
  assert.equal(input.trades.trades[0].trade_date, "2026-12-31");
  assert.equal(input.trades.trades[0].trade_time, "2027-01-01T04:30:00.000Z");
});

test("requires a timezone-qualified Flex execution time", () => {
  assert.throws(() => parseFlexDateTime("20261231;233000"), /timezone-qualified/i);
});

test("polls the same generated report while IBKR returns 1019", async () => {
  const calls: string[] = [];
  const responses = [
    '<FlexStatementResponse><Status>Success</Status><ReferenceCode>123456</ReferenceCode></FlexStatementResponse>',
    '<FlexStatementResponse><Status>Fail</Status><ErrorCode>1019</ErrorCode><ErrorMessage>Statement generation in progress.</ErrorMessage></FlexStatementResponse>',
    fixture,
  ];
  const result = await fetchFlexStatement({
    token: "1234567890",
    queryId: "1628251",
    periodDays: 7,
    retryDelaysMs: [0],
    sleep: async () => undefined,
    fetcher: (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url.includes("SendRequest") ? "send" : "get");
      return new Response(responses.shift(), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(result, fixture);
  assert.deepEqual(calls, ["send", "get", "get"]);
});

test("does not retry an invalid Flex token", async () => {
  await assert.rejects(fetchFlexStatement({
    token: "1234567890",
    queryId: "1628251",
    periodDays: 7,
    retryDelaysMs: [],
    fetcher: (async () => new Response(
      '<FlexStatementResponse><Status>Fail</Status><ErrorCode>1015</ErrorCode><ErrorMessage>Token is invalid.</ErrorMessage></FlexStatementResponse>',
      { status: 200 },
    )) as typeof fetch,
  }), /1015/);
});

test("publishes a validated Flex snapshot and history in one D1 batch", async () => {
  const batches: unknown[][] = [];
  const database: PortfolioDatabase = {
    prepare(query) {
      const statement = {
        query,
        values: [] as unknown[],
        bind(...values: unknown[]) { this.values = values; return this; },
        async first<T>() { return null as T | null; },
      };
      return statement;
    },
    async batch(statements) { batches.push(statements); return []; },
  };
  const raw = normalizeFlexStatement(fixture, {
    generatedAt: "2027-01-01T14:00:00.000Z",
    queryPeriod: "DAYS_7",
    queryId: "1628251",
  });

  const result = await publishFlexSnapshot(database, raw);

  assert.equal(result.status, "published");
  assert.equal(result.snapshot.source?.method, "FLEX");
  assert.equal(result.snapshot.positions[0].symbol, "ACME");
  assert.equal(result.snapshot.trades.some((trade) => trade.tradeId === "trade-1"), true);
  assert.equal(batches.length, 1);
  assert.equal(batches[0].length, 2);
  assert.equal((await readPortfolioSnapshot(database)).schemaVersion, 1);
});

test("repairs symbols in the already-published legacy Flex snapshot", async () => {
  const stored = {
    ...(await readPortfolioSnapshot({
      prepare() {
        return { bind() { return this; }, async first<T>() { return null as T | null; } };
      },
    })),
    source: { provider: "IBKR", method: "FLEX", reportDate: "2026-09-04", queryId: "1628251" },
    positions: [{
      positionKey: "STK:272093",
      symbol: "MICROSOFT",
      contractDescription: "MICROSOFT CORP",
      assetClass: "STK",
      quantity: 1,
      averagePrice: 400,
      marketPrice: 500,
      marketValue: 500,
      costBasis: 400,
      unrealizedPnl: 100,
    }],
  };
  const database = {
    prepare() {
      return {
        bind() { return this; },
        async first<T>() { return { payload: JSON.stringify(stored) } as T; },
      };
    },
  };

  const repaired = await readPortfolioSnapshot(database);

  assert.equal(repaired.positions[0].symbol, "MSFT");
  assert.equal(repaired.positions[0].contractDescription, "MICROSOFT CORP");
});

test("runs one Flex request and publishes it through the authenticated site bridge", async () => {
  const calls: Request[] = [];
  const responses = [
    Response.json({ lastSuccessfulTradeAt: "2026-12-30T20:00:00.000Z" }),
    new Response('<FlexStatementResponse><Status>Success</Status><ReferenceCode>123456</ReferenceCode></FlexStatementResponse>'),
    new Response(fixture),
    Response.json({ status: "published", reportDate: "2026-12-31", positions: 1, trades: 1 }),
  ];
  const env = {
    MAX_SITE_ORIGIN: "https://site.example",
    MAX_SITE_BYPASS_TOKEN: "site-token",
    SEC_REFRESH_KEY: "sync-key",
    IBKR_FLEX_TOKEN: "1234567890",
    IBKR_FLEX_QUERY_ID: "1628251",
    PORTFOLIO_SYNC_KEY: "portfolio-key",
    SEC_ANALYSIS_WORKFLOW: { async create() { return { id: "unused" }; } },
  } satisfies IbkrSyncEnv;
  const result = await runIbkrFlexSync(env, (async (input, init) => {
    calls.push(new Request(input, init));
    return responses.shift()!;
  }) as typeof fetch, new Date("2027-01-01T14:00:00.000Z"));

  assert.equal(result.status, "published");
  assert.equal(calls.filter((request) => request.url.includes("SendRequest")).length, 1);
  assert.equal(calls.at(-1)?.method, "POST");
  assert.equal(calls.at(-1)?.headers.get("x-portfolio-sync-key"), "portfolio-key");
  assert.equal(calls.at(-1)?.headers.get("oai-sites-authorization"), "Bearer site-token");
});


test("extracts and reconciles capital flows, rejecting incomplete cash data", () => {
  const report = extractCapitalFlows(fixture);
  assert.equal(report.flows[0].amount, 1000);
  assert.equal(report.fromDate, "2026-01-01");
  assert.throws(() => extractCapitalFlows(fixture.replace('"1000","deposit1"', '"900","deposit1"')), /reconcile/);
});

test("Cloudflare sync omits Sites credentials and rejects redirects", async () => {
  const calls: Request[] = [];
  const responses = [
    Response.json({ lastSuccessfulTradeAt: "2026-12-30T20:00:00.000Z" }),
    new Response('<FlexStatementResponse><Status>Success</Status><ReferenceCode>123456</ReferenceCode></FlexStatementResponse>'),
    new Response(fixture),
    Response.json({ status: "published", reportDate: "2026-12-31", positions: 1, trades: 1 }),
  ];
  const env = {
    MAX_SITE_ORIGIN: "https://site.example",
    MAX_SITE_BYPASS_TOKEN: "old-sites-secret",
    PORTFOLIO_TARGET_PLATFORM: "cloudflare",
    PORTFOLIO_SITE: {
      fetch: (async (input, init) => {
        calls.push(new Request(input, init));
        return responses.shift()!;
      }) as typeof fetch,
    },
    SEC_REFRESH_KEY: "",
    IBKR_FLEX_TOKEN: "1234567890",
    IBKR_FLEX_QUERY_ID: "1628251",
    PORTFOLIO_SYNC_KEY: "portfolio-key",
    SEC_ANALYSIS_WORKFLOW: { async create() { return { id: "unused" }; } },
  } satisfies IbkrSyncEnv;
  await runIbkrFlexSync(env, (async (input, init) => {
    assert.ok(!new Request(input, init).url.startsWith("https://site.example"));
    calls.push(new Request(input, init));
    return responses.shift()!;
  }) as typeof fetch, new Date("2027-01-01T14:00:00.000Z"));
  for (const request of [calls[0], calls.at(-1)!]) {
    assert.equal(request.headers.get("oai-sites-authorization"), null);
    assert.equal(request.headers.get("x-portfolio-sync-key"), "portfolio-key");
    assert.equal(request.redirect, "manual");
  }
});

test("Cloudflare sync fails closed when the service binding is missing", async () => {
  const env = {
    IBKR_FLEX_TOKEN: "1234567890", IBKR_FLEX_QUERY_ID: "1628251",
    PORTFOLIO_SYNC_KEY: "key", MAX_SITE_ORIGIN: "https://site.example",
    PORTFOLIO_TARGET_PLATFORM: "cloudflare",
  } as IbkrSyncEnv;
  await assert.rejects(runIbkrFlexSync(env), /service binding is missing/);
});

test("manual portfolio trigger requires POST and a matching secret before fetching IBKR", async () => {
  const env = { PORTFOLIO_SYNC_KEY: "test-key" } as IbkrSyncEnv;
  let calls = 0;
  const sync = async () => {
    calls++;
    return { status: "unchanged" as const, reportDate: "2026-09-04", positions: 1, trades: 1 };
  };
  const url = "https://worker.example/internal/portfolio/sync";
  assert.equal((await handleIbkrSyncRequest(new Request(url), env, sync)).status, 405);
  assert.equal((await handleIbkrSyncRequest(new Request(url, { method: "POST" }), env, sync)).status, 401);
  assert.equal((await handleIbkrSyncRequest(new Request(url, { method: "POST", headers: { "x-portfolio-sync-key": "wrong" } }), env, sync)).status, 401);
  assert.equal(calls, 0);
  const authorized = new Request(url, { method: "POST", headers: { "x-portfolio-sync-key": "test-key" } });
  const response = await handleIbkrSyncRequest(authorized, env, sync);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, "unchanged");
  assert.equal(calls, 1);
  const failure = await handleIbkrSyncRequest(authorized, env, async () => { throw new Error("private-provider-detail"); });
  assert.equal(failure.status, 502);
  assert.doesNotMatch(await failure.text(), /private-provider-detail/);
});

test("backfills same-date net deposits atomically, then skips an identical report", async () => {
  const raw = normalizeFlexStatement(fixture, { generatedAt: "2027-01-01T14:00:00.000Z", queryPeriod: "DAYS_7", queryId: "1628251" });
  const initialDb: PortfolioDatabase = { prepare() { return { bind() { return this; }, async first<T>() { return null as T | null; } }; }, async batch() { return []; } };
  let stored = (await publishFlexSnapshot(initialDb, raw)).snapshot;
  let writes = 0;
  const database: PortfolioDatabase = {
    prepare() { return { bind() { return this; }, async first<T>() { return { payload: JSON.stringify(stored) } as T; } }; },
    async batch(statements) { assert.equal(statements.length, 2); writes++; return []; },
  };
  raw.capitalFlows = extractCapitalFlows(fixture);
  const result = await publishFlexSnapshot(database, raw);
  assert.equal(result.status, "published");
  assert.equal(result.snapshot.account.netDeposits, 1000);
  assert.equal(result.snapshot.account.netDepositsSource, "FLEX");
  stored = result.snapshot;
  assert.equal((await publishFlexSnapshot(database, raw)).status, "unchanged");
  assert.equal(writes, 1);
});
