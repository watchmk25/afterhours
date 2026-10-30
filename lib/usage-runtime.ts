import "server-only";
import { createUsageControl, type UsageAdmission, type UsageOperation } from "./usage-control.ts";
import { createRedisUsageStore, USAGE_STORE_TIMEOUT_MS } from "./usage-redis.ts";
import { usageVisitor } from "./usage-identity.ts";
import { createGeminiPacing } from "./gemini-pacing.ts";
import type { BeforeGemini } from "./event-agent.ts";
import { liveWorkEnabled } from "./live-switch.ts";

/** Each model dispatch is paced against the same store, within the run's budget. */
export const admitGeminiRequest: BeforeGemini = async (signal, remainingMs) => {
  if (signal.aborted) return { ok: false, error: { status: 499, code: "REQUEST_CANCELLED", message: "The planning request was cancelled. Your event edits are unchanged." } };
  const unavailable = { ok: false as const, error: { status: 503 as const, code: "USAGE_UNAVAILABLE",
    message: "Shared Gemini request pacing is unavailable. Try again later; your event edits are unchanged.",
  } };
  if (!Number.isFinite(remainingMs) || remainingMs < 1) return unavailable;
  try {
    const store = createRedisUsageStore({ url: process.env.UPSTASH_REDIS_REST_URL ?? "", token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
      timeoutMs: Math.min(USAGE_STORE_TIMEOUT_MS, Math.floor(remainingMs)),
    });
    return await createGeminiPacing({ store }).admit(signal);
  } catch { return unavailable; }
};

export async function admitRequestUsage(request: Request, operation: UsageOperation): Promise<UsageAdmission> {
  if (!liveWorkEnabled()) return { ok: false, error: {
    status: 503, code: "LIVE_DISABLED", message: "Live matching and planning are paused by the organizer. Browsing, CSV filters, manual templates, and your current event edits remain available.",
  } };
  const unavailable: UsageAdmission = { ok: false, error: { status: 503, code: "USAGE_UNAVAILABLE",
    message: "Shared usage controls are not available. No live work was started. Try again later; local browsing and your event edits remain available.",
  } };
  const visitor = usageVisitor(request, { VERCEL: process.env.VERCEL, AFTERHOURS_USAGE_SECRET: process.env.AFTERHOURS_USAGE_SECRET });
  if (!visitor) return unavailable;
  try {
    const store = createRedisUsageStore({ url: process.env.UPSTASH_REDIS_REST_URL ?? "", token: process.env.UPSTASH_REDIS_REST_TOKEN ?? "" });
    return await createUsageControl({ store }).admit(visitor, operation, request.signal);
  } catch { return unavailable; }
}
