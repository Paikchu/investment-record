"use client";

import { useLanguage } from "@/app/language-provider";

import type { HoldingPlanRecord } from "@/lib/holding-plan-store";
import { money, number, percent } from "@/lib/portfolio-format";
import type { PositionGroupView } from "@/lib/portfolio-view-model";
import type { MarketQuote } from "@/lib/yahoo-quotes";
import { useMarketQuotes, type QuoteLoadStatus } from "@/app/use-market-quotes";
import { CompanyLogo } from "@/app/company-logo";
import { PlanEditor } from "./PlanEditor";
import { SecFilingsSection } from "./SecFilingsSection";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export type PositionPlanStatus = "ready" | "loading" | "unavailable" | "anonymous";

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
  const { t } = useLanguage();
  const localQuoteState = useMarketQuotes(ticker, quoteStatus === undefined);
  const activeQuoteStatus = quoteStatus ?? localQuoteState.status;
  const activeQuote = quote ?? localQuoteState.quotes[ticker];
  const quoteTime = activeQuote
    ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" }).format(new Date(activeQuote.marketTime))
    : null;
  const rsiLabel = activeQuote?.rsi14 === null || activeQuote?.rsi14 === undefined
    ? null
    : activeQuote.rsi14 >= 70 ? t("超买") : activeQuote.rsi14 <= 30 ? t("超卖") : activeQuote.rsi14 >= 60 ? t("偏强") : t("中性");

  return (
    <>
      <header className="detail-hero">
        <div>
          <Badge variant="secondary">{position ? t("当前持仓") : t("未持有 · 预先规划")}</Badge>
          <div className="detail-title-row">
            <CompanyLogo symbol={ticker} size="lg" />
            <h1 id="position-detail-title">{ticker}</h1>
          </div>
          <p className="detail-company">{companyName}</p>
        </div>
        <div className="detail-market-panel">
          <div className="detail-quote" aria-live="polite">
            <span>{t("股价")}</span>
            {activeQuote ? (
              <>
                <strong>{money(activeQuote.price)}</strong>
                <i className={activeQuote.changePercent < 0 ? "loss" : activeQuote.changePercent > 0 ? "gain" : "muted"}>
                  {percent(activeQuote.changePercent, true)}
                </i>
                {activeQuote.rsi14 !== null && (
                  <span className="detail-rsi"><b>{t("RSI 14 · 日线")}</b><strong>{number(activeQuote.rsi14, 1, 1)}</strong><i>{rsiLabel}</i></span>
                )}
                <small>{quoteTime}</small>
              </>
            ) : (
              activeQuoteStatus === "loading" ? <Skeleton className="h-8 w-32" aria-label={t("行情读取中")} /> : <span className="text-sm text-muted-foreground">{t("行情暂不可用")}</span>
            )}
          </div>
        </div>
      </header>

      <nav className="detail-section-nav" aria-label={t("详情章节")}>
        <Button variant="ghost" asChild><a href="#position-structure">{t("持仓构成")}</a></Button>
        <Button variant="ghost" asChild><a href="#plan-editor">{t("持仓计划")}</a></Button>
        <Button variant="ghost" asChild><a href="#sec-filings">{t("SEC 文件")}</a></Button>
      </nav>

      {position ? (
        <>
          <section className="position-summary" aria-label={`${ticker} 持仓摘要`}>
            <article><span>{t("净市值")}</span><strong>{money(position.value)}</strong></article>
            <article><span>{t("净权重")}</span><strong>{percent(position.weight)}</strong></article>
            <article><span>{t("持仓成本")}</span><strong>{money(position.cost)}</strong></article>
            <article><span>{t("未实现盈亏")}</span><strong className={position.unrealized < 0 ? "loss" : "gain"}>{money(position.unrealized)}</strong></article>
            <article><span>{t("年内净盈亏")}</span><strong className={position.netPnl < 0 ? "loss" : "gain"}>{money(position.netPnl)}</strong></article>
          </section>

          <section className="instrument-section" id="position-structure" aria-labelledby="instrument-title">
            <div className="detail-section-heading"><h2 id="instrument-title">{t("持仓构成")}</h2></div>
            <div className="table-wrap">
              <Table className="instrument-table" aria-label={`${ticker} 正股与期权明细`}>
                <TableHeader><TableRow><TableHead>{t("类型")}</TableHead><TableHead>{t("资产 / 合约")}</TableHead><TableHead>{t("数量")}</TableHead><TableHead>{t("现价")}</TableHead><TableHead>{t("平均成本")}</TableHead><TableHead>{t("实际成本")}</TableHead><TableHead>{t("持仓成本")}</TableHead><TableHead>{t("市值")}</TableHead><TableHead>{t("权重")}</TableHead><TableHead>{t("未实现盈亏")}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {position.stock && <TableRow><TableCell className="instrument-type" data-label={t("类型")}><Badge variant="secondary">{t("正股")}</Badge></TableCell><TableCell className="instrument-name" data-label={t("资产 / 合约")}><strong>{position.stock.name}</strong></TableCell><TableCell data-label={t("数量")}>{number(position.stock.quantity, 0, 4)}</TableCell><TableCell data-label={t("现价")}>{money(position.stock.price)}</TableCell><TableCell data-label={t("平均成本")}>{money(position.stock.averageCost)}</TableCell><TableCell data-label={t("实际成本")}>{money(position.stock.actualCost)}</TableCell><TableCell data-label={t("持仓成本")}>{money(position.stock.cost)}</TableCell><TableCell data-label={t("市值")}>{money(position.stock.value)}</TableCell><TableCell data-label={t("权重")}>{percent(position.stock.weight)}</TableCell><TableCell data-label={t("未实现盈亏")} className={position.stock.unrealized < 0 ? "loss" : "gain"}>{money(position.stock.unrealized)}</TableCell></TableRow>}
                  {position.options.map((option) => <TableRow key={option.contract}><TableCell className="instrument-type" data-label={t("类型")}><Badge variant="outline">{t("期权")}</Badge></TableCell><TableCell className="instrument-name" data-label={t("资产 / 合约")}><strong className="option-contract">{option.contract}</strong></TableCell><TableCell data-label={t("数量")}>{number(option.quantity, 0, 4)}</TableCell><TableCell data-label={t("现价")}>{money(option.price)}</TableCell><TableCell data-label={t("平均成本")}>{money(option.averageCost)}</TableCell><TableCell className="muted" data-label={t("实际成本")}>—</TableCell><TableCell data-label={t("持仓成本")}>{money(option.cost)}</TableCell><TableCell data-label={t("市值")}>{money(option.marketValue)}</TableCell><TableCell data-label={t("权重")}>{percent(option.weight)}</TableCell><TableCell data-label={t("未实现盈亏")} className={option.unrealized < 0 ? "loss" : "gain"}>{money(option.unrealized)}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : (
        <section id="position-structure" className="mt-6"><Empty><EmptyHeader><EmptyTitle>{t("暂无持仓数据")}</EmptyTitle><EmptyDescription>{t("这份计划不会写入 IBKR 账本；建立持仓后，快照数据会自动出现在这里。")}</EmptyDescription></EmptyHeader></Empty></section>
      )}

      {planStatus === "anonymous" ? null : planStatus === "loading" ? (
        <section className="plan-editor plan-loading" id="plan-editor" aria-labelledby="plan-loading-title">
          <div className="detail-section-heading">
            <h2 id="plan-loading-title">{t("持仓计划")}</h2>
          </div>
          <div role="status" aria-label={t("正在读取计划")} className="mt-4"><Skeleton className="h-36 w-full" /></div>
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

      <SecFilingsSection ticker={ticker} />
    </>
  );
}
