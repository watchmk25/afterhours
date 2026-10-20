import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import type { Interactions } from "@google/genai";
import { createEventAgent } from "../lib/event-agent.ts";
import type { EventAgentInput } from "../lib/event-types.ts";
import { createGeminiProvider, GeminiProviderError, type GeminiProvider, type GeminiTurn } from "../lib/gemini-provider.ts";
import { QLOO_PRESETS, SAMPLE_QLOO_MAPPINGS } from "../lib/qloo-sample.ts";
import { createQlooService } from "../lib/qloo-service.ts";

// All clocks, credentials, model responses and transports are synthetic. These
// tests neither discover credentials nor call a live provider.
const syntheticKey = "synthetic-timing-key-never-for-output";
const requestInput = (): EventAgentInput => ({
  catalogueSource: "sample",
  filters: { maxPrice: "450", maxPages: "300", languages: ["English"] },
  interests: QLOO_PRESETS[0].interests.map(({ reference }) => structuredClone(reference)),
  request: "Plan a welcoming interactive book event.", duration: 45, mode: "generate",
});
const toolCall = (): Interactions.Interaction => ({ id: "synthetic-tool", status: "requires_action", steps: [
  { type: "function_call", id: "synthetic-call", name: "rank_eligible_books", arguments: {} },
] });
const completed = (value: unknown): Interactions.Interaction => {
  const text = JSON.stringify(value);
  return { id: "synthetic-completed", status: "completed", output_text: text,
    steps: [{ type: "model_output", content: [{ type: "text", text }] }] };
};
const clarification = () => completed({ status: "clarification", question: "Would you prefer paired or group activities?" });
const turn: GeminiTurn = {
  input: "Use the synthetic tool when appropriate.",
  tools: [{ type: "function", name: "rank_eligible_books", parameters: { type: "object", properties: {}, additionalProperties: false } }],
  generation_config: { thinking_level: "low", max_output_tokens: 4096, tool_choice: "auto" },
};

function rankingResponse() {
  return Response.json({ results: { entities: [{ entity_id: SAMPLE_QLOO_MAPPINGS["the-guide"],
    types: ["urn:entity:book"], query: { affinity: 0.6 } }] } });
}

function offlineQloo(fetcher: typeof fetch = async () => rankingResponse()) {
  return createQlooService({ credential: syntheticKey, signingKey: "synthetic-timing-signing-key", minimumCandidates: 1, fetcher });
}

async function providerFailure(operation: Promise<unknown>) {
  const error = await operation.then(() => undefined, (failure: unknown) => failure);
  assert(error instanceof GeminiProviderError);
  assert(!JSON.stringify(error).includes(syntheticKey));
  return error;
}

test("Gemini's default and configured maximum allow exactly 20 seconds with no retry", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  for (const timeoutMs of [undefined, 120_000]) {
    let ready!: () => void;
    const dispatched = new Promise<void>((resolve) => { ready = resolve; });
    let calls = 0;
    let transportSignal: AbortSignal | undefined;
    const provider = createGeminiProvider({ apiKey: syntheticKey, timeoutMs, fetcher: async (input, init) => {
      calls += 1;
      const request = new Request(input, init);
      transportSignal = request.signal;
      const serialized = await request.json();
      assert.equal(serialized.model, "gemini-3.8-flash");
      assert.deepEqual(serialized.generation_config, { thinking_level: "low", max_output_tokens: 4096, tool_choice: "auto" });
      assert.equal(request.redirect, "manual");
      ready();
      return new Promise<Response>(() => {});
    } });
    const pending = providerFailure(provider.create(turn, new AbortController().signal));
    await dispatched;
    t.mock.timers.tick(19_999);
    await Promise.resolve();
    assert.equal(transportSignal?.aborted, false);
    t.mock.timers.tick(1);
    const error = await pending;
    assert.equal(error.code, "GEMINI_DEADLINE");
    assert.equal(error.deadline, "gemini_request");
    assert.equal(transportSignal?.aborted, true);
    assert.equal(calls, 1);
  }
});

test("Gemini uses the smaller provider or remaining-run request budget", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  for (const [timeoutMs, remainingMs, expectedMs] of [[60_000, 23_000, 20_000], [12_000, 40_000, 12_000], [20_000, 7_000, 7_000]]) {
    let ready!: () => void;
    const dispatched = new Promise<void>((resolve) => { ready = resolve; });
    let calls = 0;
    const provider = createGeminiProvider({ apiKey: syntheticKey, timeoutMs, fetcher: async () => {
      calls += 1; ready(); return new Promise<Response>(() => {});
    } });
    const pending = providerFailure(provider.create(turn, new AbortController().signal, remainingMs));
    await dispatched;
    t.mock.timers.tick(expectedMs);
    const error = await pending;
    assert.equal(error.code, "GEMINI_DEADLINE");
    assert.equal(error.deadline, "gemini_request");
    assert.equal(calls, 1);
  }
});

test("agent stages share the remaining run budget across ranking and one repair", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  const budgets: number[] = [];
  let qlooCalls = 0;
  const gemini: GeminiProvider = { async create(_turn, _signal, budget) {
    assert.equal(typeof budget, "number");
    budgets.push(budget!);
    const index = budgets.length;
    t.mock.timers.tick(index === 1 ? 8_000 : index === 2 ? 10_000 : 1_000);
    return index === 1 ? toolCall() : index === 2 ? completed(null) : clarification();
  } };
  const qloo = offlineQloo(async () => { qlooCalls += 1; t.mock.timers.tick(4_000); return rankingResponse(); });
  const result = await createEventAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true }).run(requestInput());
  assert(result.body.ok && result.body.result.status === "clarification");
  assert.deepEqual(budgets, [20_000, 18_000, 8_000]);
  assert.equal(qlooCalls, 1);
  assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 });
  assert.deepEqual(result.body.trace.filter(({ action }) => action === "gemini").map(({ elapsedMs }) => elapsedMs), [8_000, 10_000, 1_000]);
  assert.equal(result.body.trace.find(({ action }) => action === "rank_eligible_books")?.elapsedMs, 4_000);
  assert.equal(result.body.trace.reduce((elapsed, stage) => elapsed + (stage.elapsedMs ?? 0), 0), 23_000);
  assert(result.body.trace.every(({ elapsedMs }) => Number.isFinite(elapsedMs) && elapsedMs! >= 0));
  assert(!JSON.stringify(result.body).includes(syntheticKey));
});

test("the 30-second overall cap stops pending Gemini and excludes a late tool call", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  for (const overallTimeoutMs of [undefined, 300_000]) {
    let deliver!: (value: Interactions.Interaction) => void;
    const waiting = new Promise<Interactions.Interaction>((resolve) => { deliver = resolve; });
    let signal: AbortSignal | undefined;
    let qlooCalls = 0;
    const gemini: GeminiProvider = { async create(_turn, currentSignal, budget) {
      assert.equal(budget, 20_000); signal = currentSignal; return waiting;
    } };
    const agent = createEventAgent({ gemini, qloo: offlineQloo(async () => { qlooCalls += 1; return rankingResponse(); }),
      geminiConfigured: true, qlooConfigured: true, overallTimeoutMs });
    const pending = agent.run(requestInput());
    t.mock.timers.tick(29_999);
    assert.equal(signal?.aborted, false);
    t.mock.timers.tick(1);
    const result = await pending;
    assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT");
    assert.equal(result.status, 504);
    assert.equal(signal?.aborted, true);
    assert.equal(result.body.trace.at(-1)?.deadline, "agent_run");
    assert.equal(result.body.trace.at(-1)?.elapsedMs, 30_000);
    deliver(toolCall());
    await nextTurn();
    assert.equal(qlooCalls, 0);
    assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
  }
});

test("a final model response at the shared deadline cannot become a proposal or start a repair", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  const budgets: number[] = [];
  let qlooCalls = 0;
  const gemini: GeminiProvider = { async create(_turn, _signal, budget) {
    assert.equal(typeof budget, "number");
    budgets.push(budget!);
    if (budgets.length === 1) { t.mock.timers.tick(8_000); return toolCall(); }
    t.mock.timers.tick(18_000);
    return clarification();
  } };
  const qloo = offlineQloo(async () => { qlooCalls += 1; t.mock.timers.tick(4_000); return rankingResponse(); });
  const result = await createEventAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true }).run(requestInput());
  assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT");
  assert.equal(result.status, 504);
  assert.deepEqual(budgets, [20_000, 18_000]);
  assert.equal(qlooCalls, 1);
  assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(result.body.trace.at(-1)?.action, "gemini");
  assert.equal(result.body.trace.at(-1)?.deadline, "agent_run");
  assert.equal(result.body.trace.at(-1)?.elapsedMs, 18_000);
  assert(!result.body.trace.some(({ action }) => action === "validation"));
});

test("a shorter remaining overall budget aborts an active ranking before its own 10-second deadline", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  let ready!: () => void;
  const dispatched = new Promise<void>((resolve) => { ready = resolve; });
  let deliver!: (value: Response) => void;
  const waiting = new Promise<Response>((resolve) => { deliver = resolve; });
  let transportSignal: AbortSignal | undefined;
  let geminiCalls = 0;
  const gemini: GeminiProvider = { async create(_turn, _signal, budget) {
    geminiCalls += 1; assert.equal(budget, 15_000); t.mock.timers.tick(10_000); return toolCall();
  } };
  const qloo = offlineQloo(async (_request, options) => { transportSignal = options?.signal ?? undefined; ready(); return waiting; });
  const pending = createEventAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true, overallTimeoutMs: 15_000 }).run(requestInput());
  await dispatched;
  t.mock.timers.tick(5_000);
  const result = await pending;
  assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT");
  assert.equal(transportSignal?.aborted, true);
  assert.equal(result.body.trace.at(-1)?.action, "rank_eligible_books");
  assert.equal(result.body.trace.at(-1)?.deadline, "agent_run");
  assert.equal(result.body.trace.at(-1)?.elapsedMs, 5_000);
  deliver(rankingResponse());
  await nextTurn();
  assert.equal(geminiCalls, 1);
  assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 1 });
});

test("Qloo keeps its own 10-second deadline and does not retry or continue to Gemini", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  let ready!: () => void;
  const dispatched = new Promise<void>((resolve) => { ready = resolve; });
  let qlooCalls = 0;
  let geminiCalls = 0;
  let transportSignal: AbortSignal | undefined;
  const gemini: GeminiProvider = { async create() { geminiCalls += 1; return toolCall(); } };
  const qloo = offlineQloo(async (_request, options) => {
    qlooCalls += 1; transportSignal = options?.signal ?? undefined; ready();
    return new Promise<Response>(() => {});
  });
  const pending = createEventAgent({ gemini, qloo, geminiConfigured: true, qlooConfigured: true }).run(requestInput());
  await dispatched;
  t.mock.timers.tick(10_000);
  const result = await pending;
  assert(!result.body.ok && result.body.error.code === "QLOO_TIMEOUT");
  assert.equal(transportSignal?.aborted, true);
  assert.equal(result.body.trace.at(-1)?.action, "rank_eligible_books");
  assert.equal(result.body.trace.at(-1)?.deadline, "qloo_request");
  assert.equal(result.body.trace.at(-1)?.elapsedMs, 10_000);
  assert.equal(qlooCalls, 1);
  assert.equal(geminiCalls, 1);
  assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 1 });
});

test("explicit user cancellation keeps its own deadline label and suppresses late ranking work", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: 1_000_000 });
  t.mock.method(performance, "now", () => Date.now());
  let deliver!: (value: Interactions.Interaction) => void;
  const waiting = new Promise<Interactions.Interaction>((resolve) => { deliver = resolve; });
  let qlooCalls = 0;
  const caller = new AbortController();
  const gemini: GeminiProvider = { async create() { return waiting; } };
  const pending = createEventAgent({ gemini, qloo: offlineQloo(async () => { qlooCalls += 1; return rankingResponse(); }),
    geminiConfigured: true, qlooConfigured: true }).run(requestInput(), caller.signal);
  t.mock.timers.tick(1234);
  caller.abort(new Error(syntheticKey));
  const result = await pending;
  assert(!result.body.ok && result.body.error.code === "RUN_CANCELLED");
  assert.equal(result.body.trace.at(-1)?.deadline, "user_cancel");
  assert.equal(result.body.trace.at(-1)?.elapsedMs, 1234);
  assert(!JSON.stringify(result.body).includes(syntheticKey));
  deliver(toolCall());
  await nextTurn();
  assert.equal(qlooCalls, 0);
});
