"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { fixtureCalendar, type FixtureException, type FixtureScope, type FixtureStatus, type FixtureWorkItem } from "@/lib/fixtures";
import { StatusPill } from "../ui/status-pill";

export const scopeOptions = [
  { id: "all", label: "All A&T" },
  { id: "north", label: "Tower North" },
  { id: "central", label: "Tower Central" },
  { id: "south", label: "Tower South" },
] as const;

export type ScopeFilter = (typeof scopeOptions)[number]["id"];

export function isInScope(scope: FixtureScope, filter: ScopeFilter): boolean {
  if (filter === "all") return true;
  return scope === scopeOptions.find((option) => option.id === filter)?.label;
}

export function FixturePageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="workspace-page">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p className="page-header__description">{description}</p>}
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </div>
  );
}

export function ScopeSwitcher({ value, onChange }: { value: ScopeFilter; onChange: (value: ScopeFilter) => void }) {
  return (
    <label className="scope-select">
      <span>Scope</span>
      <select aria-label="Scope" onChange={(event) => onChange(event.target.value as ScopeFilter)} value={value}>
        {scopeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function FilterTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="filter-tabs" aria-label={label} role="group">
      {options.map((option) => (
        <button
          aria-pressed={value === option.id}
          className={value === option.id ? "filter-tab filter-tab--active" : "filter-tab"}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}{option.count !== undefined && <span className="filter-tab__count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  tone,
  detail,
  active,
  onClick,
}: {
  label: string;
  value: string;
  tone: "neutral" | "amber" | "blue" | "red";
  detail: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="metric-card__label">{label}</span>
      <strong>{value}</strong>
      <span className="metric-card__detail">{detail}</span>
      <span className="metric-card__action">{active ? "Showing queue" : "Show queue"}</span>
    </>
  );

  if (!onClick) return <div className={`metric-card metric-card--${tone}`}>{content}</div>;

  return (
    <button aria-pressed={active} className={`metric-card metric-card--${tone}${active ? " metric-card--active" : ""}`} onClick={onClick} type="button">
      {content}
    </button>
  );
}

export function SectionHeading({ title, detail, href, linkLabel }: { title: string; detail?: string; href?: string; linkLabel?: string }) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {href && linkLabel && <Link className="text-link" href={href}>{linkLabel}</Link>}
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-state__mark" aria-hidden="true">—</span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}

export function StatusLabel({ status, detail }: { status: FixtureStatus; detail?: string }) {
  const tone = status === "GREEN" ? "green" : status === "AMBER" ? "amber" : status === "RED" ? "red" : "unresolved";
  return <span className="status-label"><StatusPill tone={tone}>{status}</StatusPill>{detail && <span className="status-label__detail">{detail}</span>}</span>;
}

export function ConceptTag({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "blocker" | "risk" | "exception" }) {
  return <span className={`concept-tag concept-tag--${tone}`}>{children}</span>;
}

export function DetailDrawer({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previousActiveElement = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) return;
      const focusable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"));
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
      window.removeEventListener("keydown", handleKeyDown);
      previousActiveElement?.focus();
    };
  }, [onClose]);

  return (
    <div className="drawer-layer" role="presentation">
      <button aria-label="Close detail panel" className="drawer-backdrop" onClick={onClose} type="button" />
      <aside aria-label={`${eyebrow}: ${title}`} aria-modal="true" className="detail-drawer" ref={drawerRef} role="dialog">
        <div className="detail-drawer__header">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button aria-label="Close detail panel" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button>
        </div>
        <div className="detail-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

export function WorkDetail({ work, onClose }: { work: FixtureWorkItem; onClose: () => void }) {
  const calendarItem = fixtureCalendar.find((item) => item.workId === work.id);
  return (
    <DetailDrawer eyebrow="Work item" title={work.title} subtitle={`${work.client} · ${work.period}`} onClose={onClose}>
      <div className="drawer-status-row"><StatusLabel status={work.status} detail={work.statusReason} /><ConceptTag tone={work.blocker ? "blocker" : "neutral"}>{work.blocker ? "Blocker" : "No blocker"}</ConceptTag></div>
      <dl className="detail-list">
        <div><dt>Registration Unit</dt><dd>{work.registrationUnit}</dd></div>
        <div><dt>Current stage</dt><dd>{work.stage}</dd></div>
        <div><dt>Deadline / milestone</dt><dd>{work.deadline}<small>{work.deadlineType}</small></dd></div>
        {calendarItem && <div><dt>Statutory deadline</dt><dd>{calendarItem.statutoryDeadline}<small>Adjusted date remains rule-dependent</small></dd></div>}
        {calendarItem && <div><dt>TMF package target</dt><dd>{calendarItem.internalDeadline}<small>Internal control target</small></dd></div>}
        <div><dt>Accountable owner</dt><dd>{work.owner}</dd></div>
        {work.blocker && <div><dt>Blocker</dt><dd>{work.blocker.category}<small>{work.blocker.reason}</small></dd></div>}
      </dl>
      <div className="next-action-box"><span className="next-action-box__label">Next useful action</span><strong>{work.nextAction}</strong></div>
      <p className="drawer-note">This review interaction does not change an external filing state.</p>
    </DetailDrawer>
  );
}

export function ExceptionDetail({ exception, onClose }: { exception: FixtureException; onClose: () => void }) {
  const tone = exception.kind === "Blocker" ? "blocker" : exception.kind === "RAG / Risk" ? "risk" : "exception";

  return (
    <DetailDrawer eyebrow={exception.kind} title={exception.title} subtitle={exception.client} onClose={onClose}>
      <div className="drawer-status-row"><ConceptTag tone={tone}>{exception.category}</ConceptTag><StatusLabel status={exception.severity} /></div>
      <dl className="detail-list">
        <div><dt>Affected work</dt><dd>{exception.workId}</dd></div>
        <div><dt>What is happening</dt><dd>{exception.detail}</dd></div>
        <div><dt>Timing / aging</dt><dd>{exception.aging}</dd></div>
        <div><dt>Accountable owner</dt><dd>{exception.owner}</dd></div>
      </dl>
      <div className="next-action-box"><span className="next-action-box__label">Possible next action</span><strong>{exception.nextAction}</strong></div>
      <p className="drawer-note">Blocker, RAG/Risk, and Exception remain separate control signals.</p>
    </DetailDrawer>
  );
}
