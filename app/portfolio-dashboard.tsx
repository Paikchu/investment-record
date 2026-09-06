"use client";

import { ThemeControl } from "./theme-control";
import { Empty, EmptyHeader, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronUp, ChevronDown, CalendarDays } from "lucide-react";
import { Fragment, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";

import {
  allocationColor,
  buildAllocation,
  buildSectorAllocation,
  sortPositionGroups,
  type PositionSortKey,
  type SortDirection,
} from "@/lib/portfolio-dashboard";
import { buildEarningsReminder, isUpcomingEarnings, type EarningsEvent } from "@/lib/earnings-calendar";
import { money, number, percent } from "@/lib/portfolio-format";
import { heatmapThemeColor, type HeatmapHolding } from "@/lib/portfolio-heatmap";
import type { PositionGroupView } from "@/lib/portfolio-view-model";
import { AddPlanDialog } from "./AddPlanDialog";
import { InvestmentSettingsDialog } from "./investment-settings-dialog";
import { PortfolioHeatmap } from "./portfolio-heatmap";
import { useMarketQuotes, type QuoteLoadStatus } from "./use-market-quotes";
import type { MarketQuoteMap } from "@/lib/yahoo-quotes";

const NET_DEPOSITS_STORAGE_KEY = "max-investment-record:net-deposits";

function Pnl({ value }: { value: number }) {
  const className = value < 0 ? "loss" : value > 0 ? "gain" : "muted";
  return <span className={className}>{money(value, true)}</span>;
}

function PortfolioOverview({
  netLiquidation,
  totalPnl,
  totalPnlRate,
  netLiquidationWithoutOptionPnl,
  portfolioLeverage,
  netDeposits,
  cashBalance,
  netPositionsValue,
  stockMarketValue,
  optionMarketValue,
  nextEarnings,
  nextEarningsReminder,
  onOpenSettings,
}: {
  netLiquidation: number;
  totalPnl: number;
  totalPnlRate: number;
  netLiquidationWithoutOptionPnl: number;
  portfolioLeverage: number;
  netDeposits: number;
  cashBalance: number;
  netPositionsValue: number;
  stockMarketValue: number;
  optionMarketValue: number;
  nextEarnings?: EarningsEvent;
  nextEarningsReminder: ReturnType<typeof buildEarningsReminder> | null;
  onOpenSettings: () => void;
}) {
  return (
    <section className="portfolio-overview" aria-labelledby="portfolio-title">
      <div className="hero">
        <div className="portfolio-heading">
          <div className="flex items-center gap-2"><h1 className="summary-nav-label" id="portfolio-title">当前净值</h1><ThemeControl /></div>
          <strong className="summary-nav-value">{money(netLiquidation)}</strong>
          <div className="summary-return">
            <span className="summary-pnl-label">累计盈亏</span>
            <strong className={`summary-pnl ${totalPnl < 0 ? "loss" : totalPnl > 0 ? "gain" : "muted"}`}>
              {money(totalPnl, true)} <i>{percent(totalPnlRate, true)}</i>
            </strong>
          </div>
        </div>
        <div className="summary-support" aria-label="组合摘要">
          <article><span>持仓净市值</span><strong>{money(netPositionsValue)}</strong></article>
          <article><span>现金</span><strong>{money(cashBalance)}</strong></article>
          <article><span>杠杆率</span><strong>{number(portfolioLeverage, 2, 2)}x</strong></article>
          <article>
            <div className="summary-metric-label">
              <span>净入金</span>
              <TooltipProvider><Tooltip><TooltipTrigger asChild><Button type="button" variant="ghost" size="icon-sm" onClick={onOpenSettings} aria-label="调整净入金">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" /><path d="m13 6 5 5" />
                </svg>
              </Button></TooltipTrigger><TooltipContent>调整净入金</TooltipContent></Tooltip></TooltipProvider>
            </div>
            <strong>{money(netDeposits)}</strong>
          </article>
        </div>
      </div>
      <section className="header-position-summary" aria-label="持仓摘要">
        <article><span>正股</span><strong>{money(stockMarketValue)}</strong></article>
        <article><span>期权</span><strong>{money(optionMarketValue)}</strong></article>
        <article><span>剔除期权浮盈亏</span><strong>{money(netLiquidationWithoutOptionPnl)}</strong></article>
        {nextEarnings && nextEarningsReminder && (
          <article className="header-next-earnings">
            <span>即将财报</span>
            <strong>{nextEarnings.symbol} {nextEarningsReminder.releaseDateLabel} · {nextEarningsReminder.sessionLabel}</strong>
            <i>北京{nextEarningsReminder.viewDateLabel}{nextEarningsReminder.viewTimeLabel}，{nextEarningsReminder.countdownLabel}</i>
          </article>
        )}
      </section>
    </section>
  );
}

function PositionReminder({ event, asOf }: { event?: EarningsEvent; asOf: string }) {
  if (!event) return null;

  const reminder = buildEarningsReminder(event, asOf);
  return (
    <span
      className="position-reminder"
      title={`美股 ${reminder.releaseDateLabel}${reminder.sessionLabel}发布；北京 ${reminder.viewDateLabel}${reminder.viewTimeLabel}查看`}
    >
      <strong>{reminder.releaseDateLabel} · {reminder.sessionLabel}</strong>
      <small>北京{reminder.viewDateLabel}{reminder.viewTimeLabel} · {reminder.countdownLabel}</small>
    </span>
  );
}

function AllocationRing({
  groups,
  activeSymbol,
  onActiveSymbolChange,
}: {
  groups: PositionGroupView[];
  activeSymbol: string | null;
  onActiveSymbolChange: (symbol: string | null) => void;
}) {
  const [showOther, setShowOther] = useState(false);
  const allocation = useMemo(() => buildAllocation(groups), [groups]);
  const otherActive = Boolean(activeSymbol && allocation.other.some((group) => group.symbol === activeSymbol));
  const segments = useMemo(() => {
    let offset = 0;
    return [
      ...allocation.leading.map((group, index) => ({ symbol: group.symbol, weight: group.weight, color: allocationColor(index) })),
      { symbol: "OTHER", weight: allocation.otherWeight, color: "#c8c0b3" },
    ].map((segment) => {
      const result = { ...segment, offset };
      offset += segment.weight;
      return result;
    });
  }, [allocation]);

  return (
    <div className="allocation-wrap">
      <div className="allocation-ring">
        <svg className="allocation-ring-svg" viewBox="0 0 100 100" role="img" aria-label={`前四大持仓净权重 ${allocation.leadingWeight.toFixed(2)}%`}>
          <circle className="ring-track" cx="50" cy="50" r="42" pathLength="100" />
          {segments.map((segment) => (
            <circle
              className="ring-segment"
              cx="50"
              cy="50"
              data-active={segment.symbol === activeSymbol || (segment.symbol === "OTHER" && otherActive)}
              key={segment.symbol}
              onFocus={() => segment.symbol !== "OTHER" && onActiveSymbolChange(segment.symbol)}
              onMouseEnter={() => {
                if (segment.symbol === "OTHER") setShowOther(true);
                else onActiveSymbolChange(segment.symbol);
              }}
              onMouseLeave={() => {
                if (segment.symbol === "OTHER") setShowOther(false);
                else onActiveSymbolChange(null);
              }}
              pathLength="100"
              r="42"
              stroke={segment.color}
              strokeDasharray={`${segment.weight} ${100 - segment.weight}`}
              strokeDashoffset={-segment.offset}
              tabIndex={0}
              transform="rotate(-90 50 50)"
            />
          ))}
        </svg>
        <span className="ring-center">{allocation.leadingWeight.toFixed(1)}%<small>前四大持仓</small></span>
      </div>
      <div className="legend">
        {allocation.leading.map((group, index) => (
          <button
            className="legend-row"
            data-active={activeSymbol === group.symbol}
            key={group.symbol}
            onFocus={() => onActiveSymbolChange(group.symbol)}
            onMouseEnter={() => onActiveSymbolChange(group.symbol)}
            onMouseLeave={() => onActiveSymbolChange(null)}
            style={{ "--holding-color": allocationColor(index) } as CSSProperties}
            type="button"
          >
            <span><i aria-hidden="true" />{group.symbol}</span><b>{group.weight.toFixed(2)}%</b>
          </button>
        ))}
        <button
          className="legend-row legend-other"
          data-active={otherActive}
          onBlur={() => setShowOther(false)}
          onClick={() => setShowOther((current) => !current)}
          onFocus={() => setShowOther(true)}
          onMouseEnter={() => setShowOther(true)}
          onMouseLeave={() => setShowOther(false)}
          type="button"
        >
          <span><i aria-hidden="true" />其他</span><b>{allocation.otherWeight.toFixed(2)}%</b>
        </button>
        {showOther && (
          <div className="other-popover" role="tooltip">
            <strong>其他持仓与空头调整</strong>
            {allocation.other.map((group) => (
              <span key={group.symbol}><b>{group.symbol}</b><i>{group.weight > 0 ? "+" : "−"}{Math.abs(group.weight).toFixed(2)}%</i></span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SectorAllocationRing({ groups }: { groups: PositionGroupView[] }) {
  const allocation = useMemo(() => buildSectorAllocation(groups), [groups]);
  const segments = useMemo(() => {
    const total = allocation.classifiedWeight + allocation.unallocatedWeight;
    const scale = total > 100 ? 100 / total : 1;
    const rawSegments = [
      ...allocation.sectors.map((sector) => ({ label: sector.domain, weight: sector.weight, color: sector.color })),
      ...(allocation.unallocatedWeight > 0 ? [{ label: "现金与对冲", weight: allocation.unallocatedWeight, color: "#c8c0b3" }] : []),
    ];
    let offset = 0;
    return rawSegments.map((segment) => {
      const result = { ...segment, weight: segment.weight * scale, offset };
      offset += result.weight;
      return result;
    });
  }, [allocation]);

  return (
    <div className="allocation-wrap sector-allocation-wrap">
      <div className="allocation-ring">
        <svg className="allocation-ring-svg" viewBox="0 0 100 100" role="img" aria-label={`板块占比，已归类板块 ${allocation.classifiedWeight.toFixed(2)}%`}>
          <circle className="ring-track" cx="50" cy="50" r="42" pathLength="100" />
          {segments.map((segment) => (
            <circle
              className="ring-segment sector-ring-segment"
              cx="50"
              cy="50"
              key={segment.label}
              pathLength="100"
              r="42"
              stroke={segment.color}
              strokeDasharray={`${segment.weight} ${100 - segment.weight}`}
              strokeDashoffset={-segment.offset}
              transform="rotate(-90 50 50)"
            />
          ))}
        </svg>
        <span className="ring-center">{allocation.classifiedWeight.toFixed(1)}%<small>已归类板块</small></span>
      </div>
      <div className="legend sector-legend" aria-label="板块占比图例">
        {allocation.sectors.map((sector) => (
          <div className="legend-row sector-legend-row" key={sector.domain}>
            <span><i aria-hidden="true" style={{ "--holding-color": sector.color } as CSSProperties} />{sector.domain}</span><b>{sector.weight.toFixed(2)}%</b>
          </div>
        ))}
        {allocation.unallocatedWeight > 0 && (
          <div className="legend-row sector-legend-row legend-other">
            <span><i aria-hidden="true" />现金与对冲</span><b>{allocation.unallocatedWeight.toFixed(2)}%</b>
          </div>
        )}
      </div>
    </div>
  );
}

function AllocationPanel({
  groups,
  activeSymbol,
  onActiveSymbolChange,
}: {
  groups: PositionGroupView[];
  activeSymbol: string | null;
  onActiveSymbolChange: (symbol: string | null) => void;
}) {
  return (
    <div className="allocation-comparison">
      <section className="allocation-mode-panel" aria-labelledby="holding-allocation-title">
        <h3 id="holding-allocation-title">个股</h3>
        <AllocationRing groups={groups} activeSymbol={activeSymbol} onActiveSymbolChange={onActiveSymbolChange} />
      </section>
      <section className="allocation-mode-panel" aria-labelledby="sector-allocation-title">
        <h3 id="sector-allocation-title">板块</h3>
        <SectorAllocationRing groups={groups} />
      </section>
    </div>
  );
}

type LedgerSortKey = PositionSortKey | "price" | "changePercent" | "actualCost";
const ledgerColumns: Array<{ key: LedgerSortKey; label: string }> = [
  { key: "symbol", label: "标的" },
  { key: "price", label: "现价" },
  { key: "changePercent", label: "日涨跌" },
  { key: "value", label: "净市值" },
  { key: "weight", label: "净权重" },
  { key: "actualCost", label: "摊薄成本" },
  { key: "cost", label: "持仓成本" },
  { key: "unrealized", label: "未实现盈亏" },
  { key: "realized", label: "年内已实现" },
  { key: "netPnl", label: "年内净盈亏" },
];

function PositionLedger({
  groups,
  activeSymbol,
  onActiveSymbolChange,
  quotes,
  quoteStatus,
  earningsBySymbol,
  earningsUpdatedAt,
}: {
  groups: PositionGroupView[];
  activeSymbol: string | null;
  onActiveSymbolChange: (symbol: string | null) => void;
  quotes: MarketQuoteMap;
  quoteStatus: QuoteLoadStatus;
  earningsBySymbol: Map<string, EarningsEvent>;
  earningsUpdatedAt: string;
}) {
  const [sortKey, setSortKey] = useState<LedgerSortKey>("weight");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const sortedGroups = useMemo(() => {
    if (sortKey !== "price" && sortKey !== "changePercent" && sortKey !== "actualCost") {
      return sortPositionGroups(groups, sortKey, sortDirection);
    }
    const value = (group: PositionGroupView) => sortKey === "actualCost"
      ? group.stock?.actualCost : quotes[group.symbol]?.[sortKey];
    return [...groups].sort((left, right) => {
      const a = value(left), b = value(right);
      if (a == null) return b == null ? 0 : 1;
      if (b == null) return -1;
      return (a - b) * (sortDirection === "asc" ? 1 : -1);
    });
  }, [groups, quotes, sortDirection, sortKey]);

  return (
    <div className="position-scroll" aria-label="按 Ticker 分类的持仓">
      <Table className="ledger-table" aria-label="投资账本">
        <TableHeader>
          <TableRow>
            {ledgerColumns.map((column) => (
              <TableHead key={column.key} scope="col" aria-sort={sortKey === column.key ? (sortDirection === "desc" ? "descending" : "ascending") : "none"}>
                <Button variant="ghost" size="sm" type="button"
                  aria-label={`${column.label}，点击${sortKey === column.key && sortDirection === "desc" ? "升序" : "降序"}`}
                  onClick={() => {
                    setSortDirection(sortKey === column.key && sortDirection === "desc" ? "asc" : "desc");
                    setSortKey(column.key);
                  }}>
                  {column.label}
                  <span className="ledger-sort-arrows" aria-hidden="true">
                    <ChevronUp data-active={sortKey === column.key && sortDirection === "asc"} />
                    <ChevronDown data-active={sortKey === column.key && sortDirection === "desc"} />
                  </span>
                </Button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedGroups.map((group) => (
            <Fragment key={group.symbol}>
              <TableRow className="ledger-data-row" data-state={activeSymbol === group.symbol ? "selected" : undefined}
                style={{ "--holding-color": heatmapThemeColor(group.symbol) } as CSSProperties}
                onFocus={() => onActiveSymbolChange(group.symbol)}
                onBlur={() => onActiveSymbolChange(null)}
                onMouseEnter={() => onActiveSymbolChange(group.symbol)}
                onMouseLeave={() => onActiveSymbolChange(null)}>
                <TableCell>
                  <div className="ledger-identity">
                    <Link href={`/positions/${encodeURIComponent(group.symbol)}`} className="ledger-symbol">
                      <i className="holding-mark" aria-hidden="true" />
                      <strong>{group.symbol}</strong><span className="sr-only">，查看持仓详情</span>
                    </Link>
                    {earningsBySymbol.has(group.symbol) && <TooltipProvider><Tooltip><TooltipTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`${group.symbol} 财报提醒`}><CalendarDays /></Button>
                    </TooltipTrigger><TooltipContent><PositionReminder event={earningsBySymbol.get(group.symbol)} asOf={earningsUpdatedAt} /></TooltipContent></Tooltip></TooltipProvider>}
                  </div>
                </TableCell>
                <TableCell>{quotes[group.symbol] ? money(quotes[group.symbol].price) : <span className="quote-muted">{quoteStatus === "loading" ? "读取中" : "—"}</span>}</TableCell>
                <TableCell><span className="daily-change-value" data-direction={quotes[group.symbol]?.changePercent < 0 ? "loss" : quotes[group.symbol]?.changePercent > 0 ? "gain" : "neutral"}>{quotes[group.symbol] ? percent(quotes[group.symbol].changePercent, true) : "—"}</span></TableCell>
                <TableCell>{money(group.value)}</TableCell>
                <TableCell>{percent(group.weight)}</TableCell>
                <TableCell>{group.stock ? money(group.stock.actualCost) : <span className="quote-muted">—</span>}</TableCell>
                <TableCell>{money(group.cost)}</TableCell>
                <TableCell><Pnl value={group.unrealized} /></TableCell>
                <TableCell><Pnl value={group.realized} /></TableCell>
                <TableCell><Pnl value={group.netPnl} /></TableCell>
              </TableRow>
              {group.options.length > 0 && (
                <TableRow className="ledger-options-row"><TableCell colSpan={ledgerColumns.length}>
                  <div className="position-submenu" aria-label={`${group.symbol} 期权持仓`}>
                    {group.options.map((option) => (
                      <div className="position-submenu-row" key={option.contract}>
                        <span className="submenu-type">期权</span>
                        <strong>{option.contract}</strong>
                        <span className="submenu-quantity">{number(option.quantity, 0, 4)} 张</span>
                        <i className="submenu-value">{money(option.marketValue)}</i>
                      </div>
                    ))}
                  </div>
                </TableCell></TableRow>
              )}
            </Fragment>
          ))}
          {sortedGroups.length === 0 && <TableRow><TableCell colSpan={ledgerColumns.length}><Empty><EmptyHeader><EmptyDescription>当前快照没有持仓。</EmptyDescription></EmptyHeader></Empty></TableCell></TableRow>}
        </TableBody>
      </Table>
    </div>
  );
}

export function PortfolioDashboard({
  heatmapHoldings,
  positionGroups,
  stockMarketValue,
  optionMarketValue,
  netPositionsValue,
  earningsEvents,
  netLiquidation,
  netLiquidationWithoutOptionPnl,
  portfolioLeverage,
  netDeposits,
  cashBalance,
}: {
  heatmapHoldings: HeatmapHolding[];
  positionGroups: PositionGroupView[];
  stockMarketValue: number;
  optionMarketValue: number;
  netPositionsValue: number;
  earningsEvents: EarningsEvent[];
  netLiquidation: number;
  netLiquidationWithoutOptionPnl: number;
  portfolioLeverage: number;
  netDeposits: number;
  cashBalance: number;
}) {
  const [activeSymbol, setActiveSymbol] = useState<string | null>(null);
  const [analysisExpanded, setAnalysisExpanded] = useState(false);
  const [configuredNetDeposits, setConfiguredNetDeposits] = useState(netDeposits);
  const [settingsOpen, setSettingsOpen] = useState(() => (
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("settings") === "1"
  ));
  const [earningsAsOf] = useState(() => new Date().toISOString());
  const positionSymbols = useMemo(() => new Set(positionGroups.map((group) => group.symbol)), [positionGroups]);
  const quoteSymbols = useMemo(() => positionGroups.map((group) => group.symbol).join(","), [positionGroups]);
  const quoteState = useMarketQuotes(quoteSymbols);
  const earningsBySymbol = useMemo(() => {
    const events = new Map<string, EarningsEvent>();
    for (const event of earningsEvents) {
      if (
        positionSymbols.has(event.symbol) &&
        isUpcomingEarnings(event, earningsAsOf) &&
        !events.has(event.symbol)
      ) events.set(event.symbol, event);
    }
    return events;
  }, [earningsAsOf, earningsEvents, positionSymbols]);

  const nextEarnings = earningsEvents.find((event) => (
    positionSymbols.has(event.symbol) && isUpcomingEarnings(event, earningsAsOf)
  ));
  const nextEarningsReminder = nextEarnings ? buildEarningsReminder(nextEarnings, earningsAsOf) : null;
  const configuredTotalPnl = netLiquidation - configuredNetDeposits;
  const configuredTotalPnlRate = configuredNetDeposits === 0 ? 0 : configuredTotalPnl / configuredNetDeposits * 100;

  useEffect(() => {
    const syncStoredNetDeposits = () => {
      const storedValue = window.localStorage.getItem(NET_DEPOSITS_STORAGE_KEY);
      const parsedValue = storedValue === null ? Number.NaN : Number(storedValue);
      setConfiguredNetDeposits(Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : netDeposits);
    };
    syncStoredNetDeposits();
    window.addEventListener("storage", syncStoredNetDeposits);
    return () => window.removeEventListener("storage", syncStoredNetDeposits);
  }, [netDeposits]);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has("settings") || searchParams.has("view")) {
      searchParams.delete("view");
      searchParams.delete("settings");
      const query = searchParams.toString();
      window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
    }
  }, []);

  function saveNetDeposits(value: number) {
    window.localStorage.setItem(NET_DEPOSITS_STORAGE_KEY, String(value));
    setConfiguredNetDeposits(value);
  }

  return (
    <>
      <div id="portfolio-panel" role="region" aria-labelledby="portfolio-title">
        <PortfolioOverview
          netLiquidation={netLiquidation}
          totalPnl={configuredTotalPnl}
          totalPnlRate={configuredTotalPnlRate}
          netLiquidationWithoutOptionPnl={netLiquidationWithoutOptionPnl}
          portfolioLeverage={portfolioLeverage}
          netDeposits={configuredNetDeposits}
          cashBalance={cashBalance}
          netPositionsValue={netPositionsValue}
          stockMarketValue={stockMarketValue}
          optionMarketValue={optionMarketValue}
          nextEarnings={nextEarnings}
          nextEarningsReminder={nextEarningsReminder}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      <div className="lower-grid portfolio-workspace">
        <aside className="portfolio-analysis-stack" aria-label="仓位分析" data-expanded={analysisExpanded}>
          <Button
            aria-controls="allocation-panel heatmap-section"
            aria-expanded={analysisExpanded}
            className="portfolio-analysis-toggle"
            onClick={() => setAnalysisExpanded((current) => !current)}
            type="button"
            variant="ghost"
          >
            <span><strong>仓位分析</strong><small>仓位构成与热力图</small></span>
            <span>{analysisExpanded ? "收起" : "展开"}<svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 7.5 5 5 5-5" /></svg></span>
          </Button>
          <section className="allocation-panel" id="allocation-panel" aria-labelledby="allocation-title">
            <h2 id="allocation-title">仓位构成</h2>
            <div className="section-divider" aria-hidden="true" />
            <AllocationPanel groups={positionGroups} activeSymbol={activeSymbol} onActiveSymbolChange={setActiveSymbol} />
          </section>
          <PortfolioHeatmap holdings={heatmapHoldings} activeSymbol={activeSymbol} onActiveSymbolChange={setActiveSymbol} />
        </aside>
        <section className="ledger-panel ledger-page" aria-labelledby="ledger-title">
          <div className="ledger-heading">
            <h2 id="ledger-title">投资账本</h2>
            <AddPlanDialog />
          </div>
          <div className="section-divider" aria-hidden="true" />
          <div className="ledger-content">
            <PositionLedger
              groups={positionGroups}
              activeSymbol={activeSymbol}
              onActiveSymbolChange={setActiveSymbol}
              quotes={quoteState.quotes}
              quoteStatus={quoteState.status}
              earningsBySymbol={earningsBySymbol}
              earningsUpdatedAt={earningsAsOf}
            />
          </div>
        </section>
      </div>
      <InvestmentSettingsDialog open={settingsOpen} value={configuredNetDeposits} onClose={() => setSettingsOpen(false)} onSave={saveNetDeposits} />
    </>
  );
}
