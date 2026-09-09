"use server";

import Home from "./page";
import Analysis from "./analysis/page";
import Settings from "./settings/page";
import Macro from "./macro/page";
import { StockWorkspace } from "./positions/stock-workspace";
import { loadStock } from "./analysis/load-stock";
import AnalysisReport from "./analysis/stocks/[ticker]/sec/[accession]/page";

export async function loadAppPage(path: string) {
  if (path === "/") return Home();
  if (path === "/analysis") return <div className="earning-report"><Analysis /></div>;
  if (path === "/settings") return <Settings />;
  if (path === "/macro") return <Macro />;
  const position = /^\/positions\/([^/]+)$/.exec(path);
  if (position) return <StockWorkspace stock={await loadStock(decodeURIComponent(position[1]))} />;
  const report = /^\/(positions|analysis\/stocks)\/([^/]+)\/sec\/([^/]+)$/.exec(path);
  if (report) {
    const params = Promise.resolve({ ticker: decodeURIComponent(report[2]), accession: decodeURIComponent(report[3]) });
    return <div className="earning-report">{await AnalysisReport({ params })}</div>;
  }
  throw new Error("未找到这个页面。");
}
