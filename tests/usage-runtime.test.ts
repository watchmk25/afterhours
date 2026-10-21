import assert from "node:assert/strict";
import test from "node:test";
import { usageVisitor } from "../lib/usage-identity.ts";
import { runWithUsage } from "../lib/usage-run.ts";
import type { UsageAdmission, UsageRejection } from "../lib/usage-control.ts";

const secret = "synthetic-visitor-secret-at-least-32-bytes";
const environment = { VERCEL: "1", AFTERHOURS_USAGE_SECRET: secret };
const request = (address = "192.0.2.10", extra: Record<string, string> = {}) => new Request("https://afterhours.example/api/event-agent", {
  headers: { "x-vercel-forwarded-for": address, ...extra },
});

test("visitor identity trusts only the platform header on an explicitly trusted hosting runtime", () => {
  assert.equal(usageVisitor(request(), { AFTERHOURS_USAGE_SECRET: secret }), null);
  assert.equal(usageVisitor(request(), { ...environment, VERCEL: "0" }), null);
  assert.equal(usageVisitor(new Request("https://afterhours.example", { headers: { "x-forwarded-for": "192.0.2.10", "x-real-ip": "192.0.2.10" } }), environment), null);
  for (const address of ["192.0.2.1, 192.0.2.2", "unknown", "example.com", "192.0.2.1:443", "[2001:db8::1]"]) assert.equal(usageVisitor(request(address), environment), null);
});

test("visitor hashes are shared across instances, normalize IPv6, rotate daily and never retain the raw address", () => {
  const time = Date.UTC(2026, 9, 21, 12);
  const first = usageVisitor(request(), environment, time);
  assert.match(first!, /^[a-f0-9]{64}$/);
  assert.equal(first, usageVisitor(request("192.0.2.10", { "x-forwarded-for": "203.0.113.9" }), { ...environment }, time));
  assert.notEqual(first, usageVisitor(request("192.0.2.11"), environment, time));
  assert.notEqual(first, usageVisitor(request(), environment, time + 86_400_000));
  assert.notEqual(first, usageVisitor(request(), { ...environment, AFTERHOURS_USAGE_SECRET: secret + "different" }, time));
  assert.equal(usageVisitor(request("2001:db8::1"), environment, time), usageVisitor(request("2001:0db8:0:0:0:0:0:1"), environment, time));
  assert(!first!.includes("192.0.2.10"));
});

test("missing or malformed visitor secrets fail closed", () => {
  for (const value of [undefined, "", "too-short", " " + secret, secret + "\n", "x".repeat(513)]) assert.equal(usageVisitor(request(), { VERCEL: "1", AFTERHOURS_USAGE_SECRET: value }), null);
});

test("every shared admission rejection prevents provider dispatch", async () => {
  let providerCalls = 0;
  for (const error of [
    { status: 429, code: "USAGE_LIMITED", message: "Try again in 60 seconds.", retryAfterSeconds: 60 },
    { status: 429, code: "USAGE_BUSY", message: "Try again in 45 seconds.", retryAfterSeconds: 45 },
    { status: 503, code: "USAGE_UNAVAILABLE", message: "Try again later." },
    { status: 503, code: "LIVE_DISABLED", message: "Paused by the organizer." },
  ] satisfies UsageRejection[]) {
    const result = await runWithUsage(async () => ({ ok: false, error }), new AbortController().signal, async () => { providerCalls++; });
    assert.deepEqual(result, { ok: false, error });
  }
  assert.equal(providerCalls, 0);
});

test("admission exceptions and pre-cancellation never start providers or fall back", async () => {
  let providerCalls = 0, admissions = 0;
  const controller = new AbortController(); controller.abort();
  const cancelled = await runWithUsage(async () => { admissions++; throw new Error("not reached"); }, controller.signal, async () => { providerCalls++; });
  assert(!cancelled.ok && cancelled.error.status === 499);
  assert.equal(admissions, 0);
  const failed = await runWithUsage(async () => { throw new Error("synthetic-private-token"); }, new AbortController().signal, async () => { providerCalls++; });
  assert(!failed.ok && failed.error.status === 503);
  assert(!JSON.stringify(failed).includes("synthetic-private-token"));
  assert.equal(providerCalls, 0);
});

test("leases release after success or failure without refunding or starting more work", async () => {
  let releases = 0, calls = 0;
  const admit = async (): Promise<UsageAdmission> => ({ ok: true, leaseId: "synthetic-lease", release: async () => { releases++; } });
  const success = await runWithUsage(admit, new AbortController().signal, async () => { calls++; return "validated proposal"; });
  assert.deepEqual(success, { ok: true, value: "validated proposal" });
  await assert.rejects(runWithUsage(admit, new AbortController().signal, async () => { calls++; throw new Error("controlled failure"); }), /controlled failure/);
  assert.equal(releases, 2); assert.equal(calls, 2);
});

test("cancellation after admission releases the lease and rejects late work", async () => {
  const controller = new AbortController();
  let releases = 0, calls = 0;
  let finish!: (value: string) => void;
  const pending = new Promise<string>((resolve) => { finish = resolve; });
  const run = runWithUsage(async () => ({ ok: true, release: async () => { releases++; } }), controller.signal, async () => { calls++; return pending; });
  await Promise.resolve(); await Promise.resolve();
  controller.abort();
  const result = await run;
  assert(!result.ok && result.error.code === "REQUEST_CANCELLED");
  assert.equal(result.workStarted, true, "in-flight cancellation must not imply zero provider dispatch");
  assert.equal(releases, 1); assert.equal(calls, 1);
  finish("late result");
  await Promise.resolve();
  assert(!result.ok);
});

test("a cancellation received with admission acknowledgment releases without provider dispatch", async () => {
  const controller = new AbortController(); let calls = 0, releases = 0;
  const result = await runWithUsage(async () => { controller.abort(); return { ok: true, release: async () => { releases++; } }; }, controller.signal, async () => { calls++; });
  assert(!result.ok && result.error.status === 499);
  assert.equal(result.workStarted, undefined);
  assert.equal(calls, 0); assert.equal(releases, 1);
});
