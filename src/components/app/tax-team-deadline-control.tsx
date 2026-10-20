"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildDeadlineControlRows,
  readDeadlinePublicationOverrides,
  writeDeadlinePublicationOverrides,
  type DeadlineControlRow,
  type DeadlineControlHistoryEvent,
  type DeadlinePublicationOverride,
  type DeadlinePublicationStatus,
} from "@/lib/domain/deadline-control";
import { governedReturnForms } from "@/lib/domain/client-return-selection";
import { calculateInternalTarget } from "@/lib/domain/tax-foundation";
import { DetailDrawer, SectionHeading } from "./workspace-components";

const statusLabels: Record<DeadlinePublicationStatus, string> = { generated: "Generated", needs_review: "Unresolved", confirmed: "Confirmed", published: "Published", unresolved: "Unresolved", superseded: "Superseded" };
type RepositorySource = "loading" | "repository" | "sanitized-fixture";
type EditableRow = DeadlineControlRow & { calendarMonth: string; periodStart: string; periodEnd: string; sourceLocator: string; notes: string };
const localRowsStorageKey = "taxmonweb.prototype.deadline-repository-rows";
const localHistoryStorageKey = "taxmonweb.prototype.deadline-repository-history";
const localHistoryActor = "Master Admin";
const obsoleteUnresolvedNote = "Deadline unresolved: no approved rule version is mapped for this requirement context.";

function readLocalHistory(): Record<string, DeadlineControlHistoryEvent[]> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(localHistoryStorageKey) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(Object.entries(parsed as Record<string, DeadlineControlHistoryEvent[]>).map(([rowId, events]) => [rowId, events.map((event) => {
      const detail = event.detail.replace(obsoleteUnresolvedNote, "").replace(/^\s*·\s*|\s*·\s*$/g, "").trim();
      return { ...event, detail: detail.startsWith(`${localHistoryActor} ·`) ? detail : `${localHistoryActor}${detail ? ` · ${detail}` : ""}` };
    })]));
  } catch {
    return {};
  }
}

function uniqueHistory(events: readonly DeadlineControlHistoryEvent[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function recordLocalHistory(rowId: string, label: string, detail: string) {
  const event: DeadlineControlHistoryEvent = { id: crypto.randomUUID(), label, detail: `${localHistoryActor} · ${detail}`, recordedAt: new Date().toISOString() };
  const history = readLocalHistory();
  history[rowId] = [event, ...(history[rowId] ?? [])];
  window.localStorage.setItem(localHistoryStorageKey, JSON.stringify(history));
  return event;
}

function categoryOption(value: string): EditableRow["taxCategory"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("cit")) return "cit";
  if (normalized.includes("vat") || normalized.includes("percentage")) return "vat_percentage";
  if (normalized.includes("wht") || normalized.includes("withholding")) return "wht";
  return "others";
}

function categoryLabel(value: string) {
  switch (categoryOption(value)) {
    case "cit": return "CIT";
    case "vat_percentage": return "VAT / Percentage Tax";
    case "wht": return "WHT";
    default: return "Others";
  }
}

function dateLabel(value: string | null, emptyLabel = "Unresolved") {
  if (!value) return emptyLabel;
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${value}T00:00:00Z`));
}

function historyTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not recorded" : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(date);
}

function toEditable(row: DeadlineControlRow): EditableRow {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthIndex = Math.max(0, months.indexOf(row.activityMonth));
  return { ...row, taxCategory: categoryOption(row.taxCategory), calendarMonth: new Date(Date.UTC(row.calendarYear, monthIndex, 1)).toISOString().slice(0, 10), periodStart: row.periodStartDate, periodEnd: "", sourceLocator: "", notes: row.explanation.replace(obsoleteUnresolvedNote, "").trim() };
}

function emptyRow(year: number): EditableRow {
  return { id: "", calendarYear: year, requirementCode: "", requirementLabel: "", formNumber: "", taxCategory: "others", cadence: "Monthly", component: "Return / filing", activityMonth: "January", activityPeriod: "", periodStartDate: `${year}-01-01`, taxablePeriod: "", baseStatutoryDeadline: null, adjustedStatutoryDeadline: null, officialPublishedDeadline: null, officialCalendarReference: null, earliestApplicableDeadline: null, publishedOperationalDeadline: null, tmfPackageTarget: null, publicationStatus: "needs_review", verificationStatus: "unresolved", ruleVersionId: "unresolved", sourceCode: "", sourceLabel: "", adjustmentReason: "", explanation: "", unresolvedReason: "new_repository_row_requires_review", calendarMonth: `${year}-01-01`, periodStart: "", periodEnd: "", sourceLocator: "", notes: "" };
}

function effectiveRow(row: DeadlineControlRow, overrides: Readonly<Record<string, DeadlinePublicationOverride>>) {
  const override = overrides[row.id];
  if (!override) return row;
  return { ...row, publicationStatus: override.status, publishedOperationalDeadline: override.status === "published" ? override.publishedOperationalDeadline ?? row.adjustedStatutoryDeadline : null };
}

function withDerivedInternalTarget(row: DeadlineControlRow): DeadlineControlRow {
  const deadline = row.earliestApplicableDeadline ?? row.adjustedStatutoryDeadline ?? row.baseStatutoryDeadline;
  if (!deadline || !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return row;
  return { ...row, tmfPackageTarget: calculateInternalTarget(deadline) };
}

function canPublish(row: DeadlineControlRow) {
  return row.publicationStatus !== "published" && row.publicationStatus !== "superseded" && Boolean(row.earliestApplicableDeadline);
}

function canSaveAndPublish(row: DeadlineControlRow) {
  return row.publicationStatus !== "superseded" && Boolean(row.earliestApplicableDeadline);
}

function mergeLocalRows(baseRows: DeadlineControlRow[], localRows: DeadlineControlRow[]) {
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const baseIds = new Set(baseRows.map((row) => row.id));
  return [...baseRows.map((row) => localById.get(row.id) ?? row), ...localRows.filter((row) => !baseIds.has(row.id))];
}

function formCadence(form: (typeof governedReturnForms)[number]): EditableRow["cadence"] {
  if (form.usualTiming.startsWith("Annual")) return "Annual";
  if (form.usualTiming.startsWith("Quarterly")) return "Quarterly";
  return "Monthly";
}

function DeadlineTransactionHistory({ events }: { events: readonly DeadlineControlHistoryEvent[] }) {
  return <details className="work-activity-history"><summary>Transaction history</summary><div>{events.length > 0 ? events.map((event) => <div className="work-activity-history__event" key={event.id}><strong>{event.label}</strong><small>{event.detail} · {historyTimestamp(event.recordedAt)}</small></div>) : <p className="work-activity-history__empty">No transaction history recorded for this deadline.</p>}</div></details>;
}

export function TaxTeamDeadlineControl() {
  const [year, setYear] = useState(2026);
  const [overrides, setOverrides] = useState<Record<string, DeadlinePublicationOverride>>(() => readDeadlinePublicationOverrides(typeof window === "undefined" ? undefined : window.localStorage));
  const [rows, setRows] = useState<DeadlineControlRow[]>([]);
  const [source, setSource] = useState<RepositorySource>("loading");
  const [editingRow, setEditingRow] = useState<EditableRow | null>(null);
  const [publishingRows, setPublishingRows] = useState<DeadlineControlRow[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [bulkPublishReason, setBulkPublishReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedReturn, setSelectedReturn] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("");

  const loadRows = useCallback(async (nextYear = year) => {
    setSource("loading");
    try {
      const response = await fetch(`/api/deadline-control?year=${nextYear}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Repository unavailable");
      const payload = await response.json() as { data?: DeadlineControlRow[]; source?: RepositorySource };
      const nextSource = payload.source === "repository" ? "repository" : "sanitized-fixture";
      const baseRows = payload.data ?? [];
      let nextRows: DeadlineControlRow[];
      if (nextSource === "repository") {
        nextRows = baseRows.map(withDerivedInternalTarget);
      } else {
        let localRows: DeadlineControlRow[] = [];
        try {
          const parsed = JSON.parse(window.localStorage.getItem(localRowsStorageKey) ?? "[]") as unknown;
          localRows = Array.isArray(parsed) ? parsed.filter((row): row is DeadlineControlRow => Boolean(row && typeof row === "object" && (row as DeadlineControlRow).calendarYear === nextYear)) : [];
        } catch { /* use the clean fixture */ }
        const localHistory = readLocalHistory();
        nextRows = mergeLocalRows(baseRows, localRows).map((row) => ({ ...row, history: uniqueHistory([...(row.history ?? []), ...(localHistory[row.id] ?? [])]) })).map(withDerivedInternalTarget);
      }
      setRows(nextRows);
      setSource(nextSource);
      return nextRows;
    } catch {
      const nextRows = buildDeadlineControlRows(nextYear).map(withDerivedInternalTarget);
      setRows(nextRows);
      setSource("sanitized-fixture");
      setMessage("Using the sanitized fixture while the governed repository is unavailable.");
      return nextRows;
    }
  }, [year]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRows(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRows]);
  const visibleRows = useMemo(() => rows.map((row) => withDerivedInternalTarget(effectiveRow(row, overrides))), [rows, overrides]);
  const addingRow = Boolean(editingRow && !editingRow.id);
  const newRowPeriods = editingRow?.formNumber ? buildDeadlineControlRows(editingRow.calendarYear, [editingRow.formNumber]) : [];
  const returnOptions = useMemo(() => [...new Set(visibleRows.map((row) => row.formNumber).filter(Boolean))].sort(), [visibleRows]);
  const periodOptions = useMemo(() => [...new Set(visibleRows.map((row) => row.activityPeriod || row.taxablePeriod).filter(Boolean))].sort(), [visibleRows]);
  const filteredRows = useMemo(() => visibleRows.filter((row) => (!selectedReturn || row.formNumber === selectedReturn) && (!selectedPeriod || (row.activityPeriod || row.taxablePeriod) === selectedPeriod)), [selectedPeriod, selectedReturn, visibleRows]);
  const publishableRows = filteredRows.filter(canPublish);
  const selectedPublishRows = filteredRows.filter((row) => selectedRowIds.includes(row.id) && canPublish(row));
  const allPublishableSelected = publishableRows.length > 0 && publishableRows.every((row) => selectedRowIds.includes(row.id));

  async function transition(row: DeadlineControlRow, status: DeadlinePublicationStatus, publishedOperationalDeadline: string | null = null, providedReason?: string) {
    const reason = providedReason?.trim() || (source === "repository" ? window.prompt(`Reason for ${statusLabels[status].toLowerCase()}:`, "Tax Team control review")?.trim() : "Tax Team prototype review simulation");
    if (!reason) return;
    if (source !== "repository") {
      if (status === "published") {
        if (!publishedOperationalDeadline) {
          setMessage(`${row.formNumber || row.requirementCode} cannot be published without an approved deadline.`);
          return;
        }
        const nextOverrides = { ...overrides, [row.id]: { status: "published" as const, publishedOperationalDeadline } };
        writeDeadlinePublicationOverrides(window.localStorage, nextOverrides);
        setOverrides(nextOverrides);
        const event = recordLocalHistory(row.id, "Deadline published", reason);
        setRows((current) => current.map((candidate) => candidate.id === row.id ? { ...candidate, publicationStatus: "published", publishedOperationalDeadline, verificationStatus: "verified", unresolvedReason: undefined, history: [event, ...(candidate.history ?? [])] } : candidate));
        setMessage(`${row.formNumber || row.requirementCode} published.`);
        return;
      }
      setMessage("Save the statutory date before publishing.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/deadline-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "transition", entryId: row.id, toStatus: status, publishedOperationalDeadline: status === "published" ? publishedOperationalDeadline ?? row.earliestApplicableDeadline : null, reason }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Unable to update the repository.");
      await loadRows();
      setMessage(`${statusLabels[status]} recorded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update the deadline.");
    } finally {
      setBusy(false);
    }
  }

  function openBulkPublication() {
    if (selectedPublishRows.length === 0) return;
    setEditingRow(null);
    setPublishingRows(selectedPublishRows);
    setBulkPublishReason("");
  }

  async function publishSelectedRows() {
    const selectedRows = publishingRows;
    const reason = bulkPublishReason.trim();
    if (selectedRows.length === 0) return;
    if (!reason) {
      setMessage("A reason is required for every publication decision.");
      return;
    }
    setPublishingRows([]);
    setSelectedRowIds([]);
    if (source !== "repository") {
      const nextOverrides = { ...overrides };
      const events: Record<string, DeadlineControlHistoryEvent> = {};
      selectedRows.forEach((row) => {
        nextOverrides[row.id] = { status: "published", publishedOperationalDeadline: row.earliestApplicableDeadline };
        events[row.id] = recordLocalHistory(row.id, "Deadline published", reason);
      });
      writeDeadlinePublicationOverrides(window.localStorage, nextOverrides);
      setOverrides(nextOverrides);
      setRows((current) => current.map((row) => events[row.id] ? { ...row, publicationStatus: "published", publishedOperationalDeadline: row.earliestApplicableDeadline, verificationStatus: "verified", unresolvedReason: undefined, history: [events[row.id], ...(row.history ?? [])] } : row));
      setMessage(`${selectedRows.length} deadlines published.`);
      return;
    }
    setBusy(true); setMessage("");
    try {
      for (const row of selectedRows) {
        const response = await fetch("/api/deadline-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "transition", entryId: row.id, toStatus: "published", publishedOperationalDeadline: row.earliestApplicableDeadline, reason }) });
        if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Unable to publish the selected deadlines.");
      }
      await loadRows();
      setMessage(`${selectedRows.length} deadlines published.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to publish the selected deadlines.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry() {
    if (!editingRow) return;
    if (editingRow.publicationStatus === "published" || editingRow.publicationStatus === "superseded") {
      setMessage("Released deadline rows are read-only.");
      return;
    }
    if (addingRow && (!editingRow.formNumber || !editingRow.activityPeriod)) { setMessage("Select the return and period this deadline covers."); return; }
    if (!editingRow.requirementCode.trim() || !editingRow.requirementLabel.trim() || !editingRow.calendarMonth) { setMessage("Return, period filed, and calendar month are required."); return; }
    if (source !== "repository") {
      const localRow: DeadlineControlRow = { ...editingRow, id: editingRow.id || `local-deadline-${crypto.randomUUID()}`, periodStartDate: editingRow.periodStart || editingRow.periodStartDate, taxablePeriod: editingRow.taxablePeriod || editingRow.activityPeriod, earliestApplicableDeadline: editingRow.adjustedStatutoryDeadline ?? editingRow.baseStatutoryDeadline, explanation: editingRow.notes.trim() || editingRow.explanation, sourceLabel: editingRow.sourceLabel || "Local sanitized draft" };
      let localRows: DeadlineControlRow[] = [];
      try {
        const parsed = JSON.parse(window.localStorage.getItem(localRowsStorageKey) ?? "[]") as unknown;
        localRows = Array.isArray(parsed) ? parsed.filter((row): row is DeadlineControlRow => Boolean(row && typeof row === "object")) : [];
      } catch { /* start with the current local draft */ }
      const nextLocalRows = [...localRows.filter((row) => row.id !== localRow.id), localRow];
      window.localStorage.setItem(localRowsStorageKey, JSON.stringify(nextLocalRows));
      const event = recordLocalHistory(localRow.id, "Deadline saved", editingRow.notes.trim() || "Saved in this browser’s sanitized prototype.");
      const savedRow = { ...localRow, history: [event, ...(localRow.history ?? [])] };
      setRows((current) => mergeLocalRows(current, [savedRow]));
      if (canSaveAndPublish(savedRow)) {
        await transition(savedRow, "published", savedRow.earliestApplicableDeadline, editingRow.notes.trim() || "Tax Team deadline update and publication");
        setEditingRow(null);
      } else {
        const nextEditingRow = toEditable(savedRow);
        setEditingRow(nextEditingRow);
        setMessage("Saved. Add a statutory date to publish.");
      }
      return;
    }
    setBusy(true); setMessage("");
    try {
      const payload = { entryId: editingRow.id || null, calendarMonth: editingRow.calendarMonth, requirementCode: editingRow.requirementCode, requirementName: editingRow.requirementLabel, formNumber: editingRow.formNumber, operatingCategory: editingRow.taxCategory, frequencyLabel: editingRow.cadence.toLowerCase().replace(" ", "_"), periodOrEvent: editingRow.activityPeriod, periodStart: editingRow.periodStart || null, periodEnd: editingRow.periodEnd || null, baseStatutoryDeadline: editingRow.baseStatutoryDeadline, adjustedStatutoryDeadline: editingRow.adjustedStatutoryDeadline, tmfPackageTarget: editingRow.tmfPackageTarget, sourceCode: editingRow.sourceCode, sourceLocator: editingRow.sourceLocator, notes: editingRow.notes, reason: editingRow.notes || "Tax Team repository maintenance" };
      const response = await fetch("/api/deadline-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", payload }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Unable to save the repository entry.");
      const savedPayload = await response.json() as { data?: { id?: string } };
      const nextRows = await loadRows();
      const savedRow = nextRows.find((row) => row.id === (editingRow.id || savedPayload.data?.id));
      if (savedRow) {
        if (canSaveAndPublish(savedRow)) {
          await transition(savedRow, "published", savedRow.earliestApplicableDeadline, editingRow.notes.trim() || "Tax Team deadline update and publication");
          setEditingRow(null);
        } else {
          const nextEditingRow = toEditable(savedRow);
          setEditingRow(nextEditingRow);
          setMessage("Saved. Add a statutory date to publish.");
        }
      } else {
        setEditingRow(null);
        setMessage("Saved to the governed repository.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the deadline.");
    } finally {
      setBusy(false);
    }
  }

  const immutableEditingRow = editingRow?.publicationStatus === "published" || editingRow?.publicationStatus === "superseded";

  return <>
    <section aria-labelledby="deadline-control-title" className="module-header deadline-control-header"><div><p className="eyebrow">Tax Team · master control</p><h2 id="deadline-control-title">Deadline Control</h2><p className="module-header__description">Maintain the governed dates used by compliance work. The earliest applicable statutory date is the control date; the internal target is one day before it.</p></div><div className="deadline-control-header__actions"><label className="select-control"><span>Year</span><select aria-label="Deadline calendar year" onChange={(event) => { setSelectedRowIds([]); setSelectedReturn(""); setSelectedPeriod(""); setYear(Number(event.target.value)); }} value={year}><option value={2026}>2026</option><option value={2027}>2027</option></select></label><label className="select-control"><span>Return</span><select aria-label="Deadline return filter" onChange={(event) => { setSelectedRowIds([]); setSelectedReturn(event.target.value); }} value={selectedReturn}><option value="">All returns</option>{returnOptions.map((formNumber) => <option key={formNumber} value={formNumber}>{formNumber}</option>)}</select></label><label className="select-control"><span>Period filed</span><select aria-label="Deadline period filed filter" onChange={(event) => { setSelectedRowIds([]); setSelectedPeriod(event.target.value); }} value={selectedPeriod}><option value="">All periods</option>{periodOptions.map((period) => <option key={period} value={period}>{period}</option>)}</select></label>{source !== "repository" && <button className="button button--primary" onClick={() => { setEditingRow(emptyRow(year)); }} type="button">Add deadline</button>}</div></section>
    <div className={`repository-source repository-source--${source}`} role="status"><span aria-hidden="true" />{source === "repository" ? "Governed repository" : source === "loading" ? "Loading repository…" : "Sanitized fixture fallback · changes are local only"}</div>
    {message && <p className="deadline-control-message" role="status">{message}</p>}
    <section aria-label="Bulk publication actions" className="deadline-control-bulk-actions"><label><input aria-label="Select all publishable deadlines" checked={allPublishableSelected} disabled={publishableRows.length === 0} onChange={(event) => setSelectedRowIds(event.target.checked ? publishableRows.map((row) => row.id) : [])} type="checkbox" /> Select publishable deadlines</label><span className="deadline-control-bulk-actions__hint">{publishableRows.length > 0 ? `${publishableRows.length} deadline${publishableRows.length === 1 ? "" : "s"} available` : "Enter a statutory date to publish"}</span><button className="button button--primary button--small" disabled={selectedPublishRows.length === 0 || busy} onClick={openBulkPublication} type="button">Publish selected{selectedPublishRows.length > 0 ? ` (${selectedPublishRows.length})` : ""}</button></section>
    <section aria-labelledby="deadline-control-table-title" className="panel panel--table report-detail-panel"><SectionHeading detail={`${year} · ${filteredRows.length === visibleRows.length ? `${visibleRows.length} rows` : `${filteredRows.length} of ${visibleRows.length} rows`}`} title="Deadline repository" /><div className="report-table-wrap"><table className="report-table deadline-control-table"><thead><tr><th className="deadline-control-table__select"><span className="sr-only">Select for publication</span></th><th>Return / form</th><th>Period filed</th><th>Earliest due date</th><th>Internal target</th><th>Status</th></tr></thead><tbody>{filteredRows.map((row) => { const publishable = canPublish(row); return <tr key={row.id}><td className="deadline-control-table__select"><input aria-label={`Select ${row.formNumber || row.requirementCode} ${row.activityPeriod || row.taxablePeriod} for publication`} checked={selectedRowIds.includes(row.id)} disabled={!publishable} onChange={(event) => setSelectedRowIds((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} title={publishable ? "Ready for publication" : "Requires a statutory date"} type="checkbox" /></td><td><button className="report-row-button" onClick={() => { setEditingRow(toEditable(row)); }} type="button"><strong>{row.formNumber || row.requirementCode}</strong><small>{row.requirementLabel}</small><span className="deadline-control-table__meta">{categoryLabel(row.taxCategory)} <span aria-hidden="true">·</span> {row.cadence}</span></button></td><td>{row.activityPeriod || row.taxablePeriod}</td><td className="deadline-control-table__date">{dateLabel(row.earliestApplicableDeadline ?? row.adjustedStatutoryDeadline ?? row.baseStatutoryDeadline)}</td><td className="deadline-control-table__date">{dateLabel(row.tmfPackageTarget)}</td><td><span className={`deadline-status deadline-status--${row.publicationStatus}`}>{statusLabels[row.publicationStatus]}</span></td></tr>; })}</tbody></table></div></section>
    {publishingRows.length > 0 && <DetailDrawer eyebrow="Deadline control" title={`Publish ${publishingRows.length} deadlines`} subtitle="Bulk publication" onClose={() => { setPublishingRows([]); setBulkPublishReason(""); }}><div className="team-editor__form"><p className="report-inline-note">Each selected row will publish using its own earliest applicable statutory due date. This makes the dates available to downstream calendars and compliance work.</p><div className="deadline-bulk-list">{publishingRows.map((row) => <div className="deadline-bulk-list__row" key={row.id}><strong>{row.formNumber || row.requirementCode}</strong><span>{row.activityPeriod || row.taxablePeriod}</span><span>{dateLabel(row.earliestApplicableDeadline)}</span></div>)}</div><label className="form-field"><span>Publication reason</span><textarea aria-label="Bulk publication reason" onChange={(event) => setBulkPublishReason(event.target.value)} value={bulkPublishReason} /></label><div className="team-editor__footer"><p className="team-note">Publishing is a controlled decision. Each publication event is retained in transaction history.</p><div className="team-editor__actions"><button className="button button--quiet" onClick={() => { setPublishingRows([]); setBulkPublishReason(""); }} type="button">Cancel</button><button className="button button--primary" disabled={busy} onClick={() => void publishSelectedRows()} type="button">{busy ? "Publishing…" : `Publish ${publishingRows.length} deadlines`}</button></div></div></div></DetailDrawer>}
    {editingRow && <DetailDrawer eyebrow="Deadline control" title={<span className="deadline-drawer-title"><span>{`${editingRow.formNumber || editingRow.requirementCode} — ${editingRow.activityPeriod || "New deadline"}`}</span>{editingRow.publicationStatus === "published" && <span className="deadline-drawer-status-tag" role="status">Published</span>}{editingRow.publicationStatus === "superseded" && <span className="deadline-drawer-status-tag" role="status">Superseded</span>}</span>} subtitle={editingRow.requirementLabel || ""} onClose={() => { setEditingRow(null); }}><div className="deadline-editor"><div className="deadline-editor__list">{addingRow && <label className="deadline-editor__row"><span>Return / requirement</span><select aria-label="Return / requirement" onChange={(event) => { const form = governedReturnForms.find((candidate) => candidate.formNumber === event.target.value); setEditingRow({ ...editingRow, formNumber: form?.formNumber ?? "", requirementCode: form ? `REQ-${form.formNumber}` : "", requirementLabel: form?.title ?? "", taxCategory: form ? categoryOption(form.taxTypeCodes.join(" ")) : "others", cadence: form ? formCadence(form) : "Monthly", activityMonth: "", activityPeriod: "", periodStartDate: "", taxablePeriod: "", calendarMonth: "" }); }} value={editingRow.formNumber}><option value="">Select a governed return</option>{governedReturnForms.map((form) => <option key={form.formNumber} value={form.formNumber}>{form.formNumber} · {form.title}</option>)}</select></label>}<label className="deadline-editor__row"><span>Period filed</span>{addingRow ? <select aria-label="Period filed" disabled={!editingRow.formNumber} onChange={(event) => { const period = newRowPeriods.find((candidate) => candidate.activityPeriod === event.target.value); if (!period) return; setEditingRow({ ...editingRow, activityMonth: period.activityMonth, activityPeriod: period.activityPeriod, periodStartDate: period.periodStartDate, taxablePeriod: period.taxablePeriod, calendarMonth: `${period.periodStartDate.slice(0, 7)}-01` }); }} value={editingRow.activityPeriod}><option value="">{editingRow.formNumber ? "Select period" : "Select a return first"}</option>{newRowPeriods.map((period) => <option key={period.activityPeriod} value={period.activityPeriod}>{period.activityPeriod}</option>)}</select> : <input aria-label="Period filed" disabled={immutableEditingRow} onChange={(event) => setEditingRow({ ...editingRow, calendarMonth: event.target.value ? `${event.target.value}-01` : "" })} type="month" value={editingRow.calendarMonth.slice(0, 7)} />}</label><label className="deadline-editor__row"><span>Statutory due date</span><input aria-label="Statutory due date" disabled={immutableEditingRow} onChange={(event) => setEditingRow({ ...editingRow, adjustedStatutoryDeadline: event.target.value || null })} type="date" value={editingRow.adjustedStatutoryDeadline ?? editingRow.baseStatutoryDeadline ?? ""} /></label><label className="deadline-editor__row"><span>One day before due date</span><input aria-label="One day before due date" disabled={immutableEditingRow} onChange={(event) => setEditingRow({ ...editingRow, tmfPackageTarget: event.target.value || null })} type="date" value={editingRow.tmfPackageTarget ?? ""} /></label><label className="deadline-editor__row deadline-editor__row--notes"><span>Notes / change reason</span><textarea aria-label="Notes / change reason" readOnly={immutableEditingRow} onChange={(event) => setEditingRow({ ...editingRow, notes: event.target.value })} value={editingRow.notes} /></label></div><DeadlineTransactionHistory events={editingRow.history ?? []} /><div className="deadline-editor__footer"><div className="team-editor__actions">{immutableEditingRow ? <button className="button button--quiet" onClick={() => { setEditingRow(null); }} type="button">Close</button> : <><button className="button button--quiet" onClick={() => { setEditingRow(null); }} type="button">Cancel</button><button className="button button--primary" disabled={busy} onClick={() => void saveEntry()} type="button">{busy ? "Saving…" : canSaveAndPublish(editingRow) ? "Save and publish" : "Save"}</button></>}</div></div></div></DetailDrawer>}
  </>;
}
