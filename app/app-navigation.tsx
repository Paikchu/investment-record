"use client";

import { Component, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { loadAppPage } from "./load-app-page";

const NavigationContext = createContext<{ path: string; navigate: (href: string) => void } | null>(null);

export function useAppNavigation() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("App navigation provider is missing");
  return context;
}

function normalize(href: string, current: string) {
  const url = new URL(href, `${window.location.origin}${current}`);
  if (url.origin !== window.location.origin) return null;
  let path = url.pathname.replace(/\/$/, "") || "/";
  if (path === "/ledger") return "/#ledger-title";
  if (path === "/market-close") return "/";
  path = path.replace(/^\/analysis\/stocks\/([^/]+)$/, "/positions/$1");
  if (!/^\/$|^\/(analysis|macro|settings)$|^\/positions\/[^/]+(?:\/sec\/[^/]+)?$|^\/analysis\/stocks\/[^/]+\/sec\/[^/]+$/.test(path)) return null;
  return path + url.hash;
}

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div role="alert" className="page-shell py-8">页面暂时无法显示，请从左侧导航打开其他页面，或刷新后重试。</div>
      : this.props.children;
  }
}

export function AppNavigation({ children, dock }: { children: ReactNode; dock: ReactNode }) {
  const routePath = usePathname();
  const [initialPath] = useState(routePath);
  const [path, setPath] = useState(initialPath);
  const [pages, setPages] = useState<Record<string, ReactNode>>({ [initialPath]: children });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const cache = useRef(new Map<string, ReactNode>([[initialPath, children]]));
  const inflight = useRef(new Map<string, Promise<ReactNode>>());
  const active = useRef(initialPath);
  const sequence = useRef(0);
  const scroll = useRef(new Map<string, number>());

  const fetchPage = useCallback((key: string) => {
    if (cache.current.has(key)) return Promise.resolve(cache.current.get(key));
    let task = inflight.current.get(key);
    if (!task) {
      task = loadAppPage(key).then((node) => { cache.current.set(key, node); return node; }).finally(() => inflight.current.delete(key));
      inflight.current.set(key, task);
    }
    return task;
  }, []);

  const navigate = useCallback(async (href: string) => {
    const next = normalize(href, active.current);
    if (!next) return;
    const key = next.split("#")[0];
    const id = ++sequence.current;
    setError("");
    setPending(!cache.current.has(key));
    try {
      const node = await fetchPage(key);
      if (id !== sequence.current) return;
      scroll.current.set(active.current.split("#")[0], window.scrollY);
      setPages((current) => ({ ...current, [key]: node }));
      active.current = next;
      setPath(next);
      requestAnimationFrame(() => {
        const hash = next.split("#")[1];
        if (hash) document.querySelector(`[data-app-page="${CSS.escape(key)}"] #${CSS.escape(decodeURIComponent(hash))}`)?.scrollIntoView({ behavior: "smooth" });
        else window.scrollTo({ top: scroll.current.get(key) ?? 0, behavior: "instant" });
      });
    } catch {
      if (id === sequence.current) setError("页面暂时无法加载，请再次点击重试。");
    } finally {
      if (id === sequence.current) setPending(false);
    }
  }, [fetchPage]);

  useEffect(() => {
    if (window.location.hash) { active.current = initialPath + window.location.hash; setPath(active.current); }
    window.history.replaceState(window.history.state, "", "/");
    function link(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href")!;
      if (!normalize(href, active.current)) return;
      event.preventDefault();
      event.stopPropagation();
      void navigate(href);
    }
    function warm(event: Event) {
      const anchor = (event.target as Element).closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;
      const next = normalize(anchor.getAttribute("href")!, active.current);
      if (next) void fetchPage(next.split("#")[0]).catch(() => {});
    }
    document.addEventListener("click", link, true);
    document.addEventListener("pointerover", warm);
    document.addEventListener("focusin", warm);
    return () => { document.removeEventListener("click", link, true); document.removeEventListener("pointerover", warm); document.removeEventListener("focusin", warm); };
  }, [initialPath, navigate, fetchPage]);

  return <NavigationContext.Provider value={{ path, navigate }}>
    {dock}
    {pending && <div role="status" className="fixed right-4 top-4 z-50 rounded-md bg-background px-3 py-2 text-sm shadow-sm">正在加载…</div>}
    {error && <div role="alert" className="fixed right-4 top-4 z-50 rounded-md bg-background px-3 py-2 text-sm text-destructive shadow-sm">{error}</div>}
    {Object.entries(pages).map(([key, node]) => <div key={key} hidden={key !== path.split("#")[0]} inert={key !== path.split("#")[0]} data-app-page={key}><PageBoundary>{node}</PageBoundary></div>)}
  </NavigationContext.Provider>;
}
