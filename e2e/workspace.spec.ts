import { expect, test, type Locator, type Page } from "@playwright/test";
import { createDefaultInputs, LANGUAGES } from "../lib/workspace";

const exampleTitles = ["Malgudi Days", "The Blue Umbrella", "The Guide"];

function eligibleBooks(page: Page) {
  return page.getByRole("region", { name: /^Eligible books/ });
}

function eventOutline(page: Page) {
  return page.getByRole("region", { name: "Event outline", exact: true });
}

async function loadExample(page: Page) {
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expect(page.getByLabel("Max price per copy", { exact: true })).toHaveValue("450");
  await expect(page.getByLabel("Max page count", { exact: true })).toHaveValue("300");
  await expect(eligibleBooks(page).getByRole("heading", { level: 3 })).toHaveText(exampleTitles);
}

async function selectTheGuide(page: Page) {
  await eligibleBooks(page).getByRole("button", { name: "Select: The Guide", exact: true }).click();
  await expect(eligibleBooks(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(eventOutline(page).getByRole("heading", { level: 3 })).toHaveText("The Guide");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("An evening with The Guide");
}

async function expectNoOutline(page: Page, staleText: string[] = []) {
  await expect(eligibleBooks(page).getByRole("button", { pressed: true })).toHaveCount(0);
  await expect(eventOutline(page).getByRole("textbox")).toHaveCount(0);
  await expect(eventOutline(page).getByRole("heading", { name: "Every good gathering starts with a book.", exact: true })).toBeVisible();
  for (const text of staleText) {
    await expect(eventOutline(page)).not.toContainText(text);
  }
}

// Reach controls using the browser's real tab order; never move focus with DOM APIs.
async function tabTo(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === element.ownerDocument.activeElement)) {
      await expect(target).toBeFocused();
      return;
    }
  }
  await expect(target, "Control must be reachable within 40 Tab presses").toBeFocused();
}

async function expectVisibleKeyboardFocus(target: Locator) {
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  const focus = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      visible: element.matches(":focus-visible"),
      outlineStyle: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor,
    };
  });
  expect(focus.visible, "Keyboard focus must match :focus-visible").toBe(true);
  expect(focus.outlineStyle).not.toBe("none");
  expect(focus.outlineWidth).toBeGreaterThanOrEqual(2);
  expect(focus.outlineColor).not.toBe("rgba(0, 0, 0, 0)");
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^AfterHours/);
  await expect(page.getByRole("heading", { level: 1, name: /Good books/ })).toBeVisible();
  await expect(page.getByText("Sample inventory — Live Qloo matching is available on request. AI planning is not connected.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Load example", exact: true })).toBeVisible();
  await expect(page.getByLabel("Max price per copy", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Max page count", { exact: true })).toBeVisible();
});

test("Load example shows exactly the three English eligible books", async ({ page }) => {
  await loadExample(page);
  await expect(page.getByRole("checkbox", { name: "English", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Hindi", exact: true })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Bengali", exact: true })).not.toBeChecked();
  await expect(eligibleBooks(page).getByRole("listitem")).toHaveCount(3);
  await expect(eligibleBooks(page).getByRole("heading", { level: 3 })).toHaveText(exampleTitles);
});

test("The Guide selection and outline edits survive a valid price change without switching books", async ({ page }) => {
  await loadExample(page);
  await selectTheGuide(page);
  const title = "An AfterHours evening with The Guide";
  const notes = "Reserve the accessible room and bring discussion cards.";
  await page.getByLabel("Event title", { exact: true }).fill(title);
  await page.getByLabel("Organizer notes", { exact: true }).fill(notes);

  // Do not switch or reselect books: this checks the existing draft survives a filter update.
  await page.getByLabel("Max price per copy", { exact: true }).fill("400");

  await expect(eligibleBooks(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(eligibleBooks(page).getByRole("button", { pressed: true })).toHaveCount(1);
  await expect(eventOutline(page).getByRole("heading", { level: 3 })).toHaveText("The Guide");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(title);
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue(notes);
});

test("a price of 100 shows the empty state and permanently clears the now-ineligible selection and outline", async ({ page }) => {
  await loadExample(page);
  await selectTheGuide(page);
  const staleTitle = "Draft that must be cleared after filtering";
  const staleNotes = "These organizer notes must not survive invalidation.";
  await page.getByLabel("Event title", { exact: true }).fill(staleTitle);
  await page.getByLabel("Organizer notes", { exact: true }).fill(staleNotes);

  await page.getByLabel("Max price per copy", { exact: true }).fill("100");

  await expect(eligibleBooks(page).getByRole("heading", { name: "No books fit these limits yet.", exact: true })).toBeVisible();
  await expect(eligibleBooks(page).getByText("Try a higher price or page limit, or include another language. Only in-stock books appear here.", { exact: true })).toBeVisible();
  await expect(eligibleBooks(page).getByRole("listitem")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Your selected book no longer meets the filters." })).toBeVisible();
  await expectNoOutline(page, [staleTitle, staleNotes]);

  await page.getByLabel("Max price per copy", { exact: true }).fill("450");
  await expect(eligibleBooks(page).getByRole("heading", { level: 3 })).toHaveText(exampleTitles);
  await expect(eligibleBooks(page).getByRole("button", { name: "Select: The Guide", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expectNoOutline(page, [staleTitle, staleNotes]);
});

test("Reset restores source-defined defaults and clears favourites, selection, and stale outline", async ({ page }) => {
  const defaults = createDefaultInputs();
  await loadExample(page);
  await expect(page.getByLabel("Books", { exact: true })).not.toHaveValue("");
  await expect(page.getByLabel("Films", { exact: true })).not.toHaveValue("");
  await expect(page.getByLabel("Musicians", { exact: true })).not.toHaveValue("");
  await selectTheGuide(page);
  const staleTitle = "Reset should clear this event title";
  const staleNotes = "Reset should clear these notes.";
  await page.getByLabel("Event title", { exact: true }).fill(staleTitle);
  await page.getByLabel("Organizer notes", { exact: true }).fill(staleNotes);

  await page.getByRole("button", { name: "Reset", exact: true }).click();

  await expect(page.getByLabel("Max price per copy", { exact: true })).toHaveValue(defaults.filters.maxPrice);
  await expect(page.getByLabel("Max page count", { exact: true })).toHaveValue(defaults.filters.maxPages);
  for (const language of LANGUAGES) {
    await expect(page.getByRole("checkbox", { name: language, exact: true })).toBeChecked({ checked: defaults.filters.languages.includes(language) });
  }
  await expect(page.getByLabel("Books", { exact: true })).toHaveValue(defaults.audience.books);
  await expect(page.getByLabel("Films", { exact: true })).toHaveValue(defaults.audience.films);
  await expect(page.getByLabel("Musicians", { exact: true })).toHaveValue(defaults.audience.musicians);
  await expectNoOutline(page, [staleTitle, staleNotes]);
});

test("390px mobile layout has no horizontal overflow or clipped controls and captures the selected outline", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadExample(page);
  await selectTheGuide(page);
  await page.getByLabel("Event title", { exact: true }).fill("A Guide gathering");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Use the accessible entrance. Bring water and discussion cards.");

  // Capture before layout assertions so a failure still has a complete visual artifact.
  const screenshotPath = testInfo.outputPath("afterhours-mobile-390.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("AfterHours at 390px with eligible books and selected outline", { path: screenshotPath, contentType: "image/png" });

  const documentWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(documentWidths.viewport).toBe(390);
  expect(documentWidths.document, "Document must not scroll horizontally").toBeLessThanOrEqual(documentWidths.viewport);
  expect(documentWidths.body, "Body must not scroll horizontally").toBeLessThanOrEqual(documentWidths.viewport);

  // Framework development tools are outside the application's semantic main region.
  const main = page.getByRole("main");
  const controls = main.getByRole("button")
    .or(main.getByRole("textbox"))
    .or(main.getByRole("spinbutton"))
    .or(main.getByRole("checkbox"))
    .or(page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link"));
  const controlIssues = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const rectangle = element.getBoundingClientRect();
    if (!rectangle.width || !rectangle.height) return [];
    const label = element.getAttribute("aria-label") || element.id || element.textContent?.trim() || element.tagName;
    const issues = [];
    if (rectangle.left < -1 || rectangle.right > document.documentElement.clientWidth + 1) issues.push(`${label}: outside viewport horizontally`);
    if (element.scrollWidth > element.clientWidth + 1) issues.push(`${label}: content clipped horizontally`);
    return issues;
  }));
  expect(controlIssues, "All visible controls must fit horizontally with readable contents").toEqual([]);

  const cardIssues = await eligibleBooks(page).getByRole("listitem").evaluateAll((cards) => cards.flatMap((card) => {
    const issues: string[] = [];
    const bounds = card.getBoundingClientRect();
    if (bounds.left < 0 || bounds.right > document.documentElement.clientWidth) issues.push("Book card outside viewport");
    // These DOM reads only observe layout; interactions use accessible locators above.
    for (const element of card.querySelectorAll("h3, p, button, .stock-label")) {
      const rectangle = element.getBoundingClientRect();
      if (rectangle.left < bounds.left || rectangle.right > bounds.right) issues.push(`Book card clips ${element.textContent?.trim()}`);
      if (element.scrollWidth > element.clientWidth + 1) issues.push(`Book card text clipped: ${element.textContent?.trim()}`);
    }
    return issues;
  }));
  expect(cardIssues, "Book card titles, prices, stock, and selection controls must remain readable").toEqual([]);
  const shelfBounds = await eligibleBooks(page).getByRole("list").boundingBox();
  expect(shelfBounds, "The eligible-book shelf must have measurable bounds").not.toBeNull();
  if (!shelfBounds) throw new Error("Eligible-book shelf has no layout bounds");
  const cardBounds = await eligibleBooks(page).getByRole("listitem").evaluateAll((cards) => cards.map((card) => {
    const bounds = card.getBoundingClientRect();
    return { left: bounds.left, width: bounds.width, top: bounds.top, bottom: bounds.bottom };
  }));
  expect(cardBounds).toHaveLength(3);
  for (const [index, bounds] of cardBounds.entries()) {
    expect(Math.abs(bounds.left - shelfBounds.x), "Each mobile card must align with the shelf's left edge").toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.width - shelfBounds.width), "Each mobile card must occupy the shelf's full width").toBeLessThanOrEqual(1);
    if (index > 0) {
      expect(bounds.top, "Mobile book cards must stack in a single column").toBeGreaterThanOrEqual(cardBounds[index - 1].bottom);
    }
  }
  await expect(eligibleBooks(page).getByRole("heading", { level: 3 })).toHaveText(exampleTitles);
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("A Guide gathering");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toBeVisible();
});

test("keyboard Tab, Space, Enter, and typing operate filters, selection, and outline with visible focus", async ({ page }) => {
  const shelfLink = page.getByRole("navigation", { name: "Workspace sections" }).getByRole("link", { name: "Eligible books", exact: true });
  await tabTo(page, shelfLink);
  await expectVisibleKeyboardFocus(shelfLink);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/#eligible-books$/);
  await expect(eligibleBooks(page).getByRole("heading", { level: 2 })).toBeInViewport();

  const exampleButton = page.getByRole("button", { name: "Load example", exact: true });
  await tabTo(page, exampleButton);
  await expectVisibleKeyboardFocus(exampleButton);
  await page.keyboard.press("Enter");
  await expect(eligibleBooks(page).getByRole("heading", { level: 3 })).toHaveText(exampleTitles);

  const hindi = page.getByRole("checkbox", { name: "Hindi", exact: true });
  await tabTo(page, hindi);
  await expectVisibleKeyboardFocus(hindi);
  await expect(hindi).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(hindi).toBeChecked();
  await page.keyboard.press("Space");
  await expect(hindi).not.toBeChecked();

  const guideButton = eligibleBooks(page).getByRole("button", { name: "Select: The Guide", exact: true });
  await tabTo(page, guideButton);
  await expectVisibleKeyboardFocus(guideButton);
  await page.keyboard.press("Enter");
  await expect(eligibleBooks(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(eventOutline(page).getByRole("heading", { level: 3 })).toHaveText("The Guide");

  const title = page.getByLabel("Event title", { exact: true });
  await tabTo(page, title);
  await expectVisibleKeyboardFocus(title);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Keyboard evening with The Guide");
  await expect(title).toHaveValue("Keyboard evening with The Guide");

  const notes = page.getByLabel("Organizer notes", { exact: true });
  await tabTo(page, notes);
  await expectVisibleKeyboardFocus(notes);
  await page.keyboard.type("Bring large-print discussion cards.");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Keep an accessible seat available.");
  await expect(notes).toHaveValue("Bring large-print discussion cards.\nKeep an accessible seat available.");
  await expect(title).toHaveValue("Keyboard evening with The Guide");
});
