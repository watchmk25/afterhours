import assert from "node:assert/strict";
import test from "node:test";
import { runUsageCheck } from "../scripts/usage-check.mts";
import { USAGE_ADMISSION_LUA, USAGE_RELEASE_LUA } from "../lib/usage-control.ts";
import { GEMINI_PACING_LUA } from "../lib/gemini-pacing.ts";
import { LuaUsageBackend } from "./helpers/usage-lua-store.ts";

const url = "https://synthetic-check.upstash.io";
const token = "synthetic-private-rest-token-marker";
type Command = { script: string; keys: string[]; args: (string | number)[] };

function fixture(reply: (command: Command, index: number) => Response | Promise<Response>) {
  const calls: Command[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    assert.equal(String(input), url);
    assert.equal(options?.method, "POST");
    assert.equal(options?.redirect, "manual");
    assert.equal(options?.cache, "no-store");
    assert.equal(new Headers(options?.headers).get("Authorization"), `Bearer ${token}`);
    const raw: unknown = JSON.parse(String(options?.body));
    assert(Array.isArray(raw) && raw[0] === "EVAL" && typeof raw[1] === "string" && Number.isInteger(raw[2]));
    const command = { script: raw[1], keys: raw.slice(3, 3 + raw[2]) as string[], args: raw.slice(3 + raw[2]) as (string | number)[] };
    calls.push(command);
    assert(calls.length <= 10, "the diagnostic must never dispatch an eleventh REST request");
    return reply(command, calls.length);
  };
  return { calls, fetcher };
}

function cleanup(command: Command) {
  return command.script.includes("redis.call('DEL',");
}

function assertBounded(result: Awaited<ReturnType<typeof runUsageCheck>>, calls: Command[]) {
  assert.equal(result.redisRequests, calls.length);
  assert.equal(result.maximumRedisRequests, 10);
  assert(result.redisRequests <= 10);
  assert.equal(result.qlooRequests, 0);
  assert.equal(result.geminiRequests, 0);
  assert.equal(result.temporaryNamespaceOnly, true);
  for (const observation of result.observations) assert(Number.isInteger(observation.elapsedMs) && observation.elapsedMs >= 0);
}

test("manual Redis check executes admission and pacing Lua across clients and deletes exactly its six isolated keys", async () => {
  const backend = await LuaUsageBackend.create();
  const unrelated = "afterhours:usage:v1:unrelated-existing-record";
  backend.records.set(unrelated, { kind: "hash", values: new Map([["preserve", 1]]) });
  let deleted: string[] = [];
  try {
    const client = backend.client();
    const fake = fixture(async (command) => {
      if (cleanup(command)) {
        deleted = command.keys;
        assert.equal(command.keys.length, 6);
        assert.equal(new Set(command.keys).size, 6);
        const namespaces = command.keys.map((key) => key.match(/^(afterhours:usage:check:[a-f0-9-]+):/)?.[1]);
        assert(namespaces[0] && namespaces.every((namespace) => namespace === namespaces[0]));
        assert(command.keys.every((key) => key.startsWith(`${namespaces[0]}:`)));
        assert.deepEqual(command.args, []);
        let count = 0;
        for (const key of command.keys) if (backend.records.delete(key)) count++;
        return Response.json({ result: count });
      }
      return Response.json({ result: await client.evaluate(command.script, command.keys, command.args) });
    });
    const result = await runUsageCheck({ url, token, fetcher: fake.fetcher });
    assert.equal(result.realStore, "PASS", "PASS describes this injected offline fixture, not a live store");
    assert.equal(result.exitCode, 0);
    assert.equal(result.cleanupAcknowledged, true);
    assert.equal(result.cleanupConfirmed, true);
    assert.equal(fake.calls.length, 9);
    assert.deepEqual(fake.calls.map((command) => command.script), [USAGE_ADMISSION_LUA, USAGE_ADMISSION_LUA, USAGE_ADMISSION_LUA, USAGE_RELEASE_LUA, USAGE_ADMISSION_LUA,
      GEMINI_PACING_LUA, fake.calls[6].script, GEMINI_PACING_LUA, fake.calls[8].script]);
    assert.equal(fake.calls[6].args.length, 11, "only bounded synthetic pacing reservations are seeded");
    assert.equal(new Set(fake.calls[6].args).size, 11);
    assert.deepEqual(fake.calls[5].keys, fake.calls[6].keys);
    assert.deepEqual(fake.calls[7].keys, fake.calls[6].keys);
    assert(fake.calls[6].keys[0].endsWith(":gemini-rpm"));
    assert(cleanup(fake.calls[8]));
    assert.equal(deleted.length, 6);
    assert.deepEqual([...backend.records.keys()], [unrelated]);
    assert.deepEqual(result.observations.map((observation) => observation.stage), ["first admission", "second admission", "shared concurrency denial", "own lease release", "admission after release",
      "Gemini pacing admission", "temporary pacing saturation", "shared Gemini pacing denial", "temporary-key cleanup"]);
    assert(result.observations.every((observation) => observation.outcome === "completed" && observation.httpStatus === 200 && !observation.timedOut));
    assertBounded(result, fake.calls);
  } finally { await backend.close(); }
});

test("manual check missing or invalid configuration makes zero REST requests", async () => {
  for (const configuration of [{ url: "", token }, { url, token: "" }, { url: "http://synthetic-check.upstash.io", token },
    { url: "https://elsewhere.invalid", token }, { url: `${url}?credential=synthetic-private-url-marker`, token }, { url, token: ` ${token}` }]) {
    let calls = 0;
    const result = await runUsageCheck({ ...configuration, fetcher: async () => { calls++; throw new Error("must not dispatch"); } });
    assert.equal(result.realStore, "UNVERIFIED");
    assert.equal(result.redisRequests, 0);
    assert.equal(calls, 0);
    assert.equal(result.cleanupAcknowledged, false);
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.qlooRequests + result.geminiRequests, 0);
    assert(result.exitCode !== 0);
    assert(!JSON.stringify(result).includes("synthetic-private"));
  }
});

test("first HTTP authentication, rate, or availability failure survives cleanup and stops further admissions", async () => {
  for (const status of [401, 429, 503]) {
    const fake = fixture((command, index) => index === 1 ? Response.json({ error: "synthetic-private-body-marker" }, { status })
      : cleanup(command) ? Response.json({ result: 0 }) : assert.fail("only final cleanup may follow failure"));
    const result = await runUsageCheck({ url, token, fetcher: fake.fetcher });
    assert.equal(result.realStore, "UNVERIFIED");
    assert.equal(result.exitCode, 1);
    assert.equal(result.cleanupAcknowledged, true);
    assert.equal(result.cleanupConfirmed, true);
    assert("failure" in result);
    assert.deepEqual(result.failure, { stage: "first admission", code: "http_failure", httpStatus: status, timedOut: false });
    assert.equal(fake.calls.length, 2, "implicit own-lease cleanup is blocked locally after failure");
    assert(cleanup(fake.calls[1]));
    assert.deepEqual(result.observations.map((observation) => observation.httpStatus), [status, 200]);
    assertBounded(result, fake.calls);
  }
});

test("failed own-lease release cannot be swallowed into another admission or a passing check", async () => {
  const fake = fixture((command, index) => {
    if (index <= 2) return Response.json({ result: [1] });
    if (index === 3) return Response.json({ result: [0, "busy", 45] });
    if (index === 4) {
      assert.equal(command.script, USAGE_RELEASE_LUA);
      return Response.json({ error: "synthetic-private-release-marker" }, { status: 503 });
    }
    assert(cleanup(command), "a failed swallowed release must prevent admission after release");
    return Response.json({ result: 0 });
  });
  const result = await runUsageCheck({ url, token, fetcher: fake.fetcher });
  assert.equal(result.realStore, "UNVERIFIED");
  assert.equal(result.cleanupAcknowledged, true);
  assert.equal(result.cleanupConfirmed, true);
  assert("failure" in result);
  assert.deepEqual(result.failure, { stage: "own lease release", code: "http_failure", httpStatus: 503, timedOut: false });
  assert.equal(fake.calls.length, 5);
  assert(!result.observations.some((observation) => observation.stage === "admission after release"));
  assertBounded(result, fake.calls);
});

test("HTTP 200 invalid JSON and Redis error envelopes retain response status without claiming connectivity success", async () => {
  for (const invalid of [() => new Response("not valid JSON", { headers: { "Content-Type": "application/json" } }),
    () => Response.json({ error: "ERR synthetic-private-redis-content-marker" })]) {
    const fake = fixture((command, index) => index === 1 ? invalid() : cleanup(command) ? Response.json({ result: 0 }) : assert.fail("unexpected work after invalid response"));
    const result = await runUsageCheck({ url, token, fetcher: fake.fetcher });
    assert.equal(result.realStore, "UNVERIFIED");
    assert("failure" in result);
    assert.deepEqual(result.failure, { stage: "first admission", code: "response_or_redis_error", httpStatus: 200, timedOut: false });
    assert.equal(fake.calls.length, 2);
    assert.equal(result.cleanupAcknowledged, true);
    assert.equal(result.cleanupConfirmed, true);
    assert(!JSON.stringify(result).includes("synthetic-private"));
    assertBounded(result, fake.calls);
  }
});

test("hard deadline covers stalled fetch and HTTP 200 stalled body with bounded cleanup", async () => {
  for (const duringBody of [false, true]) {
    const fake = fixture((command, index) => {
      if (index === 1) return duringBody
        ? new Response(new ReadableStream({ start() { /* Intentionally never finish. */ } }), { headers: { "Content-Type": "application/json" } })
        : new Promise<Response>(() => {});
      assert(cleanup(command));
      return Response.json({ result: 0 });
    });
    const start = performance.now();
    const result = await runUsageCheck({ url, token, fetcher: fake.fetcher, timeoutMs: 10 });
    assert(performance.now() - start < 1000);
    assert.equal(result.realStore, "UNVERIFIED");
    assert.equal(result.cleanupAcknowledged, true);
    assert.equal(result.cleanupConfirmed, false, "a timed-out admission may commit after the acknowledged cleanup");
    assert("limitation" in result && result.limitation?.includes("24 hours"));
    assert("failure" in result);
    assert.deepEqual(result.failure, { stage: "first admission", code: "timeout", ...(duringBody ? { httpStatus: 200 } : {}), timedOut: true });
    assert.equal(fake.calls.length, 2);
    assertBounded(result, fake.calls);
  }
});

test("final temporary-key cleanup failure prevents PASS even after every admission check succeeds", async () => {
  const fake = fixture((command, index) => {
    if (cleanup(command)) return new Response("synthetic-private-cleanup-marker", { status: 503 });
    if (index === 7) return Response.json({ result: 12 });
    if (index === 8) return Response.json({ result: [0, 60] });
    return Response.json({ result: index === 3 ? [0, "busy", 45] : command.script === USAGE_RELEASE_LUA ? 1 : [1] });
  });
  const result = await runUsageCheck({ url, token, fetcher: fake.fetcher });
  assert.equal(result.realStore, "UNVERIFIED");
  assert.equal(result.exitCode, 1);
  assert.equal(result.cleanupAcknowledged, false);
  assert.equal(result.cleanupConfirmed, false);
  assert("failure" in result);
  assert.deepEqual(result.failure, { stage: "temporary-key cleanup", code: "http_failure", httpStatus: 503, timedOut: false });
  assert.equal(fake.calls.length, 9);
  assert("limitation" in result && result.limitation?.includes("24 hours"));
  assertBounded(result, fake.calls);
});

test("manual summaries exclude fake credentials, headers, URLs, Redis contents and raw transport errors", async () => {
  const markers = [token, "synthetic-private-error-marker", "synthetic-private-header-marker", "synthetic-private-redis-marker", "https://private-upstream.invalid/credential"];
  for (const transportFailure of [true, false]) {
    const fake = fixture((command, index) => {
      if (index === 1) {
        if (transportFailure) throw new Error(markers.join(" "));
        return Response.json({ error: markers.join(" "), nested: { credentials: token, redisContents: markers[3] } }, {
          status: 403, headers: { Authorization: `Bearer ${token}`, "X-Private-Header": markers[2], Location: markers[4] },
        });
      }
      assert(cleanup(command));
      return Response.json({ result: 0 });
    });
    const result = await runUsageCheck({ url, token, fetcher: fake.fetcher });
    const serialized = JSON.stringify(result);
    for (const marker of [...markers, url, "Authorization", "redisContents"]) assert(!serialized.includes(marker));
    assert.equal(result.realStore, "UNVERIFIED");
    assert("failure" in result);
    assert.equal(result.failure?.code, transportFailure ? "transport_failure" : "http_failure");
    assert.equal(result.failure?.httpStatus, transportFailure ? undefined : 403);
    assert.equal(result.cleanupAcknowledged, true);
    assert.equal(result.cleanupConfirmed, !transportFailure, "a transport failure cannot establish that no late write follows cleanup");
    assertBounded(result, fake.calls);
  }
});
