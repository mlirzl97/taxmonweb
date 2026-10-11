"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { accessLevelLabel, canAccessModule, firstAllowedRoute, highestAccessLevel, moduleForRoute, personaNavigation, rbacPersonaLabel, rbacPersonaOptions, visibleModuleKeys } from "@/lib/domain/access";
import type { FixtureWorkItem } from "@/lib/fixtures";
import { primaryNavigation, restrictedNavigation } from "@/lib/navigation";
import { trackModuleView, trackUsageInteractions } from "@/lib/usage-analytics";
import { useWorkflow, workflowPerspectiveDescription, workflowPerspectiveLabel, workflowProcessRole, workflowProcessRoleLabel, WorkflowProvider, type WorkflowPerspective } from "@/lib/workflow-state";
import { AntMark } from "../brand/ant-mark";
import { BrandLockup } from "../brand/brand-lockup";
import { Icon } from "../ui/icon";

type AppShellProps = { children: React.ReactNode; email: string; demoMode?: boolean; calibrationEditMode?: boolean; persona?: string };
const sidebarStorageKey = "taxmonweb.sidebar.collapsed";

export function AppShell({ children, email, demoMode = false, calibrationEditMode = false, persona }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarPreferenceHydrated, setSidebarPreferenceHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstNavLinkRef = useRef<HTMLAnchorElement>(null);
  const mobileSidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!sidebarPreferenceHydrated) return;
    window.localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed, sidebarPreferenceHydrated]);

  useEffect(() => {
    if (window.localStorage.getItem(sidebarStorageKey) === "true") {
      // Hydrate persisted shell preference after the server/client markup is stable.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCollapsed(true);
    }
    setSidebarPreferenceHydrated(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 780px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    trackModuleView(pathname);
    return trackUsageInteractions(pathname);
  }, [pathname]);

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

  async function signOut() {
    setIsSigningOut(true);
    const client = createSupabaseBrowserClient();
    if (client) await client.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const context = pathname.startsWith("/app/clients") ? "Clients" : pathname.startsWith("/app/work") || pathname.startsWith("/app/my-work") ? "Work" : pathname.startsWith("/app/tax-team") ? "Tax Team" : pathname.startsWith("/app/team") ? "Team" : pathname.startsWith("/app/bir-center") ? "BIR Center" : pathname.startsWith("/app/admin") ? "Admin" : "Control Tower";

  return (
    <WorkflowProvider prototypeMode={demoMode}>
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <aside aria-label="Application navigation" className={`app-sidebar${collapsed ? " app-sidebar--collapsed" : ""}${mobileOpen ? " app-sidebar--mobile-open" : ""}`} ref={mobileSidebarRef}>
        <div className="app-sidebar__brand">
          {collapsed ? <Link aria-label="TaxMonWeb" className="collapsed-brand" href="/app/control-tower"><AntMark size={30} /></Link> : <BrandLockup />}
        </div>
        <nav aria-label="Primary navigation" className="primary-nav" id="primary-navigation">
          <PersonaNavigation pathname={pathname} firstNavLinkRef={firstNavLinkRef} onNavigate={() => setMobileOpen(false)} />
        </nav>
        {!demoMode && <div className="app-sidebar__footer"><p className="user-email" title={email}>{email}</p><button className="button button--quiet button--full" disabled={isSigningOut} onClick={signOut} type="button">{isSigningOut ? "Signing out…" : "Sign out"}</button></div>}
      </aside>
      {mobileOpen && <button aria-label="Close navigation" className="sidebar-backdrop" onClick={() => setMobileOpen(false)} type="button" />}
      <div className="app-main">
        <header className="app-main-header">
          <button aria-controls="primary-navigation" aria-expanded={isMobile ? mobileOpen : !collapsed} aria-label={isMobile ? (mobileOpen ? "Close modules" : "Open modules") : (collapsed ? "Expand sidebar" : "Collapse sidebar")} className="sidebar-toggle" data-usage-action="toggle_navigation" onClick={() => { if (isMobile) setMobileOpen((open) => !open); else setCollapsed((value) => !value); }} ref={toggleRef} type="button"><Icon name="menu" size={19} /><span className="sidebar-toggle__label">Modules</span></button>
          <div className="app-main-header__brand"><BrandLockup compact /></div>
          <span className="app-main-header__context">{context}</span>
          <WorkflowPerspectiveControl pathname={pathname} />
          {demoMode ? <span className="prototype-mark">Prototype · Sanitized data</span> : <span className="app-main-header__user">{email}</span>}
          <ActionNotifications />
          <CurrentPersonaLabel calibrationEditMode={calibrationEditMode} fallback={persona} />
        </header>
        <main className="app-content" id="main-content" tabIndex={-1}><PersonaContent pathname={pathname}>{children}</PersonaContent></main>
      </div>
    </div>
    </WorkflowProvider>
  );
}

type ActionNotification = { work: FixtureWorkItem; step: FixtureWorkItem["steps"][number]; owner: string };

function ActionNotifications() {
  const { canActOnProcessStep, getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode } = useWorkflow();
  const [open, setOpen] = useState(false);
  const actions = useMemo(() => {
    const pending: ActionNotification[] = [];
    for (const work of getWorkItems().map(getEffectiveWork)) {
      if (prototypeMode && !isWorkVisible(work)) continue;
      const step = work.steps.find((candidate) => ["current", "blocked", "unresolved"].includes(candidate.state) && canActOnProcessStep(candidate.id, work));
      if (step) pending.push({ work, step, owner: workflowProcessRoleLabel(workflowProcessRole(step.id)) });
    }
    return pending;
  }, [canActOnProcessStep, getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode]);
  const countLabel = actions.length === 1 ? "1 pending action" : `${actions.length} pending actions`;

  return <div className={`app-main-header__notifications${open ? " app-main-header__notifications--open" : ""}`}>
    <button aria-expanded={open} aria-haspopup="dialog" aria-label={countLabel} className="app-main-header__notifications-trigger" onClick={() => setOpen((current) => !current)} type="button"><Icon name="bell" size={17} />{actions.length > 0 && <span aria-hidden="true" className="app-main-header__notifications-count">{actions.length > 9 ? "9+" : actions.length}</span>}</button>
    {open && <div aria-label="My actions" className="app-main-header__notifications-panel" id="my-actions-panel" role="region">
      <div className="app-main-header__notifications-heading"><strong>My actions</strong><small>{countLabel}</small></div>
      {actions.length > 0 ? <div className="app-main-header__notifications-list">{actions.slice(0, 5).map(({ work, step, owner }) => <Link href={`/app/work/${work.id}`} key={work.id}><strong>{step.label}</strong><span>{work.client} · {work.title}</span><small>{work.period} · {owner}</small></Link>)}</div> : <p className="app-main-header__notifications-empty">No pending actions.</p>}
      <Link className="app-main-header__notifications-footer" href="/app/work?queue=all">View Work</Link>
    </div>}
  </div>;
}

function CurrentPersonaLabel({ calibrationEditMode, fallback }: { calibrationEditMode: boolean; fallback?: string }) {
  const { workPerspective } = useWorkflow();
  const label = workPerspective === "MASTER_ADMIN" ? "Master Admin" : rbacPersonaLabel(workPerspective) || fallback;
  return <span aria-label="Current access persona" className="app-main-header__persona">{label}{calibrationEditMode ? " · Calibration edit" : ""}</span>;
}

function WorkflowPerspectiveControl({ pathname }: { pathname: string }) {
  const { accessMatrix, applyAccessPerspective, workPerspective } = useWorkflow();
  const router = useRouter();
  const pendingTouched = useRef(false);
  const [pendingPerspective, setPendingPerspective] = useState<WorkflowPerspective>(workPerspective);
  const highest = highestAccessLevel(workPerspective, accessMatrix);
  const visibleModules = visibleModuleKeys(workPerspective, accessMatrix).length;

  useEffect(() => {
    // Sync the pending control with persisted access state after hydration.
    if (pendingTouched.current) return;
    setPendingPerspective(workPerspective);
  }, [workPerspective]);

  function applySelectedPerspective() {
    pendingTouched.current = false;
    applyAccessPerspective(pendingPerspective);
    if (!personaNavigation(pendingPerspective, pathname, accessMatrix)) {
      router.replace(firstAllowedRoute(pendingPerspective, accessMatrix));
    }
  }

  return <div className="app-main-header__lens">
    <label htmlFor="access-view-persona"><span>Access view</span></label>
    <select aria-describedby="rbac-persona-description" aria-label="Access view persona" onChange={(event) => {
      pendingTouched.current = true;
      setPendingPerspective(event.target.value as WorkflowPerspective);
    }} id="access-view-persona" title={workflowPerspectiveDescription(pendingPerspective)} value={pendingPerspective}>
      {rbacPersonaOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
    <button aria-label={`Apply ${rbacPersonaLabel(pendingPerspective)} access view`} className="button button--quiet button--small app-main-header__lens-action" disabled={pendingPerspective === workPerspective} onClick={applySelectedPerspective} type="button">Apply view</button>
    <span aria-live="polite" className="app-main-header__access-summary">{accessLevelLabel(highest)} · {visibleModules} modules</span>
    <span className="sr-only" id="rbac-persona-description">{workflowPerspectiveDescription(workPerspective)}</span>
  </div>;
}

function PersonaNavigation({ pathname, firstNavLinkRef, onNavigate }: { pathname: string; firstNavLinkRef: React.RefObject<HTMLAnchorElement | null>; onNavigate: () => void }) {
  const { accessMatrix, workPerspective } = useWorkflow();
  const navigation = canAccessModule(workPerspective, "tax_team", undefined, accessMatrix) ? [...primaryNavigation, ...restrictedNavigation] : primaryNavigation;
  const visibleNavigation = navigation.filter((item) => personaNavigation(workPerspective, item.href, accessMatrix));

  return <>{visibleNavigation.map((item, index) => {
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return <Link aria-current={isActive ? "page" : undefined} className={isActive ? "primary-nav__link primary-nav__link--active" : "primary-nav__link"} data-usage-action={`open_${item.label.toLowerCase().replace(/\s+/g, "_")}`} data-usage-event="navigation" href={item.href} key={item.href} onClick={onNavigate} ref={index === 0 ? firstNavLinkRef : undefined} title={item.label}><Icon name={item.icon} /><span>{item.label}</span></Link>;
  })}</>;
}

function PersonaContent({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { accessMatrix, workPerspective } = useWorkflow();
  const routeModule = moduleForRoute(pathname);
  const canViewRoute = !routeModule || canAccessModule(workPerspective, routeModule, undefined, accessMatrix);

  if (!canViewRoute) {
    return <section aria-labelledby="persona-access-title" className="persona-access-state">
      <p className="eyebrow">Access view</p>
      <h1 id="persona-access-title">This workspace is outside the {workflowPerspectiveLabel(workPerspective)} view</h1>
      <p>{workflowPerspectiveDescription(workPerspective)} Choose an available workspace from the navigation, or switch the access view when acting under an authorized persona.</p>
    </section>;
  }

  return <Fragment>{children}</Fragment>;
}
