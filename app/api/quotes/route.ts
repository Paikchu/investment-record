import { handleQuoteRequest } from "@/lib/quote-request";

export function GET(request: Request) {
  const cache = typeof caches === "undefined" ? null : (caches as CacheStorage & { default: Cache }).default;
  return handleQuoteRequest(request, cache);
}
