"use client";

import { useState } from "react";

export function CompanyLogo({ symbol, size = "sm" }: { symbol: string; size?: "sm" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const fallback = symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase() || "·";

  return (
    <span className="company-logo" aria-hidden="true" data-failed={failed || undefined} data-size={size}>
      <span className="company-logo-fallback">{fallback}</span>
      {!failed && (
        // The logo host is ticker-driven, so a native image keeps the resilient onError fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          decoding="async"
          loading={size === "lg" ? "eager" : "lazy"}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={`https://images.financialmodelingprep.com/symbol/${encodeURIComponent(symbol)}.png`}
        />
      )}
    </span>
  );
}
