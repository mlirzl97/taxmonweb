import type { DeadlineControlRow } from "./deadline-control";

export type WorkGenerationItem = {
  form: string;
  kind: "return" | "proof";
  periodStart: string;
  periodLabel: string;
  dueDate: string;
  calendarEntryId: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Turns the client's projected service-calendar rows into generation items
 * for the returns approved In TMF Scope. A row whose period or date is not
 * known is left out: it stays visible on the calendar as unresolved, and no
 * work is invented for it. The database re-checks every item.
 */
export function workGenerationItems(rows: readonly DeadlineControlRow[], approvedForms: readonly string[]): WorkGenerationItem[] {
  const approved = new Set(approvedForms.map((form) => form.trim().toUpperCase()));
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    const form = row.formNumber.trim().toUpperCase();
    const dueDate = row.publishedOperationalDeadline;
    if (!approved.has(form) || row.publicationStatus !== "published" || !dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return [];
    if (!/^\d{4}-\d{2}-01$/.test(row.periodStartDate)) return [];
    const kind: WorkGenerationItem["kind"] = /proof of filing/i.test(row.activityPeriod) ? "proof" : "return";
    const key = `${form}|${kind}|${row.periodStartDate.slice(0, 7)}`;
    if (seen.has(key)) return [];
    seen.add(key);
    // Family rows carry "<calendar entry id>:<form>"; a TMF-only row has none.
    const entryId = row.id.split(":")[0];
    return [{
      form,
      kind,
      periodStart: row.periodStartDate,
      periodLabel: row.activityPeriod,
      dueDate,
      calendarEntryId: uuidPattern.test(entryId) ? entryId : null,
    }];
  });
}
