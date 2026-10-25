import assert from "node:assert/strict";
import test from "node:test";
import { createGeminiPacing, GEMINI_PACING_LIMIT, GEMINI_PACING_WINDOW_MS, GEMINI_PACING_LUA } from "../lib/gemini-pacing.ts";
import type { UsageStore } from "../lib/usage-control.ts";
import { LuaUsageBackend } from "./helpers/usage-lua-store.ts";

test("actual pacing Lua admits at most twelve simultaneous calls across separate instances", async () => {
  const backend = await LuaUsageBackend.create();
  try {
    const services = Array.from({ length: 3 }, () => createGeminiPacing({ store: backend.client() }));
    const results = await Promise.all(Array.from({ length: 30 }, (_, index) => services[index % services.length].admit()));
    assert.equal(GEMINI_PACING_LIMIT, 12);
    assert.equal(GEMINI_PACING_WINDOW_MS, 60_000);
    assert.equal(results.filter((result) => result.ok).length, 12);
    for (const result of results.filter((result) => !result.ok)) {
      assert(!result.ok);
      assert.equal(result.error.status, 429);
      assert.equal(result.error.code, "GEMINI_PACING_LIMIT");
      assert.equal(result.error.retryAfterSeconds, 60);
      assert(result.error.message.includes("60 seconds"));
    }
    const record = backend.records.get("afterhours:usage:v1:gemini-rpm");
    assert(record && record.kind === "zset");
    assert.equal(record.expires, backend.now + 60_000);
    assert.equal(record.values.size, 12);
    for (const [id, timestamp] of record.values) {
      assert.match(id, /^[a-f0-9-]{36}$/);
      assert.equal(timestamp, backend.now);
    }
    assert.equal(backend.records.size, 1);
  } finally { await backend.close(); }
});

test("pacing spans UTC minute and day boundaries and expires exactly at the rolling boundary", async () => {
  for (const start of [Date.UTC(2026, 9, 21, 12, 0, 59, 900), Date.UTC(2026, 9, 21, 23, 59, 59, 900)]) {
    const backend = await LuaUsageBackend.create();
    try {
      backend.now = start;
      const pacing = createGeminiPacing({ store: backend.client() });
      for (let index = 0; index < 12; index++) assert((await pacing.admit()).ok);
      backend.now += 200;
      let denied = await pacing.admit();
      assert(!denied.ok);
      assert.equal(denied.error.retryAfterSeconds, 60, "a clock-minute boundary cannot grant another burst");
      backend.now = start + 59_999;
      denied = await pacing.admit();
      assert(!denied.ok);
      assert.equal(denied.error.retryAfterSeconds, 1);
      assert.equal(backend.records.get("afterhours:usage:v1:gemini-rpm")?.expires, start + 60_000, "denials do not extend retention");
      backend.now++;
      assert((await pacing.admit()).ok);
      assert.equal(backend.records.get("afterhours:usage:v1:gemini-rpm")?.values.size, 1);
    } finally { await backend.close(); }
  }
});

test("rolling pacing removes only old reservations instead of resetting the complete counter", async () => {
  const backend = await LuaUsageBackend.create();
  try {
    const start = backend.now;
    const first = createGeminiPacing({ store: backend.client() });
    const second = createGeminiPacing({ store: backend.client() });
    for (let index = 0; index < 6; index++) assert((await first.admit()).ok);
    backend.now += 30_000;
    for (let index = 0; index < 6; index++) assert((await second.admit()).ok);
    backend.now = start + 60_000;
    for (let index = 0; index < 6; index++) assert((await first.admit()).ok);
    const denied = await second.admit();
    assert(!denied.ok);
    assert.equal(denied.error.retryAfterSeconds, 30);
    assert.equal(backend.records.get("afterhours:usage:v1:gemini-rpm")?.values.size, 12);
    assert.equal(backend.records.get("afterhours:usage:v1:gemini-rpm")?.expires, backend.now + 60_000);
  } finally { await backend.close(); }
});

test("pacing fails closed on malformed acknowledgments and store errors without exposing details", async () => {
  for (const response of [undefined, null, {}, [1, "extra"], [0, 0], [0, 61], [0, 1.5], [0, "60"], [2]]) {
    let calls = 0;
    const pacing = createGeminiPacing({ store: { evaluate: async (script, keys, args) => {
      calls++;
      assert.equal(script, GEMINI_PACING_LUA);
      assert.deepEqual(keys, ["afterhours:usage:v1:gemini-rpm"]);
      assert.equal(args.length, 1);
      return response;
    } } });
    const result = await pacing.admit();
    assert(!result.ok);
    assert.equal(result.error.code, "USAGE_UNAVAILABLE");
    assert.equal(result.error.retryAfterSeconds, undefined);
    assert.equal(calls, 1);
  }
  const result = await createGeminiPacing({ store: { evaluate: async () => { throw new Error("synthetic-private-token and raw store contents"); } } }).admit();
  assert(!result.ok);
  assert.equal(result.error.status, 503);
  assert(!JSON.stringify(result).includes("synthetic-private"));
});

test("cancellation before admission skips Redis and cancellation in flight rejects a late success", async () => {
  let calls = 0;
  let finish: ((value: unknown) => void) | undefined;
  const store: UsageStore = { evaluate: async () => { calls++; return new Promise((resolve) => { finish = resolve; }); } };
  const pacing = createGeminiPacing({ store });
  const before = new AbortController(); before.abort();
  let result = await pacing.admit(before.signal);
  assert(!result.ok && result.error.code === "REQUEST_CANCELLED");
  assert.equal(calls, 0);
  const during = new AbortController();
  const pending = pacing.admit(during.signal);
  during.abort();
  result = await pending;
  assert(!result.ok && result.error.code === "REQUEST_CANCELLED");
  assert.equal(calls, 1);
  finish?.([1]);
  await new Promise((resolve) => setTimeout(resolve, 1));
});

test("cancelled or failed work retains its already admitted pacing reservation", async () => {
  const backend = await LuaUsageBackend.create();
  try {
    const signal = new AbortController();
    const pacing = createGeminiPacing({ store: backend.client() });
    assert((await pacing.admit(signal.signal)).ok);
    signal.abort();
    for (let index = 0; index < 11; index++) assert((await pacing.admit()).ok);
    const denied = await pacing.admit();
    assert(!denied.ok && denied.error.code === "GEMINI_PACING_LIMIT");
    assert.equal(backend.records.get("afterhours:usage:v1:gemini-rpm")?.values.size, 12);
  } finally { await backend.close(); }
});
