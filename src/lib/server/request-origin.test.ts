import { describe, expect, it } from "vitest";

import { requireSameOrigin } from "./request-origin";

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
});
