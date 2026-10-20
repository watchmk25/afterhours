import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_CATALOGUE } from "../lib/catalogue.ts";
import { createDefaultInputs, filterBooks } from "../lib/workspace.ts";
import {
  BOOK_GUIDE_ID, buildSearchPlan, eligibleShortlist, rankingParams,
  reserveRequest, verifyMembership, type Resolution, type ShortlistItem,
} from "../scripts/qloo-feasibility-model.ts";

// UUIDs below are synthetic test fixtures, never asserted to be Qloo entities.
const fixtureId = (index: number) => `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
const reviewed = (key: string, index: number): Resolution => ({
  key, entityId: fixtureId(index), status: "resolved", evidence: "Synthetic review fixture only.",
});
const allBooks = () => SAMPLE_CATALOGUE.map((book, index) => reviewed(book.id, index + 1));
const shortlist = (): ShortlistItem[] => eligibleShortlist(allBooks());

test("feasibility search plan has exactly nine book searches and four fixed audience searches", () => {
  const plan = buildSearchPlan();
  assert.equal(plan.length, 13);
  assert.equal(new Set(plan.map((item) => item.key)).size, 13);
  assert.deepEqual(plan.filter((item) => item.type === "book"), SAMPLE_CATALOGUE
    .filter((book) => book.id !== "the-guide")
    .map((book) => ({ key: book.id, query: book.title, type: "book" })));
  assert.deepEqual(plan.slice(-4), [
    { key: "audience-a-film", query: "Amélie", type: "movie" },
    { key: "audience-a-artist", query: "Norah Jones", type: "artist" },
    { key: "audience-b-film", query: "Interstellar", type: "movie" },
    { key: "audience-b-artist", query: "Hans Zimmer", type: "artist" },
  ]);
  assert(!plan.some((item) => item.key === "the-guide"));
});

test("search plans are fresh and cannot mutate the catalogue or next plan", () => {
  const plan = buildSearchPlan();
  plan[0].query = "Synthetic mutation";
  plan.at(-1)!.query = "Synthetic mutation";
  assert.equal(buildSearchPlan()[0].query, SAMPLE_CATALOGUE[0].title);
  assert.equal(buildSearchPlan().at(-1)!.query, "Hans Zimmer");
});

test("shortlist reuses the workspace default stock, price, page, language filtering and title order", () => {
  const expected = filterBooks(SAMPLE_CATALOGUE, createDefaultInputs().filters);
  assert.deepEqual(shortlist().map((book) => book.localId), expected.map((book) => book.id));
  assert.deepEqual(shortlist().map((book) => book.title), [
    "Godaan", "Malgudi Days", "Pather Panchali", "The Blue Umbrella",
    "The God of Small Things", "The Guide", "The Namesake",
  ]);
  assert(!shortlist().some((book) => ["a-suitable-boy", "the-palace-of-illusions", "raag-darbari"].includes(book.localId)));
});

test("missing and unresolved books are excluded atomically without an automatic Guide match", () => {
  assert.deepEqual(eligibleShortlist([]), []);
  const resolutions: Resolution[] = [
    reviewed("malgudi-days", 1),
    { key: "the-guide", entityId: null, status: "unresolved", evidence: "Not reviewed." },
    reviewed("audience-a-film", 2),
  ];
  assert.deepEqual(eligibleShortlist(resolutions), [{ localId: "malgudi-days", title: "Malgudi Days", entityId: fixtureId(1) }]);
  assert.equal(BOOK_GUIDE_ID, "DF4272D0-A6BA-445B-88DC-172A56B5D183");
  assert.deepEqual(eligibleShortlist([{
    key: "the-guide", entityId: BOOK_GUIDE_ID, status: "resolved", evidence: "Organizer's previous verified title and author match.",
  }]), [{ localId: "the-guide", title: "The Guide", entityId: BOOK_GUIDE_ID }]);
});

for (const invalid of [
  { ...reviewed("the-guide", 1), entityId: null },
  { ...reviewed("the-guide", 1), entityId: "not-a-uuid" },
  { ...reviewed("the-guide", 1), evidence: " \t " },
]) {
  test("resolved books require a valid UUID and nonblank review evidence", () => {
    assert.throws(() => eligibleShortlist([invalid]));
  });
}

test("resolution keys and resolved Qloo IDs must be unique across books and audience seeds", () => {
  assert.throws(() => eligibleShortlist([reviewed("the-guide", 1), reviewed("the-guide", 2)]), /keys/);
  assert.throws(() => eligibleShortlist([reviewed("not-in-this-experiment", 1)]), /keys/);
  assert.throws(() => eligibleShortlist([reviewed("the-guide", 1), reviewed("audience-a-film", 1)]), /unique/);
  assert.throws(() => eligibleShortlist([
    { ...reviewed("the-guide", 1), entityId: BOOK_GUIDE_ID },
    { ...reviewed("malgudi-days", 2), entityId: BOOK_GUIDE_ID.toLowerCase() },
  ]), /unique/);
});

test("ranking parameters include only the eligible resolved book IDs and exactly two audience signals", () => {
  const books = shortlist();
  const signals = [fixtureId(100), fixtureId(101)];
  assert.deepEqual(rankingParams(books, signals), {
    "filter.type": "urn:entity:book",
    "filter.results.entities": books.map((book) => book.entityId).join(","),
    "signal.interests.entities": signals.join(","),
    "feature.explainability": true,
    sort_by: "affinity",
    take: books.length,
  });
});

test("ranking refuses fewer than two or more than fifty books and invalid or duplicate IDs", () => {
  const signals = [fixtureId(100), fixtureId(101)];
  assert.throws(() => rankingParams([], signals), /2 and 50/);
  assert.throws(() => rankingParams(shortlist().slice(0, 1), signals), /2 and 50/);
  const fifty = Array.from({ length: 50 }, (_, index) => ({ localId: `fixture-${index}`, title: `Synthetic ${index}`, entityId: fixtureId(index + 1) }));
  assert.equal(rankingParams(fifty, signals).take, 50);
  assert.throws(() => rankingParams([...fifty, { localId: "fixture-51", title: "Synthetic 51", entityId: fixtureId(51) }], signals), /2 and 50/);
  assert.throws(() => rankingParams([shortlist()[0], shortlist()[0]], signals), /unique/);
  assert.throws(() => rankingParams([{ ...shortlist()[0], entityId: "invalid" }, shortlist()[1]], signals), /UUID/);
});

test("ranking requires exactly two valid, distinct signal UUIDs", () => {
  for (const signals of [[], [fixtureId(100)], [fixtureId(100), fixtureId(101), fixtureId(102)], [fixtureId(100), fixtureId(100)], [fixtureId(100), "invalid"], [BOOK_GUIDE_ID, BOOK_GUIDE_ID.toLowerCase()]]) {
    assert.throws(() => rankingParams(shortlist(), signals));
  }
});

test("membership allows rank changes and omissions while reporting missing books separately", () => {
  const books = shortlist();
  assert.deepEqual(verifyMembership([...books].reverse().map((book) => ({ entity_id: book.entityId })), books), { missing: [] });
  assert.deepEqual(verifyMembership([{ entity_id: books[0].entityId }], books), { missing: books.slice(1) });
  assert.deepEqual(verifyMembership([], books), { missing: books });
});

test("membership rejects foreign and repeated entities including differently cased UUIDs", () => {
  const books = shortlist();
  assert.throws(() => verifyMembership([{ entity_id: fixtureId(200) }], books), /outside/);
  assert.throws(() => verifyMembership([{ entity_id: books[0].entityId }, { entity_id: books[0].entityId }], books), /duplicate/);
  const guide = [{ localId: "the-guide", title: "The Guide", entityId: BOOK_GUIDE_ID }];
  assert.deepEqual(verifyMembership([{ entity_id: BOOK_GUIDE_ID.toLowerCase() }], guide), { missing: [] });
  assert.throws(() => verifyMembership([{ entity_id: BOOK_GUIDE_ID }, { entity_id: BOOK_GUIDE_ID.toLowerCase() }], guide), /duplicate/);
  assert.throws(() => verifyMembership([{ entity_id: "invalid" }], books), /UUID/);
});

test("request budget permits thirteen searches and two rankings but rejects a sixteenth request", () => {
  let count = 0;
  for (let index = 0; index < buildSearchPlan().length; index += 1) count = reserveRequest(count);
  assert.equal(count, 13);
  count = reserveRequest(count);
  count = reserveRequest(count);
  assert.equal(count, 15);
  assert.throws(() => reserveRequest(count), /exhausted/);
  assert.equal(count, 15);
});

test("budget validates its counters and supports only a smaller explicit cap", () => {
  assert.equal(reserveRequest(0, 1), 1);
  assert.throws(() => reserveRequest(1, 1), /exhausted/);
  for (const count of [-1, 0.5, NaN, Infinity]) assert.throws(() => reserveRequest(count), /Invalid/);
  for (const max of [0, 16, 1.5, NaN]) assert.throws(() => reserveRequest(0, max), /Invalid/);
});
