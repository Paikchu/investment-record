"use client";

import { useLanguage } from "@/app/language-provider";
import { useMemo, useState, type CSSProperties } from "react";
import { allocationColor, buildAllocation, buildSectorAllocation } from "@/lib/portfolio-dashboard";
import type { PositionGroupView } from "@/lib/portfolio-view-model";

function AllocationRing({
  groups,
  activeSymbol,
  onActiveSymbolChange,
}: {
  groups: PositionGroupView[];
  activeSymbol: string | null;
  onActiveSymbolChange: (symbol: string | null) => void;
}) {
  const { t } = useLanguage();
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
        <span className="ring-center">{allocation.leadingWeight.toFixed(1)}%<small>{t("前四大持仓")}</small></span>
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
          <span><i aria-hidden="true" />{t("其他")}</span><b>{allocation.otherWeight.toFixed(2)}%</b>
        </button>
        {showOther && (
          <div className="other-popover" role="tooltip">
            <strong>{t("其他持仓与空头调整")}</strong>
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
  const { t } = useLanguage();
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
        <span className="ring-center">{allocation.classifiedWeight.toFixed(1)}%<small>{t("已归类板块")}</small></span>
      </div>
      <div className="legend sector-legend" aria-label={t("板块占比图例")}>
        {allocation.sectors.map((sector) => (
          <div className="legend-row sector-legend-row" key={sector.domain}>
            <span><i aria-hidden="true" style={{ "--holding-color": sector.color } as CSSProperties} />{sector.domain}</span><b>{sector.weight.toFixed(2)}%</b>
          </div>
        ))}
        {allocation.unallocatedWeight > 0 && (
          <div className="legend-row sector-legend-row legend-other">
            <span><i aria-hidden="true" />{t("现金与对冲")}</span><b>{allocation.unallocatedWeight.toFixed(2)}%</b>
          </div>
        )}
      </div>
    </div>
  );
}

export function AllocationPanel({
  groups,
  activeSymbol,
  onActiveSymbolChange,
}: {
  groups: PositionGroupView[];
  activeSymbol: string | null;
  onActiveSymbolChange: (symbol: string | null) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="allocation-comparison">
      <section className="allocation-mode-panel" aria-labelledby="holding-allocation-title">
        <h3 id="holding-allocation-title">{t("个股")}</h3>
        <AllocationRing groups={groups} activeSymbol={activeSymbol} onActiveSymbolChange={onActiveSymbolChange} />
      </section>
      <section className="allocation-mode-panel" aria-labelledby="sector-allocation-title">
        <h3 id="sector-allocation-title">{t("板块")}</h3>
        <SectorAllocationRing groups={groups} />
      </section>
    </div>
  );
}
