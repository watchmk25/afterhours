import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import type { Interactions } from "@google/genai";
import {
  createGeminiProvider,
  GeminiProviderError,
} from "../lib/gemini-provider.ts";
import type { GeminiProviderErrorCode, GeminiTurn } from "../lib/gemini-provider.ts";
import { createEventAgent } from "../lib/event-agent.ts";
import { QLOO_PRESETS, SAMPLE_QLOO_MAPPINGS } from "../lib/qloo-sample.ts";
import { createQlooService } from "../lib/qloo-service.ts";

// All credentials, signatures, provider bodies, and transports here are synthetic.
const fixtureKey = "afterhours-synthetic-gemini-key";
const controller = () => new AbortController();
const completed = (text = '{"title":"Synthetic event"}') => ({
  id: "synthetic-completion",
  status: "completed",
  steps: [{ type: "model_output", content: [{ type: "text", text }] }],
});
const tool: Interactions.Function = {
  type: "function",
  name: "rank_eligible_books",
  description: "Rank the server's currently eligible sample inventory.",
  parameters: { type: "object", properties: {}, additionalProperties: false },
};
const firstTurn: GeminiTurn = {
  input: [{ type: "user_input", content: [{ type: "text", text: "Plan a synthetic book event." }] }],
  tools: [tool],
  generation_config: {
    thinking_level: "low",
    max_output_tokens: 4096,
    tool_choice: { allowed_tools: { mode: "any", tools: ["rank_eligible_books"] } },
  },
};

function stub(respond: (request: Request) => Response | Promise<Response>) {
  const calls: Request[] = [];
  const bodies: unknown[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const request = new Request(input, init);
    calls.push(request);
    bodies.push(JSON.parse(await request.clone().text()));
    return respond(request);
  };
  return { fetcher, calls, bodies };
}

async function expectFailure(operation: Promise<unknown>, code: GeminiProviderErrorCode, status?: number) {
  let failure: unknown;
  try {
    await operation;
  } catch (error) {
    failure = error;
  }
  assert(failure instanceof GeminiProviderError);
  assert.equal(failure.code, code);
  assert.equal(failure.upstreamStatus, status);
  for (const representation of [String(failure), JSON.stringify(failure), failure.stack ?? ""]) {
    assert(!representation.includes(fixtureKey));
    assert(!representation.includes("synthetic-raw-provider-error"));
  }
  assert.equal(failure.cause, undefined);
}

test("Gemini uses the actual pinned SDK's fixed native endpoint and explicit server key", async () => {
  const fake = stub(() => Response.json(completed()));
  const provider = createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher });
  const result = await provider.create(firstTurn, controller().signal);
  assert.equal(fake.calls.length, 1);
  const request = fake.calls[0];
  assert.equal(request.url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(request.method, "POST");
  assert.equal(request.headers.get("x-goog-api-key"), fixtureKey);
  assert(!request.headers.has("authorization"));
  assert.equal(request.redirect, "manual");
  assert.equal(request.cache, "no-store");
  assert(request.signal instanceof AbortSignal);
  assert.deepEqual(fake.bodies[0], {
    ...firstTurn, model: "gemini-3.8-flash", store: false, stream: false, background: false,
  });
  assert(!JSON.stringify(fake.bodies).includes(fixtureKey));
  assert.equal(result.output_text, '{"title":"Synthetic event"}');
  assert.deepEqual(result.steps, completed().steps);
});

test("the event agent's initial request serializes through the pinned Interactions SDK without generateContent fields", async () => {
  const fake = stub(() => Response.json({ error: {
    code: "invalid_request", message: "Synthetic diagnostic rejection.",
  } }, { status: 400 }));
  let qlooRequests = 0;
  const qloo = createQlooService({ credential: "synthetic-qloo-key", minimumCandidates: 1,
    signingKey: "synthetic-signing-key", fetcher: async () => {
      qlooRequests += 1;
      throw new Error("Unexpected Qloo transport invocation.");
    } });
  const agent = createEventAgent({
    gemini: createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }),
    qloo, geminiConfigured: true, qlooConfigured: true,
  });
  const filters = { maxPrice: "450", maxPages: "400", languages: ["English", "Hindi", "Bengali"] };
  const result = await agent.run({ catalogueSource: "sample", filters,
    interests: QLOO_PRESETS[0].interests.map(({ reference }) => structuredClone(reference)),
    request: "Plan a welcoming interactive book event.", duration: 45, mode: "generate" });
  assert.equal(result.body.ok, false);
  assert.deepEqual(result.body.usage, { geminiRequests: 1, qlooRequests: 0 });
  assert.equal(qlooRequests, 0);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].url, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(fake.calls[0].method, "POST");
  assert.equal(fake.calls[0].headers.get("x-goog-api-key"), fixtureKey);
  assert(!fake.calls[0].headers.has("authorization"));
  const body = fake.bodies[0] as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), ["background", "generation_config", "input", "model",
    "store", "stream", "system_instruction", "tools"]);
  assert.equal(body.model, "gemini-3.8-flash");
  assert.equal(body.store, false);
  assert.equal(body.stream, false);
  assert.equal(body.background, false);
  assert.deepEqual(body.generation_config, { thinking_level: "low", max_output_tokens: 4096,
    tool_choice: "auto" });
  assert(!Object.hasOwn(body, "response_format"));
  assert(!Object.hasOwn(body, "contents"));
  assert(!Object.hasOwn(body, "config"));
  const tools = body.tools as Record<string, unknown>[];
  assert.equal(tools.length, 1);
  assert.equal(tools[0].type, "function");
  assert.equal(tools[0].name, "rank_eligible_books");
  assert.deepEqual(tools[0].parameters, { type: "object", properties: {}, additionalProperties: false });
  const history = body.input as Interactions.Step[];
  assert.equal(history.length, 1);
  assert.equal(history[0].type, "user_input");
  assert(history[0].type === "user_input");
  const content = history[0].content?.[0];
  assert(content?.type === "text");
  const organizerInput = JSON.parse(content.text);
  assert.deepEqual(organizerInput.authoritativeFilters, filters);
  assert.equal(organizerInput.durationMinutes, 45);
  assert.equal(organizerInput.confirmedInterests.length, 2);
  assert(!JSON.stringify(body).includes(fixtureKey));
});

test("the configured Flash Lite agent sends minimal thinking and compact evidence through the actual SDK", async () => {
  const nativeSteps: Interactions.Step[] = [
    { type: "thought", signature: "synthetic-lite-native-signature", summary: [{ type: "text", text: "Synthetic hidden content" }] },
    { type: "function_call", id: "synthetic-lite-call", name: "rank_eligible_books", arguments: {} },
  ];
  let geminiRequests = 0;
  const fake = stub(() => Response.json(++geminiRequests === 1
    ? { status: "requires_action", steps: nativeSteps }
    : completed(JSON.stringify({ status: "clarification", question: "Would you prefer paired or small-group discussion?" }))));
  let qlooRequests = 0;
  const qloo = createQlooService({ credential: "synthetic-qloo-key", minimumCandidates: 1,
    signingKey: "synthetic-signing-key", fetcher: async () => {
      qlooRequests += 1;
      return Response.json({ results: { entities: [{ entity_id: SAMPLE_QLOO_MAPPINGS["the-guide"],
        types: ["urn:entity:book"], query: { affinity: 0.625, explainability: {
          "signal.interests.entities": [{ entity_id: QLOO_PRESETS[0].interests[0].entityId, score: 0.4 }],
        } } }] } });
    } });
  const agent = createEventAgent({
    gemini: createGeminiProvider({ apiKey: fixtureKey, model: "gemini-3.5-flash-lite", fetcher: fake.fetcher }),
    qloo, geminiConfigured: true, qlooConfigured: true, thinkingLevel: "minimal",
  });
  const filters = { maxPrice: "450", maxPages: "400", languages: ["English", "Hindi", "Bengali"] };
  const result = await agent.run({ catalogueSource: "sample", filters,
    interests: QLOO_PRESETS[0].interests.map(({ reference }) => structuredClone(reference)),
    request: "Plan a welcoming interactive book event.", duration: 45, mode: "generate" });
  assert(result.body.ok && result.body.result.status === "clarification");
  assert.deepEqual(result.body.usage, { geminiRequests: 2, qlooRequests: 1 });
  assert.equal(geminiRequests, 2);
  assert.equal(qlooRequests, 1);
  const first = fake.bodies[0] as Record<string, unknown>;
  const second = fake.bodies[1] as Record<string, unknown>;
  for (const body of [first, second]) {
    assert.equal(body.model, "gemini-3.5-flash-lite");
    assert.equal(body.store, false);
    assert.equal(body.stream, false);
    assert.equal(body.background, false);
    assert(!Object.hasOwn(body, "contents"));
    assert(!Object.hasOwn(body, "config"));
  }
  assert.deepEqual(first.generation_config, { thinking_level: "minimal", max_output_tokens: 4096, tool_choice: "auto" });
  assert.deepEqual(second.generation_config, { thinking_level: "minimal", max_output_tokens: 4096, tool_choice: "none" });
  assert(!Object.hasOwn(first, "response_format"));
  assert(Object.hasOwn(second, "response_format"));
  const firstHistory = first.input as Interactions.Step[];
  assert.equal(firstHistory.length, 1);
  assert(firstHistory[0].type === "user_input");
  const content = firstHistory[0].content?.[0];
  assert(content?.type === "text");
  const organizerInput = JSON.parse(content.text);
  assert.deepEqual(organizerInput.authoritativeFilters, filters);
  assert.equal(organizerInput.durationMinutes, 45);
  assert(!Object.hasOwn(organizerInput, "outputSchema"), "The initial tool turn does not duplicate the final response schema");
  const history = second.input as Interactions.Step[];
  assert.deepEqual(history.slice(1, 3), nativeSteps, "Native continuation keeps complete signature-bearing steps");
  const toolResult = history[3];
  assert(toolResult.type === "function_result");
  assert.equal(toolResult.call_id, "synthetic-lite-call");
  assert(Array.isArray(toolResult.result) && toolResult.result[0].type === "text");
  const payload = JSON.parse(toolResult.result[0].text);
  assert.equal(payload.books.length, 1);
  assert.equal(payload.books[0].localId, "the-guide");
  assert.equal(payload.books[0].title, "The Guide");
  assert.equal(payload.books[0].author, "R. K. Narayan");
  assert.deepEqual(payload.books[0].evidence, [
    { id: "affinity:the-guide", kind: "affinity", value: 0.625 },
    { id: `contribution:the-guide:${QLOO_PRESETS[0].interests[0].entityId}`, kind: "contribution", value: 0.4,
      interestName: QLOO_PRESETS[0].interests[0].name },
  ]);
  for (const key of ["priceInr", "pages", "language", "stock", "affinity"]) {
    assert(!Object.hasOwn(payload.books[0], key), `The tool result omits redundant ${key}`);
  }
  assert.deepEqual(payload.coverage, { eligibleCount: 6, supportedCount: 3, assessedCount: 1 });
  assert(!JSON.stringify(result.body).includes("synthetic-lite-native-signature"));
  assert(!JSON.stringify(result.body).includes("Synthetic hidden content"));
  assert(!JSON.stringify(result.body).includes(fixtureKey));
});

test("Gemini explicit configuration ignores conflicting synthetic provider environment settings", async () => {
  // A child receives only synthetic environment values. This neither reads nor
  // modifies this test runner's actual provider credentials or environment.
  const providerUrl = new URL("../lib/gemini-provider.ts", import.meta.url).href;
  const script = `
    import assert from 'node:assert/strict';
    import {createGeminiProvider} from ${JSON.stringify(providerUrl)};
    let calls = 0;
    const provider = createGeminiProvider({apiKey:'explicit-synthetic-key',fetcher:async(input,init)=>{
      calls++;
      const request = new Request(input,init);
      assert.equal(request.url,'https://generativelanguage.googleapis.com/v1beta/interactions');
      assert.equal(request.headers.get('x-goog-api-key'),'explicit-synthetic-key');
      assert(!request.headers.has('authorization'));
      return Response.json({id:'synthetic',status:'completed',steps:[]});
    }});
    await provider.create({input:'Synthetic'},new AbortController().signal);
    assert.equal(calls,1);
    console.log(JSON.stringify({ok:true,calls}));
  `;
  const result = await promisify(execFile)(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", script], {
    env: {
      NODE_ENV: "test",
      GOOGLE_API_KEY: "ignored-synthetic-google-key",
      GEMINI_API_KEY: "ignored-synthetic-gemini-key",
      GOOGLE_GENAI_USE_VERTEXAI: "true",
      GOOGLE_GENAI_USE_ENTERPRISE: "true",
      GOOGLE_CLOUD_PROJECT: "synthetic-project",
      GOOGLE_CLOUD_LOCATION: "synthetic-location",
      GOOGLE_GEMINI_BASE_URL: "https://synthetic-other-origin.invalid",
      GOOGLE_VERTEX_BASE_URL: "https://synthetic-other-origin.invalid",
    },
    timeout: 10_000,
  });
  assert.deepEqual(JSON.parse(result.stdout), { ok: true, calls: 1 });
});

test("Gemini preserves native thought signatures and function call IDs through stateless continuation", async () => {
  const steps: Interactions.Step[] = [
    { type: "thought", signature: "synthetic-opaque-signature", summary: [{ type: "text", text: "Synthetic summary" }] },
    { type: "function_call", id: "synthetic-call-123", name: tool.name!, arguments: {} },
  ];
  let responseIndex = 0;
  const fake = stub(() => Response.json(responseIndex++ === 0
    ? { id: "synthetic-tool-turn", status: "requires_action", steps }
    : completed()));
  const provider = createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher });
  const first = await provider.create(firstTurn, controller().signal);
  assert.equal(first.status, "requires_action");
  assert.deepEqual(first.steps, steps);
  const result: Interactions.FunctionResultStep = {
    type: "function_result",
    name: tool.name,
    call_id: "synthetic-call-123",
    result: [{ type: "text", text: '{"ranked":["the-guide"]}' }],
  };
  const history = [...firstTurn.input as Interactions.Step[], ...first.steps!, result];
  const format: Interactions.TextResponseFormat = {
    type: "text", mime_type: "application/json",
    schema: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
  };
  const final = await provider.create({
    input: history, tools: [tool], response_format: format,
    generation_config: { thinking_level: "low", tool_choice: "none", max_output_tokens: 4096 },
  }, controller().signal);
  assert.equal(fake.calls.length, 2);
  const secondBody = fake.bodies[1] as Record<string, unknown>;
  assert.deepEqual(secondBody.input, history);
  assert.deepEqual(secondBody.response_format, format);
  assert.deepEqual((secondBody.input as Interactions.Step[])[1], steps[0]);
  assert.deepEqual((secondBody.input as Interactions.Step[])[3], result);
  assert.equal(final.status, "completed");
  assert.equal(final.output_text, completed().steps[0].content[0].text);
});

test("Gemini does not automatically continue incomplete native interactions", async () => {
  const fake = stub(() => Response.json({ ...completed(), status: "incomplete", continuation_token: "synthetic-only" }));
  const result = await createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }).create(firstTurn, controller().signal);
  assert.equal(result.status, "incomplete");
  assert.equal(fake.calls.length, 1);
});

test("Gemini maps HTTP failures without retries, provider messages, credentials, or response headers", async () => {
  for (const [status, code] of [
    [401, "GEMINI_AUTH"], [403, "GEMINI_ACCESS"], [429, "GEMINI_QUOTA"],
    [503, "GEMINI_TRANSPORT"], [404, "GEMINI_MODEL_UNAVAILABLE"], [400, "GEMINI_REQUEST_REJECTED"],
  ] as const) {
    const fake = stub(() => Response.json({ error: { message: `${fixtureKey} synthetic-raw-provider-error` } }, {
      status, headers: { "Retry-After": "0", "X-Synthetic-Secret": fixtureKey },
    }));
    await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }).create(firstTurn, controller().signal), code, status);
    assert.equal(fake.calls.length, 1, `HTTP ${status} must make exactly one transport attempt`);
  }
});

test("Gemini blocks redirects without following their target", async () => {
  const fake = stub(() => new Response(null, { status: 302, headers: { Location: "https://synthetic-other-origin.invalid" } }));
  await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }).create(firstTurn, controller().signal), "GEMINI_BAD_RESPONSE", 302);
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].redirect, "manual");
});

test("Gemini rejects an endpoint override before transport and cannot override model or storage controls", async () => {
  const fake = stub(() => Response.json(completed()));
  const provider = createGeminiProvider({ apiKey: fixtureKey, model: "gemini-3.8-flash", fetcher: fake.fetcher });
  await expectFailure(provider.create({ ...firstTurn, api_version: "v1" } as GeminiTurn, controller().signal), "GEMINI_BAD_RESPONSE");
  assert.equal(fake.calls.length, 0);
  await provider.create({ ...firstTurn, model: "attacker-model", store: true, stream: true, background: true } as GeminiTurn, controller().signal);
  const body = fake.bodies[0] as Record<string, unknown>;
  assert.equal(body.model, "gemini-3.8-flash");
  assert.equal(body.store, false);
  assert.equal(body.stream, false);
  assert.equal(body.background, false);
});

test("Gemini sanitizes transport errors and makes no retry", async () => {
  const fake = stub(() => { throw new Error(`${fixtureKey} synthetic-raw-provider-error`); });
  await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }).create(firstTurn, controller().signal), "GEMINI_TRANSPORT");
  assert.equal(fake.calls.length, 1);
});

test("Gemini rejects requests exceeding 128 KiB by UTF-8 bytes before transport", async () => {
  const fake = stub(() => Response.json(completed()));
  await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }).create({ input: "₹".repeat(45_000) }, controller().signal), "GEMINI_BAD_RESPONSE");
  assert.equal(fake.calls.length, 0);
});

test("Gemini enforces the 256 KiB response limit for streamed bodies and declared lengths", async () => {
  for (const response of [
    () => new Response(new ReadableStream({ start(stream) { stream.enqueue(new Uint8Array(256 * 1024 + 1)); stream.close(); } }), {
      headers: { "Content-Type": "application/json" },
    }),
    () => new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": String(256 * 1024 + 1) } }),
  ]) {
    const fake = stub(response);
    await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }).create(firstTurn, controller().signal), "GEMINI_BAD_RESPONSE");
    assert.equal(fake.calls.length, 1);
  }
});

test("Gemini rejects malformed JSON, invalid UTF-8, missing native fields, and non-JSON responses", async () => {
  for (const response of [
    () => new Response(`{"error":"${fixtureKey}`, { headers: { "Content-Type": "application/json" } }),
    () => new Response(new Uint8Array([0xc3]), { headers: { "Content-Type": "application/json" } }),
    () => Response.json({ steps: [] }),
    () => Response.json({ ...completed(), steps: new Array(65).fill({ type: "thought" }) }),
    () => new Response(fixtureKey, { headers: { "Content-Type": "text/html" } }),
    () => new Response(new ReadableStream({ start(stream) { stream.error(new Error(`${fixtureKey} synthetic-raw-provider-error`)); } }), {
      headers: { "Content-Type": "application/json" },
    }),
  ]) {
    const fake = stub(response);
    await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher }).create(firstTurn, controller().signal), "GEMINI_BAD_RESPONSE");
    assert.equal(fake.calls.length, 1);
  }
});

test("Gemini's deadline bounds a transport that ignores cancellation", async () => {
  const fake = stub(() => new Promise<Response>(() => {}));
  const started = Date.now();
  await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher, timeoutMs: 100 }).create(firstTurn, controller().signal), "GEMINI_DEADLINE");
  assert(Date.now() - started < 2000, "The configured deadline must bound an uncooperative transport");
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].signal.aborted, true);
});

test("Gemini's deadline includes the complete body read after response headers", async () => {
  let cancelled = false;
  const fake = stub(() => new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
    headers: { "Content-Type": "application/json" },
  }));
  const started = Date.now();
  await expectFailure(createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher, timeoutMs: 100 }).create(firstTurn, controller().signal), "GEMINI_DEADLINE");
  assert(Date.now() - started < 2000, "The configured deadline must include the body read");
  assert.equal(fake.calls.length, 1);
  assert.equal(cancelled, true);
});

test("Gemini cancels before dispatch and during transport without forwarding the abort reason", async () => {
  const fake = stub(() => new Promise<Response>(() => {}));
  const provider = createGeminiProvider({ apiKey: fixtureKey, fetcher: fake.fetcher });
  const early = controller();
  early.abort(new Error(fixtureKey));
  await expectFailure(provider.create(firstTurn, early.signal), "GEMINI_CANCELLED");
  assert.equal(fake.calls.length, 0);

  let dispatched: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => { dispatched = resolve; });
  const waiting = stub(() => { dispatched!(); return new Promise<Response>(() => {}); });
  const active = controller();
  const pending = createGeminiProvider({ apiKey: fixtureKey, fetcher: waiting.fetcher }).create(firstTurn, active.signal);
  await ready;
  active.abort(new Error(`${fixtureKey} synthetic-raw-provider-error`));
  await expectFailure(pending, "GEMINI_CANCELLED");
  assert.equal(waiting.calls.length, 1);
  assert.equal(waiting.calls[0].signal.aborted, true);
});

test("Gemini rejects missing credentials and invalid model identifiers without transport", async () => {
  const fake = stub(() => Response.json(completed()));
  await expectFailure(createGeminiProvider({ apiKey: " ", fetcher: fake.fetcher }).create(firstTurn, controller().signal), "GEMINI_AUTH");
  await expectFailure(createGeminiProvider({ apiKey: fixtureKey, model: "https://synthetic-other-origin.invalid", fetcher: fake.fetcher }).create(firstTurn, controller().signal), "GEMINI_MODEL_UNAVAILABLE");
  assert.equal(fake.calls.length, 0);
});
