import { stripVTControlCharacters } from "node:util";

const origin = "https://hackathon.api.qloo.com";
const maximumBodyBytes = 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const blockedMessage = "AfterHours feasibility check blocked an unexpected or additional request.";

function invalidPlan() {
  throw new Error("AfterHours feasibility request plan is invalid.");
}

function idList(value, maximum) {
  if (typeof value !== "string") return false;
  const ids = value.split(",");
  return ids.length > 0 && ids.length <= maximum && ids.every((id) => uuid.test(id)) &&
    new Set(ids.map((id) => id.toLowerCase())).size === ids.length;
}

function validatedPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan) ||
    Object.keys(plan).some((key) => key !== "path" && key !== "params") ||
    !plan.params || typeof plan.params !== "object" || Array.isArray(plan.params)) invalidPlan();
  const entries = Object.entries(plan.params);
  if (entries.some(([key, value]) => !key || !["string", "number", "boolean"].includes(typeof value) ||
    (typeof value === "number" && !Number.isFinite(value)))) invalidPlan();
  const params = Object.fromEntries(entries.map(([key, value]) => [key, String(value)]));
  const positiveInteger = (value, maximum) => /^[1-9]\d*$/.test(value ?? "") && Number(value) <= maximum;
  if (plan.path === "/search") {
    if (entries.length !== 3 || Object.keys(params).some((key) => !["query", "types", "take"].includes(key)) ||
      typeof plan.params.query !== "string" || !params.query.trim() || params.query.length > 256 ||
      /[\u0000-\u001f\u007f]/u.test(params.query) ||
      !["urn:entity:book", "urn:entity:movie", "urn:entity:artist"].includes(params.types) ||
      !positiveInteger(params.take, 3)) invalidPlan();
  } else if (plan.path === "/v2/insights") {
    const allowed = ["filter.type", "filter.results.entities", "signal.interests.entities", "take", "sort_by", "feature.explainability"];
    if (Object.keys(params).some((key) => !allowed.includes(key)) || params["filter.type"] !== "urn:entity:book" ||
      !idList(params["filter.results.entities"], 50) || !idList(params["signal.interests.entities"], 10) ||
      !positiveInteger(params.take, 50) || Number(params.take) > params["filter.results.entities"].split(",").length ||
      (params.sort_by !== undefined && params.sort_by !== "affinity") ||
      (params["feature.explainability"] !== undefined && !["true", "false"].includes(params["feature.explainability"]))) invalidPlan();
  } else {
    invalidPlan();
  }
  return { path: plan.path, params };
}

async function readBody(response) {
  const clone = response.clone();
  const reader = clone.body?.getReader();
  if (!reader) throw new Error("AfterHours feasibility response did not contain JSON.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBodyBytes) throw new Error("AfterHours feasibility response exceeded the 1 MiB limit.");
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text.replace(/^\uFEFF/u, ""));
  } catch {
    // Cancelling one branch of a cloned response can wait for the other branch.
    void reader.cancel().catch(() => {});
    throw new Error("AfterHours feasibility response was oversized, unreadable, or invalid JSON.");
  } finally {
    reader.releaseLock();
  }
}

/**
 * Guard one explicit request while leaving the official harness responsible for
 * authentication and API handling. Callbacks never receive request headers.
 */
export function createPlanFetch(fetchImplementation, plan, onDispatch, onResponse) {
  const expected = validatedPlan(plan);
  let used = false;
  return async (input, init = {}) => {
    let target;
    try { target = new URL(input); } catch { throw new Error(blockedMessage); }
    const query = [...target.searchParams];
    if (used || target.origin !== origin || target.pathname !== expected.path ||
      target.username || target.password || target.hash || init.method !== "GET" ||
      query.length !== Object.keys(expected.params).length ||
      Object.entries(expected.params).some(([key, value]) => target.searchParams.getAll(key).length !== 1 || target.searchParams.get(key) !== value)) {
      throw new Error(blockedMessage);
    }
    used = true;
    let response;
    try {
      onDispatch();
      response = await fetchImplementation(input, { ...init, redirect: "manual" });
    } catch {
      throw new Error("AfterHours feasibility transport failed; raw details withheld.");
    }
    let body;
    try {
      body = await readBody(response);
    } catch {
      void response.body?.cancel().catch(() => {});
      try { onResponse({ httpStatus: response.status, body: null }); } catch { /* No raw callback errors. */ }
      throw new Error("AfterHours feasibility response was oversized, unreadable, or invalid JSON.");
    }
    try { onResponse({ httpStatus: response.status, body }); } catch {
      throw new Error("AfterHours feasibility response capture failed; raw details withheld.");
    }
    return response;
  };
}

export function sanitizePayload(value, credential) {
  const secret = typeof credential === "string" ? credential : "";
  const clean = (text) => stripVTControlCharacters(secret ? text.split(secret).join("[redacted]") : text);
  const seen = new WeakSet();
  const visit = (item, depth = 0) => {
    if (typeof item === "string") return clean(item);
    if (item === null || typeof item !== "object") return item;
    if (depth >= 30) return "[detail omitted]";
    if (seen.has(item)) return "[circular]";
    seen.add(item);
    if (Array.isArray(item)) return item.map((entry) => visit(entry, depth + 1));
    return Object.fromEntries(Object.entries(item).map(([key, entry]) => [
      clean(key),
      /apikey|authorization|credential|token|secret/i.test(key.replace(/[^a-z0-9]/gi, ""))
        ? "[redacted]" : visit(entry, depth + 1),
    ]));
  };
  return visit(value);
}

if (Object.hasOwn(process.env, "AFTERHOURS_QLOO_FEASIBILITY_PLAN")) {
  let plan;
  try {
    const serialized = process.env.AFTERHOURS_QLOO_FEASIBILITY_PLAN;
    if (!serialized || Buffer.byteLength(serialized) > 16 * 1024) invalidPlan();
    plan = JSON.parse(serialized);
  } catch {
    invalidPlan();
  }
  globalThis.fetch = createPlanFetch(globalThis.fetch, plan,
    () => process.send?.({ kind: "dispatch" }),
    (event) => process.send?.({
      kind: "response", httpStatus: event.httpStatus,
      body: sanitizePayload(event.body, process.env.QLOO_API_KEY),
    }));
}
