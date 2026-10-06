"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { primaryNavigation } from "@/lib/navigation";
import { AntMark } from "../brand/ant-mark";
import { BrandLockup } from "../brand/brand-lockup";
import { Icon } from "../ui/icon";

type AppShellProps = { children: React.ReactNode; email: string; demoMode?: boolean };
const sidebarStorageKey = "taxmonweb.sidebar.collapsed";

export function AppShell({ children, email, demoMode = false }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem(sidebarStorageKey) === "true");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => { window.localStorage.setItem(sidebarStorageKey, String(collapsed)); }, [collapsed]);

  async function signOut() {
    setIsSigningOut(true);
    const client = createSupabaseBrowserClient();
    if (client) await client.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const context = pathname.startsWith("/app/clients") ? "Clients" : pathname.startsWith("/app/my-work") ? "My Work" : pathname.startsWith("/app/team") ? "Team" : "Control Tower";

  return (
    <div className="app-frame">
      <aside className={`app-sidebar${collapsed ? " app-sidebar--collapsed" : ""}${mobileOpen ? " app-sidebar--mobile-open" : ""}`}>
        <div className="app-sidebar__brand">
          {collapsed ? <Link aria-label="TaxMonWeb" className="collapsed-brand" href="/app/control-tower"><AntMark size={30} /></Link> : <BrandLockup />}
        </div>
        <nav aria-label="Primary navigation" className="primary-nav">
          {primaryNavigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return <Link aria-current={isActive ? "page" : undefined} className={isActive ? "primary-nav__link primary-nav__link--active" : "primary-nav__link"} href={item.href} key={item.href} onClick={() => setMobileOpen(false)} title={item.label}><Icon name={item.icon} /><span>{item.label}</span></Link>;
          })}
        </nav>
        {!demoMode && <div className="app-sidebar__footer"><p className="user-email" title={email}>{email}</p><button className="button button--quiet button--full" disabled={isSigningOut} onClick={signOut} type="button">{isSigningOut ? "Signing out…" : "Sign out"}</button></div>}
      </aside>
      {mobileOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setMobileOpen(false)} type="button" />}
      <div className="app-main">
        <header className="app-main-header">
          <button aria-expanded={!collapsed} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="sidebar-toggle" onClick={() => { if (window.innerWidth <= 780) setMobileOpen((open) => !open); else setCollapsed((value) => !value); }} type="button"><Icon name="menu" size={19} /></button>
          <div className="app-main-header__brand"><BrandLockup compact /></div>
          <span className="app-main-header__context">{context}</span>
          {demoMode ? <span className="prototype-mark">Prototype · Sanitized data</span> : <span className="app-main-header__user">{email}</span>}
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
