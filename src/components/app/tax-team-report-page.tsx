"use client";

import { useEffect, useMemo, useState } from "react";

import {
  defaultTaxTeamReportFilters,
  filterTaxTeamReportRows,
  filterTaxTeamTransactionReviews,
  formatReportDate,
  getTaxTeamReportRows,
  getTaxTeamTransactionReviews,
  reportGroupValue,
  summarizeTaxTeamReport,
  taxTeamDateBasisOptions,
  taxTeamGroupOptions,
  taxTeamQAStatusLabels,
  taxTeamTransactionReviewStatusLabels,
  taxTeamMonthlyStatusLabels,
  taxTeamMonthlyStatusOptions,
  taxTeamRCAStatusLabels,
  taxTeamReportTypes,
  type TaxTeamReportFilters,
  type TaxTeamReportRow,
  type TaxTeamTransactionReview,
} from "@/lib/domain/tax-team-reports";
import { scopeFilterForValue, scopeValueForFilter } from "@/lib/control-tower-state";
import { ScopeSwitcher, DetailDrawer, FixturePageFrame, MetricCard, PageHeader, SectionHeading, StatusLabel } from "./workspace-components";
import { TaxTeamDeadlineControl } from "./tax-team-deadline-control";
import { PeriodLocksView } from "./tax-team-period-locks";
import { useWorkflow } from "@/lib/workflow-state";
import { liveWorkToTaxTeamReportRow } from "@/lib/domain/live-tax-team-adapter";

function reportTitle(filters: TaxTeamReportFilters) {
  return taxTeamReportTypes.find((report) => report.id === filters.reportType)?.label ?? "Tax Team report";
}

type TaxTeamView = "overview" | "deadline-control" | "period-locks" | TaxTeamReportFilters["reportType"];

function TaxTeamOverview({ qaOpenCount, summary, onOpenReport, onOpenDeadlineControl, onOpenPeriodLocks }: { qaOpenCount: number; summary: ReturnType<typeof summarizeTaxTeamReport>; onOpenReport: (report: TaxTeamReportFilters["reportType"]) => void; onOpenDeadlineControl: () => void; onOpenPeriodLocks: () => void }) {
  return <>
    <section aria-labelledby="tax-team-overview-title" className="tax-team-landing panel">
      <div className="section-heading"><div><h2 id="tax-team-overview-title">Control position</h2><p className="section-heading__support">Start here, then open the report that needs review.</p></div><span className="section-heading__note">Current reporting window</span></div>
      <div className="tax-team-landing__signals">
        <button onClick={() => onOpenReport("monthly")} type="button"><span>Population</span><strong>{summary.expected}</strong><small>Open monthly compliance</small></button>
        <button onClick={() => onOpenReport("monthly")} type="button"><span>Attention</span><strong>{summary.openAttention}</strong><small>RAG items</small></button>
        <button onClick={() => onOpenReport("monthly")} type="button"><span>Unresolved</span><strong>{summary.unresolved}</strong><small>Status not evidenced</small></button>
        <button onClick={() => onOpenReport("qa")} type="button"><span>QA review</span><strong>{qaOpenCount}</strong><small>Transactions awaiting certification</small></button>
      </div>
    </section>
    <section aria-labelledby="tax-team-routes-title" className="tax-team-landing__routes">
      <h2 id="tax-team-routes-title">Open a control view</h2>
      <div className="tax-team-landing__route-list">
        <button onClick={onOpenDeadlineControl} type="button"><strong>Deadline Control</strong><span>Review and publish governed annual operational deadlines.</span><b aria-hidden="true">→</b></button>
        <button onClick={onOpenPeriodLocks} type="button"><strong>Period locks</strong><span>Close an accounting period once; closed work becomes read-only.</span><b aria-hidden="true">→</b></button>
        {taxTeamReportTypes.map((report) => <button key={report.id} onClick={() => onOpenReport(report.id)} type="button"><strong>{report.label}</strong><span>{report.description}</span><b aria-hidden="true">→</b></button>)}
      </div>
    </section>
  </>;
}

function MonthlyStatusReport({ rows, summary, filters, taxReturnColumns, onSelectRow }: { rows: readonly TaxTeamReportRow[]; summary: ReturnType<typeof summarizeTaxTeamReport>; filters: TaxTeamReportFilters; taxReturnColumns: readonly string[]; onSelectRow: (row: TaxTeamReportRow) => void }) {
  return <>
    <section aria-labelledby="report-status-matrix-title" className="panel panel--table report-status-matrix-panel">
      <SectionHeading detail="Rows are the monthly report status; columns are the tax returns in the selected population." title="Monthly status report" />
      {taxReturnColumns.length === 0 ? <p className="report-empty">No validated records match this report definition.</p> : <div className="report-table-wrap"><table className="report-status-matrix"><thead><tr><th scope="col">Status</th>{taxReturnColumns.map((taxReturn) => <th key={taxReturn} scope="col">{taxReturn}</th>)}</tr></thead><tbody>{taxTeamMonthlyStatusOptions.map((option) => <tr className={option.id === "unresolved" ? "report-status-matrix__safety-row" : undefined} key={option.id}><th scope="row"><span className={`report-matrix-status report-matrix-status--${option.id}`}>{option.label}</span><small>{option.description}</small></th>{taxReturnColumns.map((taxReturn) => { const count = rows.filter((row) => row.monthlyStatus === option.id && row.requirement === taxReturn).length; return <td key={`${option.id}-${taxReturn}`} aria-label={`${option.label}, ${taxReturn}: ${count}`}>{count === 0 ? <span className="report-matrix-empty">—</span> : <strong>{count}</strong>}</td>; })}</tr>)}</tbody></table></div>}
      <div className="report-callout"><strong>{summary.openAttention} RAG attention item{summary.openAttention === 1 ? "" : "s"}</strong><span>{summary.unresolved} row{summary.unresolved === 1 ? "" : "s"} remain{summary.unresolved === 1 ? "s" : ""} status-not-evidenced because approved filing, payment, or deadline facts are unavailable.</span></div>
    </section>
    <section aria-labelledby="tax-team-detail-title" className="panel panel--table report-detail-panel">
      <SectionHeading detail="Click a row to inspect the controlled status distinctions and source context." title="Filtered obligation detail" />
      {rows.length === 0 ? <p className="report-empty">No validated records match the selected period and scope.</p> : <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Status</th><th>Obligation</th><th>Period</th><th>Group</th><th>Lifecycle</th><th>Filing</th><th>Payment</th><th>Control</th><th>RAG</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><span className={`report-monthly-status report-monthly-status--${row.monthlyStatus}`}>{taxTeamMonthlyStatusLabels[row.monthlyStatus]}</span></td><td><button className="report-row-button" onClick={() => onSelectRow(row)} type="button"><strong>{row.requirement}</strong><small>{row.client} · {row.registrationUnit}</small></button></td><td>{row.period}<small>{row.dateLabel}</small></td><td>{reportGroupValue(row, filters.groupBy)}</td><td>{row.lifecycle}</td><td>{row.filing}<small>{row.acceptance}</small></td><td>{row.payment}</td><td>{row.control}<small>{row.evidence}</small></td><td><StatusLabel status={row.status} /></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

function QAOverview({ reviews, onSelectReview }: { reviews: readonly TaxTeamTransactionReview[]; onSelectReview: (review: TaxTeamTransactionReview) => void }) {
  const certifiedCount = reviews.filter((review) => review.reviewStatus === "certified").length;
  const followUpCount = reviews.filter((review) => review.reviewStatus === "follow_up").length;
  const openCount = reviews.length - certifiedCount;
  return <>
    <section aria-labelledby="qa-overview-title" className="signal-section">
      <SectionHeading detail="Tax Team checks the pulled records for completeness and awareness." title="Transaction review" />
      <div className="metric-grid tax-team-metrics qa-metrics">
        <MetricCard detail="pulled transaction groups" label="Pulled" tone="neutral" value={String(reviews.length)} />
        <MetricCard detail="both checks certified" label="Certified" tone="blue" value={String(certifiedCount)} />
        <MetricCard detail="still requiring Tax Team review" label="To review" tone={openCount > 0 ? "amber" : "blue"} value={String(openCount)} />
        <MetricCard detail="requires follow-up" label="Follow-up" tone={followUpCount > 0 ? "red" : "neutral"} value={String(followUpCount)} />
      </div>
    </section>
    <section aria-labelledby="qa-control-title" className="panel qa-panels">
      <SectionHeading detail="This does not certify tax computation, filing, payment, or technical correctness." title="Certification rule" />
      <div className="qa-certification-rule"><span>1</span><strong>Completeness checked</strong><span>2</span><strong>Records reviewed and understood</strong><span>→</span><strong>Tax Team certification</strong></div>
    </section>
    <section aria-labelledby="qa-detail-title" className="panel panel--table report-detail-panel">
      <SectionHeading detail="Open a pulled population to review and certify it." title="Pulled transaction register" />
      {reviews.length === 0 ? <p className="report-empty">No pulled transaction groups match the selected window and scope.</p> : <div className="report-table-wrap"><table className="report-table qa-detail-table"><thead><tr><th>Taxpayer</th><th>Return / period</th><th>Source</th><th>Records</th><th>Review</th><th>Action</th></tr></thead><tbody>{reviews.map((review) => <tr key={review.id}><td><strong>{review.client}</strong><small>{review.cluster} · {review.tower}</small></td><td>{review.requirement}<small>{review.period}</small></td><td>{review.source}<small>{review.date}</small></td><td>{review.recordsPulled}</td><td><span className={`transaction-review-status transaction-review-status--${review.reviewStatus}`}>{taxTeamTransactionReviewStatusLabels[review.reviewStatus]}</span></td><td><button className="button button--quiet button--small" onClick={() => onSelectReview(review)} type="button">{review.reviewStatus === "certified" ? "View" : "Review"}</button></td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

function TransactionReviewDrawer({ review, onClose, onCertify }: { review: TaxTeamTransactionReview; onClose: () => void; onCertify: (completenessChecked: boolean, awarenessChecked: boolean) => void }) {
  const [completenessChecked, setCompletenessChecked] = useState(review.completenessChecked);
  const [awarenessChecked, setAwarenessChecked] = useState(review.awarenessChecked);
  const canCertify = completenessChecked && awarenessChecked;
  return <DetailDrawer eyebrow="QA · transaction review" title={`${review.client} · ${review.requirement}`} subtitle={review.period} onClose={onClose}>
    <div className="transaction-review-drawer">
      <div className="transaction-review-drawer__facts"><div><span>Source</span><strong>{review.source}</strong></div><div><span>Records pulled</span><strong>{review.recordsPulled}</strong></div><div><span>Pull date</span><strong>{review.date}</strong></div></div>
      <p className="report-inline-note">Certify only that the pulled records were checked for completeness and that the Tax Team is aware of the population. This is not a tax computation or filing approval.</p>
      <fieldset className="transaction-review-checks"><legend>Tax Team checks</legend><label><input checked={completenessChecked} onChange={(event) => setCompletenessChecked(event.target.checked)} type="checkbox" /> Completeness checked</label><label><input checked={awarenessChecked} onChange={(event) => setAwarenessChecked(event.target.checked)} type="checkbox" /> Records reviewed and understood</label></fieldset>
      {review.reviewStatus === "certified" ? <p className="form-success" role="status">Certified by {review.certifiedBy ?? "Tax Team"} on {review.certifiedAt ?? "the recorded date"}.</p> : <button className="button button--primary" disabled={!canCertify} onClick={() => onCertify(completenessChecked, awarenessChecked)} type="button">Certify transaction review</button>}
    </div>
  </DetailDrawer>;
}

function RCAOverview({ rows }: { rows: readonly TaxTeamReportRow[] }) {
  const configured = rows.some((row) => row.rcaStatus !== "not_configured");
  const rcaRows = rows.filter((row) => row.rcaStatus === "candidate" || row.rcaStatus === "open");
  return <>
    <section aria-labelledby="rca-overview-title" className="signal-section">
      <SectionHeading detail="RCA is exception-driven; ordinary QA corrections stay in QA." title="RCA overview" />
      <div className="metric-grid tax-team-metrics qa-metrics"><MetricCard detail="filtered population" label="Population" tone="neutral" value={String(rows.length)} /><MetricCard detail="material or repeated causes" label="RCA candidates" tone="amber" value={configured ? String(rows.filter((row) => row.rcaStatus === "candidate").length) : "Not configured"} /><MetricCard detail="active root-cause actions" label="Open RCA cases" tone="red" value={configured ? String(rows.filter((row) => row.rcaStatus === "open").length) : "Not configured"} /><MetricCard detail="closed and retained history" label="Closed RCA cases" tone="blue" value={configured ? String(rows.filter((row) => row.rcaStatus === "closed").length) : "Not configured"} /></div>
    </section>
    <section aria-labelledby="rca-decision-title" className="report-chart-grid qa-panels">
      <div className="panel"><SectionHeading detail="Use judgment and an authorized decision; do not open an incident for every QA correction." title="When RCA is appropriate" /><ul className="qa-check-list"><li>Repeated similar QA findings across periods, taxpayers, teams, or tax returns.</li><li>A material control failure or plausible statutory exposure.</li><li>A systemic cause involving process, training, ownership, data, or tooling.</li><li>Management or Tax Control explicitly requests a root-cause investigation.</li></ul></div>
      <div className="panel"><SectionHeading detail="An isolated support gap is corrected and re-checked in QA." title="What does not create RCA" /><ul className="qa-check-list"><li>A one-off missing document that is corrected within the engagement.</li><li>A normal checker comment with no repeated or material pattern.</li><li>An unresolved fixture value where the underlying fact is not yet available.</li></ul></div>
    </section>
    <section aria-labelledby="rca-register-title" className="panel panel--table report-detail-panel"><SectionHeading detail="Only authorized RCA candidates and cases appear here." title="RCA register" />{rcaRows.length === 0 ? <div className="report-empty-state"><strong>{configured ? "No RCA cases in the selected population." : "RCA tracking is not configured for this sanitized fixture."}</strong><span>{configured ? "QA observations remain in QA unless a material, repeated, or systemic trigger is recorded." : "No incident status is inferred. QA findings must be configured before RCA eligibility can be assessed."}</span></div> : <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Tax return / client</th><th>QA signal</th><th>RCA status</th><th>Next decision</th></tr></thead><tbody>{rcaRows.map((row) => <tr key={row.id}><td><strong>{row.requirement}</strong><small>{row.client} · {row.period}</small></td><td>{row.qaFinding}</td><td>{taxTeamRCAStatusLabels[row.rcaStatus]}</td><td>Review materiality, recurrence, and authorized RCA decision.</td></tr>)}</tbody></table></div>}</section>
  </>;
}

function AuditDetail({ rows, filters, onSelectRow }: { rows: readonly TaxTeamReportRow[]; filters: TaxTeamReportFilters; onSelectRow: (row: TaxTeamReportRow) => void }) {
  return <section aria-labelledby="tax-team-detail-title" className="panel panel--table report-detail-panel"><SectionHeading detail="Filing, payment, attachments, evidence, and accountable history." title="Tax Audit Pack" />{rows.length === 0 ? <p className="report-empty">No validated records match the selected period and scope.</p> : <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Obligation</th><th>Period</th><th>Group</th><th>Lifecycle</th><th>Filing</th><th>Payment</th><th>Attachments</th><th>QA</th><th>RCA</th><th>RAG</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><button className="report-row-button" onClick={() => onSelectRow(row)} type="button"><strong>{row.requirement}</strong><small>{row.client} · {row.registrationUnit}</small></button></td><td>{row.period}<small>{row.dateLabel}</small></td><td>{reportGroupValue(row, filters.groupBy)}</td><td>{row.lifecycle}</td><td>{row.filing}<small>{row.acceptance}</small></td><td>{row.payment}</td><td>{row.attachments}</td><td>{taxTeamQAStatusLabels[row.qaStatus]}</td><td>{taxTeamRCAStatusLabels[row.rcaStatus]}</td><td><StatusLabel status={row.status} /></td></tr>)}</tbody></table></div>}</section>;
}

export default function TaxTeamReportPage({ initialView = "overview" }: { initialView?: TaxTeamView }) {
  const { prototypeMode } = useWorkflow();
  const initialReportType = initialView === "monthly" || initialView === "qa" || initialView === "rca" || initialView === "audit"
    ? initialView
    : defaultTaxTeamReportFilters.reportType;
  const [filters, setFilters] = useState<TaxTeamReportFilters>(() => ({
    ...defaultTaxTeamReportFilters,
    reportType: initialReportType,
  }));
  const [activeView, setActiveView] = useState<TaxTeamView>(initialView);
  const [selectedRow, setSelectedRow] = useState<TaxTeamReportRow | null>(null);
  const [selectedReview, setSelectedReview] = useState<TaxTeamTransactionReview | null>(null);
  const [transactionReviews, setTransactionReviews] = useState<TaxTeamTransactionReview[]>(() => prototypeMode ? getTaxTeamTransactionReviews() : []);
  const [liveRows, setLiveRows] = useState<TaxTeamReportRow[]>([]);
  const [reviewError, setReviewError] = useState<string | null>(null);
  useEffect(() => {
    if (prototypeMode) return;
    let cancelled = false;
    fetch("/api/work", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { data?: Parameters<typeof liveWorkToTaxTeamReportRow>[0][] };
        if (!response.ok) throw new Error("Unable to load generated compliance work.");
        if (!cancelled) setLiveRows((payload.data ?? []).map(liveWorkToTaxTeamReportRow));
      })
      .catch(() => { if (!cancelled) setLiveRows([]); });
    return () => { cancelled = true; };
  }, [prototypeMode]);
  const allRows = useMemo(() => prototypeMode ? getTaxTeamReportRows() : liveRows, [liveRows, prototypeMode]);
  const filteredRows = useMemo(() => filterTaxTeamReportRows(allRows, filters), [allRows, filters]);
  const filteredTransactionReviews = useMemo(() => filterTaxTeamTransactionReviews(transactionReviews, filters), [transactionReviews, filters]);
  const summary = useMemo(() => summarizeTaxTeamReport(filteredRows), [filteredRows]);
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
  const validRange = validDate(filters.from) && validDate(filters.to) && filters.from <= filters.to;
  const taxReturnColumns = useMemo(() => [...new Set(filteredRows.map((row) => row.requirement))].sort((left, right) => left.localeCompare(right)), [filteredRows]);
  const clientOptions = useMemo(() => [...new Set(allRows.map((row) => row.client))].sort((left, right) => left.localeCompare(right)), [allRows]);
  const pdfHref = useMemo(() => {
    const params = new URLSearchParams({ report: filters.reportType, from: filters.from, to: filters.to, basis: filters.dateBasis, scope: filters.scope, group: filters.groupBy, client: filters.client });
    return `/api/reports/tax-team?${params.toString()}`;
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tax-team/transaction-reviews")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load saved Tax Team reviews.");
        return response.json() as Promise<{ data?: Array<Record<string, unknown>> }>;
      })
      .then((result) => {
        if (cancelled) return;
        const persisted = new Map((result.data ?? []).map((row) => [String(row.review_key), {
          id: String(row.review_key),
          date: String(row.review_date),
          client: String(row.client_label),
          requirement: String(row.requirement_label),
          period: String(row.period_label),
          tower: String(row.tower_label),
          cluster: String(row.cluster_label),
          source: String(row.source_label),
          recordsPulled: Number(row.records_pulled ?? 0),
          reviewStatus: String(row.review_status) as TaxTeamTransactionReview["reviewStatus"],
          completenessChecked: Boolean(row.completeness_checked),
          awarenessChecked: Boolean(row.awareness_checked),
          certifiedBy: typeof row.certified_by === "string" ? row.certified_by : undefined,
          certifiedAt: typeof row.certified_at === "string" ? row.certified_at : undefined,
        }]));
        setTransactionReviews((current) => prototypeMode
          ? current.map((review) => persisted.get(review.id) ?? review)
          : [...persisted.values()]);
      })
      .catch((error: unknown) => {
        if (!prototypeMode) setReviewError(error instanceof Error ? error.message : "Unable to load saved Tax Team reviews.");
      });
    return () => { cancelled = true; };
  }, [prototypeMode]);

  function update<K extends keyof TaxTeamReportFilters>(key: K, value: TaxTeamReportFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function openReport(reportType: TaxTeamReportFilters["reportType"]) {
    update("reportType", reportType);
    setActiveView(reportType);
  }

  async function certifyTransactionReview(reviewId: string, completenessChecked: boolean, awarenessChecked: boolean) {
    if (!completenessChecked || !awarenessChecked) return;
    const review = transactionReviews.find((candidate) => candidate.id === reviewId);
    if (!review) return;
    try {
      const response = await fetch("/api/tax-team/transaction-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review_key: review.id,
          review_date: review.date,
          client_label: review.client,
          requirement_label: review.requirement,
          period_label: review.period,
          tower_label: review.tower,
          cluster_label: review.cluster,
          source_label: review.source,
          records_pulled: review.recordsPulled,
          review_status: "certified",
          completeness_checked: completenessChecked,
          awareness_checked: awarenessChecked,
        }),
      });
      const result = await response.json() as { error?: string; data?: Record<string, unknown> };
      if (!response.ok) throw new Error(result.error ?? "Unable to record Tax Team certification.");
      const saved = result.data;
      setTransactionReviews((current) => current.map((candidate) => candidate.id === reviewId ? {
        ...candidate,
        completenessChecked,
        awarenessChecked,
        reviewStatus: "certified",
        certifiedBy: typeof saved?.certified_by === "string" ? saved.certified_by : "Tax Team",
        certifiedAt: typeof saved?.certified_at === "string" ? saved.certified_at : new Date().toISOString(),
      } : candidate));
      setReviewError(null);
      setSelectedReview(null);
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to record Tax Team certification.");
    }
  }

  function openTransactionReview(review: TaxTeamTransactionReview) {
    const nextReview = review.reviewStatus === "awaiting_review" ? { ...review, reviewStatus: "in_review" as const } : review;
    setTransactionReviews((current) => current.map((currentReview) => currentReview.id === review.id ? nextReview : currentReview));
    setSelectedReview(nextReview);
    setSelectedRow(null);
  }

  return (
    <FixturePageFrame>
      <PageHeader
        title="Tax Team"
        description="Quality and control oversight."
        action={<a className="button button--primary" aria-disabled={!validRange} href={validRange ? pdfHref : undefined}>{filters.reportType === "audit" ? "Download Tax Audit Pack" : "Download PDF report"}</a>}
      />

      <nav aria-label="Tax Team reports" className="tower-tabs module-tabs" role="tablist">
        <button aria-selected={activeView === "overview"} className={activeView === "overview" ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => setActiveView("overview")} role="tab" tabIndex={activeView === "overview" ? 0 : -1} type="button">Overview</button>
        <button aria-selected={activeView === "deadline-control"} className={activeView === "deadline-control" ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => setActiveView("deadline-control")} role="tab" tabIndex={activeView === "deadline-control" ? 0 : -1} type="button">Deadline Control</button>
        <button aria-selected={activeView === "period-locks"} className={activeView === "period-locks" ? "tower-tab tower-tab--active" : "tower-tab"} onClick={() => setActiveView("period-locks")} role="tab" tabIndex={activeView === "period-locks" ? 0 : -1} type="button">Period locks</button>
        {taxTeamReportTypes.map((report) => <button aria-selected={activeView === report.id} className={activeView === report.id ? "tower-tab tower-tab--active" : "tower-tab"} key={report.id} onClick={() => openReport(report.id)} role="tab" tabIndex={activeView === report.id ? 0 : -1} type="button">{report.label}</button>)}
      </nav>

      {activeView === "overview" && <TaxTeamOverview onOpenDeadlineControl={() => setActiveView("deadline-control")} onOpenPeriodLocks={() => setActiveView("period-locks")} onOpenReport={openReport} qaOpenCount={filteredTransactionReviews.filter((review) => review.reviewStatus !== "certified").length} summary={summary} />}
      {activeView === "deadline-control" && <TaxTeamDeadlineControl />}
      {activeView === "period-locks" && <PeriodLocksView />}
      {activeView !== "overview" && activeView !== "deadline-control" && activeView !== "period-locks" && <>
      <section aria-labelledby="tax-team-filters-title" className="panel tax-team-filters">
        <SectionHeading detail={`${reportTitle(filters)} · ${filteredRows.length} matching obligation${filteredRows.length === 1 ? "" : "s"}`} title="Filters" />
        <div className="tax-team-filter-grid">
          <label className="report-filter"><span>From date</span><input aria-label="Report period from" onChange={(event) => update("from", event.target.value)} onInput={(event) => update("from", event.currentTarget.value)} type="date" value={filters.from} /></label>
          <label className="report-filter"><span>To date</span><input aria-label="Report period to" onChange={(event) => update("to", event.target.value)} onInput={(event) => update("to", event.currentTarget.value)} type="date" value={filters.to} /></label>
          <label className="report-filter"><span>Date basis</span><select aria-label="Report date basis" onChange={(event) => update("dateBasis", event.target.value as TaxTeamReportFilters["dateBasis"])} value={filters.dateBasis}>{taxTeamDateBasisOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <ScopeSwitcher value={scopeFilterForValue(filters.scope)} onChange={(value) => update("scope", (scopeValueForFilter(value) ?? "all") as TaxTeamReportFilters["scope"])} />
          <label className="report-filter"><span>Detail grouping</span><select aria-label="Report detail grouping" onChange={(event) => update("groupBy", event.target.value as TaxTeamReportFilters["groupBy"])} value={filters.groupBy}>{taxTeamGroupOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          {filters.reportType === "audit" && <label className="report-filter"><span>Client</span><select aria-label="Tax Audit Pack client" onChange={(event) => update("client", event.target.value)} value={filters.client}><option value="">All clients</option>{clientOptions.map((client) => <option key={client} value={client}>{client}</option>)}</select></label>}
        </div>
        {!validRange && <p className="report-warning" role="alert">Enter valid dates in YYYY-MM-DD format, with the end date on or after the start date.</p>}
        <p className="report-filter-note">Reporting window: <strong>{formatReportDate(filters.from)}</strong> to <strong>{formatReportDate(filters.to)}</strong> · Date basis: <strong>{taxTeamDateBasisOptions.find((option) => option.id === filters.dateBasis)?.label}</strong> · Asia/Manila</p>
      </section>

      {filters.reportType === "monthly" && <>
        <section aria-labelledby="tax-team-summary-title" className="signal-section">
          <SectionHeading detail="Counts are intentionally separated; one state does not imply another." title="Filtered compliance position" />
          <div className="metric-grid tax-team-metrics">
            <MetricCard detail="selected report population" label="Expected" tone="neutral" value={String(summary.expected)} />
            <MetricCard detail="generated work objects" label="Generated" tone="blue" value={String(summary.generated)} />
            <MetricCard detail="reported sent; acceptance not inferred" label="Filed / submitted" tone="blue" value={String(summary.reportedSent)} />
            <MetricCard detail="confirmed acceptance only" label="Accepted" tone="blue" value={String(summary.accepted)} />
            <MetricCard detail="confirmed payment only" label="Paid" tone="blue" value={String(summary.paid)} />
            <MetricCard detail="evidence/control state" label="Control complete" tone={summary.controlComplete === summary.expected && summary.expected > 0 ? "blue" : "red"} value={String(summary.controlComplete)} />
          </div>
        </section>
        <MonthlyStatusReport filters={filters} onSelectRow={setSelectedRow} rows={filteredRows} summary={summary} taxReturnColumns={taxReturnColumns} />
      </>}
      {filters.reportType === "qa" && <QAOverview onSelectReview={openTransactionReview} reviews={filteredTransactionReviews} />}
      {filters.reportType === "rca" && <RCAOverview rows={filteredRows} />}
      {filters.reportType === "audit" && <AuditDetail filters={filters} onSelectRow={setSelectedRow} rows={filteredRows} />}

      <div className="report-footer-note"><span>Report snapshot includes the selected filters and date basis.</span>{filters.reportType === "monthly" && <span>Monthly status is classified only from evidenced filing, payment, and governed deadline dates.</span>}{filters.reportType === "qa" && <span>QA certifies completeness and awareness of the pulled transaction population.</span>}{filters.reportType === "rca" && <span>RCA is opened only for an authorized material, repeated, systemic, or explicitly requested cause investigation.</span>}</div>
      </>}

      {selectedRow && <DetailDrawer eyebrow="Tax Team report detail" title={selectedRow.requirement} subtitle={`${selectedRow.client} · ${selectedRow.period}`} onClose={() => setSelectedRow(null)}><dl className="detail-list"><div><dt>Monthly report status</dt><dd>{taxTeamMonthlyStatusLabels[selectedRow.monthlyStatus]}</dd></div><div><dt>Registration Unit</dt><dd>{selectedRow.registrationUnit}</dd></div><div><dt>Cluster</dt><dd>{selectedRow.cluster}</dd></div><div><dt>Current accountable owner</dt><dd>{selectedRow.owner}</dd></div><div><dt>Lifecycle</dt><dd>{selectedRow.lifecycle}</dd></div><div><dt>Filing / submission</dt><dd>{selectedRow.filing}</dd></div><div><dt>Acceptance</dt><dd>{selectedRow.acceptance}</dd></div><div><dt>Payment</dt><dd>{selectedRow.payment}</dd></div><div><dt>Attachments / other submissions</dt><dd>{selectedRow.attachments}</dd></div><div><dt>Evidence / control</dt><dd>{selectedRow.evidence} · {selectedRow.control}</dd></div><div><dt>QA support check</dt><dd>{taxTeamQAStatusLabels[selectedRow.supportCheck]}</dd></div><div><dt>QA result</dt><dd>{taxTeamQAStatusLabels[selectedRow.qaStatus]} · {selectedRow.qaFinding}</dd></div><div><dt>RCA status</dt><dd>{taxTeamRCAStatusLabels[selectedRow.rcaStatus]}</dd></div><div><dt>Attention context</dt><dd>{selectedRow.attention}</dd></div></dl></DetailDrawer>}
      {reviewError && <div className="form-error" role="alert">{reviewError}</div>}
      {selectedReview && <TransactionReviewDrawer onCertify={(completenessChecked, awarenessChecked) => { void certifyTransactionReview(selectedReview.id, completenessChecked, awarenessChecked); }} onClose={() => setSelectedReview(null)} review={selectedReview} />}
    </FixturePageFrame>
  );
}
