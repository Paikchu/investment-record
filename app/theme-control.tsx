"use client";

import { useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const key = "max-investment-record:theme";
type Mode = "system" | "light" | "dark";
const valid = (value: unknown): value is Mode => value === "system" || value === "light" || value === "dark";


function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document.querySelectorAll('meta[name="theme-color"]').forEach((node) => node.setAttribute("content", dark ? "#18181b" : "#fafafa"));
  window.dispatchEvent(new Event("max-theme-change"));
}

export function useResolvedTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    sync();
    window.addEventListener("max-theme-change", sync);
    return () => window.removeEventListener("max-theme-change", sync);
  }, []);
  return theme;
}

export function ThemeControl() {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    let current: Mode = "system";
    try { const saved = localStorage.getItem(key); if (valid(saved)) current = saved; } catch {}
    setMode(current);
    apply(current);
    const media = matchMedia("(prefers-color-scheme: dark)");
    const systemChanged = () => apply(current);
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== key && event.key !== null) return;
      current = valid(event.newValue) ? event.newValue : "system";
      setMode(current); apply(current);
    };
    const chosen = (event: Event) => { current = (event as CustomEvent<Mode>).detail; };
    media.addEventListener("change", systemChanged);
    window.addEventListener("storage", storageChanged);
    window.addEventListener("max-theme-choice", chosen);
    return () => { media.removeEventListener("change", systemChanged); window.removeEventListener("storage", storageChanged); window.removeEventListener("max-theme-choice", chosen); };
  }, []);
  return <div className="theme-toolbar"><Select value={mode} onValueChange={(value) => {
    if (!valid(value)) return;
    setMode(value);
    try { localStorage.setItem(key, value); } catch {}
    window.dispatchEvent(new CustomEvent("max-theme-choice", { detail: value }));
    apply(value);
  }}><SelectTrigger aria-label="外观主题" size="sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system">跟随系统</SelectItem><SelectItem value="light">浅色</SelectItem><SelectItem value="dark">深色</SelectItem></SelectContent></Select></div>;
}
