import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function applyAccessView(page: Page, persona: string) {
  await page.goto("/app/work");
  const selector = page.getByRole("combobox", { name: "Access view persona" });
  await selector.selectOption(persona);
  const applyButton = page.getByRole("button", { name: /Apply .* access view/ });
  await expect(applyButton).toBeEnabled();
  await applyButton.click();
}

test("primary routes and Control Tower context are reachable", async ({ page }) => {
  await page.goto("/app/control-tower");
  test.skip((await page.evaluate(() => window.innerWidth)) <= 500, "desktop route traversal runs in the desktop project");
  await expect(page.getByRole("heading", { name: "Control Tower" })).toBeVisible();
  await expect(page.getByText("Hello Master Admin", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Due Register", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Calendar", exact: true })).toHaveCount(0);

  if (await page.evaluate(() => window.innerWidth <= 500)) await page.getByRole("button", { name: "Open modules" }).click();
  await page.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL(/\/app\/clients$/);
  await expect(page.getByRole("heading", { name: "Clients" })).toBeVisible();

  if (await page.evaluate(() => window.innerWidth <= 500)) await page.getByRole("button", { name: "Open modules" }).click();
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/team$/);
  await expect(page.getByRole("heading", { name: "Team", exact: true })).toBeVisible();
});

test("unauthenticated API reads remain denied even in prototype UI mode", async ({ request }) => {
  for (const path of ["/api/portfolio", "/api/team", "/api/tax-team/transaction-reviews"]) {
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

  await page.getByRole("combobox", { name: "Access view persona" }).selectOption("PREPARER");
  await page.getByRole("button", { name: /Apply Preparer access view/ }).click();
  await page.goto("/app/clients?view=crfs");
  await expect(page.getByRole("heading", { name: "CRF repository", exact: true })).toBeVisible();
  await expect(page.locator("header.module-header .module-count small").last()).toHaveText("Authorized CRF records · CRF v1");
  await expect(count).toHaveText(/\d+ of \d+/);
});

test("Team directory preserves its URL view and narrows staff people scope", async ({ page }) => {
  await page.goto("/app/team?view=directory");
  await expect(page.getByRole("tab", { name: "Directory", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Directory", exact: true })).toBeVisible();
  const fullRoster = await page.locator(".team-directory tbody tr").count();
  expect(fullRoster).toBe(70);

  await applyAccessView(page, "PREPARER");
  await page.goto("/app/team?view=directory");
  await expect(page.getByRole("tab", { name: "Directory", exact: true })).toHaveAttribute("aria-selected", "true");
  const staffRoster = await page.locator(".team-directory tbody tr").count();
  expect(staffRoster).toBeGreaterThan(0);
  expect(staffRoster).toBeLessThan(fullRoster);
  await expect(page.getByText("Scoped to authorized work", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
});

test("BIR Center remains a read-only governed reference", async ({ page }) => {
  await page.goto("/app/bir-center");
  await expect(page.getByRole("heading", { name: "BIR Center", exact: true })).toBeVisible();
  await expect(page.getByText("Governed reference", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Propose reference update", exact: true })).toHaveCount(0);
  await page.getByRole("tab", { name: "Regulatory updates", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Regulatory updates", exact: true })).toBeVisible();
  await expect(page.getByText("No published updates", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /update|publish|add/i })).toHaveCount(0);
});

test("Tax Team reports preserve period scope and produce a PDF snapshot", async ({ page }) => {
  await applyAccessView(page, "TAX_CONTROL");
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
  await expect(page.getByText("Filed and paid on time", { exact: true })).toBeVisible();
  await expect(page.getByText("Prepared but not yet due", { exact: true })).toBeVisible();
  await expect(page.locator(".report-status-matrix").getByRole("columnheader", { name: "Status" })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Master date rule · earliest applicable deadline" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Earliest applicable" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Published operational due date" })).toBeVisible();
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
  const harborlineRow = page.locator(".work-register__row").filter({ hasText: "Harborline Services" });
  await expect(harborlineRow).toContainText("WHT 1601EQ");
  await expect(harborlineRow).toContainText("QAP sequence included");
  await harborlineRow.click();
  await expect(page.getByRole("heading", { name: "Return journey" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Role certification gate" })).toHaveCount(0);
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(page.getByRole("button", { name: /Filing 5\/5 complete/ })).toBeVisible();
  await expect(page.locator(".work-course-map__body strong").filter({ hasText: "eSubmission" })).toBeVisible();
  await expect(page.locator(".work-course-map__body strong").filter({ hasText: "Process payment and retain proof" })).toBeVisible();
  await expect(page.locator(".work-course-map__body strong").filter({ hasText: "Archive the return package" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Draft return status" })).toHaveValue("DONE");
  await expect(page.getByText("Return calculation", { exact: true })).toHaveCount(0);
  await expect(page.locator(".work-course-map__stage").filter({ hasText: "Draft return" }).getByRole("spinbutton", { name: "Payment amount in Philippine pesos" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "File return and retain FRN status" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark done" })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Endorse payment status" })).toHaveValue("IN_PROGRESS");
  await expect(page.getByRole("combobox", { name: "Endorse payment status" })).toBeEnabled();
  await expect(page.getByRole("heading", { name: "Package progress" })).toBeVisible();
  await page.goto("/app/work/work-02");
  await expect(page).toHaveURL(/\/app\/work\/work-02$/);
  await expect(page.getByText("Submission control", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Independent evidence control" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Close return journey" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Period locks" })).toHaveCount(0);
  await page.getByRole("link", { name: "Close return journey" }).press("Enter");
  await expect(page).toHaveURL(/\/app\/work$/);
  await page.locator(".work-register__row").filter({ hasText: "Harborline Services" }).click();
  await page.getByText("Roles", { exact: true }).click();
  await expect(page.getByText("Preparer", { exact: true }).last()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Return journey" })).toHaveCount(0);
});

test("period locks live in Tax Team and are separate from the return package", async ({ page }) => {
  await applyAccessView(page, "TAX_CONTROL");
  await page.goto("/app/tax-team");
  await page.getByRole("tab", { name: "Period locks", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Period locks" })).toBeVisible();
  await expect(page.getByText("Tax Team control", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lock period" }).first()).toBeDisabled();
  await page.goto("/app/work/work-02");
  await expect(page.getByRole("heading", { name: "Period locks" })).toHaveCount(0);
});

test("the accountable persona can edit the current process status", async ({ page }) => {
  await page.goto("/app/work/work-02");
  const paymentStatus = page.getByRole("combobox", { name: "Endorse payment status" });
  await page.locator("details.workflow-override summary").click();
  await expect(page.getByLabel("Override reason")).toBeVisible();
  await page.getByLabel("Override reason").fill("Master Admin calibration status review");
  await paymentStatus.selectOption("NEEDS_ATTENTION");
  await expect(page.getByRole("status")).toContainText("Saved · Needs attention");
  await page.getByLabel("Override reason").fill("Master Admin calibration status review");
  await page.getByLabel("Endorse payment result or evidence reference").fill("CAL-PAYMENT-001");
  await paymentStatus.selectOption("DONE");
  await expect(page.getByRole("status")).toContainText("Saved · step marked done");
  await expect(page.getByRole("combobox", { name: "Release or approve payment status" })).toHaveValue("IN_PROGRESS");
});

test("a return with no payment skips the payment process bundle", async ({ page }) => {
  await page.goto("/app/work");
  await page.locator(".work-register__row").filter({ hasText: "Lakeshore Apparel Services" }).click();
  await page.getByRole("button", { name: "Expand all" }).click();
  await expect(page.getByRole("button", { name: /^Payment/ })).toHaveCount(0);
  await expect(page.getByText("Payment appears when applicable", { exact: false })).toBeVisible();
});

test("saving a payment amount disables the save action until the draft changes", async ({ page }) => {
  await page.goto("/app/work/work-02");
  const amount = page.getByRole("spinbutton", { name: "Payment amount in Philippine pesos" });
  const saveAmount = page.getByRole("button", { name: "Save amount" });
  await amount.fill("1250");
  await expect(saveAmount).toBeEnabled();
  await saveAmount.click();
  await expect(page.getByRole("status")).toContainText("payment amount recorded");
  await expect(saveAmount).toBeDisabled();
  await amount.fill("1251");
  await expect(saveAmount).toBeEnabled();
});

test("recording the current operational step keeps the calendar operational", async ({ page }) => {
  await page.goto("/app/work/work-02");
  await page.locator("details.workflow-override summary").click();
  await expect(page.getByLabel("Override reason")).toBeVisible();
  await page.getByLabel("Override reason").fill("Master Admin calibration status review");
  await page.getByLabel("Endorse payment result or evidence reference").fill("CAL-PAYMENT-002");
  await page.getByRole("button", { name: "Mark done" }).click();
  await expect(page.getByRole("status")).toContainText("Saved · step marked done");
  await page.getByLabel("Override reason").fill("Master Admin calibration undo review");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toContainText("Saved · returned to the queue");
  await page.goto("/app/work?view=calendar");
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
});

test("RBAC personas expose only the actions they own", async ({ page }) => {
  await page.goto("/app/work");
  const persona = page.getByRole("combobox", { name: "Access view persona" });
  await expect(persona).toHaveValue("MASTER_ADMIN");
  for (const selectedPersona of ["PREPARER", "CHECKER", "REVIEWER", "TAX_CONTROL"] as const) {
    await persona.selectOption(selectedPersona);
    await page.getByRole("button", { name: /Apply .* access view/ }).click();
    if (selectedPersona !== "TAX_CONTROL") {
      await page.goto("/app/control-tower?view=my-run");
      await expect(page.getByRole("heading", { name: "My run", exact: true })).toBeVisible();
      await page.goto("/app/work");
    }
    await expect(page.getByLabel("Current access persona")).toContainText(selectedPersona === "PREPARER" ? "Preparer" : selectedPersona === "CHECKER" ? "Checker" : selectedPersona === "REVIEWER" ? "Reviewer" : "Tax Control");
    await expect(page.locator(".work-register__row").first()).toBeVisible();
    await page.locator(".work-register__row").first().click();
    const markDoneCount = await page.getByRole("button", { name: "Mark done" }).count();
    expect(markDoneCount, selectedPersona).toBe(selectedPersona === "PREPARER" ? 1 : 0);
    await page.getByRole("button", { name: "Close detail panel" }).last().click();
  }
});

test("the current gate offers a direct accountable persona switch", async ({ page }) => {
  await applyAccessView(page, "TAX_CONTROL");
  await page.goto("/app/work/work-03");
  await expect(page.getByRole("button", { name: "Switch to Checker view" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to Checker view" }).click();
  await expect(page.getByRole("heading", { name: "This work item is outside your assigned view" })).toBeVisible();
});

test("management and administration personas keep work accountability separate", async ({ page }) => {
  await page.goto("/app/work");
  const persona = page.getByRole("combobox", { name: "Access view persona" });
  for (const selectedPersona of ["TOWER_LEADER", "CLUSTER_LEADER", "TAX_CONTROL", "MASTER_ADMIN", "SUPER_ADMIN"] as const) {
    await persona.selectOption(selectedPersona);
    await page.getByRole("button", { name: /Apply .* access view/ }).click();
    const scopedClient = selectedPersona === "CLUSTER_LEADER" ? "Cedarfield Holdings" : "Harborline Services";
    await page.locator(".work-register__row").filter({ hasText: scopedClient }).click();
    await expect(page.getByText("Roles", { exact: true })).toBeVisible();
    const markDone = page.getByRole("button", { name: "Mark done" });
    const markDoneCount = await markDone.count();
    expect(markDoneCount, selectedPersona).toBe(selectedPersona === "MASTER_ADMIN" || selectedPersona === "SUPER_ADMIN" ? 1 : 0);
    await page.getByRole("button", { name: "Close detail panel" }).last().click();
  }
});

test("a role gate records the decision and advances the derived next gate", async ({ page }) => {
  await page.goto("/app/work");
  await page.goto("/app/work/work-03");
  await expect(page.getByText("Waiting for Checker")).toBeVisible();
  const questions = page.locator(".workflow-question");
  await questions.nth(0).click();
  await expect(questions.nth(0)).toContainText(/Done/);
  await page.reload();
  await expect(page.locator(".workflow-question").nth(0)).toContainText(/Done/);
  const reopenedQuestions = page.locator(".workflow-question");
  for (let index = 1; index < await reopenedQuestions.count(); index += 1) await reopenedQuestions.nth(index).click();
  await page.getByRole("textbox", { name: "Decision note" }).fill("Checked source support, mapping, reconciliation, and completeness.");
  await page.locator("details.workflow-override summary").click();
  await expect(page.getByLabel("Override reason")).toBeVisible();
  await page.getByLabel("Override reason").fill("Master Admin calibration gate review");
  await page.getByRole("button", { name: "Approve as Checker" }).click({ force: true });
  await expect(page.getByText("Waiting for Reviewer")).toBeVisible();
  await expect(page.getByRole("status").getByText("Checker approval recorded", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Return journey" })).toBeVisible();
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
    await page.locator("main h1").waitFor({ state: "visible" });
    const results = await new AxeBuilder({ page }).disableRules(["color-contrast"]).analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test("calibration Master Admin can edit and reload a sanitized client profile", async ({ page }) => {
  await page.goto("/app/clients/fixture-client-01");
  await expect(page.getByText(/Master Admin/)).toBeVisible();
  await page.getByRole("tab", { name: "Registration", exact: true }).click();
  const editRegistration = page.getByRole("button", { name: "Edit registration facts" });
  await editRegistration.scrollIntoViewIfNeeded();
  await editRegistration.click({ force: true });
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("RDO / LTS").fill("RDO 000 · calibration");
  await drawer.getByLabel("Reason for change").fill("Calibration review of sanitized profile");
  await drawer.getByRole("button", { name: "Save registration facts" }).click();
  await expect(page.getByRole("status")).toContainText("Saved for this sanitized calibration browser");
  await expect(page.getByText("RDO 000 · calibration", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("RDO 000 · calibration", { exact: true })).toBeVisible();
});
