import { extractCapitalFlows, fetchFlexStatement, normalizeFlexStatement } from "../../lib/ibkr-flex.ts";
import { selectTradeQueryPeriod } from "../../lib/portfolio-snapshot.ts";
import type { SecCronEnv } from "./core.ts";

export type IbkrSyncEnv = SecCronEnv & {
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
  const origin = env.MAX_SITE_ORIGIN.replace(/\/+$/, "");
  const headers = {
    "content-type": "application/json",
    "oai-sites-authorization": `Bearer ${env.MAX_SITE_BYPASS_TOKEN}`,
    "x-portfolio-sync-key": env.PORTFOLIO_SYNC_KEY,
  };
  const stateResponse = await fetcher(`${origin}/api/internal/portfolio/sync`, {
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
  const publishResponse = await fetcher(`${origin}/api/internal/portfolio/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(30_000),
  });
  if (!publishResponse.ok) throw new Error(`Portfolio publish HTTP ${publishResponse.status}`);
  const result = await publishResponse.json() as { status: "published" | "unchanged"; reportDate: string; positions: number; trades: number };
  return result;
}
