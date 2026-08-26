import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getCloudflareSecFeed } from "@/lib/sec-cloudflare-client";
import { findSecurity } from "@/lib/site-data";

export async function GET(_request: Request, context: { params: Promise<{ ticker: string }> }) {
  if (!await getChatGPTUser()) return Response.json({ error: "未登录。" }, { status: 401 });
  const { ticker } = await context.params;
  const security = findSecurity(ticker);
  if (!security) return Response.json({ error: "未找到对应的美股或 ETF。" }, { status: 404 });
  if (security.type === "etf") return Response.json({ ticker: security.symbol, company: null, filings: [], fetchedAt: null, status: "not_applicable" });
  try {
    return Response.json(await getCloudflareSecFeed(security.symbol), { headers: { "cache-control": "private, no-store" } });
  } catch {
    return Response.json({ error: "SEC 数据读取失败。" }, { status: 502 });
  }
}
