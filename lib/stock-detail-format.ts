import type { PublicFundamentalSeries } from "./earning-report/shared/analysis-contract/fundamentals.ts";

/** Fundamentals percentages are already percentage points (68.6), unlike SEC ratios (0.686). */
export function formatStockFundamentalValue(raw: string | null | undefined, series: Pick<PublicFundamentalSeries, "unitFamily" | "displaySign">): string {
  if (raw == null || raw.trim() === "" || !Number.isFinite(Number(raw))) return "—";
  const value = series.displaySign === "outflow_magnitude" ? Math.abs(Number(raw)) : Number(raw);
  if (series.unitFamily === "percent") return `${value.toFixed(1)}%`;
  if (Math.abs(value) >= 1e8) return `${(value / 1e8).toLocaleString("zh-CN", { maximumFractionDigits: 2 })} 亿`;
  return value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}
