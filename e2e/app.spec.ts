import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openCurrentCertification(page: Page) {
  const action = page.getByRole("button", { name: /^(Complete preparation|Open gate|Change Endorse payment status)$/ }).first();
  await expect(action).toBeVisible();
  const label = await action.getAttribute("aria-label");
  await action.click();
  if (label === "Change Endorse payment status") await expect(page.getByRole("heading", { name: "Update process status" })).toBeVisible();
  else await expect(page.getByRole("heading", { name: /Preparer to draft return|Checker certification|Reviewer certification/ })).toBeVisible();
  return label;
}

test("primary routes and Control Tower context are reachable", async ({ page }) => {
  await page.goto("/app/control-tower");
  test.skip((await page.evaluate(() => window.innerWidth)) <= 500, "desktop route traversal runs in the desktop project");
  await expect(page.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Due Register", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Calendar", exact: true })).toHaveCount(0);

  if (await page.evaluate(() => window.innerWidth <= 500)) await page.getByRole("button", { name: "Open modules" }).click();
  await page.getByRole("link", { name: "Clients", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/clients$/);
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

  if (await page.evaluate(() => window.innerWidth <= 500)) await page.getByRole("button", { name: "Open modules" }).click();
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/team$/);
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Race to All Clear", exact: true })).toHaveCount(0);
});

test("action bell surfaces pending work from the current Work register", async ({ page }) => {
  await page.goto("/app/work?queue=all");
  await expect(page.getByRole("heading", { name: "Work", exact: true })).toBeVisible();
  const bell = page.locator(".app-main-header__notifications-trigger");
  await expect(bell).toHaveAttribute("aria-label", /pending action/);
  await expect(bell).toBeVisible();
  await bell.click({ force: true });
  await expect(page.getByRole("region", { name: "My actions" })).toBeVisible();
  await expect(page.getByRole("link", { name: "View Work", exact: true })).toHaveAttribute("href", "/app/work?queue=all");
});

test("action bell can clear the current tray without changing work", async ({ page }) => {
  await page.goto("/app/work?queue=all");
  const bell = page.locator(".app-main-header__notifications-trigger");
  await bell.click({ force: true });
  const tray = page.getByRole("region", { name: "My actions" });
  await expect(tray).toBeVisible();
  await expect(tray.getByRole("button", { name: "Clear pending actions" })).toBeEnabled();
  await tray.getByRole("button", { name: "Clear pending actions" }).click();
  await expect(tray.getByText("No pending actions.", { exact: true })).toBeVisible();
  await expect(bell).toHaveAttribute("aria-label", "No pending actions");
  await expect(page.getByRole("link", { name: "View Work", exact: true })).toHaveAttribute("href", "/app/work?queue=all");
});

test("modules menu exposes settings and notification tray dismisses outside", async ({ page }) => {
  await page.goto("/app/control-tower");
  await expect(page.locator(".app-main-header").getByRole("link", { name: "TaxMonWeb Control Tower", exact: true })).toHaveCount(0);
  await expect(page.locator(".app-main-header").getByText("Control Tower", { exact: true })).toHaveCount(0);
  if (await page.evaluate(() => window.innerWidth <= 500)) {
    await page.evaluate(() => window.localStorage.setItem("taxmonweb.sidebar.collapsed", "true"));
    await page.reload();
    await page.getByRole("button", { name: "Open modules" }).click();
    await expect(page.getByRole("complementary", { name: "Application navigation" }).getByRole("link", { name: "TaxMonWeb Control Tower", exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: "Settings & preferences", exact: true })).toHaveAttribute("href", "/app/admin?view=settings");
  if (await page.evaluate(() => window.innerWidth <= 500)) {
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Open modules" })).toBeVisible();
  }

  const bell = page.locator(".app-main-header__notifications-trigger");
  await bell.click({ force: true });
  await expect(page.getByRole("region", { name: "My actions" })).toBeVisible();
  await page.mouse.click(8, 180);
  await expect(page.getByRole("region", { name: "My actions" })).toHaveCount(0);
});

test("unauthenticated API reads remain denied even in prototype UI mode", async ({ request }) => {
  for (const path of ["/api/portfolio", "/api/team", "/api/tax-team/transaction-reviews", "/api/clients/fixture-client-03/service-calendar?year=2026"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(401);
  }
});

test("CRF repository applies authorized client scope and repository filters", async ({ page }) => {
  await page.goto("/app/clients?view=crfs");
  await expect(page.getByRole("heading", { name: "CRF repository", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "CRF scope" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "CRF cluster" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "CRF owner" })).toBeVisible();

  const count = page.locator("header.module-header .module-count strong").last();
  const allScopeCount = await count.innerText();
  await page.getByRole("combobox", { name: "CRF scope" }).selectOption("tower-a");
  await expect(count).not.toHaveText(allScopeCount);

  await expect(page.locator("header.module-header .module-count small").last()).toHaveText("Authorized CRF records · CRF v1");
  await expect(count).toHaveText(/\d+$/);
  await expect(page.getByRole("img", { name: "Current user" })).toContainText("Super Admin");
});

test("Team directory preserves its URL view under Super Admin mode", async ({ page }) => {
  await page.goto("/app/team?view=directory");
  await expect(page.getByRole("tab", { name: "Directory", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Directory", exact: true })).toBeVisible();
  const fullRoster = await page.locator(".team-directory tbody tr").count();
  expect(fullRoster).toBe(70);

  await expect(page.getByRole("img", { name: "Current user" })).toContainText("Super Admin");
  await expect(page.getByRole("button", { name: "Edit", exact: true }).first()).toBeVisible();
});

test("BIR Center remains a read-only governed reference", async ({ page }) => {
  await page.goto("/app/bir-center");
  await expect(page.getByRole("heading", { name: "BIR Center", exact: true })).toBeVisible();
  await expect(page.locator("#main-content").getByText("Governed reference", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Propose reference update", exact: true })).toHaveCount(0);
  const taxMapTab = page.getByRole("tab", { name: "Tax map", exact: true });
  await expect(taxMapTab).toHaveAttribute("aria-selected", "true");
  await taxMapTab.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "BIR directory", exact: true })).toBeFocused();
  await page.getByRole("tab", { name: "Regulatory updates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Regulatory updates", exact: true })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "Regulatory updates" }).getByText("No published updates", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Propose reference update", exact: true })).toHaveCount(0);
});

test("Tax Team reports preserve period scope and produce a PDF snapshot", async ({ page }) => {
  await page.goto("/app/tax-team");
  await expect(page.getByRole("heading", { name: "Tax Team", exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "Monthly compliance", exact: true }).click();
  const fromDate = page.locator('input[aria-label="Report period from"]');
  const toDate = page.locator('input[aria-label="Report period to"]');
  await fromDate.fill("2026-10-06");
  await fromDate.press("Tab");
  await expect(fromDate).toHaveValue("2026-10-06");
  await toDate.fill("2026-10-09");
  await toDate.press("Tab");
  await expect(toDate).toHaveValue("2026-10-09");
  await expect(page.locator(".report-filter-note")).toContainText("Oct 6, 2026 to Oct 9, 2026");
  await expect(page.getByRole("heading", { name: "Monthly status report" })).toBeVisible();
  const statusMatrix = page.locator(".report-status-matrix");
  if (await statusMatrix.count()) {
    await expect(statusMatrix.getByRole("columnheader", { name: "Status" })).toBeVisible();
  } else {
    await expect(page.getByText("No validated records match this report definition.", { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Population breakdown" })).toHaveCount(0);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF report", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tax-team-2026-10-06-to-2026-10-09.pdf");

  await page.getByRole("tab", { name: "QA", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Transaction review" })).toBeVisible();
  await expect(page.getByText("Awaiting review", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pulled transaction register" })).toBeVisible();

  await page.getByRole("tab", { name: "RCA", exact: true }).click();
  await expect(page.getByRole("heading", { name: "RCA overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "RCA register" })).toBeVisible();
  await expect(page.getByText("ordinary QA corrections stay in QA", { exact: false })).toBeVisible();

  await page.getByRole("tab", { name: "Deadline Control", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Deadline Control", exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Deadline calendar year" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Deadline return filter" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Deadline period filed filter" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Earliest due date" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Internal target" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
  const publishedRow = page.locator(".deadline-control-table tbody tr").filter({ hasText: "Published" }).first();
  await expect(publishedRow).toBeVisible();
  await publishedRow.locator(".report-row-button").click();
  const publishedDeadline = page.getByRole("dialog", { name: /Published/ });
  await expect(publishedDeadline).toBeVisible();
  await expect(publishedDeadline.getByRole("button", { name: "Save and publish", exact: true })).toHaveCount(0);
  await expect(publishedDeadline.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await expect(publishedDeadline.getByLabel("Statutory due date")).toBeDisabled();
  await publishedDeadline.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/app/tax-team?view=deadline-control");
  await expect(page.getByRole("heading", { name: "Deadline Control", exact: true })).toBeVisible();
});

test("calendar date selection preserves a shareable date and opens due context", async ({ page }) => {
  await page.goto("/app/work?view=calendar");
  const markedDate = page.locator(".calendar-day__date").filter({ hasText: "5" }).first();
  await markedDate.click();
  await expect(page).toHaveURL(/\/app\/work\?view=calendar&date=2026-10-05/);
  await expect(page.getByRole("heading", { name: "Due register" })).toBeVisible();
  await expect(page.getByText("Due 2026-10-05", { exact: true })).toBeVisible();
});

test("Work follows the Due Register into step-by-step execution detail", async ({ page }) => {
  await page.goto("/app/work");
  await expect(page.getByRole("heading", { name: "Work register" })).toBeVisible();
  await expect(page.locator(".filter-tabs .filter-tab--active").first()).toHaveText(/Needs attention/);
  await expect(page.getByRole("button", { name: /All work/ })).toHaveCount(0);
  const harborlineRow = page.locator(".work-register__row").filter({ hasText: "Harborline Services" }).first();
  await expect(harborlineRow).toContainText("WHT 1601EQ");
  await harborlineRow.click();
  await expect(page.getByText("Return package", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Role certification gate" })).toHaveCount(0);
  await expect(page.locator(".work-journey-table")).toBeVisible();
  await expect(page.getByRole("button", { name: /^(Complete preparation|Open gate|Change Endorse payment status)$/ }).first()).toBeVisible();
  await expect(page.locator(".work-journey-table")).toBeVisible();
  await expect(page.locator(".work-journey-table__row").filter({ hasText: "Attachments" }).filter({ hasText: "Not started" }).first()).toBeVisible();
  await expect(page.locator(".work-journey-table__row").filter({ hasText: "Process payment and retain proof" }).first()).toBeVisible();
  await expect(page.locator(".work-journey-table__row").filter({ hasText: "Archive the return package" }).first()).toBeVisible();
  await expect(page.locator(".work-journey-table__row").filter({ hasText: "Draft return" }).filter({ hasText: "Complete" }).first()).toBeVisible();
  await expect(page.getByText("Return calculation", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("File return and retain FRN status")).toBeVisible();
  await expect(page.getByText("Return package", { exact: true })).toBeVisible();
  await page.goto("/app/work/work-02");
  await expect(page).toHaveURL(/\/app\/work\/work-02$/);
  await expect(page.locator(".work-journey-table")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Independent evidence control" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Close return journey" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Period locks" })).toHaveCount(0);
  await page.getByRole("link", { name: "Close return journey" }).press("Enter");
  await expect(page).toHaveURL(/\/app\/work$/);
  await page.locator(".work-register__row").filter({ hasText: "Harborline Services" }).first().click();
  await expect(page.getByRole("heading", { name: "Harborline Services" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("Return package", { exact: true })).toHaveCount(0);
});

test("period locks live in Tax Team and are separate from the return package", async ({ page }) => {
  await page.goto("/app/tax-team");
  await page.getByRole("tab", { name: "Period locks", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Period locks" })).toBeVisible();
  await expect(page.getByText("Tax Team control", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Lock / }).first()).toBeVisible();
  await page.goto("/app/work/work-02");
  await expect(page.getByRole("heading", { name: "Period locks" })).toHaveCount(0);
});

test("the accountable persona can open the current certification gate", async ({ page }) => {
  await page.goto("/app/work/work-02");
  const label = await openCurrentCertification(page);
  if (label === "Change Endorse payment status") await expect(page.getByRole("combobox", { name: "Process status" })).toHaveValue("IN_PROGRESS");
  else await expect(page.getByRole("checkbox").first()).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("a return with no payment skips the payment process bundle", async ({ page }) => {
  await page.goto("/app/work");
  await page.locator(".work-register__row").filter({ hasText: "Lakeshore Apparel Services" }).first().click();
  await expect(page.getByRole("list", { name: "Return journey status" })).toContainText(/Payment\s*Not applicable/);
  await expect(page.locator(".work-journey-table__bundle").filter({ hasText: "Payment" })).toHaveCount(0);
});

test("current certification opens a scoped dialog", async ({ page }) => {
  await page.goto("/app/work/work-02");
  const label = await openCurrentCertification(page);
  if (label === "Change Endorse payment status") await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeDisabled();
  else await expect(page.getByRole("button", { name: "Certify as Complete", exact: true })).toBeDisabled();
});

test("recording the current operational step keeps the calendar operational", async ({ page }) => {
  await page.goto("/app/work/work-02");
  await openCurrentCertification(page);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.goto("/app/work?view=calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
});

test("prototype exposes one Super Admin operating mode", async ({ page }) => {
  await page.goto("/app/work");
  await expect(page.getByRole("combobox", { name: "Access view persona" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: "Current user" })).toContainText("Super Admin");
  await expect(page.getByRole("link", { name: "Tax Team", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin", exact: true })).toBeVisible();
  await page.goto("/app/admin?view=access");
  await expect(page.getByRole("heading", { name: "Super Admin mode", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Users & access", exact: true })).toHaveCount(0);
});

test("global search opens from the header and routes to matching records", async ({ page }) => {
  await page.goto("/app/control-tower");
  await page.getByRole("button", { name: "Search TaxMonWeb", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Search clients and work" })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "Search clients and work" });
  await search.fill("Harborline");
  await expect(page.getByRole("button", { name: /Harborline Services/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Harborline Services/ }).first().click();
  await expect(page).toHaveURL(/\/app\/clients\/fixture-client-/);
});

test("client overview opens the exact next work item", async ({ page }) => {
  await page.goto("/app/clients/fixture-client-01");
  await expect(page.getByRole("heading", { name: "At a glance", exact: true })).toBeVisible();
  await expect(page.getByText("Current stage", { exact: true })).toBeVisible();
  await expect(page.getByText("Client approval", { exact: true })).toBeVisible();
  await expect(page.getByText("Latest activity", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open return", exact: true })).toHaveAttribute("href", "/app/work/work-01");
  await page.getByRole("link", { name: "Open return", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/work\/work-01$/);
  await expect(page.getByRole("link", { name: "Close return journey", exact: true })).toBeVisible();
});

test("the current gate stays directly operable in Super Admin mode", async ({ page }) => {
  await page.goto("/app/work/work-03");
  await page.getByRole("button", { name: "Open gate", exact: true }).click();
  await expect(page.getByRole("button", { name: "Switch to Checker view" })).toHaveCount(0);
  await expect(page.getByRole("checkbox").first()).toBeEnabled();
  await page.getByRole("button", { name: "Close certification checklist", exact: true }).click();
});

test("Super Admin can open every work scope without a persona switch", async ({ page }) => {
  await page.goto("/app/work?queue=all");
  await expect(page.getByRole("img", { name: "Current user" })).toContainText("Super Admin");
  await expect(page.locator(".work-register__row").filter({ hasText: "Cedarfield Holdings" }).first()).toBeVisible();
  await expect(page.locator(".work-register__row").filter({ hasText: "Harborline Services" }).first()).toBeVisible();
});

test("a role gate records the decision and advances the derived next gate", async ({ page }) => {
  await page.goto("/app/work");
  await page.goto("/app/work/work-03");
  await page.getByRole("button", { name: "Open gate", exact: true }).click();
  await expect(page.locator(".workflow-gate-panel__state").filter({ hasText: "Waiting for Checker" })).toBeVisible();
  const questions = page.locator(".workflow-question");
  await questions.nth(0).click();
  await expect(questions.nth(0)).toContainText(/Done/);
  await page.reload();
  await page.getByRole("button", { name: "Open gate", exact: true }).click();
  await expect(page.locator(".workflow-question").nth(0)).toContainText(/Done/);
  const reopenedQuestions = page.locator(".workflow-question");
  for (let index = 1; index < await reopenedQuestions.count(); index += 1) await reopenedQuestions.nth(index).click();
  await page.getByRole("spinbutton", { name: "Tax due amount" }).fill("0");
  await page.getByRole("textbox", { name: "Decision note" }).fill("Checked source support, mapping, reconciliation, and completeness.");
  await expect(page.getByRole("button", { name: "Certify as Complete", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Certify as Complete", exact: true }).click();
  await page.getByRole("button", { name: "Open gate", exact: true }).click();
  await expect(page.locator(".workflow-gate-panel__state").filter({ hasText: "Waiting for Reviewer" })).toBeVisible();
});

test("Work register keeps generated work read-only", async ({ page }) => {
  await page.goto("/app/work");
  await expect(page.getByRole("button", { name: "+ Add work", exact: true })).toHaveCount(0);
  await page.locator(".work-register__row").first().click();
  await expect(page.getByText("Work register controls", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit record" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Remove record" })).toHaveCount(0);
});

test("mobile navigation has a real drawer interaction and no horizontal overflow", async ({ page }) => {
  await page.goto("/app/control-tower");
  test.skip((await page.evaluate(() => window.innerWidth)) > 500, "mobile interaction runs in the mobile project");
  const toggle = page.getByRole("button", { name: "Open modules" });
  await toggle.click();
  await expect(page.getByRole("link", { name: "Clients" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Open modules" })).toBeFocused();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport + 1);
});

test("critical shell passes an accessibility smoke audit", async ({ page }) => {
  await page.goto("/app/control-tower");
  await page.locator("main h1").waitFor({ state: "visible" });
  const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
  expect(results.violations).toEqual([]);
});

test("primary screens pass an accessibility smoke audit", async ({ page }) => {
  // Eight route navigations plus axe evaluation can exceed the default 30s on
  // a cold Next dev server, especially in the mobile project. Keep the test
  // strict while avoiding a false failure caused by test-server startup cost.
  test.setTimeout(120_000);
  for (const route of [
    "/app/control-tower",
    "/app/team",
    "/app/clients",
    "/app/clients/fixture-client-01",
    "/app/work",
    "/app/work/work-02",
    "/app/work?view=calendar",
    "/app/bir-center",
    "/app/admin",
    "/app/tax-team",
  ]) {
    await page.goto(route);
    await page.getByRole("heading", { level: 1 }).first().waitFor({ state: "visible" });
    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test("calibration Super Admin can edit and reload a sanitized client profile", async ({ page }) => {
  await page.goto("/app/clients/fixture-client-01");
  await expect(page.getByRole("img", { name: "Current user" })).toContainText("Super Admin");
  await page.getByRole("tab", { name: "Registration", exact: true }).click();
  const editRegistration = page.getByRole("button", { name: "Edit registration facts" });
  await editRegistration.scrollIntoViewIfNeeded();
  await editRegistration.click({ force: true });
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("RDO").selectOption("Needs review");
  await drawer.getByLabel("Reason for change").fill("Calibration review of sanitized profile");
  const saveRegistration = drawer.getByRole("button", { name: "Save registration facts" });
  await saveRegistration.focus();
  await saveRegistration.press("Enter");
  await expect(page.getByRole("status")).toContainText("Saved for this sanitized calibration browser");
  await expect(page.getByText("Needs review", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Needs review", { exact: true }).first()).toBeVisible();
});

test("client overview Attention opens the first resolvable control", async ({ page }) => {
  await page.goto("/app/clients/fixture-client-06#client-overview");
  const attention = page.getByRole("button", { name: /Attention: \d+ items requiring action/ });
  await expect(attention).toBeVisible();
  await attention.click();
  await expect(page).toHaveURL(/\/app\/clients\/fixture-client-06#client-team$/);
  const setupDrawer = page.getByRole("dialog");
  await expect(setupDrawer.getByRole("heading", { name: "Edit operating setup" })).toBeVisible();
  await expect(setupDrawer.getByLabel("Preparer")).toBeVisible();
});

test("client required fields are visibly blocked", async ({ page }) => {
  await page.goto("/app/clients");
  await page.getByRole("button", { name: "Start client setup", exact: true }).click();
  const drawer = page.getByRole("dialog");
  for (const label of ["CRM no. / client code", "Client / account name", "Registered taxpayer name", "Go-live date"]) {
    await expect(drawer.getByLabel(label)).toHaveCSS("border-color", "rgb(163, 43, 45)");
  }
  await drawer.locator("button.onboarding-step").nth(1).click();
  for (const label of ["RDO", "Registration reference / OCN", "Registration date", "Tax year basis", "Accounting system", "Books", "Receipts / invoicing", "Filing channel", "Registered address"]) {
    await expect(drawer.getByLabel(label).first()).toHaveCSS("border-color", "rgb(163, 43, 45)");
  }
  await drawer.locator("button.onboarding-step").nth(2).click();
  await expect(drawer.getByLabel("eNATE setup")).toHaveCSS("border-color", "rgb(163, 43, 45)");
  await expect(drawer.getByLabel("Payment route")).toHaveCSS("border-color", "rgb(163, 43, 45)");
  await drawer.locator("button.onboarding-step").nth(3).click();
  await expect(drawer.getByLabel("Permanent SharePoint file")).toHaveCSS("border-color", "rgb(163, 43, 45)");
  await expect(drawer.locator(".onboarding-document--invalid select").first()).toHaveCSS("border-color", "rgb(163, 43, 45)");
  await drawer.getByLabel("BIR Form 2303 / Certificate of Registration status").selectOption("unknown");
  await expect(drawer.getByLabel("BIR Form 2303 / Certificate of Registration rationale")).toHaveCSS("border-color", "rgb(163, 43, 45)");
});

test("client register exports the current view as CSV", async ({ page }) => {
  await page.goto("/app/clients");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export current client list as CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^taxmon-client-register-\d{4}-\d{2}-\d{2}\.csv$/);
});
