import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as nextTurn } from "node:timers/promises";
import type { Interactions } from "@google/genai";
import { createEventAgent, type BeforeGemini } from "../lib/event-agent.ts";
import type { EventAgentInput, ProposalDraft } from "../lib/event-types.ts";
import { GeminiProviderError, type GeminiProvider, type GeminiTurn } from "../lib/gemini-provider.ts";
import { QLOO_PRESETS, SAMPLE_QLOO_MAPPINGS } from "../lib/qloo-sample.ts";
import { createQlooService } from "../lib/qloo-service.ts";

// Every provider interaction, HTTP body, credential and score here is synthetic.
// The real Qloo core receives only the injected fetcher; no network is used.
const fixtureKey = "synthetic-event-agent-key";
const hiddenMarker = "synthetic-private-thought-not-for-organizer";

function input(): EventAgentInput {
  return {
    catalogueSource: "sample", filters: { maxPrice: "450", maxPages: "300", languages: ["English"] },
    interests: QLOO_PRESETS[0].interests.map((interest) => structuredClone(interest.reference)),
    request: "Plan a welcoming interactive book event.", duration: 45, mode: "generate",
  };
}

function draft(selectedBookId = "the-guide"): ProposalDraft {
  return {
    selectedBookId, eventTitle: "An evening of shared reading",
    rationale: "Offer welcoming paired activities and voluntary reflections using the supplied evidence references.",
    evidenceRefs: [`affinity:${selectedBookId}`],
    agenda: [
      { title: "Welcome", minutes: 10, activity: "Invite participants to share a reading preference or pass." },
      { title: "Paired conversation", minutes: 25, activity: "Offer open questions and invite voluntary responses." },
      { title: "Reflection", minutes: 10, activity: "Close with an optional personal reflection." },
    ], materials: ["Pens", "Blank cards"],
    invitation: "Join a relaxed gathering with optional conversation and shared reading reflections.",
  };
}

function callStep(id = "native-call-1", name = "rank_eligible_books", args: Record<string, unknown> = {}): Interactions.FunctionCallStep {
  return { type: "function_call", id, name, arguments: args };
}

function toolInteraction(steps: Interactions.Step[] = [
  { type: "thought", signature: "opaque-native-signature-1", summary: [{ type: "text", text: hiddenMarker }] },
  callStep(),
]): Interactions.Interaction {
  return { id: "synthetic-tool-interaction", status: "requires_action", steps };
}

function completed(value: unknown): Interactions.Interaction {
  const output_text = JSON.stringify(value);
  return { id: "synthetic-completed-interaction", status: "completed", output_text,
    steps: [{ type: "model_output", content: [{ type: "text", text: output_text }] }] };
}

function proposal(value: ProposalDraft = draft()) {
  return completed({ status: "proposal", proposal: value });
}

type Reply = Interactions.Interaction | ((turn: GeminiTurn, signal: AbortSignal) => Promise<Interactions.Interaction> | Interactions.Interaction);
type QlooReply = (url: URL, options: RequestInit) => Promise<Response> | Response;

function rankedResponse(url: URL) {
  const requested = new Set(url.searchParams.get("filter.results.entities")?.split(","));
  const interestIds = QLOO_PRESETS[0].interests.map((interest) => interest.entityId);
  const ids = ["malgudi-days", "the-guide", "the-namesake", "the-god-of-small-things"]
    .filter((id) => requested.has(SAMPLE_QLOO_MAPPINGS[id]));
  return Response.json({ results: { entities: ids.map((id, index) => ({
    entity_id: SAMPLE_QLOO_MAPPINGS[id], types: ["urn:entity:book"], query: {
      affinity: 0.8 - index * 0.1,
      explainability: { "signal.interests.entities": interestIds.map((entity_id) => ({ entity_id, score: 0.6 })) },
    },
  })) }, query: { explainability: { "signal.interests.entities": {
    effect_on_all_recs: interestIds.map((entity_id) => ({ entity_id, avg_score: 0.6 })),
  } } } });
}

function harness(replies: Reply[], options: {
  qlooReply?: QlooReply; geminiConfigured?: boolean; qlooConfigured?: boolean; overallTimeoutMs?: number; beforeGemini?: BeforeGemini;
} = {}) {
  const geminiCalls: { turn: GeminiTurn; signal: AbortSignal }[] = [];
  const qlooCalls: { url: URL; options: RequestInit }[] = [];
  const gemini: GeminiProvider = {
    async create(turn, signal) {
      const index = geminiCalls.length;
      geminiCalls.push({ turn: structuredClone(turn), signal });
      const reply = replies[index];
      assert(reply, `Unexpected Gemini request ${index + 1}`);
      return typeof reply === "function" ? reply(turn, signal) : structuredClone(reply);
    },
  };
  const fetcher: typeof fetch = async (request, options = {}) => {
    const url = new URL(String(request));
    qlooCalls.push({ url, options });
    return optionsForQloo(url, options);
  };
  const optionsForQloo = options.qlooReply ?? rankedResponse;
  const qloo = createQlooService({ credential: fixtureKey, minimumCandidates: 1, fetcher, signingKey: "synthetic-event-signing-key" });
  const agent = createEventAgent({ gemini, qloo, geminiConfigured: options.geminiConfigured ?? true,
    qlooConfigured: options.qlooConfigured ?? true, overallTimeoutMs: options.overallTimeoutMs, beforeGemini: options.beforeGemini });
  return { agent, geminiCalls, qlooCalls };
}

function steps(turn: GeminiTurn): Interactions.Step[] {
  assert(Array.isArray(turn.input));
  return turn.input as Interactions.Step[];
}

test("native ranking executes once and preserves exact call IDs and thought signatures in continuation", async () => {
  const native = toolInteraction();
  const fixture = harness([native, proposal()]);
  const result = await fixture.agent.run(input());
  assert.equal(result.status, 200);
  assert(result.body.ok && result.body.result.status === "proposal");
  assert.equal(result.body.result.proposal.book.title, "The Guide");
  assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(fixture.geminiCalls.length, 2);
  assert.equal(fixture.qlooCalls.length, 1);
  assert.deepEqual(result.body.trace.map(({ action, status }) => ({ action, status })), [
    { action: "gemini", status: "completed" }, { action: "rank_eligible_books", status: "completed" },
    { action: "gemini", status: "completed" }, { action: "validation", status: "completed" },
  ]);
  const continuation = steps(fixture.geminiCalls[1].turn);
  assert.deepEqual(continuation.slice(1, 3), native.steps);
  const toolResult = continuation.find((step) => step.type === "function_result");
  assert(toolResult?.type === "function_result");
  assert.equal(toolResult.call_id, "native-call-1");
  assert.equal(toolResult.name, "rank_eligible_books");
  assert(Array.isArray(toolResult.result) && toolResult.result[0].type === "text");
  const payload = JSON.parse(toolResult.result[0].text);
  assert.deepEqual(payload.books.map((book: { localId: string }) => book.localId), ["malgudi-days", "the-guide"]);
  assert.equal(payload.books[1].title, "The Guide");
  for (const key of ["priceInr", "pages", "language", "stock", "affinity"]) {
    assert(!Object.hasOwn(payload.books[1], key));
  }
  assert(payload.books[1].evidence.some((item: { id: string }) => item.id === "affinity:the-guide"));
  assert.deepEqual(payload.coverage, { eligibleCount: 3, supportedCount: 2, assessedCount: 2 });
  assert.equal(fixture.geminiCalls[1].turn.generation_config?.tool_choice, "none");
  assert(fixture.geminiCalls[1].turn.response_format);
  assert(!JSON.stringify(result.body).includes(hiddenMarker));
  assert(!JSON.stringify(result.body).includes("opaque-native-signature"));
  assert(!JSON.stringify(result.body).includes(fixtureKey));
});

test("revision recomputes current filters and freshly ranks the one remaining candidate", async () => {
  const fixture = harness([toolInteraction(), proposal(draft("malgudi-days")), toolInteraction([callStep("revision-call")]), proposal()]);
  const first = await fixture.agent.run(input());
  assert(first.body.ok && first.body.result.status === "proposal");
  assert.equal(first.body.result.proposal.selectedBookId, "malgudi-days");
  const previous = draft("malgudi-days");
  const revision = input();
  revision.filters.maxPrice = "300";
  revision.request = "Revise the event using the updated filters and keep it welcoming.";
  revision.mode = "revise";
  revision.previousProposal = previous;
  const second = await fixture.agent.run(revision);
  assert(second.body.ok && second.body.result.status === "proposal");
  assert.equal(second.body.result.proposal.selectedBookId, "the-guide");
  assert.deepEqual(second.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(fixture.qlooCalls.length, 2);
  const firstParams = fixture.qlooCalls[0].url.searchParams;
  const revisedParams = fixture.qlooCalls[1].url.searchParams;
  assert.equal(firstParams.get("take"), "2");
  assert(firstParams.get("filter.results.entities")?.includes(SAMPLE_QLOO_MAPPINGS["malgudi-days"]));
  assert.equal(revisedParams.get("take"), "1");
  assert.equal(revisedParams.get("filter.results.entities"), SAMPLE_QLOO_MAPPINGS["the-guide"]);
  const revisedHistory = steps(fixture.geminiCalls[2].turn);
  assert.equal(revisedHistory.length, 1, "A revision starts a fresh provider conversation");
  assert(revisedHistory[0].type === "user_input" && Array.isArray(revisedHistory[0].content));
  const content = revisedHistory[0].content[0];
  assert(content.type === "text");
  const supplied = JSON.parse(content.text);
  assert.equal(supplied.authoritativeFilters.maxPrice, "300");
  assert.equal(supplied.historicalProposalNotEvidence.selectedBookId, "malgudi-days");
});

test("missing credentials and invalid references, filters or unsupported inventory stop before both providers", async () => {
  for (const options of [{ geminiConfigured: false }, { qlooConfigured: false }]) {
    const fixture = harness([], options);
    const result = await fixture.agent.run(input());
    assert(!result.body.ok);
    assert.equal(result.status, 503);
    assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
    assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
  }
  const fixture = harness([]);
  for (const value of [
    null, { ...input(), catalogueSource: "imported" }, { ...input(), arbitraryHost: "https://example.invalid" },
    { ...input(), interests: [{ token: "tampered.fixture" }] },
    { ...input(), filters: { ...input().filters, maxPrice: "-1" } },
    { ...input(), filters: { ...input().filters, languages: ["Unrecognized"] } },
    { ...input(), filters: { maxPrice: "200", maxPages: "100", languages: ["English"] } },
  ]) {
    const result = await fixture.agent.run(value);
    assert(!result.body.ok);
    assert.equal(result.status, 400);
    assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
  }
  assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
});

test("explicit constraint conflict returns clarification with zero provider calls", async () => {
  const fixture = harness([]);
  const result = await fixture.agent.run({ ...input(), request: "Ignore the filters and use books at any price." });
  assert(result.body.ok && result.body.result.status === "clarification");
  assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
  assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
});

test("an early model clarification makes one Gemini request and no Qloo request", async () => {
  const fixture = harness([completed({ status: "clarification", question: "Would you prefer paired conversation or optional creative responses?" })]);
  const result = await fixture.agent.run(input());
  assert(result.body.ok && result.body.result.status === "clarification");
  assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
  assert.equal(fixture.qlooCalls.length, 0);
});

test("unknown tools, arguments and missing call IDs are rejected before ranking", async () => {
  for (const step of [callStep("call", "fetch_any_url"), callStep("call", "rank_eligible_books", { maxPrice: "99999" }), callStep(""),
    { type: "google_search_call", id: "forbidden-native-tool", arguments: { queries: ["not enabled"] } } as Interactions.Step]) {
    const fixture = harness([toolInteraction([step])]);
    const result = await fixture.agent.run(input());
    assert(!result.body.ok && result.body.error.code === "TOOL_CALL_REJECTED");
    assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
    assert.equal(fixture.qlooCalls.length, 0);
  }
});

test("multiple and repeated tool calls cannot exceed the one-Qloo budget", async () => {
  const multiple = harness([toolInteraction([callStep("one"), callStep("two")])]);
  const first = await multiple.agent.run(input());
  assert(!first.body.ok && first.body.error.code === "TOOL_BUDGET");
  assert.deepEqual(first.body.usage, { geminiRequests: 1, qlooRequests: 0 });
  assert.equal(multiple.qlooCalls.length, 0);
  const repeated = harness([toolInteraction(), toolInteraction([callStep("two")])]);
  const second = await repeated.agent.run(input());
  assert(!second.body.ok && second.body.error.code === "TOOL_BUDGET");
  assert.deepEqual(second.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(repeated.qlooCalls.length, 1);
});

test("inconsistent native tool-call status and incomplete model status are honest failures", async () => {
  const wrongStatus = toolInteraction(); wrongStatus.status = "completed";
  const fixture = harness([wrongStatus]);
  const result = await fixture.agent.run(input());
  assert(!result.body.ok && result.body.error.code === "MODEL_RESPONSE_INVALID");
  assert.equal(fixture.qlooCalls.length, 0);
  const incomplete = harness([{ id: "incomplete", status: "requires_action", steps: [] }]);
  const other = await incomplete.agent.run(input());
  assert(!other.body.ok && other.body.error.code === "MODEL_INCOMPLETE");
  assert.equal(incomplete.qlooCalls.length, 0);
});

test("invalid book, evidence and agenda proposals each receive exactly one repair using the same ranking", async () => {
  for (const invalid of [
    { ...draft(), selectedBookId: "invented-local-book" },
    { ...draft(), evidenceRefs: ["invented-evidence"] },
    { ...draft(), agenda: [{ title: "Welcome", minutes: 44, activity: "Invite optional reflection." }] },
  ]) {
    const fixture = harness([toolInteraction(), proposal(invalid), proposal()]);
    const result = await fixture.agent.run(input());
    assert(result.body.ok && result.body.result.status === "proposal");
    assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 });
    assert.equal(fixture.qlooCalls.length, 1);
    assert.equal(fixture.geminiCalls[2].turn.generation_config?.tool_choice, "none");
    assert(result.body.trace.some((step) => step.action === "validation" && step.status === "failed"));
    assert.equal(result.body.trace.at(-1)?.status, "completed");
  }
});

test("a second invalid proposal exhausts repair without another Gemini or Qloo request", async () => {
  const invalid = { ...draft(), evidenceRefs: ["fabricated"] };
  const fixture = harness([toolInteraction(), proposal(invalid), proposal(invalid), proposal()]);
  const result = await fixture.agent.run(input());
  assert(!result.body.ok && result.body.error.code === "PROPOSAL_INVALID");
  assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 });
  assert.equal(fixture.geminiCalls.length, 3);
  assert.equal(fixture.qlooCalls.length, 1);
});

test("a premature proposal must perform a fresh native tool call before its final proposal", async () => {
  const fixture = harness([proposal(), toolInteraction([callStep("repair-ranking")]), proposal()]);
  const value = { ...input(), mode: "revise" as const, previousProposal: draft() };
  const result = await fixture.agent.run(value);
  assert(result.body.ok && result.body.result.status === "proposal");
  assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 });
  assert.equal(fixture.geminiCalls[0].turn.generation_config?.tool_choice, "auto");
  assert.deepEqual(fixture.geminiCalls[1].turn.generation_config?.tool_choice,
    { allowed_tools: { mode: "any", tools: ["rank_eligible_books"] } });
  assert.equal(fixture.qlooCalls.length, 1);
  assert.equal(result.body.trace[1].action, "validation");
  assert.equal(result.body.trace[1].status, "failed");
  const withoutFreshRank = harness([proposal(), proposal()]);
  const rejected = await withoutFreshRank.agent.run(value);
  assert(!rejected.body.ok && rejected.body.error.code === "PROPOSAL_INVALID");
  assert.deepEqual(rejected.body.usage, { geminiRequests: 2, qlooRequests: 0 });
});

test("malformed and oversized output cannot escape validation or the repair budget", async () => {
  for (const output_text of ["not JSON", "x".repeat(16 * 1024 + 1)]) {
    const fixture = harness([toolInteraction(), { ...completed(null), output_text }, proposal()]);
    const result = await fixture.agent.run(input());
    assert(result.body.ok && result.body.result.status === "proposal");
    assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 });
  }
});

test("Qloo upstream failure and empty evidence do not trigger model fallback or retry", async () => {
  const failed = harness([toolInteraction(), proposal()], { qlooReply: () => new Response(fixtureKey, { status: 429 }) });
  const first = await failed.agent.run(input());
  assert(!first.body.ok && first.body.error.code === "QLOO_RATE_LIMITED");
  assert.deepEqual(first.body.usage, { geminiRequests: 1, qlooRequests: 1 });
  assert.equal(failed.geminiCalls.length, 1);
  assert.equal(failed.qlooCalls.length, 1);
  assert(!JSON.stringify(first.body).includes(fixtureKey));
  assert(first.body.trace.some((step) => step.action === "rank_eligible_books" && step.status === "failed"));
  const empty = harness([toolInteraction()], { qlooReply: () => Response.json({ results: { entities: [] } }) });
  const second = await empty.agent.run(input());
  assert(!second.body.ok && second.body.error.code === "NO_RANKED_EVIDENCE");
  assert.deepEqual(second.body.usage, { geminiRequests: 1, qlooRequests: 1 });
});

test("sanitized SDK and unexpected failures are not retried or exposed in traces", async () => {
  for (const error of [new GeminiProviderError("GEMINI_QUOTA", 429), new Error(`raw provider error ${fixtureKey}`)]) {
    const fixture = harness([() => { throw error; }, proposal()]);
    const result = await fixture.agent.run(input());
    assert(!result.body.ok);
    assert.equal(result.body.error.code, error instanceof GeminiProviderError ? "GEMINI_QUOTA" : "PLANNING_FAILED");
    assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
    assert.equal(fixture.geminiCalls.length, 1);
    assert.equal(fixture.qlooCalls.length, 0);
    assert(!JSON.stringify(result.body).includes(fixtureKey));
  }
});

test("pre-cancelled runs make no provider request", async () => {
  const fixture = harness([]);
  const controller = new AbortController(); controller.abort();
  const result = await fixture.agent.run(input(), controller.signal);
  assert(!result.body.ok && result.body.error.code === "RUN_CANCELLED");
  assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
  assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
});

test("cancellation while Gemini is pending ignores its late tool call", async () => {
  let deliver!: (reply: Interactions.Interaction) => void;
  const waiting = new Promise<Interactions.Interaction>((resolve) => { deliver = resolve; });
  const fixture = harness([() => waiting]);
  const controller = new AbortController();
  const running = fixture.agent.run(input(), controller.signal);
  await nextTurn(); controller.abort();
  const result = await running;
  assert(!result.body.ok && result.body.error.code === "RUN_CANCELLED");
  assert(fixture.geminiCalls[0].signal.aborted);
  deliver(toolInteraction()); await nextTurn();
  assert.equal(fixture.qlooCalls.length, 0);
  assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
});

test("overall timeout stops a pending Gemini operation and prevents later tool execution", async () => {
  let deliver!: (reply: Interactions.Interaction) => void;
  const waiting = new Promise<Interactions.Interaction>((resolve) => { deliver = resolve; });
  const fixture = harness([() => waiting], { overallTimeoutMs: 10 });
  const result = await fixture.agent.run(input());
  assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT");
  assert.equal(result.status, 504);
  assert(fixture.geminiCalls[0].signal.aborted);
  deliver(toolInteraction()); await nextTurn();
  assert.equal(fixture.qlooCalls.length, 0);
  assert.equal(fixture.geminiCalls.length, 1);
});

test("overall timeout propagates into Qloo and prevents a subsequent model request", async () => {
  let deliver!: (response: Response) => void;
  const pending = new Promise<Response>((resolve) => { deliver = resolve; });
  const fixture = harness([toolInteraction(), proposal()], { overallTimeoutMs: 10, qlooReply: () => pending });
  const result = await fixture.agent.run(input());
  assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT");
  assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 1 });
  assert(fixture.qlooCalls[0].options.signal?.aborted);
  deliver(rankedResponse(fixture.qlooCalls[0].url)); await nextTurn();
  assert.equal(fixture.geminiCalls.length, 1);
  assert.equal(fixture.qlooCalls.length, 1);
});

const pacingRejection = () => ({ ok: false as const, error: { status: 429 as const, code: "GEMINI_PACING_LIMIT",
  message: "The planner is at its short-term limit. Wait 31 seconds before trying again.", retryAfterSeconds: 31 } });

test("pacing rejects the initial model call before counting or dispatching either provider", async () => {
  let checks = 0;
  const fixture = harness([], { beforeGemini: async (signal, remainingMs) => {
    checks++;
    assert(!signal.aborted && remainingMs > 0 && remainingMs <= 30_000);
    return pacingRejection();
  } });
  const result = await fixture.agent.run(input());
  assert.equal(result.status, 429);
  assert(!result.body.ok && result.body.error.code === "GEMINI_PACING_LIMIT");
  assert.equal(result.body.error.retryAfterSeconds, 31);
  assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
  assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
  assert.equal(checks, 1);
  assert.deepEqual(result.body.trace.map(({ action, status }) => ({ action, status })), [{ action: "gemini_pacing", status: "failed" }]);
});

test("continuation pacing rejection preserves actual first-model and fresh Qloo accounting", async () => {
  let checks = 0;
  const fixture = harness([toolInteraction(), proposal()], { beforeGemini: async () => ++checks === 1 ? { ok: true } : pacingRejection() });
  const result = await fixture.agent.run(input());
  assert(!result.body.ok && result.body.error.code === "GEMINI_PACING_LIMIT");
  assert.equal(result.status, 429);
  assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 1 });
  assert.equal(fixture.geminiCalls.length, 1);
  assert.equal(fixture.qlooCalls.length, 1);
  assert.equal(checks, 2);
  assert.deepEqual(result.body.trace.map(({ action, status }) => ({ action, status })), [
    { action: "gemini_pacing", status: "completed" }, { action: "gemini", status: "completed" },
    { action: "rank_eligible_books", status: "completed" }, { action: "gemini_pacing", status: "failed" },
  ]);
  assert(result.body.trace.every(({ elapsedMs }) => Number.isInteger(elapsedMs) && elapsedMs! >= 0));
});

test("a permitted repair must pass pacing before its third model dispatch", async () => {
  let checks = 0;
  const invalid = { ...draft(), evidenceRefs: ["fabricated"] };
  const fixture = harness([toolInteraction(), proposal(invalid), proposal()], { beforeGemini: async () => ++checks < 3 ? { ok: true } : pacingRejection() });
  const result = await fixture.agent.run(input());
  assert(!result.body.ok && result.body.error.code === "GEMINI_PACING_LIMIT");
  assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(fixture.geminiCalls.length, 2);
  assert.equal(fixture.qlooCalls.length, 1);
  assert.equal(checks, 3);
  assert(result.body.trace.some(step => step.action === "validation" && step.status === "failed"));
  assert.equal(result.body.trace.at(-1)?.action, "gemini_pacing");
});

test("successful paced native continuation and repair retain signatures and the original request limits", async () => {
  let checks = 0;
  const budgets: number[] = [];
  const native = toolInteraction();
  const fixture = harness([native, proposal({ ...draft(), evidenceRefs: ["invalid-evidence"] }), proposal()], {
    beforeGemini: async (signal, remainingMs) => {
      assert(!signal.aborted);
      assert.equal(fixture.geminiCalls.length, checks, "pacing precedes each actual model dispatch");
      checks++;
      budgets.push(remainingMs);
      return { ok: true };
    },
  });
  const result = await fixture.agent.run(input());
  assert(result.body.ok && result.body.result.status === "proposal");
  assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 });
  assert.equal(checks, 3);
  assert.equal(fixture.qlooCalls.length, 1);
  assert(budgets.every((remaining, index) => remaining > 0 && remaining <= (index ? budgets[index - 1] : 30_000)));
  assert.equal(result.body.trace.filter(step => step.action === "gemini_pacing" && step.status === "completed").length, 3);
  assert.deepEqual(steps(fixture.geminiCalls[2].turn).slice(1, 3), native.steps);
  assert.equal(fixture.geminiCalls[2].turn.generation_config?.tool_choice, "none");
  assert(!JSON.stringify(result.body).includes(hiddenMarker));
});

test("invalid or unconfigured event preflight skips pacing as well as both providers", async () => {
  let checks = 0;
  const beforeGemini: BeforeGemini = async () => { checks++; return { ok: true }; };
  const missing = harness([], { geminiConfigured: false, beforeGemini });
  assert(!(await missing.agent.run(input())).body.ok);
  const invalid = harness([], { beforeGemini });
  assert(!(await invalid.agent.run({ ...input(), catalogueSource: "imported" })).body.ok);
  assert.equal(checks, 0);
  assert.equal(missing.geminiCalls.length + invalid.geminiCalls.length + invalid.qlooCalls.length, 0);
});

test("unexpected pacing-store failures reject without exposing details or trying providers", async () => {
  const fixture = harness([], { beforeGemini: async () => { throw new Error(`synthetic pacing error ${fixtureKey}`); } });
  const result = await fixture.agent.run(input());
  assert.equal(result.status, 503);
  assert(!result.body.ok && result.body.error.code === "USAGE_UNAVAILABLE");
  assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
  assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
  assert(!JSON.stringify(result.body).includes(fixtureKey));
});

test("cancellation during pacing rejects late admission before any model dispatch", async () => {
  let deliver!: (value: { ok: true }) => void;
  let pacingSignal: AbortSignal | undefined;
  const pending = new Promise<{ ok: true }>(resolve => { deliver = resolve; });
  const fixture = harness([], { beforeGemini: async signal => { pacingSignal = signal; return pending; } });
  const controller = new AbortController();
  const running = fixture.agent.run(input(), controller.signal);
  await nextTurn(); controller.abort();
  const result = await running;
  assert(!result.body.ok && result.body.error.code === "RUN_CANCELLED");
  assert(pacingSignal?.aborted);
  assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
  deliver({ ok: true }); await nextTurn();
  assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
  assert.equal(result.body.trace.at(-1)?.action, "gemini_pacing");
  assert.equal(result.body.trace.at(-1)?.deadline, "user_cancel");
});

test("pacing shares the overall deadline and cannot start a model after expiry", async () => {
  let deliver!: (value: { ok: true }) => void;
  let pacingSignal: AbortSignal | undefined;
  const pending = new Promise<{ ok: true }>(resolve => { deliver = resolve; });
  const fixture = harness([], { overallTimeoutMs: 15, beforeGemini: async (signal, remainingMs) => {
    pacingSignal = signal;
    assert(remainingMs > 0 && remainingMs <= 15);
    return pending;
  } });
  const result = await fixture.agent.run(input());
  assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT");
  assert.equal(result.status, 504);
  assert(pacingSignal?.aborted);
  deliver({ ok: true }); await nextTurn();
  assert.equal(fixture.geminiCalls.length + fixture.qlooCalls.length, 0);
  assert.equal(result.body.trace.at(-1)?.action, "gemini_pacing");
  assert.equal(result.body.trace.at(-1)?.deadline, "agent_run");
});
