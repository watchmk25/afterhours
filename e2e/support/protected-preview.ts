import type { BrowserContext } from "@playwright/test";

type PreviewAuthenticationHeader = "x-vercel-protection-bypass" | "x-vercel-trusted-oidc-idp-token";
export type ProtectedPreview = { origin: string; secret: string; headerName?: PreviewAuthenticationHeader };
type TransportResponse = { status: number; headers: Record<string, string>; body: Buffer };
const maximumResponseBytes = 8 * 1024 * 1024;
const safeFailure = "Protected preview transport failed. Check the target and authorized Preview access.";

/** Process-only configuration: never copy this object into Playwright use/config. */
export function protectedPreview(environment: Record<string, string | undefined> = process.env): ProtectedPreview | undefined {
  const bypassSecret = environment.VERCEL_AUTOMATION_BYPASS_SECRET;
  const oidcToken = environment.PLAYWRIGHT_VERCEL_OIDC_TOKEN;
  if (bypassSecret !== undefined && oidcToken !== undefined) {
    throw new Error("Protected Preview access requires exactly one process-only authorization method.");
  }
  const secret = oidcToken ?? bypassSecret;
  if (secret === undefined) return undefined;
  let target: URL;
  try { target = new URL(environment.PLAYWRIGHT_BASE_URL ?? ""); }
  catch { throw new Error("Protected Preview access requires an explicit HTTPS vercel.app origin."); }
  if (target.protocol !== "https:" || !target.hostname.endsWith(".vercel.app") ||
    target.username || target.password || target.pathname !== "/" || target.search || target.hash || target.port ||
    !secret.trim() || secret.length > 4096 || /[\u0000-\u001f\u007f]/u.test(secret)) {
    throw new Error("Protected Preview access requires an explicit HTTPS vercel.app origin and a valid process-only secret.");
  }
  return { origin: target.origin, secret,
    ...(oidcToken === undefined ? {} : { headerName: "x-vercel-trusted-oidc-idp-token" as const }) };
}

function redactedBytes(body: Buffer, secret: string): Buffer {
  let result = body;
  for (const value of new Set([secret, encodeURIComponent(secret)])) {
    const needle = Buffer.from(value);
    if (!needle.length) continue;
    const chunks: Buffer[] = [];
    let start = 0;
    let found: number;
    while ((found = result.indexOf(needle, start)) >= 0) {
      chunks.push(result.subarray(start, found), Buffer.from("[redacted]"));
      start = found + needle.length;
    }
    if (start) result = Buffer.concat([...chunks, result.subarray(start)]);
  }
  return result;
}

/** Node fetch owns the authorization header; Playwright never sees its value. */
export async function fetchProtectedPreview(configuration: ProtectedPreview, target: string, options: {
  method?: string; headers?: Record<string, string>; body?: Buffer; timeoutMs?: number; fetcher?: typeof fetch;
} = {}): Promise<TransportResponse> {
  let url: URL;
  try { url = new URL(target); } catch { throw new Error(safeFailure); }
  if (url.origin !== configuration.origin || url.username || url.password) throw new Error(safeFailure);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(options.timeoutMs ?? 40_000, 40_000));
  try {
    const headers = new Headers();
    const allowed = new Set(["accept", "content-type", "range", "rsc", "next-router-state-tree", "next-router-prefetch", "next-router-segment-prefetch", "next-url"]);
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      if (name.toLowerCase() === "origin") {
        if (value !== configuration.origin) throw new Error(safeFailure);
        headers.set("origin", value);
      }
      if (allowed.has(name.toLowerCase())) headers.set(name, value);
    }
    headers.set(configuration.headerName ?? "x-vercel-protection-bypass", configuration.secret);
    const response = await (options.fetcher ?? fetch)(url, {
      method: options.method ?? "GET", headers,
      ...(options.body ? { body: Uint8Array.from(options.body) } : {}),
      redirect: "manual", signal: controller.signal,
    });
    const reader = response.body?.getReader();
    const chunks: Buffer[] = [];
    let bytes = 0;
    if (reader) {
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > maximumResponseBytes) { void reader.cancel().catch(() => {}); throw new Error(safeFailure); }
          chunks.push(Buffer.from(part.value));
        }
      } finally { reader.releaseLock(); }
    }
    const returnedHeaders: Record<string, string> = {};
    const withheld = new Set(["set-cookie", "content-encoding", "content-length", "x-vercel-protection-bypass", "x-vercel-trusted-oidc-idp-token", "authorization"]);
    response.headers.forEach((value, name) => {
      if (!withheld.has(name.toLowerCase()) && !value.includes(configuration.secret) && !value.includes(encodeURIComponent(configuration.secret))) returnedHeaders[name] = value;
    });
    return { status: response.status, headers: returnedHeaders, body: redactedBytes(Buffer.concat(chunks), configuration.secret) };
  } catch { throw new Error(safeFailure); }
  finally { clearTimeout(timeout); }
}

/** Page-level controlled mocks take precedence over this context-level safety net. */
export async function installProtectedPreviewTransport(context: BrowserContext, configuration?: ProtectedPreview) {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (/^\/api\/(?:qloo(?:\/|$)|event-agent(?:\/|$))/u.test(url.pathname)) {
      await route.fulfill({ status: 503, json: { ok: false, error: { code: "CONTROLLED_TEST", message: "Unmocked provider requests are blocked by the regression runner." } } });
      return;
    }
    if (!configuration || url.origin !== configuration.origin) { await route.fallback(); return; }
    try {
      const response = await fetchProtectedPreview(configuration, request.url(), {
        method: request.method(), headers: await request.allHeaders(), body: request.postDataBuffer() ?? undefined,
      });
      await route.fulfill(response);
    } catch { await route.abort("failed").catch(() => {}); }
  });
}
