import { describe, expect, it } from "vitest";

import { primaryNavigation } from "./navigation";

describe("primary navigation", () => {
  it("exposes the five approved workspace areas with navigable paths", () => {
    expect(primaryNavigation.map((item) => item.label)).toEqual([
      "Control Tower",
      "My Work",
      "Clients",
      "Team",
    ]);
    expect(primaryNavigation.every((item) => item.href.startsWith("/app/"))).toBe(true);
  });
});
