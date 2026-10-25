export type GeminiDiagnostic = {
  stage: "http_response";
  httpStatus: number;
  providerCode?: string | number;
  providerStatus?: string;
  explanation: string;
  parameterPaths: string[];
  reasons: string[];
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Interpret the documented Interactions error envelope, never an SDK exception.
 * Only the returned allowlisted, bounded summary may be logged server-side. */
export function summarizeGeminiError(
  payload: unknown, httpStatus: number, privateValues: readonly string[],
): GeminiDiagnostic {
  const secrets = new Set(privateValues.filter(Boolean));
  // Error details can themselves contain credential fields. Never copy those
  // objects; also remove their values if repeated in an otherwise useful message.
  function collect(value: unknown, depth = 0, sensitive = false) {
    if (depth > 6 || !value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value).slice(0, 64)) {
      const privateField = sensitive || /key|token|secret|authorization|credential|password|prompt|headers?/i.test(key);
      if (privateField && typeof child === "string" && child) secrets.add(child);
      else collect(child, depth + 1, privateField);
    }
  }
  collect(payload);
  function clean(value: string, limit = 600) {
    // The transport already bounds the complete envelope. Redact before
    // truncation so a credential crossing the output boundary cannot leak.
    let text = value;
    for (const secret of [...secrets].sort((a, b) => b.length - a.length)) text = text.split(secret).join("[redacted]");
    return text
      .replace(/https?:\/\/[^\s<>"']+/gi, "[URL redacted]")
      .replace(/(?:bearer\s+|(?:x-goog-api-key|api[_ -]?key|token|secret|authorization|password)\s*[:=]\s*)[^\s,;]+/gi, "[credential redacted]")
      .replace(/[A-Za-z0-9_+\/-]{24,}={0,2}/g, "[token redacted]")
      .replace(/["'`]([^"'`\n]*)["'`]/g, (quoted, content: string) => /^[a-zA-Z_][\w.\[\]-]{0,100}$/.test(content) ? quoted : "[quoted value redacted]")
      .replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit);
  }
  const error = record(payload) && record(payload.error) ? payload.error : undefined;
  const safeIdentifier = (value: unknown) => typeof value === "string" && /^[a-zA-Z_][a-zA-Z0-9_.-]{0,79}$/.test(value)
    ? clean(value, 80) : undefined;
  const parameterPaths = new Set<string>();
  const reasons = new Set<string>();
  // Also recognize Google RPC BadRequest/ErrorInfo details when actually supplied.
  function details(value: unknown, depth = 0) {
    if (depth > 5 || !value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value).slice(0, 64)) {
      if ((key === "field" || key === "parameter") && typeof child === "string" && /^[\w.\[\]-]{1,120}$/.test(child)) parameterPaths.add(clean(child, 120));
      if (key === "reason") { const reason = safeIdentifier(child); if (reason) reasons.add(reason); }
      if (key !== "metadata") details(child, depth + 1);
    }
  }
  details(error);
  const message = typeof error?.message === "string" ? clean(error.message) : undefined;
  // Native Interactions commonly includes the offending path in its message.
  for (const match of message?.matchAll(/(?:at|parameter|field)\s+['"`]([\w.\[\]-]{1,120})['"`]/g) ?? []) parameterPaths.add(match[1]);
  const providerCode = typeof error?.code === "number" && Number.isInteger(error.code) && error.code >= 100 && error.code <= 599
    ? error.code : safeIdentifier(error?.code);
  const providerStatus = safeIdentifier(error?.status);
  return {
    stage: "http_response", httpStatus,
    ...(providerCode === undefined ? {} : { providerCode }),
    ...(providerStatus === undefined ? {} : { providerStatus }),
    explanation: message || "No bounded JSON provider explanation was available.",
    parameterPaths: [...parameterPaths].slice(0, 8), reasons: [...reasons].slice(0, 8),
  };
}
