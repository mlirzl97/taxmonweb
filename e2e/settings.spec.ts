import { test, expect } from "@playwright/test";

test("Settings removes only browser-local prototype data", async ({ page }) => {
  await page.goto("/app/admin");
  await page.evaluate(() => {
    window.localStorage.setItem("taxmonweb.prototype.work-register", "changed");
    window.localStorage.setItem("taxmonweb.sidebar.collapsed", "true");
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("taxmonweb.sidebar.collapsed"))).toBe("true");
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove seed data", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("taxmonweb.prototype.work-register"))).toBeNull();
  await expect(page).toHaveURL(/\/app\/admin$/);
});
