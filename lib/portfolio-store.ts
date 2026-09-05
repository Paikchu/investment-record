import fallbackSnapshotData from "../data/portfolio-snapshot.json" with { type: "json" };

import type { FlexRawSyncInput } from "./ibkr-flex.ts";
import {
  buildPortfolioSnapshot,
  canonicalUnderlying,
  normalizeIbkrPosition,
  normalizeIbkrTrade,
  type PortfolioSnapshotV1,
} from "./portfolio-snapshot.ts";

type D1StatementLike = {
  bind(...values: unknown[]): D1StatementLike;
  first<T>(): Promise<T | null>;
};

export type PortfolioDatabase = {
  prepare(query: string): D1StatementLike;
  batch(statements: D1StatementLike[]): Promise<unknown[]>;
};

const FALLBACK_SNAPSHOT = fallbackSnapshotData as PortfolioSnapshotV1;
const FALLBACK_SYMBOL_BY_POSITION_KEY = new Map(
  FALLBACK_SNAPSHOT.positions.map((position) => [position.positionKey, position.symbol]),
);

function repairLegacyFlexSymbols(snapshot: PortfolioSnapshotV1): PortfolioSnapshotV1 {
  if (snapshot.source?.method !== "FLEX") return snapshot;

  let changed = false;
  const positions = snapshot.positions.map((position) => {
    const knownSymbol = FALLBACK_SYMBOL_BY_POSITION_KEY.get(position.positionKey);
    const legacyDerivedSymbol = canonicalUnderlying(position.contractDescription.split(/\s+/)[0] ?? "");
    if (!knownSymbol || knownSymbol === position.symbol || position.symbol !== legacyDerivedSymbol) return position;
    changed = true;
    return { ...position, symbol: knownSymbol };
  });
  return changed ? { ...snapshot, positions } : snapshot;
}

export async function readPortfolioSnapshot(database: Pick<PortfolioDatabase, "prepare">): Promise<PortfolioSnapshotV1> {
  const row = await database.prepare("SELECT payload FROM portfolio_state WHERE id = 'current'").first<{ payload: string }>();
  if (!row) return FALLBACK_SNAPSHOT;
  const snapshot = JSON.parse(row.payload) as PortfolioSnapshotV1;
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.positions) || !Array.isArray(snapshot.trades)) {
    throw new Error("Stored portfolio snapshot is invalid");
  }
  return repairLegacyFlexSymbols(snapshot);
}

export async function publishFlexSnapshot(
  database: PortfolioDatabase,
  raw: FlexRawSyncInput,
): Promise<{ status: "published" | "unchanged"; snapshot: PortfolioSnapshotV1 }> {
  if (raw.source.method !== "FLEX") throw new Error("Portfolio sync source must be IBKR Flex");
  const previous = await readPortfolioSnapshot(database);
  if (
    previous.source?.method === "FLEX"
    && previous.source.reportDate
    && raw.source.reportDate <= previous.source.reportDate
  ) {
    return { status: "unchanged", snapshot: previous };
  }

  const usdBalance = raw.balances.balances.find((balance) => balance.currency === "USD");
  const positions = raw.positions.positions
    .filter((position) => position.asset_class === "STK" || position.asset_class === "OPT")
    .map(normalizeIbkrPosition);
  const snapshot = buildPortfolioSnapshot(previous, {
    generatedAt: raw.generatedAt,
    account: {
      netLiquidation: raw.summary.net_liquidation,
      cashBalance: usdBalance?.cash_balance ?? Number.NaN,
    },
    positions,
    source: raw.source,
    tradeSync: {
      status: "current",
      queryPeriod: raw.queryPeriod,
      trades: raw.trades.trades.map(normalizeIbkrTrade),
    },
  });
  const historyDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(snapshot.generatedAt));
  const snapshotStatement = database.prepare(`
    INSERT INTO portfolio_state (id, report_date, generated_at, payload, updated_at)
    VALUES ('current', ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      report_date = excluded.report_date,
      generated_at = excluded.generated_at,
      payload = excluded.payload,
      updated_at = CURRENT_TIMESTAMP
  `).bind(raw.source.reportDate, snapshot.generatedAt, JSON.stringify(snapshot));
  const historyStatement = database.prepare(`
    INSERT INTO portfolio_history (date, generated_at, net_liquidation, net_deposits)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      generated_at = excluded.generated_at,
      net_liquidation = excluded.net_liquidation,
      net_deposits = excluded.net_deposits
  `).bind(historyDate, snapshot.generatedAt, String(snapshot.account.netLiquidation), String(snapshot.account.netDeposits));
  await database.batch([snapshotStatement, historyStatement]);
  return { status: "published", snapshot };
}
