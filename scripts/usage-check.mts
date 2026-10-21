import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createUsageControl, type UsageAdmission } from "../lib/usage-control.ts";
import { createRedisUsageStore } from "../lib/usage-redis.ts";

// Manual Redis-only diagnostic. No provider libraries or request payloads enter it.
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const url = process.env.UPSTASH_REDIS_REST_URL ?? "";
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
if (!url || !token) {
  console.log(JSON.stringify({ realStore: "UNVERIFIED", redisRequests: 0, qlooRequests: 0, geminiRequests: 0, reason: "Upstash Redis REST credentials are not configured." }));
  process.exit(2);
}

let requests = 0, cleanup = false, passed = false;
let stage = "configuration";
const namespace = `afterhours:usage:check:${randomUUID()}`;
const visitors = Array.from({ length: 3 }, (_, index) => createHash("sha256").update(`${namespace}:${index}`).digest("hex"));
const keys = [`${namespace}:global`, `${namespace}:leases`, ...visitors.map(visitor => `${namespace}:visitor:${visitor}`)];
let store: ReturnType<typeof createRedisUsageStore> | undefined;
const accepted = (value: UsageAdmission) => { assert(value.ok); return value; };

try {
  store = createRedisUsageStore({ url, token, fetcher: async (input, options) => {
    if (requests >= 8 || new URL(String(input)).origin !== new URL(url).origin) throw new Error("Diagnostic request budget or origin rejected.");
    requests++;
    return fetch(input, options);
  } });
  const first = createUsageControl({ store, namespace }), second = createUsageControl({ store, namespace });
  stage = "two shared admissions";
  const a = accepted(await first.admit(visitors[0], "event"));
  accepted(await second.admit(visitors[1], "event"));
  stage = "shared concurrency denial";
  const busy = await first.admit(visitors[2], "event");
  assert(!busy.ok && busy.error.code === "USAGE_BUSY");
  stage = "own lease release";
  await a.release();
  stage = "admission after release";
  accepted(await second.admit(visitors[2], "event"));
  passed = true;
} catch {
  // Never print REST bodies, tokens, endpoints, exceptions, or stacks.
} finally {
  if (store) {
    try {
      assert(keys.every(key => key.startsWith(`${namespace}:`)));
      const result = await store.evaluate("return redis.call('DEL', KEYS[1], KEYS[2], KEYS[3], KEYS[4], KEYS[5])", keys, []);
      cleanup = typeof result === "number" && result >= 0 && result <= keys.length;
    } catch { /* TTLs bound all temporary keys if the store is unavailable. */ }
  }
}

console.log(JSON.stringify({ realStore: passed && cleanup ? "PASS" : "UNVERIFIED", lastStage: stage,
  redisRequests: requests, maximumRedisRequests: 8, cleanupConfirmed: cleanup,
  temporaryNamespaceOnly: true, qlooRequests: 0, geminiRequests: 0,
  ...(cleanup ? {} : { limitation: "Temporary keys may remain until their existing TTLs expire (at most 24 hours)." }),
}));
if (!passed || !cleanup) process.exitCode = 1;
