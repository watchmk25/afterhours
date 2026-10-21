import "server-only";
import { createUsageControl, type UsageAdmission, type UsageOperation } from "./usage-control.ts";
import { createRedisUsageStore } from "./usage-redis.ts";
import { usageVisitor } from "./usage-identity.ts";

export async function admitRequestUsage(request: Request, operation: UsageOperation): Promise<UsageAdmission> {
  if (process.env.AFTERHOURS_LIVE_ENABLED !== "true") return { ok: false, error: {
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
