import { getChatGPTUser } from "@/app/chatgpt-auth";
import { getD1 } from "@/db";
import { getHoldingPlan, type HoldingPlanRecord } from "@/lib/holding-plan-store";
import { buildPortfolioViewModel } from "@/lib/portfolio-view-model";
import { currentPortfolioSnapshot, findSecurity } from "@/lib/site-data";
import { normalizeTicker } from "@/lib/symbol-directory";
import { notFound } from "next/navigation";
import { StockDetail } from "./StockDetail";
import { canonicalUnderlying } from "@/lib/portfolio-snapshot";
import "@/app/analysis/earning-report.css";

export const dynamic = "force-dynamic";

export default async function PositionPage({ params }: { params: Promise<{ ticker: string }> }) {
  const ticker = normalizeTicker((await params).ticker);
  const snapshot = await currentPortfolioSnapshot();
  const portfolioViewModel = buildPortfolioViewModel(snapshot);
  const security = findSecurity(ticker, portfolioViewModel);
  if (!security) notFound();
  const user = await getChatGPTUser();
  const position = portfolioViewModel.positionGroups.find((group) => group.symbol === ticker);
  let plan: HoldingPlanRecord | null = null;
  let planUnavailable = false;
  try {
    if (user) plan = await getHoldingPlan(await getD1(), user.email, ticker);
  } catch {
    planUnavailable = true;
  }

  return (
    <StockDetail
      key={ticker}
      companyName={security.name}
      exchange={security.exchange}
      plan={plan}
      planStatus={!user ? "anonymous" : planUnavailable ? "unavailable" : "ready"}
      position={position}
      ticker={ticker}
      trades={snapshot.trades.filter((trade) => canonicalUnderlying(trade.symbol) === ticker).sort((a, b) => b.tradeTime.localeCompare(a.tradeTime))}
    />
  );
}
