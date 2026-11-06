"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AntoineHead } from "@/components/Antoine";

const tabs = [
  { href: "/", label: "Tower", match: (path: string) => path === "/", icon: <path d="M2.5 19.5h19M4.5 19.5c1.2-6 4-10 7.5-10s6.3 4 7.5 10M10 19.5v-3a2 2 0 0 1 4 0v3M12 9.5V6.5l2.5-2" /> },
  { href: "/now", label: "Work", match: (path: string) => path === "/now", icon: <><rect x="4" y="4.5" width="16" height="16" rx="2" /><path d="M4 9.5h16M9 2.5v4M15 2.5v4M8.5 14.5l2 2 4.5-4.5" /></> },
  { href: "/colony", label: "Colony", match: (path: string) => ["/colony", "/anay", "/store"].includes(path), icon: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" /> },
  { href: "/me", label: "Me", match: (path: string) => path === "/me", icon: <path d="M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6zM9.5 11.5l1.8 1.8 3.4-3.6" /> },
];

function Tab({ tab, path }: { tab: (typeof tabs)[number]; path: string }) {
  const current = tab.match(path);
  return (
    <Link href={tab.href} aria-current={current ? "page" : undefined}>
      <span className="tabbar__icon">
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>{tab.icon}</svg>
      </span>
      {tab.label}
    </Link>
  );
}

export function TabBar({ nowCount }: { nowCount: number }) {
  const path = usePathname();
  return (
    <nav className="tabbar" aria-label="Main">
      <Tab tab={tabs[0]} path={path} />
      <Tab tab={tabs[1]} path={path} />
      <div className="tabbar__now-wrap">
        <Link href="/now" className="tabbar__now" aria-label={`Now: ${nowCount} need you`}>
          <AntoineHead />
          <b>Now</b>
        </Link>
        <span className="tabbar__badge" aria-hidden>{nowCount}</span>
      </div>
      <Tab tab={tabs[2]} path={path} />
      <Tab tab={tabs[3]} path={path} />
    </nav>
  );
}
