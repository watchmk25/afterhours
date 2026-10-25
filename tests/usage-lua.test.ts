import assert from "node:assert/strict";
import test from "node:test";
import { createUsageControl, USAGE_DEFAULTS, USAGE_ADMISSION_LUA } from "../lib/usage-control.ts";
import { LuaUsageBackend } from "./helpers/usage-lua-store.ts";

const visitor = (index: number) => index.toString(16).padStart(64, "0");

test("actual admission Lua executes offline and serializes simultaneous clients sharing Redis state", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("Network is forbidden in the Lua emulator."); };
  let backend: LuaUsageBackend | undefined;
  try {
    backend = await LuaUsageBackend.create();
    const services = Array.from({ length: 3 }, () => createUsageControl({ store: backend!.client() }));
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => services[i % 3].admit(visitor(i + 1), "event")));
    assert.equal(results.filter(row => row.ok).length, 2);
    for (const row of results.filter(row => !row.ok)) { assert(!row.ok); assert.equal(row.error.code, "USAGE_BUSY"); assert.equal(row.error.retryAfterSeconds, 45); }
    assert.equal(backend.records.size, 4, "two visitor hashes, one shared budget, one lease set");
    assert.equal(backend.records.get("afterhours:usage:v1:global")?.values.get("gemini"), 6);
    const lease = backend.records.get("afterhours:usage:v1:leases");
    assert.equal(lease?.values.size, 2);
    assert.equal(lease?.expires, backend.now + 45_000);
    for (const row of results) if (row.ok) await row.release();
    assert(!backend.records.has("afterhours:usage:v1:leases"));
  } finally { await backend?.close(); globalThis.fetch = originalFetch; }
});

test("actual Lua enforces visitor/global windows and reservations with expiring identifiers", async () => {
  const backend = await LuaUsageBackend.create();
  try {
    const service = createUsageControl({ store: backend.client() });
    for (let i = 0; i < USAGE_DEFAULTS.visitorSearches; i++) assert((await service.admit(visitor(1), "search")).ok);
    const firstExpiry = backend.records.get(`afterhours:usage:v1:visitor:${visitor(1)}`)?.expires;
    backend.now += 1800_000;
    const limited = await createUsageControl({ store: backend.client() }).admit(visitor(1), "search");
    assert(!limited.ok && limited.error.code === "USAGE_LIMITED");
    assert.equal(limited.error.retryAfterSeconds, 1800);
    assert.equal(backend.records.get(`afterhours:usage:v1:visitor:${visitor(1)}`)?.expires, firstExpiry);
    backend.now += 1799_500;
    const almostReset = await service.admit(visitor(1), "search");
    assert(!almostReset.ok);
    assert.equal(almostReset.error.retryAfterSeconds, 1, "a partial final second must not advise a fresh full-hour wait");
    backend.now -= 1799_500;
    for (let i = 0; i < 88; i++) assert((await service.admit(visitor(i + 2), "rank")).ok);
    const global = await service.admit(visitor(200), "event");
    assert(!global.ok && global.error.code === "USAGE_LIMITED");
    assert.equal(global.error.retryAfterSeconds, 84600);
    assert(!backend.records.has(`afterhours:usage:v1:visitor:${visitor(200)}`));
    backend.now += 23 * 3600_000 + 1800_000;
    assert((await service.admit(visitor(1), "search")).ok);
  } finally { await backend.close(); }
});

test("actual Lua expires abandoned leases, releases only its own member, and never refunds budgets", async () => {
  const backend = await LuaUsageBackend.create();
  try {
    const first = createUsageControl({ store: backend.client() });
    const second = createUsageControl({ store: backend.client() });
    const a = await first.admit(visitor(1), "event"), b = await second.admit(visitor(2), "event");
    assert(a.ok && b.ok);
    await a.release(); await a.release();
    assert.equal(backend.records.get("afterhours:usage:v1:leases")?.values.size, 1);
    assert(backend.records.get("afterhours:usage:v1:leases")?.values.has(b.leaseId!));
    const c = await first.admit(visitor(3), "event"); assert(c.ok);
    backend.now += 45_000;
    const d = await second.admit(visitor(4), "event"); assert(d.ok);
    assert.equal(backend.records.get("afterhours:usage:v1:leases")?.values.size, 1);
    assert.equal(backend.records.get("afterhours:usage:v1:global")?.values.get("gemini"), 12);
    assert.equal(backend.records.get("afterhours:usage:v1:global")?.values.get("qloo"), 4);
    await d.release();
  } finally { await backend.close(); }
});

test("an unreadable acknowledgment after committed Lua admission releases only its own lease and fails closed", async () => {
  const backend = await LuaUsageBackend.create();
  try {
    const client = backend.client();
    const existing = await createUsageControl({ store: client }).admit(visitor(1), "event");
    assert(existing.ok);
    const service = createUsageControl({ store: {
      async evaluate(script, keys, args, signal) {
        const result = await client.evaluate(script, keys, args, signal);
        return script === USAGE_ADMISSION_LUA ? { unexpected: result } : result;
      },
    } });
    const rejected = await service.admit(visitor(2), "event");
    assert(!rejected.ok && rejected.error.code === "USAGE_UNAVAILABLE");
    assert.equal(backend.records.get("afterhours:usage:v1:leases")?.values.size, 1);
    assert(backend.records.get("afterhours:usage:v1:leases")?.values.has(existing.leaseId!));
    assert.equal(backend.records.get("afterhours:usage:v1:global")?.values.get("gemini"), 6);
    await existing.release();
  } finally { await backend.close(); }
});
