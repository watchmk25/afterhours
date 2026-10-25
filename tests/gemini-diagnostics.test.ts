import assert from "node:assert/strict";
import test from "node:test";
import { summarizeGeminiError, type GeminiDiagnostic } from "../lib/gemini-diagnostics.ts";
import { createGeminiProvider, GeminiProviderError } from "../lib/gemini-provider.ts";
import type { GeminiTurn } from "../lib/gemini-provider.ts";

// Entirely synthetic credentials, provider errors, and fetch transports. These
// tests neither read local configuration nor perform network requests.
const fixtureKey = "synthetic-configured-gemini-secret";
const prompt = "Plan a synthetic private organizer event with hidden preferences.";
const instruction = "Synthetic private system instruction which must never be logged.";
const firstTurn: GeminiTurn = {
  input: [{ type: "user_input", content: [{ type: "text", text: prompt }] }],
  system_instruction: instruction,
};

function rejectedProvider(response: () => Response, turn = firstTurn) {
  const diagnostics: GeminiDiagnostic[] = [];
  let calls = 0;
  const provider = createGeminiProvider({
    apiKey: fixtureKey,
    fetcher: async () => { calls++; return response(); },
    onDiagnostic: (diagnostic) => { diagnostics.push(diagnostic); },
  });
  return {
    diagnostics,
    calls: () => calls,
    result: provider.create(turn, new AbortController().signal),
  };
}

test("Gemini diagnostic preserves observed Interactions code/message without inventing Google RPC details", () => {
  const diagnostic = summarizeGeminiError({ error: {
    code: "invalid_argument", message: "Invalid field 'generation_config.tool_choice.allowed_tools': mode is unsupported.",
  } }, 400, [fixtureKey]);
  assert.equal(diagnostic.stage, "http_response");
  assert.equal(diagnostic.httpStatus, 400);
  assert.equal(diagnostic.providerCode, "invalid_argument");
  assert.equal(diagnostic.providerStatus, undefined);
  assert.match(diagnostic.explanation, /mode is unsupported/);
  assert.deepEqual(diagnostic.parameterPaths, ["generation_config.tool_choice.allowed_tools"]);
  assert.deepEqual(diagnostic.reasons, []);
});

test("Gemini diagnostic includes numeric Google RPC status and supplied field violations/reasons only", () => {
  const diagnostic = summarizeGeminiError({ error: {
    code: 400, status: "INVALID_ARGUMENT", message: "The request has invalid fields.",
    details: [
      { "@type": "type.googleapis.com/google.rpc.BadRequest", fieldViolations: [
        { field: "tools[0].parameters", description: "Malformed schema." },
      ] },
      { "@type": "type.googleapis.com/google.rpc.ErrorInfo", reason: "INVALID_FIELD_VALUE", metadata: {
        reason: "DO_NOT_PROMOTE_METADATA", field: "do.not.promote.metadata",
      } },
    ],
  } }, 400, []);
  assert.equal(diagnostic.providerCode, 400);
  assert.equal(diagnostic.providerStatus, "INVALID_ARGUMENT");
  assert.deepEqual(diagnostic.parameterPaths, ["tools[0].parameters"]);
  assert.deepEqual(diagnostic.reasons, ["INVALID_FIELD_VALUE"]);
});

test("Gemini diagnostic redacts configured/nested credentials, headers, bearer values, URLs, and opaque tokens", () => {
  const nestedKey = "nested-fake-key-credential";
  const nestedToken = "nested-fake-token-credential";
  const opaqueToken = "SYNTHETIC_OPAQUE_RANDOM_VALUE_1234567890";
  const url = "https://provider.invalid/endpoint?key=synthetic-url-key";
  const diagnostic = summarizeGeminiError({ error: {
    code: "invalid_argument",
    message: `Invalid request ${fixtureKey}; ${nestedKey}; ${nestedToken}; Bearer synthetic-bearer-secret; x-goog-api-key: synthetic-header-secret; ${url}; ${opaqueToken}.`,
    details: [{ metadata: { apiKey: nestedKey, headers: { authorization: nestedToken } } }],
  } }, 400, [fixtureKey]);
  const rendered = JSON.stringify(diagnostic);
  assert.match(diagnostic.explanation, /Invalid request/);
  for (const secret of [fixtureKey, nestedKey, nestedToken, opaqueToken, url, "synthetic-url-key", "synthetic-bearer-secret", "synthetic-header-secret"]) {
    assert(!rendered.includes(secret), "Sanitized diagnostics must omit every synthetic credential form");
  }
  assert(!rendered.includes("metadata"));
  assert(!rendered.includes("authorization"));
});

test("Gemini diagnostic removes known prompt/system strings and quoted arbitrary provider echoes", () => {
  const diagnostic = summarizeGeminiError({ error: {
    code: "invalid_argument",
    message: `Invalid field 'tools[0].parameters'. Received ${prompt} ${instruction} and \"unrecognized private organizer content\".`,
    details: [{ prompt, system_instruction: instruction }],
  } }, 400, [fixtureKey, prompt, instruction]);
  const rendered = JSON.stringify(diagnostic);
  assert(!rendered.includes(prompt));
  assert(!rendered.includes(instruction));
  assert(!rendered.includes("unrecognized private organizer content"));
  assert.deepEqual(diagnostic.parameterPaths, ["tools[0].parameters"]);
});

test("Gemini diagnostic bounds explanations and details and ignores unsupported error envelopes", () => {
  const diagnostic = summarizeGeminiError({ error: {
    code: "invalid_argument", status: "INVALID_ARGUMENT", message: `Invalid request. ${"x ".repeat(10_000)}`,
    details: Array.from({ length: 40 }, (_, index) => ({ field: `tools[${index}].parameters`, reason: `REASON_${index}` })),
  } }, 400, []);
  assert(diagnostic.explanation.length <= 600);
  assert(diagnostic.parameterPaths.length <= 8);
  assert(diagnostic.reasons.length <= 8);
  for (const payload of [undefined, null, "raw-private-provider-error", { message: fixtureKey }, { error: { code: { token: fixtureKey }, status: [fixtureKey] } }]) {
    const absent = summarizeGeminiError(payload, 400, [fixtureKey]);
    assert.equal(absent.providerCode, undefined);
    assert.equal(absent.providerStatus, undefined);
    assert.equal(absent.explanation, "No bounded JSON provider explanation was available.");
    assert.deepEqual(absent.parameterPaths, []);
    assert.deepEqual(absent.reasons, []);
    assert(!JSON.stringify(absent).includes(fixtureKey));
  }
});

test("Gemini diagnostic redacts before the explanation boundary and retains the observed native rejection reason", () => {
  const boundarySecret = "boundary-fake-private-credential";
  const diagnostic = summarizeGeminiError({ error: {
    code: "invalid_request",
    message: `allowed_tools mode must be either ANY or VALIDATED. ${"x ".repeat(270)}${boundarySecret} after boundary.`,
  } }, 400, [boundarySecret]);
  assert.equal(diagnostic.providerCode, "invalid_request");
  assert.equal(diagnostic.providerStatus, undefined);
  assert.match(diagnostic.explanation, /^allowed_tools mode must be either ANY or VALIDATED/);
  assert(diagnostic.explanation.length <= 600);
  assert(!diagnostic.explanation.includes("boundary-fake"));
  assert(!diagnostic.explanation.includes(boundarySecret));
  assert.deepEqual(diagnostic.parameterPaths, []);
  assert.deepEqual(diagnostic.reasons, []);
});

test("Gemini diagnostic removes values nested inside credential and header containers", () => {
  const headerValue = "short-private-cookie";
  const nestedValue = "short-private-secret";
  const diagnostic = summarizeGeminiError({ error: {
    code: "invalid_request",
    message: `Invalid request ${headerValue} ${nestedValue}.`,
    details: [{ metadata: {
      headers: { Cookie: headerValue },
      credentials: { value: nestedValue },
    } }],
  } }, 400, []);
  assert.match(diagnostic.explanation, /Invalid request/);
  assert(!JSON.stringify(diagnostic).includes(headerValue));
  assert(!JSON.stringify(diagnostic).includes(nestedValue));
});

test("Gemini actual pinned SDK calls server-only diagnostic once while public error remains fixed", async () => {
  const fake = rejectedProvider(() => Response.json({ error: {
    code: "invalid_argument", status: "INVALID_ARGUMENT",
    message: `Unsupported setting at 'tools[0].parameters'; ${fixtureKey}; ${prompt}; ${instruction}`,
  } }, { status: 400 }));
  await assert.rejects(fake.result, (error: unknown) => {
    assert(error instanceof GeminiProviderError);
    assert.equal(error.code, "GEMINI_REQUEST_REJECTED");
    assert.equal(error.upstreamStatus, 400);
    assert.equal(error.message, "Gemini rejected this request. Check the API key's access, model configuration, and supported request settings before trying again.");
    assert.equal(error.cause, undefined);
    for (const rendering of [String(error), JSON.stringify(error), error.stack ?? ""]) {
      assert(!rendering.includes(fixtureKey));
      assert(!rendering.includes(prompt));
      assert(!rendering.includes(instruction));
      assert(!rendering.includes("Unsupported setting"));
      assert(!rendering.includes("invalid_argument"));
    }
    assert(!("diagnostics" in error));
    return true;
  });
  assert.equal(fake.calls(), 1);
  assert.equal(fake.diagnostics.length, 1);
  const diagnostic = fake.diagnostics[0];
  assert.equal(diagnostic.httpStatus, 400);
  assert.equal(diagnostic.providerCode, "invalid_argument");
  assert.equal(diagnostic.providerStatus, "INVALID_ARGUMENT");
  assert.deepEqual(diagnostic.parameterPaths, ["tools[0].parameters"]);
  for (const privateValue of [fixtureKey, prompt, instruction]) assert(!JSON.stringify(diagnostic).includes(privateValue));
});

test("Gemini actual SDK diagnostic removes supported string input prompts", async () => {
  const fake = rejectedProvider(() => Response.json({ error: {
    code: "invalid_argument", message: `Unsupported request. ${prompt}`,
  } }, { status: 400 }), { input: prompt });
  await assert.rejects(fake.result, { code: "GEMINI_REQUEST_REJECTED", upstreamStatus: 400 });
  assert.equal(fake.calls(), 1);
  assert.equal(fake.diagnostics.length, 1);
  assert(!JSON.stringify(fake.diagnostics).includes(prompt));
  assert.match(fake.diagnostics[0].explanation, /Unsupported request/);
});

test("Gemini actual SDK diagnostic removes an organizerRequest echoed from a structured private text step", async () => {
  const structuredTurn: GeminiTurn = {
    input: [{ type: "user_input", content: [{ type: "text", text: JSON.stringify({
      organizerRequest: prompt, duration: 45, authoritativeFilters: { maxPrice: "450" },
    }) }] }],
    system_instruction: instruction,
  };
  const fake = rejectedProvider(() => Response.json({ error: {
    code: "invalid_request", message: `Invalid organizer request. ${prompt}`,
  } }, { status: 400 }), structuredTurn);
  await assert.rejects(fake.result, { code: "GEMINI_REQUEST_REJECTED", upstreamStatus: 400 });
  assert.equal(fake.calls(), 1);
  assert.equal(fake.diagnostics.length, 1);
  assert(!JSON.stringify(fake.diagnostics).includes(prompt));
  assert.match(fake.diagnostics[0].explanation, /Invalid organizer request/);
});

test("Gemini rejection diagnostic cannot turn malformed, oversized, invalid UTF-8, or non-JSON errors into raw output", async () => {
  const cases = [
    () => new Response(`{\"error\":\"${fixtureKey}`, { status: 400, headers: { "Content-Type": "application/json" } }),
    () => new Response(new Uint8Array([0xc3]), { status: 400, headers: { "Content-Type": "application/json" } }),
    () => Response.json({ error: { message: `${fixtureKey} ${"x".repeat(16 * 1024)}` } }, { status: 400 }),
    () => new Response(fixtureKey, { status: 400, headers: { "Content-Type": "text/html" } }),
  ];
  for (const response of cases) {
    const fake = rejectedProvider(response);
    await assert.rejects(fake.result, { code: "GEMINI_REQUEST_REJECTED", upstreamStatus: 400 });
    assert.equal(fake.calls(), 1);
    assert.equal(fake.diagnostics.length, 1);
    assert.equal(fake.diagnostics[0].httpStatus, 400);
    assert.equal(fake.diagnostics[0].explanation, "No bounded JSON provider explanation was available.");
    assert(!JSON.stringify(fake.diagnostics).includes(fixtureKey));
  }
});

test("Gemini sanitizes error streams under the existing bounded deadline and never retries", async () => {
  let calls = 0;
  let cancelled = false;
  const diagnostics: GeminiDiagnostic[] = [];
  const provider = createGeminiProvider({
    apiKey: fixtureKey, timeoutMs: 30,
    fetcher: async () => {
      calls++;
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
        status: 400, headers: { "Content-Type": "application/json" },
      });
    },
    onDiagnostic: (value) => { diagnostics.push(value); },
  });
  await assert.rejects(provider.create(firstTurn, new AbortController().signal), { code: "GEMINI_DEADLINE" });
  assert.equal(calls, 1);
  assert.equal(cancelled, true);
  assert.deepEqual(diagnostics, []);
});

test("Gemini diagnostic callback failure cannot replace fixed public error or trigger retries", async () => {
  let calls = 0;
  const provider = createGeminiProvider({
    apiKey: fixtureKey,
    fetcher: async () => { calls++; return Response.json({ error: { code: "invalid_argument", message: "Unsupported request." } }, { status: 400 }); },
    onDiagnostic: () => { throw new Error(fixtureKey); },
  });
  await assert.rejects(provider.create(firstTurn, new AbortController().signal), (error: unknown) => {
    assert(error instanceof GeminiProviderError);
    assert.equal(error.code, "GEMINI_REQUEST_REJECTED");
    assert(!String(error).includes(fixtureKey));
    assert.equal(error.cause, undefined);
    return true;
  });
  assert.equal(calls, 1);
});

test("Gemini missing credentials emits no diagnostic and causes zero requests", async () => {
  let calls = 0;
  const diagnostics: GeminiDiagnostic[] = [];
  const provider = createGeminiProvider({
    apiKey: "  ",
    fetcher: async () => { calls++; throw new Error("No transport may be called."); },
    onDiagnostic: (value) => { diagnostics.push(value); },
  });
  await assert.rejects(provider.create(firstTurn, new AbortController().signal), { code: "GEMINI_AUTH" });
  assert.equal(calls, 0);
  assert.deepEqual(diagnostics, []);
});
