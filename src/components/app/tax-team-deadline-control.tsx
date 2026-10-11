"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildDeadlineControlRows,
  deadlineControlSummary,
  readDeadlinePublicationOverrides,
  writeDeadlinePublicationOverrides,
  type DeadlineControlRow,
  type DeadlinePublicationOverride,
  type DeadlinePublicationStatus,
} from "@/lib/domain/deadline-control";
import { DetailDrawer, MetricCard, SectionHeading } from "./workspace-components";

const statusLabels: Record<DeadlinePublicationStatus, string> = { generated: "Generated", needs_review: "Needs review", confirmed: "Confirmed", published: "Published", unresolved: "Unresolved", superseded: "Superseded" };
type RepositorySource = "loading" | "repository" | "sanitized-fixture";
type EditableRow = DeadlineControlRow & { calendarMonth: string; periodStart: string; periodEnd: string; sourceLocator: string; notes: string };
const localRowsStorageKey = "taxmonweb.prototype.deadline-repository-rows";

function dateLabel(value: string | null) {
  if (!value) return "Unresolved";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Manila" }).format(new Date(`${value}T00:00:00Z`));
}

function toEditable(row: DeadlineControlRow): EditableRow {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthIndex = Math.max(0, months.indexOf(row.activityMonth));
  return { ...row, calendarMonth: new Date(Date.UTC(row.calendarYear, monthIndex, 1)).toISOString().slice(0, 10), periodStart: "", periodEnd: "", sourceLocator: "", notes: row.explanation };
}

function emptyRow(year: number): EditableRow {
  return { id: "", calendarYear: year, requirementCode: "", requirementLabel: "", formNumber: "", taxCategory: "others", cadence: "Monthly", component: "Return / filing", activityMonth: "January", activityPeriod: "", taxablePeriod: "", baseStatutoryDeadline: null, adjustedStatutoryDeadline: null, earliestApplicableDeadline: null, publishedOperationalDeadline: null, tmfPackageTarget: null, publicationStatus: "needs_review", verificationStatus: "unresolved", ruleVersionId: "unresolved", sourceCode: "", sourceLabel: "", adjustmentReason: "", explanation: "New deadline row requires source and rule review.", unresolvedReason: "new_repository_row_requires_review", calendarMonth: `${year}-01-01`, periodStart: "", periodEnd: "", sourceLocator: "", notes: "" };
}

function effectiveRow(row: DeadlineControlRow, overrides: Readonly<Record<string, DeadlinePublicationOverride>>) {
  const override = overrides[row.id];
  if (!override) return row;
  return { ...row, publicationStatus: override.status, publishedOperationalDeadline: override.status === "published" ? override.publishedOperationalDeadline ?? row.adjustedStatutoryDeadline : null };
}

export function TaxTeamDeadlineControl() {
  const [year, setYear] = useState(2026);
  const [overrides, setOverrides] = useState<Record<string, DeadlinePublicationOverride>>(() => readDeadlinePublicationOverrides(typeof window === "undefined" ? undefined : window.localStorage));
  const [rows, setRows] = useState<DeadlineControlRow[]>([]);
  const [source, setSource] = useState<RepositorySource>("loading");
  const [selectedRow, setSelectedRow] = useState<DeadlineControlRow | null>(null);
  const [editingRow, setEditingRow] = useState<EditableRow | null>(null);
  const [publishingRow, setPublishingRow] = useState<DeadlineControlRow | null>(null);
  const [publishDate, setPublishDate] = useState("");
  const [publishReason, setPublishReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadRows = useCallback(async (nextYear = year) => {
    setSource("loading");
    try {
      const response = await fetch(`/api/deadline-control?year=${nextYear}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Repository unavailable");
      const payload = await response.json() as { data?: DeadlineControlRow[]; source?: RepositorySource };
      const nextSource = payload.source === "repository" ? "repository" : "sanitized-fixture";
      const baseRows = payload.data ?? [];
      if (nextSource === "repository") {
        setRows(baseRows);
      } else {
        let localRows: DeadlineControlRow[] = [];
        try {
          const parsed = JSON.parse(window.localStorage.getItem(localRowsStorageKey) ?? "[]") as unknown;
          localRows = Array.isArray(parsed) ? parsed.filter((row): row is DeadlineControlRow => Boolean(row && typeof row === "object" && (row as DeadlineControlRow).calendarYear === nextYear)) : [];
        } catch { /* use the clean fixture */ }
        setRows([...baseRows, ...localRows.filter((local) => !baseRows.some((base) => base.id === local.id))]);
      }
      setSource(nextSource);
    } catch {
      setRows(buildDeadlineControlRows(nextYear));
      setSource("sanitized-fixture");
      setMessage("Using the sanitized fixture while the governed repository is unavailable.");
    }
  }, [year]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRows(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRows]);
  const visibleRows = useMemo(() => rows.map((row) => effectiveRow(row, overrides)), [rows, overrides]);
  const summary = deadlineControlSummary(visibleRows);

  async function transition(row: DeadlineControlRow, status: DeadlinePublicationStatus, publishedOperationalDeadline: string | null = null, providedReason?: string) {
    const reason = providedReason?.trim() || (source === "repository" ? window.prompt(`Reason for ${statusLabels[status].toLowerCase()}:`, "Tax Team control review")?.trim() : "Tax Team prototype review simulation");
    if (!reason) return;
    if (source !== "repository") {
      if (status === "confirmed" && row.adjustedStatutoryDeadline && (row.publicationStatus === "generated" || row.publicationStatus === "needs_review")) {
        const nextOverrides = { ...overrides, [row.id]: { status: "confirmed" as const } };
        writeDeadlinePublicationOverrides(window.localStorage, nextOverrides);
        setOverrides(nextOverrides);
        setSelectedRow(null);
        setMessage(`${row.formNumber || row.requirementCode} confirmed for prototype review. It remains held until a verified rule can be published.`);
        return;
      }
      if (status === "published") {
        if (row.verificationStatus !== "verified") {
          setMessage(`${row.formNumber || row.requirementCode} cannot be published: its rule/source is not verified.`);
          return;
        }
        if (!publishedOperationalDeadline) {
          setMessage(`${row.formNumber || row.requirementCode} cannot be published without an approved deadline.`);
          return;
        }
        const nextOverrides = { ...overrides, [row.id]: { status: "published" as const, publishedOperationalDeadline } };
        writeDeadlinePublicationOverrides(window.localStorage, nextOverrides);
        setOverrides(nextOverrides);
        setSelectedRow(null);
        setMessage(`${row.formNumber || row.requirementCode} published in the sanitized prototype. Client calendars will use this date after refresh.`);
        return;
      }
      setMessage("This sanitized fallback supports review simulation only. Unresolved rules remain read-only until governed source data is available.");
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

  function openPublication(row: DeadlineControlRow) {
    setPublishingRow(row);
    setPublishDate(row.publishedOperationalDeadline ?? row.earliestApplicableDeadline ?? "");
    setPublishReason("");
  }

  async function publishSelectedRow() {
    if (!publishingRow || !/^\d{4}-\d{2}-\d{2}$/.test(publishDate)) {
      setMessage("Enter a valid operational due date before publishing.");
      return;
    }
    if (publishingRow.earliestApplicableDeadline && publishDate > publishingRow.earliestApplicableDeadline) {
      setMessage(`The operational due date cannot be later than the earliest applicable deadline (${dateLabel(publishingRow.earliestApplicableDeadline)}).`);
      return;
    }
    if (!publishReason.trim()) {
      setMessage("A reason is required for every publication decision.");
      return;
    }
    const row = publishingRow;
    const reason = publishReason.trim();
    setPublishingRow(null);
    await transition(row, "published", publishDate, reason);
  }

  async function saveEntry() {
    if (!editingRow || !editingRow.requirementCode.trim() || !editingRow.requirementLabel.trim() || !editingRow.calendarMonth || !editingRow.sourceCode.trim()) { setMessage("Requirement code, name, calendar month, and source are required."); return; }
    if (source !== "repository") {
      setMessage("The governed deadline repository is unavailable. The sanitized fallback is read-only.");
      return;
    }
    setBusy(true); setMessage("");
    try {
      const payload = { entryId: editingRow.id || null, calendarMonth: editingRow.calendarMonth, requirementCode: editingRow.requirementCode, requirementName: editingRow.requirementLabel, formNumber: editingRow.formNumber, operatingCategory: editingRow.taxCategory, frequencyLabel: editingRow.cadence.toLowerCase().replace(" ", "_"), periodOrEvent: editingRow.activityPeriod, periodStart: editingRow.periodStart || null, periodEnd: editingRow.periodEnd || null, baseStatutoryDeadline: editingRow.baseStatutoryDeadline, adjustedStatutoryDeadline: editingRow.adjustedStatutoryDeadline, tmfPackageTarget: editingRow.tmfPackageTarget, sourceCode: editingRow.sourceCode, sourceLocator: editingRow.sourceLocator, notes: editingRow.notes, reason: editingRow.notes || "Tax Team repository maintenance" };
      const response = await fetch("/api/deadline-control", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", payload }) });
      if (!response.ok) throw new Error((await response.json() as { error?: string }).error ?? "Unable to save the repository entry.");
      await loadRows();
      setEditingRow(null); setMessage("Saved to the governed repository.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save the deadline.");
    } finally {
      setBusy(false);
    }
  }

  function actionFor(row: DeadlineControlRow) {
    if (row.publicationStatus === "published") return <><span className="deadline-control-action">Published</span><button className="button button--quiet button--small" disabled={busy} onClick={() => void transition(row, "superseded")} type="button">Supersede</button></>;
    if (row.publicationStatus === "confirmed" && row.verificationStatus === "verified") return <button className="button button--primary button--small" disabled={busy} onClick={() => openPublication(row)} type="button">Set due date & publish</button>;
    if ((row.publicationStatus === "needs_review" || row.publicationStatus === "generated") && row.adjustedStatutoryDeadline) return <button className="button button--quiet button--small" disabled={busy} onClick={() => void transition(row, "confirmed")} type="button">Confirm</button>;
    return <span className="deadline-control-action">Review source</span>;
  }

  return <>
    <section aria-labelledby="deadline-control-title" className="module-header deadline-control-header"><div><p className="eyebrow">Tax Team · master control</p><h2 id="deadline-control-title">Deadline Control</h2><p className="module-header__description">Maintain the governed dates used by compliance work. The default due date is the earliest applicable statutory component deadline; Tax Team publishes the operational date that downstream work and calendars may use.</p></div><div className="deadline-control-header__actions"><label className="select-control"><span>Calendar year</span><select aria-label="Deadline calendar year" onChange={(event) => setYear(Number(event.target.value))} value={year}><option value={2026}>2026</option><option value={2027}>2027</option></select></label><button className="button button--primary" onClick={() => setEditingRow(emptyRow(year))} type="button">Add deadline</button></div></section>
    <div className={`repository-source repository-source--${source}`} role="status"><span aria-hidden="true" />{source === "repository" ? "Governed repository" : source === "loading" ? "Loading repository…" : "Sanitized fixture fallback · changes are local only"}</div>
    {message && <p className="deadline-control-message" role="status">{message}</p>}
    <section aria-label="Deadline control summary" className="metric-grid tax-team-metrics"><MetricCard detail="rows in this year" label="Repository" tone="neutral" value={String(summary.total)} /><MetricCard detail="released for operational use" label="Published" tone="blue" value={String(summary.published)} /><MetricCard detail="awaiting control decision" label="Needs review" tone={summary.requiringReview > 0 ? "amber" : "blue"} value={String(summary.requiringReview)} /><MetricCard detail="cannot be released yet" label="Unresolved" tone={summary.unresolved > 0 ? "red" : "blue"} value={String(summary.unresolved)} /></section>
    <section aria-labelledby="deadline-control-rule-title" className="panel deadline-control-rule"><SectionHeading detail="Only released rows feed operational projections." title="Master date rule · earliest applicable deadline" /><p id="deadline-control-rule-title">The earliest applicable statutory component date is the default master due date. Tax Team may publish an earlier operational date when the control decision requires it, but never a later date. Base statutory, adjusted statutory, published operational, and TMF Package Target dates remain separate and explainable.</p></section>
    <section aria-labelledby="deadline-control-table-title" className="panel panel--table report-detail-panel"><SectionHeading detail={`${year} · ${visibleRows.length} rows`} title="Deadline repository" /><div className="report-table-wrap"><table className="report-table deadline-control-table"><thead><tr><th>Requirement / form</th><th>Period</th><th>Earliest applicable</th><th>Published operational due date</th><th>TMF target</th><th>Status</th><th>Action</th></tr></thead><tbody>{visibleRows.map((row) => <tr key={row.id}><td><button className="report-row-button" onClick={() => setSelectedRow(row)} type="button"><strong>{row.formNumber || row.requirementCode}</strong><small>{row.requirementLabel} · {row.taxCategory} · {row.cadence}</small></button></td><td>{row.activityPeriod || row.taxablePeriod}<small>{row.activityMonth}</small></td><td>{dateLabel(row.earliestApplicableDeadline)}<small>Adjusted statutory basis</small></td><td>{dateLabel(row.publishedOperationalDeadline)}<small>{row.publicationStatus === "published" ? "Released for downstream use" : "Not released"}</small></td><td>{dateLabel(row.tmfPackageTarget)}</td><td><span className={`deadline-status deadline-status--${row.publicationStatus}`}>{statusLabels[row.publicationStatus]}</span></td><td><button className="button button--quiet button--small" disabled={row.publicationStatus === "published" || row.publicationStatus === "superseded"} onClick={() => setEditingRow(toEditable(row))} type="button">Edit</button> {actionFor(row)}</td></tr>)}</tbody></table></div></section>
    {selectedRow && <DetailDrawer eyebrow="Deadline Control · master date" title={`${selectedRow.formNumber || selectedRow.requirementCode} · ${selectedRow.activityPeriod}`} subtitle={selectedRow.requirementLabel} onClose={() => setSelectedRow(null)}><dl className="detail-list"><div><dt>Requirement</dt><dd>{selectedRow.requirementCode}</dd></div><div><dt>Base statutory</dt><dd>{dateLabel(selectedRow.baseStatutoryDeadline)}</dd></div><div><dt>Adjusted statutory</dt><dd>{dateLabel(selectedRow.adjustedStatutoryDeadline)}</dd></div><div><dt>Earliest applicable deadline</dt><dd>{dateLabel(selectedRow.earliestApplicableDeadline)}</dd></div><div><dt>Published operational due date</dt><dd>{dateLabel(selectedRow.publishedOperationalDeadline)}</dd></div><div><dt>TMF package target</dt><dd>{dateLabel(selectedRow.tmfPackageTarget)}</dd></div><div><dt>Rule version</dt><dd>{selectedRow.ruleVersionId}</dd></div><div><dt>Source</dt><dd>{selectedRow.sourceLabel}</dd></div><div><dt>Why this date</dt><dd>{selectedRow.explanation}</dd></div><div><dt>State</dt><dd>{statusLabels[selectedRow.publicationStatus]}</dd></div></dl><div className="deadline-drawer-actions"><button className="button button--quiet" onClick={() => { setEditingRow(toEditable(selectedRow)); setSelectedRow(null); }} type="button">Edit</button>{actionFor(selectedRow)}</div></DetailDrawer>}
    {publishingRow && <DetailDrawer eyebrow="Deadline Control · master date decision" title="Set operational due date" subtitle={`${publishingRow.formNumber || publishingRow.requirementCode} · ${publishingRow.activityPeriod}`} onClose={() => setPublishingRow(null)}><div className="team-editor__form"><p className="report-inline-note">The default is the earliest applicable deadline. You may publish an earlier operational date, but not a later one. This decision is the date downstream work and calendars may use.</p><label className="form-field"><span>Operational due date</span><input aria-label="Operational due date" max={publishingRow.earliestApplicableDeadline ?? undefined} onChange={(event) => setPublishDate(event.target.value)} type="date" value={publishDate} /></label><p className="team-note">Earliest applicable deadline: <strong>{dateLabel(publishingRow.earliestApplicableDeadline)}</strong></p><label className="form-field"><span>Publication reason</span><textarea aria-label="Publication reason" onChange={(event) => setPublishReason(event.target.value)} value={publishReason} /></label><div className="team-editor__footer"><p className="team-note">Publishing is a controlled decision. The source-backed rule remains unchanged, and the publication event is retained in history.</p><div className="team-editor__actions"><button className="button button--quiet" onClick={() => setPublishingRow(null)} type="button">Cancel</button><button className="button button--primary" disabled={busy} onClick={() => void publishSelectedRow()} type="button">{busy ? "Publishing…" : "Publish due date"}</button></div></div></div></DetailDrawer>}
    {editingRow && <DetailDrawer eyebrow="Deadline repository" title={editingRow.id ? "Edit deadline" : "Add deadline"} subtitle="A row stays unresolved until its source and rule context are reviewed." onClose={() => setEditingRow(null)}><div className="team-editor__form"><div className="team-editor__grid"><label className="form-field"><span>Requirement code</span><input disabled={Boolean(editingRow.id && source === "repository")} onChange={(event) => setEditingRow({ ...editingRow, requirementCode: event.target.value })} value={editingRow.requirementCode} /></label><label className="form-field"><span>Requirement name</span><input onChange={(event) => setEditingRow({ ...editingRow, requirementLabel: event.target.value })} value={editingRow.requirementLabel} /></label><label className="form-field"><span>Form number</span><input disabled={Boolean(editingRow.id && source === "repository")} onChange={(event) => setEditingRow({ ...editingRow, formNumber: event.target.value })} value={editingRow.formNumber} /></label><label className="form-field"><span>Operating category</span><select disabled={Boolean(editingRow.id && source === "repository")} onChange={(event) => setEditingRow({ ...editingRow, taxCategory: event.target.value })} value={editingRow.taxCategory}><option value="cit">CIT</option><option value="vat_percentage">VAT / Percentage Tax</option><option value="wht">WHT</option><option value="others">Others</option></select></label><label className="form-field"><span>Frequency</span><select disabled={Boolean(editingRow.id && source === "repository")} onChange={(event) => setEditingRow({ ...editingRow, cadence: event.target.value as EditableRow["cadence"] })} value={editingRow.cadence}><option>Monthly</option><option>Quarterly</option><option>Annual</option><option>As needed</option></select></label><label className="form-field"><span>Calendar month</span><input onChange={(event) => setEditingRow({ ...editingRow, calendarMonth: event.target.value })} type="date" value={editingRow.calendarMonth} /></label><label className="form-field"><span>Period / event</span><input onChange={(event) => setEditingRow({ ...editingRow, activityPeriod: event.target.value, taxablePeriod: event.target.value })} value={editingRow.activityPeriod} /></label><label className="form-field"><span>Period start</span><input onChange={(event) => setEditingRow({ ...editingRow, periodStart: event.target.value })} type="date" value={editingRow.periodStart} /></label><label className="form-field"><span>Period end</span><input onChange={(event) => setEditingRow({ ...editingRow, periodEnd: event.target.value })} type="date" value={editingRow.periodEnd} /></label><label className="form-field"><span>Base statutory</span><input onChange={(event) => setEditingRow({ ...editingRow, baseStatutoryDeadline: event.target.value || null })} type="date" value={editingRow.baseStatutoryDeadline ?? ""} /></label><label className="form-field"><span>Adjusted statutory</span><input onChange={(event) => setEditingRow({ ...editingRow, adjustedStatutoryDeadline: event.target.value || null })} type="date" value={editingRow.adjustedStatutoryDeadline ?? ""} /></label><label className="form-field"><span>TMF package target</span><input onChange={(event) => setEditingRow({ ...editingRow, tmfPackageTarget: event.target.value || null })} type="date" value={editingRow.tmfPackageTarget ?? ""} /></label><label className="form-field"><span>Source code</span><input onChange={(event) => setEditingRow({ ...editingRow, sourceCode: event.target.value })} value={editingRow.sourceCode} /></label><label className="form-field"><span>Source locator</span><input onChange={(event) => setEditingRow({ ...editingRow, sourceLocator: event.target.value })} value={editingRow.sourceLocator} /></label><label className="form-field team-editor__remarks"><span>Notes / change reason</span><textarea onChange={(event) => setEditingRow({ ...editingRow, notes: event.target.value })} value={editingRow.notes} /></label></div><div className="team-editor__footer"><p className="team-note">Changes require a source-backed reason and remain auditable. Released rows are superseded, not deleted.</p><div className="team-editor__actions"><button className="button button--quiet" onClick={() => setEditingRow(null)} type="button">Cancel</button><button className="button button--primary" disabled={busy} onClick={() => void saveEntry()} type="button">{busy ? "Saving…" : "Save"}</button></div></div></div></DetailDrawer>}
  </>;
}
