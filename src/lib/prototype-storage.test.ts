import { describe, expect, it } from "vitest";

import { clearPrototypeSeedData } from "./prototype-storage";

function storage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key) { return values.get(key) ?? null; },
    key(index) { return Array.from(values.keys())[index] ?? null; },
    removeItem(key) { values.delete(key); },
    setItem(key, value) { values.set(key, value); },
  };
}

describe("prototype seed-data reset", () => {
  it("clears only browser-local prototype state", () => {
    const local = storage({
      "taxmonweb.prototype.work-register": "edited",
      "taxmon.client.setup.drafts": "draft",
      "taxmonweb.calibration.tax-profile.fixture-client-01": "profile",
      "taxmonweb.sidebar.collapsed": "true",
      "unrelated.preference": "keep",
    });
    const session = storage({ "taxmonweb.prototype.session": "edited" });

    expect(clearPrototypeSeedData(local, session)).toEqual({ local: 3, session: 1 });
    expect(local.getItem("taxmonweb.prototype.work-register")).toBeNull();
    expect(local.getItem("taxmon.client.setup.drafts")).toBeNull();
    expect(local.getItem("taxmonweb.calibration.tax-profile.fixture-client-01")).toBeNull();
    expect(local.getItem("taxmonweb.sidebar.collapsed")).toBe("true");
    expect(local.getItem("unrelated.preference")).toBe("keep");
    expect(session.getItem("taxmonweb.prototype.session")).toBeNull();
  });
});
