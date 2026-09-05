import { execFile } from "node:child_process";
import { readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

import { fetchFlexStatement, normalizeFlexStatement, queryPeriodDays } from "../lib/ibkr-flex.ts";
import { selectTradeQueryPeriod, type PortfolioSnapshotV1 } from "../lib/portfolio-snapshot.ts";

const execFileAsync = promisify(execFile);
const KEYCHAIN_SERVICE = "com.max-investment-record.ibkr-flex";

const argument = (name: string, fallback?: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
};

async function readToken(): Promise<string> {
  const environmentToken = process.env.IBKR_FLEX_TOKEN?.trim();
  if (environmentToken) return environmentToken;
  if (process.platform !== "darwin") throw new Error("IBKR_FLEX_TOKEN is required outside macOS");
  const { stdout } = await execFileAsync("security", ["find-generic-password", "-w", "-s", KEYCHAIN_SERVICE], {
    maxBuffer: 4_096,
  });
  const token = stdout.trim();
  if (!token) throw new Error(`No IBKR Flex token found in Keychain service ${KEYCHAIN_SERVICE}`);
  return token;
}

const previousPath = argument("--previous", "data/portfolio-snapshot.json")!;
const outputPath = argument("--output");
const queryId = argument("--query-id", process.env.IBKR_FLEX_QUERY_ID)?.trim();
if (!outputPath) throw new Error("--output is required");
if (!queryId) throw new Error("--query-id or IBKR_FLEX_QUERY_ID is required");

const now = new Date();
const previous = JSON.parse(await readFile(previousPath, "utf8")) as PortfolioSnapshotV1;
const queryPeriod = selectTradeQueryPeriod(previous.tradeSync.lastSuccessfulTradeAt, now.toISOString());
const csv = await fetchFlexStatement({
  token: await readToken(),
  queryId,
  periodDays: queryPeriodDays(queryPeriod, now),
});
const input = normalizeFlexStatement(csv, { generatedAt: now.toISOString(), queryPeriod, queryId });
const temporaryPath = join(dirname(outputPath), `.ibkr-flex-${process.pid}.tmp`);
await writeFile(temporaryPath, `${JSON.stringify(input, null, 2)}\n`, { mode: 0o600 });
await rename(temporaryPath, outputPath);
console.log(JSON.stringify({
  status: "ready",
  reportDate: input.source.reportDate,
  queryPeriod,
  positions: input.positions.positions.length,
  trades: input.trades.trades.length,
}));
