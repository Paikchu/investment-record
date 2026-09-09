"use client";

import { useEffect, useState } from "react";

/** Avoid a flashing spinner for work that finishes within one short interaction. */
export function useDelayedBusy(busy: boolean) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const timer = window.setTimeout(() => setVisible(true), 150);
    return () => { window.clearTimeout(timer); setVisible(false); };
  }, [busy]);
  return busy && visible;
}
