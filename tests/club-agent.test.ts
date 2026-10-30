import assert from "node:assert/strict";
import test from "node:test";
import type { Interactions } from "@google/genai";
import { createClubAgent, type ClubQloo } from "../lib/club-agent.ts";
import type { ClubDiscovery, ClubDraft, ClubInput, CulturalKind } from "../lib/club-types.ts";
import { GeminiProviderError, type GeminiProvider, type GeminiTurn } from "../lib/gemini-provider.ts";
import type { BeforeGemini } from "../lib/event-agent.ts";
import { createClubQloo } from "../lib/club-qloo.ts";
import { SAMPLE_CATALOGUE } from "../lib/catalogue.ts";
import { SAMPLE_QLOO_MAPPINGS } from "../lib/qloo-sample.ts";

const id = "11111111-1111-4111-8111-111111111111";
const hidden = "synthetic-hidden-reasoning-never-public";
function input(kind: CulturalKind = "book"): ClubInput {
  return { club: "Neighborhood curiosity collective", goal: "Plan an interactive cultural gathering.", duration: 45, groupSize: 12, location: "",
    budget: null, maxPages: null, languages: [], format: kind, source: "discovery", interests: [{ preset: "a", index: 0 }], resources: [], selected: null, mode: "generate" };
}
function draft(): ClubDraft { return { selectedEntityId: id, eventTitle: "A shared cultural evening", formatDescription: "Offer paired conversation and optional creative responses.", evidenceRefs: [`affinity:${id}`],
  agenda: [{ title: "Welcome", minutes: 5, activity: "Invite introductions or a quiet pass." }, { title: "Conversation", minutes: 30, activity: "Offer open prompts and voluntary responses." }, { title: "Reflection", minutes: 10, activity: "Invite a final observation." }],
  materials: ["Blank cards"], invitation: "Join a relaxed gathering with optional conversation." }; }
function discovery(kind: CulturalKind = "book"): ClubDiscovery { return { kind,
  candidates: [{ entity: { entityId: id, name: "Synthetic cultural focus", kind, metadata: {}, reference: { token: "fixture-reference" } }, facts: {}, factSource: "provider", assessments: [], evidence: [{ id: `affinity:${id}`, entityId: id, kind: "affinity", value: 0.71 }] }],
  interests: [], coverage: { submitted: null, resolved: null, assessed: 1 }, warnings: [] }; }
function native(steps?: Interactions.Step[]): Interactions.Interaction { return { id: "fixture-native", status: "requires_action", steps: steps ?? [
  { type: "thought", signature: "opaque-native-signature", summary: [{ type: "text", text: hidden }] },
  { type: "function_call", id: "native-call-1", name: "discover_cultural_focus", arguments: {} },
] }; }
function completed(value: unknown): Interactions.Interaction { const output_text = JSON.stringify(value); return { id: "fixture-completed", status: "completed", output_text,
  steps: [{ type: "model_output", content: [{ type: "text", text: output_text }] }] }; }
function proposal(value = draft()) { return completed({ status: "proposal", proposal: value }); }

test("confirmed audiences and revised constraints reach fresh Qloo requests and current evidence reaches the native continuation", async () => {
  const requests: URL[] = [];
  const continuations: { entityId: string; evidence: { id: string; value: number }[] }[][] = [];
  const qloo = createClubQloo({ credential: "offline-key", fetcher: async (url) => {
    const target = new URL(String(url)); requests.push(target);
    const allowed = (target.searchParams.get("filter.results.entities") ?? "").split(",");
    // A controlled transport reports the current call's number, not a quality claim.
    const entities = allowed.map((entityId) => ({ entity_id: entityId, name: SAMPLE_CATALOGUE.find((book) => SAMPLE_QLOO_MAPPINGS[book.id] === entityId)?.title ?? "Controlled book", types: ["urn:entity:book"], query: { affinity: requests.length / 10 } }));
    return Response.json({ results: { entities } });
  } });
  const gemini: GeminiProvider = { async create(turn) {
    const steps = turn.input as Interactions.Step[];
    const result = steps.find((step) => step.type === "function_result");
    if (!result || result.type !== "function_result") return native();
    assert(Array.isArray(result.result));
    const text = result.result[0]; assert(text?.type === "text");
    const data = JSON.parse(text.text) as { candidates: { entityId: string; evidence: { id: string; value: number }[] }[] };
    continuations.push(data.candidates);
    const choice = data.candidates.find((entry) => entry.entityId === SAMPLE_QLOO_MAPPINGS["the-guide"]); assert(choice);
    return proposal({ ...draft(), selectedEntityId: choice.entityId, evidenceRefs: [choice.evidence[0].id] });
  } };
  const agent = createClubAgent({ qloo, gemini, qlooConfigured: true, geminiConfigured: true });
  const base: ClubInput = { ...input(), source: "sample", budget: { amount: 450, currency: "INR", basis: "per_person" }, maxPages: 400, languages: ["English", "Hindi", "Bengali"] };
  const variants: ClubInput[] = [base, { ...base, interests: [{ preset: "b", index: 0 }, { preset: "b", index: 1 }] }, { ...base, budget: { ...base.budget!, amount: 300 } }];
  for (const [index, current] of variants.entries()) {
    const result = await agent.run(current);
    assert(result.body.ok && result.body.result.status === "proposal");
    assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
    assert.equal(result.body.result.proposal.focus.evidence[0].value, (index + 1) / 10);
    assert.equal(result.body.result.proposal.selectedEntityId, SAMPLE_QLOO_MAPPINGS["the-guide"], "unchanged selections are allowed");
    assert.equal(result.body.result.proposal.snapshot.budget?.amount, current.budget?.amount);
  }
  assert.equal(requests.length, 3); assert.equal(continuations.length, 3);
  assert.notEqual(requests[0].searchParams.get("signal.interests.entities"), requests[1].searchParams.get("signal.interests.entities"));
  assert.equal(requests[0].searchParams.get("filter.results.entities"), requests[1].searchParams.get("filter.results.entities"), "same constraints preserve the candidate pool");
  assert(requests[0].searchParams.get("filter.results.entities")?.includes(SAMPLE_QLOO_MAPPINGS["the-namesake"]));
  assert(!requests[2].searchParams.get("filter.results.entities")?.includes(SAMPLE_QLOO_MAPPINGS["the-namesake"]));
  assert.deepEqual(continuations[2].map((entry) => entry.entityId), requests[2].searchParams.get("filter.results.entities")?.split(","), "provider order and candidate membership are preserved in the tool result");
});
type Reply = Interactions.Interaction | ((turn: GeminiTurn, signal: AbortSignal) => Promise<Interactions.Interaction> | Interactions.Interaction);
function fixture(replies: Reply[], options: {
  beforeGemini?: BeforeGemini; overallTimeoutMs?: number; geminiConfigured?: boolean; qlooConfigured?: boolean;
  prepareError?: { code: string; message: string }; discover?: ClubQloo["discover"];
} = {}) {
  const geminiCalls: { turn: GeminiTurn; remaining: number | undefined; signal: AbortSignal }[] = [];
  const qlooCalls: { input: ClubInput; signal?: AbortSignal }[] = [];
  const gemini: GeminiProvider = { async create(turn, signal, remaining) { const reply = replies[geminiCalls.length]; geminiCalls.push({ turn: structuredClone(turn), signal, remaining }); assert(reply, "Unexpected model request"); return typeof reply === "function" ? reply(turn, signal) : structuredClone(reply); } };
  const qloo: ClubQloo = {
    prepare(value) {
      if (options.prepareError) return { status: 400, body: { ok: false, error: options.prepareError } };
      const current = value as ClubInput;
      const kind = current.format === "auto" || current.format === "manual" ? "book" : current.format;
      return { status: 200, body: { ok: true, input: structuredClone(current), kind, interests: [], selected: current.selected ? discovery(kind).candidates[0].entity : null } };
    },
    async discover(current, signal) { qlooCalls.push({ input: structuredClone(current), signal }); return options.discover ? options.discover(current, signal) : { status: 200, body: { ok: true, discovery: discovery(current.format as CulturalKind) } }; },
  };
  return { agent: createClubAgent({ gemini, qloo, thinkingLevel: "minimal", geminiConfigured: options.geminiConfigured ?? true, qlooConfigured: options.qlooConfigured ?? true, beforeGemini: options.beforeGemini, overallTimeoutMs: options.overallTimeoutMs }), geminiCalls, qlooCalls };
}

test("all four formats execute two native model turns and one fresh discovery with signature-bearing continuation", async () => {
  for (const kind of ["book", "artist", "movie", "place"] as const) {
    const first = native(); const f = fixture([first, proposal()]); const result = await f.agent.run(input(kind));
    assert.equal(result.status, 200); assert(result.body.ok && result.body.result.status === "proposal");
    assert.equal(result.body.result.proposal.focus.entity.kind, kind);
    assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
    assert.equal(f.geminiCalls.length, 2); assert.equal(f.qlooCalls.length, 1);
    const continuation = f.geminiCalls[1].turn.input as Interactions.Step[];
    assert.deepEqual(continuation.slice(1, 3), first.steps);
    const toolResult = continuation.find((step) => step.type === "function_result");
    assert(toolResult?.type === "function_result"); assert.equal(toolResult.call_id, "native-call-1");
    assert.equal(f.geminiCalls[0].turn.generation_config?.tool_choice, "auto");
    assert.equal(f.geminiCalls[0].turn.generation_config?.thinking_level, "minimal");
    assert.equal(f.geminiCalls[1].turn.generation_config?.tool_choice, "none");
    assert(f.geminiCalls.every((call) => call.remaining !== undefined && call.remaining <= 20_000));
    assert(!JSON.stringify(result.body).includes(hidden)); assert(!JSON.stringify(result.body).includes("opaque-native-signature"));
  }
});

test("invalid fields, missing credentials, unsupported goals and deliberate manual route dispatch no providers", async () => {
  for (const options of [{ geminiConfigured: false }, { qlooConfigured: false }, { prepareError: { code: "CLARIFICATION_REQUIRED", message: "Which cultural focus should take priority?" } }, { prepareError: { code: "MANUAL_PLANNING", message: "Use the organizer-led editor for this goal." } }]) {
    const f = fixture([], options); const result = await f.agent.run(input()); assert.equal(f.geminiCalls.length, 0); assert.equal(f.qlooCalls.length, 0); assert.deepEqual(result.body.usage, { geminiRequests: 0, qlooRequests: 0 });
  }
  const invalid = fixture([]); const result = await invalid.agent.run({ ...input(), duration: -1 }); assert.equal(result.status, 400); assert.equal(invalid.geminiCalls.length, 0);
});

test("an immediate clarification needs neither a fake proposal nor a tool result", async () => {
  const f = fixture([completed({ status: "clarification", question: "Should this gathering prioritize a film or a book?" })]);
  const result = await f.agent.run(input()); assert(result.body.ok && result.body.result.status === "clarification"); assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
});

test("unknown tools, modified arguments, repeated calls and inconsistent status are rejected before extra provider dispatch", async () => {
  for (const response of [
    native([{ type: "function_call", id: "x", name: "fetch_any_url", arguments: {} }]),
    native([{ type: "function_call", id: "x", name: "discover_cultural_focus", arguments: { type: "place" } }]),
    native([{ type: "function_call", id: "x", name: "discover_cultural_focus", arguments: {} }, { type: "function_call", id: "y", name: "discover_cultural_focus", arguments: {} }]),
    { ...native(), status: "completed" as const },
  ]) { const f = fixture([response]); const result = await f.agent.run(input()); assert(!result.body.ok); assert.equal(f.qlooCalls.length, 0); }
  const repeated = fixture([native(), native()]); const result = await repeated.agent.run(input()); assert(!result.body.ok && result.body.error.code === "TOOL_BUDGET"); assert.equal(repeated.qlooCalls.length, 1);
});

test("no recorded evidence fallback follows empty discovery, provider errors or invalid grounded proposals", async () => {
  const empty = fixture([native()], { discover: async () => ({ status: 200, body: { ok: true, discovery: { ...discovery(), candidates: [] } } }) });
  const result = await empty.agent.run(input()); assert(!result.body.ok && result.body.error.code === "NO_CANDIDATES"); assert.equal(empty.geminiCalls.length, 1);
  const upstream = fixture([native()], { discover: async () => ({ status: 429, body: { ok: false, error: { code: "QLOO_RATE_LIMITED", message: "Try later.", upstreamStatus: 429 } } }) });
  const failure = await upstream.agent.run(input()); assert(!failure.body.ok && failure.body.error.upstreamStatus === 429); assert.equal(upstream.geminiCalls.length, 1);
  const bad = proposal({ ...draft(), evidenceRefs: ["old-run-evidence"] }); const repair = fixture([native(), bad, bad]);
  const rejected = await repair.agent.run(input()); assert(!rejected.body.ok && rejected.body.error.code === "PROPOSAL_INVALID"); assert.deepEqual(rejected.body.usage, { geminiRequests: 3, qlooRequests: 1 });
});

test("one permitted repair retains the same discovery and can never consume a second Insights request", async () => {
  const f = fixture([native(), proposal({ ...draft(), agenda: [{ title: "Discussion", minutes: 44, activity: "Offer open conversation." }] }), proposal()]);
  const result = await f.agent.run(input()); assert(result.body.ok && result.body.result.status === "proposal"); assert.deepEqual(result.body.usage, { geminiRequests: 3, qlooRequests: 1 }); assert.equal(f.qlooCalls.length, 1);
});

test("shared pacing rejects both initial and continuation dispatch, reporting earlier calls honestly", async () => {
  for (const deniedAt of [1, 2]) {
    let gates = 0;
    const f = fixture([native()], { beforeGemini: async () => ++gates === deniedAt ? { ok: false, error: { status: 429, code: "GEMINI_PACED", message: "Please try again shortly.", retryAfterSeconds: 20 } } : { ok: true } });
    const result = await f.agent.run(input()); assert(!result.body.ok && result.body.error.code === "GEMINI_PACED");
    assert.deepEqual(result.body.usage, { geminiRequests: deniedAt - 1, qlooRequests: deniedAt - 1 }); assert.equal(f.geminiCalls.length, deniedAt - 1); assert.equal(f.qlooCalls.length, deniedAt - 1);
    assert.equal(result.body.error.retryAfterSeconds, 20);
  }
});

test("cancellation before dispatch and during in-flight work reject late responses", async () => {
  const before = new AbortController(); before.abort(); const f = fixture([]); const initial = await f.agent.run(input(), before.signal); assert(!initial.body.ok && initial.body.error.code === "RUN_CANCELLED"); assert.equal(f.geminiCalls.length, 0);
  const cancel = new AbortController(); let resolve!: (value: Interactions.Interaction) => void;
  const pending = fixture([() => new Promise((done) => { resolve = done; })]);
  const run = pending.agent.run(input(), cancel.signal); await new Promise((done) => setImmediate(done)); cancel.abort();
  const result = await run; assert(!result.body.ok && result.body.error.code === "RUN_CANCELLED"); resolve(native()); await new Promise((done) => setImmediate(done)); assert.equal(pending.qlooCalls.length, 0);
});

test("overall deadline bounds non-cooperative work and leaves no continuation after cancellation", async () => {
  const f = fixture([native()], { overallTimeoutMs: 15, discover: async (_input, signal) => {
    assert(signal); await new Promise((done) => setTimeout(done, 25)); return { status: 200, body: { ok: true, discovery: discovery() } };
  } });
  const result = await f.agent.run(input()); assert(!result.body.ok && result.body.error.code === "RUN_TIMEOUT"); assert.equal(f.geminiCalls.length, 1);
  await new Promise((done) => setTimeout(done, 30)); assert.equal(f.geminiCalls.length, 1);
});

test("provider failures expose only sanitized error and configured request counts", async () => {
  const f = fixture([() => { throw new GeminiProviderError("GEMINI_REQUEST_REJECTED", 400); }]);
  const result = await f.agent.run(input()); assert(!result.body.ok && result.body.error.upstreamStatus === 400); assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
  const raw = fixture([() => { throw new Error("fake-secret-key-and-private-prompt"); }]); const generic = await raw.agent.run(input()); assert(!JSON.stringify(generic.body).includes("fake-secret"));
});

test("native agent integrates the real signed-entity Qloo adapter across four kinds using only a controlled transport", async () => {
  for (const kind of ["book", "artist", "movie", "place"] as const) {
    let requests = 0;
    const qloo = createClubQloo({ credential: "synthetic-integration-credential", signingKey: "synthetic-integration-signing-key", fetcher: async (target, options) => {
      requests += 1;
      const url = new URL(String(target));
      assert.equal(url.origin, "https://hackathon.api.qloo.com");
      assert.equal(url.pathname, "/v2/insights");
      assert.equal(url.searchParams.get("filter.type"), `urn:entity:${kind}`);
      assert.equal(url.searchParams.get("filter.results.entities"), null);
      assert.equal(options?.redirect, "manual");
      return Response.json({ results: { entities: [{ entity_id: id, name: "Synthetic cultural focus", types: [`urn:entity:${kind}`],
        properties: kind === "movie" ? { duration: 169 } : {}, query: { affinity: 0.71 } }] } });
    } });
    let calls = 0;
    const gemini: GeminiProvider = { async create() { return calls++ === 0 ? native() : proposal(); } };
    const agent = createClubAgent({ qloo, gemini, geminiConfigured: true, qlooConfigured: true });
    const result = await agent.run(input(kind));
    assert(result.body.ok && result.body.result.status === "proposal");
    assert.equal(result.body.result.proposal.focus.entity.kind, kind);
    assert.equal(result.body.result.proposal.snapshot.format, kind);
    assert.equal(requests, 1); assert.equal(calls, 2);
  }
});
