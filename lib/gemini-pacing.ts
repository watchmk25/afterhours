import { randomUUID } from "node:crypto";
import type { UsageRejection, UsageStore } from "./usage-control.ts";

export const GEMINI_PACING_LIMIT = 12;
export const GEMINI_PACING_WINDOW_MS = 60_000;

// Provider calls across all instances share a true rolling window, using Redis's
// clock. Members contain random reservation IDs only; cancellations are not refunded.
export const GEMINI_PACING_LUA = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000.0 + math.floor(tonumber(clock[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - 60000)
if redis.call('ZCARD', KEYS[1]) >= 12 then
  local first = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  return {0, math.max(1, math.ceil((tonumber(first[2]) + 60000 - now) / 1000))}
end
redis.call('ZADD', KEYS[1], now, ARGV[1])
redis.call('PEXPIRE', KEYS[1], 60000)
return {1}
`;

export type GeminiPacingAdmission = { ok: true } | { ok: false; error: UsageRejection };

export function createGeminiPacing({ store, namespace = "afterhours:usage:v1" }: { store: UsageStore; namespace?: string }) {
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(namespace)) throw new Error("Invalid usage namespace.");
  const cancelled = (): GeminiPacingAdmission => ({ ok: false, error: { status: 499, code: "REQUEST_CANCELLED", message: "The planning request was cancelled. Existing edits are unchanged." } });
  const unavailable = (): GeminiPacingAdmission => ({ ok: false, error: { status: 503, code: "USAGE_UNAVAILABLE", message: "Live planning is temporarily unavailable because shared request pacing could not be checked. Please try again shortly. Existing edits are unchanged." } });

  return {
    async admit(signal?: AbortSignal): Promise<GeminiPacingAdmission> {
      if (signal?.aborted) return cancelled();
      let onAbort: (() => void) | undefined;
      const interrupted = new Promise<never>((_resolve, reject) => {
        onAbort = () => reject(new Error("Pacing cancelled."));
        signal?.addEventListener("abort", onAbort, { once: true });
      });
      try {
        const result = await Promise.race([
          store.evaluate(GEMINI_PACING_LUA, [`${namespace}:gemini-rpm`], [randomUUID()], signal), interrupted,
        ]);
        if (signal?.aborted) return cancelled();
        if (Array.isArray(result) && result.length === 1 && result[0] === 1) return { ok: true };
        if (Array.isArray(result) && result.length === 2 && result[0] === 0 && Number.isInteger(result[1]) && result[1] >= 1 && result[1] <= GEMINI_PACING_WINDOW_MS / 1000) {
          return { ok: false, error: { status: 429, code: "GEMINI_PACING_LIMIT", retryAfterSeconds: result[1],
            message: `The shared live planner is at its short-term request limit. Wait ${result[1]} seconds before trying again. Your current edits remain available.` } };
        }
        return unavailable();
      } catch { return signal?.aborted ? cancelled() : unavailable(); }
      finally { if (onAbort) signal?.removeEventListener("abort", onAbort); }
    },
  };
}
