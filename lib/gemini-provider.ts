import { GoogleGenAI } from "@google/genai";
import type { Interactions } from "@google/genai";
import { summarizeGeminiError, type GeminiDiagnostic } from "./gemini-diagnostics.ts";

// The pinned SDK exports this request shape as ParamsNonStreaming.
export type GeminiTurn = Omit<
  Interactions.CreateModelInteractionParamsNonStreaming,
  "model" | "store" | "stream" | "background"
>;

export type GeminiProvider = {
  create(turn: GeminiTurn, signal: AbortSignal): Promise<Interactions.Interaction>;
};

export type GeminiProviderErrorCode =
  | "GEMINI_AUTH"
  | "GEMINI_ACCESS"
  | "GEMINI_QUOTA"
  | "GEMINI_TRANSPORT"
  | "GEMINI_MODEL_UNAVAILABLE"
  | "GEMINI_REQUEST_REJECTED"
  | "GEMINI_BAD_RESPONSE"
  | "GEMINI_DEADLINE"
  | "GEMINI_CANCELLED";

const messages: Record<GeminiProviderErrorCode, string> = {
  GEMINI_AUTH: "Gemini credentials are missing or were rejected.",
  GEMINI_ACCESS: "Gemini access was denied for this request.",
  GEMINI_QUOTA: "Gemini's request or quota limit was reached.",
  GEMINI_TRANSPORT: "Gemini could not complete the connection.",
  GEMINI_MODEL_UNAVAILABLE: "The configured Gemini model is unavailable.",
  GEMINI_REQUEST_REJECTED: "Gemini rejected this request. Check the API key's access, model configuration, and supported request settings before trying again.",
  GEMINI_BAD_RESPONSE: "Gemini returned an unsupported or oversized response.",
  GEMINI_DEADLINE: "Gemini did not complete within the request deadline.",
  GEMINI_CANCELLED: "The Gemini request was cancelled.",
};

/** Only these fixed messages and optional numeric status may leave this boundary. */
export class GeminiProviderError extends Error {
  readonly code: GeminiProviderErrorCode;
  readonly upstreamStatus?: number;

  constructor(code: GeminiProviderErrorCode, upstreamStatus?: number) {
    super(messages[code]);
    this.name = "GeminiProviderError";
    this.code = code;
    if (Number.isInteger(upstreamStatus) && upstreamStatus! >= 100 && upstreamStatus! <= 599) {
      this.upstreamStatus = upstreamStatus;
    }
  }
}

const origin = "https://generativelanguage.googleapis.com";
const endpoint = "/v1beta/interactions";
const maximumRequestBytes = 128 * 1024;
const maximumResponseBytes = 256 * 1024;
const maximumDeadlineMs = 20_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stopReading(stream: ReadableStream<Uint8Array> | null) {
  if (stream) void stream.cancel().catch(() => {});
}

async function readBounded(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
  signal: AbortSignal,
  checkStopped: () => void,
) {
  if (!stream) return new Uint8Array();
  const reader = stream.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    checkStopped();
    while (true) {
      const { done, value } = await reader.read();
      checkStopped();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        cancel();
        throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

function errorForStatus(status: number) {
  const code: GeminiProviderErrorCode = status === 401 ? "GEMINI_AUTH"
    : status === 403 ? "GEMINI_ACCESS"
      : status === 429 ? "GEMINI_QUOTA"
        : status === 404 ? "GEMINI_MODEL_UNAVAILABLE"
          : status === 400 ? "GEMINI_REQUEST_REJECTED"
          : status >= 500 || status === 408 ? "GEMINI_TRANSPORT"
            : "GEMINI_BAD_RESPONSE";
  return new GeminiProviderError(code, status);
}

/** Credentials are supplied by the server entry, never discovered from the environment here. */
export function createGeminiProvider({
  apiKey,
  model = "gemini-3.8-flash",
  fetcher = globalThis.fetch,
  timeoutMs = maximumDeadlineMs,
  onDiagnostic,
}: {
  apiKey: string;
  model?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
  onDiagnostic?: (diagnostic: GeminiDiagnostic) => void;
}): GeminiProvider {
  return {
    async create(turn, signal) {
      if (!apiKey.trim()) throw new GeminiProviderError("GEMINI_AUTH");
      if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw new GeminiProviderError("GEMINI_MODEL_UNAVAILABLE");
      const controller = new AbortController();
      let expired = false;
      let dispatched = false;
      const deadline = Number.isFinite(timeoutMs) && timeoutMs > 0
        ? Math.min(timeoutMs, maximumDeadlineMs) : maximumDeadlineMs;
      const abortFromCaller = () => { controller.abort(); };
      signal.addEventListener("abort", abortFromCaller, { once: true });
      if (signal.aborted) controller.abort();
      const timer = setTimeout(() => { expired = true; controller.abort(); }, deadline);
      const stoppedError = () => new GeminiProviderError(
        signal.aborted ? "GEMINI_CANCELLED" : "GEMINI_DEADLINE",
      );
      const checkStopped = () => {
        if (controller.signal.aborted) throw stoppedError();
      };
      let abortListener: (() => void) | undefined;
      const aborted = new Promise<never>((_, reject) => {
        abortListener = () => { reject(stoppedError()); };
        controller.signal.addEventListener("abort", abortListener, { once: true });
      });

      const guardedFetch: typeof fetch = async (input, init) => {
        checkStopped();
        if (dispatched) throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
        // Mark the SDK invocation before any asynchronous validation, so even a
        // concurrent second transport invocation cannot pass the one-fetch guard.
        dispatched = true;
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (url.origin !== origin || url.pathname !== endpoint || url.search || url.hash
          || url.username || url.password || request.method !== "POST"
          || request.headers.get("x-goog-api-key") !== apiKey
          || request.headers.has("authorization")) {
          stopReading(request.body);
          throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
        }
        const bytes = await readBounded(request.body, maximumRequestBytes, controller.signal, checkStopped);
        checkStopped();
        let response: Response;
        try {
          response = await fetcher(new Request(request, {
            body: bytes,
            signal: controller.signal,
            redirect: "manual",
            cache: "no-store",
          }), { signal: controller.signal, redirect: "manual", cache: "no-store" });
        } catch {
          checkStopped();
          throw new GeminiProviderError("GEMINI_TRANSPORT");
        }
        if (controller.signal.aborted) {
          stopReading(response.body);
          checkStopped();
        }
        if (response.redirected || response.status !== 200) {
          let payload: unknown;
          // Retain only a redacted summary, not raw errors, headers or bodies.
          // A rejection body has a smaller bound and the same whole-turn deadline.
          try {
            if (!response.redirected && response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() === "application/json") {
              const body = await readBounded(response.body, 16 * 1024, controller.signal, checkStopped);
              payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
            } else stopReading(response.body);
          } catch { checkStopped(); }
          const privateValues = [apiKey, ...(typeof turn.input === "string" ? [turn.input] : [])];
          function collectText(value: unknown, depth = 0) {
            if (depth > 12 || !value || typeof value !== "object") return;
            for (const [key, child] of Object.entries(value)) {
              if ((key === "text" || key === "system_instruction") && typeof child === "string") {
                privateValues.push(child);
                // The planner embeds the organizer request inside a JSON text
                // step. A provider may echo that field without its JSON wrapper.
                try {
                  const content: unknown = JSON.parse(child);
                  if (isRecord(content) && typeof content.organizerRequest === "string") privateValues.push(content.organizerRequest);
                } catch { /* Ordinary non-JSON text is already private above. */ }
              }
              else collectText(child, depth + 1);
            }
          }
          collectText(turn);
          const diagnostic = summarizeGeminiError(payload, response.status, privateValues);
          try { onDiagnostic?.(diagnostic); } catch { /* Diagnostics cannot change the public failure. */ }
          throw errorForStatus(response.status);
        }
        if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
          stopReading(response.body);
          throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
        }
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumResponseBytes)) {
          stopReading(response.body);
          throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
        }
        const body = await readBounded(response.body, maximumResponseBytes, controller.signal, checkStopped);
        checkStopped();
        let parsed: unknown;
        try {
          parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
        } catch {
          throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
        }
        if (!isRecord(parsed) || typeof parsed.id !== "string" || !parsed.id || parsed.id.length > 512
          || typeof parsed.status !== "string" || !Array.isArray(parsed.steps)
          || parsed.steps.length > 64 || parsed.steps.some((step) => !isRecord(step) || typeof step.type !== "string")) {
          throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
        }
        // Supply only bounded JSON and the content type to the SDK. Provider
        // headers and raw transport errors never become our public errors.
        return new Response(body, { status: 200, headers: { "Content-Type": "application/json" } });
      };

      try {
        checkStopped();
        const client = new GoogleGenAI({
          apiKey,
          enterprise: false,
          vertexai: false,
          apiVersion: "v1beta",
          httpOptions: { baseUrl: origin, timeout: deadline, fetch: guardedFetch },
        });
        const operation = client.interactions.create({
          ...turn,
          model,
          store: false,
          stream: false,
          background: false,
        }, {
          retries: { strategy: "none" },
          timeout_ms: deadline,
          signal: controller.signal,
          redirect: "manual",
        });
        const interaction = await Promise.race([operation, aborted]);
        checkStopped();
        return interaction;
      } catch (error) {
        if (signal.aborted || expired) throw stoppedError();
        if (error instanceof GeminiProviderError) throw error;
        // The SDK may wrap a guarded-fetch error. Recover only our closed,
        // fixed-message error type from the cause chain, never raw messages.
        let current: unknown = error;
        for (let depth = 0; depth < 5 && isRecord(current); depth++) {
          if (current instanceof GeminiProviderError) throw current;
          current = current.cause;
        }
        throw new GeminiProviderError("GEMINI_BAD_RESPONSE");
      } finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abortFromCaller);
        if (abortListener) controller.signal.removeEventListener("abort", abortListener);
      }
    },
  };
}
