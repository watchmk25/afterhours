import { test, expect, configure, stubPlan, tabTo, visibleFocus } from "./club-fixtures";

test("fresh gathering starts without inventory or provider calls; free-text club identity is unrestricted", async ({ page }) => {
  let calls = 0; page.on("request", (request) => { if (request.url().includes("/api/")) calls++; });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("gather around");
  await expect(page.getByLabel("Club/group description", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Maximum pages (optional)")).toHaveCount(0);
  await expect(page.getByText("The Guide", { exact: true })).toHaveCount(0);
  await configure(page, "artist");
  await expect(page.getByLabel("Club/group description", { exact: true })).toHaveValue("A neighbourhood astronomy and arts collective");
  await expect(page.getByLabel("Maximum pages (optional)")).toHaveCount(0);
  expect(calls).toBe(0);
});

test("Try an example exposes illustrative catalogue and confirmed Example A without requesting providers", async ({ page }) => {
  let calls = 0; page.on("request", (request) => { if (request.url().includes("/api/")) calls++; });
  await page.goto("/"); await page.getByRole("button", { name: "Try an example", exact: true }).click();
  await expect(page.getByRole("list", { name: "Confirmed interests" })).toContainText("Amélie");
  await expect(page.getByRole("list", { name: "Confirmed interests" })).toContainText("Norah Jones");
  await page.getByText("Budget and relevant constraints (optional)", { exact: true }).click();
  await expect(page.getByLabel("Budget (optional)", { exact: true })).toHaveValue("450");
  await expect(page.getByLabel("Maximum pages (optional)", { exact: true })).toHaveValue("400");
  await expect(page.locator("#cultural-options")).toContainText("Illustrative");
  await expect(page.getByRole("button", { name: "Choose The Guide", exact: true })).toBeVisible();
  expect(calls).toBe(0);
});

test("sample stock and constraints filter locally, with honest empty state and invalid numeric feedback", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByText("Budget and relevant constraints (optional)", { exact: true }).click();
  await page.getByLabel("Budget (optional)", { exact: true }).fill("200");
  await page.getByLabel("Maximum pages (optional)", { exact: true }).fill("100");
  await expect(page.locator(".club-resource")).toHaveCount(1);
  await expect(page.locator(".club-resource")).toContainText("The Blue Umbrella");
  await page.getByLabel("Budget (optional)", { exact: true }).fill("100");
  await expect(page.getByText(/No resources meet the current known constraints/)).toBeVisible();
  await page.getByLabel("Budget (optional)", { exact: true }).fill("-1");
  await expect(page.getByRole("button", { name: "Generate event proposal" })).toBeDisabled();
  await page.getByLabel("Budget (optional)", { exact: true }).fill("");
  await expect(page.getByRole("button", { name: "Generate event proposal" })).toBeEnabled();
});

test("manual route is deliberate and local, previews before Apply and retains exact duration", async ({ page }) => {
  let calls = 0; page.on("request", (request) => { if (request.url().includes("/api/")) calls++; });
  await page.goto("/"); await page.getByLabel("Club/group description", { exact: true }).fill("Neighbourhood chess and craft collective");
  await page.getByLabel("Event goal", { exact: true }).fill("Host a chess puzzle and conversation exchange");
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Prepare manual template" }).click();
  await expect(page.getByText("Agenda total: 45 minutes", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Apply proposal" }).click();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Our next gathering");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep this draft");
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption("movie");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep this draft");
  expect(calls).toBe(0);
});

test("Reset asks before destroying dirty edits, retains active sample inventory and clears confirmed inputs", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try an example" }).click();
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Prepare manual template" }).click(); await page.getByRole("button", { name: "Apply proposal" }).click();
  await page.getByLabel("Organizer notes", { exact: true }).fill("An unsaved detail");
  page.once("dialog", (dialog) => dialog.dismiss()); await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("An unsaved detail");
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Confirmed interests" }).locator("li")).toHaveCount(0);
  await expect(page.getByLabel("Club/group description", { exact: true })).toHaveValue("");
  await expect(page.locator(".club-resource")).not.toHaveCount(0);
});

test("real keyboard navigation reaches interests, confirms with Enter, uses Space and edits an applied outline", async ({ page }) => {
  await page.goto("/"); await configure(page); await stubPlan(page);
  const input = page.getByRole("combobox", { name: "Audience interests" });
  await input.blur(); await tabTo(page, input); await visibleFocus(input);
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter");
  await expect(page.getByRole("list", { name: "Confirmed interests" })).toContainText("Norah Jones");
  await tabTo(page, page.getByRole("button", { name: "Generate event proposal" })); await page.keyboard.press("Enter");
  const ack = page.getByRole("checkbox", { name: /I understand this is conditional/ });
  await tabTo(page, ack); await visibleFocus(ack); await page.keyboard.press("Space"); await expect(ack).toBeChecked();
  const apply = page.getByRole("button", { name: "Apply proposal" }); await tabTo(page, apply); await page.keyboard.press("Enter");
  const title = page.getByLabel("Event title", { exact: true }); await tabTo(page, title); await visibleFocus(title);
  await page.keyboard.press("Control+A"); await page.keyboard.type("Keyboard planned gathering"); await expect(title).toHaveValue("Keyboard planned gathering");
  await page.getByRole("link", { name: "Gathering", exact: true }).click(); await expect(page).toHaveURL(/#gathering$/);
  await page.getByRole("link", { name: "Your event", exact: true }).click(); await expect(page).toHaveURL(/#event-outline$/);
});
