import { test, expect, configure, stubPlan, candidate, plan } from "./club-fixtures";
import type { Page } from "./club-fixtures";
async function upload(page: Page, text: string) {
  const details = page.locator("#own-list"); if (await details.getAttribute("open") === null) await details.locator("summary").click();
  await page.getByLabel("Upload catalogue CSV", { exact: true }).setInputFiles({ name: "resources.csv", mimeType: "text/csv", buffer: Buffer.from(text, "utf8") });
}

test("original book CSV previews atomically, imports all languages and filters without provider calls", async ({ page }) => {
  let calls = 0; page.on("request", (request) => { if (request.url().includes("/api/")) calls++; });
  await page.goto("/"); await upload(page, "title,author,price_inr,pages,language,stock\r\nLocal One,Author,100,90,Tamil,4\r\nLocal Two,Writer,500,200,English,2\r\nOut of stock,Writer,10,20,Tamil,0\r\n");
  await expect(page.getByRole("heading", { name: "Preview: 3 resources" })).toBeVisible();
  await expect(page.locator(".club-resource")).toHaveCount(0);
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.locator(".club-resource")).toHaveCount(2);
  await page.getByText("Budget and relevant constraints (optional)", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "Tamil", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "English", exact: true })).toBeChecked();
  await page.getByLabel("Budget (optional)", { exact: true }).fill("150");
  await expect(page.locator(".club-resource")).toHaveCount(1); await expect(page.locator(".club-resource")).toContainText("Local One");
  expect(calls).toBe(0);
});

test("invalid upload and cancellation preserve inventory, selection and edited outline; confirm clears atomically", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try an example" }).click(); await stubPlan(page);
  await page.getByRole("button", { name: "Generate event proposal" }).click();
  await page.getByRole("checkbox", { name: /I understand this is conditional/ }).check(); await page.getByRole("button", { name: "Apply proposal" }).click();
  await page.getByLabel("Event title", { exact: true }).fill("Edited inventory event"); await page.getByLabel("Organizer notes", { exact: true }).fill("Retain on invalid file");
  const initial = await page.locator(".club-resource").count();
  await upload(page, "type,name\nsong,Unsupported"); await expect(page.locator("#own-list")).toContainText("Songs");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Edited inventory event");
  await upload(page, '\uFEFFtype,name,creator\r\nbook,"Quoted, book","A ""Writer"""\r\n');
  await page.getByRole("button", { name: "Cancel import" }).click();
  await expect(page.locator(".club-resource")).toHaveCount(initial); await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Retain on invalid file");
  await upload(page, "type,name,creator\nbook,New book,New writer"); page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Confirm import" }).click(); await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Edited inventory event");
  page.once("dialog", (dialog) => dialog.accept()); await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveCount(0); await expect(page.locator(".club-selection")).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Confirmed interests" })).toContainText("Amélie");
});

test("mixed shortlist rows remain unresolved until a bounded explicit lookup and identity confirmation", async ({ page }) => {
  let calls = 0;
  const intended = candidate("book").entity; const other = { ...intended, entityId: "44444444-4444-4444-8444-444444444444", metadata: { creator: "Other writer" }, reference: { token: "other.reference" } };
  await page.route("**/api/club/search", (route) => { calls++; expect(route.request().postDataJSON()).toMatchObject({ query: "The Guide R. K. Narayan", kind: "book" }); return route.fulfill({ json: { ok: true, candidates: [other, intended] } }); });
  await page.goto("/"); await configure(page); await upload(page, "type,name,creator\nbook,The Guide,R. K. Narayan\nartist,Artist One,\nmovie,Film One,Director\nplace,Cafe One,");
  await page.getByRole("button", { name: "Confirm import" }).click(); expect(calls).toBe(0);
  await page.locator(".club-resolution-row").filter({ hasText: "The Guide" }).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Match selected rows" }).click(); await expect(page.locator(".club-resolution-choice")).toHaveCount(2);
  await expect(page.getByText("0 of 1 selected rows resolved.", { exact: true })).toBeVisible();
  await page.locator(".club-resolution-choice").filter({ hasText: "R. K. Narayan" }).click();
  await expect(page.getByText("1 of 1 selected rows resolved.", { exact: true })).toBeVisible(); expect(calls).toBe(1);
  await expect(page.locator(".club-resolution-row").filter({ hasText: "Artist One" })).toContainText("Unresolved");
});

test("matching batch is capped at five and Reset retains imported inventory; restore is a separate action", async ({ page }) => {
  await page.goto("/"); await upload(page, "type,name\n" + Array.from({ length: 6 }, (_, i) => `movie,Film ${i}`).join("\n")); await page.getByRole("button", { name: "Confirm import" }).click();
  const boxes = page.locator(".club-resolution-row input[type=checkbox]"); for (let i = 0; i < 5; i++) await boxes.nth(i).check();
  await expect(boxes.nth(5)).toBeDisabled();
  await page.getByRole("button", { name: "Reset", exact: true }).click(); await expect(page.locator(".club-resource")).toHaveCount(6);
  await page.getByRole("button", { name: "Restore sample catalogue" }).click();
  await expect(page.getByRole("button", { name: "Choose The Guide", exact: true })).toBeVisible();
  await expect(page.locator(".club-resource").filter({ hasText: "Film 0" })).toHaveCount(0);
});

test("Use my own list opens the optional import and malformed UTF-8 cannot replace inventory or edits", async ({ page }) => {
  await page.goto("/"); await page.getByRole("button", { name: "Try an example", exact: true }).click();
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Prepare manual template", exact: true }).click(); await page.getByRole("button", { name: "Apply proposal", exact: true }).click();
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep this imported-file review note");
  const count = await page.locator(".club-resource").count();
  await page.getByRole("link", { name: "Use my own list", exact: true }).click();
  await expect(page.locator("#own-list")).toHaveAttribute("open", "");
  await page.getByLabel("Upload catalogue CSV", { exact: true }).setInputFiles({ name: "invalid.csv", mimeType: "text/csv", buffer: Buffer.concat([Buffer.from("type,name\nmovie,"), Buffer.from([0xc3, 0x28])]) });
  await expect(page.locator("#own-list").getByRole("alert")).toContainText("could not be read as UTF-8");
  await expect(page.locator(".club-resource")).toHaveCount(count); await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep this imported-file review note");
  await expect(page.getByRole("button", { name: "Confirm import", exact: true })).toHaveCount(0);
});

test("an expired imported identity can be rematched without losing edits and removing its batch row clears only the selection", async ({ page }) => {
  let searches = 0; let plans = 0;
  await page.route("**/api/club/search", (route) => route.fulfill({ json: { ok: true, candidates: [{ ...candidate("book").entity, reference: { token: ++searches === 1 ? "expired.reference" : "renewed.reference" } }] } }));
  await page.route("**/api/club/plan", async (route) => {
    const body = route.request().postDataJSON();
    if (++plans === 1) return route.fulfill({ status: 400, json: { ok: false, error: { code: "INVALID_INPUT", message: "Confirm the intended entity again; its reference is invalid or expired." } } });
    expect(body.selected).toEqual({ token: "renewed.reference" }); expect(body.resources[0].reference).toEqual({ token: "renewed.reference" });
    const proposal = plan(body); proposal.focus.localId = body.resources[0].localId;
    return route.fulfill({ json: { ok: true, result: { status: "proposal", proposal }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } });
  });
  await page.goto("/"); await configure(page); await upload(page, "type,name,creator\nbook,The Guide,R. K. Narayan");
  await page.getByRole("button", { name: "Confirm import", exact: true }).click(); await page.getByRole("button", { name: "Choose The Guide", exact: true }).click();
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption("manual");
  await page.getByRole("button", { name: "Prepare manual template", exact: true }).click(); await page.getByRole("button", { name: "Apply proposal", exact: true }).click();
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep my organizer edits during identity recovery");
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption("book");
  await page.getByRole("button", { name: "Match selected rows", exact: true }).click(); await page.locator(".club-resolution-choice").click();
  await page.getByRole("button", { name: "Generate event proposal", exact: true }).click();
  await expect(page.locator("#event-planner").getByRole("alert")).toContainText("invalid or expired");
  await page.getByRole("button", { name: "Clear identity for The Guide", exact: true }).click();
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep my organizer edits during identity recovery");
  await page.getByRole("button", { name: "Match selected rows", exact: true }).click(); await page.locator(".club-resolution-choice").click();
  await page.getByRole("button", { name: "Generate event proposal", exact: true }).click();
  await page.getByRole("checkbox", { name: /I understand this is conditional/ }).check(); await page.getByRole("button", { name: "Apply proposal", exact: true }).click();
  await page.locator(".club-resolution-row").getByRole("checkbox").uncheck();
  await expect(page.locator(".club-selection")).toHaveCount(0); await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep my organizer edits during identity recovery");
  await expect(page.getByText(/Based on previous inputs/)).toBeVisible(); expect(searches).toBe(2); expect(plans).toBe(2);
});
