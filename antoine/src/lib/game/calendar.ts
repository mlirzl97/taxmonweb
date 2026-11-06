/**
 * Working-day arithmetic for D-1 (decision Follow-up 1 in 08 §2).
 * Weekends are skipped here. Holidays must come from TaxMonWeb's governed
 * holiday master once connected; until then `holidays` is empty and nothing
 * about Philippine holidays is assumed.
 */
export type IsoDate = string; // YYYY-MM-DD

function parse(date: IsoDate): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!));
}

function format(date: Date): IsoDate {
  return date.toISOString().slice(0, 10);
}

export function isWorkingDay(date: IsoDate, holidays: ReadonlySet<IsoDate> = new Set()): boolean {
  const day = parse(date).getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(date);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const next = parse(date);
  next.setUTCDate(next.getUTCDate() + days);
  return format(next);
}

/** The working day `n` working days before `date` (n = 1 gives D-1). */
export function workingDaysBefore(date: IsoDate, n: number, holidays: ReadonlySet<IsoDate> = new Set()): IsoDate {
  let cursor = date;
  let remaining = n;
  while (remaining > 0) {
    cursor = addDays(cursor, -1);
    if (isWorkingDay(cursor, holidays)) remaining -= 1;
  }
  return cursor;
}

/** The next working day after `date`. */
export function nextWorkingDay(date: IsoDate, holidays: ReadonlySet<IsoDate> = new Set()): IsoDate {
  let cursor = addDays(date, 1);
  while (!isWorkingDay(cursor, holidays)) cursor = addDays(cursor, 1);
  return cursor;
}

/** Working days strictly after `from` up to and including `to` (0 if `to` <= `from`). */
export function workingDaysBetween(from: IsoDate, to: IsoDate, holidays: ReadonlySet<IsoDate> = new Set()): number {
  let count = 0;
  let cursor = from;
  while (cursor < to) {
    cursor = addDays(cursor, 1);
    if (isWorkingDay(cursor, holidays)) count += 1;
  }
  return count;
}

const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(date: IsoDate): string {
  const d = parse(date);
  return `${weekday[d.getUTCDay()]} ${d.getUTCDate()} ${month[d.getUTCMonth()]}`;
}
