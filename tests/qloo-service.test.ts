import assert from "node:assert/strict";
import test from "node:test";
import { createQlooService } from "../lib/qloo-service.ts";
import { QLOO_PRESETS, SAMPLE_QLOO_MAPPINGS } from "../lib/qloo-sample.ts";
import { createDefaultInputs, createExampleInputs } from "../lib/workspace.ts";
import type { QlooSearchResponse } from "../lib/qloo-types.ts";

// Every key, body, HTTP response, and request below is an offline test fixture.
const fixtureKey = "afterhours-synthetic-service-key";
const signingKey = "afterhours-synthetic-signing-key";
const foreign = "00000000-0000-0000-0000-000000000001";
const movie = QLOO_PRESETS[0].interests[0];
const musician = QLOO_PRESETS[0].interests[1];
const references = QLOO_PRESETS[0].interests.map((interest) => interest.reference);
const filters = createDefaultInputs().filters;
const rankRequest = () => ({ catalogueSource: "sample", filters: structuredClone(filters), interests: structuredClone(references) });

function stub(respond: (url: URL, options: RequestInit) => Response | Promise<Response>) {
  const calls: { url: URL; options: RequestInit }[] = [];
  const fetcher: typeof fetch = async (input, options = {}) => {
    const url = new URL(String(input));
    calls.push({ url, options });
    return respond(url, options);
  };
  return { fetcher, calls };
}

function rankedBody(ids = ["the-guide", "malgudi-days", "the-namesake", "the-god-of-small-things"]) {
  return { results: { entities: ids.map((id, index) => ({
    entity_id: SAMPLE_QLOO_MAPPINGS[id], types: ["urn:entity:book"],
    query: { affinity: 0.8 - index * 0.1, explainability: { "signal.interests.entities": [
      { entity_id: movie.entityId, score: 0.6 }, { entity_id: musician.entityId, score: 0.4 },
      { entity_id: foreign, score: 0.9 },
    ] } },
  })) }, query: { explainability: { "signal.interests.entities": { effect_on_all_recs: [
    { entity_id: movie.entityId, avg_score: 0.6 }, { entity_id: musician.entityId, avg_score: 0.4 },
    { entity_id: foreign, avg_score: 1 },
  ] } } } };
}

function candidateBody(kind: "movie" | "artist" = "movie") {
  const interest = kind === "movie" ? movie : musician;
  return { results: [{ entity_id: interest.entityId, name: interest.name,
    types: [`urn:entity:${kind}`], disambiguation: "Synthetic context" }] };
}

function confirmedToken(body: QlooSearchResponse) {
  assert(body.ok);
  const reference = body.candidates[0].reference;
  assert("token" in reference);
  return reference;
}

test("Qloo service missing configuration never makes a request", async () => {
  const fake = stub(() => { throw new Error("must not run"); });
  const service = createQlooService({ fetcher: fake.fetcher });
  for (const result of [await service.search({ query: "Synthetic", kind: "movie" }), await service.rank(rankRequest())]) {
    assert.equal(result.status, 503);
    assert(!result.body.ok);
    assert.equal(result.body.error.code, "QLOO_NOT_CONFIGURED");
  }
  assert.equal(fake.calls.length, 0);
});

test("Qloo search validates bounded names, kinds, and known fields before upstream", async () => {
  const fake = stub(() => Response.json(candidateBody()));
  const service = createQlooService({ credential: fixtureKey, fetcher: fake.fetcher });
  for (const input of [null, [], {}, { query: "", kind: "movie" }, { query: "x".repeat(101), kind: "movie" },
    { query: "line\nbreak", kind: "movie" }, { query: "Synthetic", kind: "book" },
    { query: "Synthetic", kind: "movie", apiKey: "attacker" },
    { query: "Synthetic", kind: "artist", baseURL: "https://example.invalid" }]) {
    assert.equal((await service.search(input)).status, 400);
  }
  assert.equal(fake.calls.length, 0);
});

test("Qloo search makes one fixed bounded GET with the key only in headers and issues a signed choice", async () => {
  const fake = stub(() => Response.json(candidateBody()));
  const service = createQlooService({ credential: fixtureKey, fetcher: fake.fetcher, signingKey, now: () => 1000 });
  const result = await service.search({ query: "  Synthetic film  ", kind: "movie" });
  assert.equal(result.status, 200);
  assert(result.body.ok);
  assert.equal(result.body.candidates[0].name, movie.name);
  assert("token" in result.body.candidates[0].reference);
  assert(!JSON.stringify(result.body).includes(fixtureKey));
  assert.equal(fake.calls.length, 1);
  const call = fake.calls[0];
  assert.equal(call.url.origin, "https://hackathon.api.qloo.com");
  assert.equal(call.url.pathname, "/search");
  assert.deepEqual(Object.fromEntries(call.url.searchParams), { query: "Synthetic film", types: "urn:entity:movie", take: "3" });
  assert.equal(new Headers(call.options.headers).get("X-Api-Key"), fixtureKey);
  assert.equal(call.options.method, "GET");
  assert.equal(call.options.cache, "no-store");
  assert.equal(call.options.redirect, "manual");
  assert(call.options.signal instanceof AbortSignal);
  assert(!call.url.href.includes(fixtureKey));
});

test("Qloo artist searches preserve distinct candidates without automatically confirming one", async () => {
  const fake = stub(() => Response.json(candidateBody("artist")));
  const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).search({ query: "Synthetic", kind: "artist" });
  assert(result.body.ok);
  assert.equal(result.body.candidates.length, 1);
  assert.equal(result.body.candidates[0].kind, "artist");
  assert.equal(result.body.candidates[0].entityId, musician.entityId);
});

test("Qloo rank derives four supported books from seven eligible sample books and preserves provider order", async () => {
  const fake = stub(() => Response.json(rankedBody()));
  const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).rank(rankRequest());
  assert.equal(result.status, 200);
  assert(result.body.ok);
  assert.deepEqual(result.body.ranked.map((book) => book.localId), ["the-guide", "malgudi-days", "the-namesake", "the-god-of-small-things"]);
  assert.equal(result.body.eligibleCount, 7);
  assert.equal(result.body.supportedCount, 4);
  assert.equal(result.body.assessedCount, 4);
  assert.deepEqual(result.body.unassessed.map((book) => book.localId).sort(), ["godaan", "pather-panchali", "the-blue-umbrella"]);
  assert(result.body.unassessed.every((book) => book.reason === "unresolved"));
  assert.deepEqual(result.body.interests.map((interest) => interest.entityId), [movie.entityId, musician.entityId]);
  assert.equal(result.body.ranked[0].affinity, 0.8);
  assert.deepEqual(result.body.ranked[0].contributions, [{ interestId: movie.entityId, score: 0.6 }, { interestId: musician.entityId, score: 0.4 }]);
  assert.deepEqual(result.body.aggregate, [{ interestId: movie.entityId, avgScore: 0.6 }, { interestId: musician.entityId, avgScore: 0.4 }]);
  assert.deepEqual(result.body.explanationWarnings, []);
  assert.equal(fake.calls.length, 1);
  const params = fake.calls[0].url.searchParams;
  assert.equal(fake.calls[0].url.pathname, "/v2/insights");
  assert.equal(params.get("filter.type"), "urn:entity:book");
  assert.equal(params.get("sort_by"), "affinity");
  assert.equal(params.get("feature.explainability"), "true");
  assert.equal(params.get("take"), "4");
  assert.equal(params.get("signal.interests.entities"), `${movie.entityId},${musician.entityId}`);
  assert(!params.get("filter.results.entities")?.includes(SAMPLE_QLOO_MAPPINGS["the-palace-of-illusions"]));
  assert.equal([...params].length, 6);
});

test("Qloo rank applies filters first, deduplicates confirmed signals, and identifies unreturned supported books", async () => {
  const fake = stub(() => Response.json(rankedBody(["the-guide"])));
  const request = rankRequest();
  request.filters = createExampleInputs().filters;
  request.interests = [references[0], references[0]];
  const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).rank(request);
  assert(result.body.ok);
  assert.equal(result.body.eligibleCount, 3);
  assert.equal(result.body.supportedCount, 2);
  assert.equal(result.body.assessedCount, 1);
  assert.equal(result.body.interests.length, 1);
  assert.deepEqual(result.body.unassessed, [
    { localId: "malgudi-days", reason: "not_returned" }, { localId: "the-blue-umbrella", reason: "unresolved" },
  ]);
  const params = fake.calls[0].url.searchParams;
  assert.equal(params.get("take"), "2");
  assert.equal(params.get("signal.interests.entities"), movie.entityId);
  assert(!params.get("filter.results.entities")?.includes(SAMPLE_QLOO_MAPPINGS["the-namesake"]));
});

test("Qloo rank rejects imported inventory, client mappings and tampered request fields without a request", async () => {
  const fake = stub(() => Response.json(rankedBody()));
  const service = createQlooService({ credential: fixtureKey, fetcher: fake.fetcher });
  const request = rankRequest();
  const cases = [
    { ...request, catalogueSource: "imported" }, { ...request, catalogue: [] }, { ...request, mappings: {} },
    { ...request, baseURL: "https://example.invalid" }, { ...request, credential: "attacker" },
    { ...request, interests: [] }, { ...request, interests: Array(6).fill(references[0]) },
    { ...request, interests: [{ preset: "a", index: 2 }] }, { ...request, interests: [{ entityId: movie.entityId, name: "Spoof" }] },
    { ...request, interests: [{ ...references[0], name: "Spoof" }] },
    { ...request, filters: { ...filters, maxPrice: "-1" } }, { ...request, filters: { ...filters, maxPages: "" } },
    { ...request, filters: { ...filters, languages: ["Klingon"] } },
    { ...request, filters: { ...filters, languages: ["English", "English"] } },
    { ...request, filters: { ...filters, inventory: [] } },
  ];
  for (const input of cases) assert.equal((await service.rank(input)).status, 400);
  assert.equal(fake.calls.length, 0);
});

test("Qloo rank refuses fewer than two supported eligible books without sending a request", async () => {
  const fake = stub(() => Response.json(rankedBody()));
  const service = createQlooService({ credential: fixtureKey, fetcher: fake.fetcher });
  for (const maxPrice of ["200", "100"]) {
    const result = await service.rank({ ...rankRequest(), filters: { maxPrice, maxPages: "100", languages: ["English"] } });
    assert.equal(result.status, 400);
    assert(!result.body.ok);
    assert.equal(result.body.error.code, "INSUFFICIENT_SUPPORTED_BOOKS");
  }
  assert.equal(fake.calls.length, 0);
});

test("Qloo signed search references can be confirmed without another entity lookup", async () => {
  let requests = 0;
  const fake = stub(() => Response.json(requests++ === 0 ? candidateBody() : rankedBody()));
  const service = createQlooService({ credential: fixtureKey, fetcher: fake.fetcher, signingKey, now: () => 1000 });
  const reference = confirmedToken((await service.search({ query: "Synthetic", kind: "movie" })).body);
  const result = await service.rank({ ...rankRequest(), interests: [reference] });
  assert(result.body.ok);
  assert.equal(result.body.interests[0].name, movie.name);
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(fake.calls.map((call) => call.url.pathname), ["/search", "/v2/insights"]);
});

test("Qloo signed references expire after thirty minutes and reject payload/signature tampering", async () => {
  let clock = 1000;
  const fake = stub(() => Response.json(candidateBody()));
  const service = createQlooService({ credential: fixtureKey, fetcher: fake.fetcher, signingKey, now: () => clock });
  const reference = confirmedToken((await service.search({ query: "Synthetic", kind: "movie" })).body);
  const [payload, signature] = reference.token.split(".");
  const altered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, "base64url").toString()), name: "Spoof" })).toString("base64url");
  for (const token of [`${altered}.${signature}`, `${payload}.AAAA`, "bad-token"]) {
    assert.equal((await service.rank({ ...rankRequest(), interests: [{ token }] })).status, 400);
  }
  clock += 30 * 60 * 1000;
  assert.equal((await service.rank({ ...rankRequest(), interests: [reference] })).status, 400);
  assert.equal(fake.calls.length, 1);
});

for (const status of [301, 401, 403, 429, 500, 503]) {
  test(`Qloo HTTP ${status} is sanitized without retries, redirects or sample fallback`, async () => {
    const fake = stub(() => Response.json({ message: `RAW ${fixtureKey}`, apiKey: fixtureKey }, { status }));
    const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).rank(rankRequest());
    assert(!result.body.ok);
    assert.equal(result.body.error.upstreamStatus, status);
    assert.equal(result.status, status === 429 ? 429 : 502);
    assert.equal(fake.calls.length, 1);
    assert(!JSON.stringify(result.body).includes(fixtureKey));
    assert(!JSON.stringify(result.body).includes("RAW"));
    assert(!JSON.stringify(result.body).includes("https://"));
  });
}

test("Qloo transport errors do not expose raw exceptions or trigger fallback", async () => {
  const fake = stub(() => { throw new Error(`RAW ${fixtureKey}`); });
  const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).search({ query: "Synthetic", kind: "movie" });
  assert.equal(result.status, 502);
  assert(!JSON.stringify(result.body).includes(fixtureKey));
  assert.equal(fake.calls.length, 1);
});

test("Qloo's deadline covers reading the response body and aborts once", async () => {
  const fake = stub((_url, options) => new Response(new ReadableStream({
    start(controller) { options.signal?.addEventListener("abort", () => controller.error(new Error("RAW aborted"))); },
  })));
  const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher, timeoutMs: 5 }).rank(rankRequest());
  assert.equal(result.status, 504);
  assert(!result.body.ok);
  assert.equal(result.body.error.code, "QLOO_TIMEOUT");
  assert.equal(fake.calls.length, 1);
  assert.equal(fake.calls[0].options.signal?.aborted, true);
});

for (const body of ["not JSON", JSON.stringify({ results: "wrong shape" }), '"' + "x".repeat(1024 * 1024) + '"']) {
  test("Qloo rejects invalid, oversized, or incompatible response bodies", async () => {
    const fake = stub(() => new Response(body));
    const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).rank(rankRequest());
    assert.equal(result.status, 502);
    assert.equal(fake.calls.length, 1);
  });
}

test("Qloo ranking rejects foreign, duplicate, and wrong-type returned entities without fallback", async () => {
  for (const mutate of [
    (body: ReturnType<typeof rankedBody>) => { body.results.entities[0].entity_id = foreign; },
    (body: ReturnType<typeof rankedBody>) => { body.results.entities[1].entity_id = body.results.entities[0].entity_id.toLowerCase(); },
    (body: ReturnType<typeof rankedBody>) => { body.results.entities[0].types = ["urn:entity:movie"]; },
  ]) {
    const body = rankedBody();
    mutate(body);
    const fake = stub(() => Response.json(body));
    const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).rank(rankRequest());
    assert.equal(result.status, 502);
    assert(!result.body.ok);
    assert.equal(result.body.error.code, "QLOO_RESPONSE_INVALID");
    assert.equal(fake.calls.length, 1);
  }
});

test("Qloo search rejects duplicate or wrong-kind candidates and accepts an empty result", async () => {
  for (const body of [
    { results: [candidateBody().results[0], candidateBody().results[0]] }, candidateBody("artist"),
    { results: [{ ...candidateBody().results[0], entity_id: "invalid" }] },
  ]) {
    const fake = stub(() => Response.json(body));
    assert.equal((await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).search({ query: "Synthetic", kind: "movie" })).status, 502);
  }
  const empty = stub(() => Response.json({ results: [] }));
  const result = await createQlooService({ credential: fixtureKey, fetcher: empty.fetcher }).search({ query: "Synthetic", kind: "movie" });
  assert.deepEqual(result.body, { ok: true, candidates: [] });
});

test("Qloo preserves nullable affinity and replaces upstream warning text with a fixed explanation", async () => {
  const body = { results: { entities: [{ entity_id: SAMPLE_QLOO_MAPPINGS["the-guide"], query: { affinity: "not numeric" } }] },
    query: { explainability: { warning: `RAW ${fixtureKey}` } } };
  const fake = stub(() => Response.json(body));
  const result = await createQlooService({ credential: fixtureKey, fetcher: fake.fetcher }).rank(rankRequest());
  assert(result.body.ok);
  assert.equal(result.body.ranked[0].affinity, null);
  assert.deepEqual(result.body.ranked[0].contributions, []);
  assert.deepEqual(result.body.aggregate, []);
  assert(result.body.explanationWarnings.length > 0);
  assert(!JSON.stringify(result.body).includes(fixtureKey));
  assert(!JSON.stringify(result.body).includes("RAW"));
});

test("Qloo uses the observed types array and nested affinity rather than assuming legacy fields", async () => {
  const searchBody = { results: [{ ...candidateBody().results[0], subtype: "urn:entity:artist" }] };
  const searchFake = stub(() => Response.json(searchBody));
  const search = await createQlooService({ credential: fixtureKey, fetcher: searchFake.fetcher }).search({ query: "Synthetic", kind: "movie" });
  assert(search.body.ok, "The observed matching types array determines the search kind");
  const legacyOnly = { results: [{ entity_id: movie.entityId, name: movie.name, subtype: "urn:entity:movie" }] };
  const legacyFake = stub(() => Response.json(legacyOnly));
  assert.equal((await createQlooService({ credential: fixtureKey, fetcher: legacyFake.fetcher }).search({ query: "Synthetic", kind: "movie" })).status, 502);
  const rankBody = { results: { entities: [{ entity_id: SAMPLE_QLOO_MAPPINGS["the-guide"], affinity: 0.9 }] } };
  const rankFake = stub(() => Response.json(rankBody));
  const ranked = await createQlooService({ credential: fixtureKey, fetcher: rankFake.fetcher }).rank(rankRequest());
  assert(ranked.body.ok);
  assert.equal(ranked.body.ranked[0].affinity, null, "Only the observed query.affinity is used");
});

test("Qloo rejects oversized input before touching the network", async () => {
  const fake = stub(() => Response.json(rankedBody()));
  const service = createQlooService({ credential: fixtureKey, fetcher: fake.fetcher });
  assert.equal((await service.rank({ ...rankRequest(), privateCatalogue: "x".repeat(8193) })).status, 400);
  assert.equal(fake.calls.length, 0);
});
