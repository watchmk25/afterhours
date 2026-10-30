import assert from "node:assert/strict";
import test from "node:test";
import { CLUB_CSV_TEMPLATE, parseClubCsv } from "../lib/club-import.ts";

test("generic template and original book format stay browser-local with separate local identities", () => {
  const generic = parseClubCsv(CLUB_CSV_TEMPLATE);
  assert(generic.ok); assert.equal(generic.resources.length, 2);
  assert.equal(generic.resources[0].kind, "book"); assert.equal(generic.resources[1].kind, "artist");
  assert(generic.resources.every((resource) => !resource.reference));
  const old = parseClubCsv("title,author,price_inr,pages,language,stock\r\nThe Guide,R. K. Narayan,299,220,English,4\r\n");
  assert(old.ok); assert.equal(old.format, "book");
  assert.deepEqual(old.resources[0].facts, { price: 299, currency: "INR", priceBasis: "per_person", pages: 220, language: "English", stock: 4 });
  assert(!old.resources[0].localId.includes("DF4272"));
});

test("BOM, CRLF, quoted commas, escaped quotes and quoted newlines preserve names and creators", () => {
  const parsed = parseClubCsv('\uFEFFtype,name,creator\r\nbook,"A, book","An ""Author"""\r\nmovie,"A\r\nfilm",Director\r\n');
  assert(parsed.ok); assert.equal(parsed.resources[0].name, "A, book");
  assert.equal(parsed.resources[0].creator, 'An "Author"'); assert.equal(parsed.resources[1].name, "A\r\nfilm");
});

test("duplicate names with distinct creators and types are never silently merged", () => {
  const parsed = parseClubCsv("type,name,creator\nbook,Same,One\nbook,Same,Two\nmovie,Same,Three");
  assert(parsed.ok); assert.equal(parsed.resources.length, 3); assert.equal(new Set(parsed.resources.map((item) => item.localId)).size, 3);
});

for (const [name, csv, column] of [
  ["missing header", "name\nName", "type"],
  ["duplicate header", "type,name,name\nmovie,A,B", "name"],
  ["empty name", "type,name\nmovie,", "name"],
  ["unsupported member column", "type,name,email\nmovie,Film,private@example.test", "email"],
  ["unsupported songs", "type,name\nsong,Track", "type"],
  ["absent author", "type,name\nbook,Book", "creator"],
  ["negative cost", "type,name,price,currency,price_basis\nplace,Cafe,-1,INR,per_person", "price"],
  ["infinite cost", "type,name,price,currency,price_basis\nplace,Cafe,Infinity,INR,per_person", "price"],
  ["missing currency", "type,name,price,price_basis\nplace,Cafe,100,per_person", "currency"],
  ["missing basis", "type,name,price,currency\nplace,Cafe,100,INR", "price_basis"],
  ["price unit suffix", "type,name,price,currency,price_basis\nplace,Cafe,100INR,INR,total_event", "price"],
  ["price without number", "type,name,currency\nplace,Cafe,INR", "price"],
  ["fractional stock", "type,name,creator,stock\nbook,Book,Author,1.2", "stock"],
  ["zero pages", "type,name,creator,pages\nbook,Book,Author,0", "pages"],
  ["irrelevant pages", "type,name,pages\nartist,Artist,100", "pages"],
  ["wrong external type", "type,name,external_id_type,external_id\nplace,Cafe,isbn13,9780141189329", "external_id"],
] as const) test(`CSV rejects ${name} atomically with useful column`, () => {
  const result = parseClubCsv(csv); assert(!result.ok); assert(result.errors.some((error) => error.column === column));
  assert(!("resources" in result));
});

test("malformed quotes, oversized bytes, 501 rows and invalid rows never return a partial import", () => {
  for (const csv of ['type,name\nmovie,"unclosed', 'type,name\nmovie,un"quoted', 'type,name\nmovie,"closed"junk', "type,name\nmovie," + "x".repeat(256 * 1024), "type,name\n" + Array.from({ length: 501 }, (_, i) => `movie,Film${i}`).join("\n"), "type,name\nmovie,Valid\nsong,Invalid"]) {
    const result = parseClubCsv(csv); assert(!result.ok); assert(result.errors.length > 0); assert(!("resources" in result));
  }
  const boundary = parseClubCsv("type,name\n" + Array.from({ length: 500 }, (_, i) => `movie,Film${i}`).join("\n"));
  assert(boundary.ok); assert.equal(boundary.resources.length, 500);
});

test("reliable external identifiers are retained as unconfirmed data", () => {
  const result = parseClubCsv("type,name,creator,external_id_type,external_id\nbook,Unconfirmed book,Author,isbn13,9780306406157\nmovie,Interstellar,Nolan,imdb,tt0816692\nartist,Norah Jones,,spotify,0123456789ABCDEFGHIJKL");
  assert(result.ok); assert.equal(result.resources.length, 3); assert(result.resources.every((item) => item.externalId && !item.reference));
});

test("CSV constraints fit the bounded planning contract and reject invalid ISBN checksums", () => {
  for (const csv of [
    "type,name,creator,pages\nbook,Book,Author,100001",
    "type,name,duration_minutes\nmovie,Film,100001",
    "type,name,creator,language\nbook,Book,Author," + "a".repeat(81),
    "type,name,creator,external_id_type,external_id\nbook,Book,Author,isbn13,9780306406158",
    "title,author,price_inr,pages,language,stock\nBook,Author,299,100001,English,2",
  ]) assert.equal(parseClubCsv(csv).ok, false);
});
