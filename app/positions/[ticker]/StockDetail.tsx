"use client";

import { useEffect, useState } from "react";
import { CompanyLogo } from "@/app/company-logo";
import { useMarketQuotes } from "@/app/use-market-quotes";
import { SiteHeader } from "@/app/analysis/site-header";
import { BusinessOutlook } from "@/app/analysis/stocks/[ticker]/BusinessOutlook";
import { SecFilingsSection } from "@/app/analysis/stocks/[ticker]/SecFilingsSection";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { money, number, percent } from "@/lib/portfolio-format";
import type { HoldingPlanRecord } from "@/lib/holding-plan-store";
import type { PositionGroupView } from "@/lib/portfolio-view-model";
import type { PortfolioTrade } from "@/lib/portfolio-snapshot";
import type { PublicSecFiling } from "@/lib/earning-report/shared/analysis-contract/filings";
import { PositionHoldings, type PositionPlanStatus } from "./PositionDetailContent";
import { PlanEditor } from "./PlanEditor";
import { FinancialMetrics } from "./FinancialMetrics";

const sections = [
  ["outlook", "业务前瞻"], ["financials", "财务指标"], ["technical", "技术面指标"],
  ["holdings", "持仓构成"], ["plan", "持仓计划"], ["sec-filings", "披露时间线"],
] as const;

function tabFromHash() {
  const hash = window.location.hash.slice(1);
  if (hash === "position-structure") return "holdings";
  if (hash === "plan-editor") return "plan";
  return sections.some(([key]) => key === hash) ? hash : "outlook";
}

export function StockDetail({ ticker, companyName, exchange, position, trades, plan, planStatus }: {
  ticker: string; companyName: string; exchange: string; position?: PositionGroupView;
  trades: PortfolioTrade[]; plan: HoldingPlanRecord | null; planStatus: PositionPlanStatus;
}) {
  const [activeTab, setActiveTab] = useState("outlook");
  const [visited, setVisited] = useState(() => new Set(["outlook"]));
  const { quotes, status } = useMarketQuotes(ticker);
  const quote = quotes[ticker];
  const stock = position?.stock;
  const rsi = quote?.rsi14;
  const rsiLabel = rsi == null ? "" : rsi >= 70 ? "超买" : rsi <= 30 ? "超卖" : rsi >= 60 ? "偏强" : "中性";

  useEffect(() => {
    const restore = () => {
      const value = tabFromHash();
      setActiveTab(value);
      setVisited((current) => new Set([...current, value]));
    };
    restore();
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);

  function selectTab(value: string) {
    setActiveTab(value);
    setVisited((current) => new Set([...current, value]));
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#${value}`);
  }

  return (
    <main className="earning-report unified-stock">
      <div className="stock-detail-search"><SiteHeader compact /></div>
      <header className="stock-detail-identity">
        <div className="stock-detail-company">
          <CompanyLogo symbol={ticker} size="lg" />
          <div className="stock-detail-company-text"><h1>{ticker}</h1><p>{companyName}{exchange && ` · ${exchange}`}</p></div>
        </div>
        <div className="stock-detail-price" aria-live="polite">
          {quote ? <><strong>{money(quote.price)}</strong><span className={quote.changePercent < 0 ? "loss" : "gain"}>{percent(quote.changePercent, true)}</span></>
            : status === "loading" ? <Skeleton className="h-9 w-40" aria-label="行情读取中" /> : <span className="text-muted-foreground">行情暂不可用</span>}
        </div>
      </header>
      <Tabs value={activeTab} onValueChange={selectTab} className="stock-detail-tabs">
        <div className="stock-detail-tab-bar"><TabsList variant="line" aria-label="个股详情">
          {sections.map(([key, label]) => <TabsTrigger value={key} key={key}>{label}</TabsTrigger>)}
        </TabsList></div>
        <TabsContent value="outlook" forceMount hidden={activeTab !== "outlook"}>
          <div className="stock-detail-overview">
            <BusinessOutlook ticker={ticker} />
            <aside className="stock-detail-aside">
              <section aria-labelledby="holding-summary-heading">
                <h2 id="holding-summary-heading">我的持仓摘要</h2>
                {stock ? <dl>
                  <div><dt>数量</dt><dd>{number(stock.quantity, 0, 4)}</dd></div>
                  <div><dt>平均成本</dt><dd>{money(stock.averageCost)}</dd></div>
                  <div><dt>实际成本</dt><dd>{money(stock.actualCost)}</dd></div>
                  <div><dt>浮盈比例</dt><dd className={stock.unrealized < 0 ? "loss" : "gain"}>{stock.cost !== 0 ? percent(stock.unrealized / Math.abs(stock.cost) * 100, true) : "—"}</dd></div>
                </dl> : <p className="text-muted-foreground">{position ? "当前仅持有期权" : "当前未持有该股票"}</p>}
                <Button variant="outline" className="w-full" onClick={() => selectTab("holdings")}>查看持仓构成</Button>
              </section>
              <RecentDisclosures ticker={ticker} onViewAll={() => selectTab("sec-filings")} />
            </aside>
          </div>
        </TabsContent>
        <TabsContent value="financials" forceMount hidden={activeTab !== "financials"}>
          {visited.has("financials") && <FinancialMetrics ticker={ticker} />}
        </TabsContent>
        <TabsContent value="technical" forceMount hidden={activeTab !== "technical"}>
          <section className="stock-detail-technical"><div className="stock-detail-section-title"><h2>技术面指标</h2>{quote && <span>日线 · {new Date(quote.marketTime).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}</span>}</div>
            {rsi != null ? <div className="stock-detail-rsi"><div><span>RSI 14</span><span><strong>{number(rsi, 1, 1)}</strong> {rsiLabel}</span></div>
              <div className="stock-detail-rsi-track" role="meter" aria-label="RSI 14" aria-valuenow={rsi} aria-valuemin={0} aria-valuemax={100}><i style={{ left: `${Math.max(0, Math.min(100, rsi))}%` }} /></div>
              <div className="stock-detail-rsi-scale"><span>0 超卖</span><span>30</span><span>70</span><span>100 超买</span></div>
            </div> : <Empty><EmptyHeader><EmptyDescription>{status === "loading" ? "正在读取技术指标…" : "RSI 数据暂不可用。"}</EmptyDescription></EmptyHeader></Empty>}
            <p className="text-muted-foreground">其余技术指标尚未接入。</p>
          </section>
        </TabsContent>
        <TabsContent value="holdings" forceMount hidden={activeTab !== "holdings"}>
          <PositionHoldings ticker={ticker} position={position} />
          <section className="stock-detail-trades"><h2>交易记录</h2>
            {trades.length ? <Table aria-label={`${ticker} 交易记录`}><TableHeader><TableRow><TableHead>日期</TableHead><TableHead>资产 / 合约</TableHead><TableHead>方向</TableHead><TableHead>数量</TableHead><TableHead>成交价</TableHead><TableHead>佣金</TableHead><TableHead>已实现盈亏</TableHead></TableRow></TableHeader><TableBody>
              {trades.map((trade) => <TableRow key={trade.tradeId}><TableCell>{trade.tradeDate ?? trade.tradeTime.slice(0, 10)}</TableCell><TableCell>{trade.contractDescription}</TableCell><TableCell>{/^(BUY|BOT)$/i.test(trade.side) ? "买入" : /^(SELL|SLD)$/i.test(trade.side) ? "卖出" : trade.side}</TableCell><TableCell>{number(trade.size, 0, 4)}</TableCell><TableCell>{money(trade.price)}</TableCell><TableCell>{money(trade.commission)}</TableCell><TableCell className={trade.realizedPnl < 0 ? "loss" : "gain"}>{money(trade.realizedPnl)}</TableCell></TableRow>)}
            </TableBody></Table> : <Empty><EmptyHeader><EmptyTitle>暂无交易记录</EmptyTitle><EmptyDescription>当前同步数据中没有该股票的交易。</EmptyDescription></EmptyHeader></Empty>}
          </section>
        </TabsContent>
        <TabsContent value="plan" forceMount hidden={activeTab !== "plan"}>
          {visited.has("plan") && (planStatus === "anonymous" ? <Empty><EmptyHeader><EmptyTitle>持仓计划暂不可编辑</EmptyTitle><EmptyDescription>当前访问身份未登录，无法读取或保存个人持仓计划。</EmptyDescription></EmptyHeader></Empty>
            : <PlanEditor ticker={ticker} initialPlan={plan} unavailable={planStatus === "unavailable"} />)}
        </TabsContent>
        <TabsContent value="sec-filings" forceMount hidden={activeTab !== "sec-filings"}>
          {visited.has("sec-filings") && <div className="stock-analysis-filings stock-detail-timeline"><SecFilingsSection ticker={ticker} title="披露时间线" /></div>}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function RecentDisclosures({ ticker, onViewAll }: { ticker: string; onViewAll: () => void }) {
  const [filings, setFilings] = useState<PublicSecFiling[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/analysis/v1/companies/${encodeURIComponent(ticker)}/filings?limit=2`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("unavailable"); return response.json(); })
      .then((page: { filings: PublicSecFiling[] }) => { if (!controller.signal.aborted) setFilings(page.filings); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [ticker]);
  return <section aria-labelledby="recent-disclosures-heading"><h2 id="recent-disclosures-heading">最近披露</h2>
    {failed ? <p className="text-muted-foreground">披露暂时无法读取</p> : filings === null ? <Skeleton className="h-16 w-full" /> : filings.length ? <ul className="stock-detail-recent">{filings.map((filing) => <li key={filing.accessionNumber}><Badge variant={/10-K|10-Q|20-F/.test(filing.form) ? "default" : "secondary"}>{filing.form}</Badge><span>{filing.filingDate} · {/10-K|20-F/.test(filing.form) ? "年度报告" : /10-Q/.test(filing.form) ? "季度报告" : "重大事项报告"}</span></li>)}</ul> : <p className="text-muted-foreground">暂无披露</p>}
    <Button variant="outline" className="w-full" onClick={onViewAll}>全部披露</Button>
  </section>;
}
