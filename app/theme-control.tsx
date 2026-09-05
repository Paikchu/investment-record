"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";

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

const ThemeContext = createContext<{ mode: Mode; choose: (value: string) => void } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
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
  const choose = (value: string) => {
    if (!valid(value)) return;
    setMode(value);
    try { localStorage.setItem(key, value); } catch {}
    window.dispatchEvent(new CustomEvent("max-theme-choice", { detail: value }));
    apply(value);
  };
  return <ThemeContext.Provider value={{ mode, choose }}>{children}</ThemeContext.Provider>;
}

export function ThemeControl() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeControl requires ThemeProvider");
  return <DropdownMenu>
    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" className="relative" aria-label="切换日间或夜间模式">
      <Sun className="rotate-0 scale-100 transition-transform motion-reduce:transition-none dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute rotate-90 scale-0 transition-transform motion-reduce:transition-none dark:rotate-0 dark:scale-100" />
    </Button></DropdownMenuTrigger>
    <DropdownMenuContent align="start"><DropdownMenuRadioGroup value={context.mode} onValueChange={context.choose}>
      <DropdownMenuRadioItem value="light">日间模式</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="dark">夜间模式</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="system">跟随系统</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup></DropdownMenuContent>
  </DropdownMenu>;
}
