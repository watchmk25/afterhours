import { test, expect, candidate, discovery, configure } from "./club-fixtures";

test("one mixed search debounces Unicode input, ignores short queries and reuses a recent page-session query", async ({ page }) => {
  let calls = 0; const queries: string[] = [];
  await page.route("**/api/club/search", async (route) => { calls++; queries.push(route.request().postDataJSON().query); await route.fulfill({ json: { ok: true, candidates: [candidate("movie").entity, candidate("artist").entity] } }); });
  // Freeze time between actions so locator/transport latency cannot consume
  // part of the 475 ms debounce before the explicit 474 ms boundary check.
  await page.clock.install({ time: new Date("2026-10-30T00:00:00Z") });
  await page.goto("/"); await page.clock.pauseAt(new Date("2026-10-30T00:01:00Z"));
  const input = page.getByRole("combobox", { name: "Audience interests" });
  await input.fill("é"); await page.clock.runFor(500); expect(calls).toBe(0);
  await input.fill("映画の集い"); await page.clock.runFor(474); expect(calls).toBe(0);
  await page.clock.runFor(2); await expect(page.getByRole("option", { name: /Fixture Film/ })).toBeVisible(); expect(calls).toBe(1);
  await page.getByRole("option", { name: /Fixture Film/ }).click();
  await input.fill("映画の集い"); await page.clock.runFor(500);
  await expect(page.getByRole("option", { name: /Fixture Artist/ })).toBeVisible(); expect(calls).toBe(1); expect(queries).toEqual(["映画の集い"]);
  await page.keyboard.press("Escape"); await expect(input).toHaveAttribute("aria-expanded", "false");
});

test("IME composition sends nothing until composition ends", async ({ page }) => {
  let calls = 0; await page.route("**/api/club/search", (route) => { calls++; return route.fulfill({ json: { ok: true, candidates: [] } }); });
  await page.goto("/"); await page.clock.install(); const input = page.getByRole("combobox", { name: "Audience interests" });
  await input.dispatchEvent("compositionstart"); await input.fill("音楽交流会"); await page.clock.runFor(1000); expect(calls).toBe(0);
  await input.dispatchEvent("compositionend"); await page.clock.runFor(500);
  await expect(page.getByText(/No matching supported interests/)).toBeVisible(); expect(calls).toBe(1);
});

for (const action of ["Reset", "Try an example"]) test(`${action} clears a pending interest query without making its delayed request`, async ({ page }) => {
  let calls = 0;
  await page.route("**/api/club/search", (route) => { calls++; return route.fulfill({ json: { ok: true, candidates: [] } }); });
  await page.goto("/"); await page.clock.install();
  await page.getByRole("combobox", { name: "Audience interests" }).fill("A delayed search"); await page.clock.runFor(200);
  await page.getByRole("button", { name: action, exact: true }).click(); await page.clock.runFor(1000);
  expect(calls).toBe(0);
  await expect(page.getByRole("combobox", { name: "Audience interests" })).toHaveValue("");
  await expect(page.getByRole("list", { name: "Confirmed interests" }).locator("li")).toHaveCount(action === "Reset" ? 0 : 2);
});

test("ambiguous names require explicit confirmation; duplicate chips and more than five interests are prevented", async ({ page }) => {
  const first = candidate("book").entity; const second = { ...first, entityId: "44444444-4444-4444-8444-444444444444", metadata: { creator: "Different author" }, reference: { token: "synthetic-other.reference" } };
  await page.route("**/api/club/search", (route) => route.fulfill({ json: { ok: true, candidates: [first, second] } }));
  await page.goto("/"); const input = page.getByRole("combobox", { name: "Audience interests" }); await input.fill("Guide");
  await expect(page.getByRole("listbox", { name: "Cultural interest results" }).getByRole("option")).toHaveCount(2);
  await expect(page.getByRole("list", { name: "Confirmed interests" }).locator("li")).toHaveCount(0);
  await page.getByRole("option", { name: /Different author/ }).click();
  await expect(page.getByRole("list", { name: "Confirmed interests" })).toContainText("The Guide");
  for (const name of [/Amélie/, /Norah Jones/, /Interstellar/, /Hans Zimmer/]) { await input.click(); await page.getByRole("listbox", { name: "Reviewed interest examples" }).getByRole("option", { name }).click(); }
  await expect(page.getByRole("list", { name: "Confirmed interests" }).locator("li")).toHaveCount(5);
  await input.click(); await page.getByRole("listbox", { name: "Reviewed interest examples" }).getByRole("option", { name: /Amélie/ }).click(); await expect(page.getByText("Amélie is already confirmed.", { exact: true })).toBeVisible();
  await input.fill("Guide"); await page.getByRole("option", { name: /R. K. Narayan/ }).click();
  await expect(page.getByText(/Five interests are already confirmed/)).toBeVisible();
  await page.getByRole("button", { name: "Remove Hans Zimmer" }).click(); await expect(page.getByRole("list", { name: "Confirmed interests" }).locator("li")).toHaveCount(4);
});

test("changing search cancels the prior query and rejects its late response", async ({ page }) => {
  let release!: () => void; let firstStarted!: () => void;
  const started = new Promise<void>((resolve) => { firstStarted = resolve; }); const delayed = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/club/search", async (route) => {
    if (route.request().postDataJSON().query === "First query") { firstStarted(); await delayed; await route.fulfill({ json: { ok: true, candidates: [candidate("book").entity] } }).catch(() => {}); }
    else await route.fulfill({ json: { ok: true, candidates: [candidate("place").entity] } });
  });
  await page.goto("/"); const input = page.getByRole("combobox", { name: "Audience interests" }); await input.fill("First query"); await started;
  await input.fill("Next query"); release();
  await expect(page.getByRole("option", { name: /Fixture Cafe/ })).toBeVisible(); await expect(page.getByRole("option", { name: /The Guide/ })).toHaveCount(0);
});

for (const [name, status, body, message] of [
  ["empty", 200, { ok: true, candidates: [] }, /No matching supported interests/],
  ["unavailable", 503, { ok: false, error: { code: "USAGE_UNAVAILABLE", message: "Search is unavailable; your confirmed interests remain." } }, /Search is unavailable/],
  ["paused", 503, { ok: false, error: { code: "LIVE_DISABLED", message: "Search is paused by the organizer." } }, /Search is paused/],
  ["exhausted", 429, { ok: false, error: { code: "USAGE_LIMIT", message: "Your search allowance is exhausted. Try again later." } }, /search allowance is exhausted/],
] as const) test(`search ${name} state retains confirmed interests`, async ({ page }) => {
  await page.route("**/api/club/search", (route) => route.fulfill({ status, json: body })); await page.goto("/"); await configure(page);
  await page.getByRole("combobox", { name: "Audience interests" }).fill("Some search");
  await expect(page.getByText(message)).toBeVisible(); await expect(page.getByRole("list", { name: "Confirmed interests" })).toContainText("Amélie");
});

test("optional and broken actual images use the fallback and untrusted image origins are never requested", async ({ page }) => {
  const film = candidate("movie").entity; const place = candidate("place").entity;
  film.imageUrl = "https://images.qloo.com/i/fixture.jpg"; place.imageUrl = "https://untrusted.invalid/image.jpg";
  let badRequests = 0; page.on("request", (request) => { if (request.url().includes("untrusted.invalid")) badRequests++; });
  await page.route("https://images.qloo.com/**", (route) => route.fulfill({ status: 404, body: "missing" }));
  await page.route("**/api/club/search", (route) => route.fulfill({ json: { ok: true, candidates: [film, place, candidate("book").entity] } }));
  await page.goto("/"); await page.getByRole("combobox", { name: "Audience interests" }).fill("Image test");
  await expect(page.getByRole("listbox", { name: "Cultural interest results" }).getByRole("option")).toHaveCount(3); await expect(page.locator(".club-thumbnail-fallback")).toHaveCount(3); expect(badRequests).toBe(0);
});

test("discovery browses beyond sample inventory and explicit choice is submitted to planning", async ({ page }) => {
  let submitted: unknown;
  await page.route("**/api/club/discover", (route) => route.fulfill({ json: { ok: true, discovery: discovery("place") } }));
  await page.route("**/api/club/plan", (route) => { submitted = route.request().postDataJSON().selected; return route.fulfill({ status: 422, json: { ok: false, error: { code: "SELECTED_FOCUS_CONFLICT", message: "Selected place conflicts with current inputs; no alternative substituted." } } }); });
  await page.goto("/"); await configure(page, "place"); await page.getByRole("button", { name: "Discover options" }).click();
  await page.getByRole("button", { name: "Choose Fixture Cafe", exact: true }).click(); await page.getByRole("button", { name: "Generate event proposal" }).click();
  await expect(page.locator("#event-planner").getByRole("alert")).toContainText("no alternative substituted"); expect(submitted).toEqual({ token: "controlled-place.reference" });
});

test("empty discovery and unclear goal show honest messages and never silently select a book", async ({ page }) => {
  await page.route("**/api/club/discover", (route) => route.fulfill({ json: { ok: true, discovery: { ...discovery(), candidates: [] } } }));
  await page.route("**/api/club/plan", (route) => route.fulfill({ json: { ok: true, result: { status: "clarification", question: "Which primary cultural focus should lead this mixed gathering?" }, trace: [], usage: { geminiRequests: 0, qlooRequests: 0 } } }));
  await page.goto("/"); await configure(page); await page.getByRole("button", { name: "Discover options" }).click();
  await expect(page.getByText(/Qloo returned no usable options/)).toBeVisible();
  await page.getByRole("button", { name: "Generate event proposal" }).click(); await expect(page.getByText(/Which primary cultural focus/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply proposal" })).toHaveCount(0);
});
