import assert from "node:assert/strict";
import test from "node:test";
import { createUsageControl, USAGE_ADMISSION_LUA, USAGE_DEFAULTS, USAGE_RELEASE_LUA, type UsageStore } from "../lib/usage-control.ts";
import { createRedisUsageStore } from "../lib/usage-redis.ts";

const visitor = (index = 1) => index.toString(16).padStart(64, "0");

/** Atomic shared-store contract fixture; no HTTP or provider is contacted. */
class SharedStore implements UsageStore {
  now = 0;
  hashes = new Map<string, { values: Map<string, number>; expires: number }>();
  leases = new Map<string, Map<string, number>>();
  calls: { script: string; keys: readonly string[]; args: readonly (string | number)[] }[] = [];
  fail = false;
  async evaluate(script: string, keys: readonly string[], args: readonly (string | number)[]) {
    this.calls.push({ script, keys, args });
    if (this.fail) throw new Error("synthetic private store error");
    if (script === USAGE_RELEASE_LUA) return this.leases.get(keys[0])?.delete(String(args[0])) ? 1 : 0;
    assert.equal(script, USAGE_ADMISSION_LUA);
    const [operation, lease, visitorWindow, globalWindow, leaseMillis, visitorLimit, qlooLimit, geminiLimit, concurrency, qlooCost, geminiCost] = args;
    for (const [key, value] of this.hashes) if (value.expires <= this.now) this.hashes.delete(key);
    const leases = this.leases.get(keys[2]) ?? new Map<string, number>();
    this.leases.set(keys[2], leases);
    for (const [id, expires] of leases) if (expires <= this.now) leases.delete(id);
    const count = (key: string, field: string) => this.hashes.get(key)?.values.get(field) ?? 0;
    const retry = (key: string) => Math.max(1, Math.ceil(((this.hashes.get(key)?.expires ?? this.now + 1000) - this.now) / 1000));
    if (count(keys[0], String(operation)) + 1 > Number(visitorLimit)) return [0, "visitor", retry(keys[0])];
    if (count(keys[1], "qloo") + Number(qlooCost) > Number(qlooLimit)) return [0, "qloo", retry(keys[1])];
    if (count(keys[1], "gemini") + Number(geminiCost) > Number(geminiLimit)) return [0, "gemini", retry(keys[1])];
    if (operation === "event" && leases.size >= Number(concurrency)) return [0, "busy", Math.max(1, Math.ceil((Math.min(...leases.values()) - this.now) / 1000))];
    const increment = (key: string, field: string, amount: number, seconds: number) => {
      const record = this.hashes.get(key) ?? { values: new Map<string, number>(), expires: this.now + seconds * 1000 };
      record.values.set(field, (record.values.get(field) ?? 0) + amount);
      this.hashes.set(key, record);
    };
    increment(keys[0], String(operation), 1, Number(visitorWindow));
    increment(keys[1], "qloo", Number(qlooCost), Number(globalWindow));
    increment(keys[1], "gemini", Number(geminiCost), Number(globalWindow));
    if (operation === "event") leases.set(String(lease), this.now + Number(leaseMillis));
    return [1];
  }
}

test("usage has explicit conservative fixed defaults and no content-bearing keys", async () => {
  const store = new SharedStore();
  const result = await createUsageControl({ store }).admit(visitor(), "event");
  assert(result.ok);
  assert.deepEqual(USAGE_DEFAULTS, { visitorWindowSeconds: 3600, visitorSearches: 12, visitorRankings: 6, visitorEvents: 6,
    globalWindowSeconds: 86400, globalQlooRequests: 100, globalGeminiRequests: 90, concurrentEvents: 2, leaseSeconds: 45 });
  assert.deepEqual(store.calls[0].keys, [`afterhours:usage:v1:visitor:${visitor()}`, "afterhours:usage:v1:global", "afterhours:usage:v1:leases"]);
  assert.equal(store.hashes.get("afterhours:usage:v1:global")?.values.get("gemini"), 3);
  assert.equal(store.hashes.get("afterhours:usage:v1:global")?.values.get("qloo"), 1);
  assert(!store.calls[0].args.includes("prompt"));
});

test("separate service instances share atomic simultaneous event admission", async () => {
  const store = new SharedStore();
  const first = createUsageControl({ store });
  const second = createUsageControl({ store });
  const results = await Promise.all(Array.from({ length: 20 }, (_, index) => (index % 2 ? first : second).admit(visitor(index + 1), "event")));
  assert.equal(results.filter((result) => result.ok).length, 2);
  for (const result of results.filter((result) => !result.ok)) {
    assert(!result.ok);
    assert.equal(result.error.code, "USAGE_BUSY");
    assert.equal(result.error.retryAfterSeconds, 45);
  }
  assert.equal(store.hashes.get("afterhours:usage:v1:global")?.values.get("gemini"), 6);
  assert.equal(store.hashes.get("afterhours:usage:v1:global")?.values.get("qloo"), 2);
  assert.equal(store.hashes.size, 3, "busy visitors receive no allowance mutations");
});

test("visitor operation limits are independent and windows are anchored at first admission", async () => {
  const store = new SharedStore();
  const service = createUsageControl({ store });
  for (let index = 0; index < 12; index++) assert((await service.admit(visitor(), "search")).ok);
  store.now = 30 * 60 * 1000;
  const denied = await service.admit(visitor(), "search");
  assert(!denied.ok);
  assert.equal(denied.error.code, "USAGE_LIMITED");
  assert.equal(denied.error.retryAfterSeconds, 1800);
  for (let index = 0; index < 6; index++) assert((await service.admit(visitor(), "rank")).ok);
  assert(!(await service.admit(visitor(), "rank")).ok);
  for (let index = 0; index < 6; index++) {
    const event = await service.admit(visitor(), "event");
    assert(event.ok);
    await event.release();
  }
  assert(!(await service.admit(visitor(), "event")).ok);
  store.now = 3600 * 1000;
  assert((await service.admit(visitor(), "search")).ok);
});

test("shared Qloo budget covers search and ranking across visitors and resets only after 24 hours", async () => {
  const store = new SharedStore();
  const service = createUsageControl({ store });
  for (let index = 1; index <= 100; index++) assert((await service.admit(visitor(index), index % 2 ? "search" : "rank")).ok);
  const denied = await createUsageControl({ store }).admit(visitor(101), "event");
  assert(!denied.ok);
  assert.equal(denied.error.retryAfterSeconds, 86400);
  assert(!store.hashes.has(`afterhours:usage:v1:visitor:${visitor(101)}`));
  store.now = 86400 * 1000;
  assert((await service.admit(visitor(101), "search")).ok);
});

test("event reservations bound Gemini to 90 and are never refunded by cleanup", async () => {
  const store = new SharedStore();
  const service = createUsageControl({ store });
  for (let index = 1; index <= 30; index++) {
    const result = await service.admit(visitor(index), "event");
    assert(result.ok);
    await result.release();
  }
  const denied = await service.admit(visitor(31), "event");
  assert(!denied.ok);
  assert.equal(denied.error.code, "USAGE_LIMITED");
  assert.equal(store.hashes.get("afterhours:usage:v1:global")?.values.get("gemini"), 90);
  assert.equal(store.hashes.get("afterhours:usage:v1:global")?.values.get("qloo"), 30);
  assert((await service.admit(visitor(31), "search")).ok, "unused Qloo allowance remains available");
});

test("lease release is idempotent, owns only its lease, and does not need the cancelled caller", async () => {
  const store = new SharedStore();
  const service = createUsageControl({ store });
  const controller = new AbortController();
  const one = await service.admit(visitor(1), "event", controller.signal);
  const two = await service.admit(visitor(2), "event");
  assert(one.ok && two.ok);
  assert.notEqual(one.leaseId, two.leaseId);
  controller.abort();
  await Promise.all([one.release(), one.release()]);
  assert.equal(store.calls.filter((call) => call.script === USAGE_RELEASE_LUA).length, 1);
  assert.equal(store.leases.get("afterhours:usage:v1:leases")?.size, 1);
  const three = await service.admit(visitor(3), "event");
  assert(three.ok);
  assert(!(await service.admit(visitor(4), "event")).ok);
});

test("abandoned leases expire after 45 seconds and failed cleanup remains bounded", async () => {
  const store = new SharedStore();
  const service = createUsageControl({ store });
  const one = await service.admit(visitor(1), "event");
  const two = await service.admit(visitor(2), "event");
  assert(one.ok && two.ok);
  store.fail = true;
  await one.release();
  store.fail = false;
  store.now = 44_999;
  const denied = await service.admit(visitor(3), "event");
  assert(!denied.ok);
  assert.equal(denied.error.retryAfterSeconds, 1);
  store.now = 45_000;
  assert((await service.admit(visitor(3), "event")).ok);
});

test("store failures, unexpected output, invalid visitor, and cancellation never authorize dispatch", async () => {
  let dispatches = 0;
  let storeCalls = 0;
  for (const result of [undefined, [1, "extra"], [0, "visitor", -1], [0, "other", 30], [0, "busy", 90_000], { result: [1] }]) {
    const store: UsageStore = { evaluate: async () => { storeCalls++; return result; } };
    const admission = await createUsageControl({ store }).admit(visitor(), "rank");
    if (admission.ok) dispatches++;
    assert(!admission.ok);
    assert.equal(admission.error.status, 503);
  }
  const store: UsageStore = { evaluate: async () => { storeCalls++; throw new Error("fake-secret=not-for-display"); } };
  const controller = new AbortController();
  controller.abort();
  for (const admission of [await createUsageControl({ store }).admit(visitor(), "rank"),
    await createUsageControl({ store }).admit("raw-ip-is-not-a-hash", "rank"),
    await createUsageControl({ store }).admit(visitor(), "rank", controller.signal)]) {
    if (admission.ok) dispatches++;
    assert(!admission.ok);
    assert(!JSON.stringify(admission).includes("fake-secret"));
  }
  assert.equal(dispatches, 0);
  assert.equal(storeCalls, 7, "invalid identity and pre-cancelled requests skip the store");
});

test("cancellation racing a successful admission cleans its lease and rejects late success", async () => {
  const controller = new AbortController();
  const calls: string[] = [];
  const store: UsageStore = { evaluate: async (script) => {
    calls.push(script);
    if (script === USAGE_ADMISSION_LUA) { controller.abort(); return [1]; }
    return 1;
  } };
  const result = await createUsageControl({ store }).admit(visitor(), "event", controller.signal);
  assert(!result.ok);
  assert.equal(result.error.code, "REQUEST_CANCELLED");
  assert.deepEqual(calls, [USAGE_ADMISSION_LUA, USAGE_RELEASE_LUA]);
});

test("Redis transport uses a single bounded authenticated POST with no retry or redirect", async () => {
  const calls: { url: string; options: RequestInit }[] = [];
  const store = createRedisUsageStore({ url: "https://synthetic-store.upstash.io", token: "synthetic-token", fetcher: async (input, options = {}) => {
    calls.push({ url: String(input), options });
    return Response.json({ result: [1] });
  } });
  assert.deepEqual(await store.evaluate("return {1}", ["isolated:key"], ["bounded", 1]), [1]);
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(call.url, "https://synthetic-store.upstash.io");
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.redirect, "manual");
  assert.equal(call.options.cache, "no-store");
  assert.equal(new Headers(call.options.headers).get("Authorization"), "Bearer synthetic-token");
  assert.deepEqual(JSON.parse(String(call.options.body)), ["EVAL", "return {1}", 1, "isolated:key", "bounded", 1]);
  assert(call.options.signal);
});

test("Redis configuration rejects arbitrary hosts, unsafe URLs, credentials and excessive deadlines", () => {
  for (const url of ["http://synthetic-store.upstash.io", "https://upstash.io", "https://example.com", "https://synthetic-store.upstash.io.evil.example", "https://user:pass@synthetic-store.upstash.io", "https://synthetic-store.upstash.io/command", "https://synthetic-store.upstash.io?token=private", "https://synthetic-store.upstash.io#fragment", "https://synthetic-store.upstash.io:8443"]) {
    assert.throws(() => createRedisUsageStore({ url, token: "synthetic-token" }), /configuration is invalid/);
  }
  for (const token of ["", " padded", "padded ", "line\nbreak"]) assert.throws(() => createRedisUsageStore({ url: "https://synthetic-store.upstash.io", token }), /configuration is invalid/);
  assert.throws(() => createRedisUsageStore({ url: "https://synthetic-store.upstash.io", token: "synthetic-token", timeoutMs: 1001 }));
});

test("Redis transport fails closed on errors, redirects, malformed responses and oversized output", async () => {
  for (const response of [new Response("secret=synthetic-private", { status: 503 }), new Response(null, { status: 302, headers: { Location: "https://elsewhere.invalid" } }),
    Response.json({ error: "secret=synthetic-private" }), Response.json({ result: [1], error: "hidden" }), Response.json([1]), new Response("not-json"), new Response("x".repeat(16 * 1024 + 1))]) {
    let calls = 0;
    const store = createRedisUsageStore({ url: "https://synthetic-store.upstash.io", token: "synthetic-private", fetcher: async () => { calls++; return response; } });
    await assert.rejects(store.evaluate("script", [], []), (error: unknown) => error instanceof Error && error.message === "Usage store operation failed." && !error.message.includes("synthetic-private"));
    assert.equal(calls, 1);
  }
});

test("Redis hard deadline covers fetch and body even if a transport ignores abort", async () => {
  for (const duringBody of [false, true]) {
    let calls = 0;
    const store = createRedisUsageStore({ url: "https://synthetic-store.upstash.io", token: "synthetic-token", timeoutMs: 15,
      fetcher: async () => { calls++; return duringBody ? new Response(new ReadableStream({ start() { /* Deliberately never finish. */ } })) : new Promise<Response>(() => {}); } });
    const started = performance.now();
    await assert.rejects(store.evaluate("script", [], []), /Usage store operation failed/);
    assert(performance.now() - started < 1000);
    assert.equal(calls, 1);
  }
});

test("Redis cancellation before and during dispatch never allows a late result", async () => {
  const before = new AbortController();
  before.abort();
  let calls = 0;
  let complete: ((response: Response) => void) | undefined;
  const store = createRedisUsageStore({ url: "https://synthetic-store.upstash.io", token: "synthetic-token", fetcher: async () => {
    calls++;
    return new Promise<Response>((resolve) => { complete = resolve; });
  } });
  await assert.rejects(store.evaluate("script", [], [], before.signal));
  assert.equal(calls, 0);
  const during = new AbortController();
  const pending = store.evaluate("script", [], [], during.signal);
  during.abort();
  await assert.rejects(pending, /Usage store operation failed/);
  assert.equal(calls, 1);
  complete?.(Response.json({ result: [1] }));
  await new Promise((resolve) => setTimeout(resolve, 1));
});
