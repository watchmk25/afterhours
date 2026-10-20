import assert from "node:assert/strict";
import test from "node:test";
import type { BrowserContext, Route } from "@playwright/test";
import { fetchProtectedPreview, installProtectedPreviewTransport, protectedPreview } from "../e2e/support/protected-preview.ts";

const origin = "https://controlled-afterhours-preview.vercel.app";
const secret = "synthetic-preview-authorization-only";
const configuration = { origin, secret };

test("protected Preview requires explicit HTTPS Vercel target and process-only authorization", () => {
  assert.equal(protectedPreview({}), undefined);
  assert.deepEqual(protectedPreview({ PLAYWRIGHT_BASE_URL: origin, VERCEL_AUTOMATION_BYPASS_SECRET: secret }), configuration);
  for (const target of [undefined, "", "http://localhost:3000", "https://example.com", `${origin}/private`, `${origin}?secret=value`, `https://person@controlled-afterhours-preview.vercel.app`, `${origin}:444`]) {
    assert.throws(() => protectedPreview({ PLAYWRIGHT_BASE_URL: target, VERCEL_AUTOMATION_BYPASS_SECRET: secret }), /Protected Preview/);
  }
  for (const invalid of ["", " ", "synthetic\nvalue"]) {
    assert.throws(() => protectedPreview({ PLAYWRIGHT_BASE_URL: origin, VERCEL_AUTOMATION_BYPASS_SECRET: invalid }), /Protected Preview/);
  }
});

test("protected transport adds authorization only inside exact-origin Node fetch and sanitizes browser output", async () => {
  let calls = 0;
  const response = await fetchProtectedPreview(configuration, `${origin}/_next/static/example.js`, {
    headers: { Accept: "application/javascript", Origin: origin, Cookie: "private-browser-cookie", Authorization: "private-browser-authorization" },
    fetcher: async (input, init) => {
      calls += 1;
      assert.equal(String(input), `${origin}/_next/static/example.js`);
      assert.equal(init?.redirect, "manual");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("x-vercel-protection-bypass"), secret);
      assert.equal(headers.get("accept"), "application/javascript");
      assert.equal(headers.get("origin"), origin);
      assert.equal(headers.has("cookie"), false);
      assert.equal(headers.has("authorization"), false);
      return new Response(`controlled body ${secret}`, { headers: {
        "content-type": "application/javascript", "content-length": "200", "content-encoding": "gzip",
        "set-cookie": `authorization=${secret}`, "x-echo-private": secret,
      } });
    },
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(response.headers, { "content-type": "application/javascript" });
  assert.equal(response.body.toString(), "controlled body [redacted]");
  assert.equal(JSON.stringify(response).includes(secret), false);
  await assert.rejects(fetchProtectedPreview(configuration, origin, {
    headers: { Origin: "https://other.example" },
    fetcher: async () => { throw new Error("Must reject before fetch."); },
  }), /Protected preview transport failed/);
});

test("protected transport rejects other origins without fetch and never follows redirects", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.redirect, "manual");
    return new Response("", { status: 302, headers: { location: "https://other.example/" } });
  };
  for (const target of ["https://other.example/", "https://other-preview.vercel.app/", "not a URL", `https://person@controlled-afterhours-preview.vercel.app/`]) {
    await assert.rejects(fetchProtectedPreview(configuration, target, { fetcher }), /Protected preview transport failed/);
  }
  assert.equal(calls, 0);
  const result = await fetchProtectedPreview(configuration, origin, { fetcher });
  assert.equal(calls, 1);
  assert.equal(result.status, 302);
});

test("protected transport failures never expose fetch exceptions or synthetic authorization", async () => {
  await assert.rejects(fetchProtectedPreview(configuration, origin, {
    fetcher: async () => { throw new Error(`untrusted exception ${secret}`); },
  }), (error: unknown) => error instanceof Error && error.message === "Protected preview transport failed. Check the target and authorized Preview access." && !error.message.includes(secret));
});

test("regression context blocks unmocked provider routes before any protected request", async () => {
  let handler: ((route: Route) => Promise<void>) | undefined;
  const context = { route: async (_pattern: string, callback: typeof handler) => { handler = callback; } } as unknown as BrowserContext;
  await installProtectedPreviewTransport(context, configuration);
  assert.ok(handler);
  for (const path of ["/api/event-agent", "/api/event-agent/", "/api/qloo/search", "/api/qloo/rank"]) {
    let fulfilled = false;
    const route = {
      request: () => ({ url: () => `${origin}${path}` }),
      fulfill: async (options: { status: number; json: { error: { code: string } } }) => {
        fulfilled = true;
        assert.equal(options.status, 503);
        assert.equal(options.json.error.code, "CONTROLLED_TEST");
        assert.equal(JSON.stringify(options).includes(secret), false);
      },
    } as unknown as Route;
    await handler(route);
    assert.equal(fulfilled, true);
  }
});

test("default local and unrelated-origin asset requests retain ordinary routing", async () => {
  for (const settings of [undefined, configuration]) {
    let handler: ((route: Route) => Promise<void>) | undefined;
    const context = { route: async (_pattern: string, callback: typeof handler) => { handler = callback; } } as unknown as BrowserContext;
    await installProtectedPreviewTransport(context, settings);
    let fellBack = false;
    await handler!({
      request: () => ({ url: () => "http://localhost:3000/_next/example.js" }),
      fallback: async () => { fellBack = true; },
    } as unknown as Route);
    assert.equal(fellBack, true);
  }
});
