import { afterEach, describe, expect, it, vi } from "vitest";

import { applicationOrigin, requireSameOrigin } from "./request-origin";

afterEach(() => vi.unstubAllEnvs());

describe("same-origin mutation guard", () => {
  it("accepts the request origin", () => {
    expect(requireSameOrigin(new Request("https://taxmon.example/api/test", { headers: { origin: "https://taxmon.example" } }))).toBeNull();
  });

  it("rejects missing and foreign origins", async () => {
    const missing = requireSameOrigin(new Request("https://taxmon.example/api/test"));
    const foreign = requireSameOrigin(new Request("https://taxmon.example/api/test", { headers: { origin: "https://evil.example" } }));
    expect(missing?.status).toBe(403);
    expect(foreign?.status).toBe(403);
  });

  it("uses the configured public origin when the runtime URL is internal", () => {
    vi.stubEnv("TAXMON_APP_URL", "https://taxmonweb.vercel.app/");
    expect(applicationOrigin(new Request("http://localhost:3000/api/admin/staff"))).toBe("https://taxmonweb.vercel.app");
  });

  it("uses forwarded deployment headers when no public URL is configured", () => {
    expect(applicationOrigin(new Request("http://localhost:3000/api/admin/staff", {
      headers: { "x-forwarded-host": "taxmonweb.vercel.app", "x-forwarded-proto": "https" },
    }))).toBe("https://taxmonweb.vercel.app");
  });
});
