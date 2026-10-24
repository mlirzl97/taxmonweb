"use client";

import { useState } from "react";

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * A month-and-year picker that renders the same in every browser; a native
 * `type="month"` input falls back to free text in some of them. The value is
 * "YYYY-MM", or "" until both parts are chosen.
 */
export function MonthYearPicker({ label, value, onChange, minMonth }: { label: string; value: string; onChange: (value: string) => void; minMonth?: string }) {
  const [selectedYear, setSelectedYear] = useState(() => value.slice(0, 4));
  const [selectedMonth, setSelectedMonth] = useState(() => value.slice(5, 7));
  const [syncedValue, setSyncedValue] = useState(value);
  // A value set from outside (a reload, a reset) replaces a half-made choice.
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (value) {
      setSelectedYear(value.slice(0, 4));
      setSelectedMonth(value.slice(5, 7));
    }
  }

  const currentYear = new Date().getFullYear();
  const minYear = minMonth ? Number(minMonth.slice(0, 4)) : currentYear - 2;
  const firstYear = Math.min(minYear, selectedYear ? Number(selectedYear) : minYear);
  // Offer at least five years past today, the go-live year and any saved year.
  const lastYear = Math.max(currentYear + 5, minYear + 5, selectedYear ? Number(selectedYear) : 0);
  const years = Array.from({ length: lastYear - firstYear + 1 }, (_, index) => String(firstYear + index));
  const isBeforeMin = (year: string, month: string) => Boolean(minMonth && year && `${year}-${month}` < minMonth);

  function choose(year: string, month: string) {
    setSelectedYear(year);
    setSelectedMonth(month);
    const next = year && month ? `${year}-${month}` : "";
    setSyncedValue(next);
    onChange(next);
  }

  return (
    <div className="form-field">
      <span>{label}</span>
      <div className="form-grid form-grid--compact">
        <select aria-label={`${label} month`} onChange={(event) => choose(selectedYear, event.target.value)} value={selectedMonth}>
          <option value="">Month</option>
          {monthNames.map((name, index) => {
            const month = String(index + 1).padStart(2, "0");
            return <option disabled={isBeforeMin(selectedYear, month)} key={month} value={month}>{name}</option>;
          })}
        </select>
        <select aria-label={`${label} year`} onChange={(event) => choose(event.target.value, isBeforeMin(event.target.value, selectedMonth) ? "" : selectedMonth)} value={selectedYear}>
          <option value="">Year</option>
          {years.map((year) => <option key={year} value={year}>{year}</option>)}
        </select>
      </div>
    </div>
  );
}
