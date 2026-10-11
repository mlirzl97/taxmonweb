import { describe, expect, it } from "vitest";

import { isAuthorizedPurgeRequest } from "./temporary-document-purge";

describe("temporary document purge authorization", () => {
  it("denies requests when the cron secret is not configured", () => {
    const previous = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    expect(isAuthorizedPurgeRequest(new Request("https://taxmon.example/api/internal/purge-temporary-2303"))).toBe(false);
    if (previous) process.env.CRON_SECRET = previous;
  });

  it("requires the exact bearer secret", () => {
    const previous = process.env.CRON_SECRET;
    process.env.CRON_SECRET = "test-secret";
    expect(isAuthorizedPurgeRequest(new Request("https://taxmon.example/api/internal/purge-temporary-2303", { headers: { authorization: "Bearer wrong" } }))).toBe(false);
    expect(isAuthorizedPurgeRequest(new Request("https://taxmon.example/api/internal/purge-temporary-2303", { headers: { authorization: "Bearer test-secret" } }))).toBe(true);
    if (previous) process.env.CRON_SECRET = previous;
    else delete process.env.CRON_SECRET;
  });
});
