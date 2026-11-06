import { expect, test, type Page } from "@playwright/test";

const routes = ["/", "/work", "/colony", "/anay", "/store", "/me", "/rank-up"];

async function openTask(page: Page, id: string) {
  await page.goto(`/work?task=${id}`);
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog");
}

function toast(page: Page) {
  return page.locator(".toast").last();
}

test("every screen renders with no errors and no sideways scroll", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `${route} scrolls sideways`).toBe(false);
  }
  expect(errors).toEqual([]);
});

test("installable: manifest and icons are served", async ({ request }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.short_name).toBe("Antoine");
  expect(manifest.display).toBe("standalone");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  expect((await request.get("/apple-icon.png")).status()).toBe(200);
  expect((await request.get("/icon.svg")).status()).toBe(200);
});

test("the Tower is animated, and holds still for reduced motion", async ({ page, browser }) => {
  await page.goto("/");
  expect(await page.locator("animateMotion").count()).toBeGreaterThan(4);
  const wave = await page.locator(".antoine__wave").first().evaluate((el) => getComputedStyle(el).animationName);
  expect(wave).toBe("wave");
  const calm = await browser.newPage({ reducedMotion: "reduce", viewport: { width: 390, height: 844 } });
  await calm.goto("/");
  expect(await calm.locator("animateMotion").count()).toBe(0);
  expect(await calm.locator(".antoine__wave").first().evaluate((el) => getComputedStyle(el).animationName)).toBe("none");
  await calm.close();
});

test("the Now button opens the most urgent task", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".tabbar__badge")).toHaveText("5");
  await page.locator(".tabbar__now").click();
  await expect(page.getByRole("dialog")).toContainText("Kalye Café");
});

test("filing → acceptance → payment pays XP only on verified facts, and persists", async ({ page }) => {
  let sheet = await openTask(page, "alon");
  await sheet.getByLabel("Filing reference no.").fill("FIL-E2E-1");
  await sheet.getByRole("button", { name: "Record filing", exact: true }).click();
  await expect(page.locator(".toast")).toHaveCount(0); // Submitted ≠ Accepted
  await expect(sheet).toContainText("Waiting for acceptance");

  await sheet.getByLabel("Acknowledgement reference").fill("ACK-E2E-1");
  await sheet.getByRole("button", { name: "Record acceptance", exact: true }).click();
  await expect(toast(page)).toContainText("+60 XP");
  await expect(toast(page)).toContainText("hit on Anay");
  await expect(sheet).toContainText("Not yet · separate step"); // Filed ≠ Paid

  await sheet.getByLabel("Payment confirmation reference").fill("PAY-E2E-1");
  await sheet.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(toast(page)).toContainText("+20 XP");

  await page.goto("/work");
  await expect(page.getByRole("region", { name: "Done this cycle" })).toContainText("Alon Logistics");
  await page.goto("/");
  await expect(page.locator(".boss")).toContainText("19 HP left");
  await page.goto("/me");
  await expect(page.locator("main")).toContainText("2,720");
  await page.reload();
  await expect(page.locator("main")).toContainText("2,720");
  sheet = await openTask(page, "alon");
  await expect(sheet).toContainText("Yes · PAY-E2E-1");
});

test("evidence is required before a step counts", async ({ page }) => {
  const sheet = await openTask(page, "alon");
  await sheet.getByRole("button", { name: "Record filing", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Enter the filing reference number.");
});

test("checking: a return needs a reason; first pass goes to the preparer", async ({ page }) => {
  const sheet = await openTask(page, "sampaguita");
  await sheet.getByRole("button", { name: "Return", exact: true }).click();
  await sheet.getByRole("button", { name: "Send back" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Say what needs fixing.");
  await sheet.getByLabel("What needs fixing?").fill("Totals don't tie to the ledger");
  await sheet.getByRole("button", { name: "Send back" }).click();
  await expect(sheet).toContainText("Preparation · with Jas");

  await sheet.getByRole("button", { name: /Act as Jas/ }).click();
  await sheet.getByRole("button", { name: "Approve check" }).click();
  await expect(toast(page)).toContainText("+15 XP");
  await sheet.getByRole("button", { name: /Act as Nico/ }).click();
  await expect(sheet).toContainText("Client approval");
  // The task was returned once, so nobody earns first pass on it.
  await page.goto("/me");
  await expect(page.locator("main")).toContainText("+15");
});

test("segregation of duties: you can't review work you prepared", async ({ page }) => {
  const sheet = await openTask(page, "bukid");
  await expect(sheet).toContainText("Review · with Nico");
  await expect(sheet.getByRole("button", { name: "Approve review" })).toHaveCount(0);
  await sheet.getByRole("button", { name: /Act as Nico/ }).click();
  await expect(toast(page)).toContainText("+30 XP");
  await expect(toast(page)).toContainText("first pass");
});

test("blockers stop preparation and reward raising them early", async ({ page }) => {
  const sheet = await openTask(page, "tala");
  await expect(sheet.getByRole("button", { name: "Prepared · send for checking" })).toBeVisible();
  await sheet.getByRole("button", { name: /Raise a blocker/ }).click();
  await sheet.getByLabel("What kind?").selectOption("client_data");
  await sheet.getByLabel("What's blocking it?").fill("Waiting for the Q3 ledger");
  await sheet.getByRole("button", { name: "Raise blocker", exact: true }).click();
  await expect(sheet).toContainText("Blocked · Client data not ready");
  await expect(sheet.getByRole("button", { name: "Prepared · send for checking" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Mark blocker resolved" }).click();
  await expect(toast(page)).toContainText("+10 XP");
  await sheet.getByRole("button", { name: "Prepared · send for checking" }).click();
  await expect(sheet).toContainText("Checking · with Jas");
});

test("client approval needs evidence and clears the approval blocker", async ({ page }) => {
  const sheet = await openTask(page, "kalye");
  await expect(sheet).toContainText("Blocked · Waiting on client approval");
  await sheet.getByRole("button", { name: "Record client approval", exact: true }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Attach the client's approval reference.");
  await sheet.getByLabel("Approval evidence").fill("Signed approval PDF");
  await sheet.getByRole("button", { name: "Record client approval", exact: true }).click();
  await expect(sheet).toContainText("Filing · your turn");
  await expect(sheet.locator(".blocker")).toHaveCount(0);
});

test("store: buying spends Ants and unaffordable rewards are refused", async ({ page }) => {
  await page.goto("/store");
  await expect(page.locator(".wallet")).toContainText("2,640");
  await page.getByRole("button", { name: /Streak freeze/ }).click();
  await page.getByRole("button", { name: "Buy for 300 Ants" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to your inventory" })).toBeVisible();
  await page.getByRole("button", { name: "Close" }).first().click();
  await expect(page.locator(".wallet")).toContainText("2,340");
  await page.getByRole("button", { name: /Gift certificate/ }).click();
  await expect(page.getByRole("button", { name: "Not enough Ants yet" })).toBeDisabled();
  await page.reload();
  await expect(page.locator(".wallet")).toContainText("2,340");
});

test("leaderboards switch boards and roles, and pin your row", async ({ page }) => {
  await page.goto("/colony");
  await expect(page.locator(".board")).toContainText("Bea Santos");
  await page.getByRole("button", { name: "Colony Cup" }).click();
  await expect(page.getByRole("button", { name: "Colony Cup" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Hall" }).click();
  await expect(page.locator(".pin")).toContainText("You · Bea Santos");
  await page.getByRole("button", { name: "Elder" }).click();
  await expect(page.locator(".pin")).toContainText("Not on this board yet");
});

test("sample clock: misses land by chain of command, blockers waive them, reset restores", async ({ page }) => {
  await page.goto("/me");
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: /Next working day/ }).click();
  const misses = page.getByRole("heading", { name: /Misses/ }).locator("xpath=ancestor::section");
  await expect(misses).toContainText("Kalye Café");
  await expect(misses).toContainText("Waived: Client owner travelling");
  await expect(misses).not.toContainText("Daan Builders"); // never touched it, never demerited
  await page.goto("/anay");
  await expect(page.locator("main")).toContainText("Heals (late)");
  page.once("dialog", (d) => d.accept());
  await page.goto("/me");
  await page.getByRole("button", { name: "Reset sample" }).click();
  await expect(misses).toContainText("No misses this cycle");
});

test("Anay raid reflects hits from your filings", async ({ page }) => {
  await page.goto("/anay");
  await expect(page.locator("main")).toContainText("of 41 HP");
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "20");
  const sheet = await openTask(page, "mabini");
  await sheet.getByLabel("Acknowledgement reference").fill("ACK-M-1");
  await sheet.getByRole("button", { name: "Record acceptance", exact: true }).click();
  await expect(toast(page)).toContainText("hit on Anay");
  await page.goto("/anay");
  await expect(page.getByRole("meter")).toHaveAttribute("aria-valuenow", "19");
  await expect(page.locator("main")).toContainText("Mabini Retail (sample)");
});

test("rank-up moment renders", async ({ page }) => {
  await page.goto("/rank-up");
  await expect(page.getByRole("heading", { name: /Soldier Ant/ })).toBeVisible();
});
