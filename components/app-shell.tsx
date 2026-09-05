"use client";

import type { ReactNode, CSSProperties } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, History, Building2, Workflow, CircleFadingPlus, Palette, UserRound, MoreVertical } from "lucide-react";
import { ThemeControl, ThemeProvider } from "@/app/theme-control";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
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
    <SidebarFooter>
      <div className="flex items-center justify-between gap-2 px-2 py-2">
        <span className="flex items-center gap-2 text-sm"><Palette className="size-4" />外观</span>
        <ThemeControl />
      </div>
      <div className="flex items-center gap-2 rounded-lg p-2" aria-label="默认用户占位">
        <Avatar className="rounded-lg"><AvatarFallback className="rounded-lg"><UserRound className="size-4" /></AvatarFallback></Avatar>
        <div className="grid min-w-0 flex-1 gap-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">User</span>
          <span className="truncate text-xs text-muted-foreground">user@example.com</span>
        </div>
        <MoreVertical className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>
    </SidebarFooter>
  </Sidebar>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const title = items.find((item) => item.href === pathname)?.title ?? "首页";
  return <ThemeProvider><SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 72)", "--header-height": "calc(var(--spacing) * 12)" } as CSSProperties}>
    <AppSidebar />
    <SidebarInset className="min-w-0">
      <header className="app-toolbar flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
        <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" aria-label="展开或收起侧栏" />
          <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
          <span className="text-base font-medium">{title}</span>
        </div>
      </header>
      {children}
    </SidebarInset>
  </SidebarProvider></ThemeProvider>;
}
