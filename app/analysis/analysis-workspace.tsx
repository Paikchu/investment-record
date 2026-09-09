"use client";

import { useRef, useState, type ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { StockDetail } from "@/app/positions/[ticker]/StockDetail";
import type { HoldingPlanRecord } from "@/lib/holding-plan-store";
import { loadStock } from "./load-stock";

type Stock = Awaited<ReturnType<typeof loadStock>> & {
  plan: HoldingPlanRecord | null;
  planStatus: "ready" | "unavailable";
};

export function AnalysisWorkspace({ children }: { children: ReactNode }) {
  const [stock, setStock] = useState<Stock | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);

  async function select(ticker: string) {
    const id = ++request.current;
    setLoading(true);
    setError("");
    try {
      const [detail, planResponse] = await Promise.all([
        loadStock(ticker),
        fetch(`/api/plans/${encodeURIComponent(ticker)}`, { cache: "no-store" }).catch(() => null),
      ]);
      const plan = planResponse?.ok ? (await planResponse.json()).plan : null;
      if (id === request.current) setStock({ ...detail, plan, planStatus: planResponse?.ok ? "ready" : "unavailable" });
    } catch {
      if (id === request.current) setError("个股详情暂时无法加载，请重新搜索重试。");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }

  return <div className="sec-app-shell">
    <SiteHeader onSelect={select} />
    {loading && <p role="status" className="py-3 text-sm text-muted-foreground">正在加载个股详情…</p>}
    {error && <p role="alert" className="py-3 text-sm text-destructive">{error}</p>}
    <div aria-busy={loading}>
      {stock ? <StockDetail key={stock.ticker} {...stock} embedded /> : children}
    </div>
  </div>;
}
