import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createGeminiProvider, GeminiProviderError } from "../lib/gemini-provider.ts";
import { geminiResponseIssue, inspectGeminiResponse, type GeminiResponseSnapshot } from "../lib/gemini-response.ts";

// Synthetic transport and content only: these checks never load environment keys
// and never contact either provider.
const key = "synthetic-response-inspection-key";
const model = "gemini-3.6-flash";
const toolResponse = () => ({
  id: "synthetic-interaction-id", status: "requires_action",
  steps: [
    { type: "thought", signature: "synthetic-private-signature", summary: [{ type: "text", text: "synthetic-private-thought" }] },
    { type: "function_call", id: "synthetic-call-id", name: "rank_eligible_books", arguments: {} },
  ],
});

test("response inspection accepts a tool-only requires_action response without final text", () => {
  const value = toolResponse();
  assert.equal(geminiResponseIssue(value), undefined);
  const snapshot = inspectGeminiResponse(value, model, 200, "wire");
  assert.equal(snapshot.interactionStatus, "requires_action");
  assert.equal(snapshot.finalText.type, "undefined");
  assert.equal(snapshot.rejection, undefined);
  assert.deepEqual(snapshot.steps[1], {
    type: "function_call", functionName: "rank_eligible_books", callIdPresent: true,
    callId: { type: "string", length: "synthetic-call-id".length }, argumentsType: "object",
    argumentKeys: [], signaturePresent: false,
  });
});

test("response inspection directly reads a non-enumerable final-text getter", () => {
  const value = { id: "synthetic", status: "completed", steps: [
    { type: "model_output", content: [{ type: "text", text: "synthetic-private-output" }] },
  ] };
  Object.defineProperty(value, "output_text", { get: () => "synthetic-private-output", enumerable: false });
  assert(!Object.keys(value).includes("output_text"));
  assert(!JSON.stringify(value).includes('"output_text"'));
  const snapshot = inspectGeminiResponse(value, model, 200, "sdk");
  assert.deepEqual(snapshot.finalText, { type: "string", length: "synthetic-private-output".length });
  assert.deepEqual(snapshot.steps[0].textParts, [{ type: "string", length: "synthetic-private-output".length }]);
  assert(!JSON.stringify(snapshot).includes("synthetic-private-output"));
});

test("response inspection preserves precise structural rejection paths and types", () => {
  for (const [value, path, observed] of [
    [null, "$", "null"],
    [{ id: null, status: "completed", steps: [] }, "$.id", "null"],
    [{ steps: [] }, "$.status", "undefined"],
    [{ id: "synthetic", status: 1, steps: [] }, "$.status", "number"],
    [{ id: "synthetic", status: "completed", steps: {} }, "$.steps", "object"],
    [{ id: "synthetic", status: "completed", steps: [null] }, "$.steps[0]", "null"],
    [{ id: "synthetic", status: "completed", steps: [{ type: [] }] }, "$.steps[0].type", "array"],
  ] as const) {
    const snapshot = inspectGeminiResponse(value, model, 200, "wire");
    assert.equal(snapshot.rejection?.path, path);
    assert.equal(snapshot.rejection?.observed, observed);
    assert.equal(typeof snapshot.rejection?.expected, "string");
  }
});

test("response snapshots omit secret, prompt, header, thought, signature, ID, and argument values", () => {
  const value = {
    ...toolResponse(),
    [key]: "untrusted-property-value",
    headers: { "x-goog-api-key": key },
    prompt: "synthetic-private-prompt",
    output_text: "synthetic-private-final-text",
  };
  value.steps.push({ type: "function_call", id: "synthetic-second-call-id", name: key,
    arguments: { [key]: key, acceptable_name: "synthetic-private-argument" } });
  const snapshot = inspectGeminiResponse(value, model, 200, "wire", [key]);
  assert(snapshot.topLevelKeys.includes("[redacted name]"));
  const serialized = JSON.stringify(snapshot);
  for (const privateValue of [key, "synthetic-private-prompt", "synthetic-private-final-text", "synthetic-private-thought",
    "synthetic-private-signature", "synthetic-interaction-id", "synthetic-call-id", "synthetic-second-call-id",
    "synthetic-private-argument", "untrusted-property-value", "x-goog-api-key"]) {
    assert(!serialized.includes(privateValue), `Snapshot must omit ${privateValue}`);
  }
  assert.equal(snapshot.steps[2].functionName, "[redacted name]");
  assert.deepEqual(snapshot.steps[2].argumentKeys, ["[redacted name]", "acceptable_name"]);
});

test("response snapshot lists are bounded even before an oversized native response is rejected", () => {
  const value = { id: "synthetic", status: "completed", steps: Array.from({ length: 65 }, () => ({
    type: "model_output", content: Array.from({ length: 30 }, () => ({ type: "text", text: "synthetic" })),
  })), ...Object.fromEntries(Array.from({ length: 60 }, (_, index) => [`field_${index}`, "synthetic"])) };
  const snapshot = inspectGeminiResponse(value, model, 200, "wire");
  assert.equal(snapshot.topLevelKeys.length, 32);
  assert.equal(snapshot.stepCount, 65);
  assert.equal(snapshot.steps.length, 64);
  assert.equal(snapshot.steps[0].textParts?.length, 16);
  assert.deepEqual(snapshot.rejection, { path: "$.steps.length", expected: "at most 64", observed: "65" });
});

test("the real SDK provider observes bounded wire and SDK structures while retaining originals only in memory", async () => {
  const observed: { snapshot: GeminiResponseSnapshot; original: unknown }[] = [];
  let requests = 0;
  const provider = createGeminiProvider({ apiKey: key, model,
    fetcher: async () => { requests++; return Response.json(toolResponse()); },
    onResponse: (snapshot, original) => observed.push({ snapshot, original }),
  });
  const result = await provider.create({ input: "synthetic-private-prompt" }, new AbortController().signal);
  assert.equal(requests, 1);
  assert.deepEqual(observed.map(({ snapshot }) => snapshot.phase), ["wire", "sdk"]);
  assert.equal(observed[1].original, result);
  assert.deepEqual(observed[0].original, toolResponse());
  assert.equal(result.status, "requires_action");
  assert.deepEqual(result.steps, toolResponse().steps);
  assert(!JSON.stringify(observed.map(({ snapshot }) => snapshot)).includes("synthetic-private-signature"));
  assert(!JSON.stringify(observed.map(({ snapshot }) => snapshot)).includes("synthetic-private-thought"));
});

test("observer exceptions cannot turn an accepted tool response into failure or bypass wire rejection", async () => {
  for (const [response, accepted] of [[toolResponse(), true], [{ steps: [] }, false]] as const) {
    let observations = 0;
    let requests = 0;
    const provider = createGeminiProvider({ apiKey: key, model,
      fetcher: async () => { requests++; return Response.json(response); },
      onResponse: () => { observations++; throw new Error("synthetic-private-observer-failure"); },
    });
    const operation = provider.create({ input: "synthetic-private-prompt" }, new AbortController().signal);
    if (accepted) assert.equal((await operation).status, "requires_action");
    else await assert.rejects(operation, (error: unknown) => error instanceof GeminiProviderError && error.code === "GEMINI_BAD_RESPONSE");
    assert.equal(requests, 1);
    assert.equal(observations, accepted ? 2 : 1);
  }
});

test("the captured stateless tool shape replays through the pinned SDK without requiring an interaction resource ID or final text", async () => {
  // Derived from the controlled HTTP 200 capture: no resource ID, requires_action,
  // a signed thought and a signed direct function_call with empty object arguments.
  // Private values are replaced by explicit synthetic markers; usage, timestamps
  // and other nonessential response metadata are omitted. This is not a proposal
  // success fixture, and the continuation below never executes a tool.
  const fixture = JSON.parse(readFileSync(new URL("./fixtures/gemini-stateless-tool.json", import.meta.url), "utf8"));
  const bodies: Record<string, unknown>[] = [];
  const provider = createGeminiProvider({ apiKey: key, model, fetcher: async (input, init) => {
    const request = new Request(input, init);
    bodies.push(JSON.parse(await request.text()));
    if (bodies.length === 1) return Response.json(fixture);
    // Stop the synthetic continuation after recording its serialized history.
    return Response.json({ error: { code: "invalid_request", message: "Synthetic offline continuation stop." } }, { status: 400 });
  } });
  const result = await provider.create({ input: "Synthetic tool-only probe." }, new AbortController().signal);
  assert.equal(geminiResponseIssue(fixture), undefined);
  assert.equal(Object.hasOwn(fixture, "id"), false);
  assert.equal(result.status, "requires_action");
  assert.equal(result.output_text, undefined);
  assert.deepEqual(result.steps, fixture.steps);
  const call = result.steps?.find(step => step.type === "function_call");
  assert(call?.type === "function_call");
  assert.equal(call.name, "rank_eligible_books");
  assert.equal(typeof call.id, "string");
  assert.deepEqual(call.arguments, {});
  const history = [
    ...result.steps!,
    { type: "function_result" as const, name: call.name, call_id: call.id!,
      result: [{ type: "text" as const, text: "Synthetic tool result." }] },
  ];
  await assert.rejects(provider.create({ input: history }, new AbortController().signal),
    (error: unknown) => error instanceof GeminiProviderError && error.code === "GEMINI_REQUEST_REJECTED");
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[1].input, history);
  assert.deepEqual((bodies[1].input as unknown[]).slice(0, 2), fixture.steps);
  assert.equal((bodies[1].input as { call_id?: string }[])[2].call_id, fixture.steps[1].id);
});

test("optional interaction resource IDs remain validated when supplied", () => {
  for (const id of [null, 123, {}, [], "", "x".repeat(513)]) {
    assert(geminiResponseIssue({ ...toolResponse(), id }));
  }
  const { id: omittedId, ...withoutResourceId } = toolResponse();
  assert.equal(typeof omittedId, "string");
  assert.equal(geminiResponseIssue(withoutResourceId), undefined);
});
