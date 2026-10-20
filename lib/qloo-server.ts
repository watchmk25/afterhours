import "server-only";
import { createHmac } from "node:crypto";
import { createQlooService } from "./qloo-service.ts";

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
  const result = await service[operation](input);
  return Response.json(result.body, { status: result.status, headers });
}
