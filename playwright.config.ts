import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3110",
    trace: "on-first-retry",
  },
  webServer: {
    command: "NEXT_DIST_DIR=.next-e2e TAXMON_DEMO_MODE=true TAXMON_DATA_MODE=sanitized npm run dev -- --hostname 127.0.0.1 --port 3110",
    url: "http://127.0.0.1:3110/app/control-tower",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
});
