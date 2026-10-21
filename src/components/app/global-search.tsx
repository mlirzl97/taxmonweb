"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Icon } from "@/components/ui/icon";
import { prototypeClientSetupUpdatedEvent, readSubmittedClientSetups } from "@/lib/domain/submitted-client-projection";
import { primaryNavigation, restrictedNavigation } from "@/lib/navigation";
import { moduleForRoute } from "@/lib/domain/access";
import { useWorkflow } from "@/lib/workflow-state";

type SearchResult = {
  id: string;
  kind: "Client" | "Work" | "Workspace";
  title: string;
  subtitle: string;
  meta: string;
  href: string;
};

const allNavigation = [...primaryNavigation, ...restrictedNavigation];

function normalized(value: string) {
  return value.trim().toLowerCase();
}

function includesQuery(query: string, ...values: string[]) {
  return values.some((value) => normalized(value).includes(query));
}


export function GlobalSearch() {
  const router = useRouter();
  const { canAccessModule, clientRegistry, getEffectiveWork, getWorkItems, isWorkVisible, prototypeMode } = useWorkflow();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [submittedClients, setSubmittedClients] = useState<ReturnType<typeof readSubmittedClientSetups>>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!prototypeMode) return;
    const syncSubmittedClients = () => setSubmittedClients(readSubmittedClientSetups());
    syncSubmittedClients();
    window.addEventListener(prototypeClientSetupUpdatedEvent, syncSubmittedClients);
    window.addEventListener("storage", syncSubmittedClients);
    return () => {
      window.removeEventListener(prototypeClientSetupUpdatedEvent, syncSubmittedClients);
      window.removeEventListener("storage", syncSubmittedClients);
    };
  }, [prototypeMode]);

  const results = useMemo(() => {
    const search = normalized(query);
    if (!search) return { clients: [], work: [], workspaces: [] };

    const searchableClients = [...clientRegistry, ...submittedClients].filter((client, index, clients) => clients.findIndex((candidate) => candidate.id === client.id) === index);
    const clients: SearchResult[] = searchableClients
      .filter((client) => includesQuery(search, client.name, client.entitySummary, client.profileSummary, client.scope, client.assignment.cluster ?? ""))
      .slice(0, 8)
      .map((client) => ({
        id: `client-${client.id}`,
        kind: "Client",
        title: client.name,
        subtitle: `${client.entitySummary} · ${client.profileSummary}`,
        meta: client.assignment.cluster ?? client.scope,
        href: `/app/clients/${client.id}`,
      }));

    const work: SearchResult[] = getWorkItems()
      .map(getEffectiveWork)
      .filter((item) => isWorkVisible(item))
      .filter((item) => includesQuery(search, item.client, item.title, item.requirementCode ?? "", item.period, item.registrationUnit, item.nextAction))
      .slice(0, 8)
      .map((item) => ({
        id: `work-${item.id}`,
        kind: "Work",
        title: item.title,
        subtitle: `${item.client} · ${item.period}`,
        meta: item.requirementCode ?? item.nextAction,
        href: `/app/work/${item.id}`,
      }));

    const workspaces: SearchResult[] = allNavigation
      .filter((item) => { const itemModule = moduleForRoute(item.href); return !itemModule || canAccessModule(itemModule); })
      .filter((item) => includesQuery(search, item.label, item.href))
      .map((item) => ({
        id: `workspace-${item.href}`,
        kind: "Workspace",
        title: item.label,
        subtitle: "Open workspace",
        meta: "Navigation",
        href: item.href,
      }));

    return { clients, work, workspaces };
  }, [clientRegistry, getEffectiveWork, getWorkItems, isWorkVisible, query, submittedClients, canAccessModule]);

  const firstResult = results.clients[0] ?? results.work[0] ?? results.workspaces[0];
  const hasResults = results.clients.length + results.work.length + results.workspaces.length > 0;

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusFrame = window.requestAnimationFrame(() => inputRef.current?.focus());

    function handleDialogKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key === "Enter" && document.activeElement === inputRef.current && firstResult) {
        event.preventDefault();
        router.push(firstResult.href);
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), input")).filter((element) => !element.hidden);
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

    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleDialogKeyDown);
      previousFocus?.focus();
    };
  }, [firstResult, open, router]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  function openResult(result: SearchResult) {
    close();
    router.push(result.href);
  }

  return <>
    <button aria-keyshortcuts="Meta+K Control+K" aria-label="Search TaxMonWeb" className="global-search-trigger" onClick={() => setOpen(true)} ref={triggerRef} type="button">
      <Icon name="search" size={16} />
      <span>Search TaxMonWeb</span>
      <kbd>⌘K</kbd>
    </button>

    {open && <div className="global-search-layer">
      <button aria-label="Close search" className="global-search-backdrop" onClick={close} type="button" />
      <section aria-describedby="global-search-description" aria-labelledby="global-search-title" aria-modal="true" className="global-search-dialog" ref={dialogRef} role="dialog">
        <div className="global-search-dialog__header">
          <div><p className="eyebrow">Find in TaxMonWeb</p><h2 id="global-search-title">Search clients and work</h2><p id="global-search-description">Search by taxpayer, return, period, next action, or workspace.</p></div>
          <button aria-label="Close search" className="icon-button" onClick={close} type="button">×</button>
        </div>
        <label className="global-search-input"><Icon name="search" size={16} /><span className="sr-only">Search clients and work</span><input onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") close(); }} placeholder="Search clients, returns, periods…" ref={inputRef} type="search" value={query} /><kbd>Esc</kbd></label>
        <div className="global-search-results">
          {!query.trim() ? <div className="global-search-empty"><strong>Start with a client or return</strong><span>Use the keyboard shortcut anywhere in the app, then type what you need.</span><div className="global-search-quick-links">{allNavigation.filter((item) => { const itemModule = moduleForRoute(item.href); return !itemModule || canAccessModule(itemModule); }).map((item) => <button key={item.href} onClick={() => openResult({ id: item.href, kind: "Workspace", title: item.label, subtitle: "Open workspace", meta: "Navigation", href: item.href })} type="button"><Icon name={item.icon} size={15} />{item.label}</button>)}</div></div> : !hasResults ? <div className="global-search-empty"><strong>No matches</strong><span>Try a client name, return code, period, or next action.</span></div> : <>
            {results.clients.length > 0 && <SearchGroup label="Clients" results={results.clients} onSelect={openResult} />}
            {results.work.length > 0 && <SearchGroup label="Work" results={results.work} onSelect={openResult} />}
            {results.workspaces.length > 0 && <SearchGroup label="Workspaces" results={results.workspaces} onSelect={openResult} />}
          </>}
        </div>
        <div className="global-search-dialog__footer"><span><kbd>↵</kbd> Open first result</span><span><kbd>Esc</kbd> Close</span></div>
      </section>
    </div>}
  </>;
}

function SearchGroup({ label, results, onSelect }: { label: string; results: SearchResult[]; onSelect: (result: SearchResult) => void }) {
  return <section aria-labelledby={`global-search-${label.toLowerCase()}`} className="global-search-group"><h3 id={`global-search-${label.toLowerCase()}`}>{label}</h3>{results.map((result) => <button className="global-search-result" key={result.id} onClick={() => onSelect(result)} type="button"><span className="global-search-result__kind">{result.kind}</span><span className="global-search-result__body"><strong>{result.title}</strong><small>{result.subtitle}</small></span><span className="global-search-result__meta">{result.meta}</span></button>)}</section>;
}
