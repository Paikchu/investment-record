import { fetchYahooQuotes, parseRequestedSymbols, type MarketQuoteMap } from "@/lib/yahoo-quotes";

// Market prices are public; this endpoint never reads account or portfolio data.
export async function GET(request: Request) {
  const parsed = parseRequestedSymbols(new URL(request.url).searchParams.get("symbols"));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });
  const cache = typeof caches === "undefined" ? null : (caches as CacheStorage & { default: Cache }).default;
  const keys = parsed.symbols.map((symbol) => new Request(`${new URL(request.url).origin}/api/quotes/cache/${encodeURIComponent(symbol)}`));
  const quotes: MarketQuoteMap = {};
  const missing: string[] = [];
  await Promise.all(parsed.symbols.map(async (symbol, index) => {
    const response = await cache?.match(keys[index]).catch(() => undefined);
    const stored = response ? await response.json() as { quote: MarketQuoteMap[string]; fetchedAt: number } : null;
    if (stored) quotes[symbol] = stored.quote;
    if (!stored || Date.now() - stored.fetchedAt > 5 * 60_000) missing.push(symbol);
  }));
  if (missing.length) {
    try {
      const fresh = await fetchYahooQuotes(missing);
      Object.assign(quotes, fresh);
      await Promise.all(Object.entries(fresh).map(([symbol, quote]) => cache?.put(
        keys[parsed.symbols.indexOf(symbol)],
        Response.json({ quote, fetchedAt: Date.now() }, { headers: { "Cache-Control": "public, max-age=604800" } }),
      ).catch(() => undefined)));
    } catch {
      // Keep the last successful session through weekends, holidays, and upstream outages.
    }
  }
  if (!Object.keys(quotes).length) return Response.json({ error: "行情暂时无法获取。" }, { status: 502 });
  return Response.json({ quotes }, { headers: { "Cache-Control": "no-store" } });
}
