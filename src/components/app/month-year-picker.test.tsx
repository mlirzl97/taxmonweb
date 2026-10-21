import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MonthYearPicker } from "./month-year-picker";

describe("month-year picker", () => {
  it("renders separate Month and Year selects showing the saved period", () => {
    const html = renderToStaticMarkup(<MonthYearPicker label="First period to file" onChange={() => undefined} value="2026-03" />);
    expect(html).toContain('aria-label="First period to file month"');
    expect(html).toContain('aria-label="First period to file year"');
    expect(html).toMatch(/<option value="03" selected="">March<\/option>/);
    expect(html).toMatch(/<option value="2026" selected="">2026<\/option>/);
    expect(html).not.toContain('type="month"');
  });

  it("does not offer months before the go-live month", () => {
    const html = renderToStaticMarkup(<MonthYearPicker label="First period to file" minMonth="2026-04" onChange={() => undefined} value="2026-05" />);
    expect(html).toMatch(/<option disabled="" value="03">March<\/option>/);
    expect(html).toMatch(/<option value="04">April<\/option>/);
    expect(html).not.toContain('<option value="2025">');
  });
});
