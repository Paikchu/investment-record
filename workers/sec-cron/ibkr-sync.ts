import { extractCapitalFlows, fetchFlexStatement, normalizeFlexStatement } from "../../lib/ibkr-flex.ts";
import { selectTradeQueryPeriod } from "../../lib/portfolio-snapshot.ts";

export type IbkrSyncEnv = {
  PORTFOLIO_SERVICE?: { fetch: typeof fetch };
  IBKR_FLEX_TOKEN: string;
  IBKR_FLEX_QUERY_ID: string;
  PORTFOLIO_SYNC_KEY: string;
};

type PortfolioState = {
  lastSuccessfulTradeAt: string | null;
};

export async function runIbkrFlexSync(env: IbkrSyncEnv, fetcher: typeof fetch = fetch, now = new Date()) {
  if (!env.IBKR_FLEX_TOKEN || !env.PORTFOLIO_SYNC_KEY || !/^\d+$/.test(env.IBKR_FLEX_QUERY_ID)) {
    throw new Error("IBKR Flex worker environment is incomplete");
  }
  const origin = "https://investment-record.internal";
  if (!env.PORTFOLIO_SERVICE) {
    throw new Error("Cloudflare portfolio service binding is missing");
  }
  const portfolioFetch = env.PORTFOLIO_SERVICE.fetch.bind(env.PORTFOLIO_SERVICE);
  const headers = {
    "content-type": "application/json",
    "x-portfolio-sync-key": env.PORTFOLIO_SYNC_KEY,
  };
  const stateResponse = await portfolioFetch(`${origin}/api/internal/portfolio/sync`, {
    redirect: "manual",
    headers,
    signal: AbortSignal.timeout(30_000),
  });
  if (!stateResponse.ok) throw new Error(`Portfolio state HTTP ${stateResponse.status}`);
  const state = await stateResponse.json() as PortfolioState;
  const queryPeriod = selectTradeQueryPeriod(state.lastSuccessfulTradeAt, now.toISOString());
  const csv = await fetchFlexStatement({
    token: env.IBKR_FLEX_TOKEN,
    queryId: env.IBKR_FLEX_QUERY_ID,
    periodDays: 365,
    fetcher,
  });
  const input = normalizeFlexStatement(csv, {
    generatedAt: now.toISOString(),
    queryPeriod,
    queryId: env.IBKR_FLEX_QUERY_ID,
  });
  input.capitalFlows = extractCapitalFlows(csv);
  const publishResponse = await portfolioFetch(`${origin}/api/internal/portfolio/sync`, {
    redirect: "manual",
    method: "POST",
    headers,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  if (!publishResponse.ok) throw new Error(`Portfolio publish HTTP ${publishResponse.status}`);
  const result = await publishResponse.json() as { status: "published" | "unchanged"; reportDate: string; positions: number; trades: number };
  return result;
}

// A protected manual trigger uses exactly the same pipeline as the Cron.
export async function handleIbkrSyncRequest(
  request: Request,
  env: IbkrSyncEnv,
  sync: () => ReturnType<typeof runIbkrFlexSync> = () => runIbkrFlexSync(env),
): Promise<Response> {
  const headers = { "cache-control": "no-store" };
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...headers, allow: "POST" } });
  }
  if (!env.PORTFOLIO_SYNC_KEY || request.headers.get("x-portfolio-sync-key") !== env.PORTFOLIO_SYNC_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  try {
    const result = await sync();
    console.log(JSON.stringify({ event: "ibkr-flex-sync", trigger: "manual", ...result }));
    return Response.json(result, { headers });
  } catch (error) {
    let reason = error instanceof Error ? error.message : "Unknown sync error";
    for (const secret of [env.IBKR_FLEX_TOKEN, env.PORTFOLIO_SYNC_KEY]) {
      if (secret) reason = reason.replaceAll(secret, "[redacted]");
    }
    reason = reason.replace(/https?:\/\/\S+/g, "[redacted-url]");
    console.error(JSON.stringify({ event: "ibkr-flex-sync-failed", trigger: "manual", reason: reason.slice(0, 300) }));
    return Response.json({ error: "Portfolio sync failed; previous data retained" }, { status: 502, headers });
  }
}
