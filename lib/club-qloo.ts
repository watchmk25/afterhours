import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SAMPLE_CATALOGUE } from "./catalogue.ts";
import { QLOO_PRESETS, SAMPLE_QLOO_MAPPINGS } from "./qloo-sample.ts";
import { parseClubInput } from "./club-validation.ts";
import { CULTURAL_KINDS } from "./club-types.ts";
import type { ClubCandidate, ClubDiscovery, ClubInput, ClubResource, ClubResult, ConstraintAssessment, CulturalEntity, CulturalKind, CulturalMetadata, EntityReference, ResourceFacts } from "./club-types.ts";

const ORIGIN = "https://hackathon.api.qloo.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_TTL = 30 * 60 * 1000;
const MAX_RESPONSE_BYTES = 1024 * 1024;
type Obj = Record<string, unknown>;
type Prepared = { input: ClubInput; kind: CulturalKind; interests: CulturalEntity[]; resources: ClubResource[]; selected: CulturalEntity | null };
type Search = { query: string; kind?: CulturalKind; externalId?: ClubResource["externalId"] };
class QlooFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly upstreamStatus?: number;
  constructor(status: number, code: string, message: string, upstreamStatus?: number) {
    super(message); this.status = status; this.code = code; this.upstreamStatus = upstreamStatus;
  }
}
const object = (value: unknown): Obj | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Obj : null;
const keys = (value: Obj, required: string[], optional: string[] = []) => required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => [...required, ...optional].includes(key));
const kindOf = (value: unknown): value is CulturalKind => CULTURAL_KINDS.includes(value as CulturalKind);
const validText = (value: unknown, max = 200): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
function invalid(message = "Check the gathering inputs and confirm the intended cultural entities."): never { throw new QlooFailure(400, "INVALID_INPUT", message); }
function badResponse(): never { throw new QlooFailure(502, "QLOO_RESPONSE_INVALID", "Qloo returned unsupported or inconsistent entity data. No substitute result was used."); }
function failure<T>(error: unknown): ClubResult<T> {
  const safe = error instanceof QlooFailure ? error : new QlooFailure(502, "QLOO_UNAVAILABLE", "Qloo could not complete this request. No retry or substitute result was used.");
  return { status: safe.status, body: { ok: false, error: { code: safe.code, message: safe.message, ...(safe.upstreamStatus === undefined ? {} : { upstreamStatus: safe.upstreamStatus }) } } };
}
function normalizeId(value: unknown) { return typeof value === "string" && UUID.test(value) ? value.toUpperCase() : badResponse(); }

/** No arbitrary image proxy, credentials, query parameters, or redirect-capable browser URLs. */
export function safeCulturalImage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 700) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && ["images.qloo.com", "staging.images.qloo.com"].includes(url.hostname) &&
      !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/i\/[A-Za-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) return url.href;
  } catch { /* An absent image is a supported state. */ }
}

function relevantKind(input: ClubInput): CulturalKind {
  if (input.format === "manual") throw new QlooFailure(400, "MANUAL_PLANNING", "Use the organizer-led template below. No cultural recommendation is claimed for this route.");
  if (input.format !== "auto") return input.format;
  const goal = input.goal.toLowerCase();
  const matches: CulturalKind[] = [];
  if (/\b(?:book|books|reading|literature|novel|literary)\b/u.test(goal)) matches.push("book");
  if (/\b(?:music|musical|listening|musician|artist|artists|concert|playlist)\b/u.test(goal)) matches.push("artist");
  if (/\b(?:film|films|movie|movies|cinema|screening)\b/u.test(goal)) matches.push("movie");
  if (/\b(?:venue|restaurant|cafe|café|place|places|dining|outing)\b/u.test(goal)) matches.push("place");
  if (matches.length !== 1) throw new QlooFailure(400, "CLARIFICATION_REQUIRED", matches.length > 1
    ? "Which focus should lead this mixed gathering: a book, an artist, a movie, or a place? Choose one primary focus, or use organizer-led planning."
    : "What cultural focus should this gathering use: a book, an artist, a movie, or a place? You can also choose organizer-led planning.");
  return matches[0];
}

/** Unknown facts remain explicit; monetary budgets never use an ordinal price level. */
export function assessClubCandidate(input: ClubInput, entity: CulturalEntity, facts: ResourceFacts, source: ClubCandidate["factSource"]): ConstraintAssessment[] {
  const result: ConstraintAssessment[] = [];
  const add = (constraint: string, status: ConstraintAssessment["status"], detail: string, provenance: ConstraintAssessment["source"] = source) => result.push({ constraint, status, source: provenance, detail });
  if (input.budget) {
    const budget = input.budget;
    if (facts.price === undefined || facts.currency !== budget.currency || facts.priceBasis !== budget.basis) {
      add("Budget", "needs_confirmation", "An exact cost in the selected currency and budget basis needs organizer confirmation. A venue price level is not a monetary quote.", "unknown");
    } else add("Budget", facts.price <= budget.amount ? "satisfied" : "violated", "Compared with the supplied amount, currency, and budget basis.");
  }
  if (entity.kind === "book") {
    if (input.maxPages !== null) add("Pages", facts.pages === undefined ? "needs_confirmation" : facts.pages <= input.maxPages ? "satisfied" : "violated", facts.pages === undefined ? "The edition page count needs confirmation." : "Compared with the organizer's page limit.", facts.pages === undefined ? "unknown" : source);
    if (input.languages.length) add("Language", facts.language === undefined ? "needs_confirmation" : input.languages.includes(facts.language) ? "satisfied" : "violated", facts.language === undefined ? "The edition language needs confirmation." : "Compared with the selected languages.", facts.language === undefined ? "unknown" : source);
    if (facts.stock !== undefined) add("Stock", facts.stock > 0 ? "satisfied" : "violated", "Inventory stock is organizer-supplied or illustrative; this is not a retailer availability check.");
    else add("Availability", "needs_confirmation", "Confirm access to the intended edition; Qloo does not establish current stock.", "unknown");
  }
  if (entity.kind === "artist") {
    if (entity.metadata.musicVerified !== true && /\b(?:music|listening|musician|concert|playlist)\b/iu.test(input.goal)) add("Music identity", "needs_confirmation", "Qloo's artist category also includes visual artists and performers. Confirm that this focus suits the intended music activity.", "unknown");
    add("Playback or attendance", "needs_confirmation", "Arrange lawful playback or any required permissions. Artist attendance, track lists, links, fees and song durations are not established.", "unknown");
  }
  if (entity.kind === "movie") {
    add("Screening rights", "needs_confirmation", "Confirm access and any screening permission. A discussion may concern a film watched beforehand.", "unknown");
    if (/\b(?:screen|screening|show|watch)\b/iu.test(input.goal) && !/\b(?:previously|beforehand|already|prior|previous)\b/iu.test(input.goal)) {
      const minutes = facts.durationMinutes ?? entity.metadata.durationMinutes;
      add("Screening time", minutes === undefined ? "needs_confirmation" : minutes > input.duration ? "violated" : "needs_confirmation", minutes === undefined
        ? "The film running time and time for discussion need confirmation."
        : minutes > input.duration ? "The complete film exceeds this gathering's duration. Choose a discussion of a film watched beforehand, or increase the duration."
          : "Reserve time beyond the film for the intended gathering activities.", minutes === undefined ? "unknown" : facts.durationMinutes !== undefined ? source : "provider");
    }
  }
  if (entity.kind === "place") add("Booking and availability", "needs_confirmation", "Confirm opening times, capacity, exact cost, accessibility and booking directly. No reservation is made.", "unknown");
  return result;
}

export function createClubQloo({ credential = "", signingKey = randomBytes(32), fetcher = fetch, now = Date.now, timeoutMs = 10_000 }: {
  credential?: string; signingKey?: string | Uint8Array; fetcher?: typeof fetch; now?: () => number; timeoutMs?: number;
} = {}) {
  const key = credential.trim();
  const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 10_000) : 10_000;
  const clean = (value: string, max = 200) => value.split(key || "\0").join("[redacted]").replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ").trim().slice(0, max);
  const sign = (payload: string) => createHmac("sha256", signingKey).update(`AfterHours cultural reference v1:${payload}`).digest();
  const issueReference = (entity: Omit<CulturalEntity, "reference">): EntityReference => {
    const payload = Buffer.from(JSON.stringify({ entity, expiresAt: now() + TOKEN_TTL })).toString("base64url");
    return { token: `${payload}.${sign(payload).toString("base64url")}` };
  };
  const sampleEntity = (localId: string): CulturalEntity => {
    const book = SAMPLE_CATALOGUE.find((entry) => entry.id === localId);
    const entityId = SAMPLE_QLOO_MAPPINGS[localId];
    if (!book || !entityId) invalid("This sample book has no reviewed Qloo identity. Keep it for organizer-led planning, or explicitly resolve an appropriate entity.");
    return { entityId, kind: "book", name: book.title, metadata: { creator: book.author }, reference: { sample: localId } as EntityReference };
  };
  function resolveReference(value: unknown): CulturalEntity {
    const ref = object(value);
    if (!ref) invalid("Confirm the intended entity again; its reference is missing.");
    if (keys(ref, ["sample"]) && validText(ref.sample, 100)) return sampleEntity(ref.sample);
    if (keys(ref, ["preset", "index"])) {
      if ((ref.preset !== "a" && ref.preset !== "b") || (ref.index !== 0 && ref.index !== 1)) invalid();
      const entry = QLOO_PRESETS.find((preset) => preset.id === ref.preset)?.interests[Number(ref.index)];
      if (!entry) invalid();
      return { ...entry, metadata: entry.kind === "artist" ? { musicVerified: true } : /^\d{4}$/u.test(entry.disambiguation ?? "") ? { year: Number(entry.disambiguation) } : {} };
    }
    if (!keys(ref, ["token"]) || typeof ref.token !== "string" || ref.token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(ref.token)) invalid("Confirm the intended entity again; its reference is invalid or expired.");
    const [payload, signature] = ref.token.split(".");
    const expected = sign(payload);
    const received = Buffer.from(signature, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) invalid("Confirm the intended entity again; its reference is invalid or expired.");
    let claim: Obj | null = null;
    try { claim = object(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))); } catch { invalid(); }
    const entity = object(claim?.entity);
    if (!claim || !keys(claim, ["entity", "expiresAt"]) || !entity || typeof claim.expiresAt !== "number" || !Number.isSafeInteger(claim.expiresAt) || claim.expiresAt <= now() || claim.expiresAt > now() + TOKEN_TTL ||
      !keys(entity, ["entityId", "kind", "name", "metadata"], ["imageUrl", "disambiguation"]) || typeof entity.entityId !== "string" || !UUID.test(entity.entityId) || !kindOf(entity.kind) || !validText(entity.name) || !object(entity.metadata)) invalid("Confirm the intended entity again; its reference is invalid or expired.");
    // Claims are generated only by this service; the MAC covers all metadata.
    return { ...entity, reference: { token: ref.token } } as CulturalEntity;
  }

  function readEntity(value: unknown): CulturalEntity | null {
    const row = object(value);
    if (!row) badResponse();
    const types = Array.isArray(row.types) ? row.types : typeof row.subtype === "string" ? [row.subtype] : [];
    const kinds = CULTURAL_KINDS.filter((kind) => types.includes(`urn:entity:${kind}`));
    if (!kinds.length) return null; // Unsupported Qloo types are not exposed as working options.
    if (kinds.length !== 1 || !validText(row.name, 500)) badResponse();
    const kind = kinds[0];
    const metadata: CulturalMetadata = {};
    const props = object(row.properties) ?? {};
    if ((kind === "book" || kind === "movie") && typeof props.release_year === "number" && Number.isInteger(props.release_year) && props.release_year >= 0 && props.release_year <= 2200) metadata.year = props.release_year;
    if (kind === "book" && typeof props.publication_year === "number" && Number.isInteger(props.publication_year) && props.publication_year >= 0 && props.publication_year <= 2200) metadata.year = props.publication_year;
    if (kind === "movie" && typeof props.duration === "number" && Number.isFinite(props.duration) && props.duration > 0 && props.duration <= 2000) metadata.durationMinutes = props.duration;
    if (kind === "book" && validText(props.author, 200)) metadata.creator = clean(props.author);
    if (kind === "place" && validText(props.address, 300)) metadata.address = clean(props.address, 300);
    if (kind === "place" && Number.isInteger(props.price_level) && Number(props.price_level) >= 1 && Number(props.price_level) <= 4) metadata.priceLevel = Number(props.price_level);
    // A generic artist category does not prove that an artist is a musician.
    const imageUrl = safeCulturalImage(object(props.image)?.url);
    const disambiguation = validText(row.disambiguation, 500) ? clean(row.disambiguation) : undefined;
    const entity = { entityId: normalizeId(row.entity_id), kind, name: clean(row.name), metadata, ...(imageUrl ? { imageUrl } : {}), ...(disambiguation ? { disambiguation } : {}) };
    if (!entity.name) badResponse();
    return { ...entity, reference: issueReference(entity) };
  }

  function searchInput(value: unknown): Search {
    const input = object(value);
    if (!input || !keys(input, ["query"], ["kind", "externalId"]) || !validText(input.query, 100) || (input.externalId === undefined && input.query.trim().length < 3) || (input.kind !== undefined && !kindOf(input.kind))) invalid("Enter at least three characters, up to 100, for name search, or supply a valid external identity with its name.");
    let externalId: Search["externalId"];
    if (input.externalId !== undefined) {
      const id = object(input.externalId);
      if (!id || !keys(id, ["type", "value"]) || !validText(id.value, 100)) invalid("Supply a valid ISBN-13, IMDb, or Spotify identity for the corresponding entity kind.");
      if (id.type === "isbn13" && input.kind === "book" && /^\d{13}$/.test(id.value)) {
        const sum = [...id.value].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
        if (sum % 10 !== 0) invalid("The ISBN-13 checksum is invalid.");
      } else if (!(id.type === "imdb" && input.kind === "movie" && /^tt\d{7,10}$/.test(id.value)) && !(id.type === "spotify" && input.kind === "artist" && /^[A-Za-z0-9]{22}$/.test(id.value))) invalid("The external identity does not match this supported entity kind.");
      externalId = id as Search["externalId"];
    }
    return { query: input.query.trim(), ...(input.kind ? { kind: input.kind } : {}), ...(externalId ? { externalId } : {}) };
  }

  function prepareInternal(value: unknown): Prepared {
    const parsed = parseClubInput(value);
    if (!parsed.ok) throw new QlooFailure(400, parsed.code, parsed.message);
    const input = parsed.input;
    const kind = relevantKind(input);
    if (kind !== "book" && (input.maxPages !== null || input.languages.length)) invalid("Page counts and edition languages apply only to book gatherings. Clear those constraints for this focus.");
    if (input.source === "sample" && kind !== "book") throw new QlooFailure(400, "CLARIFICATION_REQUIRED", "The illustrative sample inventory contains books. Choose book focus, use discovery, or supply your own relevant list.");
    if (!input.interests.length) invalid("Confirm one to five audience interests before requesting Qloo discovery or a grounded plan.");
    const interests = [...new Map(input.interests.map((reference) => {
      const entity = resolveReference(reference); return [entity.entityId, entity] as const;
    })).values()];
    let resources: ClubResource[] = [];
    if (input.source === "sample") {
      resources = SAMPLE_CATALOGUE.map((book) => ({ localId: book.id, kind: "book" as const, name: book.title, creator: book.author,
        facts: { price: book.priceInr, currency: "INR", priceBasis: "per_person" as const, pages: book.pages, language: book.language, stock: book.stock },
        ...(SAMPLE_QLOO_MAPPINGS[book.id] ? { reference: { sample: book.id } as EntityReference } : {}),
      })).filter((resource) => !assessClubCandidate(input, { entityId: "", kind: "book", name: resource.name, metadata: {}, reference: { sample: resource.localId } as EntityReference }, resource.facts, "illustrative").some((entry) => entry.status === "violated"));
    } else if (input.source === "shortlist") {
      resources = input.resources.map((resource) => {
        if (!resource.reference) return resource;
        const entity = resolveReference(resource.reference);
        if (entity.kind !== resource.kind) invalid("A confirmed shortlist entity must match its resource type.");
        return { ...resource, name: entity.name, ...(entity.metadata.creator ? { creator: entity.metadata.creator } : {}), reference: entity.reference };
      }).filter((resource) => {
        if (resource.kind !== kind) return false;
        const entity = resource.reference ? resolveReference(resource.reference) : { entityId: "", kind: resource.kind, name: resource.name, metadata: {}, reference: { sample: "unresolved" } as EntityReference };
        return !assessClubCandidate(input, entity, resource.facts, "organizer").some((entry) => entry.status === "violated");
      });
    }
    const selected = input.selected ? resolveReference(input.selected) : null;
    const resolvedIds = resources.flatMap((resource) => resource.reference ? [resolveReference(resource.reference).entityId] : []);
    if (new Set(resolvedIds).size !== resolvedIds.length) invalid("Choose only one eligible resource row for each confirmed Qloo identity in the matching batch. Different editions or rows must not silently share one set of facts.");
    if (selected && selected.kind !== kind) invalid("The selected cultural focus does not match the requested recommendation format.");
    if (selected && input.source === "discovery" && assessClubCandidate(input, selected, {}, "provider").some((entry) => entry.status === "violated")) throw new QlooFailure(422, "SELECTED_FOCUS_CONFLICT", "The selected focus conflicts with a current constraint. Change the goal or limits; no alternative was silently substituted.");
    if (input.source !== "discovery" && !resources.some((row) => row.reference)) throw new QlooFailure(400, "INSUFFICIENT_RESOLVED", "No eligible resources in this selected batch have confirmed Qloo identities. Resolve an intended match explicitly or use the manual template.");
    if (selected && input.source !== "discovery" && !resources.some((row) => row.reference && resolveReference(row.reference).entityId === selected.entityId)) invalid("The selected focus is outside the current eligible confirmed shortlist. Change the constraints or explicitly select another focus.");
    const canonical: ClubInput = { ...input, format: kind, interests: interests.map((entry) => entry.reference), resources: input.source === "sample" ? [] : resources, selected: selected?.reference ?? null };
    return { input: canonical, kind, interests, resources, selected };
  }

  async function request(path: "/search" | "/entities" | "/v2/insights", params: Record<string, string | number | boolean>, caller?: AbortSignal): Promise<Obj> {
    if (!key) throw new QlooFailure(503, "QLOO_NOT_CONFIGURED", "Qloo credentials are not configured. Your manual plan and edits remain available.");
    if (caller?.aborted) throw new QlooFailure(499, "QLOO_CANCELLED", "The cultural request was cancelled. Existing edits are unchanged.");
    const controller = new AbortController();
    let expired = false;
    const timer = setTimeout(() => { expired = true; controller.abort(); }, timeout);
    const signal = caller ? AbortSignal.any([caller, controller.signal]) : controller.signal;
    const stopped = () => {
      if (caller?.aborted) throw new QlooFailure(499, "QLOO_CANCELLED", "The cultural request was cancelled. Existing edits are unchanged.");
      if (expired) throw new QlooFailure(504, "QLOO_TIMEOUT", "Qloo exceeded its bounded request deadline. No automatic retry was attempted.");
    };
    let abortListener: (() => void) | undefined;
    const interruption = new Promise<never>((_, reject) => {
      abortListener = () => { try { stopped(); } catch (error) { reject(error); } };
      signal.addEventListener("abort", abortListener, { once: true });
    });
    try {
      const work = (async () => {
        const url = new URL(path, ORIGIN);
        for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));
        stopped();
        const response = await fetcher(url, { method: "GET", headers: { "X-Api-Key": key, Accept: "application/json" }, redirect: "manual", cache: "no-store", signal });
        if (signal.aborted) void response.body?.cancel().catch(() => {});
        stopped();
        if (!response.redirected && response.status === 404) {
          void response.body?.cancel().catch(() => {});
          return { results: path === "/v2/insights" ? { entities: [] } : [] };
        }
        if (response.redirected || !response.ok) {
          void response.body?.cancel().catch(() => {});
          const status = response.status;
          throw new QlooFailure(status === 429 ? 429 : 502, status === 401 ? "QLOO_AUTHENTICATION_FAILED" : status === 403 ? "QLOO_ACCESS_DENIED" : status === 429 ? "QLOO_RATE_LIMITED" : status >= 300 && status < 400 ? "QLOO_REDIRECT_BLOCKED" : "QLOO_UPSTREAM_FAILED", status === 429 ? "Qloo's allowance is exhausted. Try again later; no retry was attempted." : "Qloo rejected or could not complete this request. No fallback host or result was used.", status);
        }
        if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
          void response.body?.cancel().catch(() => {}); badResponse();
        }
        const reader = response.body?.getReader();
        if (!reader) badResponse();
        let bytes = 0; let text = "";
        const decoder = new TextDecoder("utf-8", { fatal: true });
        const cancel = () => { void reader.cancel().catch(() => {}); };
        signal.addEventListener("abort", cancel, { once: true });
        try {
          for (;;) {
            stopped();
            const part = await reader.read();
            stopped();
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES) { cancel(); badResponse(); }
            text += decoder.decode(part.value, { stream: true });
          }
          const body = object(JSON.parse((text + decoder.decode()).replace(/^\uFEFF/u, "")));
          if (!body || body.success === false) badResponse();
          return body;
        } catch (error) {
          cancel(); stopped();
          if (error instanceof QlooFailure) throw error;
          badResponse();
        } finally { signal.removeEventListener("abort", cancel); reader.releaseLock(); }
      })();
      return await Promise.race([work, interruption]);
    } catch (error) { stopped(); throw error; }
    finally { clearTimeout(timer); if (abortListener) signal.removeEventListener("abort", abortListener); }
  }

  return {
    resolveReference,
    prepareSearch(value: unknown): ClubResult<Search> { try { return { status: 200, body: { ok: true, ...searchInput(value) } }; } catch (error) { return failure(error); } },
    prepare(value: unknown): ClubResult<Prepared> { try { return { status: 200, body: { ok: true, ...prepareInternal(value) } }; } catch (error) { return failure(error); } },
    async search(value: unknown, signal?: AbortSignal): Promise<ClubResult<{ candidates: CulturalEntity[] }>> {
      try {
        const input = searchInput(value);
        const body = input.externalId
          ? await request("/entities", { [`external.${input.externalId.type}.ids`]: input.externalId.value }, signal)
          : await request("/search", { query: input.query, ...(input.kind ? { types: `urn:entity:${input.kind}` } : {}), take: 8 }, signal);
        // The pinned harness's entities reader explicitly supports both these shapes.
        const rows = Array.isArray(body.results) ? body.results : input.externalId ? object(body.results)?.entities : undefined;
        if (!Array.isArray(rows) || rows.length > 8) badResponse();
        const seen = new Set<string>();
        const candidates = rows.flatMap((row): CulturalEntity[] => {
          const entity = readEntity(row);
          if (!entity || (input.kind && entity.kind !== input.kind)) return [];
          if (seen.has(entity.entityId)) badResponse();
          seen.add(entity.entityId); return [entity];
        });
        return { status: 200, body: { ok: true, candidates } };
      } catch (error) { return failure(error); }
    },
    async discover(value: ClubInput, signal?: AbortSignal): Promise<ClubResult<{ discovery: ClubDiscovery }>> {
      try {
        const { input, kind, interests, resources, selected } = prepareInternal(value);
        const pool = resources.flatMap((row) => row.reference ? [{ resource: row, entity: resolveReference(row.reference) }] : []);
        const allowed = input.source === "discovery" ? selected ? [selected.entityId] : null : pool.map((entry) => entry.entity.entityId);
        const ids = selected ? [selected.entityId] : allowed;
        const body = await request("/v2/insights", {
          "filter.type": `urn:entity:${kind}`, "signal.interests.entities": interests.map((entry) => entry.entityId).join(","),
          ...(ids ? { "filter.results.entities": ids.join(",") } : {}),
          ...(kind === "place" && input.location ? { "filter.location.query": input.location, "filter.location.radius": 0 } : {}),
          sort_by: "affinity", "feature.explainability": true, take: ids ? Math.min(ids.length, 8) : 8,
        }, signal);
        const results = object(body.results);
        if (!results || !Array.isArray(results.entities) || results.entities.length > (ids ? ids.length : 8)) badResponse();
        const seen = new Set<string>();
        const warnings = new Set<string>();
        const candidates = results.entities.flatMap((row): ClubCandidate[] => {
          const raw = object(row);
          const entity = readEntity(raw);
          if (!raw || !entity || entity.kind !== kind || seen.has(entity.entityId) || (ids && !ids.includes(entity.entityId))) badResponse();
          seen.add(entity.entityId);
          const item = pool.find((entry) => entry.entity.entityId === entity.entityId);
          const facts = item?.resource.facts ?? {};
          const factSource = input.source === "sample" ? "illustrative" : input.source === "shortlist" ? "organizer" : "provider";
          const assessments = assessClubCandidate(input, entity, facts, factSource);
          if (assessments.some((entry) => entry.status === "violated")) {
            if (selected?.entityId === entity.entityId) throw new QlooFailure(422, "SELECTED_FOCUS_CONFLICT", "The selected focus conflicts with a current constraint. No alternative was silently substituted.");
            return [];
          }
          const query = object(raw.query);
          const evidence: ClubCandidate["evidence"] = [];
          if (typeof query?.affinity === "number" && Number.isFinite(query.affinity)) evidence.push({ id: `affinity:${entity.entityId}`, entityId: entity.entityId, kind: "affinity", value: query.affinity });
          const explainability = object(query?.explainability);
          const parts = explainability?.["signal.interests.entities"];
          if (parts !== undefined && (!Array.isArray(parts) || parts.length > 100)) badResponse();
          const usedParts = new Set<string>();
          for (const part of Array.isArray(parts) ? parts : []) {
            const contribution = object(part);
            if (!contribution || typeof contribution.entity_id !== "string" || !UUID.test(contribution.entity_id)) continue;
            const interestId = contribution.entity_id.toUpperCase();
            const interest = interests.find((entry) => entry.entityId === interestId);
            const score = contribution.score;
            if (!interest || typeof score !== "number" || !Number.isFinite(score) || score < 0 || score > 1) continue;
            if (usedParts.has(interestId)) badResponse();
            usedParts.add(interestId);
            evidence.push({ id: `contribution:${entity.entityId}:${interestId}`, entityId: entity.entityId, kind: "contribution", value: score, interestId, interestName: interest.name });
          }
          if (!evidence.some((entry) => entry.kind === "contribution")) warnings.add("Qloo did not supply numerical interest contributions for every option.");
          if (raw.warning || raw.warnings || query?.warning || query?.warnings || explainability?.warning || explainability?.warnings) warnings.add("Qloo reported a warning; explanation coverage may be incomplete.");
          return [{ entity, ...(item ? { localId: item.resource.localId } : {}), facts, factSource, assessments, evidence }];
        });
        if (selected && !seen.has(selected.entityId)) throw new QlooFailure(422, "SELECTED_FOCUS_UNASSESSED", "Qloo did not assess the explicitly selected focus in this run. No alternative was silently substituted.");
        if (body.warning || body.warnings) warnings.add("Qloo reported a warning; explanation coverage may be incomplete.");
        if (input.source === "shortlist" && pool.length < resources.length) warnings.add("Unresolved rows remain unassessed; only explicitly confirmed identities in this selected batch were submitted.");
        const snapshotPool: NonNullable<ClubDiscovery["pool"]> = input.source === "discovery"
          ? candidates.map((candidate) => ({ name: candidate.entity.name, kind: candidate.entity.kind, entityId: candidate.entity.entityId, status: "resolved" as const }))
          : resources.map((resource) => {
            const confirmed = resource.reference ? resolveReference(resource.reference) : null;
            return { localId: resource.localId, name: confirmed?.name ?? resource.name, kind: resource.kind,
              ...(confirmed ? { entityId: confirmed.entityId } : {}), status: confirmed ? "resolved" as const : "unresolved" as const };
          });
        return { status: 200, body: { ok: true, discovery: { kind, candidates, interests,
          coverage: { submitted: input.source === "discovery" ? null : resources.length, resolved: input.source === "discovery" ? null : pool.length, assessed: candidates.length }, pool: snapshotPool, warnings: [...warnings] } } };
      } catch (error) { return failure(error); }
    },
  };
}
