import { test, expect } from "@playwright/test";

test("Settings removes only browser-local prototype data", async ({ page }) => {
  await page.goto("/app/admin");
  await expect(page.getByRole("heading", { name: "Admin", exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.localStorage.setItem("taxmonweb.prototype.work-register", "changed");
    window.localStorage.setItem("taxmonweb.sidebar.collapsed", "true");
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("taxmonweb.sidebar.collapsed"))).toBe("true");
  await page.locator(".tower-tab").filter({ hasText: "Settings" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove seed data", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("taxmonweb.prototype.work-register"))).toBeNull();
  await expect(page).toHaveURL(/\/app\/admin$/);
});

test("Settings persists appearance and profile photo preferences", async ({ page }) => {
  await page.goto("/app/admin");
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account & preferences", exact: true })).toBeVisible();

  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await page.getByLabel("Profile photo", { exact: true }).setInputFiles({ name: "avatar.png", mimeType: "image/png", buffer: Buffer.from("sanitized prototype avatar") });
  await expect(page.getByText("Change photo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove", exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("tab", { name: "Settings", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText("Change photo", { exact: true })).toBeVisible();
});
