import assert from "node:assert/strict";
import test from "node:test";
import { createPlanFetch, sanitizePayload } from "../scripts/qloo-feasibility-fetch.mjs";

const origin = "https://hackathon.api.qloo.com";
const bookA = "00000000-0000-0000-0000-000000000001";
const bookB = "00000000-0000-0000-0000-000000000002";
const film = "00000000-0000-0000-0000-000000000003";
const artist = "00000000-0000-0000-0000-000000000004";
const plan = { path: "/search", params: { query: "The Guide", types: "urn:entity:book", take: 3 } };
const search = `${origin}/search?${new URLSearchParams(Object.entries(plan.params).map(([key, value]) => [key, String(value)]))}`;

test("feasibility guard counts one dispatch and captures a cloned response without consuming the harness body", async () => {
  const events: unknown[] = [];
  const body = { results: [{ name: "Synthetic book" }], query: { explainability: { warning: "synthetic warning" } } };
  const guarded = createPlanFetch(async (_input: string, options: RequestInit) => {
    events.push(options);
    return Response.json(body);
  }, plan, () => events.push("dispatch"), (event: unknown) => events.push(event));
  const options = { method: "GET", headers: { "X-Api-Key": "synthetic-fixture" }, redirect: "follow" as const };
  const response = await guarded(search, options);
  assert.deepEqual(await response.json(), body);
  assert.deepEqual(events, ["dispatch", { ...options, redirect: "manual" }, { httpStatus: 200, body }]);
  await assert.rejects(guarded(search, options), /blocked/);
  assert.equal(events.length, 3);
});

test("feasibility guard accepts explicit UUID book ranking and exact scalar serialization", async () => {
  const ranking = { path: "/v2/insights", params: {
    "filter.type": "urn:entity:book", "filter.results.entities": `${bookA},${bookB}`,
    "signal.interests.entities": `${film},${artist}`, take: 2, "feature.explainability": true, sort_by: "affinity",
  } };
  const target = `${origin}${ranking.path}?${new URLSearchParams(Object.entries(ranking.params).map(([key, value]) => [key, String(value)]))}`;
  let dispatches = 0;
  const guarded = createPlanFetch(async () => Response.json({ results: { entities: [] } }), ranking,
    () => { dispatches += 1; }, () => {});
  assert.equal((await guarded(target, { method: "GET" })).status, 200);
  assert.equal(dispatches, 1);
});

test("feasibility guard blocks changed hosts, paths, methods, extra and duplicate query keys before dispatch", async () => {
  let dispatches = 0;
  const guarded = createPlanFetch(async () => { throw new Error("transport must not run"); }, plan,
    () => { dispatches += 1; }, () => {});
  for (const target of [
    search.replace("hackathon.api.qloo.com", "api.qloo.com"), search.replace("https:", "http:"),
    search.replace("/search?", "/entities?"), search.replace("take=3", "take=2"),
    search + "&take=3", search + "&extra=1", search + "#fragment",
    search.replace("https://", "https://synthetic:fixture@"), "invalid target",
  ]) await assert.rejects(guarded(target, { method: "GET" }), /blocked/);
  await assert.rejects(guarded(search, { method: "POST" }), /blocked/);
  assert.equal(dispatches, 0);
});

test("feasibility guard never retries transport errors or leaks their messages", async () => {
  let dispatches = 0;
  const guarded = createPlanFetch(async () => { throw new Error("RAW_SYNTHETIC_SECRET"); }, plan,
    () => { dispatches += 1; }, () => {});
  await assert.rejects(guarded(search, { method: "GET" }), (error: Error) => {
    assert.match(error.message, /transport failed/);
    assert(!error.message.includes("RAW_SYNTHETIC_SECRET"));
    return true;
  });
  await assert.rejects(guarded(search, { method: "GET" }), /blocked/);
  assert.equal(dispatches, 1);
});

test("feasibility guard captures a redirect status without following it", async () => {
  const events: unknown[] = [];
  const guarded = createPlanFetch(async (_input: string, init: RequestInit) => {
    assert.equal(init.redirect, "manual");
    return Response.json({ synthetic: "redirect" }, { status: 302, headers: { Location: "https://example.invalid" } });
  }, plan, () => {}, (event: unknown) => events.push(event));
  assert.equal((await guarded(search, { method: "GET" })).status, 302);
  assert.deepEqual(events, [{ httpStatus: 302, body: { synthetic: "redirect" } }]);
  await assert.rejects(guarded(search, { method: "GET" }), /blocked/);
});

for (const [name, body] of [
  ["invalid JSON", "RAW_SYNTHETIC_SECRET"],
  ["oversized JSON", JSON.stringify("x".repeat(1024 * 1024))],
  ["oversized UTF-8", JSON.stringify("\u20b9".repeat(400_000))],
] as const) {
  test(`feasibility guard withholds ${name} while preserving only observed HTTP status`, async () => {
    const events: unknown[] = [];
    const guarded = createPlanFetch(async () => new Response(body), plan, () => {}, (event: unknown) => events.push(event));
    await assert.rejects(guarded(search, { method: "GET" }), (error: Error) => {
      assert.match(error.message, /oversized, unreadable, or invalid JSON/);
      assert(!error.message.includes("RAW_SYNTHETIC_SECRET"));
      return true;
    });
    assert.deepEqual(events, [{ httpStatus: 200, body: null }]);
    await assert.rejects(guarded(search, { method: "GET" }), /blocked/);
  });
}

test("feasibility guard accepts JSON exactly at the 1 MiB byte boundary", async () => {
  const body = JSON.stringify("x".repeat(1024 * 1024 - 2));
  let captured: unknown;
  const guarded = createPlanFetch(async () => new Response(body), plan, () => {}, (event: unknown) => { captured = event; });
  await guarded(search, { method: "GET" });
  assert.equal((captured as { body: string }).body.length, 1024 * 1024 - 2);
});

test("feasibility plan validation rejects unbounded searches and unsupported ranking plans offline", () => {
  for (const invalid of [
    null, { path: "/entities", params: {} }, { path: "/search", params: { ...plan.params, take: 4 } },
    { path: "/search", params: { ...plan.params, query: "" } },
    { path: "/search", params: { ...plan.params, query: "line\nbreak" } },
    { path: "/search", params: { ...plan.params, extra: "disallowed" } },
    { path: "/search", params: { ...plan.params, take: Infinity } },
    { path: "/v2/insights", params: { "filter.type": "urn:entity:movie", "filter.results.entities": bookA, "signal.interests.entities": film, take: 1 } },
    { path: "/v2/insights", params: { "filter.type": "urn:entity:book", "filter.results.entities": "not-a-uuid", "signal.interests.entities": film, take: 1 } },
    { path: "/v2/insights", params: { "filter.type": "urn:entity:book", "filter.results.entities": bookA, "signal.interests.entities": film, take: 2 } },
  ]) assert.throws(() => createPlanFetch(() => {}, invalid, () => {}, () => {}), /plan is invalid/);
});

test("feasibility sanitization removes credential occurrences in keys and nested values plus secret fields", () => {
  const credential = 'synthetic-opaque-"\\fixture';
  const value = {
    [credential]: `before ${credential} after`, Authorization: "never display", "api_key": "never display",
    nested: [{ note: `${credential} twice ${credential}`, accessToken: "never display" }],
    safe: { entity_id: bookA, score: 0.5, warning: "Synthetic warning", nil: null },
    terminal: "\u001b[31msafe\u001b[0m",
  };
  const sanitized = sanitizePayload(value, credential);
  assert.deepEqual(sanitized.safe, value.safe);
  assert.equal(sanitized.terminal, "safe");
  const serialized = JSON.stringify(sanitized);
  assert(!serialized.includes(credential));
  assert(!serialized.includes("never display"));
  assert.equal(sanitized["[redacted]"], "before [redacted] after");
  assert.equal(sanitized.nested[0].note, "[redacted] twice [redacted]");
  assert.equal(sanitized.nested[0].accessToken, "[redacted]");
});

test("feasibility sanitization handles missing credentials, cycles, and deeply nested payloads", () => {
  assert.deepEqual(sanitizePayload({ title: "Synthetic book" }, undefined), { title: "Synthetic book" });
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  assert.deepEqual(sanitizePayload(cyclic, "fixture"), { self: "[circular]" });
  let deep: unknown = "leaf";
  for (let index = 0; index < 50; index += 1) deep = { child: deep };
  assert(JSON.stringify(sanitizePayload(deep, "fixture")).includes("[detail omitted]"));
});
