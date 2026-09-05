"use client";

import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Building2, Workflow, CircleFadingPlus } from "lucide-react";
import { ThemeControl } from "@/app/theme-control";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarInset, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "首页", href: "/", icon: Home },
  { title: "历史交易复盘", href: "/trade-reviews", icon: History },
  { title: "公司业务分析", href: "/company-analysis", icon: Building2 },
  { title: "自定义分析 Workflow", href: "/analysis-workflows", icon: Workflow },
];

function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  return <Sidebar collapsible="offcanvas" variant="inset">
    <SidebarHeader><SidebarMenu><SidebarMenuItem>
      <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:p-1.5!">
        <Link href="/" onClick={() => setOpenMobile(false)}><CircleFadingPlus className="size-5!" /><span className="text-base font-semibold">MAX · 投资记录</span></Link>
      </SidebarMenuButton>
    </SidebarMenuItem></SidebarMenu></SidebarHeader>
    <SidebarContent><SidebarGroup><SidebarGroupContent className="flex flex-col gap-2">
      <nav aria-label="主要导航"><SidebarMenu>{items.map((item) => {
        const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/positions/") : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}><item.icon /><span>{item.title}</span></Link>
        </SidebarMenuButton></SidebarMenuItem>;
      })}</SidebarMenu></nav>
    </SidebarGroupContent></SidebarGroup></SidebarContent>
  </Sidebar>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = items.find((item) => item.href === pathname)?.title ?? "首页";
  return <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}>
    <AppSidebar />
    <SidebarInset className="min-w-0">
      <header className="app-toolbar flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" aria-label="展开或收起侧栏" />
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          <span className="text-base font-medium">{title}</span>
          <div className="ml-auto flex items-center gap-2"><ThemeControl /></div>
        </div>
      </header>
      {children}
    </SidebarInset>
  </SidebarProvider>;
}
