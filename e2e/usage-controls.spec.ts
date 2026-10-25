import { expect, test, type Locator, type Page } from "./fixtures";
import { SAMPLE_CATALOGUE } from "../lib/catalogue";
import { QLOO_PRESETS } from "../lib/qloo-sample";
import type { EventAgentResponse, EventProposal } from "../lib/event-types";

// All errors, proposal text, scores, and usage below are controlled browser
// fixtures. These tests exercise UI states and never dispatch provider requests.
const failures = {
  limited: { status: 429, code: "USAGE_LIMITED", message: "The demo's search allowance is used up. Try again in 60 seconds." },
  busy: { status: 429, code: "USAGE_BUSY", message: "The demo is already planning another event. Try again in 45 seconds." },
  unavailable: { status: 503, code: "USAGE_UNAVAILABLE", message: "Live services are temporarily unavailable because usage protection could not be checked. Please try again shortly." },
  disabled: { status: 503, code: "LIVE_DISABLED", message: "Live demo requests are paused by the operator. Local filters and event templates remain available." },
} as const;

function matching(page: Page) {
  return page.getByRole("region", { name: "Live Qloo matching", exact: true });
}

function planner(page: Page) {
  return page.getByRole("region", { name: "Gemini event planner", exact: true });
}

function outline(page: Page) {
  return page.getByRole("region", { name: "Event outline", exact: true });
}

function shelf(page: Page) {
  return page.getByRole("region", { name: /^Eligible books/ });
}

async function exampleWithDraft(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle(/^AfterHours/);
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expect(matching(page).getByRole("list", { name: "Confirmed interests", exact: true }).getByRole("listitem")).toHaveCount(2);
  await shelf(page).getByRole("button", { name: "Select: The Guide", exact: true }).click();
  await page.getByLabel("Event title", { exact: true }).fill("Keep my organizer's draft");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep the accessible room and large-print cards.");
}

async function expectDraft(page: Page) {
  await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Keep my organizer's draft");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep the accessible room and large-print cards.");
}

async function keyboardFocus(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === element.ownerDocument.activeElement)) break;
  }
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

test("search allowance rejection preserves the workspace and supports an explicit keyboard retry", async ({ page }) => {
  const paths: string[] = [];
  const candidate = { ...QLOO_PRESETS[1].interests[0], reference: { token: "controlled-usage-recovery-candidate" } };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    paths.push(path);
    if (path !== "/api/qloo/search") {
      await route.abort();
      throw new Error("Unexpected API work after a usage rejection");
    }
    expect(route.request().method()).toBe("POST");
    expect(route.request().postDataJSON()).toEqual({ query: "Interstellar", kind: "movie" });
    if (paths.length === 1) {
      await route.fulfill({ status: failures.limited.status, headers: { "Retry-After": "60" }, json: { ok: false, error: { code: failures.limited.code, message: failures.limited.message } } });
    } else {
      await route.fulfill({ json: { ok: true, candidates: [candidate] } });
    }
  });
  await exampleWithDraft(page);
  expect(paths, "Load example and manual draft editing must make no API requests").toEqual([]);
  const query = matching(page).getByLabel("Find a film or musician", { exact: true });
  await query.fill("Interstellar");
  expect(paths, "Typing must not consume the allowance").toEqual([]);
  const search = matching(page).getByRole("button", { name: "Search Qloo", exact: true });
  await query.focus();
  await keyboardFocus(page, search);
  await page.keyboard.press("Enter");
  await expect(matching(page).getByRole("alert")).toHaveText(failures.limited.message);
  await expect(matching(page).getByRole("radio")).toHaveCount(0);
  await expect(query).toHaveValue("Interstellar");
  await expect(search).toBeEnabled();
  await expectDraft(page);
  expect(paths, "A denial must not trigger a retry or a ranking").toEqual(["/api/qloo/search"]);

  await query.focus();
  await keyboardFocus(page, search);
  await page.keyboard.press("Enter");
  const choice = matching(page).getByRole("radio", { name: /Interstellar.*Film.*2014/ });
  await expect(choice).toBeVisible();
  await keyboardFocus(page, choice);
  await page.keyboard.press("Space");
  await expect(choice).toBeChecked();
  const confirm = matching(page).getByRole("button", { name: "Confirm interest", exact: true });
  await keyboardFocus(page, confirm);
  await page.keyboard.press("Enter");
  await expect(matching(page).getByRole("list", { name: "Confirmed interests", exact: true }).getByRole("listitem")).toHaveCount(3);
  await expect(matching(page).getByRole("alert")).toHaveCount(0);
  await expectDraft(page);
  expect(paths).toEqual(["/api/qloo/search", "/api/qloo/search"]);
});

test("ranking busy, store-failure, and operator-paused states keep local work usable without fallback", async ({ page }) => {
  const outcomes = [failures.busy, failures.unavailable, failures.disabled];
  const paths: string[] = [];
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    paths.push(path);
    const failure = outcomes[paths.length - 1];
    if (path !== "/api/qloo/rank" || !failure) {
      await route.abort();
      throw new Error("Unexpected API work after a usage rejection");
    }
    await route.fulfill({ status: failure.status, json: { ok: false, error: { code: failure.code, message: failure.message } } });
  });
  await exampleWithDraft(page);
  const rank = matching(page).getByRole("button", { name: "Rank with Qloo", exact: true });
  expect(paths).toEqual([]);
  for (const [index, failure] of outcomes.entries()) {
    await rank.click();
    await expect(matching(page).getByRole("alert")).toHaveText(failure.message);
    await expect(rank).toBeEnabled();
    await expect(page.getByRole("region", { name: "Qloo ranking", exact: true })).toHaveCount(0);
    await expect(matching(page)).not.toContainText("Qloo affinity:");
    await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Malgudi Days", "The Blue Umbrella", "The Guide"]);
    await expectDraft(page);
    expect(paths).toHaveLength(index + 1);
  }
  await page.getByLabel("Max price per copy", { exact: true }).fill("400");
  await expectDraft(page);
  await page.getByLabel("Organizer notes", { exact: true }).fill("Manual planning is still available while live work is paused.");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Manual planning is still available while live work is paused.");
  expect(paths).toEqual(["/api/qloo/rank", "/api/qloo/rank", "/api/qloo/rank"]);
});

function controlledProposal(): EventProposal {
  const book = SAMPLE_CATALOGUE.find((candidate) => candidate.id === "the-guide");
  if (!book) throw new Error("Controlled proposal requires the bundled Guide fixture");
  return {
    selectedBookId: book.id,
    book: { ...book },
    eventTitle: "Controlled applied event before a usage denial",
    rationale: "An optional shared-reading discussion supported by the supplied numerical evidence.",
    evidenceRefs: ["affinity:the-guide"],
    evidence: [{ id: "affinity:the-guide", bookId: book.id, kind: "affinity", value: 0.7 }],
    coverage: { eligibleCount: 3, supportedCount: 2, assessedCount: 2 },
    duration: 45,
    interests: [...QLOO_PRESETS[0].interests],
    agenda: [
      { title: "Welcome", minutes: 10, activity: "Invite participants to introduce themselves optionally." },
      { title: "Discussion", minutes: 25, activity: "Offer an open question and let participants pass." },
      { title: "Reflection", minutes: 10, activity: "Invite a voluntary closing reflection." },
    ],
    materials: ["Large-print question cards"],
    invitation: "Join a relaxed gathering with optional discussion.",
    warnings: ["Controlled browser fixture; these values are not live provider observations."],
  };
}

test("denied revisions preserve applied evidence and edits with keyboard access and readable 390px states", async ({ page }, testInfo) => {
  const paths: string[] = [];
  const value = controlledProposal();
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    paths.push(path);
    if (path !== "/api/event-agent" || paths.length > 3) {
      await route.abort();
      throw new Error("Unexpected API work after an event admission rejection");
    }
    if (paths.length === 1) {
      await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal: value }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } satisfies EventAgentResponse });
    } else {
      const failure = paths.length === 2 ? failures.busy : failures.unavailable;
      await route.fulfill({ status: failure.status, ...(paths.length === 2 ? { headers: { "Retry-After": "45" } } : {}), json: { ok: false, error: { code: failure.code, message: failure.message }, trace: [], usage: { geminiRequests: 0, qlooRequests: 0 } } satisfies EventAgentResponse });
    }
  });
  await exampleWithDraft(page);
  await planner(page).getByRole("button", { name: "Generate proposal", exact: true }).click();
  const preview = page.getByRole("region", { name: "Event proposal preview", exact: true });
  await expect(preview).toBeVisible();
  await expectDraft(page);
  await preview.getByRole("button", { name: "Apply proposal", exact: true }).click();
  const context = outline(page).getByRole("region", { name: "Applied event context", exact: true });
  await context.getByText("Applied filters and numerical evidence", { exact: true }).click();
  await expect(context).toContainText("Qloo assessed 2 of 3 eligible books; 2 had reviewed mappings.");
  await expect(context).toContainText("Qloo affinity: 0.7");
  await expect(context).toContainText(value.warnings[0]);
  const edits = {
    "Event title": "Keep my reviewed applied event",
    "Running order": "Keep this organizer's own running order",
    "Discussion prompts": "My optional discussion question",
    "Materials": "Edited accessible cards",
    "Invitation": "My reviewed invitation",
    "Organizer notes": "Keep accessible seating",
  };
  for (const [label, text] of Object.entries(edits)) await page.getByLabel(label, { exact: true }).fill(text);
  await page.getByLabel("Max price per copy", { exact: true }).fill("400");
  await expect(context.getByRole("status")).toContainText("Based on previous inputs.");

  for (const [index, failure] of [failures.busy, failures.unavailable].entries()) {
    const revise = planner(page).getByRole("button", { name: "Revise proposal", exact: true });
    await keyboardFocus(page, revise);
    await page.keyboard.press("Enter");
    await expect(planner(page).getByRole("alert")).toHaveText(failure.message);
    await expect(revise).toBeEnabled();
    await expect(planner(page).getByRole("button", { name: "Cancel generation", exact: true })).toHaveCount(0);
    await expect(preview.getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
    await expect(preview.getByRole("status")).toContainText("This preview is stale.");
    for (const [label, text] of Object.entries(edits)) await expect(page.getByLabel(label, { exact: true })).toHaveValue(text);
    await expect(context).toContainText("Maximum ₹450 per copy");
    await expect(context).toContainText("Qloo affinity: 0.7");
    expect(paths).toHaveLength(index + 2);
  }
  const notes = page.getByLabel("Organizer notes", { exact: true });
  await keyboardFocus(page, notes);
  await page.keyboard.press("End");
  await page.keyboard.type(" and a quiet corner.");
  await expect(notes).toHaveValue("Keep accessible seating and a quiet corner.");
  await expect(planner(page).getByRole("alert")).toHaveText(failures.unavailable.message);
  await planner(page).getByText("Run activity", { exact: true }).click();
  await expect(planner(page)).toContainText("Gemini requests: 0");
  await expect(planner(page)).toContainText("Qloo requests: 0");
  expect(paths).toEqual(["/api/event-agent", "/api/event-agent", "/api/event-agent"]);

  await page.setViewportSize({ width: 390, height: 844 });
  await planner(page).getByRole("alert").scrollIntoViewIfNeeded();
  const sizes = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(sizes).toEqual({ viewport: 390, document: 390, body: 390 });
  const alert = planner(page).getByRole("alert");
  const readability = await alert.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return { fontSize: Number.parseFloat(style.fontSize), left: box.left, right: box.right, clipped: element.scrollWidth > element.clientWidth + 1 };
  });
  expect(readability.fontSize).toBeGreaterThanOrEqual(12);
  expect(readability.left).toBeGreaterThanOrEqual(0);
  expect(readability.right).toBeLessThanOrEqual(390);
  expect(readability.clipped).toBe(false);
  const controls = page.getByRole("main").getByRole("button").or(page.getByRole("main").getByRole("textbox")).or(page.getByRole("main").getByRole("spinbutton"));
  const clipped = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const box = element.getBoundingClientRect();
    if (!box.width || !box.height) return [];
    return box.left < -1 || box.right > 391 || element.scrollWidth > element.clientWidth + 1
      ? [element.getAttribute("aria-label") || element.id || element.textContent?.trim() || element.tagName] : [];
  }));
  expect(clipped, "Usage messages and local editing controls must fit at 390px").toEqual([]);
  const screenshotPath = testInfo.outputPath("usage-denied-applied-event-mobile-390.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("Controlled admission denial with preserved applied event at 390px", { path: screenshotPath, contentType: "image/png" });
});

for (const stage of ["initial", "continuation"] as const) {
  test(`${stage} Gemini pacing denial preserves the applied event without automatic retries at 390px`, async ({ page }, testInfo) => {
    const requests: string[] = [];
    const value = controlledProposal();
    const retrySeconds = stage === "initial" ? 18 : 12;
    const message = `The shared live planner is at its short-term request limit. Wait ${retrySeconds} seconds before trying again. Your current edits remain available.`;
    const usage = stage === "initial" ? { geminiRequests: 0, qlooRequests: 0 } : { geminiRequests: 1, qlooRequests: 1 };
    const trace: EventAgentResponse["trace"] = stage === "initial" ? [
      { action: "usage_admission", status: "completed", detail: "Controlled initial shared admission accepted.", elapsedMs: 2 },
      { action: "gemini_pacing", status: "failed", detail: "Controlled shared minute allowance denied before any provider dispatch.", elapsedMs: 2 },
    ] : [
      { action: "usage_admission", status: "completed", detail: "Controlled initial shared admission accepted.", elapsedMs: 2 },
      { action: "gemini_pacing", status: "completed", detail: "Controlled shared minute allowance accepted the first request.", elapsedMs: 2 },
      { action: "gemini", status: "completed", detail: "Controlled native ranking tool request returned.", elapsedMs: 5 },
      { action: "rank_eligible_books", status: "completed", detail: "Controlled current-run ranking supplied.", elapsedMs: 3 },
      { action: "gemini_pacing", status: "failed", detail: "Controlled shared pacing denied continuation before another Gemini dispatch.", elapsedMs: 2 },
    ];
    await page.route("**/api/**", async (route) => {
      const path = new URL(route.request().url()).pathname;
      requests.push(path);
      if (path !== "/api/event-agent" || requests.length > 2) {
        await route.abort();
        throw new Error("Pacing denial must not trigger fallback work or automatic retries");
      }
      expect(route.request().method()).toBe("POST");
      if (requests.length === 1) {
        await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal: value }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } satisfies EventAgentResponse });
      } else {
        expect(route.request().postDataJSON()).toMatchObject({ mode: "revise", duration: 45, filters: { maxPrice: "400" } });
        await route.fulfill({ status: 429, headers: { "Retry-After": String(retrySeconds) }, json: { ok: false, error: { code: "GEMINI_PACING_LIMIT", message }, trace, usage } satisfies EventAgentResponse });
      }
    });

    await exampleWithDraft(page);
    await planner(page).getByRole("button", { name: "Generate proposal", exact: true }).click();
    const preview = page.getByRole("region", { name: "Event proposal preview", exact: true });
    await expect(preview).toBeVisible();
    await expectDraft(page);
    await preview.getByRole("button", { name: "Apply proposal", exact: true }).click();
    const context = outline(page).getByRole("region", { name: "Applied event context", exact: true });
    await context.getByText("Applied filters and numerical evidence", { exact: true }).click();
    const edits = {
      "Event title": "Keep this applied gathering during shared pacing",
      "Running order": "An organizer's carefully revised running order",
      "Discussion prompts": "A participant may pass on any question",
      "Materials": "Large-print cards and quiet-room signs",
      "Invitation": "My reviewed invitation wording stays intact",
      "Organizer notes": "Keep accessible seating",
    };
    for (const [label, text] of Object.entries(edits)) await page.getByLabel(label, { exact: true }).fill(text);
    await page.getByLabel("Max price per copy", { exact: true }).fill("400");
    await expect(context.getByRole("status")).toContainText("Based on previous inputs.");
    const request = planner(page).getByLabel("Event request", { exact: true });
    await keyboardFocus(page, request);
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.type("Keep a 45-minute interactive event with optional discussion.");
    const revise = planner(page).getByRole("button", { name: "Revise proposal", exact: true });
    await keyboardFocus(page, revise);
    await page.keyboard.press("Enter");
    await expect(planner(page).getByRole("alert")).toHaveText(message);
    await expect(revise).toBeEnabled();
    await expect(planner(page).getByRole("button", { name: "Cancel generation", exact: true })).toHaveCount(0);
    await expect(preview.getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
    await expect(preview.getByRole("status")).toContainText("This preview is stale.");
    await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
    for (const [label, text] of Object.entries(edits)) await expect(page.getByLabel(label, { exact: true })).toHaveValue(text);
    await expect(context).toContainText("Amélie (2001)");
    await expect(context).toContainText("Norah Jones");
    await expect(context).toContainText("Qloo assessed 2 of 3 eligible books; 2 had reviewed mappings.");
    await expect(context).toContainText("Maximum ₹450 per copy");
    await expect(context).toContainText("Qloo affinity: 0.7");
    await expect(context).toContainText(value.warnings[0]);
    await planner(page).getByText("Run activity", { exact: true }).click();
    await expect(planner(page)).toContainText(`Gemini requests: ${usage.geminiRequests}`);
    await expect(planner(page)).toContainText(`Qloo requests: ${usage.qlooRequests}`);
    await expect(planner(page)).toContainText(trace[trace.length - 1].detail);
    expect(requests, "The rejection must stop the run after this explicit revision").toEqual(["/api/event-agent", "/api/event-agent"]);

    const notes = page.getByLabel("Organizer notes", { exact: true });
    await keyboardFocus(page, notes);
    await page.keyboard.press("End");
    await page.keyboard.type(" and a quiet corner.");
    await expect(notes).toHaveValue("Keep accessible seating and a quiet corner.");
    await expect(planner(page).getByRole("alert")).toHaveText(message);
    expect(requests).toHaveLength(2);

    await page.setViewportSize({ width: 390, height: 844 });
    await planner(page).getByRole("alert").scrollIntoViewIfNeeded();
    const size = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(size).toEqual({ viewport: 390, document: 390, body: 390 });
    const alertSize = await planner(page).getByRole("alert").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { fontSize: Number.parseFloat(getComputedStyle(element).fontSize), left: rect.left, right: rect.right, clipped: element.scrollWidth > element.clientWidth + 1 };
    });
    expect(alertSize.fontSize).toBeGreaterThanOrEqual(12);
    expect(alertSize.left).toBeGreaterThanOrEqual(0);
    expect(alertSize.right).toBeLessThanOrEqual(390);
    expect(alertSize.clipped).toBe(false);
    const controls = planner(page).getByRole("button").or(planner(page).getByRole("textbox")).or(outline(page).getByRole("textbox"));
    const clipped = await controls.evaluateAll((elements) => elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      return rect.left < -1 || rect.right > 391 || element.scrollWidth > element.clientWidth + 1
        ? [element.id || element.textContent?.trim() || element.tagName] : [];
    }));
    expect(clipped, "Pacing state controls and edited outline must fit at 390px").toEqual([]);
    const screenshotPath = testInfo.outputPath(`gemini-${stage}-pacing-preserved-event-mobile-390.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    await testInfo.attach(`Controlled ${stage} pacing denial and preserved applied event at 390px`, { path: screenshotPath, contentType: "image/png" });
  });
}
