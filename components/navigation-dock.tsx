"use client";

import { useLanguage } from "@/app/language-provider";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, ChartNoAxesCombined, Globe2, Settings2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const items = [
  { href: "/", label: "投资记录", icon: ChartNoAxesCombined },
  { href: "https://earning-report-analysis-sec-web.max-zhangyuchen.workers.dev/", label: "公司业务分析", icon: BookOpen },
  { href: "/macro", label: "宏观分析", icon: Globe2 },
  { href: "/settings", label: "设置", icon: Settings2 },
];

export function NavigationDock() {
  const { t } = useLanguage();
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const navigation = useRef<HTMLElement>(null);
  const lastNavigation = useRef(0);
  useEffect(() => {
    const collapse = () => {
      if (Date.now() - lastNavigation.current < 600 || navigation.current?.querySelector(":focus-visible")) return;
      setExpanded(false);
    };
    window.addEventListener("scroll", collapse, { passive: true });
    return () => window.removeEventListener("scroll", collapse);
  }, []);
  const activeIndex = items.findIndex(({ href }) => href === "/"
    ? pathname === "/" || pathname === "/ledger" || pathname.startsWith("/positions/")
    : pathname === href || pathname.startsWith(`${href}/`));
  const droplet = useRef<HTMLSpanElement>(null);
  const destination = useRef(activeIndex);
  const animation = useRef<Animation | null>(null);
  const moveDroplet = useCallback((index: number) => {
    const element = droplet.current;
    if (!element || index === destination.current) return;
    const currentTransform = getComputedStyle(element).transform;
    const from = currentTransform === "none" ? 0 : new DOMMatrixReadOnly(currentTransform).m42;
    const to = Math.max(0, index) * 50;
    animation.current?.cancel();
    destination.current = index;
    element.style.transform = `translateY(${to}px)`;
    if (index < 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animation.current = element.animate([
      { transform: currentTransform === "none" ? `translateY(${from}px)` : currentTransform, offset: 0 },
      { transform: `translateY(${from + (to - from) * 0.45}px) scaleX(0.82) scaleY(1.26)`, offset: 0.36 },
      { transform: `translateY(${to}px) scaleX(0.96) scaleY(1.05)`, offset: 0.78 },
      { transform: `translateY(${to}px) scale(1)`, offset: 1 },
    ], { duration: 380, easing: "cubic-bezier(0.25, 1, 0.5, 1)" });
  }, []);

  useEffect(() => { moveDroplet(activeIndex); }, [activeIndex, moveDroplet]);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => { if (preference.matches) animation.current?.cancel(); };
    preference.addEventListener("change", stop);
    return () => { preference.removeEventListener("change", stop); animation.current?.cancel(); };
  }, []);

  return (
    <nav ref={navigation} aria-label={t("主导航")} className="navigation-dock" data-expanded={expanded}
      onPointerEnter={() => setExpanded(true)} onFocus={() => setExpanded(true)}>
      <button type="button" className="navigation-dock-compact" aria-label={t("展开主导航")}
        aria-expanded={expanded} aria-controls="navigation-dock-menu" onClick={() => setExpanded(true)}>
        {items.map((item, index) => <span key={item.href} aria-hidden="true" data-active={index === activeIndex} />)}
      </button>
      <div className="navigation-dock-panel" inert={!expanded}>
      <span ref={droplet} aria-hidden="true" className="navigation-dock-droplet"
        style={{ transform: `translateY(${Math.max(0, activeIndex) * 50}px)`, opacity: activeIndex < 0 ? 0 : 1 }} />
      <TooltipProvider delayDuration={150}>
        <ul id="navigation-dock-menu" className="navigation-dock-list">
          {items.map(({ href, label, icon: Icon }, index) => {
            const active = index === activeIndex;
            const content = <Icon size={22} strokeWidth={1.8} aria-hidden="true" />;
            const props = {
              className: "navigation-dock-link",
              "aria-label": t(label),
              "aria-current": active ? "page" as const : undefined,
              onClick: (event: React.MouseEvent<HTMLAnchorElement>) => {
                if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
                  lastNavigation.current = Date.now();
                  moveDroplet(index);
                }
              },
            };

            return (
              <li key={href}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {href.startsWith("https://")
                      ? <a href={href} {...props}>{content}</a>
                      : <Link href={href} {...props}>{content}</Link>}
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={18}>{t(label)}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      </TooltipProvider>
      </div>
    </nav>
  );
}
