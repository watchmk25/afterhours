import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { QLOO_PRESETS } from "../lib/qloo-sample";
import type { QlooInterest, QlooRankRequest, QlooRankResponse, QlooSearchResponse } from "../lib/qloo-types";

// Controlled browser fixtures exercise rendering and state, never the live provider.
// The static identities are the reviewed presets; these scores are test values.
const presetA = QLOO_PRESETS[0];
const presetB = QLOO_PRESETS[1];
const searchCandidate: QlooInterest = {
  ...presetA.interests[0],
  reference: { token: "controlled-browser-candidate-token" },
};
const alternativeCandidate: QlooInterest = {
  ...presetB.interests[0],
  reference: { token: "controlled-browser-alternative-token" },
};

function rankingResponse(interests: readonly QlooInterest[] = presetA.interests, guideAffinity = 0.82): QlooRankResponse {
  return {
    ok: true,
    ranked: [
      { localId: "the-guide", affinity: guideAffinity, contributions: interests.map((interest, index) => ({ interestId: interest.entityId, score: index ? 0.26 : 0.54 })) },
      { localId: "malgudi-days", affinity: 0.61, contributions: interests.map((interest, index) => ({ interestId: interest.entityId, score: index ? 0.19 : 0.39 })) },
    ],
    eligibleCount: 3,
    supportedCount: 2,
    assessedCount: 2,
    unassessed: [{ localId: "the-blue-umbrella", reason: "unresolved" }],
    interests: [...interests],
    aggregate: interests.map((interest, index) => ({ interestId: interest.entityId, avgScore: index ? 0.225 : 0.465 })),
    explanationWarnings: [],
  };
}

type SearchBody = { query: string; kind: "movie" | "artist" };
type Handler<T> = (route: Route, body: T) => Promise<void>;

async function mockQloo(page: Page, options: {
  search?: Handler<SearchBody>;
  rank?: Handler<QlooRankRequest>;
} = {}) {
  const calls = { search: [] as SearchBody[], rank: [] as QlooRankRequest[], completedSearches: 0, completedRanks: 0 };
  await page.route("**/api/qloo/**", async (route) => {
    expect(route.request().method(), "Qloo actions must be explicit POST requests").toBe("POST");
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/qloo/search") {
      const body = route.request().postDataJSON() as SearchBody;
      calls.search.push(body);
      if (options.search) await options.search(route, body);
      else await route.fulfill({ json: { ok: true, candidates: [searchCandidate] } satisfies QlooSearchResponse });
      calls.completedSearches += 1;
    } else if (path === "/api/qloo/rank") {
      const body = route.request().postDataJSON() as QlooRankRequest;
      calls.rank.push(body);
      if (options.rank) await options.rank(route, body);
      else await route.fulfill({ json: rankingResponse() });
      calls.completedRanks += 1;
    } else {
      // No unexpected provider route is ever passed through to the real server.
      await route.abort();
      throw new Error(`Unexpected Qloo API route: ${path}`);
    }
  });
  return calls;
}

function matching(page: Page) {
  return page.getByRole("region", { name: "Live Qloo matching", exact: true });
}

function ranking(page: Page) {
  return page.getByRole("region", { name: "Qloo ranking", exact: true });
}

function shelf(page: Page) {
  return page.getByRole("region", { name: /^Eligible books/ });
}

function confirmed(page: Page) {
  return matching(page).getByRole("list", { name: "Confirmed interests", exact: true });
}

async function openExample(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle(/^AfterHours/);
  await expect(matching(page)).toBeVisible();
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Malgudi Days", "The Blue Umbrella", "The Guide"]);
}

async function confirmPreset(page: Page) {
  await matching(page).getByRole("button", { name: presetA.label, exact: true }).click();
  await expect(confirmed(page).getByRole("listitem")).toHaveCount(2);
  await expect(confirmed(page)).toContainText("Amélie (2001)");
  await expect(confirmed(page)).toContainText("Norah Jones");
}

async function guideDraft(page: Page) {
  await shelf(page).getByRole("button", { name: "Select: The Guide", exact: true }).click();
  await page.getByLabel("Event title", { exact: true }).fill("Keep my Guide event");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep the accessible room and discussion cards.");
}

async function expectGuideDraft(page: Page) {
  await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Keep my Guide event");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep the accessible room and discussion cards.");
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("confirmed preset triggers one explicit ranking with partial coverage and preserves the current outline", async ({ page }) => {
  const calls = await mockQloo(page);
  await openExample(page);
  await guideDraft(page);
  await expect(matching(page).getByRole("button", { name: "Rank with Qloo", exact: true })).toBeDisabled();
  expect(calls.search).toHaveLength(0);
  expect(calls.rank).toHaveLength(0);

  await confirmPreset(page);
  expect(calls.rank, "Confirming interests must not automatically rank").toHaveLength(0);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();

  await expect(ranking(page)).toBeVisible();
  expect(calls.rank).toEqual([{
    catalogueSource: "sample",
    filters: { maxPrice: "450", maxPages: "300", languages: ["English"] },
    interests: presetA.interests.map((interest) => interest.reference),
  }]);
  expect(calls.search).toHaveLength(0);
  await expect(ranking(page).getByRole("heading", { level: 4 }).filter({ hasText: /^(The Guide|Malgudi Days)$/ })).toHaveText(["The Guide", "Malgudi Days"]);
  await expect(ranking(page)).toContainText("2 of 3 eligible books assessed by Qloo. 2 have reviewed mappings.");
  await expect(ranking(page)).toContainText("The Blue Umbrella: provider identity has not been resolved");
  await expect(ranking(page)).toContainText("Amélie: 0.54");
  await expect(ranking(page)).toContainText("Norah Jones: 0.26");
  await expect(ranking(page)).toContainText("not a probability");
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Malgudi Days", "The Blue Umbrella", "The Guide"]);
  await expectGuideDraft(page);

  await page.getByLabel("Max price per copy", { exact: true }).fill("400");
  await expect(ranking(page)).toHaveCount(0);
  expect(calls.rank, "Filter edits invalidate ranking without another request").toHaveLength(1);
  await expectGuideDraft(page);
});

test("searching never confirms a candidate until the organizer selects and confirms it", async ({ page }) => {
  const calls = await mockQloo(page, { rank: async (route) => { await route.fulfill({ json: rankingResponse([searchCandidate]) }); } });
  await openExample(page);
  await expect(matching(page).getByLabel("Find a film or musician", { exact: true })).toHaveAttribute("maxlength", "100");
  await matching(page).getByLabel("Find a film or musician", { exact: true }).fill("Amélie");
  expect(calls.search, "Typing must not search automatically").toHaveLength(0);
  await matching(page).getByRole("button", { name: "Search Qloo", exact: true }).click();
  const candidate = matching(page).getByRole("radio", { name: /Amélie.*Film.*2001/ });
  await expect(candidate).toBeVisible();
  expect(calls.search).toEqual([{ query: "Amélie", kind: "movie" }]);
  await expect(confirmed(page)).toHaveCount(0);
  await expect(matching(page).getByRole("button", { name: "Confirm interest", exact: true })).toBeDisabled();
  await expect(matching(page).getByRole("button", { name: "Rank with Qloo", exact: true })).toBeDisabled();

  await candidate.check();
  await expect(confirmed(page)).toHaveCount(0);
  await matching(page).getByRole("button", { name: "Confirm interest", exact: true }).click();
  await expect(confirmed(page).getByRole("listitem")).toHaveCount(1);
  expect(calls.rank).toHaveLength(0);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect(ranking(page)).toBeVisible();
  expect(calls.rank[0].interests).toEqual([searchCandidate.reference]);
  expect(calls.rank).toHaveLength(1);
  await expect(ranking(page)).toContainText("Amélie: 0.54");
  await matching(page).getByRole("button", { name: "Remove Amélie (2001)", exact: true }).click();
  await expect(ranking(page)).toHaveCount(0);
  await expect(matching(page).getByRole("button", { name: "Rank with Qloo", exact: true })).toBeDisabled();
  expect(calls.rank).toHaveLength(1);
});

for (const failure of [
  { status: 503, code: "NOT_CONFIGURED", message: "Qloo credentials are not configured on this server." },
  { status: 429, code: "RATE_LIMITED", message: "Qloo is rate limited. Try again later explicitly." },
  { status: 502, code: "PROVIDER_ERROR", message: "Qloo did not return a usable response." },
]) {
  test(`ranking HTTP ${failure.status} shows the sanitized error without sample scores or automatic retries`, async ({ page }) => {
    const calls = await mockQloo(page, {
      rank: async (route) => { await route.fulfill({ status: failure.status, json: { ok: false, error: { code: failure.code, message: failure.message } } }); },
    });
    await openExample(page);
    await guideDraft(page);
    await confirmPreset(page);
    await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
    await expect(matching(page).getByRole("alert")).toHaveText(failure.message);
    await expect(ranking(page)).toHaveCount(0);
    await expect(matching(page)).not.toContainText("Qloo affinity:");
    await expect(matching(page).getByRole("button", { name: "Rank with Qloo", exact: true })).toBeEnabled();
    expect(calls.rank).toHaveLength(1);
    expect(calls.search).toHaveLength(0);
    await expectGuideDraft(page);
  });
}

test("a failed explicit rerank clears prior scores and assessment badges without changing the outline", async ({ page }) => {
  const rerank = deferred();
  let count = 0;
  const calls = await mockQloo(page, {
    rank: async (route) => {
      count += 1;
      if (count === 1) await route.fulfill({ json: rankingResponse() });
      else {
        await rerank.promise;
        await route.fulfill({ status: 502, json: { ok: false, error: { code: "PROVIDER_ERROR", message: "The new ranking could not be completed." } } });
      }
    },
  });
  await openExample(page);
  await guideDraft(page);
  await confirmPreset(page);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect(ranking(page)).toBeVisible();
  await expect(shelf(page).getByText("Assessed by Qloo", { exact: true })).toHaveCount(2);
  await expect(shelf(page).getByText("Not assessed by Qloo", { exact: true })).toHaveCount(1);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect.poll(() => calls.rank.length).toBe(2);
  await expect(ranking(page)).toHaveCount(0);
  await expect(shelf(page).getByText("Assessed by Qloo", { exact: true })).toHaveCount(0);
  await expect(shelf(page).getByText("Not assessed by Qloo", { exact: true })).toHaveCount(0);
  rerank.resolve();
  await expect(matching(page).getByRole("alert")).toHaveText("The new ranking could not be completed.");
  await expect(ranking(page)).toHaveCount(0);
  await expect(matching(page)).not.toContainText("Qloo affinity:");
  await expectGuideDraft(page);
  expect(calls.rank).toHaveLength(2);
});

test("a search failure retains confirmed interests and offers no invented candidates", async ({ page }) => {
  const calls = await mockQloo(page, {
    search: async (route) => { await route.fulfill({ status: 502, json: { ok: false, error: { code: "PROVIDER_ERROR", message: "Qloo search is unavailable. Try again explicitly." } } }); },
  });
  await openExample(page);
  await confirmPreset(page);
  await matching(page).getByLabel("Find a film or musician", { exact: true }).fill("Unanswered search");
  await matching(page).getByRole("button", { name: "Search Qloo", exact: true }).click();
  await expect(matching(page).getByRole("alert")).toHaveText("Qloo search is unavailable. Try again explicitly.");
  await expect(matching(page).getByRole("radio")).toHaveCount(0);
  await expect(confirmed(page).getByRole("listitem")).toHaveCount(2);
  expect(calls.search).toHaveLength(1);
  expect(calls.rank).toHaveLength(0);
});

test("a late ranking cannot replace a newer explicit result after filters change", async ({ page }) => {
  const oldRank = deferred();
  let count = 0;
  const calls = await mockQloo(page, {
    rank: async (route) => {
      count += 1;
      const first = count === 1;
      if (first) await oldRank.promise;
      await route.fulfill({ json: rankingResponse(presetA.interests, first ? 0.99 : 0.22) });
    },
  });
  await openExample(page);
  await guideDraft(page);
  await confirmPreset(page);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect.poll(() => calls.rank.length).toBe(1);
  await expect(matching(page).getByRole("button", { name: "Ranking with Qloo…", exact: true })).toBeDisabled();
  await page.getByLabel("Max price per copy", { exact: true }).fill("400");
  await expect(ranking(page)).toHaveCount(0);
  await expect(matching(page).getByRole("button", { name: "Rank with Qloo", exact: true })).toBeEnabled();
  expect(calls.rank).toHaveLength(1);
  // Returning to identical filter values must not revive the older request.
  await page.getByLabel("Max price per copy", { exact: true }).fill("450");
  await expect(ranking(page)).toHaveCount(0);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect(ranking(page)).toContainText("Qloo affinity: 0.22");
  oldRank.resolve();
  await expect.poll(() => calls.completedRanks).toBe(2);
  await expect(ranking(page)).toContainText("Qloo affinity: 0.22");
  await expect(ranking(page)).not.toContainText("Qloo affinity: 0.99");
  expect(calls.rank).toHaveLength(2);
  await expectGuideDraft(page);
});

test("late search candidates cannot reappear after the query or interest type changes", async ({ page }) => {
  const oldSearch = deferred();
  const calls = await mockQloo(page, {
    search: async (route, body) => {
      if (body.query === "Old query") await oldSearch.promise;
      await route.fulfill({ json: { ok: true, candidates: [body.query === "Old query" ? searchCandidate : alternativeCandidate] } satisfies QlooSearchResponse });
    },
  });
  await openExample(page);
  const query = matching(page).getByLabel("Find a film or musician", { exact: true });
  await query.fill("Old query");
  await matching(page).getByRole("button", { name: "Search Qloo", exact: true }).click();
  await expect.poll(() => calls.search.length).toBe(1);
  await query.fill("New query");
  await expect(matching(page).getByRole("radio")).toHaveCount(0);
  await matching(page).getByRole("button", { name: "Search Qloo", exact: true }).click();
  await expect(matching(page).getByRole("radio", { name: /Interstellar.*Film.*2014/ })).toBeVisible();
  oldSearch.resolve();
  await expect.poll(() => calls.completedSearches).toBe(2);
  await expect(matching(page).getByRole("radio", { name: /Amélie/ })).toHaveCount(0);
  await expect(matching(page).getByRole("radio", { name: /Interstellar.*Film.*2014/ })).toBeVisible();
  await matching(page).getByLabel("Interest type", { exact: true }).selectOption("artist");
  await expect(matching(page).getByRole("radio")).toHaveCount(0);
  await expect(confirmed(page)).toHaveCount(0);
  expect(calls.search).toHaveLength(2);
  expect(calls.rank).toHaveLength(0);
});

test("Reset invalidates a pending ranking and clears confirmed interests without a replacement request", async ({ page }) => {
  const pending = deferred();
  const calls = await mockQloo(page, { rank: async (route) => { await pending.promise; await route.fulfill({ json: rankingResponse() }); } });
  await openExample(page);
  await confirmPreset(page);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect.poll(() => calls.rank.length).toBe(1);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(confirmed(page)).toHaveCount(0);
  await expect(ranking(page)).toHaveCount(0);
  pending.resolve();
  await expect.poll(() => calls.completedRanks).toBe(1);
  await expect(ranking(page)).toHaveCount(0);
  await expect(matching(page).getByRole("button", { name: "Rank with Qloo", exact: true })).toBeDisabled();
  expect(calls.rank).toHaveLength(1);
});

test("CSV previews preserve matching and drafts; importing invalidates live results and keeps local templates usable", async ({ page }) => {
  const pending = deferred();
  const calls = await mockQloo(page, { rank: async (route) => { await pending.promise; await route.fulfill({ json: rankingResponse() }); } });
  await openExample(page);
  await guideDraft(page);
  await confirmPreset(page);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect.poll(() => calls.rank.length).toBe(1);
  await page.getByLabel("Choose catalogue CSV", { exact: true }).setInputFiles({
    name: "controlled-test-inventory.csv", mimeType: "text/csv",
    buffer: Buffer.from("title,author,price_inr,pages,language,stock\nLocal Evening,Test Writer,120,80,English,3\n"),
  });
  // An unconfirmed preview must leave the pending request and edited draft intact.
  await page.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expectGuideDraft(page);
  await expect(confirmed(page).getByRole("listitem")).toHaveCount(2);
  expect(calls.rank).toHaveLength(1);
  await expect(matching(page).getByRole("button", { name: "Ranking with Qloo…", exact: true })).toBeDisabled();
  await page.getByLabel("Choose catalogue CSV", { exact: true }).setInputFiles({
    name: "controlled-test-inventory.csv", mimeType: "text/csv",
    buffer: Buffer.from("title,author,price_inr,pages,language,stock\nLocal Evening,Test Writer,120,80,English,3\n"),
  });
  await page.getByRole("button", { name: "Replace catalogue", exact: true }).click();
  await expect(matching(page).getByRole("status")).toContainText("Qloo matching supports the sample catalogue only.");
  await expect(matching(page).getByRole("button", { name: "Rank with Qloo", exact: true })).toBeDisabled();
  await expect(matching(page).getByRole("button", { name: "Search Qloo", exact: true })).toBeDisabled();
  pending.resolve();
  await expect.poll(() => calls.completedRanks).toBe(1);
  await expect(ranking(page)).toHaveCount(0);
  await shelf(page).getByRole("button", { name: "Select: Local Evening", exact: true }).click();
  await page.getByLabel("Organizer notes", { exact: true }).fill("Local inventory still has an editable outline.");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("An evening with Local Evening");
  expect(calls.rank).toHaveLength(1);
  expect(calls.search).toHaveLength(0);
  await page.getByRole("button", { name: "Restore sample catalogue", exact: true }).click();
  await expect(matching(page).getByRole("button", { name: presetA.label, exact: true })).toBeEnabled();
  await expect(shelf(page).getByRole("heading", { name: "Local Evening", exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveCount(0);
  await expect(ranking(page)).toHaveCount(0);
  expect(calls.rank).toHaveLength(1);
});

test("390px ranked workspace keeps matching, eligible books, and the editable outline within the viewport", async ({ page }, testInfo) => {
  const calls = await mockQloo(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openExample(page);
  await confirmPreset(page);
  await matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }).click();
  await expect(ranking(page)).toBeVisible();
  await ranking(page).getByRole("button", { name: "Select ranked: The Guide", exact: true }).click();
  await page.getByLabel("Event title", { exact: true }).fill("A ranked-book gathering");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Use the accessible entrance and bring discussion cards.");
  const screenshotPath = testInfo.outputPath("qloo-ranked-workspace-mobile-390.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("Controlled Qloo ranking, eligible books, and outline at 390px", { path: screenshotPath, contentType: "image/png" });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.viewport).toBe(390);
  expect(widths.document, "Ranked workspace must not scroll horizontally").toBeLessThanOrEqual(390);
  expect(widths.body, "Ranked workspace body must not scroll horizontally").toBeLessThanOrEqual(390);
  const controls = matching(page).getByRole("button").or(matching(page).getByRole("textbox")).or(matching(page).getByRole("combobox"));
  const clipping = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    const name = element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName;
    const issues: string[] = [];
    if (rect.left < -1 || rect.right > 391) issues.push(`${name}: outside viewport`);
    if (element.scrollWidth > element.clientWidth + 1) issues.push(`${name}: clipped contents`);
    return issues;
  }));
  expect(clipping, "Matching controls must fit and remain readable at 390px").toEqual([]);
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Malgudi Days", "The Blue Umbrella", "The Guide"]);
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("A ranked-book gathering");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Use the accessible entrance and bring discussion cards.");
  expect(calls.rank).toHaveLength(1);
});

test("keyboard Tab, Space, Enter, and typing operate filters, search confirmation, ranked selection, and outline", async ({ page }) => {
  const calls = await mockQloo(page, { rank: async (route) => { await route.fulfill({ json: rankingResponse([searchCandidate]) }); } });
  await openExample(page);
  const english = page.getByRole("checkbox", { name: "English", exact: true });
  await tabTo(page, english);
  await expectKeyboardFocus(english);
  await page.keyboard.press("Space");
  await expect(english).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(english).toBeChecked();
  const query = matching(page).getByLabel("Find a film or musician", { exact: true });
  await tabTo(page, query);
  await expectKeyboardFocus(query);
  await page.keyboard.type("Amélie");
  await tabTo(page, matching(page).getByRole("button", { name: "Search Qloo", exact: true }));
  await page.keyboard.press("Enter");
  const candidate = matching(page).getByRole("radio", { name: /Amélie.*Film.*2001/ });
  await expect(candidate).toBeVisible();
  await tabTo(page, candidate);
  await expectKeyboardFocus(candidate);
  await page.keyboard.press("Space");
  await expect(candidate).toBeChecked();
  await tabTo(page, matching(page).getByRole("button", { name: "Confirm interest", exact: true }));
  await page.keyboard.press("Enter");
  await expect(confirmed(page).getByRole("listitem")).toHaveCount(1);
  await tabTo(page, matching(page).getByRole("button", { name: "Rank with Qloo", exact: true }));
  await page.keyboard.press("Enter");
  await expect(ranking(page)).toBeVisible();
  const select = ranking(page).getByRole("button", { name: "Select ranked: The Guide", exact: true });
  await tabTo(page, select);
  await expectKeyboardFocus(select);
  await page.keyboard.press("Enter");
  const title = page.getByLabel("Event title", { exact: true });
  await tabTo(page, title);
  await expectKeyboardFocus(title);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("A keyboard-planned evening");
  const notes = page.getByLabel("Organizer notes", { exact: true });
  await tabTo(page, notes);
  await expectKeyboardFocus(notes);
  await page.keyboard.type("Bring accessible discussion cards.");
  await expect(title).toHaveValue("A keyboard-planned evening");
  await expect(notes).toHaveValue("Bring accessible discussion cards.");
  expect(calls.search).toHaveLength(1);
  expect(calls.rank).toHaveLength(1);
});

async function tabTo(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === element.ownerDocument.activeElement)) return;
  }
  await expect(target, "Control must be reachable using the real Tab order").toBeFocused();
}

async function expectKeyboardFocus(target: Locator) {
  await expect(target).toBeFocused();
  await expect(target).toBeInViewport();
  const focus = await target.evaluate((element) => {
    const style = getComputedStyle(element);
    return { visible: element.matches(":focus-visible"), style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth), color: style.outlineColor };
  });
  expect(focus.visible).toBe(true);
  expect(focus.style).not.toBe("none");
  expect(focus.width).toBeGreaterThanOrEqual(2);
  expect(focus.color).not.toBe("rgba(0, 0, 0, 0)");
}
