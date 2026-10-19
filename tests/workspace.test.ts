import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_CATALOGUE } from "../lib/catalogue.ts";
import type { FilterInputs } from "../lib/types.ts";
import {
  createDefaultInputs,
  createExampleInputs,
  catalogueLanguages,
  filterBooks,
  getEligibleSelection,
  LANGUAGES,
  validateFilters,
} from "../lib/workspace.ts";

const broadFilters: FilterInputs = {
  maxPrice: "2000",
  maxPages: "2000",
  languages: [...LANGUAGES],
};

test("catalogue has ten distinct identifiable books across all sample languages", () => {
  assert.equal(SAMPLE_CATALOGUE.length, 10);
  assert.equal(new Set(SAMPLE_CATALOGUE.map((book) => book.id)).size, 10);
  assert.deepEqual(
    [...new Set(SAMPLE_CATALOGUE.map((book) => book.language))].sort(),
    [...LANGUAGES].sort(),
  );
  assert.equal(SAMPLE_CATALOGUE.filter((book) => book.stock === 0).length, 2);
  assert(SAMPLE_CATALOGUE.every((book) => book.title && book.author));
});

test("eligibility excludes out-of-stock books and sorts titles without mutating fixtures", () => {
  const before = SAMPLE_CATALOGUE.map((book) => book.id);
  const eligible = filterBooks(SAMPLE_CATALOGUE, broadFilters);
  assert.equal(eligible.length, 8);
  assert(eligible.every((book) => book.stock > 0));
  assert.deepEqual(
    eligible.map((book) => book.title),
    [...eligible.map((book) => book.title)].sort((a, b) => a.localeCompare(b, "en")),
  );
  assert.deepEqual(SAMPLE_CATALOGUE.map((book) => book.id), before);
});

test("price and page boundaries are inclusive and each limit is enforced", () => {
  const filters = { ...broadFilters, maxPrice: "299.00", maxPages: "256" };
  assert.deepEqual(
    filterBooks(SAMPLE_CATALOGUE, filters).map((book) => book.id),
    ["the-blue-umbrella", "the-guide"],
  );
  assert.deepEqual(
    filterBooks(SAMPLE_CATALOGUE, { ...filters, maxPrice: "298.99" }).map((book) => book.id),
    ["the-blue-umbrella"],
  );
  assert.deepEqual(
    filterBooks(SAMPLE_CATALOGUE, { ...filters, maxPages: "255" }).map((book) => book.id),
    ["the-blue-umbrella"],
  );
});

test("one language narrows results and no languages produces validation and no results", () => {
  assert.deepEqual(
    filterBooks(SAMPLE_CATALOGUE, { ...broadFilters, languages: ["Hindi"] }).map((book) => book.id),
    ["godaan"],
  );
  assert.deepEqual(
    filterBooks(SAMPLE_CATALOGUE, { ...broadFilters, languages: ["Bengali"] }).map((book) => book.id),
    ["pather-panchali"],
  );
  const noLanguages = { ...broadFilters, languages: [] };
  assert(validateFilters(noLanguages).languages);
  assert.deepEqual(filterBooks(SAMPLE_CATALOGUE, noLanguages), []);
});

test("valid low limits can yield a helpful empty-results condition without validation errors", () => {
  const noMatches = { ...broadFilters, maxPrice: "100", maxPages: "50" };
  assert.deepEqual(validateFilters(noMatches), {});
  assert.deepEqual(filterBooks(SAMPLE_CATALOGUE, noMatches), []);
});

test("price validation rejects empty, non-finite, negative and overprecision values", () => {
  for (const maxPrice of ["", " ", "0", "-1", "NaN", "Infinity", "1e3", "12.345", "abc", "9".repeat(400)]) {
    const filters = { ...broadFilters, maxPrice };
    assert(validateFilters(filters).maxPrice, `Price ${JSON.stringify(maxPrice)} must be invalid`);
    assert.deepEqual(filterBooks(SAMPLE_CATALOGUE, filters), []);
  }
  for (const maxPrice of [".50", "0.01", "1", "299.99", " 299.00 "]) {
    assert.equal(validateFilters({ ...broadFilters, maxPrice }).maxPrice, undefined);
  }
});

test("page validation requires a positive safe whole number", () => {
  for (const maxPages of ["", "0", "-2", "2.5", "300.0", "1e3", "Infinity", "9007199254740992"]) {
    const filters = { ...broadFilters, maxPages };
    assert(validateFilters(filters).maxPages, `Pages ${JSON.stringify(maxPages)} must be invalid`);
    assert.deepEqual(filterBooks(SAMPLE_CATALOGUE, filters), []);
  }
  assert.equal(validateFilters({ ...broadFilters, maxPages: " 300 " }).maxPages, undefined);
});

test("default and example factories return independent inputs for reset and load example", () => {
  const defaults = createDefaultInputs();
  const example = createExampleInputs();
  assert.deepEqual(defaults.audience, { books: "", films: "", musicians: "" });
  assert.equal(defaults.filters.maxPrice, "600");
  assert.equal(defaults.filters.maxPages, "400");
  assert.deepEqual(defaults.filters.languages, [...LANGUAGES]);
  assert.deepEqual(example.filters, { maxPrice: "450", maxPages: "300", languages: ["English"] });
  assert(example.audience.books && example.audience.films && example.audience.musicians);
  assert.equal(filterBooks(SAMPLE_CATALOGUE, defaults.filters).length, 7);
  assert.equal(filterBooks(SAMPLE_CATALOGUE, example.filters).length, 3);
  defaults.audience.books = "Changed";
  defaults.filters.languages.pop();
  example.filters.languages.push("Hindi");
  assert.deepEqual(createDefaultInputs().audience, { books: "", films: "", musicians: "" });
  assert.deepEqual(createDefaultInputs().filters.languages, [...LANGUAGES]);
  assert.deepEqual(createExampleInputs().filters.languages, ["English"]);
});

test("audience favourites do not affect eligibility", () => {
  const inputs = createDefaultInputs();
  const before = filterBooks(SAMPLE_CATALOGUE, inputs.filters);
  inputs.audience = { books: "Any book", films: "Any film", musicians: "Any musician" };
  assert.deepEqual(filterBooks(SAMPLE_CATALOGUE, inputs.filters), before);
});

test("selection is valid only while eligible and a cleared selection does not return", () => {
  const eligible = filterBooks(SAMPLE_CATALOGUE, broadFilters);
  let selectedId: string | null = "the-guide";
  assert.equal(getEligibleSelection(selectedId, eligible)?.id, "the-guide");
  const narrowed = filterBooks(SAMPLE_CATALOGUE, { ...broadFilters, maxPages: "100" });
  const selectionAfterFiltering = getEligibleSelection(selectedId, narrowed);
  selectedId = selectionAfterFiltering?.id ?? null;
  assert.equal(selectionAfterFiltering, null);
  assert.equal(getEligibleSelection(selectedId, eligible), null);
  assert.equal(getEligibleSelection("unknown-local-id", eligible), null);
  assert.equal(getEligibleSelection("the-palace-of-illusions", eligible), null);
});

test("active catalogue supplies languages for filtering and fresh reset/example inputs", () => {
  const catalogue = [
    { ...SAMPLE_CATALOGUE[0], id: "local-one", language: "Tamil", pages: 120, priceInr: 0 },
    { ...SAMPLE_CATALOGUE[1], id: "local-two", language: "Marathi", pages: 200 },
    { ...SAMPLE_CATALOGUE[2], id: "local-three", language: "Tamil", stock: 0 },
  ];
  const languages = catalogueLanguages(catalogue);
  assert.deepEqual(languages, ["Marathi", "Tamil"]);
  const defaults = createDefaultInputs(languages);
  assert.deepEqual(defaults.filters.languages, languages);
  assert.equal(defaults.filters.maxPrice, "600");
  assert.equal(defaults.filters.maxPages, "400");
  assert.deepEqual(defaults.audience, { books: "", films: "", musicians: "" });
  assert.equal(validateFilters(defaults.filters, languages).languages, undefined);
  assert.equal(filterBooks(catalogue, defaults.filters).length, 2);
  assert.equal(filterBooks(catalogue, { ...defaults.filters, languages: ["Tamil"] }).length, 1);
  assert(validateFilters({ ...defaults.filters, languages: ["English"] }, languages).languages);
  assert.deepEqual(createExampleInputs(languages).filters.languages, languages);
  assert.deepEqual(createExampleInputs(["Tamil", "English"]).filters.languages, ["English"]);
  defaults.filters.languages.pop();
  assert.deepEqual(createDefaultInputs(languages).filters.languages, languages);
});
