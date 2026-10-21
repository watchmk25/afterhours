import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createUsageControl, USAGE_RELEASE_LUA, type UsageAdmission, type UsageStore } from "../lib/usage-control.ts";
import { createRedisUsageStore, USAGE_STORE_TIMEOUT_MS } from "../lib/usage-redis.ts";

type Stage = "configuration" | "first admission" | "second admission" | "shared concurrency denial" | "own lease release" | "admission after release" | "temporary-key cleanup";
type Outcome = "completed" | "http_failure" | "timeout" | "transport_failure" | "response_or_redis_error" | "request_budget";
type Observation = { stage: Stage; elapsedMs: number; httpStatus?: number; timedOut: boolean; outcome: Outcome };
type Failure = { stage: Stage; code: Outcome | "configuration" | "unexpected_check_result"; httpStatus?: number; timedOut: boolean };

/** Manual Redis-only check; injected fetch keeps regression checks entirely offline. */
export async function runUsageCheck({ url, token, fetcher = fetch, timeoutMs = USAGE_STORE_TIMEOUT_MS }: {
  url: string; token: string; fetcher?: typeof fetch; timeoutMs?: number;
}) {
  let requests = 0, cleanup = false, cleanupAcknowledged = false, passed = false;
  let uncertainWrite = false;
  let stage: Stage = "configuration";
  let failure: Failure | undefined;
  const observations: Observation[] = [];
  const summary = () => ({
    realStore: passed && cleanup && !failure ? "PASS" : "UNVERIFIED",
    lastStage: stage, redisRequests: requests, maximumRedisRequests: 8,
    cleanupConfirmed: cleanup, cleanupAcknowledged, temporaryNamespaceOnly: true,
    qlooRequests: 0, geminiRequests: 0, observations,
    ...(failure ? { failure } : {}),
    ...(requests > 0 && !cleanup ? { limitation: "Temporary keys may remain until their existing TTLs expire (at most 24 hours)." } : {}),
  });
  if (!url || !token) return { ...summary(), reason: "Upstash Redis REST credentials are not configured.", exitCode: 2 };

  const namespace = `afterhours:usage:check:${randomUUID()}`;
  const visitors = Array.from({ length: 3 }, (_, index) => createHash("sha256").update(`${namespace}:${index}`).digest("hex"));
  const keys = [`${namespace}:global`, `${namespace}:leases`, ...visitors.map(visitor => `${namespace}:visitor:${visitor}`)];
  let store: UsageStore | undefined;
  let finalCleanup = false;
  let active: { observation: Observation; finished: boolean; detach?: () => void } | undefined;
  const accepted = (value: UsageAdmission) => { assert(value.ok); return value; };

  try {
    const transport = createRedisUsageStore({ url, token, timeoutMs, fetcher: async (input, options) => {
      const current = active!;
      if (requests >= 8 || new URL(String(input)).origin !== new URL(url).origin) {
        current.observation.outcome = "request_budget";
        throw new Error("Diagnostic request rejected.");
      }
      requests++;
      const signal = options?.signal;
      const onAbort = () => { if (!current.finished) current.observation.timedOut = true; };
      signal?.addEventListener("abort", onAbort, { once: true });
      current.detach = () => signal?.removeEventListener("abort", onAbort);
      try {
        const response = await fetcher(input, options);
        if (!current.finished) current.observation.httpStatus = response.status;
        return response;
      } catch { throw new Error("Diagnostic transport failed."); }
    } });
    store = { async evaluate(script, commandKeys, args, signal) {
      // release() intentionally swallows errors in the application. Latch any
      // observed failure here and permit only final exact-key cleanup afterwards.
      if (failure && !finalCleanup) throw new Error("Diagnostic stopped after failure.");
      assert(commandKeys.every(key => keys.includes(key)));
      const observation: Observation = { stage, elapsedMs: 0, timedOut: false, outcome: "transport_failure" };
      const current = { observation, finished: false, detach: undefined as (() => void) | undefined };
      active = current;
      observations.push(observation);
      const started = performance.now();
      try {
        const result = await transport.evaluate(script, commandKeys, args, signal);
        if (script === USAGE_RELEASE_LUA) assert.equal(result, 1);
        if (finalCleanup) assert(typeof result === "number" && Number.isInteger(result) && result >= 0 && result <= keys.length);
        observation.outcome = "completed";
        return result;
      } catch {
        observation.outcome = observation.timedOut ? "timeout" : observation.outcome === "request_budget" ? "request_budget"
          : observation.httpStatus !== undefined ? (observation.httpStatus >= 200 && observation.httpStatus < 300 ? "response_or_redis_error" : "http_failure") : "transport_failure";
        if (observation.outcome === "timeout" || observation.outcome === "transport_failure") uncertainWrite = true;
        failure ??= { stage, code: observation.outcome, ...(observation.httpStatus === undefined ? {} : { httpStatus: observation.httpStatus }), timedOut: observation.timedOut };
        throw new Error("Diagnostic store operation failed.");
      } finally {
        observation.elapsedMs = Math.max(0, Math.round(performance.now() - started));
        current.finished = true;
        current.detach?.();
      }
    } };
    const first = createUsageControl({ store, namespace }), second = createUsageControl({ store, namespace });
    stage = "first admission";
    const a = accepted(await first.admit(visitors[0], "event"));
    stage = "second admission";
    accepted(await second.admit(visitors[1], "event"));
    stage = "shared concurrency denial";
    const busy = await first.admit(visitors[2], "event");
    assert(!busy.ok && busy.error.code === "USAGE_BUSY");
    stage = "own lease release";
    await a.release();
    assert(!failure);
    stage = "admission after release";
    accepted(await second.admit(visitors[2], "event"));
    passed = true;
  } catch {
    failure ??= { stage, code: stage === "configuration" ? "configuration" : "unexpected_check_result", timedOut: false };
  } finally {
    if (store && requests > 0) {
      stage = "temporary-key cleanup";
      finalCleanup = true;
      try {
        await store.evaluate("return redis.call('DEL', KEYS[1], KEYS[2], KEYS[3], KEYS[4], KEYS[5])", keys, []);
        cleanupAcknowledged = true;
        // A timed-out write may still finish after this DEL on another connection.
        // Do not infer absence of late writes from a cleanup acknowledgment alone.
        cleanup = !uncertainWrite;
      } catch { /* First failure evidence is retained; existing TTLs bound leftovers. */ }
    }
  }
  return { ...summary(), exitCode: passed && cleanup && !failure ? 0 : 1 };
}

// Importing this helper in tests neither loads credential files nor starts work.
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const require = createRequire(import.meta.url);
  require("@next/env").loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
  const { exitCode, ...result } = await runUsageCheck({
    url: process.env.UPSTASH_REDIS_REST_URL ?? "", token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });
  console.log(JSON.stringify(result));
  process.exitCode = exitCode;
}
