"use client";

import type { HoldingPlanRecord } from "@/lib/holding-plan-store";
import { money, number, percent } from "@/lib/portfolio-format";
import type { PositionGroupView } from "@/lib/portfolio-view-model";
import type { MarketQuote } from "@/lib/yahoo-quotes";
import { useMarketQuotes, type QuoteLoadStatus } from "@/app/use-market-quotes";
import { CompanyLogo } from "@/app/company-logo";
import { PlanEditor } from "./PlanEditor";
import { SecFilingsSection } from "./SecFilingsSection";
import { OwnershipSection } from "./OwnershipSection";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export type PositionPlanStatus = "ready" | "loading" | "unavailable";

export function PositionDetailContent({
  ticker,
  companyName,
  position,
  plan,
  planStatus = "ready",
  quote,
  quoteStatus,
  onPlanDirtyChange,
}: {
  ticker: string;
  companyName: string;
  position?: PositionGroupView;
  plan: HoldingPlanRecord | null;
  planStatus?: PositionPlanStatus;
  quote?: MarketQuote;
  quoteStatus?: QuoteLoadStatus;
  onPlanDirtyChange?: (dirty: boolean) => void;
}) {
  const localQuoteState = useMarketQuotes(ticker, quoteStatus === undefined);
  const activeQuoteStatus = quoteStatus ?? localQuoteState.status;
  const activeQuote = quote ?? localQuoteState.quotes[ticker];
  const quoteTime = activeQuote
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(activeQuote.marketTime))
    : null;
  const rsiLabel = activeQuote?.rsi14 === null || activeQuote?.rsi14 === undefined
    ? null
    : activeQuote.rsi14 >= 70 ? "超买" : activeQuote.rsi14 <= 30 ? "超卖" : activeQuote.rsi14 >= 60 ? "偏强" : "中性";

  return (
    <>
      <header className="detail-hero">
        <div>
          <Badge variant="secondary">{position ? "当前持仓" : "未持有 · 预先规划"}</Badge>
          <div className="detail-title-row">
            <CompanyLogo symbol={ticker} size="lg" />
            <h1 id="position-detail-title">{ticker}</h1>
          </div>
          <p className="detail-company">{companyName}</p>
        </div>
        <div className="detail-market-panel">
          <div className="detail-quote" aria-live="polite">
            <span>股价</span>
            {activeQuote ? (
              <>
                <strong>{money(activeQuote.price)}</strong>
                <i className={activeQuote.changePercent < 0 ? "loss" : activeQuote.changePercent > 0 ? "gain" : "muted"}>
                  {percent(activeQuote.changePercent, true)}
                </i>
                {activeQuote.rsi14 !== null && (
                  <span className="detail-rsi"><b>RSI 14 · 日线</b><strong>{number(activeQuote.rsi14, 1, 1)}</strong><i>{rsiLabel}</i></span>
                )}
                <small>{quoteTime}</small>
              </>
            ) : (
              activeQuoteStatus === "loading" ? <Skeleton className="h-8 w-32" aria-label="行情读取中" /> : <span className="text-sm text-muted-foreground">行情暂不可用</span>
            )}
          </div>
        </div>
      </header>

      <nav className="detail-section-nav" aria-label="详情章节">
        <Button variant="ghost" asChild><a href="#position-structure">持仓构成</a></Button>
        <Button variant="ghost" asChild><a href="#plan-editor">持仓计划</a></Button>
        <Button variant="ghost" asChild><a href="#ownership-structure">股权结构</a></Button>
        <Button variant="ghost" asChild><a href="#sec-filings">SEC 文件</a></Button>
      </nav>

      {position ? (
        <>
          <section className="position-summary" aria-label={`${ticker} 持仓摘要`}>
            <article><span>净市值</span><strong>{money(position.value)}</strong></article>
            <article><span>净权重</span><strong>{percent(position.weight)}</strong></article>
            <article><span>持仓成本</span><strong>{money(position.cost)}</strong></article>
            <article><span>未实现盈亏</span><strong className={position.unrealized < 0 ? "loss" : "gain"}>{money(position.unrealized)}</strong></article>
            <article><span>年内净盈亏</span><strong className={position.netPnl < 0 ? "loss" : "gain"}>{money(position.netPnl)}</strong></article>
          </section>

          <section className="instrument-section" id="position-structure" aria-labelledby="instrument-title">
            <div className="detail-section-heading"><h2 id="instrument-title">持仓构成</h2></div>
            <div className="table-wrap">
              <Table className="instrument-table" aria-label={`${ticker} 正股与期权明细`}>
                <TableHeader><TableRow><TableHead>类型</TableHead><TableHead>资产 / 合约</TableHead><TableHead>数量</TableHead><TableHead>现价</TableHead><TableHead>平均成本</TableHead><TableHead>实际成本</TableHead><TableHead>持仓成本</TableHead><TableHead>市值</TableHead><TableHead>权重</TableHead><TableHead>未实现盈亏</TableHead></TableRow></TableHeader>
                <TableBody>
                  {position.stock && <TableRow><TableCell className="instrument-type" data-label="类型"><Badge variant="secondary">正股</Badge></TableCell><TableCell className="instrument-name" data-label="资产 / 合约"><strong>{position.stock.name}</strong></TableCell><TableCell data-label="数量">{number(position.stock.quantity, 0, 4)}</TableCell><TableCell data-label="现价">{money(position.stock.price)}</TableCell><TableCell data-label="平均成本">{money(position.stock.averageCost)}</TableCell><TableCell data-label="实际成本">{money(position.stock.actualCost)}</TableCell><TableCell data-label="持仓成本">{money(position.stock.cost)}</TableCell><TableCell data-label="市值">{money(position.stock.value)}</TableCell><TableCell data-label="权重">{percent(position.stock.weight)}</TableCell><TableCell data-label="未实现盈亏" className={position.stock.unrealized < 0 ? "loss" : "gain"}>{money(position.stock.unrealized)}</TableCell></TableRow>}
                  {position.options.map((option) => <TableRow key={option.contract}><TableCell className="instrument-type" data-label="类型"><Badge variant="outline">期权</Badge></TableCell><TableCell className="instrument-name" data-label="资产 / 合约"><strong className="option-contract">{option.contract}</strong></TableCell><TableCell data-label="数量">{number(option.quantity, 0, 4)}</TableCell><TableCell data-label="现价">{money(option.price)}</TableCell><TableCell data-label="平均成本">{money(option.averageCost)}</TableCell><TableCell className="muted" data-label="实际成本">—</TableCell><TableCell data-label="持仓成本">{money(option.cost)}</TableCell><TableCell data-label="市值">{money(option.marketValue)}</TableCell><TableCell data-label="权重">{percent(option.weight)}</TableCell><TableCell data-label="未实现盈亏" className={option.unrealized < 0 ? "loss" : "gain"}>{money(option.unrealized)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : (
        <section id="position-structure" className="mt-6"><Empty><EmptyHeader><EmptyTitle>暂无持仓数据</EmptyTitle><EmptyDescription>这份计划不会写入 IBKR 账本；建立持仓后，快照数据会自动出现在这里。</EmptyDescription></EmptyHeader></Empty></section>
      )}

      {planStatus === "loading" ? (
        <section className="plan-editor plan-loading" id="plan-editor" aria-labelledby="plan-loading-title">
          <div className="detail-section-heading">
            <h2 id="plan-loading-title">持仓计划</h2>
          </div>
          <div role="status" aria-label="正在读取计划" className="mt-4"><Skeleton className="h-36 w-full" /></div>
        </section>
      ) : (
        <PlanEditor
          key={ticker}
          ticker={ticker}
          initialPlan={plan}
          unavailable={planStatus === "unavailable"}
          onDirtyChange={onPlanDirtyChange}
        />
      )}

      <OwnershipSection ticker={ticker} />
      <SecFilingsSection ticker={ticker} />
    </>
  );
}
