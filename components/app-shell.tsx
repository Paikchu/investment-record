"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Building2, Workflow, ChartNoAxesCombined } from "lucide-react";
import { ThemeControl } from "@/app/theme-control";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
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
  return <Sidebar collapsible="icon">
    <SidebarHeader><SidebarMenu><SidebarMenuItem>
      <SidebarMenuButton asChild size="lg" tooltip="MAX · 投资记录">
        <Link href="/" onClick={() => setOpenMobile(false)}><ChartNoAxesCombined /><span>MAX · 投资记录</span></Link>
      </SidebarMenuButton>
    </SidebarMenuItem></SidebarMenu></SidebarHeader>
    <SidebarContent><SidebarGroup><SidebarGroupContent>
      <nav aria-label="主要导航"><SidebarMenu>{items.map((item) => {
        const active = item.href === "/" ? pathname === "/" || pathname.startsWith("/positions/") : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return <SidebarMenuItem key={item.href}><SidebarMenuButton asChild isActive={active} tooltip={item.title}>
          <Link href={item.href} aria-current={active ? "page" : undefined} onClick={() => setOpenMobile(false)}><item.icon /><span>{item.title}</span></Link>
        </SidebarMenuButton></SidebarMenuItem>;
      })}</SidebarMenu></nav>
    </SidebarGroupContent></SidebarGroup></SidebarContent>
    <SidebarRail />
  </Sidebar>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return <TooltipProvider><SidebarProvider>
    <AppSidebar />
    <div className="app-content flex min-w-0 flex-1 flex-col">
      <header className="app-toolbar flex h-14 shrink-0 items-center justify-between gap-4 px-5">
        <SidebarTrigger aria-label="展开或收起侧栏" />
        <ThemeControl />
      </header>
      {children}
    </div>
  </SidebarProvider></TooltipProvider>;
}
