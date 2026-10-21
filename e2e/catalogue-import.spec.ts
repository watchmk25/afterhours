import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "./fixtures";
import { createDefaultInputs, LANGUAGES } from "../lib/workspace";
import { fetchProtectedPreview, protectedPreview } from "./support/protected-preview";

const header = "title,author,price_inr,pages,language,stock";
const simpleCsv = `${header}\nAurora Reading Room,Ananya Rao,240,180,Tamil,4\nEvening Windows,Claire Martin,180,120,French,2\n`;

function catalogue(page: Page) {
  return page.getByRole("region", { name: "Your catalogue", exact: true });
}

function preview(page: Page) {
  return page.getByRole("region", { name: "Catalogue preview", exact: true });
}

function shelf(page: Page) {
  return page.getByRole("region", { name: /^Eligible books/ });
}

function outline(page: Page) {
  return page.getByRole("region", { name: "Event outline", exact: true });
}

async function upload(page: Page, content: string, name = "test-inventory.csv") {
  await page.getByLabel("Choose catalogue CSV", { exact: true }).setInputFiles({
    name,
    mimeType: "text/csv",
    buffer: Buffer.from(content, "utf8"),
  });
}

async function importCsv(page: Page, content = simpleCsv) {
  await upload(page, content);
  await expect(preview(page)).toBeVisible();
  await preview(page).getByRole("button", { name: "Replace catalogue", exact: true }).click();
  await expect(preview(page)).toHaveCount(0);
  await expect(catalogue(page).getByText("Imported inventory", { exact: true })).toBeVisible();
}

async function prepareGuideDraft(page: Page) {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await shelf(page).getByRole("button", { name: "Select: The Guide", exact: true }).click();
  await page.getByLabel("Event title", { exact: true }).fill("Preserve my Guide event");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep this carefully edited room plan.");
  await page.getByLabel("Books", { exact: true }).fill("A favourite that must remain");
}

async function expectGuideDraft(page: Page) {
  await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Preserve my Guide event");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep this carefully edited room plan.");
  await expect(page.getByLabel("Books", { exact: true })).toHaveValue("A favourite that must remain");
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Malgudi Days", "The Blue Umbrella", "The Guide"]);
}

async function expectNoSelection(page: Page) {
  await expect(shelf(page).getByRole("button", { pressed: true })).toHaveCount(0);
  await expect(outline(page).getByRole("textbox")).toHaveCount(0);
  await expect(outline(page)).not.toContainText("Preserve my Guide event");
  await expect(outline(page)).not.toContainText("Keep this carefully edited room plan.");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^AfterHours/);
  await expect(catalogue(page)).toBeVisible();
  await expect(catalogue(page).getByText(/^Sample inventory/)).toBeVisible();
});

test("valid inventory is previewed atomically and uses stock, price, page, and language filters", async ({ page }) => {
  const writeRequests: string[] = [];
  page.on("request", (request) => {
    if (!["GET", "HEAD"].includes(request.method())) {
      writeRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  const csv = `${header}\nA Quiet Room,Ananya Rao,120,80,English,4\nBengali Windows,Anirban Sen,190,120,Bengali,2\nCostly Shelf,Anita Das,700,100,English,3\nLong Road,Dev Mehta,100,450,English,2\nUnavailable Book,Mina Shah,50,50,English,0\nZ Archive Copy,Neha Kapoor,80,60,English,0\n`;
  await upload(page, csv);
  await expect(preview(page)).toContainText(/6 books/);
  await expect(preview(page).getByRole("listitem")).toHaveCount(5);
  await expect(preview(page).getByRole("heading", { name: "Z Archive Copy", exact: true })).toHaveCount(0);
  await expect(preview(page).getByRole("heading", { name: "A Quiet Room", exact: true })).toBeVisible();
  await expect(catalogue(page).getByText(/^Sample inventory/)).toBeVisible();
  await expect(shelf(page).getByRole("heading", { name: "A Quiet Room", exact: true })).toHaveCount(0);

  await preview(page).getByRole("button", { name: "Replace catalogue", exact: true }).click();
  await expect(catalogue(page).getByText("Imported inventory", { exact: true })).toBeVisible();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["A Quiet Room", "Bengali Windows"]);
  await expect(page.getByRole("checkbox", { name: "English", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Bengali", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Hindi", exact: true })).toHaveCount(0);

  await page.getByLabel("Max price per copy", { exact: true }).fill("150");
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["A Quiet Room"]);
  await page.getByLabel("Max page count", { exact: true }).fill("60");
  await expect(shelf(page).getByRole("heading", { name: "No books fit these limits yet.", exact: true })).toBeVisible();
  await page.getByLabel("Max price per copy", { exact: true }).fill("800");
  await page.getByLabel("Max page count", { exact: true }).fill("500");
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["A Quiet Room", "Bengali Windows", "Costly Shelf", "Long Road"]);
  await page.getByRole("checkbox", { name: "English", exact: true }).uncheck();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Bengali Windows"]);
  expect(writeRequests, "Uploading, confirming, and filtering inventory must not send an HTTP upload or other write request").toEqual([]);
});

test("downloadable template has the required columns and quoted BOM/CRLF fields retain their text", async ({ page }) => {
  const link = page.getByRole("link", { name: "Download CSV template", exact: true });
  const protection = protectedPreview();
  let blobDownload: { url: string; href: string | null; download: string | null } | undefined;
  if (protection) {
    const href = await link.getAttribute("href");
    expect(href).not.toBeNull();
    const target = new URL(href!, page.url());
    expect(target.origin).toBe(protection.origin);
    expect(target.pathname).toBe("/catalogue-template.csv");
    expect(target.search).toBe("");
    expect(target.hash).toBe("");
    const response = await fetchProtectedPreview(protection, target.href);
    expect(response.status, "The actual hosted CSV template must be available through authorized Node transport").toBe(200);
    // Chromium native downloads escape ordinary request routing. Transfer the
    // actual hosted bytes through a Blob; authorization stays entirely in Node.
    blobDownload = await link.evaluate((anchor, input) => {
      const original = { href: anchor.getAttribute("href"), download: anchor.getAttribute("download") };
      const url = URL.createObjectURL(new Blob([Uint8Array.from(input.bytes)], { type: "text/csv;charset=utf-8" }));
      anchor.setAttribute("href", url);
      anchor.setAttribute("download", input.filename);
      return { url, ...original };
    }, { bytes: [...response.body], filename: target.pathname.slice(1) });
  }
  try {
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download CSV template", exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    const downloadedPath = await download.path();
    expect(downloadedPath).not.toBeNull();
    if (!downloadedPath) throw new Error("CSV template was not downloaded");
    const downloadedCsv = await readFile(downloadedPath, "utf8");
    expect(downloadedCsv.replace(/^\uFEFF/, "").split(/\r?\n/)[0]).toBe(header);
  } finally {
    if (blobDownload) await link.evaluate((anchor, original) => {
      for (const attribute of ["href", "download"] as const) {
        if (original[attribute] === null) anchor.removeAttribute(attribute);
        else anchor.setAttribute(attribute, original[attribute]);
      }
      URL.revokeObjectURL(original.url);
    }, blobDownload);
  }

  const title = 'Letters, Places & "People"';
  const author = 'Leela "L." Sen';
  await upload(page, `\uFEFF${header}\r\n"Letters, Places & ""People""","Leela ""L."" Sen",199.50,140,English,3\r\n`);
  await expect(preview(page)).toContainText(/1 book/);
  await expect(preview(page).getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(preview(page).getByText(`by ${author}`, { exact: true })).toBeVisible();
  await preview(page).getByRole("button", { name: "Replace catalogue", exact: true }).click();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText([title]);
  await shelf(page).getByRole("button", { name: `Select: ${title}`, exact: true }).click();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(`An evening with ${title}`);
  await expect(outline(page)).toContainText(author);
});

test("invalid headers, values, malformed quoting, and import limits preserve the complete current draft", async ({ page }) => {
  await prepareGuideDraft(page);
  const invalidFiles = [
    { name: "missing-header.csv", csv: "title,price_inr,pages,language,stock\nNew Book,100,100,English,2\n", error: /author/i },
    { name: "duplicate-header.csv", csv: "title,title,price_inr,pages,language,stock\nNew Book,Someone,100,100,English,2\n", error: /duplicate/i },
    { name: "invalid-values.csv", csv: `${header}\nValid Row,Some Writer,100,100,English,1\n,,-1,1.5,,-1\n`, error: /row\s*3/i, columns: ["title", "author", "price_inr", "pages", "language", "stock"] },
    { name: "malformed-quotes.csv", csv: `${header}\n"Never closed,Someone,100,100,English,1\n`, error: /quot/i },
    { name: "too-many-rows.csv", csv: `${header}\n${Array.from({ length: 501 }, (_, index) => `Synthetic Book ${index},Test Writer,100,100,English,1`).join("\n")}\n`, error: /500/ },
    { name: "too-large.csv", csv: `${header}\n${"x".repeat(256 * 1024)}`, error: /256/ },
  ];
  for (const invalid of invalidFiles) {
    await test.step(invalid.name, async () => {
      await upload(page, invalid.csv, invalid.name);
      const errors = catalogue(page).getByRole("alert");
      await expect(errors).toContainText(invalid.error);
      for (const column of invalid.columns ?? []) await expect(errors).toContainText(column);
      await expect(preview(page)).toHaveCount(0);
      await expect(catalogue(page).getByRole("button", { name: "Replace catalogue", exact: true })).toHaveCount(0);
      await expect(catalogue(page).getByText(/^Sample inventory/)).toBeVisible();
      await expectGuideDraft(page);
    });
  }
});

test("cancel preserves inventory and edited outline, while confirmation clears the draft and preserves favourites", async ({ page }) => {
  await prepareGuideDraft(page);
  await upload(page, simpleCsv);
  await expect(preview(page)).toBeVisible();
  await expect(preview(page)).toContainText(/clear.*select|select.*clear/i);
  await expect(preview(page)).toContainText(/outline/i);
  await expectGuideDraft(page);
  await preview(page).getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(preview(page)).toHaveCount(0);
  await expectGuideDraft(page);

  await upload(page, simpleCsv);
  await expect(preview(page)).toBeVisible();
  await preview(page).getByRole("button", { name: "Replace catalogue", exact: true }).click();
  await expectNoSelection(page);
  await expect(page.getByLabel("Books", { exact: true })).toHaveValue("A favourite that must remain");
  await expect(page.getByLabel("Max price per copy", { exact: true })).toHaveValue("450");
  await expect(page.getByLabel("Max page count", { exact: true })).toHaveValue("300");
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Aurora Reading Room", "Evening Windows"]);
  await shelf(page).getByRole("button", { name: "Select: Aurora Reading Room", exact: true }).click();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("An evening with Aurora Reading Room");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("");
});

test("dynamic catalogue languages work and Reset retains imported inventory with source-defined defaults", async ({ page }) => {
  const defaults = createDefaultInputs();
  await importCsv(page);
  await expect(page.getByRole("checkbox")).toHaveCount(2);
  for (const language of ["French", "Tamil"]) await expect(page.getByRole("checkbox", { name: language, exact: true })).toBeChecked();
  await page.getByRole("checkbox", { name: "Tamil", exact: true }).uncheck();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Evening Windows"]);
  await shelf(page).getByRole("button", { name: "Select: Evening Windows", exact: true }).click();
  await page.getByLabel("Organizer notes", { exact: true }).fill("Discard these imported-book notes on Reset.");
  await page.getByLabel("Books", { exact: true }).fill("A temporary favourite");
  await page.getByLabel("Films", { exact: true }).fill("A temporary film");
  await page.getByLabel("Musicians", { exact: true }).fill("A temporary musician");
  await page.getByLabel("Max price per copy", { exact: true }).fill("200");
  await page.getByLabel("Max page count", { exact: true }).fill("150");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(catalogue(page).getByText("Imported inventory", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Max price per copy", { exact: true })).toHaveValue(defaults.filters.maxPrice);
  await expect(page.getByLabel("Max page count", { exact: true })).toHaveValue(defaults.filters.maxPages);
  for (const label of ["Books", "Films", "Musicians"]) await expect(page.getByLabel(label, { exact: true })).toHaveValue("");
  for (const language of ["French", "Tamil"]) await expect(page.getByRole("checkbox", { name: language, exact: true })).toBeChecked();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Aurora Reading Room", "Evening Windows"]);
  await expectNoSelection(page);

  // Example inputs must remain usable when English is absent from the active inventory.
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  for (const language of ["French", "Tamil"]) await expect(page.getByRole("checkbox", { name: language, exact: true })).toBeChecked();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Aurora Reading Room", "Evening Windows"]);
});

test("Restore sample catalogue clears imported selection but retains favourites and numeric limits", async ({ page }) => {
  await importCsv(page);
  await page.getByLabel("Books", { exact: true }).fill("Keep the audience taste");
  await page.getByLabel("Max price per copy", { exact: true }).fill("450");
  await page.getByLabel("Max page count", { exact: true }).fill("300");
  await shelf(page).getByRole("button", { name: "Select: Aurora Reading Room", exact: true }).click();
  await page.getByLabel("Organizer notes", { exact: true }).fill("Notes for imported inventory only.");
  await page.getByRole("button", { name: "Restore sample catalogue", exact: true }).click();

  await expect(catalogue(page).getByText(/^Sample inventory/)).toBeVisible();
  await expect(catalogue(page).getByText("Imported inventory", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Books", { exact: true })).toHaveValue("Keep the audience taste");
  await expect(page.getByLabel("Max price per copy", { exact: true })).toHaveValue("450");
  await expect(page.getByLabel("Max page count", { exact: true })).toHaveValue("300");
  for (const language of LANGUAGES) await expect(page.getByRole("checkbox", { name: language, exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Tamil", exact: true })).toHaveCount(0);
  await expect(shelf(page).getByRole("heading", { name: "The Guide", exact: true })).toBeVisible();
  await expect(shelf(page).getByRole("heading", { name: "Aurora Reading Room", exact: true })).toHaveCount(0);
  await expectNoSelection(page);
});

test("imported inventory is session-only and reload restores samples", async ({ page }) => {
  await expect(catalogue(page)).toContainText(/session|reload/i);
  await importCsv(page);
  await expect(shelf(page).getByRole("heading", { name: "Aurora Reading Room", exact: true })).toBeVisible();
  await page.reload();
  await expect(catalogue(page).getByText(/^Sample inventory/)).toBeVisible();
  await expect(shelf(page).getByRole("heading", { name: "Aurora Reading Room", exact: true })).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: "English", exact: true })).toBeChecked();
  await expectNoSelection(page);
});

test("390px import preview and imported outline fit without horizontal overflow", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await upload(page, simpleCsv);
  await expect(preview(page)).toBeVisible();
  const previewScreenshot = testInfo.outputPath("catalogue-import-preview-mobile-390.png");
  await page.screenshot({ path: previewScreenshot, fullPage: true });
  await testInfo.attach("CSV preview at 390px", { path: previewScreenshot, contentType: "image/png" });
  await expectNoOverflow(page);
  const previewIssues = await preview(page).getByRole("listitem").evaluateAll((rows) => rows.flatMap((cell) => {
    const bounds = cell.getBoundingClientRect();
    const issues: string[] = [];
    if (bounds.left < -1 || bounds.right > document.documentElement.clientWidth + 1) issues.push(`Preview row outside viewport: ${cell.textContent}`);
    if (cell.scrollWidth > cell.clientWidth + 1) issues.push(`Preview row clips text: ${cell.textContent}`);
    return issues;
  }));
  expect(previewIssues, "Representative rows must be readable at 390px").toEqual([]);

  await preview(page).getByRole("button", { name: "Replace catalogue", exact: true }).click();
  await shelf(page).getByRole("button", { name: "Select: Aurora Reading Room", exact: true }).click();
  await page.getByLabel("Event title", { exact: true }).fill("An imported-book evening");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Bring accessible discussion cards.");
  const outlineScreenshot = testInfo.outputPath("catalogue-import-outline-mobile-390.png");
  await page.screenshot({ path: outlineScreenshot, fullPage: true });
  await testInfo.attach("Imported inventory and outline at 390px", { path: outlineScreenshot, contentType: "image/png" });
  await expectNoOverflow(page);
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("An imported-book evening");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Bring accessible discussion cards.");

  const controls = page.getByRole("main").getByRole("button")
    .or(page.getByRole("main").getByRole("textbox"))
    .or(page.getByRole("main").getByRole("spinbutton"))
    .or(page.getByRole("main").getByRole("checkbox"))
    .or(page.getByLabel("Choose catalogue CSV", { exact: true }));
  const issues = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const bounds = element.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return [];
    const label = element.getAttribute("aria-label") || element.id || element.textContent?.trim() || element.tagName;
    const problems: string[] = [];
    if (bounds.left < -1 || bounds.right > document.documentElement.clientWidth + 1) problems.push(`${label}: outside viewport`);
    if (element.scrollWidth > element.clientWidth + 1) problems.push(`${label}: content clipped`);
    return problems;
  }));
  expect(issues, "Import controls and outline fields must fit at 390px").toEqual([]);
  const bookBounds = await shelf(page).getByRole("listitem").evaluateAll((items) => items.map((item) => {
    const rect = item.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  }));
  expect(bookBounds).toHaveLength(2);
  expect(bookBounds[1].top).toBeGreaterThanOrEqual(bookBounds[0].bottom);
  for (const bounds of bookBounds) {
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(390);
  }
});

async function expectNoOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.viewport).toBe(390);
  expect(widths.document, "Document must not scroll horizontally").toBeLessThanOrEqual(widths.viewport);
  expect(widths.body, "Body must not scroll horizontally").toBeLessThanOrEqual(widths.viewport);
}
