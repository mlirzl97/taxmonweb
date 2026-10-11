import { describe, expect, it } from "vitest";

import { moduleForUsagePath } from "./usage-analytics";

describe("moduleForUsagePath", () => {
  it("maps work subroutes without exposing record identifiers", () => {
    expect(moduleForUsagePath("/app/work/secret-record-id")).toBe("Work");
  });

  it("maps unknown routes to Other", () => {
    expect(moduleForUsagePath("/login")).toBe("Other");
  });
});
