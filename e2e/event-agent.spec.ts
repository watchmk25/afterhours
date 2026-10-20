import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { SAMPLE_CATALOGUE } from "../lib/catalogue";
import { QLOO_PRESETS } from "../lib/qloo-sample";
import type { EventAgentInput, EventAgentResponse, EventProposal, ProposalDraft } from "../lib/event-types";

// All wording, evidence values, and usage below are controlled test fixtures.
// They are never represented as observations from a live model/provider run.
const presetA = QLOO_PRESETS[0];
const presetB = QLOO_PRESETS[1];
const initialRequest = "Plan an interactive event with paired discussion and reflection.";
const draftTitle = "Keep my carefully edited Guide event";
const draftNotes = "Keep the accessible room and discussion cards.";
const mocks = new WeakMap<Page, { qlooCalls: string[] }>();

function proposal(bookId = "the-guide", eventTitle = "A controlled shared-reading evening"): EventProposal {
  const book = SAMPLE_CATALOGUE.find((item) => item.id === bookId);
  if (!book) throw new Error(`Unknown fixture book: ${bookId}`);
  return {
    selectedBookId: bookId,
    eventTitle,
    rationale: "Use the supplied audience evidence as a starting point for optional group discussion.",
    evidenceRefs: [`affinity:${bookId}`],
    agenda: [
      { title: "Welcome", minutes: 10, activity: "Invite participants to share a reading preference." },
      { title: "Paired discussion", minutes: 25, activity: "Offer open questions and let participants pass." },
      { title: "Closing reflection", minutes: 10, activity: "Invite a voluntary final reflection." },
    ],
    materials: ["Blank cards", "Pens"],
    invitation: "Join a relaxed book gathering with optional conversation and reflection.",
    book: { ...book },
    evidence: [{ id: `affinity:${bookId}`, bookId, kind: "affinity", value: 0.7 }],
    coverage: { eligibleCount: 3, supportedCount: 2, assessedCount: 2 },
    duration: 45,
    interests: [...presetA.interests],
    warnings: ["Controlled browser fixture: activities are proposed wording, not verified literary facts."],
  };
}

function proposalResponse(value = proposal()): EventAgentResponse {
  return {
    ok: true,
    result: { status: "proposal", proposal: value },
    trace: [
      { action: "gemini", status: "completed", detail: "Controlled proposal fixture returned." },
      { action: "rank_eligible_books", status: "completed", detail: "Controlled ranking evidence supplied." },
      { action: "validation", status: "completed", detail: "Controlled proposal accepted for this browser journey." },
    ],
    usage: { geminiRequests: 2, qlooRequests: 1 },
  };
}

function historicalDraft(value: EventProposal): ProposalDraft {
  return {
    selectedBookId: value.selectedBookId, eventTitle: value.eventTitle,
    rationale: value.rationale, evidenceRefs: [...value.evidenceRefs],
    agenda: value.agenda.map((item) => ({ ...item })),
    materials: [...value.materials], invitation: value.invitation,
  };
}

async function mockAgent(page: Page, handler?: (route: Route, body: EventAgentInput, index: number) => Promise<void>) {
  const calls = { requests: [] as EventAgentInput[], qlooCalls: [] as string[], completed: 0 };
  mocks.set(page, calls);
  await page.route("**/api/qloo/**", async (route) => {
    calls.qlooCalls.push(new URL(route.request().url()).pathname);
    await route.fulfill({ status: 503, json: { ok: false, error: { code: "CONTROLLED_TEST", message: "Unexpected browser Qloo request blocked by the test." } } });
  });
  await page.route("**/api/event-agent", async (route) => {
    expect(route.request().method()).toBe("POST");
    const body = route.request().postDataJSON() as EventAgentInput;
    calls.requests.push(body);
    if (handler) await handler(route, body, calls.requests.length);
    else await route.fulfill({ json: proposalResponse() });
    calls.completed += 1;
  });
  return calls;
}

test.afterEach(async ({ page }) => {
  expect(mocks.get(page)?.qlooCalls ?? [], "The planner must not start separate browser Qloo calls").toEqual([]);
});

function planner(page: Page) {
  return page.getByRole("region", { name: "Gemini event planner", exact: true });
}

function preview(page: Page) {
  return page.getByRole("region", { name: "Event proposal preview", exact: true });
}

function shelf(page: Page) {
  return page.getByRole("region", { name: /^Eligible books/ });
}

function outline(page: Page) {
  return page.getByRole("region", { name: "Event outline", exact: true });
}

async function openExample(page: Page) {
  await page.goto("/");
  await expect(page).toHaveTitle(/^AfterHours/);
  await expect(planner(page)).toBeVisible();
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await expect(shelf(page).getByRole("heading", { level: 3 })).toHaveText(["Malgudi Days", "The Blue Umbrella", "The Guide"]);
}

async function confirmPreset(page: Page) {
  await page.getByRole("button", { name: presetA.label, exact: true }).click();
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeEnabled();
}

async function makeGuideDraft(page: Page) {
  await shelf(page).getByRole("button", { name: "Select: The Guide", exact: true }).click();
  await page.getByLabel("Event title", { exact: true }).fill(draftTitle);
  await page.getByLabel("Organizer notes", { exact: true }).fill(draftNotes);
}

async function expectGuideDraft(page: Page) {
  await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(draftTitle);
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue(draftNotes);
}

async function generate(page: Page) {
  await planner(page).getByRole("button", { name: "Generate proposal", exact: true }).click();
  await expect(preview(page)).toBeVisible();
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeEnabled();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test("Generate previews a different book without changing the selected book or edited outline", async ({ page }, testInfo) => {
  const proposed = proposal("malgudi-days");
  const calls = await mockAgent(page, async (route) => { await route.fulfill({ json: proposalResponse(proposed) }); });
  await openExample(page);
  await makeGuideDraft(page);
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeDisabled();
  expect(calls.requests).toHaveLength(0);
  await confirmPreset(page);
  expect(calls.requests, "Confirming interests must not generate automatically").toHaveLength(0);
  await generate(page);
  await expect(preview(page).getByRole("heading", { name: "Malgudi Days", exact: true })).toBeVisible();
  await expect(preview(page)).toContainText("Qloo affinity: 0.7");
  await expect(preview(page)).toContainText("Gemini-proposed wording");
  await expect(preview(page)).toContainText("replaces your selected book and all event-outline fields");
  await expectGuideDraft(page);
  expect(calls.requests).toEqual([{
    catalogueSource: "sample", filters: { maxPrice: "450", maxPages: "300", languages: ["English"] },
    interests: presetA.interests.map((interest) => interest.reference),
    request: initialRequest, duration: 45, mode: "generate",
  }]);
  const screenshotPath = testInfo.outputPath("event-proposal-workspace-desktop.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("Controlled event proposal and preserved outline on desktop", { path: screenshotPath, contentType: "image/png" });
});

test("only Apply changes selection and populates the proposal fields", async ({ page }) => {
  const proposed = proposal("malgudi-days");
  const calls = await mockAgent(page, async (route) => { await route.fulfill({ json: proposalResponse(proposed) }); });
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await generate(page);
  await expectGuideDraft(page);
  await preview(page).getByRole("button", { name: "Apply proposal", exact: true }).click();
  await expect(shelf(page).getByRole("button", { name: "Selected: Malgudi Days", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(outline(page).getByRole("heading", { name: "Malgudi Days", exact: true })).toBeVisible();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(proposed.eventTitle);
  await expect(page.getByLabel("Running order", { exact: true })).toHaveValue(proposed.agenda.map((item) => `${item.title} — ${item.minutes} minutes\n${item.activity}`).join("\n\n"));
  await expect(page.getByLabel("Materials", { exact: true })).toHaveValue("Blank cards\nPens");
  await expect(page.getByLabel("Invitation", { exact: true })).toHaveValue(proposed.invitation);
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("");
  await expect(outline(page)).toContainText("Gemini proposal · editable");
  expect(calls.requests).toHaveLength(1);
});

test("Apply replaces an edited draft even when the proposal keeps the same selected book", async ({ page }) => {
  const calls = await mockAgent(page);
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await generate(page);
  await expectGuideDraft(page);
  await preview(page).getByRole("button", { name: "Apply proposal", exact: true }).click();
  await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(proposal().eventTitle);
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("");
  await page.getByLabel("Event title", { exact: true }).fill("A subsequent manual edit");
  await page.getByLabel("Materials", { exact: true }).fill("Edited materials");
  await preview(page).getByRole("button", { name: "Apply proposal", exact: true }).click();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(proposal().eventTitle);
  await expect(page.getByLabel("Materials", { exact: true })).toHaveValue("Blank cards\nPens");
  expect(calls.requests, "Applying locally must not generate another proposal").toHaveLength(1);
});

test("Revise uses current filters and a historical proposal while preserving the current draft until Apply", async ({ page }) => {
  const first = proposal("malgudi-days", "The earlier proposed gathering");
  const revised = proposal("the-guide", "A newly revised gathering");
  revised.coverage = { eligibleCount: 2, supportedCount: 1, assessedCount: 1 };
  const calls = await mockAgent(page, async (route, _body, index) => { await route.fulfill({ json: proposalResponse(index === 1 ? first : revised) }); });
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await generate(page);
  await page.getByLabel("Max price per copy", { exact: true }).fill("300");
  await expect(preview(page).getByRole("status")).toContainText("This preview is stale.");
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
  await expectGuideDraft(page);
  const request = "Revise the event for my current limits and preserve optional paired discussion.";
  await planner(page).getByLabel("Event request", { exact: true }).fill(request);
  expect(calls.requests).toHaveLength(1);
  await planner(page).getByRole("button", { name: "Revise proposal", exact: true }).click();
  await expect(preview(page).getByRole("heading", { name: revised.eventTitle, exact: true })).toBeVisible();
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeEnabled();
  expect(calls.requests[1]).toEqual({
    catalogueSource: "sample", filters: { maxPrice: "300", maxPages: "300", languages: ["English"] },
    interests: presetA.interests.map((interest) => interest.reference), request, duration: 45,
    mode: "revise", previousProposal: historicalDraft(first),
  });
  await expectGuideDraft(page);
  await preview(page).getByRole("button", { name: "Apply proposal", exact: true }).click();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(revised.eventTitle);
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("");
  expect(calls.requests).toHaveLength(2);
});

for (const error of [
  { status: 503, code: "NOT_CONFIGURED", message: "Gemini credentials are not configured on this server." },
  { status: 502, code: "GEMINI_REQUEST_REJECTED", message: "Gemini rejected this request. Check the API key's access, model configuration, and supported request settings before trying again." },
  { status: 502, code: "INVALID_PROPOSAL", message: "The proposal agenda did not meet the validated event duration. No proposal was accepted." },
  { status: 502, code: "INVALID_PROPOSAL", message: "The proposed book did not belong to the eligible ranked inventory. No proposal was accepted." },
]) {
  test(`${error.code}: ${error.message}`, async ({ page }) => {
    const calls = await mockAgent(page, async (route) => { await route.fulfill({ status: error.status, json: { ok: false, error: { code: error.code, message: error.message }, trace: [], usage: { geminiRequests: 0, qlooRequests: 0 } } satisfies EventAgentResponse }); });
    await openExample(page);
    await makeGuideDraft(page);
    await confirmPreset(page);
    await planner(page).getByRole("button", { name: "Generate proposal", exact: true }).click();
    await expect(planner(page).getByRole("alert")).toHaveText(error.message);
    await expect(preview(page)).toHaveCount(0);
    await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeEnabled();
    await expectGuideDraft(page);
    expect(calls.requests, "A failed provider request must not be retried or replaced automatically").toHaveLength(1);
  });
}

test("clarification asks for organizer input without generating a fallback proposal or replacing the draft", async ({ page }) => {
  const question = "Would you prefer paired discussion or a whole-group activity?";
  const calls = await mockAgent(page, async (route) => { await route.fulfill({ json: {
    ok: true, result: { status: "clarification", question }, trace: [], usage: { geminiRequests: 1, qlooRequests: 0 },
  } satisfies EventAgentResponse }); });
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await planner(page).getByRole("button", { name: "Generate proposal", exact: true }).click();
  await expect(planner(page).getByRole("heading", { name: "Clarification needed", exact: true })).toBeVisible();
  await expect(planner(page)).toContainText(question);
  await expect(preview(page)).toHaveCount(0);
  await expectGuideDraft(page);
  expect(calls.requests).toHaveLength(1);
});

test("pending generation permits one call, Cancel releases the UI, and a late response cannot replace a newer preview", async ({ page }) => {
  const pending = deferred();
  const calls = await mockAgent(page, async (route, _body, index) => {
    if (index === 1) await pending.promise;
    await route.fulfill({ json: proposalResponse(proposal("the-guide", index === 1 ? "The cancelled old proposal" : "The current proposal")) });
  });
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await planner(page).getByRole("button", { name: "Generate proposal", exact: true }).click();
  await expect.poll(() => calls.requests.length).toBe(1);
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeDisabled();
  await expect(planner(page).getByRole("button", { name: "Revise proposal", exact: true })).toBeDisabled();
  await expect(planner(page).getByRole("status")).toHaveText("Preparing proposal…");
  await page.keyboard.press("Enter");
  expect(calls.requests).toHaveLength(1);
  await planner(page).getByRole("button", { name: "Cancel generation", exact: true }).click();
  await expect(planner(page).getByRole("status")).toContainText("Generation cancelled locally.");
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeEnabled();
  await generate(page);
  await expect(preview(page).getByRole("heading", { name: "The current proposal", exact: true })).toBeVisible();
  pending.resolve();
  await expect.poll(() => calls.completed).toBe(2);
  await expect(preview(page)).not.toContainText("The cancelled old proposal");
  await expect(preview(page).getByRole("heading", { name: "The current proposal", exact: true })).toBeVisible();
  await expectGuideDraft(page);
  expect(calls.requests).toHaveLength(2);
});

test("a pending regeneration shows loading immediately and a deadline failure preserves edits without reviving Apply", async ({ page }) => {
  const pending = deferred();
  const message = "The planning run reached its overall deadline. No proposal was applied.";
  const calls = await mockAgent(page, async (route, _body, index) => {
    if (index === 1) {
      await route.fulfill({ json: proposalResponse() });
      return;
    }
    await pending.promise;
    await route.fulfill({ status: 504, json: {
      ok: false, error: { code: "RUN_TIMEOUT", message },
      trace: [{ action: "gemini", status: "failed", detail: "The run deadline ended this controlled test." }],
      usage: { geminiRequests: 1, qlooRequests: 0 },
    } satisfies EventAgentResponse });
  });
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await generate(page);
  await planner(page).getByRole("button", { name: "Generate proposal", exact: true }).click();
  await expect(planner(page).getByRole("status").filter({ hasText: /^Preparing proposal/ })).toBeVisible();
  await expect(planner(page).getByRole("button", { name: "Cancel generation", exact: true })).toBeEnabled();
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeDisabled();
  await expect(planner(page).getByRole("button", { name: "Revise proposal", exact: true })).toBeDisabled();
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
  await expectGuideDraft(page);
  const pendingNotes = `${draftNotes} Edited while waiting.`;
  await page.getByLabel("Organizer notes", { exact: true }).fill(pendingNotes);
  await expect.poll(() => calls.requests.length).toBe(2);
  // Enter edits the focused textarea; it must not submit another generation.
  await page.keyboard.press("Enter");
  expect(calls.requests).toHaveLength(2);
  pending.resolve();
  await expect(planner(page).getByRole("alert")).toHaveText(message);
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeEnabled();
  await expect(planner(page).getByRole("button", { name: "Cancel generation", exact: true })).toHaveCount(0);
  await expect(preview(page).getByRole("status")).toContainText("This preview is stale.");
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
  await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(draftTitle);
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue(`${pendingNotes}\n`);
  expect(calls.requests, "The failed attempt must neither retry nor reactivate the previous proposal").toHaveLength(2);
});

for (const context of ["filters", "interests", "request", "duration"] as const) {
  test(`${context} A-to-B-to-A changes never revive an old proposal's Apply action`, async ({ page }) => {
    const calls = await mockAgent(page);
    await openExample(page);
    await makeGuideDraft(page);
    await confirmPreset(page);
    await generate(page);
    if (context === "filters") {
      await page.getByLabel("Max price per copy", { exact: true }).fill("400");
      await page.getByLabel("Max price per copy", { exact: true }).fill("450");
    } else if (context === "interests") {
      await page.getByRole("button", { name: presetB.label, exact: true }).click();
      await page.getByRole("button", { name: presetA.label, exact: true }).click();
    } else if (context === "request") {
      await planner(page).getByLabel("Event request", { exact: true }).fill("Use a different format for this event.");
      await planner(page).getByLabel("Event request", { exact: true }).fill(initialRequest);
    } else {
      await planner(page).getByLabel("Event duration (minutes)", { exact: true }).fill("60");
      await planner(page).getByLabel("Event duration (minutes)", { exact: true }).fill("45");
    }
    await expect(preview(page).getByRole("status")).toContainText("This preview is stale.");
    await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
    await expectGuideDraft(page);
    expect(calls.requests, "Context changes alone must never generate").toHaveLength(1);
  });
}

for (const action of ["Reset", "Load example"]) {
  test(`${action} clears proposal state, confirmed interests, selection, and the old outline`, async ({ page }) => {
    const calls = await mockAgent(page);
    await openExample(page);
    await makeGuideDraft(page);
    await confirmPreset(page);
    await generate(page);
    await planner(page).getByLabel("Event request", { exact: true }).fill("Replace the current request temporarily.");
    await planner(page).getByLabel("Event duration (minutes)", { exact: true }).fill("60");
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(preview(page)).toHaveCount(0);
    await expect(planner(page).getByLabel("Event request", { exact: true })).toHaveValue(initialRequest);
    await expect(planner(page).getByLabel("Event duration (minutes)", { exact: true })).toHaveValue("45");
    await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeDisabled();
    await expect(page.getByRole("list", { name: "Confirmed interests", exact: true })).toHaveCount(0);
    await expect(outline(page).getByRole("textbox")).toHaveCount(0);
    await expect(shelf(page).getByRole("button", { pressed: true })).toHaveCount(0);
    expect(calls.requests).toHaveLength(1);
  });
}

test("CSV cancellation preserves the preview and draft; confirmed import and sample restoration never apply a stale proposal", async ({ page }) => {
  const calls = await mockAgent(page, async (route, _body, index) => { await route.fulfill({ json: proposalResponse(proposal("the-guide", index === 1 ? "Before catalogue replacement" : "A fresh restored-sample proposal")) }); });
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await generate(page);
  const csv = { name: "controlled-local-inventory.csv", mimeType: "text/csv", buffer: Buffer.from("title,author,price_inr,pages,language,stock\nLocal Evening,Test Writer,120,80,English,3\n") };
  await page.getByLabel("Choose catalogue CSV", { exact: true }).setInputFiles(csv);
  await page.getByRole("button", { name: "Cancel import", exact: true }).click();
  await expect(preview(page).getByRole("heading", { name: "Before catalogue replacement", exact: true })).toBeVisible();
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeEnabled();
  await expectGuideDraft(page);
  await page.getByLabel("Choose catalogue CSV", { exact: true }).setInputFiles(csv);
  await page.getByRole("button", { name: "Replace catalogue", exact: true }).click();
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeDisabled();
  await expect(planner(page).getByRole("button", { name: "Revise proposal", exact: true })).toBeDisabled();
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
  await expect(preview(page).getByRole("status")).toContainText("This preview is stale.");
  await expect(outline(page).getByRole("textbox")).toHaveCount(0);
  await expect(planner(page).getByLabel("Event request", { exact: true })).toBeDisabled();
  expect(calls.requests).toHaveLength(1);
  await shelf(page).getByRole("button", { name: "Select: Local Evening", exact: true }).click();
  await page.getByLabel("Organizer notes", { exact: true }).fill("Local templates still work.");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("An evening with Local Evening");
  await page.getByRole("button", { name: "Restore sample catalogue", exact: true }).click();
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeEnabled();
  await expect(preview(page).getByRole("button", { name: "Apply proposal", exact: true })).toBeDisabled();
  await expect(outline(page).getByRole("textbox")).toHaveCount(0);
  expect(calls.requests).toHaveLength(1);
  await generate(page);
  await expect(preview(page).getByRole("heading", { name: "A fresh restored-sample proposal", exact: true })).toBeVisible();
  await expect(outline(page).getByRole("textbox")).toHaveCount(0);
  expect(calls.requests).toHaveLength(2);
});

test("390px proposal preview, eligible shelf, and selected outline fit without horizontal overflow", async ({ page }, testInfo) => {
  const calls = await mockAgent(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openExample(page);
  await makeGuideDraft(page);
  await confirmPreset(page);
  await generate(page);
  const screenshotPath = testInfo.outputPath("event-proposal-workspace-mobile-390.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  await testInfo.attach("Controlled event proposal, eligible books, and selected outline at 390px", { path: screenshotPath, contentType: "image/png" });
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(widths.viewport).toBe(390);
  expect(widths.document, "Proposal workspace must not scroll horizontally").toBeLessThanOrEqual(390);
  expect(widths.body).toBeLessThanOrEqual(390);
  const controls = page.getByRole("main").getByRole("button")
    .or(page.getByRole("main").getByRole("textbox"))
    .or(page.getByRole("main").getByRole("spinbutton"))
    .or(page.getByRole("main").getByRole("combobox"))
    .or(page.getByRole("main").getByRole("checkbox"));
  const issues = await controls.evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return [];
    const name = element.getAttribute("aria-label") || element.id || element.textContent?.trim() || element.tagName;
    const problems: string[] = [];
    if (rect.left < -1 || rect.right > 391) problems.push(`${name}: outside viewport`);
    if (element.scrollWidth > element.clientWidth + 1) problems.push(`${name}: content clipped`);
    return problems;
  }));
  expect(issues, "Planner, matching, filter, and outline controls must fit at 390px").toEqual([]);
  await expect(preview(page)).toContainText("Qloo affinity: 0.7");
  await expect(shelf(page).getByRole("listitem")).toHaveCount(3);
  await expectGuideDraft(page);
  expect(calls.requests).toHaveLength(1);
});

test("real keyboard navigation confirms interests, generates and applies a preview, then edits the outline", async ({ page }) => {
  const calls = await mockAgent(page);
  await openExample(page);
  const english = page.getByRole("checkbox", { name: "English", exact: true });
  await tabTo(page, english);
  await expectKeyboardFocus(english);
  await page.keyboard.press("Space");
  await expect(english).not.toBeChecked();
  await page.keyboard.press("Space");
  await expect(english).toBeChecked();
  const preset = page.getByRole("button", { name: presetA.label, exact: true });
  await tabTo(page, preset);
  await expectKeyboardFocus(preset);
  await page.keyboard.press("Enter");
  await expect(planner(page).getByRole("button", { name: "Generate proposal", exact: true })).toBeEnabled();
  const request = planner(page).getByLabel("Event request", { exact: true });
  await tabTo(page, request);
  await expectKeyboardFocus(request);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("Plan a welcoming event with optional paired discussion.");
  const duration = planner(page).getByLabel("Event duration (minutes)", { exact: true });
  await tabTo(page, duration);
  await expectKeyboardFocus(duration);
  const generateButton = planner(page).getByRole("button", { name: "Generate proposal", exact: true });
  await tabTo(page, generateButton);
  await expectKeyboardFocus(generateButton);
  await page.keyboard.press("Enter");
  await expect(preview(page)).toBeVisible();
  await expect(outline(page).getByRole("textbox")).toHaveCount(0);
  const apply = preview(page).getByRole("button", { name: "Apply proposal", exact: true });
  await tabTo(page, apply);
  await expectKeyboardFocus(apply);
  await page.keyboard.press("Enter");
  const title = page.getByLabel("Event title", { exact: true });
  await tabTo(page, title);
  await expectKeyboardFocus(title);
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("A keyboard-applied evening");
  const notes = page.getByLabel("Organizer notes", { exact: true });
  await tabTo(page, notes);
  await expectKeyboardFocus(notes);
  await page.keyboard.type("Bring accessible discussion cards.");
  await expect(title).toHaveValue("A keyboard-applied evening");
  await expect(notes).toHaveValue("Bring accessible discussion cards.");
  await expect(shelf(page).getByRole("button", { name: "Selected: The Guide", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(calls.requests).toHaveLength(1);
  expect(calls.requests[0].request).toBe("Plan a welcoming event with optional paired discussion.");
});

async function tabTo(page: Page, target: Locator) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
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
