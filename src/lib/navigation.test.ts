import { describe, expect, it } from "vitest";

import { primaryNavigation, restrictedNavigation } from "./navigation";

describe("primary navigation", () => {
  it("exposes the six approved workspace areas with navigable paths", () => {
    expect(primaryNavigation.map((item) => item.label)).toEqual([
      "Control Tower",
      "Team",
      "Clients",
      "Work",
      "BIR Center",
      "Admin",
    ]);
    expect(primaryNavigation.every((item) => item.href.startsWith("/app/"))).toBe(true);
  });

  it("keeps Tax Team as a restricted shell destination", () => {
    expect(restrictedNavigation).toEqual([{ href: "/app/tax-team", label: "Tax Team", icon: "tax" }]);
  });
});
