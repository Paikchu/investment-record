import { FUNDAMENTALS_STALE_AFTER_MS } from "../../../shared/analysis-contract/fundamentals.ts";
import { D1FundamentalsRepository } from "./fundamentals/fundamentals-d1.ts";
import { syncFundamentals } from "./fundamentals.ts";
import { requireDb, trackedTickersFor, type SecCronEnv } from "./core.ts";

/**
 * The scheduled replacement for refresh-on-read.
 *
 * Reading fundamentals used to schedule a refresh: the public page noticed a stale snapshot and
 * `waitUntil`-ed a POST down to this Worker. That put an outbound Yahoo fetch and a D1 write behind
 * an anonymous browser request — a read with a write hiding in it, and one whose rate was set by
 * how often somebody loaded a page. It is gone.
 *
 * The eligibility it had is preserved rather than widened. The Web side nominally allowed any
 * ticker the directory called a stock, but this Worker answered 403 for anything outside
 * `SEC_TRACKED_TICKERS`, so the set that could ever actually refresh was the tracked list — which
 * is exactly the set swept here. Query traffic does not enter into it, so reading a company can no
 * longer cause it to be analysed, and the whitelist cannot grow by being read.
 *
 * Cost control is explicit: only snapshots past the staleness horizon are candidates, and at most
 * `FUNDAMENTALS_SWEEP_MAX_PER_RUN` of them start per Cron tick. The Cron schedule itself is
 * untouched.
 */
export const FUNDAMENTALS_SWEEP_MAX_PER_RUN = 2;
export const FUNDAMENTALS_RETRY_AFTER_MS = 30 * 60_000;

export type FundamentalsSweepResult = {
  candidates: number;
  synced: string[];
  failed: string[];
  skipped: boolean;
};

export type FundamentalsSweepOptions = {
  now?: number;
  maxPerRun?: number;
  staleAfterMs?: number;
  sync?: (ticker: string) => Promise<unknown>;
};

export async function runFundamentalsStalenessSweep(
  env: SecCronEnv,
  options: FundamentalsSweepOptions = {},
): Promise<FundamentalsSweepResult> {
  const tickers = trackedTickersFor(env);
  if (!tickers.length) return { candidates: 0, synced: [], failed: [], skipped: true };

  const database = requireDb(env);
  const now = options.now ?? Date.now();
  const staleAfterMs = options.staleAfterMs ?? FUNDAMENTALS_STALE_AFTER_MS;
  const maxPerRun = Math.max(1, options.maxPerRun ?? FUNDAMENTALS_SWEEP_MAX_PER_RUN);
  const repository = new D1FundamentalsRepository(database);
  const [freshness, attempts] = await Promise.all([
    repository.listFundamentalsFreshness(tickers),
    repository.listFundamentalsAttempts(tickers),
  ]);
  const attemptByTicker = new Map(attempts.map(entry => [entry.ticker, entry]));

  const stale = freshness
    .filter((entry) => isStale(entry.fetchedAt, now, staleAfterMs));
  const eligible = stale.filter(entry => {
    const attempt = attemptByTicker.get(entry.ticker);
    return !attempt || (!(Date.parse(attempt.leaseUntil ?? "") > now)
      && !(now - Date.parse(attempt.lastAttemptAt) < FUNDAMENTALS_RETRY_AFTER_MS));
  }).sort((left, right) => {
    // Failed attempts also advance priority. A persistently broken ticker cannot
    // monopolize the first slots after its cooldown expires.
    const leftAttempt = attemptByTicker.get(left.ticker)?.lastAttemptAt ?? "";
    const rightAttempt = attemptByTicker.get(right.ticker)?.lastAttemptAt ?? "";
    return leftAttempt.localeCompare(rightAttempt)
      || (left.fetchedAt ?? "").localeCompare(right.fetchedAt ?? "");
  });

  const synced: string[] = [];
  const failed: string[] = [];
  const sync = options.sync ?? ((ticker: string) => syncFundamentals(database, ticker));
  for (const entry of eligible.slice(0, maxPerRun)) {
    try {
      await sync(entry.ticker);
      synced.push(entry.ticker);
    } catch {
      failed.push(entry.ticker);
    }
  }
  return { candidates: stale.length, synced, failed, skipped: false };
}

function isStale(fetchedAt: string | null, now: number, staleAfterMs: number): boolean {
  if (!fetchedAt) return true;
  const parsed = Date.parse(fetchedAt);
  return !Number.isFinite(parsed) || now - parsed >= staleAfterMs;
}
