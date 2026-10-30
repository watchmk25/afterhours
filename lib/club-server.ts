import "server-only";
import { createHmac } from "node:crypto";
import { createClubQloo } from "./club-qloo.ts";
import { CLUB_CONTINUATION_LIMIT_MS, createClubAgent } from "./club-agent.ts";
import { createGeminiProvider } from "./gemini-provider.ts";
import { parseClubInput } from "./club-validation.ts";
import { admitGeminiRequest, admitRequestUsage } from "./usage-runtime.ts";
import { runWithUsage } from "./usage-run.ts";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const reject = (status: number, code: string, message: string) => Response.json({ ok: false, error: { code, message }, trace: [], usage: { geminiRequests: 0, qlooRequests: 0 } }, { status, headers });

export function createRuntimeClubQloo() {
  const credential = process.env.QLOO_API_KEY ?? "";
  return createClubQloo({ credential, signingKey: createHmac("sha256", credential).update("AfterHours cultural references v1").digest() });
}

/** No fixture switch exists in the public server. Tests inject or intercept transports. */
export async function handleClubRequest(request: Request, operation: "search" | "discover" | "plan") {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin !== null && requestOrigin !== new URL(request.url).origin) return reject(403, "INVALID_ORIGIN", "Use the AfterHours workspace for this action.");
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return reject(415, "INVALID_REQUEST", "Send this request as JSON.");
  const limit = operation === "search" ? 4096 : 48 * 1024;
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > limit)) return reject(413, "INPUT_LIMIT", "The request exceeds its bounded size.");
  const reader = request.body?.getReader();
  if (!reader) return reject(400, "INVALID_INPUT", "Provide a JSON request.");
  const cancelRead = () => { void reader.cancel().catch(() => {}); };
  let expired = false;
  const readTimer = setTimeout(() => { expired = true; cancelRead(); }, 5000);
  request.signal.addEventListener("abort", cancelRead, { once: true });
  let value: unknown;
  try {
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      if (request.signal.aborted) return reject(499, "REQUEST_CANCELLED", "The action was cancelled; your edits are unchanged.");
      const chunk = await reader.read();
      if (expired) return reject(408, "BODY_TIMEOUT", "The request body timed out.");
      if (request.signal.aborted) return reject(499, "REQUEST_CANCELLED", "The action was cancelled; your edits are unchanged.");
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { cancelRead(); return reject(413, "INPUT_LIMIT", "The request exceeds its bounded size."); }
      chunks.push(chunk.value);
    }
    value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch { return reject(400, "INVALID_INPUT", "The request must contain valid UTF-8 JSON."); }
  finally { clearTimeout(readTimer); request.signal.removeEventListener("abort", cancelRead); reader.releaseLock(); }

  const qloo = createRuntimeClubQloo();
  const parsed = operation === "search" ? qloo.prepareSearch(value) : qloo.prepare(value);
  const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const makeAgent = (overallTimeoutMs: number) => createClubAgent({
    qloo, geminiConfigured: !!geminiKey, qlooConfigured: !!process.env.QLOO_API_KEY?.trim(), overallTimeoutMs,
    thinkingLevel: model === "gemini-3.5-flash-lite" ? "minimal" : "low", beforeGemini: admitGeminiRequest,
    ...(geminiKey ? { gemini: createGeminiProvider({ apiKey: geminiKey, model, maxRequestTimeoutMs: CLUB_CONTINUATION_LIMIT_MS,
      onDiagnostic: (diagnostic) => console.error("[AfterHours Gemini]", JSON.stringify(diagnostic)),
    }) } : {}),
  });
  // Validation, clarification, manual routing and absent credentials dispatch no providers or store calls.
  const input = operation === "search" ? null : parseClubInput(value);
  if (!parsed.body.ok || !process.env.QLOO_API_KEY?.trim() || operation === "plan" && (!geminiKey || !input?.ok)) {
    if (operation === "plan") {
      const result = await makeAgent(30_000).run(value, request.signal);
      return Response.json(result.body, { status: result.status, headers });
    }
    const result = parsed.body.ok ? await qloo[operation === "search" ? "search" : "discover"](value as never, request.signal) : parsed;
    return Response.json(result.body, { status: result.status, headers });
  }

  const controller = new AbortController();
  const stop = () => controller.abort();
  request.signal.addEventListener("abort", stop, { once: true });
  if (request.signal.aborted) stop();
  const started = performance.now();
  const overall = operation === "plan" ? 30_000 : 11_000;
  let runExpired = false;
  const timer = setTimeout(() => { runExpired = true; stop(); }, overall);
  const guardedRequest = new Request(request.url, { method: "POST", headers: request.headers, signal: controller.signal });
  try {
    const result = await runWithUsage(() => admitRequestUsage(guardedRequest, operation === "plan" ? "event" : operation === "search" ? "search" : "rank"), controller.signal, async () => {
      if (operation === "plan") return makeAgent(Math.max(1, overall - (performance.now() - started))).run(value, controller.signal);
      return operation === "search" ? qloo.search(value, controller.signal) : qloo.discover(value as never, controller.signal);
    });
    if (!result.ok) return Response.json({ ok: false, error: runExpired ? { code: "RUN_TIMEOUT", message: "This action reached its overall deadline. Existing event edits are unchanged." } : result.error, trace: [], usage: result.workStarted ? null : { geminiRequests: 0, qlooRequests: 0 } }, {
      status: runExpired ? 504 : result.error.status, headers: { ...headers, ...(result.error.retryAfterSeconds ? { "Retry-After": String(result.error.retryAfterSeconds) } : {}) },
    });
    const response = result.value;
    return Response.json(response.body, { status: response.status, headers: { ...headers,
      ...(!response.body.ok && response.body.error.retryAfterSeconds ? { "Retry-After": String(response.body.error.retryAfterSeconds) } : {}),
    } });
  } finally { clearTimeout(timer); request.signal.removeEventListener("abort", stop); }
}
