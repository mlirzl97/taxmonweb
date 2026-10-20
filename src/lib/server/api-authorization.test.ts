import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({ value: { client: null as unknown, user: null as unknown } }));

vi.mock("@/lib/supabase/server", () => ({
  getAuthenticatedRequestContext: async () => context.value,
}));

import { requireApiCapabilities, requireApiCapability } from "./api-authorization";

function clientWith(granted: Record<string, { value: boolean; delayMs: number }>) {
  return {
    rpc: (_name: string, args: { required_capability: string }) => {
      const entry = granted[args.required_capability] ?? { value: false, delayMs: 0 };
      return new Promise((resolve) => setTimeout(() => resolve({ data: entry.value, error: null }), entry.delayMs));
    },
  };
}

describe("requireApiCapability", () => {
  beforeEach(() => {
    context.value = { client: null, user: null };
  });

  it("rejects an unauthenticated request", async () => {
    const denied = await requireApiCapability(["ViewScopedPortfolio"]);
    expect(denied?.status).toBe(401);
  });

  it("allows a user who holds any listed capability even when a missing one answers first", async () => {
    context.value = {
      user: { id: "user-1" },
      client: clientWith({
        ReviewTaxProfile: { value: false, delayMs: 0 },
        ViewScopedPortfolio: { value: true, delayMs: 30 },
      }),
    };
    expect(await requireApiCapability(["ReviewTaxProfile", "ViewScopedPortfolio"])).toBeNull();
  });

  it("denies a user who holds none of the listed capabilities", async () => {
    context.value = { user: { id: "user-1" }, client: clientWith({}) };
    const denied = await requireApiCapability(["ViewScopedPortfolio", "MaintainClientRepository"]);
    expect(denied?.status).toBe(403);
  });

  it("treats a capability lookup error as not granted", async () => {
    context.value = {
      user: { id: "user-1" },
      client: { rpc: async () => ({ data: null, error: { message: "boom" } }) },
    };
    expect((await requireApiCapability(["ViewScopedPortfolio"]))?.status).toBe(403);
  });

  it("requires every capability for composite commands", async () => {
    context.value = { user: { id: "user-1" }, client: clientWith({ AdministerUsers: { value: true, delayMs: 0 } }) };
    expect((await requireApiCapabilities(["AdministerUsers", "AdministerOrganization"]))?.status).toBe(403);
  });
});
