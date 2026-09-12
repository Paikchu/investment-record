"use client";

import { useState } from "react";

export function ReportShare({ ticker, accession, reportDate, reportVersion, generatedAt }: {
  ticker: string; accession: string; reportDate: string; reportVersion: string; generatedAt: string;
}) {
  const [status, setStatus] = useState("");
  const path = `/analysis/stocks/${encodeURIComponent(ticker)}/sec/${encodeURIComponent(accession)}?${new URLSearchParams({ reportDate, reportVersion })}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(new URL(path, window.location.origin).href);
      setStatus("分享链接已复制");
    } catch {
      setStatus("复制失败，请打开固定版本链接后复制地址栏");
    }
  }
  return <div className="mb-8 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
    <span className="break-all">分析编码：{reportVersion.slice(reportVersion.lastIndexOf(":") + 1)}</span>
    <time dateTime={generatedAt}>生成于 {generatedAt}</time>
    <a className="underline" href={path}>打开固定版本</a>
    <button type="button" className="rounded-md border px-3 py-1.5" onClick={copy}>复制分享链接</button>
    <span role="status">{status}</span>
  </div>;
}
