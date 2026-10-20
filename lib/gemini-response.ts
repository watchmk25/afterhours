type RecordValue = Record<string, unknown>;
const record = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const kind = (value: unknown) => value === null ? "null" : Array.isArray(value) ? "array" : typeof value;

export type GeminiResponseIssue = { path: string; expected: string; observed: string };

/** Stateless responses may omit the interaction resource ID. Native function
 * call IDs remain mandatory in the agent, which never uses resource IDs. */
export function geminiResponseIssue(value: unknown): GeminiResponseIssue | undefined {
  const issue = (path: string, expected: string, observed: unknown) => ({ path, expected, observed: kind(observed) });
  if (!record(value)) return issue("$", "object", value);
  if (value.id !== undefined) {
    if (typeof value.id !== "string") return issue("$.id", "nonempty string when supplied", value.id);
    if (!value.id || value.id.length > 512) return { path: "$.id.length", expected: "1..512 characters when supplied", observed: String(value.id.length) };
  }
  if (typeof value.status !== "string") return issue("$.status", "string", value.status);
  if (!Array.isArray(value.steps)) return issue("$.steps", "array", value.steps);
  if (value.steps.length > 64) return { path: "$.steps.length", expected: "at most 64", observed: String(value.steps.length) };
  for (const [index, step] of value.steps.entries()) {
    if (!record(step)) return issue(`$.steps[${index}]`, "object", step);
    if (typeof step.type !== "string") return issue(`$.steps[${index}].type`, "string", step.type);
  }
}

/** Structural metadata only. Never copy content, argument values, IDs or signatures. */
export function inspectGeminiResponse(value: unknown, model: string, httpStatus: number, phase: "wire" | "sdk", privateValues: readonly string[] = []) {
  const safeName = (name: string) => privateValues.some(secret => secret && name.includes(secret)) || !/^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/.test(name)
    ? "[redacted name]" : name;
  const shape = (item: unknown) => ({ type: kind(item), ...(typeof item === "string" && !privateValues.some(secret => secret && item.includes(secret)) ? { length: item.length } : {}) });
  const object = record(value) ? value : {};
  const knownStatuses = ["requires_action", "completed", "incomplete", "in_progress", "failed", "cancelled", "queued"];
  const knownTypes = ["thought", "function_call", "function_result", "model_output", "user_input", "text", "code_execution_call", "google_search_call"];
  const steps = Array.isArray(object.steps) ? object.steps : [];
  // Read the documented convenience property directly, including non-enumerable getters.
  let outputText: unknown;
  try { outputText = object.output_text; } catch { outputText = undefined; }
  return {
    phase, httpStatus, model,
    topLevelKeys: Object.keys(object).slice(0, 32).map(safeName),
    interactionStatus: typeof object.status === "string" && knownStatuses.includes(object.status) ? object.status : kind(object.status),
    id: shape(object.id), stepsType: kind(object.steps), legacyOutputsType: kind(object.outputs),
    stepCount: steps.length,
    steps: steps.slice(0, 64).map((step) => {
      const item = record(step) ? step : {};
      const content = Array.isArray(item.content) ? item.content : [];
      return {
        type: typeof item.type === "string" && knownTypes.includes(item.type) ? item.type : "[unrecognized]",
        ...(item.type === "function_call" ? {
          functionName: typeof item.name === "string" ? safeName(item.name) : kind(item.name),
          callIdPresent: typeof item.id === "string" && !!item.id, callId: shape(item.id),
          argumentsType: kind(item.arguments),
          argumentKeys: record(item.arguments) ? Object.keys(item.arguments).slice(0, 16).map(safeName) : [],
        } : {}),
        signaturePresent: typeof item.signature === "string" && !!item.signature,
        ...(item.type === "model_output" ? {
          contentType: kind(item.content),
          textParts: content.slice(0, 16).filter(part => record(part) && part.type === "text").map(part => shape(part.text)),
        } : {}),
      };
    }),
    finalText: shape(outputText),
    blocking: { errorsPresent: Array.isArray(object.errors) && object.errors.length > 0,
      incomplete: object.status === "incomplete", failed: object.status === "failed" },
    ...(geminiResponseIssue(value) ? { rejection: geminiResponseIssue(value) } : {}),
  };
}

export type GeminiResponseSnapshot = ReturnType<typeof inspectGeminiResponse>;
