import { test, expect, configure, stubPlan } from "./club-fixtures";

for (const [code, status, message] of [
  ["LIVE_DISABLED", 503, "Live planning is paused by the organizer."],
  ["USAGE_UNAVAILABLE", 503, "Shared usage protection is temporarily unavailable."],
  ["USAGE_LIMIT", 429, "Your allowance is exhausted."],
  ["EVENT_BUSY", 429, "Another event is using the shared planning slots."],
  ["GEMINI_PACING_LIMIT", 429, "Gemini requests are paced; try again shortly."],
  ["GEMINI_QUOTA", 429, "The provider quota is exhausted."],
  ["GEMINI_TRANSPORT", 502, "The provider connection failed."],
] as const) test(`${code} preserves edits and offers no simulated proposal`, async ({ page }) => {
  await page.goto("/"); await configure(page); await stubPlan(page);
  await page.getByRole("button", { name: "Generate event proposal" }).click();
  await page.getByRole("checkbox", { name: /I understand this is conditional/ }).check(); await page.getByRole("button", { name: "Apply proposal" }).click();
  await page.getByLabel("Event title", { exact: true }).fill("Preserved title"); await page.getByLabel("Organizer notes", { exact: true }).fill("Preserved notes");
  await page.route("**/api/club/plan", (route) => route.fulfill({ status, json: { ok: false, error: { code, message, retryAfterSeconds: 17 }, trace: [], usage: { geminiRequests: code === "GEMINI_PACING_LIMIT" ? 1 : 0, qlooRequests: 0 } } }));
  await page.getByRole("button", { name: "Generate event proposal" }).click(); await expect(page.locator("#event-planner").getByRole("alert")).toContainText(message);
  await expect(page.locator("#event-planner").getByRole("alert")).toContainText("17 seconds");
  await expect(page.getByLabel("Event title", { exact: true })).toHaveValue("Preserved title"); await expect(page.getByLabel("Organizer notes", { exact: true })).toHaveValue("Preserved notes");
  await expect(page.getByRole("button", { name: "Apply proposal" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Generate event proposal" })).toBeEnabled();
});
