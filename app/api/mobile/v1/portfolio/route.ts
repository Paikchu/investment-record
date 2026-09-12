import { getD1 } from "@/db";
import { readPortfolioSnapshot } from "@/lib/portfolio-store";
import { portfolioSnapshot } from "@/lib/site-data";
import { buildMobilePortfolio } from "@/lib/mobile-portfolio";

export const dynamic = "force-dynamic";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    return Response.json(buildMobilePortfolio(await readPortfolioSnapshot(await getD1()), "live"), { headers });
  } catch {
    return Response.json(buildMobilePortfolio(portfolioSnapshot, "fallback"), { headers });
  }
}
