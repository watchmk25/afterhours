import { readFile } from "node:fs/promises";
import { test, expect, plan, configure, tabTo, visibleFocus, type Page } from "./club-fixtures";
import type { ClubInput } from "../lib/club-types";

async function download(page: Page, keyboard = false) {
  const pending = page.waitForEvent("download");
  if (keyboard) await page.keyboard.press("Enter");
  else await page.getByRole("button", { name: "Download event plan", exact: true }).click();
  const file = await pending;
  expect(await file.failure()).toBeNull();
  const path = await file.path(); expect(path).not.toBeNull();
  return { name: file.suggestedFilename(), text: await readFile(path!, "utf8") };
}
async function manualBook(page: Page) {
  await page.getByRole("button", { name: "Choose The Guide", exact: true }).click();
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Prepare manual template", exact: true }).click();
  await page.getByRole("button", { name: "Apply proposal", exact: true }).click();
}
async function edit(page: Page) {
  await page.getByLabel("Event title", { exact: true }).fill("Our edited evening — पुस्तक");
  await page.getByLabel("Activity 1 title", { exact: true }).fill("Edited opening");
  await page.getByLabel("Activity 1 minutes", { exact: true }).fill("7");
  await page.getByLabel("Activity 1 instructions", { exact: true }).fill("Ask an optional new question.");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Accessible seating ☕\nKeep this edited note.");
  await page.getByLabel("Materials", { exact: true }).fill("Edited paper and pens");
  await page.getByLabel("Invitation", { exact: true }).fill("Join our edited invitation.");
}
function checkEdited(text: string) {
  for (const expected of ["Our edited evening — पुस्तक", "Edited opening — 7 minutes", "Ask an optional new question.", "Accessible seating ☕\nKeep this edited note.", "Edited paper and pens", "Join our edited invitation.", "Manually edited timings have not been revalidated"]) expect(text).toContain(expected);
}

test("sample fixed template downloads current edits by keyboard without changing state or making API calls", async ({ page }) => {
  let apiCalls = 0; page.on("request", (request) => { if (request.url().includes("/api/")) apiCalls++; });
  await page.goto("/"); await expect(page.getByRole("button", { name: "Download event plan" })).toHaveCount(0);
  await page.getByRole("button", { name: "Try an example", exact: true }).click(); await manualBook(page); await edit(page);
  const button = page.getByRole("button", { name: "Download event plan", exact: true });
  await tabTo(page, button); await visibleFocus(button);
  const file = await download(page, true); checkEdited(file.text);
  expect(file.name).toMatch(/^afterhours-.*\.md$/); expect(file.name).not.toMatch(/[<>:"/\\|?*]/);
  expect(file.text).toContain("The Guide"); expect(file.text).toContain("R. K. Narayan");
  expect(file.text).toContain("Fixed template — not AI-generated"); expect(file.text).toContain("illustrative sample catalogue");
  expect(file.text).not.toContain("## Saved context from Apply");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Our edited evening — पुस्तक");
  await expect(page.locator(".club-selection")).toContainText("The Guide");
  await expect(page.getByRole("button", { name: "Apply proposal" })).toHaveCount(0); expect(apiCalls).toBe(0);
});

test("imported fixed template downloads on a 390px viewport without overflow or provider requests", async ({ page }) => {
  let apiCalls = 0; page.on("request", (request) => { if (request.url().includes("/api/")) apiCalls++; });
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); await configure(page);
  await page.locator("#own-list > summary").click();
  await page.getByLabel("Upload catalogue CSV", { exact: true }).setInputFiles({ name: "inventory.csv", mimeType: "text/csv", buffer: Buffer.from("title,author,price_inr,pages,language,stock\nThe Guide,R. K. Narayan,199,100,English,12\n") });
  await page.getByRole("button", { name: "Confirm import", exact: true }).click(); await manualBook(page); await edit(page);
  const button = page.getByRole("button", { name: "Download event plan", exact: true }); await button.scrollIntoViewIfNeeded(); await expect(button).toBeInViewport();
  const box = await button.boundingBox(); expect(box!.width).toBeGreaterThan(120); expect(box!.x).toBeGreaterThanOrEqual(0); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "artifacts/playwright/event-plan-download-mobile-390.png", fullPage: true });
  const file = await download(page); checkEdited(file.text); expect(file.text).toContain("organizer-imported catalogue");
  expect(file.text).toContain("Fixed template — not AI-generated"); expect(file.text).not.toContain("## Saved context from Apply");
  await expect(page.locator(".club-selection")).toContainText("The Guide"); expect(apiCalls).toBe(0);
});

test("applied AI export separates previous-input evidence from edits and never downloads an unapplied replacement", async ({ page }) => {
  let apiCalls = 0; let sequence = 0;
  page.on("request", (request) => { if (request.url().includes("/api/")) apiCalls++; });
  await page.route("**/api/club/plan", async (route) => {
    const input = route.request().postDataJSON() as ClubInput;
    const proposal = plan(input); proposal.eventTitle = ++sequence === 1 ? "Original applied title" : "UNAPPLIED REPLACEMENT TITLE";
    proposal.discovery.interests = [{ entityId: "confirmed-film", name: "Amélie", kind: "movie", metadata: { year: 2001 }, disambiguation: "2001", reference: { token: "PRIVATE_REFERENCE_NEVER_EXPORT" } }];
    proposal.discovery.coverage = { submitted: 6, resolved: 3, assessed: 3 };
    proposal.warnings = ["Some candidate identities remain unresolved."];
    await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } });
  });
  await page.goto("/"); await page.getByRole("button", { name: "Try an example", exact: true }).click();
  await page.getByRole("button", { name: "Generate event proposal", exact: true }).click();
  await expect(page.getByRole("button", { name: "Download event plan" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: /I understand this is conditional/ }).check(); await page.getByRole("button", { name: "Apply proposal", exact: true }).click(); await edit(page);
  await page.getByText("Budget and relevant constraints (optional)", { exact: true }).click();
  await page.getByLabel("Budget (optional)", { exact: true }).fill("400"); await page.getByLabel("Budget (optional)", { exact: true }).fill("450");
  await expect(page.getByText(/Based on previous inputs/)).toBeVisible();
  await page.getByRole("button", { name: "Generate event proposal", exact: true }).click(); await expect(page.getByText("UNAPPLIED REPLACEMENT TITLE", { exact: true })).toBeVisible();
  const before = apiCalls; const file = await download(page); checkEdited(file.text);
  for (const expected of ["Applied AI proposal (Gemini)", "Historical context — based on previous inputs", "Amélie — movie (2001)", "Budget: INR 450 (per person)", "Maximum pages: 400", "3 of 6 submitted options; 3 identities resolved", "affinity:", "0.6", "Some candidate identities remain unresolved.", "not probabilities"]) expect(file.text).toContain(expected);
  for (const absent of ["Original applied title", "UNAPPLIED REPLACEMENT TITLE", "PRIVATE_REFERENCE_NEVER_EXPORT"]) expect(file.text).not.toContain(absent);
  expect(apiCalls).toBe(before); expect(apiCalls).toBe(2);
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Our edited evening — पुस्तक");
  await expect(page.getByText("UNAPPLIED REPLACEMENT TITLE", { exact: true })).toBeVisible();
  await page.screenshot({ path: "artifacts/playwright/event-plan-download-desktop.png", fullPage: true });
});
