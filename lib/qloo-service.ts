import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SAMPLE_CATALOGUE } from "./catalogue.ts";
import { QLOO_PRESETS, SAMPLE_QLOO_MAPPINGS } from "./qloo-sample.ts";
import type {
  InterestKind, InterestReference, QlooContribution, QlooError, QlooInterest,
  QlooRankResponse, QlooSearchResponse,
} from "./qloo-types.ts";
import type { Book, FilterInputs } from "./types.ts";
import { catalogueLanguages, filterBooks, validateFilters } from "./workspace.ts";

const origin = "https://hackathon.api.qloo.com";
const maximumResponseBytes = 1024 * 1024;
const maximumInputBytes = 8 * 1024;
const tokenLifetime = 30 * 60 * 1000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const controlCharacters = /[\u0000-\u001f\u007f-\u009f]/u;
type JsonRecord = Record<string, unknown>;
export type QlooServiceResult<T> = { status: number; body: T };
type ServiceOptions = {
  credential?: string;
  fetcher?: typeof fetch;
  signingKey?: string | Uint8Array;
  now?: () => number;
  timeoutMs?: number;
  minimumCandidates?: 1 | 2;
};

export type QlooPreparedRanking = {
  filters: FilterInputs;
  interests: QlooInterest[];
  eligible: Book[];
  supported: Book[];
};

class ServiceError extends Error {
  status: number;
  code: string;
  upstreamStatus?: number;
  constructor(status: number, code: string, message: string, upstreamStatus?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function exactKeys(value: JsonRecord, required: string[], optional: string[] = []): boolean {
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}

function invalid(message = "Check the request fields and try again."): never {
  throw new ServiceError(400, "INVALID_INPUT", message);
}

function schemaError(): never {
  throw new ServiceError(502, "QLOO_RESPONSE_INVALID", "Qloo returned an unsupported response. No substitute ranking was used.");
}

function boundedInput(value: unknown): JsonRecord {
  let serialized;
  try { serialized = JSON.stringify(value); } catch { invalid(); }
  if (typeof serialized !== "string" || Buffer.byteLength(serialized) > maximumInputBytes) invalid();
  return record(value) ?? invalid();
}

function validText(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !controlCharacters.test(value);
}

function validateFilterInput(value: unknown): FilterInputs {
  const input = record(value);
  if (!input || !exactKeys(input, ["maxPrice", "maxPages", "languages"]) ||
    typeof input.maxPrice !== "string" || input.maxPrice.length > 32 ||
    typeof input.maxPages !== "string" || input.maxPages.length > 32 ||
    !Array.isArray(input.languages) || input.languages.length > 3 ||
    input.languages.some((language) => typeof language !== "string") ||
    new Set(input.languages).size !== input.languages.length) invalid("Choose valid price, page, and sample-catalogue language filters.");
  const filters: FilterInputs = {
    maxPrice: input.maxPrice, maxPages: input.maxPages, languages: input.languages as string[],
  };
  if (Object.keys(validateFilters(filters, catalogueLanguages(SAMPLE_CATALOGUE))).length) invalid("Choose valid price, page, and sample-catalogue language filters.");
  return filters;
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) schemaError();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumResponseBytes) schemaError();
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text.replace(/^\uFEFF/u, ""));
  } catch {
    void reader.cancel().catch(() => {});
    return schemaError();
  } finally {
    reader.releaseLock();
  }
}

function upstreamError(status: number): never {
  if (status === 401) throw new ServiceError(502, "QLOO_AUTHENTICATION_FAILED", "Qloo did not accept the configured server credential.", status);
  if (status === 403) throw new ServiceError(502, "QLOO_ACCESS_DENIED", "Qloo refused access to this request.", status);
  if (status === 429) throw new ServiceError(429, "QLOO_RATE_LIMITED", "Qloo's request limit was reached. Try again later.", status);
  if (status >= 300 && status < 400) throw new ServiceError(502, "QLOO_REDIRECT_BLOCKED", "Qloo redirected the request. The redirect was not followed.", status);
  throw new ServiceError(502, "QLOO_UPSTREAM_FAILED", "Qloo could not complete this request. No substitute result was used.", status);
}

function failure(error: unknown): QlooServiceResult<{ ok: false; error: QlooError }> {
  const safe = error instanceof ServiceError ? error :
    new ServiceError(502, "QLOO_UNAVAILABLE", "Qloo could not complete this request. Raw diagnostic details are withheld.");
  return { status: safe.status, body: { ok: false, error: {
    code: safe.code, message: safe.message,
    ...(safe.upstreamStatus === undefined ? {} : { upstreamStatus: safe.upstreamStatus }),
  } } };
}

function normalizedId(value: unknown): string {
  return typeof value === "string" && uuid.test(value) ? value.toUpperCase() : schemaError();
}

function explanationScores(value: unknown, interests: ReadonlySet<string>, scoreKey: "score" | "avg_score"): QlooContribution[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) schemaError();
  const used = new Set<string>();
  return value.flatMap((item) => {
    const row = record(item);
    if (!row || typeof row.entity_id !== "string" || !uuid.test(row.entity_id)) return [];
    const id = row.entity_id.toUpperCase();
    if (!interests.has(id)) return [];
    const score = row[scoreKey];
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) return [];
    if (used.has(id)) schemaError();
    used.add(id);
    return [{ interestId: id, score }];
  });
}

function hasWarning(value: unknown): boolean {
  const object = record(value);
  return !!object && ["warning", "warnings"].some((key) => object[key] !== undefined && object[key] !== null && object[key] !== "");
}

/** Pure server-domain factory. Tests inject a fetcher and never need a real key. */
export function createQlooService({
  credential = "", fetcher = fetch, signingKey = randomBytes(32), now = Date.now, timeoutMs = 10_000,
  minimumCandidates = 2,
}: ServiceOptions = {}) {
  const key = credential.trim();
  const timeout = Number.isInteger(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 10_000) : 10_000;
  const text = (value: string, maximum = 200) => value.split(key || "\0").join("[redacted]")
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").trim().slice(0, maximum);
  const sign = (payload: string) => createHmac("sha256", signingKey).update(payload).digest();
  const signedReference = (interest: Omit<QlooInterest, "reference">): InterestReference => {
    const payload = Buffer.from(JSON.stringify({ ...interest, expiresAt: now() + tokenLifetime })).toString("base64url");
    return { token: `${payload}.${sign(payload).toString("base64url")}` };
  };
  const resolveReference = (input: unknown): QlooInterest => {
    const reference = record(input);
    if (!reference) invalid("Confirm a film or musician from the available choices.");
    if (exactKeys(reference, ["preset", "index"])) {
      if ((reference.preset !== "a" && reference.preset !== "b") || (reference.index !== 0 && reference.index !== 1)) invalid();
      const interest = QLOO_PRESETS.find((preset) => preset.id === reference.preset)?.interests[reference.index];
      return interest ? structuredClone(interest) : invalid();
    }
    if (!exactKeys(reference, ["token"]) || typeof reference.token !== "string" || reference.token.length > 2048 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(reference.token)) invalid("Confirm the interest again; its reference is invalid or expired.");
    const [payload, signature] = reference.token.split(".");
    const expected = sign(payload);
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) invalid("Confirm the interest again; its reference is invalid or expired.");
    let claim;
    try { claim = record(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); } catch { invalid(); }
    if (!claim || !exactKeys(claim, ["entityId", "name", "kind", "expiresAt"], ["disambiguation"]) ||
      typeof claim.entityId !== "string" || !uuid.test(claim.entityId) || !validText(claim.name, 200) ||
      (claim.kind !== "movie" && claim.kind !== "artist") ||
      (claim.disambiguation !== undefined && !validText(claim.disambiguation, 200)) ||
      typeof claim.expiresAt !== "number" || !Number.isSafeInteger(claim.expiresAt) ||
      claim.expiresAt <= now() || claim.expiresAt > now() + tokenLifetime) invalid("Confirm the interest again; its reference is invalid or expired.");
    return { entityId: claim.entityId.toUpperCase(), name: claim.name, kind: claim.kind,
      ...(claim.disambiguation === undefined ? {} : { disambiguation: claim.disambiguation }), reference: { token: reference.token } };
  };

  function prepareRanking(value: unknown): QlooPreparedRanking {
    const input = boundedInput(value);
    if (!exactKeys(input, ["catalogueSource", "filters", "interests"]) || input.catalogueSource !== "sample") invalid("Live Qloo matching currently supports the sample catalogue only.");
    const filters = validateFilterInput(input.filters);
    if (!Array.isArray(input.interests) || input.interests.length < 1 || input.interests.length > 5) invalid("Confirm between one and five films or musicians.");
    const unique = new Map<string, QlooInterest>();
    for (const reference of input.interests) {
      const interest = resolveReference(reference);
      if (!unique.has(interest.entityId)) unique.set(interest.entityId, interest);
    }
    const eligible = filterBooks(SAMPLE_CATALOGUE, filters);
    const supported = eligible.filter((book) => Object.hasOwn(SAMPLE_QLOO_MAPPINGS, book.id));
    if (supported.length < minimumCandidates) throw new ServiceError(400, "INSUFFICIENT_SUPPORTED_BOOKS",
      minimumCandidates === 1
        ? "No eligible books have reviewed Qloo matches. Widen the filters or restore the sample catalogue."
        : "At least two eligible books with reviewed Qloo matches are needed. Widen the filters to continue.");
    return { filters, interests: [...unique.values()], eligible, supported };
  }

  async function request(path: "/search" | "/v2/insights", params: Record<string, string | number | boolean>, externalSignal?: AbortSignal): Promise<JsonRecord> {
    if (!key) throw new ServiceError(503, "QLOO_NOT_CONFIGURED", "Qloo is not configured on this server. Sample filtering and event templates remain available.");
    const cancelled = () => new ServiceError(499, "QLOO_CANCELLED", "The Qloo request was cancelled.");
    if (externalSignal?.aborted) throw cancelled();
    const url = new URL(path, origin);
    for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    let onCancel: (() => void) | undefined;
    const cancellation = new Promise<never>((_resolve, reject) => {
      if (externalSignal) {
        onCancel = () => reject(cancelled());
        externalSignal.addEventListener("abort", onCancel, { once: true });
      }
    });
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ServiceError(504, "QLOO_TIMEOUT", "Qloo did not respond within 10 seconds. No retry was attempted."));
      }, timeout);
    });
    try {
      return await Promise.race([(async () => {
        const response = await fetcher(url, {
          method: "GET", headers: { "X-Api-Key": key, Accept: "application/json" },
          signal: externalSignal ? AbortSignal.any([controller.signal, externalSignal]) : controller.signal,
          cache: "no-store", redirect: "manual",
        });
        if (!response.ok) {
          void response.body?.cancel().catch(() => {});
          upstreamError(response.status);
        }
        const body = record(await boundedJson(response));
        if (!body || body.success === false) schemaError();
        return body;
      })(), deadline, cancellation]);
    } catch (error) {
      if (externalSignal?.aborted) throw cancelled();
      if (error instanceof ServiceError) throw error;
      if (timedOut) throw new ServiceError(504, "QLOO_TIMEOUT", "Qloo did not respond within 10 seconds. No retry was attempted.");
      throw new ServiceError(502, "QLOO_UNAVAILABLE", "Qloo could not be reached. No retry or substitute result was used.");
    } finally {
      clearTimeout(timer);
      if (onCancel) externalSignal?.removeEventListener("abort", onCancel);
    }
  }

  return {
    prepareRank(value: unknown): QlooServiceResult<({ ok: true } & QlooPreparedRanking) | { ok: false; error: QlooError }> {
      try { return { status: 200, body: { ok: true, ...prepareRanking(value) } }; }
      catch (error) { return failure(error); }
    },
    async search(value: unknown, signal?: AbortSignal): Promise<QlooServiceResult<QlooSearchResponse>> {
      try {
        const input = boundedInput(value);
        if (!exactKeys(input, ["query", "kind"]) || !validText(input.query, 100) ||
          (input.kind !== "movie" && input.kind !== "artist")) invalid("Enter a film or musician name of 1 to 100 characters.");
        const kind: InterestKind = input.kind;
        const body = await request("/search", { query: input.query.trim(), types: `urn:entity:${kind}`, take: 3 }, signal);
        if (!Array.isArray(body.results) || body.results.length > 3) schemaError();
        const used = new Set<string>();
        const candidates = body.results.map((item): QlooInterest => {
          const candidate = record(item);
          if (!candidate || !validText(candidate.name, 500) || !Array.isArray(candidate.types) ||
            !candidate.types.includes(`urn:entity:${kind}`)) schemaError();
          const entityId = normalizedId(candidate.entity_id);
          if (used.has(entityId)) schemaError();
          used.add(entityId);
          const disambiguation = typeof candidate.disambiguation === "string" ? text(candidate.disambiguation) : "";
          const interest = { entityId, name: text(candidate.name), kind, ...(disambiguation ? { disambiguation } : {}) };
          if (!interest.name) schemaError();
          return { ...interest, reference: signedReference(interest) };
        });
        return { status: 200, body: { ok: true, candidates } };
      } catch (error) { return failure(error); }
    },

    async rank(value: unknown, signal?: AbortSignal): Promise<QlooServiceResult<QlooRankResponse>> {
      try {
        const { eligible, supported, interests } = prepareRanking(value);
        const mappings = new Map(supported.map((book) => [SAMPLE_QLOO_MAPPINGS[book.id].toUpperCase(), book.id]));
        const confirmed = new Set(interests.map((interest) => interest.entityId));
        const body = await request("/v2/insights", {
          "filter.type": "urn:entity:book", "filter.results.entities": [...mappings.keys()].join(","),
          "signal.interests.entities": [...confirmed].join(","), sort_by: "affinity",
          "feature.explainability": true, take: supported.length,
        }, signal);
        const results = record(body.results);
        if (!results || !Array.isArray(results.entities) || results.entities.length > supported.length) schemaError();
        const returned = new Set<string>();
        const explanationWarnings = new Set<string>();
        const providerWarning = "Qloo reported an explanation warning. Numerical contributions may be incomplete.";
        if (hasWarning(body)) explanationWarnings.add(providerWarning);
        const ranked = results.entities.map((item) => {
          const entity = record(item);
          if (!entity) schemaError();
          const id = normalizedId(entity.entity_id);
          const localId = mappings.get(id);
          if (!localId || returned.has(id) || (entity.types !== undefined &&
            (!Array.isArray(entity.types) || !entity.types.includes("urn:entity:book")))) schemaError();
          returned.add(id);
          const query = record(entity.query);
          const explainability = record(query?.explainability);
          if (hasWarning(explainability)) explanationWarnings.add(providerWarning);
          const contributions = explanationScores(explainability?.["signal.interests.entities"], confirmed, "score");
          const rawAffinity = query?.affinity;
          return { localId, affinity: typeof rawAffinity === "number" && Number.isFinite(rawAffinity) ? rawAffinity : null, contributions };
        });
        const query = record(body.query);
        const explainability = record(query?.explainability);
        if (hasWarning(explainability)) explanationWarnings.add(providerWarning);
        const effects = record(explainability?.["signal.interests.entities"]);
        const aggregate = explanationScores(effects?.effect_on_all_recs, confirmed, "avg_score")
          .map(({ interestId, score }) => ({ interestId, avgScore: score }));
        if (ranked.some((book) => book.contributions.length === 0)) explanationWarnings.add("Qloo did not return numerical contributions for every assessed book.");
        if (ranked.length && aggregate.length === 0) explanationWarnings.add("Qloo did not return aggregate contribution metadata.");
        const unassessed = eligible.flatMap((book): { localId: string; reason: "unresolved" | "not_returned" }[] => {
          const mapping = SAMPLE_QLOO_MAPPINGS[book.id];
          return !mapping ? [{ localId: book.id, reason: "unresolved" }] :
            returned.has(mapping.toUpperCase()) ? [] : [{ localId: book.id, reason: "not_returned" }];
        });
        return { status: 200, body: { ok: true, ranked, eligibleCount: eligible.length,
          supportedCount: supported.length, assessedCount: ranked.length, unassessed, interests,
          aggregate, explanationWarnings: [...explanationWarnings] } };
      } catch (error) { return failure(error); }
    },
  };
}
