import "server-only";
import { createHmac } from "node:crypto";
import { createQlooService, type QlooServiceResult } from "./qloo-service.ts";
import type { QlooRankResponse, QlooSearchResponse } from "./qloo-types.ts";
import { admitRequestUsage } from "./usage-runtime.ts";
import { runWithUsage } from "./usage-run.ts";

const maximumRequestBytes = 8 * 1024;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

function requestFailure(status: number, message: string) {
  return Response.json({ ok: false, error: { code: "INVALID_REQUEST", message } }, { status, headers });
}

export function createRuntimeQlooService(minimumCandidates: 1 | 2 = 2) {
  const credential = process.env.QLOO_API_KEY ?? "";
  const signingKey = createHmac("sha256", credential).update("AfterHours interest references v1").digest();
  return createQlooService({ credential, signingKey, minimumCandidates });
}

/** Next.js loads the server's ignored .env.local; credentials never enter client props. */
export async function handleQlooRequest(request: Request, operation: "search" | "rank") {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin !== null && requestOrigin !== new URL(request.url).origin) {
    return requestFailure(403, "This request must come from the AfterHours workspace.");
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return requestFailure(415, "Send the request as JSON.");
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumRequestBytes)) {
    return requestFailure(413, "The request exceeds the 8 KiB limit.");
  }
  let input: unknown;
  const reader = request.body?.getReader();
  if (!reader) return requestFailure(400, "Send a JSON request body.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumRequestBytes) {
        void reader.cancel().catch(() => {});
        return requestFailure(413, "The request exceeds the 8 KiB limit.");
      }
      text += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(text + decoder.decode());
  } catch {
    return requestFailure(400, "The request body must contain valid JSON.");
  } finally {
    reader.releaseLock();
  }
  // Search and rank can run in separate server instances. Derive the private
  // signing key consistently without configuring or exposing another secret.
  const service = createRuntimeQlooService();
  const prepared = operation === "search" ? service.prepareSearch(input) : service.prepareRank(input);
  if (!prepared.body.ok) return Response.json(prepared.body, { status: prepared.status, headers });
  // Invalid inputs and missing provider keys do not consume shared allowances.
  if (!process.env.QLOO_API_KEY?.trim()) {
    const result = await service[operation](input, request.signal);
    return Response.json(result.body, { status: result.status, headers });
  }
  const guarded = await runWithUsage<QlooServiceResult<QlooSearchResponse | QlooRankResponse>>(() => admitRequestUsage(request, operation), request.signal,
    () => service[operation](input, request.signal));
  if (!guarded.ok) return Response.json({ ok: false, error: guarded.error }, {
    status: guarded.error.status, headers: { ...headers,
      ...(guarded.error.retryAfterSeconds ? { "Retry-After": String(guarded.error.retryAfterSeconds) } : {}),
    },
  });
  const result = guarded.value;
  return Response.json(result.body, { status: result.status, headers });
}
