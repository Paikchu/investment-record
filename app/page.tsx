import { LocalizedText } from "./language-provider";
import earningsData from "@/data/earnings-calendar.json";
import type { EarningsCalendarSnapshot } from "@/lib/earnings-calendar";
import { buildHeatmapHoldings } from "@/lib/portfolio-heatmap";
import { buildPortfolioViewModel } from "@/lib/portfolio-view-model";
import { currentPortfolioSnapshot } from "@/lib/site-data";
import { PortfolioDashboard } from "./portfolio-dashboard";

const earnings = earningsData as EarningsCalendarSnapshot;
export const dynamic = "force-dynamic";

export default async function Home() {
  const snapshot = await currentPortfolioSnapshot();
  const heatmapHoldings = buildHeatmapHoldings(snapshot);
  const portfolio = buildPortfolioViewModel(snapshot);
  const optionUnrealizedPnl = snapshot.positions
    .filter((position) => position.assetClass === "OPT")
    .reduce((sum, position) => sum + position.unrealizedPnl, 0);
  const netLiquidationWithoutOptionPnl = snapshot.account.netLiquidation - optionUnrealizedPnl;
  const grossPositionsValue = snapshot.positions.reduce((sum, position) => sum + Math.abs(position.marketValue), 0);
  const portfolioLeverage = snapshot.account.netLiquidation === 0 ? 0 : grossPositionsValue / snapshot.account.netLiquidation;
  return (
    <>
      <a className="skip-link" href="#main-content"><LocalizedText>跳到主要内容</LocalizedText></a>
      <main className="page-shell" id="main-content">
        <PortfolioDashboard
          heatmapHoldings={heatmapHoldings}
          positionGroups={portfolio.positionGroups}
          historicalPositionGroups={portfolio.historicalPositionGroups}
          stockMarketValue={portfolio.stockMarketValue}
          optionMarketValue={portfolio.optionMarketValue}
          netPositionsValue={portfolio.netPositionsValue}
          earningsEvents={earnings.events}
          netLiquidation={snapshot.account.netLiquidation}
          netLiquidationWithoutOptionPnl={netLiquidationWithoutOptionPnl}
          portfolioLeverage={portfolioLeverage}
          netDeposits={snapshot.account.netDeposits}
          cashBalance={snapshot.account.cashBalance}
        />
      </main>
    </>
  );
}
