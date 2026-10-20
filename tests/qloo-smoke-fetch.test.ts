import assert from "node:assert/strict";
import test from "node:test";
import { createSingleSearchFetch } from "../scripts/qloo-smoke-fetch.mjs";

const search = "https://api.qloo.com/search?query=The+Guide&take=3&types=urn%3Aentity%3Abook";

test("Qloo guard permits the bounded official search once and preserves authentication options", async () => {
  const calls: unknown[][] = [];
  const guarded = createSingleSearchFetch(async (...args: unknown[]) => {
    calls.push(args);
    return new Response('{"results":[]}', { status: 200 });
  });
  const options = { method: "GET", headers: { "X-Api-Key": "synthetic-guard-fixture" } };
  assert.equal((await guarded(search, options)).status, 200);
  await assert.rejects(guarded(search, options), /blocked/);
  assert.deepEqual(calls, [[search, { ...options, redirect: "manual" }]]);
});

test("Qloo guard exposes a redirect without following it or allowing a subsequent request", async () => {
  let calls = 0;
  const guarded = createSingleSearchFetch(async (_input: string, options: RequestInit) => {
    calls += 1;
    assert.equal(options.redirect, "manual");
    return new Response(null, { status: 302, headers: { Location: "https://example.invalid/elsewhere" } });
  });
  assert.equal((await guarded(search, { method: "GET", redirect: "follow" })).status, 302);
  await assert.rejects(guarded(search, { method: "GET" }), /blocked/);
  assert.equal(calls, 1);
});

test("Qloo guard never retries a rejected transport", async () => {
  let calls = 0;
  const guarded = createSingleSearchFetch(async () => { calls += 1; throw new Error("synthetic network failure"); });
  await assert.rejects(guarded(search, { method: "GET" }), /synthetic network failure/);
  await assert.rejects(guarded(search, { method: "GET" }), /blocked/);
  assert.equal(calls, 1);
});

test("Qloo guard rejects changed hosts, queries, limits, methods and extra parameters before transport", async () => {
  let calls = 0;
  const guarded = createSingleSearchFetch(async () => { calls += 1; return new Response(); });
  for (const target of [
    search.replace("api.qloo.com", "example.invalid"),
    search.replace("take=3", "take=4"),
    search.replace("The+Guide", "Other"),
    search + "&take=3", search + "&other=1", search + "#fragment",
    search.replace("https://", "https://synthetic:fixture@"),
  ]) {
    await assert.rejects(guarded(target, { method: "GET" }), /blocked/);
  }
  await assert.rejects(guarded(search, { method: "POST" }), /blocked/);
  assert.equal(calls, 0);
});
