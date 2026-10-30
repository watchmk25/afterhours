import { test, expect, configure, stubPlan, plan, type Page } from "./club-fixtures";
import type { ClubInput, CulturalKind } from "../lib/club-types";
import { QLOO_PRESETS } from "../lib/qloo-sample";
import { readFile } from "node:fs/promises";

async function apply(page: Page) {
  await page.getByRole("checkbox", { name: /I understand this is conditional/ }).check();
  await page.getByRole("button", { name: "Apply proposal", exact: true }).click();
}
for (const kind of ["book", "artist", "movie", "place"] as CulturalKind[]) test(`${kind} journey generates directly, validates context and previews before explicit Apply`, async ({ page }) => {
  let calls = 0;
  await page.goto("/"); await configure(page, kind); await stubPlan(page, kind);
  page.on("request", (request) => { if (request.url().includes("/api/club/plan")) calls++; });
  await page.getByRole("button", { name: "Generate event proposal" }).click();
  await expect(page.getByText("Agenda total: 45 minutes", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Apply proposal" })).toBeDisabled();
  await page.getByText("Evidence, constraints and input context", { exact: true }).click();
  await expect(page.locator(".club-evidence")).toContainText("astronomy and arts collective");
  await expect(page.locator(".club-evidence")).toContainText("0.6");
  await apply(page); await expect(page.getByLabel("Event title", { exact: true })).toHaveValue(`A ${kind} gathering`);
  expect(calls).toBe(1);
});

test("applied context becomes historical even after changing back, preserving edits until explicit revised Apply", async ({ page }) => {
  await page.goto("/"); await configure(page); await stubPlan(page);
  await page.getByRole("button", { name: "Generate event proposal" }).click(); await apply(page);
  await page.getByLabel("Event title", { exact: true }).fill("My edited event");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep the welcome activity");
  await page.getByLabel("Group size", { exact: true }).fill("13"); await page.getByLabel("Group size", { exact: true }).fill("12");
  await expect(page.getByText(/Based on previous inputs/)).toBeVisible();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("My edited event");
  let revision: ClubInput | undefined;
  await page.route("**/api/club/plan", async (route) => {
    revision = route.request().postDataJSON(); const updated = plan(revision!); updated.eventTitle = "Revised gathering";
    await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal: updated }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } });
  });
  await page.getByRole("button", { name: "Revise event proposal" }).click();
  await expect(page.getByText("Revised gathering", { exact: true })).toBeVisible();
  expect(revision?.mode).toBe("revise"); expect(revision?.previousPlan?.eventTitle).toBe("My edited event");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep the welcome activity");
  await apply(page); await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Revised gathering");
});

test("pending duplicate prevention, cancellation and late result cannot replace existing edits", async ({ page }) => {
  await page.goto("/"); await configure(page); await stubPlan(page);
  await page.getByRole("button", { name: "Generate event proposal" }).click(); await apply(page);
  await page.getByLabel("Event title", { exact: true }).fill("Keep this title");
  let release!: () => void; let calls = 0;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/club/plan", async (route) => {
    calls++; const input = route.request().postDataJSON(); await pending;
    await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal: plan(input) }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } }).catch(() => {});
  });
  await page.getByRole("button", { name: "Generate event proposal" }).click();
  await expect(page.getByRole("button", { name: "Planning…" })).toBeDisabled();
  await expect(page.getByText("Waiting for a grounded proposal. Existing event edits are safe.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel request" }).click(); release();
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Keep this title");
  await expect(page.getByRole("button", { name: "Apply proposal" })).toHaveCount(0); expect(calls).toBe(1);
});

test("input changes reject stale responses and switching back cannot revive an unapplied proposal", async ({ page }) => {
  await page.goto("/"); await configure(page);
  let release!: () => void; const pending = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/club/plan", async (route) => { const input = route.request().postDataJSON(); await pending; await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal: plan(input) }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } }).catch(() => {}); });
  await page.getByRole("button", { name: "Generate event proposal" }).click();
  await page.getByLabel("Duration (minutes)", { exact: true }).fill("60"); await page.getByLabel("Duration (minutes)", { exact: true }).fill("45"); release();
  await expect(page.getByRole("button", { name: "Generate event proposal" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Apply proposal" })).toHaveCount(0);
});

test("390px cards, proposal evidence and applied fields stay readable without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto("/"); await configure(page, "movie"); await stubPlan(page, "movie");
  await page.getByRole("button", { name: "Generate event proposal" }).click();
  await expect(page.locator(".club-candidate")).toBeVisible(); await apply(page);
  await page.locator("#event-outline").getByText("Evidence, constraints and input context", { exact: true }).click();
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
  expect(dimensions.document).toBeLessThanOrEqual(390); expect(dimensions.body).toBeLessThanOrEqual(390);
  for (const label of ["Event title", "Organizer notes", "Invitation"]) {
    const box = await page.getByLabel(label, { exact: true }).boundingBox(); expect(box!.width).toBeGreaterThan(250); expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  }
  await page.screenshot({ path: "artifacts/playwright/adaptive-club-mobile-390.png", fullPage: true });
});

test("audience and practical-constraint revision stays fresh, preserves edits until Apply and downloads the applied current plan", async ({ page }) => {
  const requests: ClubInput[] = [];
  await page.route("**/api/club/plan", async (route) => {
    const input = route.request().postDataJSON() as ClubInput; requests.push(input);
    const proposal = plan(input); proposal.eventTitle = requests.length === 1 ? "Initial gathering" : "Revised gathering";
    proposal.discovery.interests = input.interests.flatMap((reference) => {
      if (!("preset" in reference)) return [];
      const interest = QLOO_PRESETS.find((preset) => preset.id === reference.preset)?.interests[reference.index];
      return interest ? [{ ...interest, metadata: {} }] : [];
    });
    await route.fulfill({ json: { ok: true, result: { status: "proposal", proposal }, trace: [], usage: { geminiRequests: 2, qlooRequests: 1 } } });
  });
  await page.goto("/"); await page.getByRole("button", { name: "Try an example", exact: true }).click();
  await page.getByRole("button", { name: "Generate event proposal", exact: true }).click(); await apply(page);
  await page.getByLabel("Event title", { exact: true }).fill("Keep my edited title until Apply");
  await page.getByLabel("Organizer notes", { exact: true }).fill("Keep these current notes");
  await page.getByRole("button", { name: "Remove Amélie", exact: true }).click(); await page.getByRole("button", { name: "Remove Norah Jones", exact: true }).click();
  for (const name of [/Interstellar/, /Hans Zimmer/]) {
    await page.getByRole("combobox", { name: "Audience interests" }).click(); await page.getByRole("listbox", { name: "Reviewed interest examples" }).getByRole("option", { name }).click();
  }
  await page.getByText("Budget and relevant constraints (optional)", { exact: true }).click(); await page.getByLabel("Budget (optional)", { exact: true }).fill("300");
  await expect(page.getByText(/Based on previous inputs/)).toBeVisible();
  await page.getByRole("button", { name: "Revise event proposal", exact: true }).click();
  await expect(page.getByText("Revised gathering", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(2); expect(requests[1].interests).toEqual([{ preset: "b", index: 0 }, { preset: "b", index: 1 }]); expect(requests[1].budget?.amount).toBe(300);
  expect(requests[1].selected).toEqual({ sample: "the-guide" }); expect(requests[1].previousPlan?.eventTitle).toBe("Keep my edited title until Apply");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Keep my edited title until Apply"); await apply(page);
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Revised gathering");
  await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Keep these current notes");
  const pending = page.waitForEvent("download"); await page.getByRole("button", { name: "Download event plan", exact: true }).click();
  const downloaded = await pending; expect(await downloaded.failure()).toBeNull();
  const markdown = await readFile((await downloaded.path())!, "utf8");
  for (const text of ["Revised gathering", "Keep these current notes", "Interstellar", "Hans Zimmer", "Budget: INR 300", "affinity:"]) expect(markdown).toContain(text);
  expect(markdown).not.toContain("Historical context — based on previous inputs"); expect(requests).toHaveLength(2);
});
