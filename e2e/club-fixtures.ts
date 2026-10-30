import { test as base, expect, type Page, type Locator } from "./fixtures";
import type { ClubCandidate, ClubDiscovery, ClubDraft, ClubInput, ClubPlan, CulturalKind } from "../lib/club-types";

// Every application API is intercepted. No browser test can dispatch a live provider/store call.
export const test = base.extend<{ controlledAPIs: void }>({
  controlledAPIs: [async ({ context }, use) => {
    await context.route(/https:\/\/(?:hackathon\.api\.qloo\.com|generativelanguage\.googleapis\.com|[^/]+\.upstash\.io)\//, (route) => route.abort());
    await context.route("**/api/**", (route) => route.fulfill({ status: 503, json: { ok: false, error: { code: "LIVE_DISABLED", message: "Live matching and planning are paused. Your draft is unchanged." }, trace: [], usage: { geminiRequests: 0, qlooRequests: 0 } } }));
    await use();
  }, { auto: true }],
});
export { expect };
export type { Page, Locator };
export const ids = { book: "DF4272D0-A6BA-445B-88DC-172A56B5D183", artist: "11111111-1111-4111-8111-111111111111", movie: "22222222-2222-4222-8222-222222222222", place: "33333333-3333-4333-8333-333333333333" };
export function candidate(kind: CulturalKind = "book"): ClubCandidate {
  return { entity: { entityId: ids[kind], name: { book: "The Guide", artist: "Fixture Artist", movie: "Fixture Film", place: "Fixture Cafe" }[kind], kind,
    metadata: kind === "artist" ? { musicVerified: true } : kind === "movie" ? { durationMinutes: 169, year: 2014 } : kind === "book" ? { creator: "R. K. Narayan" } : { address: "Fixture city", priceLevel: 2 },
    reference: kind === "book" ? { sample: "the-guide" } : { token: `controlled-${kind}.reference` } }, facts: {}, factSource: "provider",
    assessments: [{ constraint: "Availability", status: "needs_confirmation", source: "unknown", detail: "Confirm access, permissions and current availability." }],
    evidence: [{ id: `affinity:${ids[kind]}`, entityId: ids[kind], kind: "affinity", value: 0.6 }] };
}
export function discovery(kind: CulturalKind = "book"): ClubDiscovery {
  return { kind, candidates: [candidate(kind)], interests: [], coverage: { submitted: null, resolved: null, assessed: 1 }, warnings: ["Controlled browser fixture; not live provider evidence."] };
}
export function plan(input: ClubInput, kind: CulturalKind = "book"): ClubPlan {
  const results = discovery(kind);
  const draft: ClubDraft = { selectedEntityId: ids[kind], eventTitle: `A ${kind} gathering`, formatDescription: kind === "movie" ? "Discuss a film watched beforehand." : "An interactive cultural discussion.",
    evidenceRefs: [results.candidates[0].evidence[0].id], agenda: [{ title: "Welcome", minutes: 5, activity: "Introduce the format." }, { title: "Exchange", minutes: input.duration - 10, activity: "Share optional reflections in pairs." }, { title: "Closing", minutes: 5, activity: "Collect next steps." }],
    materials: ["Paper", "Pens"], invitation: "Join a welcoming exchange of perspectives." };
  return { ...draft, focus: results.candidates[0], discovery: results, snapshot: input, conditional: true, warnings: ["Confirm the unknown constraints. Activities are generated suggestions."] };
}
export async function configure(page: Page, kind: CulturalKind = "book") {
  await page.getByLabel("Club/group description", { exact: true }).fill("A neighbourhood astronomy and arts collective");
  await page.getByLabel("Event goal", { exact: true }).fill({ book: "Discuss a book together", artist: "Explore music through a listening discussion", movie: "Discuss a film watched beforehand", place: "Find a cafe for a social gathering" }[kind]);
  await page.getByLabel("Primary cultural focus", { exact: true }).selectOption(kind);
  await page.getByRole("combobox", { name: "Audience interests" }).focus();
  await page.getByRole("option", { name: /Amélie/ }).click();
}
export async function stubPlan(page: Page, kind: CulturalKind = "book") {
  await page.route("**/api/club/plan", async (route) => {
    const input = route.request().postDataJSON() as ClubInput;
    await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal: plan(input, kind) }, trace: [{ stage: "qloo_discovery", elapsedMs: 3, outcome: "completed" }], usage: { geminiRequests: 2, qlooRequests: 1 } } });
  });
}
export async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 110; i++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  await expect(target, "Control is reachable in actual keyboard order").toBeFocused();
}
export async function visibleFocus(target: Locator) {
  await expect(target).toBeFocused(); await expect(target).toBeInViewport();
  expect(await target.evaluate((el) => el.matches(":focus-visible") && getComputedStyle(el).outlineStyle !== "none" && parseFloat(getComputedStyle(el).outlineWidth) >= 2)).toBe(true);
}
