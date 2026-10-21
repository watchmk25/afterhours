import { randomUUID } from "node:crypto";

export type UsageOperation = "search" | "rank" | "event";
export type UsageRejection = {
  status: 429 | 503 | 499;
  code: string;
  message: string;
  retryAfterSeconds?: number;
};

export type UsageAdmission = { ok: true; leaseId?: string; release(): Promise<void> } | { ok: false; error: UsageRejection };

export interface UsageStore {
  evaluate(script: string, keys: readonly string[], args: readonly (string | number)[], signal?: AbortSignal): Promise<unknown>;
}

export const USAGE_DEFAULTS = Object.freeze({
  visitorWindowSeconds: 3600,
  visitorSearches: 12,
  visitorRankings: 6,
  visitorEvents: 6,
  globalWindowSeconds: 86400,
  globalQlooRequests: 100,
  globalGeminiRequests: 90,
  concurrentEvents: 2,
  leaseSeconds: 45,
});

// One Redis operation checks every allowance before changing counters. Redis TIME
// provides the shared lease clock; no process-local clock or counter grants access.
export const USAGE_ADMISSION_LUA = `
local operation, lease = ARGV[1], ARGV[2]
local visitorWindow, globalWindow, leaseMillis = tonumber(ARGV[3]), tonumber(ARGV[4]), tonumber(ARGV[5])
local visitorLimit, qlooLimit, geminiLimit, concurrency = tonumber(ARGV[6]), tonumber(ARGV[7]), tonumber(ARGV[8]), tonumber(ARGV[9])
local qlooCost, geminiCost = tonumber(ARGV[10]), tonumber(ARGV[11])
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000.0 + math.floor(tonumber(clock[2]) / 1000)
redis.call('ZREMRANGEBYSCORE', KEYS[3], '-inf', now)
local function retryFor(key, fallback)
  local ttl = redis.call('TTL', key)
  if ttl < 0 then return fallback end
  return math.max(1, ttl)
end
if tonumber(redis.call('HGET', KEYS[1], operation) or '0') + 1 > visitorLimit then
  return {0, 'visitor', retryFor(KEYS[1], visitorWindow)}
end
if tonumber(redis.call('HGET', KEYS[2], 'qloo') or '0') + qlooCost > qlooLimit then
  return {0, 'qloo', retryFor(KEYS[2], globalWindow)}
end
if tonumber(redis.call('HGET', KEYS[2], 'gemini') or '0') + geminiCost > geminiLimit then
  return {0, 'gemini', retryFor(KEYS[2], globalWindow)}
end
if operation == 'event' and redis.call('ZCARD', KEYS[3]) >= concurrency then
  local first = redis.call('ZRANGE', KEYS[3], 0, 0, 'WITHSCORES')
  return {0, 'busy', math.max(1, math.ceil((tonumber(first[2]) - now) / 1000))}
end
redis.call('HINCRBY', KEYS[1], operation, 1)
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], visitorWindow) end
redis.call('HINCRBY', KEYS[2], 'qloo', qlooCost)
redis.call('HINCRBY', KEYS[2], 'gemini', geminiCost)
if redis.call('TTL', KEYS[2]) < 0 then redis.call('EXPIRE', KEYS[2], globalWindow) end
if operation == 'event' then
  redis.call('ZADD', KEYS[3], now + leaseMillis, lease)
  redis.call('PEXPIRE', KEYS[3], leaseMillis)
end
return {1}
`;

export const USAGE_RELEASE_LUA = "return redis.call('ZREM', KEYS[1], ARGV[1])";

function unavailable(): UsageRejection {
  return { status: 503, code: "USAGE_UNAVAILABLE", message: "Live services are temporarily unavailable because usage protection could not be checked. Please try again shortly." };
}

function cancelled(): UsageRejection {
  return { status: 499, code: "REQUEST_CANCELLED", message: "The request was cancelled. Existing edits are unchanged." };
}

export function createUsageControl({ store, namespace = "afterhours:usage:v1" }: { store: UsageStore; namespace?: string }) {
  if (!/^[a-zA-Z0-9:_-]{1,100}$/.test(namespace)) throw new Error("Invalid usage namespace.");
  const globalKey = `${namespace}:global`;
  const leasesKey = `${namespace}:leases`;

  return {
    async admit(visitorHash: string, operation: UsageOperation, signal?: AbortSignal): Promise<UsageAdmission> {
      const reject = (error: UsageRejection) => ({ ok: false as const, error });
      if (signal?.aborted) return reject(cancelled());
      if (!/^[a-f0-9]{64}$/.test(visitorHash) || !["search", "rank", "event"].includes(operation)) return reject(unavailable());
      const leaseId = operation === "event" ? randomUUID() : undefined;
      let releaseStarted = false;
      const release = async () => {
        if (!leaseId || releaseStarted) return;
        releaseStarted = true;
        try {
          // Cleanup must still run after caller cancellation. A store failure is
          // safe: Redis expires this lease independently after at most 45 seconds.
          await store.evaluate(USAGE_RELEASE_LUA, [leasesKey], [leaseId]);
        } catch { /* Expiring leases bound failed cleanup; never grant extra work. */ }
      };
      try {
        const visitorLimit = operation === "search" ? USAGE_DEFAULTS.visitorSearches : operation === "rank" ? USAGE_DEFAULTS.visitorRankings : USAGE_DEFAULTS.visitorEvents;
        const result = await store.evaluate(USAGE_ADMISSION_LUA,
          [`${namespace}:visitor:${visitorHash}`, globalKey, leasesKey],
          [operation, leaseId ?? "", USAGE_DEFAULTS.visitorWindowSeconds, USAGE_DEFAULTS.globalWindowSeconds,
            USAGE_DEFAULTS.leaseSeconds * 1000, visitorLimit, USAGE_DEFAULTS.globalQlooRequests,
            USAGE_DEFAULTS.globalGeminiRequests, USAGE_DEFAULTS.concurrentEvents, 1, operation === "event" ? 3 : 0], signal);
        if (signal?.aborted) {
          await release();
          return reject(cancelled());
        }
        if (Array.isArray(result) && result.length === 1 && result[0] === 1) return { ok: true as const, ...(leaseId ? { leaseId } : {}), release };
        if (Array.isArray(result) && result.length === 3 && result[0] === 0 && ["visitor", "qloo", "gemini", "busy"].includes(result[1]) && Number.isInteger(result[2]) && result[2] > 0 && result[2] <= USAGE_DEFAULTS.globalWindowSeconds) {
          const busy = result[1] === "busy";
          return reject({ status: 429, code: busy ? "USAGE_BUSY" : "USAGE_LIMITED", message: busy
            ? `The event planner is busy. Wait ${result[2]} seconds before trying again. Existing edits are unchanged.`
            : `The demo's live request allowance has been reached. Wait ${result[2]} seconds before trying again. Browsing and manual planning remain available.`, retryAfterSeconds: result[2] });
        }
        // Unexpected store output cannot authorize a provider request.
        await release();
        return reject(unavailable());
      } catch {
        // Admission may have committed even if its response was lost. Attempt
        // own-lease cleanup without refunding conservative provider reservations.
        await release();
        return reject(signal?.aborted ? cancelled() : unavailable());
      }
    },
  };
}
