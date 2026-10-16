"use client";

import { useEffect, useState } from "react";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import { fixtureClock, type FixtureClient, type FixtureTaxProfile } from "@/lib/fixtures";
import { getClientServiceCalendarRows, readDeadlinePublicationOverrides, type ClientServiceCalendarRow } from "@/lib/domain/deadline-control";
import { normalizeClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";
import { useWorkflow } from "@/lib/workflow-state";
import { AntMark } from "../brand/ant-mark";
import { SectionHeading } from "./workspace-components";

export type ServiceCalendarRow = {
  activityMonth: string;
  taxableMonth: string;
  taxReturn: string;
  clientProvideDate: string;
  tmfCommitmentDate: string;
  clientApprovalDate: string;
  estimatedFilingDate: string;
  estimatedPaymentDate: string;
  dueDate: string;
};

function serviceCalendarRow(item: ClientServiceCalendarRow): ServiceCalendarRow {
  return {
    activityMonth: item.activityMonth,
    taxableMonth: item.taxablePeriod,
    taxReturn: `${item.formNumber} · ${item.taxCategory}`,
    clientProvideDate: item.clientProvideDate,
    tmfCommitmentDate: item.tmfPackageTarget ?? "Not configured",
    clientApprovalDate: item.clientApprovalDate,
    estimatedFilingDate: item.estimatedFilingDate,
    estimatedPaymentDate: item.estimatedPaymentDate,
    dueDate: item.publishedOperationalDeadline ?? "Not configured",
  };
}

const calendarMonths = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pdfColumns: Array<{ key: keyof ServiceCalendarRow; label: string; width: number }> = [
  { key: "activityMonth", label: "Activity", width: 49 },
  { key: "taxableMonth", label: "Taxable", width: 49 },
  { key: "taxReturn", label: "Tax / return", width: 91 },
  { key: "clientProvideDate", label: "Client provide", width: 59 },
  { key: "tmfCommitmentDate", label: "TMF commit", width: 63 },
  { key: "clientApprovalDate", label: "Client approval", width: 59 },
  { key: "estimatedFilingDate", label: "Est. filing", width: 59 },
  { key: "estimatedPaymentDate", label: "Est. payment", width: 59 },
  { key: "dueDate", label: "Published due", width: 43 },
];

function wrapPdfText(value: string, font: PDFFont, size: number, maxWidth: number) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function activityMonthForPeriod(period: string) {
  const normalized = period.trim().toLowerCase();
  return calendarMonths.find((month) => normalized.startsWith(month.toLowerCase()) || normalized.startsWith(month.slice(0, 3).toLowerCase())) ?? null;
}

function drawPdfAnt(page: PDFPage, x: number, y: number, scale: number, color: ReturnType<typeof rgb>) {
  page.drawEllipse({ color, x: x + scale * 0.25, y: y + scale * 0.24, xScale: scale * 0.22, yScale: scale * 0.16 });
  page.drawEllipse({ color, x: x + scale * 0.55, y: y + scale * 0.43, xScale: scale * 0.16, yScale: scale * 0.16 });
  page.drawEllipse({ color, x: x + scale * 0.78, y: y + scale * 0.68, xScale: scale * 0.12, yScale: scale * 0.12 });
  page.drawLine({ start: { x: x + scale * 0.78, y: y + scale * 0.79 }, end: { x: x + scale * 0.91, y: y + scale }, thickness: scale * 0.045, color });
  page.drawLine({ start: { x: x + scale * 0.82, y: y + scale * 0.8 }, end: { x: x + scale, y: y + scale * 0.83 }, thickness: scale * 0.045, color });
  [[0.34, 0.3, 0.16, 0.04], [0.48, 0.25, 0.43, 0.03], [0.6, 0.32, 0.78, 0.03], [0.16, 0.38, 0.03, 0.22], [0.3, 0.5, 0.17, 0.74], [0.52, 0.5, 0.58, 0.78]].forEach(([x1, y1, x2, y2]) => {
    page.drawLine({ start: { x: x + scale * x1, y: y + scale * y1 }, end: { x: x + scale * x2, y: y + scale * y2 }, thickness: scale * 0.035, color });
  });
}

export function ClientServiceCalendarView({ client, clientName, profile }: { client: FixtureClient; clientName: string; profile?: FixtureTaxProfile }) {
  const { prototypeMode } = useWorkflow();
  const currentYear = Number(fixtureClock.today.slice(0, 4));
  const goLiveYear = profile?.goLiveDate ? Number(profile.goLiveDate.slice(0, 4)) : currentYear;
  const firstYear = Math.min(currentYear, Number.isFinite(goLiveYear) ? goLiveYear : currentYear);
  const years = Array.from({ length: Math.max(2, currentYear - firstYear + 2) }, (_, index) => String(firstYear + index));
  const [year, setYear] = useState(years[0] ?? "2026");
  const [overrides, setOverrides] = useState(() => readDeadlinePublicationOverrides(typeof window === "undefined" ? undefined : window.localStorage));
  useEffect(() => {
    const handleStorage = () => setOverrides(readDeadlinePublicationOverrides(window.localStorage));
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);
  const calendarClient: FixtureClient = profile ? { ...client, entities: client.entities.map((entity, index) => index === 0 ? { ...entity, profile } : entity) } : client;
  const deadlinePolicy = normalizeClientDeadlinePolicy(profile?.deadlinePolicy ?? calendarClient.entities[0]?.profile.deadlinePolicy);
  const configuredReturnCount = calendarClient.entities[0]?.profile.registeredReturnCodes?.length ?? 0;
  const candidateBasis = configuredReturnCount > 0 ? "selected client returns" : "registered tax types awaiting return confirmation";
  const timingLabel = deadlinePolicy.mode === "follow_group" ? "Follows group schedule" : "Client-specific working-day offsets";
  const firstPeriodLabel = profile?.firstPeriodToFile || (profile?.goLiveDate ? `from ${profile.goLiveDate.slice(0, 7)}` : "not configured");
  // The deadline-control read model is still a prototype-only projection until
  // released Supabase calendar entries are available. Never derive production
  // service dates from illustrative fixture rules.
  const { rows, heldRows } = prototypeMode
    ? getClientServiceCalendarRows(calendarClient, Number(year), overrides)
    : { rows: [], heldRows: [] };
  const calendarSections = calendarMonths
    .map((month) => ({ month, rows: rows.filter((item) => activityMonthForPeriod(item.activityMonth) === month) }))
    .filter((section) => section.rows.length > 0);

  async function downloadServiceCalendar() {
    const pdfDocument = await PDFDocument.create();
    const regular = await pdfDocument.embedFont(StandardFonts.Helvetica);
    const bold = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const margin = 32;
    const tableWidth = pdfColumns.reduce((total, column) => total + column.width, 0);
    const bodyFontSize = 6.2;
    const lineHeight = 7.2;
    const rowPadding = 4;
    const brandRed = rgb(0.89, 0.12, 0.14);
    const ink = rgb(0.08, 0.1, 0.13);
    const slate = rgb(0.34, 0.38, 0.43);
    const soft = rgb(0.96, 0.96, 0.94);
    const paleRed = rgb(1, 0.95, 0.95);
    let page = pdfDocument.addPage([pageWidth, pageHeight]);
    let cursorY = pageHeight - margin;

    function drawPageHeader(firstPage = false) {
      page.drawRectangle({ x: 0, y: pageHeight - 9, width: pageWidth, height: 9, color: brandRed });
      const top = pageHeight - margin - 8;
      drawPdfAnt(page, margin, top - 30, 27, brandRed);
      page.drawText("TaxMonWeb", { x: margin + 36, y: top - 9, size: 14, font: bold, color: ink });
      page.drawText("TAX COMPLIANCE CONTROL", { x: margin + 37, y: top - 20, size: 5.6, font: bold, color: slate });
      const title = "SERVICE CALENDAR";
      page.drawText(title, { x: pageWidth - margin - bold.widthOfTextAtSize(title, 10), y: top - 9, size: 10, font: bold, color: brandRed });
      page.drawText(`${year} · annual client schedule`, { x: pageWidth - margin - regular.widthOfTextAtSize(`${year} · annual client schedule`, 6.8), y: top - 21, size: 6.8, font: regular, color: slate });
      page.drawText("Tax Team-published operational deadline projection", { x: pageWidth - margin - regular.widthOfTextAtSize("Tax Team-published operational deadline projection", 5.8), y: top - 31, size: 5.8, font: regular, color: slate });
      page.drawLine({ start: { x: margin, y: top - 43 }, end: { x: pageWidth - margin, y: top - 43 }, thickness: 0.7, color: brandRed });
      const clientLines = wrapPdfText(clientName, bold, 9.5, 315);
      clientLines.slice(0, 2).forEach((line, index) => page.drawText(line, { x: margin, y: top - 58 - index * 11, size: 9.5, font: bold, color: ink }));
      page.drawText("Activity month view · January to December", { x: margin, y: top - 82, size: 6.5, font: regular, color: slate });
      page.drawText("Published dates are the operational dates confirmed by Tax Team. Unresolved candidates are held outside this calendar.", { x: margin, y: top - 94, size: 5.9, font: regular, color: slate });
      page.drawText(`Timing basis: ${timingLabel}. Client milestones do not change the published statutory deadline.`, { x: margin, y: top - 106, size: 5.9, font: regular, color: slate });
      cursorY = top - 120;

      if (firstPage) {
        const boxGap = 7;
        const boxWidth = (tableWidth - boxGap * 2) / 3;
        const boxY = cursorY - 30;
        [
          ["PUBLISHED RETURNS", String(rows.length)],
          ["ACTIVITY MONTHS", String(new Set(rows.map((item) => serviceCalendarRow(item).activityMonth)).size)],
          ["CALENDAR YEAR", year],
        ].forEach(([label, value], index) => {
          const x = margin + index * (boxWidth + boxGap);
          page.drawRectangle({ x, y: boxY, width: boxWidth, height: 30, color: index === 0 ? paleRed : soft, borderColor: rgb(0.88, 0.88, 0.85), borderWidth: 0.4 });
          page.drawText(label, { x: x + 7, y: boxY + 19, size: 5.2, font: bold, color: slate });
          page.drawText(value, { x: x + 7, y: boxY + 7, size: 9, font: bold, color: index === 0 ? brandRed : ink });
        });
        cursorY = boxY - 14;
      }
    }

    function addPage() {
      page = pdfDocument.addPage([pageWidth, pageHeight]);
      drawPageHeader();
      return page;
    }

    function drawTableHeader() {
      const headerHeight = 28;
      page.drawRectangle({ x: margin, y: cursorY - headerHeight, width: tableWidth, height: headerHeight, color: rgb(0.93, 0.93, 0.91) });
      let x = margin;
      for (const column of pdfColumns) {
        const lines = wrapPdfText(column.label, bold, bodyFontSize, column.width - 8);
        lines.forEach((line, index) => page.drawText(line, { x: x + 4, y: cursorY - 9 - index * lineHeight, size: bodyFontSize, font: bold, color: ink }));
        page.drawLine({ start: { x, y: cursorY }, end: { x, y: cursorY - headerHeight }, thickness: 0.35, color: rgb(0.76, 0.76, 0.73) });
        x += column.width;
      }
      page.drawLine({ start: { x: margin + tableWidth, y: cursorY }, end: { x: margin + tableWidth, y: cursorY - headerHeight }, thickness: 0.35, color: rgb(0.76, 0.76, 0.73) });
      cursorY -= headerHeight;
    }

    function drawMonthHeading(month: string, continued = false) {
      const heading = continued ? `${month} · continued` : month;
      page.drawRectangle({ x: margin, y: cursorY - 18, width: tableWidth, height: 18, color: ink });
      page.drawRectangle({ x: margin, y: cursorY - 18, width: 5, height: 18, color: brandRed });
      page.drawText(heading, { x: margin + 12, y: cursorY - 12, size: 7.4, font: bold, color: rgb(1, 1, 1) });
      cursorY -= 18;
    }

    drawPageHeader(true);

    function drawMonthSection(month: string, monthRows: typeof rows, continued = false) {
      if (cursorY < margin + 54) {
        addPage();
      }
      drawMonthHeading(month, continued);

      if (monthRows.length === 0) {
        page.drawText("No published returns for this month.", { x: margin + 8, y: cursorY - 12, size: 6.5, font: regular, color: slate });
        cursorY -= 23;
        return;
      }

      drawTableHeader();
      for (const item of monthRows) {
        const row = serviceCalendarRow(item);
        const wrapped = pdfColumns.map((column) => wrapPdfText(row[column.key], regular, bodyFontSize, column.width - 8));
        const rowHeight = Math.max(20, Math.max(...wrapped.map((lines) => lines.length)) * lineHeight + rowPadding * 2);

        if (cursorY - rowHeight < margin + 22) {
          addPage();
          drawMonthHeading(month, true);
          drawTableHeader();
        }

        page.drawRectangle({ x: margin, y: cursorY - rowHeight, width: tableWidth, height: rowHeight, color: rowHeight % 2 === 0 ? rgb(1, 1, 1) : rgb(0.985, 0.985, 0.98), borderColor: rgb(0.81, 0.82, 0.8), borderWidth: 0.35 });
        let x = margin;
        wrapped.forEach((lines, columnIndex) => {
          lines.forEach((line, lineIndex) => page.drawText(line, { x: x + 4, y: cursorY - rowPadding - bodyFontSize - lineIndex * lineHeight, size: bodyFontSize, font: columnIndex === 2 ? bold : regular, color: ink }));
          page.drawLine({ start: { x, y: cursorY }, end: { x, y: cursorY - rowHeight }, thickness: 0.25, color: rgb(0.86, 0.86, 0.84) });
          x += pdfColumns[columnIndex].width;
        });
        page.drawLine({ start: { x: margin + tableWidth, y: cursorY }, end: { x: margin + tableWidth, y: cursorY - rowHeight }, thickness: 0.25, color: rgb(0.86, 0.86, 0.84) });
        cursorY -= rowHeight;
      }
      cursorY -= 8;
    }

    for (const section of calendarSections) {
      drawMonthSection(section.month, section.rows);
    }
    if (calendarSections.length === 0) {
      page.drawText(`No published returns for ${year}.`, { x: margin + 8, y: cursorY - 12, size: 6.5, font: regular, color: slate });
    }

    pdfDocument.getPages().forEach((pdfPage, index) => {
      pdfPage.drawLine({ start: { x: margin, y: 27 }, end: { x: pageWidth - margin, y: 27 }, thickness: 0.4, color: rgb(0.82, 0.82, 0.79) });
      pdfPage.drawText("Prototype · Sanitized data · Tax Team-published deadlines only", { x: margin, y: 16, size: 5.8, font: regular, color: slate });
      const pageLabel = `Page ${index + 1} of ${pdfDocument.getPageCount()}`;
      pdfPage.drawText(pageLabel, { x: pageWidth - margin - regular.widthOfTextAtSize(pageLabel, 5.8), y: 16, size: 5.8, font: regular, color: slate });
    });

    const pdfBytes = await pdfDocument.save();
    const url = URL.createObjectURL(new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `service-calendar-${client.id}-${year}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <div className="service-calendar-print-document" id="client-service-calendar-print">
    <header className="module-header client-service-calendar-header">
      <div className="service-calendar-heading"><div className="service-calendar-brand"><AntMark size={38} /><div><strong>TaxMon<span>Web</span></strong><small>Tax Compliance Control</small></div></div><div><p className="eyebrow">Client · yearly working view</p><h2>Service calendar</h2><p className="module-header__description">{clientName} · only Tax Team-published operational deadlines appear here.</p><p className="service-calendar-policy-note"><strong>First period to file:</strong> {firstPeriodLabel}. <strong>Timing basis:</strong> {timingLabel}. This changes service milestones, not the published statutory deadline.</p></div></div>
      <div className="module-header__right"><div className="module-count"><strong>{rows.length}</strong><small>published rows · {year}</small></div><button className="button button--quiet button--small service-calendar-print-action" onClick={() => window.print()} type="button">Print A4</button><button className="button button--primary button--small" onClick={() => void downloadServiceCalendar()} type="button">Download PDF</button></div>
    </header>
    <div className="service-calendar-print-summary" aria-label="Service calendar summary"><div><span>Published returns</span><strong>{rows.length}</strong></div><div><span>Activity months</span><strong>{new Set(rows.map((item) => serviceCalendarRow(item).activityMonth)).size}</strong></div><div><span>Calendar year</span><strong>{year}</strong></div></div>
    <section aria-label="Service calendar year" className="registry-toolbar"><div className="registry-toolbar__filters"><label className="select-control"><span>Year</span><select aria-label="Year" onChange={(event) => setYear(event.target.value)} value={year}>{years.map((option) => <option key={option}>{option}</option>)}</select></label></div></section>
    {heldRows.length > 0 && <section aria-labelledby="service-calendar-gate-title" className="panel service-calendar-gate"><SectionHeading title="Selected returns awaiting due-date release" detail="These returns came from onboarding. They are connected to the client, but no operational date is shown until the governing deadline is approved and published." /><p id="service-calendar-gate-title">{heldRows.length} return period{heldRows.length === 1 ? " is" : "s are"} held outside the operational calendar. Once Tax Team publishes the deadline rule, the due date and service milestones will appear here automatically.</p><ul>{[...new Set(heldRows.map((row) => `${row.formNumber} · ${row.publicationStatus === "unresolved" ? "deadline unresolved" : "Tax Team review required"}`))].map((label) => <li key={label}>{label}</li>)}</ul><a className="button button--quiet button--small" href="/app/tax-team?view=deadline-control">Open Tax Team Deadline Control</a></section>}
    <section aria-labelledby="service-calendar-table-title" className="panel panel--table registry-panel"><SectionHeading title={`${rows.length} published service calendar row${rows.length === 1 ? "" : "s"}`} detail={`Only released operational dates are shown · candidate basis: ${candidateBasis}.`} /><div className="service-calendar-table-wrap">{!prototypeMode && <div className="inline-empty"><strong>No released service calendar</strong><br />Tax Team has not released operational dates for this client yet.</div>}{prototypeMode && <><table className="service-calendar-table"><thead><tr><th>Activity month</th><th>Taxable month</th><th>Tax / return</th><th>Due date client should provide</th><th>Committed date for client submission (TMF)</th><th>Approval date (client)</th><th>Estimated date for filing</th><th>Estimated date for payment</th><th>Published operational deadline</th></tr></thead><tbody>{calendarSections.flatMap((section) => [<tr className="service-calendar-month-row" key={`month-${section.month}`}><th colSpan={9}>{section.month}</th></tr>, ...section.rows.map((item) => { const row = serviceCalendarRow(item); return <tr key={item.id}><td data-label="Activity month">{row.activityMonth}</td><td data-label="Taxable month">{row.taxableMonth}</td><td data-label="Tax / return"><strong>{row.taxReturn}</strong></td><td data-label="Due date client should provide">{row.clientProvideDate}</td><td data-label="Committed date for client submission (TMF)">{row.tmfCommitmentDate}</td><td data-label="Approval date (client)">{row.clientApprovalDate}</td><td data-label="Estimated date for filing">{row.estimatedFilingDate}</td><td data-label="Estimated date for payment">{row.estimatedPaymentDate}</td><td data-label="Published operational deadline">{row.dueDate}</td></tr>; })])}</tbody></table>{rows.length === 0 && <div className="inline-empty">No Tax Team-published service calendar rows are available for this client in {year}.</div>}</>}</div></section>
    <div className="service-calendar-print-sections">{calendarSections.map((section) => <section className="service-calendar-print-section" key={`print-${section.month}`}><h3>{section.month}</h3><table className="service-calendar-print-table"><thead><tr><th>Activity</th><th>Taxable</th><th>Tax / return</th><th>Client provide</th><th>TMF commit</th><th>Client approval</th><th>Est. filing</th><th>Est. payment</th><th>Published due</th></tr></thead><tbody>{section.rows.map((item) => { const row = serviceCalendarRow(item); return <tr key={item.id}><td>{row.activityMonth}</td><td>{row.taxableMonth}</td><td><strong>{row.taxReturn}</strong></td><td>{row.clientProvideDate}</td><td>{row.tmfCommitmentDate}</td><td>{row.clientApprovalDate}</td><td>{row.estimatedFilingDate}</td><td>{row.estimatedPaymentDate}</td><td>{row.dueDate}</td></tr>; })}</tbody></table></section>)}{calendarSections.length === 0 && <div className="inline-empty">No published returns for {year}.</div>}</div>
    <div className="service-calendar-print-footer">Prototype · Sanitized data · Tax Team-published deadlines only</div>
  </div>;
}
