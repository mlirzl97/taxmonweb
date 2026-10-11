import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { NextRequest } from "next/server";

import { filterTaxTeamReportRows, filterTaxTeamTransactionReviews, formatReportDate, getTaxTeamReportRows, getTaxTeamTransactionReviews, reportGroupValue, summarizeTaxTeamReport, taxTeamDateBasisOptions, taxTeamGroupOptions, taxTeamMonthlyStatusLabels, taxTeamMonthlyStatusOptions, taxTeamRCAStatusLabels, taxTeamReportTypes, taxTeamTransactionReviewStatusLabels, type TaxTeamDateBasis, type TaxTeamGroupBy, type TaxTeamReportType, type TaxTeamScope, type TaxTeamTransactionReview } from "@/lib/domain/tax-team-reports";
import { scopeValueForFilter } from "@/lib/control-tower-state";
import { getAuthorizedControlTowerScope } from "@/lib/server/authorized-scope";
import { fixtureOrganizationScopes } from "@/lib/domain/organization-catalog";
import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { createSupabaseServerClient, getAuthenticatedUser } from "@/lib/supabase/server";
import { listPersistedTaxTeamReviews } from "@/lib/server/tax-team-review-repository";
import { listLiveGeneratedWork } from "@/lib/server/generated-work-repository";
import { adaptLiveGeneratedWork } from "@/lib/domain/live-work-adapter";
import { liveWorkToTaxTeamReportRow } from "@/lib/domain/live-tax-team-adapter";

export const dynamic = "force-dynamic";

const scopes: readonly TaxTeamScope[] = ["all", ...fixtureOrganizationScopes.map((scope) => scope.tower)];
const reportTypes: readonly TaxTeamReportType[] = ["monthly", "qa", "rca", "audit"];
const dateBases: readonly TaxTeamDateBasis[] = ["milestone", "compliance_period"];
const groupBys: readonly TaxTeamGroupBy[] = ["tower", "cluster", "owner", "client", "requirement"];

function isDate(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function parseReportParams(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const report = params.get("report");
  const from = params.get("from");
  const to = params.get("to");
  const basis = params.get("basis");
  const scope = params.get("scope");
  const group = params.get("group");
  if (!reportTypes.includes(report as TaxTeamReportType) || !isDate(from) || !isDate(to) || !dateBases.includes(basis as TaxTeamDateBasis) || !scopes.includes(scope as TaxTeamScope) || !groupBys.includes(group as TaxTeamGroupBy)) return null;
  if (from > to) return null;
  return { report: report as TaxTeamReportType, from, to, dateBasis: basis as TaxTeamDateBasis, scope: scope as TaxTeamScope, groupBy: group as TaxTeamGroupBy };
}

async function authorizeReport(scope: TaxTeamScope) {
  if (isPrototypeDemoMode()) return { ok: true as const, actor: "Master Admin" };
  const user = await getAuthenticatedUser();
  const client = await createSupabaseServerClient();
  if (!user || !client) return { ok: false as const, status: 401, message: "Authentication is required." };

  const today = new Date().toISOString().slice(0, 10);
  const { data: capabilities, error } = await client
    .from("user_capability_assignments")
    .select("capability_key, effective_from, effective_to")
    .eq("user_id", user.id)
    .lte("effective_from", today)
    .or(`effective_to.is.null,effective_to.gte.${today}`);
  if (error) return { ok: false as const, status: 503, message: "Unable to verify Tax Team authority." };
  const canView = (capabilities ?? []).some((assignment) => ["ViewTaxControlHistory", "ValidateTaxProfile"].includes(assignment.capability_key));
  if (!canView) return { ok: false as const, status: 403, message: "Tax Team reporting requires an authorized tax-control capability." };

  const authorizedScope = await getAuthorizedControlTowerScope();
  if (!authorizedScope) return { ok: false as const, status: 403, message: "An unambiguous Tax Team reporting scope is required." };
  if (authorizedScope !== "all" && (scope === "all" || scope !== scopeValueForFilter(authorizedScope))) return { ok: false as const, status: 403, message: "The requested report scope is outside your authorized portfolio." };
  return { ok: true as const, actor: user.email ?? "Authenticated user" };
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawReportPdf(params: NonNullable<ReturnType<typeof parseReportParams>>, rows: ReturnType<typeof getTaxTeamReportRows>, transactionReviews: readonly TaxTeamTransactionReview[], actor: string) {
  return PDFDocument.create().then(async (document) => {
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const pages: PDFPage[] = [];
    let page = document.addPage([842, 595]);
    pages.push(page);
    let y = 555;
    const margin = 34;
    const ink = rgb(0.12, 0.12, 0.12);
    const muted = rgb(0.35, 0.39, 0.42);
    const red = rgb(0.89, 0.12, 0.14);
    const pale = rgb(0.97, 0.98, 0.98);
    const title = taxTeamReportTypes.find((item) => item.id === params.report)?.label ?? "Tax Team report";
    const basis = taxTeamDateBasisOptions.find((item) => item.id === params.dateBasis)?.label ?? params.dateBasis;
    const group = taxTeamGroupOptions.find((item) => item.id === params.groupBy)?.label ?? params.groupBy;
    const summary = summarizeTaxTeamReport(rows);

    const newPage = () => { page = document.addPage([842, 595]); pages.push(page); y = 555; };
    const ensure = (height: number) => { if (y - height < 32) newPage(); };
    const text = (value: string, x: number, size = 9, font = regular, color = ink) => page.drawText(value, { x, y, size, font, color });
    const line = (height = 14) => { y -= height; };
    const section = (label: string) => { ensure(24); text(label, margin, 12, bold, ink); y -= 18; page.drawLine({ start: { x: margin, y }, end: { x: 808, y }, thickness: 0.6, color: rgb(0.87, 0.88, 0.89) }); y -= 13; };

    text("TaxMonWeb · Tax Team", margin, 9, bold, red);
    y -= 24;
    text(title, margin, 23, bold, ink);
    y -= 28;
    for (const metadata of [
      `Reporting window: ${formatReportDate(params.from)} to ${formatReportDate(params.to)}`,
      `Date basis: ${basis} · Scope: ${params.scope === "all" ? "All A&T" : params.scope} · Detail grouping: ${group}`,
      `Generated: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} Asia/Manila · Actor: ${actor}`,
    ]) { text(metadata, margin, 9, regular, muted); line(14); }
    y -= 8;

    section(params.report === "monthly" ? "Filtered compliance position" : params.report === "qa" ? "QA coverage overview" : params.report === "rca" ? "RCA overview" : "Audit population");
    const qaConfigured = transactionReviews.some((review) => review.reviewStatus === "certified" || review.reviewStatus === "follow_up");
    const rcaConfigured = rows.some((row) => row.rcaStatus !== "not_configured");
    const cards: [string, string | number][] = params.report === "monthly"
      ? [["Expected", summary.expected], ["Generated", summary.generated], ["Filed / submitted", summary.reportedSent], ["Accepted", summary.accepted], ["Paid", summary.paid], ["Control complete", summary.controlComplete]]
      : params.report === "qa"
        ? [["Pulled", transactionReviews.length], ["Certified", transactionReviews.filter((review) => review.reviewStatus === "certified").length], ["To review", transactionReviews.filter((review) => review.reviewStatus !== "certified").length], ["Follow-up", transactionReviews.filter((review) => review.reviewStatus === "follow_up").length]]
        : params.report === "rca"
          ? [["Population", rows.length], ["RCA candidates", rcaConfigured ? rows.filter((row) => row.rcaStatus === "candidate").length : "Not configured"], ["Open RCA cases", rcaConfigured ? rows.filter((row) => row.rcaStatus === "open").length : "Not configured"], ["Closed RCA cases", rcaConfigured ? rows.filter((row) => row.rcaStatus === "closed").length : "Not configured"]]
          : [["Population", rows.length], ["QA", qaConfigured ? "Configured" : "Not configured"], ["RCA", rcaConfigured ? "Configured" : "Not configured"]];
    const cardWidth = 120;
    cards.forEach(([label, value], index) => {
      const x = margin + index * (cardWidth + 8);
      page.drawRectangle({ x, y: y - 44, width: cardWidth, height: 44, color: pale, borderColor: rgb(0.86, 0.88, 0.89), borderWidth: 0.6 });
      page.drawText(String(label), { x: x + 8, y: y - 16, size: 8, font: regular, color: muted });
      page.drawText(String(value), { x: x + 8, y: y - 35, size: 16, font: bold, color: ink });
    });
    y -= 64;

    const drawUnderlyingDetail = () => {
      section(params.report === "audit" ? "Audit detail" : "Underlying obligation detail");
      const columns = [
        ["Status", 34, 130], ["Requirement / client", 164, 168], ["Period", 332, 70], ["Group", 402, 78], ["Lifecycle", 480, 82], ["Filing", 562, 72], ["Payment", 634, 76], ["Control", 710, 98],
      ] as const;
      const headerY = y;
      columns.forEach(([label, x]) => page.drawText(label, { x, y: headerY, size: 7, font: bold, color: muted }));
      y -= 14;
      for (const row of rows) {
        const values = [taxTeamMonthlyStatusLabels[row.monthlyStatus], row.requirement, row.period, reportGroupValue(row, params.groupBy), row.lifecycle, row.filing, row.payment, row.control];
        const wrappedValues = values.map((value, index) => wrapText(index === 1 ? `${value} · ${row.client}` : value, regular, 7, columns[index][2] - 6).slice(0, 2));
        const rowHeight = Math.max(18, ...wrappedValues.map((lines) => lines.length * 9 + 2));
        ensure(rowHeight + 8);
        wrappedValues.forEach((lines, index) => {
          const [, x] = columns[index];
          lines.forEach((lineValue, lineIndex) => page.drawText(lineValue, { x, y: y - lineIndex * 9, size: 7, font: index === 1 ? bold : regular, color: ink }));
        });
        y -= rowHeight;
        page.drawLine({ start: { x: margin, y }, end: { x: 808, y }, thickness: 0.35, color: rgb(0.9, 0.9, 0.9) });
        y -= 7;
      }
    };

    if (params.report === "monthly") {
      section("Monthly status report");
      const taxReturns = [...new Set(rows.map((row) => row.requirement))].sort((left, right) => left.localeCompare(right));
      if (!taxReturns.length) {
        text("No validated records match the selected report definition.", margin, 9, regular, muted);
        line(18);
      } else {
        const statusColumnWidth = 184;
        const taxReturnColumnWidth = (808 - margin - statusColumnWidth) / taxReturns.length;
        const matrixHeaderY = y;
        page.drawText("Status", { x: margin, y: matrixHeaderY, size: 7, font: bold, color: muted });
        taxReturns.forEach((taxReturn, index) => {
          const x = margin + statusColumnWidth + index * taxReturnColumnWidth;
          wrapText(taxReturn, bold, 7, taxReturnColumnWidth - 8).slice(0, 2).forEach((lineValue, lineIndex) => page.drawText(lineValue, { x, y: matrixHeaderY - lineIndex * 8, size: 7, font: bold, color: muted }));
        });
        y -= 18;
        taxTeamMonthlyStatusOptions.forEach(({ id, label }) => {
          const labelLines = wrapText(label, regular, 8, statusColumnWidth - 8).slice(0, 2);
          const rowHeight = Math.max(18, labelLines.length * 9 + 2);
          ensure(rowHeight + 8);
          labelLines.forEach((lineValue, lineIndex) => page.drawText(lineValue, { x: margin, y: y - lineIndex * 9, size: 8, font: regular, color: id === "unresolved" ? rgb(0.45, 0.28, 0.06) : ink }));
          taxReturns.forEach((taxReturn, index) => {
            const x = margin + statusColumnWidth + index * taxReturnColumnWidth;
            const count = rows.filter((row) => row.monthlyStatus === id && row.requirement === taxReturn).length;
            const value = String(count);
            page.drawText(value, { x: x + (taxReturnColumnWidth - bold.widthOfTextAtSize(value, 8)) / 2, y, size: 8, font: bold, color: ink });
          });
          y -= rowHeight;
          page.drawLine({ start: { x: margin, y }, end: { x: 808, y }, thickness: 0.35, color: rgb(0.9, 0.9, 0.9) });
          y -= 7;
        });
      }
      drawUnderlyingDetail();
    } else if (params.report === "qa") {
      section("Pulled transaction register");
      const columns = [["Taxpayer", 34, 190], ["Return / period", 224, 130], ["Source", 354, 130], ["Records", 484, 72], ["Review", 556, 120], ["Certified", 676, 132]] as const;
      const headerY = y;
      columns.forEach(([label, x]) => page.drawText(label, { x, y: headerY, size: 7, font: bold, color: muted }));
      y -= 14;
      transactionReviews.forEach((review) => {
        const values = [review.client, `${review.requirement} · ${review.period}`, `${review.source} · ${review.date}`, String(review.recordsPulled), taxTeamTransactionReviewStatusLabels[review.reviewStatus], review.certifiedBy ? `${review.certifiedBy} · ${review.certifiedAt ?? ""}` : "Not yet certified"];
        const wrappedValues = values.map((value, index) => wrapText(value, regular, 7, columns[index][2] - 6).slice(0, 2));
        const rowHeight = Math.max(18, ...wrappedValues.map((lines) => lines.length * 9 + 2));
        ensure(rowHeight + 8);
        wrappedValues.forEach((lines, index) => { const [, x] = columns[index]; lines.forEach((lineValue, lineIndex) => page.drawText(lineValue, { x, y: y - lineIndex * 9, size: 7, font: index === 0 ? bold : regular, color: ink })); });
        y -= rowHeight; page.drawLine({ start: { x: margin, y }, end: { x: 808, y }, thickness: 0.35, color: rgb(0.9, 0.9, 0.9) }); y -= 7;
      });
      if (!transactionReviews.length) { text("No pulled transaction groups match the selected report definition.", margin, 9, regular, muted); line(18); }
    } else if (params.report === "rca") {
      section("RCA decision rules");
      for (const note of ["Repeated similar QA findings may become an RCA candidate.", "Material control failure or systemic cause may require an authorized RCA case.", "An isolated QA correction does not automatically create an RCA incident.", "RCA eligibility remains unresolved until approved QA facts are configured."]) { for (const wrapped of wrapText(`• ${note}`, regular, 8, 760)) { text(wrapped, margin, 8, regular, muted); line(11); } }
      section("RCA register");
      const rcaRows = rows.filter((row) => row.rcaStatus === "candidate" || row.rcaStatus === "open");
      if (!rcaRows.length) { text(rcaConfigured ? "No RCA cases in the selected population." : "RCA tracking is not configured for this sanitized fixture.", margin, 9, regular, muted); line(18); }
      else { rcaRows.forEach((row) => { text(`${row.requirement} · ${row.client}`, margin, 8, bold, ink); line(12); text(`${row.qaFinding} · ${taxTeamRCAStatusLabels[row.rcaStatus]}`, margin, 8, regular, muted); line(16); }); }
    } else {
      drawUnderlyingDetail();
    }

    ensure(42);
    y -= 4;
    text("Control notes", margin, 10, bold, ink); y -= 15;
    for (const note of [
      "Filed/submitted is not treated as accepted, paid, evidenced, or control complete.",
      "Unknown, unresolved, and not-configured values remain visible; no tax fact is inferred from an empty field.",
      "This PDF is a filtered snapshot of the TaxMonWeb read model, not a separate source of truth.",
    ]) { for (const wrapped of wrapText(`• ${note}`, regular, 8, 760)) { text(wrapped, margin, 8, regular, muted); line(11); } }

    pages.forEach((currentPage, index) => currentPage.drawText(`TaxMonWeb · Tax Team report · Page ${index + 1} of ${pages.length}`, { x: margin, y: 16, size: 7, font: regular, color: muted }));
    return document.save();
  });
}

export async function GET(request: NextRequest) {
  const params = parseReportParams(request);
  if (!params) return new Response("Invalid report filters.", { status: 400 });
  const authorization = await authorizeReport(params.scope);
  if (!authorization.ok) return new Response(authorization.message, { status: authorization.status });

  let rows: ReturnType<typeof getTaxTeamReportRows> = [];
  let transactionReviews: TaxTeamTransactionReview[] = [];
  if (isPrototypeDemoMode()) {
    rows = filterTaxTeamReportRows(getTaxTeamReportRows(), { from: params.from, to: params.to, dateBasis: params.dateBasis, scope: params.scope });
    transactionReviews = filterTaxTeamTransactionReviews(getTaxTeamTransactionReviews(), { from: params.from, to: params.to, scope: params.scope });
  } else {
    try {
      const liveWork = await listLiveGeneratedWork();
      const userIds = [...new Set(liveWork.flatMap((record) => [record.preparer_user_id, record.checker_user_id, record.reviewer_user_id, record.current_owner_user_id]).filter((id): id is string => Boolean(id)))];
      const { data: users, error: usersError } = userIds.length > 0
        ? await (await createSupabaseServerClient())!.from("app_users").select("id, display_name").in("id", userIds)
        : { data: [], error: null };
      if (usersError) throw new Error(`Unable to load work owners: ${usersError.message}`);
      const names = new Map((users ?? []).map((user) => [user.id, user.display_name]));
      rows = filterTaxTeamReportRows(liveWork.map((record) => liveWorkToTaxTeamReportRow(adaptLiveGeneratedWork(record, names))), { from: params.from, to: params.to, dateBasis: params.dateBasis, scope: params.scope });
      transactionReviews = filterTaxTeamTransactionReviews((await listPersistedTaxTeamReviews()).map((review) => ({
        id: review.review_key,
        date: review.review_date,
        client: review.client_label,
        requirement: review.requirement_label,
        period: review.period_label,
        tower: review.tower_label,
        cluster: review.cluster_label,
        source: review.source_label,
        recordsPulled: review.records_pulled,
        reviewStatus: review.review_status,
        completenessChecked: review.completeness_checked,
        awarenessChecked: review.awareness_checked,
        ...(review.certified_by ? { certifiedBy: review.certified_by } : {}),
        ...(review.certified_at ? { certifiedAt: review.certified_at } : {}),
      })), { from: params.from, to: params.to, scope: params.scope });
    } catch (error) {
      return new Response(error instanceof Error ? error.message : "Unable to load the persisted Tax Team review population.", { status: 503 });
    }
  }
  const bytes = await drawReportPdf(params, rows, transactionReviews, authorization.actor);
  const client = await createSupabaseServerClient();
  if (client && !isPrototypeDemoMode()) {
    await client.rpc("append_audit_event", {
      p_action: "report.downloaded",
      p_entity_type: "tax_team_report",
      p_entity_id: `${params.report}:${params.from}:${params.to}:${params.scope}:${params.groupBy}`,
      p_summary: `Downloaded ${params.report} Tax Team report for ${params.from} to ${params.to}.`,
      p_after_state: { ...params, row_count: rows.length },
      p_reason: "Authorized report download",
    });
  }

  return new Response(Buffer.from(bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="tax-team-${params.from}-to-${params.to}.pdf"`,
      "Content-Type": "application/pdf",
    },
  });
}
