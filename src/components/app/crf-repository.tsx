"use client";

import { useEffect, useState } from "react";

import { fixtureChangeRequestForms, fixtureClients, fixtureClock, type FixtureAuditExposure, type FixtureChangeRequestForm, type FixtureChangeRequestFormStatus, type FixtureChangeRequestFormType, type FixtureClient } from "@/lib/fixtures";
import { additionalEngagementToFixtureChangeRequestForm, portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { canManageModuleRecords } from "@/lib/domain/access";
import { useWorkflow } from "@/lib/workflow-state";
import { DetailDrawer, SectionHeading, isInScope, scopeOptions, type ScopeFilter } from "./workspace-components";

const storageKey = "taxmon.client.crf-repository.v1";
const crfTypes: readonly FixtureChangeRequestFormType[] = ["Tax audit support", "Additional tax service", "Registration remediation", "Other"];
const crfStatuses: readonly FixtureChangeRequestFormStatus[] = ["Draft", "Pending review", "Approved", "Active", "Closed"];

type CrfDraft = Omit<FixtureChangeRequestForm, "id" | "referenceCode" | "contractRepositoryId" | "clientName" | "status" | "templateVersion" | "requestedOn"> & { status: FixtureChangeRequestFormStatus; auditContext: FixtureAuditExposure };

const emptyAudit = (): FixtureAuditExposure => ({ id: "audit-context-new", taxableYear: "", matter: "", status: "Open", asOf: fixtureClock.today, context: "", source: "", officerName: "", officerRole: "", officerContact: "" });

function initialCrfRecords(): FixtureChangeRequestForm[] {
  return [...fixtureChangeRequestForms];
}

function emptyDraft(clientId = fixtureClients[0]?.id ?? ""): CrfDraft {
  return { clientId, title: "", type: "Additional tax service", status: "Draft", requestedBy: "Client request", owner: "", scopeSummary: "", sourceReference: "", auditContext: emptyAudit() };
}

export function CrfRepositoryView() {
  const { accessMatrix, isClientVisible, prototypeMode, workPerspective } = useWorkflow();
  const [records, setRecords] = useState<FixtureChangeRequestForm[]>(() => prototypeMode ? initialCrfRecords() : []);
  const [liveClients, setLiveClients] = useState<FixtureClient[]>([]);
  const [query, setQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [clusterFilter, setClusterFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<FixtureChangeRequestFormType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FixtureChangeRequestFormStatus | "all">("all");
  const [selected, setSelected] = useState<FixtureChangeRequestForm | null>(null);
  const [editing, setEditing] = useState<FixtureChangeRequestForm | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const canManage = prototypeMode && canManageModuleRecords(workPerspective, "clients", accessMatrix);

  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
      fetch("/api/portfolio?detail=full", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load the live contract repository.");
        return response.json() as Promise<{ data?: Parameters<typeof portfolioClientToFixtureClient>[0][] }>;
      })
      .then((payload) => {
        if (!cancelled) setLiveClients((payload.data ?? []).map(portfolioClientToFixtureClient));
      })
      .catch(() => {
        if (!cancelled) setLiveClients([]);
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  const sourceClients = prototypeMode ? fixtureClients : liveClients;
  const visibleClients = sourceClients.filter(isClientVisible);
  const visibleClientIds = new Set(visibleClients.map((client) => client.id));
  const sourceRecords: FixtureChangeRequestForm[] = prototypeMode ? records : liveClients.flatMap((client) => client.contractRepository.additionalEngagements.map((engagement) => additionalEngagementToFixtureChangeRequestForm({
    reference_code: client.id,
    display_name: client.name,
    contractRepositoryId: client.contractRepository.id,
  }, {
    id: engagement.id,
    contract_repository_id: client.contractRepository.id,
    reference_code: engagement.referenceCode,
    title: engagement.title,
    status: engagement.status === "Active" ? "active" : engagement.status === "Closed" ? "closed" : "pending_review",
    effective_from: engagement.effectiveFrom,
    source_reference: engagement.sourceReference,
    scope_summary: engagement.scopeSummary,
  })));

  useEffect(() => {
    if (!prototypeMode) return;
    const timer = window.setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "null") as unknown;
        if (Array.isArray(saved)) setRecords([...fixtureChangeRequestForms, ...saved.filter(isCrfRecord)]);
      } catch {
        // Keep the deterministic fixture projection when local storage is unavailable.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [prototypeMode]);

  const accessibleRecords = sourceRecords.filter((record) => visibleClientIds.has(record.clientId));
  const accessibleClientById = new Map(visibleClients.map((client) => [client.id, client]));
  const clusterOptions = Array.from(new Set(visibleClients.map((client) => client.assignment.cluster))).sort();
  const ownerOptions = Array.from(new Set(accessibleRecords.map((record) => record.owner).filter(Boolean))).sort();

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = accessibleRecords.filter((record) => {
    const client = accessibleClientById.get(record.clientId);
    if (!client) return false;
    const matchesQuery = !normalizedQuery || [record.referenceCode, record.clientName, record.title, record.owner, record.scopeSummary].some((value) => value.toLowerCase().includes(normalizedQuery));
    return isInScope(client.scope, scopeFilter)
      && (clusterFilter === "all" || client.assignment.cluster === clusterFilter)
      && (ownerFilter === "all" || record.owner === ownerFilter)
      && matchesQuery
      && (typeFilter === "all" || record.type === typeFilter)
      && (statusFilter === "all" || record.status === statusFilter);
  });
  const visibleSelected = selected && visibleClientIds.has(selected.clientId) ? selected : null;
  const showEditor = editorOpen && (!editing || visibleClientIds.has(editing.clientId));

  function saveDraft(draft: CrfDraft, existing?: FixtureChangeRequestForm) {
    const client = fixtureClients.find((item) => item.id === draft.clientId);
    if (!client || !draft.title.trim() || !draft.scopeSummary.trim() || !draft.sourceReference.trim()) return "Client, title, scope, and source reference are required.";
    if (draft.type === "Tax audit support" && (!draft.auditContext.taxableYear.trim() || !draft.auditContext.matter.trim() || !draft.auditContext.source.trim())) return "Tax audit CRFs require the taxable year, matter, and source reference.";
    const next: FixtureChangeRequestForm = {
      id: existing?.id ?? `crf-local-${Date.now()}`,
      referenceCode: existing?.referenceCode ?? `CRF-LOCAL-${String(records.filter((record) => record.id.startsWith("crf-local-")).length + 1).padStart(3, "0")}`,
      clientId: client.id,
      contractRepositoryId: client.contractRepository.id,
      clientName: client.name,
      title: draft.title.trim(),
      type: draft.type,
      status: draft.status,
      requestedOn: existing?.requestedOn ?? fixtureClock.today,
      requestedBy: draft.requestedBy,
      owner: draft.owner.trim() || client.assignment.reviewer,
      scopeSummary: draft.scopeSummary.trim(),
      sourceReference: draft.sourceReference.trim(),
      templateVersion: "CRF v1",
      ...(draft.type === "Tax audit support" ? { auditContext: { ...draft.auditContext, id: existing?.auditContext?.id ?? `audit-context-${Date.now()}` } } : {}),
    };
    setRecords((current) => existing ? current.map((record) => record.id === existing.id ? next : record) : [...current, next]);
    const localRecords = existing && !existing.id.startsWith("crf-local-") ? records.filter((record) => record.id.startsWith("crf-local-")) : [...records.filter((record) => record.id.startsWith("crf-local-") && record.id !== existing?.id), next];
    window.localStorage.setItem(storageKey, JSON.stringify(localRecords));
    setEditing(null);
    setEditorOpen(false);
    setSelected(next);
    setFeedback(existing ? `${next.referenceCode} updated locally.` : `${next.referenceCode} saved locally.`);
    return undefined;
  }

  return <>
    <header className="module-header">
      <div><p className="eyebrow">Clients · additional engagement</p><h1>CRF repository</h1><p className="module-header__description">Record Change Request Forms in the client’s Contract Repository. A CRF can carry high-level audit context without becoming a separate audit case tracker.</p></div>
      <div className="module-header__right"><div className="module-count"><strong>{filtered.length} of {accessibleRecords.length}</strong><small>Authorized CRF records · CRF v1</small></div>{canManage && <button className="button button--primary button--small" onClick={() => { setEditing(null); setEditorOpen(true); }} type="button">+ New CRF</button>}</div>
    </header>
    {feedback && <div className="saved-notice" role="status">{feedback}</div>}
    <section aria-label="CRF repository filters" className="registry-toolbar">
      <div className="registry-toolbar__primary"><label className="search-control search-control--wide"><span className="sr-only">Search CRFs</span><input aria-label="Search CRFs" onChange={(event) => setQuery(event.target.value)} placeholder="Search CRF, client, owner, or scope" type="search" value={query} /></label></div>
      <div className="registry-toolbar__filters"><label className="select-control"><span>Scope</span><select aria-label="CRF scope" onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)} value={scopeFilter}>{scopeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="select-control"><span>Cluster</span><select aria-label="CRF cluster" onChange={(event) => setClusterFilter(event.target.value)} value={clusterFilter}><option value="all">All clusters</option>{clusterOptions.map((cluster) => <option key={cluster}>{cluster}</option>)}</select></label><label className="select-control"><span>Owner</span><select aria-label="CRF owner" onChange={(event) => setOwnerFilter(event.target.value)} value={ownerFilter}><option value="all">All owners</option>{ownerOptions.map((owner) => <option key={owner}>{owner}</option>)}</select></label><label className="select-control"><span>Type</span><select onChange={(event) => setTypeFilter(event.target.value as FixtureChangeRequestFormType | "all")} value={typeFilter}><option value="all">All types</option>{crfTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="select-control"><span>Status</span><select onChange={(event) => setStatusFilter(event.target.value as FixtureChangeRequestFormStatus | "all")} value={statusFilter}><option value="all">All statuses</option>{crfStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
    </section>
    <section aria-labelledby="crf-register-title" className="panel panel--table registry-panel"><SectionHeading title="Additional engagements" detail="Each row remains linked to one existing client and its Contract Repository." /><div className="taxpayer-register" role="region" aria-label="CRF repository table" tabIndex={0}><table className="taxpayer-table crf-table"><thead><tr><th scope="col">CRF</th><th scope="col">Client</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Owner</th><th scope="col">Audit context</th></tr></thead><tbody>{filtered.map((record) => <tr key={record.id}><td><button className="table-link-button" onClick={() => setSelected(record)} type="button"><strong>{record.referenceCode}</strong><small>{record.title}</small></button></td><td><strong>{record.clientName}</strong><small>{record.contractRepositoryId}</small></td><td>{record.type}</td><td><span className="status-label">{record.status}</span></td><td>{record.owner}</td><td>{record.auditContext ? `${record.auditContext.taxableYear} · ${record.auditContext.status}` : "Not recorded"}</td></tr>)}</tbody></table>{filtered.length === 0 && <div className="inline-empty">No CRF records match these filters.</div>}</div></section>
    {showEditor && <CrfEditor clients={visibleClients} initial={editing} onClose={() => { setEditorOpen(false); setEditing(null); }} onSave={saveDraft} />}
    {visibleSelected && !showEditor && <CrfDetail canManage={canManage} record={visibleSelected} onClose={() => setSelected(null)} onEdit={() => { setEditing(visibleSelected); setSelected(null); setEditorOpen(true); }} />}
  </>;
}

function CrfDetail({ record, canManage, onClose, onEdit }: { record: FixtureChangeRequestForm; canManage: boolean; onClose: () => void; onEdit: () => void }) {
  return <DetailDrawer eyebrow={`CRF repository · ${record.templateVersion}`} title={record.title} subtitle={`${record.referenceCode} · ${record.clientName}`} onClose={onClose}><div className="drawer-status-row"><span className="concept-tag">{record.type}</span><span className="concept-tag">{record.status}</span></div><dl className="detail-list"><div><dt>Client Contract Repository</dt><dd>{record.contractRepositoryId}</dd></div><div><dt>Requested by</dt><dd>{record.requestedBy}</dd></div><div><dt>Owner</dt><dd>{record.owner}</dd></div><div><dt>Scope</dt><dd>{record.scopeSummary}</dd></div><div><dt>Source / reference</dt><dd>{record.sourceReference}</dd></div></dl>{record.auditContext && <section className="drawer-section"><SectionHeading title="Audit context" detail="High-level context linked to this CRF; detailed Tax Audit case management remains a separate V1 lens." /><dl className="detail-list"><div><dt>Taxable year</dt><dd>{record.auditContext.taxableYear}</dd></div><div><dt>Matter</dt><dd>{record.auditContext.matter}</dd></div><div><dt>Status</dt><dd>{record.auditContext.status}</dd></div><div><dt>As of</dt><dd>{record.auditContext.asOf}</dd></div><div><dt>Officer</dt><dd>{record.auditContext.officerName ?? "Not recorded"}</dd></div><div><dt>Source</dt><dd>{record.auditContext.source}</dd></div></dl></section>}{canManage && <button className="button button--primary button--small" onClick={onEdit} type="button">Edit CRF</button>}</DetailDrawer>;
}

function CrfEditor({ clients, initial, onClose, onSave }: { clients: readonly typeof fixtureClients[number][]; initial: FixtureChangeRequestForm | null; onClose: () => void; onSave: (draft: CrfDraft, existing?: FixtureChangeRequestForm) => string | undefined }) {
  const client = clients.find((item) => item.id === initial?.clientId);
  const [draft, setDraft] = useState<CrfDraft>(() => initial ? { clientId: initial.clientId, title: initial.title, type: initial.type, status: initial.status, requestedBy: initial.requestedBy, owner: initial.owner, scopeSummary: initial.scopeSummary, sourceReference: initial.sourceReference, auditContext: initial.auditContext ? { ...initial.auditContext } : emptyAudit() } : emptyDraft());
  const [error, setError] = useState<string | null>(null);
  function update(patch: Partial<CrfDraft>) { setDraft((current) => ({ ...current, ...patch })); setError(null); }
  function updateAudit(patch: Partial<FixtureAuditExposure>) { setDraft((current) => ({ ...current, auditContext: { ...current.auditContext, ...patch } })); setError(null); }
  function submit() { const result = onSave(draft, initial ?? undefined); if (result) setError(result); }
  return <DetailDrawer eyebrow="CRF repository · CRF v1 template" title={initial ? "Edit CRF" : "New Change Request Form"} subtitle="Create the additional engagement record first; linked audit context stays source-backed and high-level." onClose={onClose}><div className="form-stack">{error && <div className="form-error" role="alert">{error}</div>}<label className="form-field"><span>Client</span><select disabled={Boolean(initial)} onChange={(event) => update({ clientId: event.target.value })} value={draft.clientId}>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="form-field"><span>CRF title</span><input autoFocus onChange={(event) => update({ title: event.target.value })} value={draft.title} /></label><div className="form-grid"><label className="form-field"><span>Type</span><select onChange={(event) => update({ type: event.target.value as FixtureChangeRequestFormType })} value={draft.type}>{crfTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="form-field"><span>Status</span><select onChange={(event) => update({ status: event.target.value as FixtureChangeRequestFormStatus })} value={draft.status}>{crfStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></div><div className="form-grid"><label className="form-field"><span>Requested by</span><select onChange={(event) => update({ requestedBy: event.target.value })} value={draft.requestedBy}><option>Client request</option><option>Internal review</option><option>Management</option></select></label><label className="form-field"><span>Owner</span><input onChange={(event) => update({ owner: event.target.value })} value={draft.owner || client?.assignment.reviewer || ""} /></label></div><label className="form-field"><span>Scope summary</span><textarea onChange={(event) => update({ scopeSummary: event.target.value })} value={draft.scopeSummary} /></label><label className="form-field"><span>Source / reference</span><input onChange={(event) => update({ sourceReference: event.target.value })} value={draft.sourceReference} /></label>{draft.type === "Tax audit support" && <section className="drawer-section"><SectionHeading title="Audit context" detail="Record only what the source supports. This does not create a Tax Audit case file." /><div className="form-grid"><label className="form-field"><span>Taxable year</span><input onChange={(event) => updateAudit({ taxableYear: event.target.value })} value={draft.auditContext.taxableYear} /></label><label className="form-field"><span>As of</span><input onChange={(event) => updateAudit({ asOf: event.target.value })} value={draft.auditContext.asOf} /></label></div><label className="form-field"><span>Matter / scope</span><input onChange={(event) => updateAudit({ matter: event.target.value })} value={draft.auditContext.matter} /></label><label className="form-field"><span>Status</span><select onChange={(event) => updateAudit({ status: event.target.value as FixtureAuditExposure["status"] })} value={draft.auditContext.status}><option>Open</option><option>Under review</option><option>Closed</option></select></label><div className="form-grid"><label className="form-field"><span>BIR officer</span><input onChange={(event) => updateAudit({ officerName: event.target.value })} value={draft.auditContext.officerName ?? ""} /></label><label className="form-field"><span>Officer role</span><input onChange={(event) => updateAudit({ officerRole: event.target.value })} value={draft.auditContext.officerRole ?? ""} /></label></div><label className="form-field"><span>Context</span><textarea onChange={(event) => updateAudit({ context: event.target.value })} value={draft.auditContext.context} /></label><label className="form-field"><span>Audit source</span><input onChange={(event) => updateAudit({ source: event.target.value })} value={draft.auditContext.source} /></label></section>}<button className="button button--primary" onClick={submit} type="button">{initial ? "Save CRF changes" : "Save CRF draft"}</button></div></DetailDrawer>;
}

function isCrfRecord(value: unknown): value is FixtureChangeRequestForm {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<FixtureChangeRequestForm>;
  return typeof record.id === "string" && record.id.startsWith("crf-local-") && typeof record.referenceCode === "string" && typeof record.clientId === "string" && typeof record.clientName === "string" && typeof record.title === "string" && typeof record.scopeSummary === "string" && typeof record.sourceReference === "string";
}
