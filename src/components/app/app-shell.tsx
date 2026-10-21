"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { moduleForRoute } from "@/lib/domain/access";
import type { FixtureWorkItem } from "@/lib/fixtures";
import { primaryNavigation, restrictedNavigation } from "@/lib/navigation";
import { trackModuleView, trackUsageInteractions } from "@/lib/usage-analytics";
import { applyThemePreference, loadAccountPreferences, readUserPreferences, userPreferencesChangedEvent } from "@/lib/user-preferences";
import { useWorkflow, workflowProcessRole, workflowProcessRoleLabel, WorkflowProvider } from "@/lib/workflow-state";
import { AntMark } from "../brand/ant-mark";
import { BrandLockup } from "../brand/brand-lockup";
import { Icon } from "../ui/icon";
import { GlobalSearch } from "./global-search";

type AppShellProps = { children: React.ReactNode; email: string; displayName?: string; demoMode?: boolean; persona?: string };
const sidebarStorageKey = "taxmonweb.sidebar.collapsed";

export function AppShell({ children, email, displayName, demoMode = false, persona }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sidebarPreferenceChangedRef = useRef(false);
  const firstNavLinkRef = useRef<HTMLAnchorElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);
  const toggleNavigation = useCallback(() => {
    if (isMobile) setMobileOpen((open) => !open);
    else {
      sidebarPreferenceChangedRef.current = true;
      setCollapsed((value) => !value);
    }
  }, [isMobile]);

  useEffect(() => {
    if (collapsed === null || !sidebarPreferenceChangedRef.current) return;
    window.localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    // Hydrate persisted shell preference after the server/client markup is stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollapsed(window.localStorage.getItem(sidebarStorageKey) === "true");
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 780px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    function handleSidebarShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if ((target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA") || (!event.metaKey && !event.ctrlKey) || event.key.toLowerCase() !== "b") return;
      event.preventDefault();
      toggleNavigation();
    }
    window.addEventListener("keydown", handleSidebarShortcut);
    return () => window.removeEventListener("keydown", handleSidebarShortcut);
  }, [isMobile, toggleNavigation]);

  useEffect(() => {
    trackModuleView(pathname);
    return trackUsageInteractions(pathname);
  }, [pathname]);

  useEffect(() => {
    function syncPreferences() {
      const preferences = readUserPreferences(window.localStorage);
      setAvatarUrl(preferences.avatarUrl);
      applyThemePreference(preferences.theme);
      if (!demoMode) {
        void loadAccountPreferences().then((accountPreferences) => {
          setAvatarUrl(accountPreferences.avatarUrl);
          applyThemePreference(accountPreferences.theme);
        }).catch(() => {
          // Keep the last local appearance while the account boundary is unavailable.
        });
      }
    }
    syncPreferences();
    window.addEventListener(userPreferencesChangedEvent, syncPreferences);
    window.addEventListener("storage", syncPreferences);
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    systemTheme.addEventListener("change", syncPreferences);
    return () => {
      window.removeEventListener(userPreferencesChangedEvent, syncPreferences);
      window.removeEventListener("storage", syncPreferences);
      systemTheme.removeEventListener("change", syncPreferences);
    };
  }, [demoMode]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    firstNavLinkRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !mobileSidebarRef.current) return;
      const focusable = Array.from(mobileSidebarRef.current.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex=\"-1\"])")).filter((element) => element.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  const sidebarCollapsed = collapsed === true && !isMobile;

  async function signOut() {
    setIsSigningOut(true);
    const client = createSupabaseBrowserClient();
    if (client) await client.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <WorkflowProvider prototypeMode={demoMode}>
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside aria-label="Application navigation" className={`app-sidebar${sidebarCollapsed ? " app-sidebar--collapsed" : ""}${mobileOpen ? " app-sidebar--mobile-open" : ""}`} id="application-sidebar" ref={mobileSidebarRef}>
        <div className="app-sidebar__brand">
          {sidebarCollapsed ? <Link aria-label="TaxMonWeb" className="collapsed-brand" href="/app/control-tower"><AntMark size={30} /></Link> : <BrandLockup />}
        </div>
        <nav aria-label="Primary navigation" className="primary-nav" id="primary-navigation">
          <PersonaNavigation pathname={pathname} firstNavLinkRef={firstNavLinkRef} onNavigate={() => setMobileOpen(false)} />
        </nav>
        <div className="app-sidebar__footer">
          <SidebarProfile avatarUrl={avatarUrl} email={email} persona={persona ?? displayName} />
          <Link aria-label="Settings &amp; preferences" className="sidebar-settings-link" href="/app/admin?view=settings" onClick={() => setMobileOpen(false)} title="Settings &amp; preferences"><Icon name="settings" /><span>Settings &amp; preferences</span></Link>
          {!demoMode && <button className="button button--quiet button--full" disabled={isSigningOut} onClick={signOut} type="button">{isSigningOut ? "Signing out…" : "Sign out"}</button>}
        </div>
      </aside>
      {mobileOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setMobileOpen(false)} type="button" />}
      <div className="app-main">
        <header className="app-main-header">
          <button aria-controls="application-sidebar" aria-expanded={isMobile ? mobileOpen : !sidebarCollapsed} aria-label={isMobile ? (mobileOpen ? "Close modules" : "Open modules") : (sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar")} className="sidebar-toggle" data-usage-action="toggle_navigation" onClick={toggleNavigation} ref={toggleRef} type="button"><Icon name="menu" size={19} /></button>
          <GlobalSearch />
          {demoMode ? <span className="prototype-mark">Prototype · Sanitized data</span> : <span className="app-main-header__user" title={email}>{displayName ?? email}</span>}
          <ActionNotifications />
        </header>
        <main className="app-content" id="main-content" tabIndex={-1}><PersonaContent pathname={pathname}>{children}</PersonaContent></main>
      </div>
    </div>
    </WorkflowProvider>
  );
}

type ActionNotification = { work: FixtureWorkItem; step: FixtureWorkItem["steps"][number]; owner: string };

function SidebarProfile({ avatarUrl, email, persona }: { avatarUrl: string | null; email: string; persona?: string }) {
  const label = persona ?? email;
  const initials = label.split(/[@.\s_-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  return <div aria-label="Current user" className="sidebar-profile" role="img" title={label}><span aria-hidden="true" className={`sidebar-profile__avatar${avatarUrl ? " sidebar-profile__avatar--photo" : ""}`} style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}>{avatarUrl ? null : initials}</span><span className="sidebar-profile__identity"><strong>{label}</strong>{persona && <small>All modules</small>}</span></div>;
}

function ActionNotifications() {
  const { canActOnProcessStep, getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [dismissedActionKeys, setDismissedActionKeys] = useState<Set<string>>(new Set());
  const notificationsRef = useRef<HTMLDivElement>(null);
  const actions = useMemo(() => {
    const pending: ActionNotification[] = [];
    for (const work of getWorkItems().map(getEffectiveWork)) {
      if (prototypeMode && !isWorkVisible(work)) continue;
      const step = work.steps.find((candidate) => ["current", "blocked", "unresolved"].includes(candidate.state) && canActOnProcessStep(candidate.id, work));
      if (step) pending.push({ work, step, owner: workflowProcessRoleLabel(workflowProcessRole(step.id)) });
    }
    return pending;
  }, [canActOnProcessStep, getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode]);
  const visibleActions = useMemo(() => actions.filter(({ work, step }) => !dismissedActionKeys.has(`${work.id}:${step.id}`)), [actions, dismissedActionKeys]);
  const notificationLabel = visibleActions.length === 0 ? "No pending actions" : `${visibleActions.length} pending actions`;
  const attentionLabel = visibleActions.length === 1 ? "1 item requires action" : `${visibleActions.length} items require action`;

  useEffect(() => {
    if (!open) return;
    function closeOnOutsidePointer(event: PointerEvent) {
      if (!notificationsRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);

  return <div className={`app-main-header__notifications${open ? " app-main-header__notifications--open" : ""}`} ref={notificationsRef}>
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={notificationLabel} className="app-main-header__notifications-trigger" onClick={() => setOpen((current) => !current)} title="Notifications" type="button"><Icon name="bell" size={17} />{visibleActions.length > 0 && <span aria-hidden="true" className="app-main-header__notifications-count">{visibleActions.length > 9 ? "9+" : visibleActions.length}</span>}</button>
    {open && <div aria-label="My actions" className="app-main-header__notifications-panel" id="my-actions-panel" role="region">
      <div className="app-main-header__notifications-heading"><div><strong>My actions</strong><small>{visibleActions.length > 0 ? attentionLabel : "No pending actions"}</small></div><button aria-label="Clear pending actions" className="app-main-header__notifications-clear" disabled={visibleActions.length === 0} onClick={() => setDismissedActionKeys((current) => new Set([...current, ...actions.map(({ work, step }) => `${work.id}:${step.id}`)]))} type="button">Clear</button></div>
      {visibleActions.length > 0 ? <div className="app-main-header__notifications-list">{visibleActions.slice(0, 5).map(({ work, step, owner }) => <Link href={`/app/work/${work.id}`} key={work.id}><strong>{step.label}</strong><span>{work.client} · {work.title}</span><small>{work.period} · {owner}</small></Link>)}</div> : <p className="app-main-header__notifications-empty">No pending actions.</p>}
      <Link className="app-main-header__notifications-footer" href="/app/work?queue=all">View Work</Link>
    </div>}
  </div>;
}

function PersonaNavigation({ pathname, firstNavLinkRef, onNavigate }: { pathname: string; firstNavLinkRef: React.RefObject<HTMLAnchorElement | null>; onNavigate: () => void }) {
  const { canAccessModule: canOpenModule } = useWorkflow();
  const router = useRouter();
  const navigation = canOpenModule("tax_team") ? [...primaryNavigation, ...restrictedNavigation] : primaryNavigation;
  const visibleNavigation = navigation.filter((item) => {
    const itemModule = moduleForRoute(item.href);
    return !itemModule || canOpenModule(itemModule);
  });

  return <>{visibleNavigation.map((item, index) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const warmRoute = () => router.prefetch(item.href);
    return <Link aria-current={isActive ? "page" : undefined} className={isActive ? "primary-nav__link primary-nav__link--active" : "primary-nav__link"} data-usage-action={`open_${item.label.toLowerCase().replace(/\s+/g, "_")}`} data-usage-event="navigation" href={item.href} key={item.href} onClick={onNavigate} onFocus={warmRoute} onPointerEnter={warmRoute} onTouchStart={warmRoute} ref={index === 0 ? firstNavLinkRef : undefined} title={item.label}><Icon name={item.icon} /><span>{item.label}</span></Link>;
  })}</>;
}

function PersonaContent({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { canAccessModule: canOpenModule, prototypeMode, viewerStatus } = useWorkflow();
  const routeModule = moduleForRoute(pathname);
  // The server already guarded this route; wait for the viewer before judging it client-side.
  const canViewRoute = !routeModule || (!prototypeMode && viewerStatus !== "ready") || canOpenModule(routeModule);

  if (!prototypeMode && viewerStatus === "error") {
    return <section aria-labelledby="persona-access-title" className="persona-access-state" role="alert">
      <p className="eyebrow">Access</p>
      <h1 id="persona-access-title">Your access could not be loaded</h1>
      <p>Refresh the page. If this keeps happening, ask an administrator to check your account setup.</p>
    </section>;
  }

  if (!canViewRoute) {
    return <section aria-labelledby="persona-access-title" className="persona-access-state">
      <p className="eyebrow">Access</p>
      <h1 id="persona-access-title">You don&apos;t have access to this workspace</h1>
      <p>Choose an available workspace from the navigation, or ask an administrator if your role should include it.</p>
    </section>;
  }

  return <Fragment>{children}</Fragment>;
}
