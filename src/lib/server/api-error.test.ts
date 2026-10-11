import { describe, expect, it, vi } from "vitest";

import { apiErrorResponse, inferredApiErrorStatus } from "./api-error";

describe("API error boundary", () => {
  it("returns the safe fallback instead of the repository message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = apiErrorResponse(new Error("relation private_table does not exist"), "Unable to load records.", {
      logContext: "test",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Unable to load records." });
    vi.restoreAllMocks();
  });

  it("keeps authorization and validation status mapping without exposing the cause", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(inferredApiErrorStatus(new Error("not authorized for this client"))).toBe(403);
    expect(inferredApiErrorStatus(new Error("cannot be activated until required fields exist"))).toBe(422);
    expect(inferredApiErrorStatus(new Error("unexpected database failure"))).toBe(500);

    vi.restoreAllMocks();
  });
});
