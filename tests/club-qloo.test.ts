import assert from "node:assert/strict";
import test from "node:test";
import { assessClubCandidate, createClubQloo, safeCulturalImage } from "../lib/club-qloo.ts";
import type { ClubInput, ClubResource, CulturalEntity, CulturalKind } from "../lib/club-types.ts";

const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222", "33333333-3333-4333-8333-333333333333"];
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
const row = (kind: CulturalKind, id = ids[0], name = `Controlled ${kind}`) => ({ entity_id: id, name, types: [`urn:entity:${kind}`], disambiguation: "Controlled identifying metadata", properties: {}, query: { affinity: 0.7, explainability: { "signal.interests.entities": [{ entity_id: "B7A0731F-EC92-496A-9C40-47D9770489B6", score: 0.6 }] } } });
function input(overrides: Partial<ClubInput> = {}): ClubInput {
  return { club: "Neighbourhood curiosity collective", goal: "Plan a shared book discussion", duration: 45, groupSize: 12, location: "", budget: null, maxPages: null, languages: [], format: "book", source: "discovery", interests: [{ preset: "a", index: 0 }], resources: [], selected: null, mode: "generate", ...overrides };
}
function entity(kind: CulturalKind): CulturalEntity { return { entityId: ids[0], kind, name: "Controlled entity", metadata: {}, reference: { token: "controlled" } }; }

test("mixed cultural search omits types, makes one bounded request, and preserves identifying metadata", async () => {
  let requests = 0;
  const service = createClubQloo({ credential: "fake-key", signingKey: "controlled-signing", fetcher: async (url, init) => {
    requests++;
    const target = new URL(String(url));
    assert.equal(target.origin, "https://hackathon.api.qloo.com");
    assert.equal(target.pathname, "/search");
    assert.equal(target.searchParams.has("types"), false);
    assert.equal(target.searchParams.get("take"), "8");
    assert.equal(target.searchParams.get("query"), "Amélie");
    assert.equal(init?.redirect, "manual");
    assert.equal(new Headers(init?.headers).get("X-Api-Key"), "fake-key");
    return json({ results: [row("movie"), row("artist", ids[1]), { entity_id: ids[2], name: "Unsupported album", types: ["urn:entity:album"] }] });
  } });
  const result = await service.search({ query: "Amélie" });
  assert.equal(result.body.ok, true);
  if (!result.body.ok) return;
  assert.equal(result.body.candidates.length, 2);
  assert.equal(result.body.candidates[0].disambiguation, "Controlled identifying metadata");
  assert.deepEqual(service.resolveReference(result.body.candidates[0].reference), result.body.candidates[0]);
  assert.equal(requests, 1);
});

test("missing credentials and invalid fields cause zero Qloo requests", async () => {
  let requests = 0;
  const service = createClubQloo({ fetcher: async () => { requests++; throw new Error("must not dispatch"); } });
  assert.equal((await service.search({ query: "re" })).status, 400);
  assert.equal((await service.search({ query: "Read", kind: "song" })).status, 400);
  assert.equal((await service.search({ query: "Read", arbitrary: true })).status, 400);
  assert.equal((await service.search({ query: "Read" })).status, 503);
  assert.equal((await service.discover(input())).status, 503);
  assert.equal((await service.discover(input({ duration: -1 }))).status, 400);
  assert.equal(requests, 0);
});

test("signed references are stable across instances, bounded, tamper resistant, and expire", async () => {
  let clock = 1000;
  const options = { credential: "fake-key", signingKey: "shared-secret", now: () => clock, fetcher: async () => json({ results: [row("book")] }) };
  const service = createClubQloo(options);
  const found = await service.search({ query: "Controlled" });
  assert.ok(found.body.ok);
  if (!found.body.ok) return;
  const reference = found.body.candidates[0].reference;
  assert.deepEqual(createClubQloo(options).resolveReference(reference), found.body.candidates[0]);
  assert.ok("token" in reference);
  if (!("token" in reference)) return;
  const [payload, signature] = reference.token.split(".");
  const modified = JSON.parse(Buffer.from(payload, "base64url").toString());
  modified.entity.name = "Client edited title";
  assert.throws(() => service.resolveReference({ token: `${Buffer.from(JSON.stringify(modified)).toString("base64url")}.${signature}` }), /invalid or expired/u);
  clock += 30 * 60 * 1000;
  assert.throws(() => service.resolveReference(reference), /invalid or expired/u);
  assert.throws(() => service.resolveReference({ token: "x".repeat(4097) }), /invalid or expired/u);
  assert.throws(() => service.resolveReference({ entityId: ids[0], name: "Forged" }), /invalid or expired/u);
});

for (const kind of ["book", "artist", "movie", "place"] as const) test(`dynamic ${kind} discovery uses actual URN, current evidence and no sample restriction`, async () => {
  let count = 0;
  const service = createClubQloo({ credential: "fake-key", fetcher: async (url) => {
    count++;
    const target = new URL(String(url));
    assert.equal(target.pathname, "/v2/insights");
    assert.equal(target.searchParams.get("filter.type"), `urn:entity:${kind}`);
    assert.equal(target.searchParams.has("filter.results.entities"), false);
    assert.equal(target.searchParams.get("feature.explainability"), "true");
    assert.equal(target.searchParams.get("take"), "8");
    return json({ results: { entities: [row(kind)] } });
  } });
  const result = await service.discover(input({ format: kind, goal: kind === "movie" ? "Discuss a film watched beforehand" : `Discuss the selected ${kind}` }));
  assert.ok(result.body.ok);
  if (!result.body.ok) return;
  assert.equal(result.body.discovery.kind, kind);
  assert.equal(result.body.discovery.candidates[0].entity.entityId, ids[0]);
  assert.equal(result.body.discovery.candidates[0].evidence[0].value, 0.7);
  assert.equal(result.body.discovery.candidates[0].evidence[1].interestName, "Amélie");
  assert.equal(count, 1);
});

test("unsupported, unclear, and mixed goals clarify without dispatch; free-text club identity is unrestricted", () => {
  const service = createClubQloo();
  for (const goal of ["Plan something nice", "Organize a pottery lesson", "Discuss books and films together"]) {
    const result = service.prepare(input({ format: "auto", goal }));
    assert.equal(result.body.ok, false);
    if (!result.body.ok) assert.equal(result.body.error.code, "CLARIFICATION_REQUIRED");
  }
  const chosen = service.prepare(input({ format: "movie", goal: "Discuss books and films together" }));
  assert.ok(chosen.body.ok);
  const manual = service.prepare(input({ format: "manual" }));
  assert.equal(manual.body.ok, false);
  if (!manual.body.ok) assert.equal(manual.body.error.code, "MANUAL_PLANNING");
});

test("sample inventory remains authoritative and existing eligibility values are preserved", async () => {
  let submitted = "";
  const service = createClubQloo({ credential: "fake-key", fetcher: async (url) => {
    submitted = new URL(String(url)).searchParams.get("filter.results.entities") ?? "";
    return json({ results: { entities: [] } });
  } });
  const planInput = input({ source: "sample", budget: { amount: 450, currency: "INR", basis: "per_person" }, maxPages: 300, languages: ["English"], resources: [{ localId: "the-guide", kind: "book", name: "Forged title", facts: { price: 1, currency: "INR", priceBasis: "per_person" } }] });
  const prepared = service.prepare(planInput);
  assert.ok(prepared.body.ok);
  if (!prepared.body.ok) return;
  assert.deepEqual(prepared.body.resources.map((entry) => entry.localId).sort(), ["malgudi-days", "the-blue-umbrella", "the-guide"]);
  assert.equal(prepared.body.resources.find((entry) => entry.localId === "the-guide")?.facts.price, 299);
  assert.deepEqual(prepared.body.input.resources, []);
  const result = await service.discover(planInput);
  assert.ok(result.body.ok);
  if (!result.body.ok) return;
  assert.equal(result.body.discovery.coverage.submitted, 3);
  assert.equal(result.body.discovery.coverage.resolved, 2);
  assert.equal(result.body.discovery.pool?.length, 3);
  assert.deepEqual(result.body.discovery.pool?.find((entry) => entry.localId === "the-blue-umbrella"), { localId: "the-blue-umbrella", name: "The Blue Umbrella", kind: "book", status: "unresolved" });
  assert.equal(result.body.discovery.pool?.find((entry) => entry.localId === "the-guide")?.entityId, "DF4272D0-A6BA-445B-88DC-172A56B5D183");
  assert.equal(submitted.split(",").length, 2);
  assert.equal(submitted.includes("DF4272D0-A6BA-445B-88DC-172A56B5D183"), true);
});

test("shortlist resolution is explicit; unresolved rows are excluded and client names do not override signed evidence", async () => {
  let calls = 0;
  let expectedId = "";
  const service = createClubQloo({ credential: "fake-key", signingKey: "controlled", fetcher: async (url) => {
    calls++;
    const target = new URL(String(url));
    if (target.pathname === "/search") return json({ results: [row("book"), row("book", ids[1], "Same name, different creator")] });
    assert.equal(target.searchParams.get("filter.results.entities"), expectedId);
    return json({ results: { entities: [row("book")] } });
  } });
  const search = await service.search({ query: "Ambiguous name", kind: "book" });
  assert.ok(search.body.ok);
  if (!search.body.ok) return;
  const unresolved: ClubResource[] = [{ localId: "one", kind: "book", name: "Unresolved local name", facts: {} }];
  assert.equal(service.prepare(input({ source: "shortlist", resources: unresolved })).body.ok, false);
  assert.equal(calls, 1, "an ambiguous search never automatically confirms a result");
  expectedId = search.body.candidates[0].entityId;
  const resources = [{ ...unresolved[0], name: "Client changed metadata", reference: search.body.candidates[0].reference }, { ...unresolved[0], localId: "two" }];
  const result = await service.discover(input({ source: "shortlist", resources }));
  assert.ok(result.body.ok);
  if (!result.body.ok) return;
  assert.equal(result.body.discovery.candidates[0].entity.name, "Controlled book");
  assert.equal(result.body.discovery.pool?.[0].name, "Controlled book");
  assert.equal(result.body.discovery.pool?.[1].status, "unresolved");
  assert.deepEqual(result.body.discovery.coverage, { submitted: 2, resolved: 1, assessed: 1 });
  assert.match(result.body.discovery.warnings.join(" "), /Unresolved/u);
  assert.equal(calls, 2);
});

test("explicit candidate selection is restricted and a provider replacement is rejected", async () => {
  let wrong = false;
  const service = createClubQloo({ credential: "fake-key", fetcher: async (url) => {
    const target = new URL(String(url));
    assert.equal(target.searchParams.get("filter.results.entities"), "DF4272D0-A6BA-445B-88DC-172A56B5D183");
    return json({ results: { entities: wrong ? [row("book", ids[0])] : [] } });
  } });
  const request = input({ selected: { sample: "the-guide" } });
  const absent = await service.discover(request);
  assert.equal(absent.body.ok, false);
  if (!absent.body.ok) assert.equal(absent.body.error.code, "SELECTED_FOCUS_UNASSESSED");
  wrong = true;
  const replacement = await service.discover(request);
  assert.equal(replacement.body.ok, false);
  if (!replacement.body.ok) assert.equal(replacement.body.error.code, "QLOO_RESPONSE_INVALID");
});

test("two eligible resource rows cannot silently bind different inventory facts to one Qloo identity", async () => {
  let calls = 0;
  const service = createClubQloo({ credential: "fake-key", fetcher: async () => { calls++; return json({ results: [row("book")] }); } });
  const found = await service.search({ query: "Controlled book", kind: "book" });
  assert(found.body.ok);
  const resources: ClubResource[] = [
    { localId: "edition-one", kind: "book", name: "Edition one", facts: { price: 100, currency: "INR", priceBasis: "per_person" }, reference: found.body.candidates[0].reference },
    { localId: "edition-two", kind: "book", name: "Edition two", facts: { price: 300, currency: "INR", priceBasis: "per_person" }, reference: found.body.candidates[0].reference },
  ];
  const result = await service.discover(input({ source: "shortlist", resources }));
  assert.equal(result.status, 400); assert(!result.body.ok);
  assert.match(result.body.error.message, /one eligible resource row/u);
  assert.equal(calls, 1, "duplicate-identity rejection happens before any Insights dispatch");
});

test("wrong provider type, duplicate candidates, oversized payloads and redirected responses are rejected", async () => {
  for (const result of [json({ results: { entities: [row("movie")] } }), json({ results: { entities: [row("book"), row("book")] } }), json({ results: { entities: [row("book")] }, padding: "x".repeat(1024 * 1024) }), new Response(null, { status: 302, headers: { Location: "https://untrusted.example" } })]) {
    let calls = 0;
    const service = createClubQloo({ credential: "fake-key", fetcher: async () => { calls++; return result; } });
    assert.equal((await service.discover(input())).body.ok, false);
    assert.equal(calls, 1);
  }
});

test("unknown hard constraints never silently pass and price levels never satisfy monetary budgets", () => {
  const constrained = input({ budget: { amount: 50, currency: "USD", basis: "total_event" }, maxPages: 200, languages: ["English"] });
  assert.ok(assessClubCandidate(constrained, entity("book"), {}, "provider").every((entry) => entry.status === "needs_confirmation"));
  const place = entity("place"); place.metadata.priceLevel = 1;
  assert.equal(assessClubCandidate({ ...constrained, maxPages: null, languages: [] }, place, {}, "provider").find((entry) => entry.constraint === "Budget")?.status, "needs_confirmation");
  const supplied = assessClubCandidate(constrained, entity("book"), { price: 60, currency: "USD", priceBasis: "total_event", pages: 210, language: "Hindi", stock: 0 }, "organizer");
  assert.ok(supplied.every((entry) => entry.status === "violated"));
  assert.ok(supplied.every((entry) => entry.source === "organizer"));
});

test("music identity stays uncertain without evidence, and a short discussion is not a full screening", () => {
  const artist = assessClubCandidate(input({ format: "artist", goal: "Host a music listening circle" }), entity("artist"), {}, "provider");
  assert.equal(artist.find((entry) => entry.constraint === "Music identity")?.status, "needs_confirmation");
  const movie = entity("movie"); movie.metadata.durationMinutes = 120;
  assert.equal(assessClubCandidate(input({ format: "movie", goal: "Screen a film together" }), movie, {}, "provider").find((entry) => entry.constraint === "Screening time")?.status, "violated");
  assert.equal(assessClubCandidate(input({ format: "movie", goal: "Discuss a film watched beforehand" }), movie, {}, "provider").some((entry) => entry.status === "violated"), false);
});

test("cancellation before dispatch makes zero requests; cancellation in flight aborts and rejects late results", async () => {
  let calls = 0;
  const before = new AbortController(); before.abort();
  const service = createClubQloo({ credential: "fake-key", fetcher: async () => { calls++; return json({ results: [] }); } });
  assert.equal((await service.search({ query: "Controlled" }, before.signal)).status, 499);
  assert.equal(calls, 0);
  const during = new AbortController();
  let observed: AbortSignal | null | undefined;
  const pending = createClubQloo({ credential: "fake-key", fetcher: async (_url, options) => {
    calls++; observed = options?.signal; queueMicrotask(() => during.abort());
    await new Promise((resolve) => setTimeout(resolve, 20));
    return json({ results: [row("book")] });
  } }).search({ query: "Controlled" }, during.signal);
  assert.equal((await pending).status, 499);
  assert.equal(observed?.aborted, true);
  assert.equal(calls, 1);
});

test("body-read cancellation and bounded timeouts reject non-cooperative transports without retry", async () => {
  const controller = new AbortController();
  const body = new ReadableStream<Uint8Array>({ start() { queueMicrotask(() => controller.abort()); } });
  const service = createClubQloo({ credential: "fake-key", fetcher: async () => new Response(body) });
  assert.equal((await service.search({ query: "Controlled" }, controller.signal)).status, 499);
  let count = 0;
  const timed = createClubQloo({ credential: "fake-key", timeoutMs: 5, fetcher: async () => { count++; return await new Promise<Response>(() => {}); } });
  assert.equal((await timed.search({ query: "Controlled" })).status, 504);
  assert.equal(count, 1);
});

test("empty search and discovery are honest empty results, quota/auth failures are sanitized", async () => {
  for (const status of [401, 403, 429, 500]) {
    const service = createClubQloo({ credential: "secret-that-must-not-leak", fetcher: async () => json({ message: "secret-that-must-not-leak", authorization: "secret-that-must-not-leak" }, status) });
    const result = await service.search({ query: "Controlled" });
    assert.equal(result.body.ok, false);
    assert.equal(JSON.stringify(result).includes("secret-that-must-not-leak"), false);
    if (!result.body.ok) assert.equal(result.body.error.upstreamStatus, status);
  }
  const service = createClubQloo({ credential: "fake-key", fetcher: async () => json({}, 404) });
  const searched = await service.search({ query: "Controlled" });
  assert.deepEqual(searched.body, { ok: true, candidates: [] });
  const discovered = await service.discover(input());
  assert.ok(discovered.body.ok);
  if (discovered.body.ok) assert.deepEqual(discovered.body.discovery.candidates, []);
});

test("reliable external IDs use a single documented entities lookup with no name-search fallback", async () => {
  let count = 0;
  const service = createClubQloo({ credential: "fake-key", fetcher: async (url) => {
    count++;
    const target = new URL(String(url));
    assert.equal(target.pathname, "/entities");
    assert.equal(target.searchParams.get("external.isbn13.ids"), "9780143038092");
    assert.equal(target.searchParams.has("query"), false);
    return json({ results: { entities: [row("book")] } });
  } });
  const result = await service.search({ query: "The Guide", kind: "book", externalId: { type: "isbn13", value: "9780143038092" } });
  assert.ok(result.body.ok);
  assert.equal(count, 1);
  assert.equal((await service.search({ query: "The Guide", kind: "book", externalId: { type: "isbn13", value: "9780143038093" } })).status, 400);
  assert.equal(count, 1);
});

test("only allowlisted credential-free image URLs survive; missing or broken media needs no invented cover", () => {
  assert.equal(safeCulturalImage("https://images.qloo.com/i/image.jpg"), "https://images.qloo.com/i/image.jpg");
  assert.equal(safeCulturalImage("https://staging.images.qloo.com/i/image-420x-outside.webp"), "https://staging.images.qloo.com/i/image-420x-outside.webp");
  for (const value of [undefined, "javascript:alert(1)", "https://images.qloo.com.evil.test/i/image.jpg", "https://images.qloo.com/i/image.jpg?key=secret", "https://secret@images.qloo.com/i/image.jpg", "http://images.qloo.com/i/image.jpg", "https://images.qloo.com/redirect"]) assert.equal(safeCulturalImage(value), undefined);
});

test("short names may resolve through reliable external IDs without weakening the name-search minimum", async () => {
  const paths: URL[] = [];
  const service = createClubQloo({ credential: "fake-key", fetcher: async (url) => {
    const target = new URL(String(url)); paths.push(target);
    return json({ results: { entities: [row(target.searchParams.has("external.spotify.ids") ? "artist" : "movie")] } });
  } });
  assert.equal((await service.search({ query: "U2", kind: "artist" })).status, 400);
  assert.equal((await service.search({ query: "It", kind: "movie" })).status, 400);
  assert.equal(paths.length, 0);
  assert.equal((await service.search({ query: "U2", kind: "artist", externalId: { type: "spotify", value: "51Blml2LZPmy7TTiAg47vQ" } })).body.ok, true);
  assert.equal((await service.search({ query: "It", kind: "movie", externalId: { type: "imdb", value: "tt1396484" } })).body.ok, true);
  assert.equal(paths.length, 2);
  for (const target of paths) { assert.equal(target.pathname, "/entities"); assert.equal(target.searchParams.has("query"), false); }
});
