import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("primary routes and Control Tower context are reachable", async ({ page }) => {
  await page.goto("/app/control-tower");
  test.skip((await page.evaluate(() => window.innerWidth)) <= 500, "desktop route traversal runs in the desktop project");
  await expect(page.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();

  await page.getByRole("button", { name: "Due Register", exact: true }).click();
  await expect(page).toHaveURL(/view=due/);
  await expect(page.getByRole("heading", { name: "Due register" })).toBeVisible();

  await page.getByRole("button", { name: "Calendar" }).click();
  await expect(page).toHaveURL(/view=calendar/);
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();

  if (await page.evaluate(() => window.innerWidth <= 500)) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL(/\/app\/clients$/);
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

  if (await page.evaluate(() => window.innerWidth <= 500)) await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Team" }).click();
  await expect(page).toHaveURL(/\/app\/team$/);
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
});

test("calendar date selection preserves a shareable date and opens due context", async ({ page }) => {
  await page.goto("/app/control-tower?view=calendar");
  const markedDate = page.locator(".calendar-day__date").filter({ hasText: "5" }).first();
  await markedDate.click();
  await expect(page).toHaveURL(/date=2026-10-05/);
  await expect(page.getByRole("heading", { name: "Due on 2026-10-05" })).toBeVisible();
});

test("My Work follows the Due Register into step-by-step execution detail", async ({ page }) => {
  await page.goto("/app/my-work");
  await expect(page.getByRole("heading", { name: "Work register" })).toBeVisible();
  await expect(page.getByText("Due Register → Work Register → step-by-step detail")).toBeVisible();
  await page.locator(".work-register__row").filter({ hasText: "Harborline Services" }).click();
  await expect(page.getByRole("heading", { name: "5 of 6 steps recorded" })).toBeVisible();
  await expect(page.getByText("Parallel control facts")).toBeVisible();
  await expect(page.getByText("Reported result is retained; acceptance remains unverified.")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "5 of 6 steps recorded" })).toHaveCount(0);
});

test("mobile navigation has a real drawer interaction and no horizontal overflow", async ({ page }) => {
  await page.goto("/app/control-tower");
  test.skip((await page.evaluate(() => window.innerWidth)) > 500, "mobile interaction runs in the mobile project");
  const toggle = page.getByRole("button", { name: "Open navigation" });
  await toggle.click();
  await expect(page.getByRole("link", { name: "Clients" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("critical shell passes an accessibility smoke audit", async ({ page }) => {
  await page.goto("/app/control-tower");
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(results.violations).toEqual([]);
});

test("calibration Master Admin can edit and reload a sanitized client profile", async ({ page }) => {
  await page.goto("/app/clients/fixture-client-01");
  await expect(page.getByText(/Master Admin/)).toBeVisible();
  await page.getByRole("button", { name: "Edit registration facts" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("RDO / LTS").fill("RDO 000 · calibration");
  await drawer.getByLabel("Reason for change").fill("Calibration review of sanitized profile");
  await drawer.getByRole("button", { name: "Save registration facts" }).click();
  await expect(page.getByRole("status")).toContainText("Saved for this sanitized calibration browser");
  await expect(page.getByText("RDO 000 · calibration", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("RDO 000 · calibration", { exact: true })).toBeVisible();
});
