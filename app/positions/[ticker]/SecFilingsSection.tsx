"use client";

import { SecFilingsSection as DisclosureTimeline } from "@/app/analysis/stocks/[ticker]/SecFilingsSection";
import "@/app/analysis/earning-report.css";

/** Both entry points share the same read-only pipeline feed and report links. */
export function SecFilingsSection({ ticker }: { ticker: string }) {
  return (
    <div className="earning-report position-disclosure-timeline">
      <DisclosureTimeline key={ticker} ticker={ticker} title="披露时间线" />
    </div>
  );
}
