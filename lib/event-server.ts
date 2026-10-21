import "server-only";
import { createEventAgent } from "./event-agent.ts";
import { MAX_EVENT_INPUT_BYTES, parseEventInput } from "./event-validation.ts";
import { createGeminiProvider } from "./gemini-provider.ts";
import { createRuntimeQlooService } from "./qloo-server.ts";
import { admitRequestUsage } from "./usage-runtime.ts";
import { runWithUsage } from "./usage-run.ts";

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
function rejected(status: number, message: string) {
  return Response.json({ ok: false, error: { code: "INVALID_REQUEST", message }, trace: [], usage: { geminiRequests: 0, qlooRequests: 0 } }, { status, headers });
}

export async function handleEventRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== new URL(request.url).origin) return rejected(403, "Use the AfterHours workspace to request a proposal.");
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") return rejected(415, "Send the event request as JSON.");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_EVENT_INPUT_BYTES)) return rejected(413, "The event request exceeds 16 KiB.");
  const reader = request.body?.getReader();
  if (!reader) return rejected(400, "Provide a JSON event request.");
  let bodyExpired = false;
  const cancelRead = () => { void reader.cancel().catch(() => {}); };
  const bodyTimer = setTimeout(() => { bodyExpired = true; cancelRead(); }, 5000);
  request.signal.addEventListener("abort", cancelRead, { once: true });
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let bytes = 0;
  let value: unknown;
  try {
    while (true) {
      if (request.signal.aborted) return rejected(499, "The event request was cancelled.");
      const part = await reader.read();
      if (bodyExpired) return rejected(408, "The event request body exceeded its five-second deadline.");
      if (request.signal.aborted) return rejected(499, "The event request was cancelled.");
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_EVENT_INPUT_BYTES) {
        void reader.cancel().catch(() => {});
        return rejected(413, "The event request exceeds 16 KiB.");
      }
      text += decoder.decode(part.value, { stream: true });
    }
    value = JSON.parse(text + decoder.decode());
  } catch { return rejected(400, "The event request must contain valid JSON."); }
  finally {
    clearTimeout(bodyTimer);
    request.signal.removeEventListener("abort", cancelRead);
    reader.releaseLock();
  }
  // Explicit key avoids GOOGLE_API_KEY precedence; no credential enters client props.
  const geminiKey = (process.env.GEMINI_API_KEY ?? "").trim();
  const geminiModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const qlooConfigured = !!process.env.QLOO_API_KEY?.trim();
  const geminiConfigured = !!geminiKey.trim();
  const qloo = createRuntimeQlooService(1);
  const agent = createEventAgent({ geminiConfigured, qlooConfigured,
    thinkingLevel: geminiModel === "gemini-3.5-flash-lite" ? "minimal" : "low",
    ...(geminiConfigured ? { gemini: createGeminiProvider({ apiKey: geminiKey, model: geminiModel,
      onDiagnostic: (diagnostic) => console.error("[AfterHours Gemini]", JSON.stringify(diagnostic)),
      onResponse: (snapshot) => console.info("[AfterHours Gemini response]", JSON.stringify(snapshot)),
    }) } : {}),
    qloo,
  });
  // Reuse the existing pure preflight before reserving the conservative maximum.
  // Early validation/clarification/configuration failures cannot call providers.
  const parsed = parseEventInput(value);
  if (!parsed.ok || !geminiConfigured || !qlooConfigured || !qloo.prepareRank({
    catalogueSource: "sample", filters: parsed.input.filters, interests: parsed.input.interests,
  }).body.ok) {
    const result = await agent.run(value, request.signal);
    return Response.json(result.body, { status: result.status, headers });
  }
  const guarded = await runWithUsage(() => admitRequestUsage(request, "event"), request.signal,
    () => agent.run(value, request.signal));
  // An in-flight cancellation can win before the agent returns its accounting.
  // Unknown actual dispatch counts must not be presented as zero requests.
  if (!guarded.ok) return Response.json({ ok: false, error: guarded.error, trace: [], usage: guarded.workStarted ? null : { geminiRequests: 0, qlooRequests: 0 } }, {
    status: guarded.error.status, headers: { ...headers,
      ...(guarded.error.retryAfterSeconds ? { "Retry-After": String(guarded.error.retryAfterSeconds) } : {}),
    },
  });
  const result = guarded.value;
  return Response.json(result.body, { status: result.status, headers });
}
