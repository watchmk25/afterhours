import type { UsageStore } from "./usage-control.ts";

const MAXIMUM_RESPONSE_BYTES = 16 * 1024;
export const USAGE_STORE_TIMEOUT_MS = 1000;

/** Minimal REST transport: no SDK retry, timeout fallback, or availability bypass. */
export function createRedisUsageStore({ url, token, fetcher = fetch, timeoutMs = USAGE_STORE_TIMEOUT_MS }: {
  url: string;
  token: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): UsageStore {
  let origin: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || !/^[a-z0-9-]+\.upstash\.io$/.test(parsed.hostname) || parsed.username || parsed.password || parsed.port || parsed.search || parsed.hash || parsed.pathname !== "/") throw new Error();
    origin = parsed.origin;
  } catch { throw new Error("Usage store configuration is invalid."); }
  if (!token || token.trim() !== token || /[\r\n]/.test(token) || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > USAGE_STORE_TIMEOUT_MS) throw new Error("Usage store configuration is invalid.");

  return {
    async evaluate(script, keys, args, signal) {
      if (signal?.aborted) throw new Error("Usage operation cancelled.");
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      const deadline = new Promise<never>((_, reject) => {
        const fail = () => {
          controller.abort();
          reject(new Error("Usage store operation did not complete."));
        };
        timer = setTimeout(fail, timeoutMs);
        onAbort = fail;
        signal?.addEventListener("abort", onAbort, { once: true });
      });
      const operation = async () => {
        const response = await fetcher(origin, {
          method: "POST", redirect: "manual", cache: "no-store", signal: controller.signal,
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify(["EVAL", script, keys.length, ...keys, ...args]),
        });
        if (signal?.aborted || controller.signal.aborted || !response.ok) throw new Error("Usage store operation failed.");
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Usage store returned an invalid response.");
        const decoder = new TextDecoder();
        let bytes = 0;
        let text = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (signal?.aborted || controller.signal.aborted) throw new Error("Usage store operation cancelled.");
            if (done) break;
            bytes += value.byteLength;
            if (bytes > MAXIMUM_RESPONSE_BYTES) {
              void reader.cancel().catch(() => {});
              throw new Error("Usage store response exceeded its limit.");
            }
            text += decoder.decode(value, { stream: true });
          }
        } finally { reader.releaseLock(); }
        let body: unknown;
        try { body = JSON.parse(text + decoder.decode()); } catch { throw new Error("Usage store returned an invalid response."); }
        if (!body || typeof body !== "object" || Array.isArray(body) || !("result" in body) || "error" in body) throw new Error("Usage store returned an invalid response.");
        return (body as { result: unknown }).result;
      };
      try {
        return await Promise.race([operation(), deadline]);
      } catch {
        // Never expose upstream error bodies, request headers, URLs, or tokens.
        throw new Error("Usage store operation failed.");
      } finally {
        if (timer !== undefined) clearTimeout(timer);
        if (onAbort) signal?.removeEventListener("abort", onAbort);
      }
    },
  };
}
