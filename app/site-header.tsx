"use client";

import Link from "next/link";
import { useRef } from "react";

export function SiteHeader({
  onOpenSettings,
}: {
  onOpenSettings?: () => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (menuRef.current) menuRef.current.open = false;
  }

  return (
    <header className="site-header">
      <Link className="site-brand" href="/" aria-label="MAX 投资记录首页">
        <strong>MAX</strong>
        <span>投资记录</span>
      </Link>
      <nav className="site-primary-nav" aria-label="页面章节">
        <Link href="/#portfolio-title">投资组合</Link>
        <Link href="/#ledger-title">投资账本</Link>
      </nav>
      <details className="profile-menu" ref={menuRef}>
        <summary className="profile-trigger" aria-label="打开账户菜单"><span className="profile-avatar" aria-hidden="true" /></summary>
        <div className="profile-popover">
          {onOpenSettings ? (
            <button className="profile-menu-item" type="button" onClick={() => { closeMenu(); onOpenSettings(); }}>设置</button>
          ) : (
            <Link className="profile-menu-item" href="/?settings=1" onClick={closeMenu}>设置</Link>
          )}
        </div>
      </details>
    </header>
  );
}
