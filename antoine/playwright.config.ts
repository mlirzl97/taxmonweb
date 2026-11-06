import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "line",
  use: { baseURL: "http://127.0.0.1:3210", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  webServer: { command: "npx next start -p 3210 -H 127.0.0.1", url: "http://127.0.0.1:3210/", reuseExistingServer: false, timeout: 60_000 },
  projects: [{ name: "phone", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }],
});
