import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import type { Interactions } from "@google/genai";
import { createClubAgent, CLUB_CONTINUATION_LIMIT_MS } from "../lib/club-agent.ts";
import { createClubQloo } from "../lib/club-qloo.ts";
import { createGeminiProvider, GeminiProviderError, type GeminiProvider } from "../lib/gemini-provider.ts";
import type { ClubInput } from "../lib/club-types.ts";

const id = "11111111-1111-4111-8111-111111111111";
const input: ClubInput = { club: "A reading circle", goal: "Discuss a book together", duration: 45, groupSize: 12,
  location: "", budget: null, maxPages: null, languages: [], format: "book", source: "discovery",
  interests: [{ preset: "a", index: 0 }], resources: [], selected: null, mode: "generate" };
const native: Interactions.Interaction = { id: "offline-call", status: "requires_action", steps: [
  { type: "function_call", id: "offline-function", name: "discover_cultural_focus", arguments: {} },
] };
function completed(valid = true): Interactions.Interaction {
  const text = JSON.stringify({ status: "proposal", proposal: { selectedEntityId: id, eventTitle: "Shared reflections",
    formatDescription: "Offer paired conversation and optional reflection.", evidenceRefs: [`affinity:${id}`],
    agenda: [{ title: "Conversation", minutes: valid ? 45 : 44, activity: "Invite open discussion and a quiet pass." }],
    materials: ["Paper"], invitation: "Join a welcoming conversation." } });
  return { id: "offline-final", status: "completed", steps: [{ type: "model_output", content: [{ type: "text", text }] }], output_text: text };
}
async function until(condition: () => boolean) {
  for (let i = 0; i < 30 && !condition(); i++) await nextTurn();
  assert(condition(), "Controlled transport did not reach the expected stage");
}

test("adaptive native continuation completes after 20s using the real bounded SDK adapter and reserved remaining budget", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  const budgets: number[] = [], signals: AbortSignal[] = [];
  let modelCalls = 0, qlooCalls = 0, paceCalls = 0;
  const provider = createGeminiProvider({ apiKey: "synthetic-deadline-key", model: "gemini-3.5-flash-lite",
    maxRequestTimeoutMs: CLUB_CONTINUATION_LIMIT_MS, fetcher: async (raw, init) => {
      const request = new Request(raw, init); signals.push(request.signal);
      const body = await request.json(); assert.equal(body.model, "gemini-3.5-flash-lite");
      assert.equal(body.generation_config.thinking_level, "minimal");
      const index = ++modelCalls;
      return new Promise<Response>((resolve) => setTimeout(() => resolve(Response.json(index === 1 ? native : completed())), index === 1 ? 2500 : 21_000));
    } });
  const gemini: GeminiProvider = { create(turn, signal, budget) { budgets.push(budget!); return provider.create(turn, signal, budget); } };
  const qloo = createClubQloo({ credential: "synthetic-qloo-key", fetcher: async () => {
    qlooCalls++; t.mock.timers.tick(100);
    return Response.json({ results: { entities: [{ entity_id: id, name: "Controlled book", types: ["urn:entity:book"], query: { affinity: 0.6 } }] } });
  } });
  const agent = createClubAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true,
    // The route has already spent 500ms on admission.
    overallTimeoutMs: 29_500, beforeGemini: async () => { t.mock.timers.tick(++paceCalls === 1 ? 100 : 50); return { ok: true }; } });
  const pending = agent.run(input); await until(() => modelCalls === 1);
  t.mock.timers.tick(2500); await until(() => modelCalls === 2);
  assert.deepEqual(budgets, [20_000, 24_750]);
  t.mock.timers.tick(20_001); await nextTurn(); assert.equal(signals[1].aborted, false);
  t.mock.timers.tick(999);
  const result = await pending;
  assert(result.body.ok && result.body.result.status === "proposal");
  assert.equal(result.body.result.proposal.agenda.reduce((sum, item) => sum + item.minutes, 0), 45);
  assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(modelCalls, 2); assert.equal(qlooCalls, 1);
});

test("adaptive opt-in cannot exceed 28s or override a shorter explicit timeout/remaining budget", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  for (const [maxRequestTimeoutMs, timeoutMs, remaining, expected] of [[120_000, 120_000, 60_000, 28_000], [28_000, 12_000, 26_000, 12_000], [28_000, 28_000, 700, 700]]) {
    let calls = 0, signal: AbortSignal | undefined;
    const provider = createGeminiProvider({ apiKey: "synthetic-key", maxRequestTimeoutMs, timeoutMs, fetcher: async (raw, init) => {
      calls++; signal = new Request(raw, init).signal; return new Promise<Response>(() => {});
    } });
    const pending = provider.create({ input: "Controlled input" }, new AbortController().signal, remaining).catch((error: unknown) => error);
    await until(() => calls === 1); t.mock.timers.tick(expected - 1); assert.equal(signal?.aborted, false);
    t.mock.timers.tick(1); const error = await pending; assert(error instanceof GeminiProviderError && error.code === "GEMINI_DEADLINE");
    assert.equal(signal?.aborted, true); assert.equal(calls, 1);
  }
});

test("repair shares the same reserve and current evidence rather than gaining a new deadline or Qloo request", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 }); t.mock.method(performance, "now", () => Date.now());
  const budgets: number[] = []; let qlooCalls = 0;
  const gemini: GeminiProvider = { async create(_turn, _signal, budget) {
    budgets.push(budget!); t.mock.timers.tick(budgets.length === 1 ? 8000 : budgets.length === 2 ? 10_000 : 1000);
    return budgets.length === 1 ? native : completed(budgets.length === 3);
  } };
  const qloo = createClubQloo({ credential: "synthetic-key", fetcher: async () => {
    qlooCalls++; t.mock.timers.tick(4000); return Response.json({ results: { entities: [{ entity_id: id, name: "Controlled book", types: ["urn:entity:book"], query: { affinity: 0.6 } }] } });
  } });
  const result = await createClubAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true }).run(input);
  assert(result.body.ok && result.body.result.status === "proposal"); assert.deepEqual(budgets, [20_000, 16_000, 6000]);
  assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 }); assert.equal(qlooCalls, 1);
});

test("completion reserve rejects dispatch before pacing when exhausted and bounds short remaining budgets", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 }); t.mock.method(performance, "now", () => Date.now());
  for (const overallTimeoutMs of [1500, 5000]) {
    let calls = 0, pacing = 0, seen = 0;
    const gemini: GeminiProvider = { async create(_turn, _signal, budget) { calls++; seen = budget!; return { id: "clarify", status: "completed", steps: [], output_text: JSON.stringify({ status: "clarification", question: "Prefer group or paired discussion?" }) }; } };
    const qloo = createClubQloo({ credential: "synthetic-key", fetcher: async () => { assert.fail("Unexpected Qloo dispatch"); } });
    const result = await createClubAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true, overallTimeoutMs,
      beforeGemini: async () => { pacing++; t.mock.timers.tick(500); return { ok: true }; } }).run(input);
    if (overallTimeoutMs === 1500) { assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT"); assert.equal(calls, 0); assert.equal(pacing, 0); }
    else { assert(result.body.ok); assert.equal(seen, 2500); assert.equal(calls, 1); }
  }
});

test("overall expiry and cancellation during an extended continuation reject late output without repair", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 }); t.mock.method(performance, "now", () => Date.now());
  for (const cancel of [true, false]) {
    const caller = new AbortController(); let calls = 0, deliver!: (value: Interactions.Interaction) => void;
    const gemini: GeminiProvider = { async create(_turn, signal) { calls++; if (calls === 1) return native; assert.equal(signal.aborted, false); return new Promise((resolve) => { deliver = resolve; }); } };
    let qlooCalls = 0;
    const qloo = createClubQloo({ credential: "synthetic-key", fetcher: async () => { qlooCalls++; return Response.json({ results: { entities: [{ entity_id: id, name: "Controlled book", types: ["urn:entity:book"], query: { affinity: 0.6 } }] } }); } });
    const pending = createClubAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true }).run(input, caller.signal);
    await until(() => calls === 2); t.mock.timers.tick(cancel ? 21_000 : 30_000); if (cancel) caller.abort();
    const result = await pending; assert(!result.body.ok && result.body.error.code === (cancel ? "RUN_CANCELLED" : "RUN_TIMEOUT"));
    deliver(completed()); await nextTurn(); assert.equal(calls, 2); assert.equal(qlooCalls, 1);
  }
});

test("an invalid continuation cannot start a repair or pacing operation inside the completion reserve", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 }); t.mock.method(performance, "now", () => Date.now());
  let calls = 0, pacing = 0, qlooCalls = 0;
  const gemini: GeminiProvider = { async create() { calls++; t.mock.timers.tick(calls === 1 ? 2000 : 26_000); return calls === 1 ? native : completed(false); } };
  const qloo = createClubQloo({ credential: "synthetic-key", fetcher: async () => { qlooCalls++; return Response.json({ results: { entities: [{ entity_id: id, name: "Controlled book", types: ["urn:entity:book"], query: { affinity: 0.6 } }] } }); } });
  const result = await createClubAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true,
    beforeGemini: async () => { pacing++; return { ok: true }; } }).run(input);
  assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT");
  assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(calls, 2); assert.equal(pacing, 2); assert.equal(qlooCalls, 1);
});
