import assert from "node:assert/strict";
import test from "node:test";
import {
  CSV_REQUIRED_HEADERS,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  parseCatalogueCsv,
} from "../lib/catalogue-import.ts";

const headers = CSV_REQUIRED_HEADERS.join(",");
const row = "The Guide,R. K. Narayan,299,256,English,18";
const csv = (rows = [row]) => [headers, ...rows].join("\n");

function expectError(source: string, message: RegExp, column?: string, row?: number) {
  const result = parseCatalogueCsv(source);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error("Expected invalid CSV");
  assert(!("books" in result), "Invalid files never return a partial inventory");
  assert(result.errors.some((error) => message.test(error.message)
    && (column === undefined || error.column === column)
    && (row === undefined || error.row === row)), JSON.stringify(result.errors));
  return result;
}

test("valid catalogue fields map to books with independent local IDs", () => {
  const first = parseCatalogueCsv(csv([row, row]));
  const second = parseCatalogueCsv(csv());
  assert(first.ok && second.ok);
  assert.deepEqual(first.books.map(({ id, coverColor, ...book }) => {
    assert.match(id, /^local-import-/);
    assert.match(coverColor, /^#[0-9a-f]{6}$/);
    return book;
  }), Array(2).fill({ title: "The Guide", author: "R. K. Narayan", priceInr: 299, pages: 256, language: "English", stock: 18 }));
  assert.equal(new Set([...first.books, ...second.books].map((book) => book.id)).size, 3);
});

test("BOM, Windows line endings, quoted commas, escaped quotes, and embedded newlines are supported", () => {
  const result = parseCatalogueCsv(`\uFEFF${headers}\r\n"A, B and ""C""","An\r\nAuthor",120.345,42,தமிழ்,3\r\n`);
  assert(result.ok);
  assert.equal(result.books[0].title, 'A, B and "C"');
  assert.equal(result.books[0].author, "An\r\nAuthor");
  assert.equal(result.books[0].language, "தமிழ்");
  assert.equal(result.books[0].priceInr, 120.345);
});

test("headers can be reordered and trimmed, and extra columns are ignored", () => {
  const result = parseCatalogueCsv(' stock ,language,pages,price_inr,author,title,notes\n0, Hindi ,1,0, Author , Title ,"Ignored, notes"');
  assert(result.ok);
  const book = result.books[0];
  assert.equal(book.title, "Title");
  assert.equal(book.author, "Author");
  assert.equal(book.language, "Hindi");
  assert.equal(book.priceInr, 0);
  assert.equal(book.stock, 0);
  assert.equal(book.pages, 1);
});

test("blank lines are ignored but comma-only rows are invalid", () => {
  const result = parseCatalogueCsv(`${headers}\n\n${row}\n \n`);
  assert(result.ok);
  assert.equal(result.books.length, 1);
  expectError(`${headers}\n${row}\n,,,,,`, /must not be empty/, "title", 3);
  expectError(`${headers}\n${row}\n""`, /Expected 6 columns but found 1/, undefined, 3);
});

test("missing and duplicate required headers are rejected, including trimmed duplicates", () => {
  expectError(csv().replace("price_inr", "price"), /Missing required header/, "price_inr", 1);
  expectError(`${headers}, title \n${row},Duplicate`, /Duplicate required header/, "title", 1);
  expectError(csv().replace("title", "Title"), /Missing required header/, "title", 1);
});

test("empty CSV, header-only CSV, and mismatched row widths are rejected", () => {
  expectError("\uFEFF\r\n ", /empty/);
  expectError(headers, /at least one book/);
  expectError(csv(["Title,Author,1,2,English"]), /Expected 6 columns but found 5/, undefined, 2);
  expectError(csv([`${row},Unexpected`]), /Expected 6 columns but found 7/, undefined, 2);
});

test("all text fields are required after trimming and failures are atomic", () => {
  const result = expectError(csv([row, " , ,10,20, ,1"]), /must not be empty/, "title", 3);
  assert(result.errors.some((error) => error.column === "author"));
  assert(result.errors.some((error) => error.column === "language"));
});

test("price must be present, finite, and nonnegative without unnecessary decimal restrictions", () => {
  for (const price of ["", "-1", "Infinity", "NaN", "1e309", "a lot"]) {
    expectError(csv([`Title,Author,${price},10,English,1`]), /finite, nonnegative/, "price_inr", 2);
  }
  for (const price of ["0", "0.001", "3.1415926535", "1e2", "1e308"]) {
    assert(parseCatalogueCsv(csv([`Title,Author,${price},10,English,1`])).ok, price);
  }
});

test("pages require a positive safe integer and stock a nonnegative safe integer", () => {
  for (const pages of ["", "0", "-1", "1.5", "NaN", "Infinity", "9007199254740992"]) {
    expectError(csv([`Title,Author,10,${pages},English,1`]), /Pages must be a positive whole number/, "pages", 2);
  }
  for (const stock of ["", "-1", "0.5", "NaN", "Infinity", "9007199254740992"]) {
    expectError(csv([`Title,Author,10,1,English,${stock}`]), /Stock must be a nonnegative whole number/, "stock", 2);
  }
  assert(parseCatalogueCsv(csv(["Title,Author,0,9007199254740991,English,9007199254740991"])).ok);
});

test("malformed quoting is rejected instead of repairing or silently accepting rows", () => {
  for (const malformed of [
    '"Unclosed title,Author,10,20,English,1',
    'Un"quoted,Author,10,20,English,1',
    '"Title"extra,Author,10,20,English,1',
    '"Title"",Author,10,20,English,1',
    'Title,"Auth"or,10,20,English,1',
  ]) {
    expectError(csv([row, malformed]), /quote|Quoted/, undefined, 3);
  }
  expectError('ti"tle,author,price_inr,pages,language,stock\n' + row, /quote/, "Column 1", 1);
});

test("logical row errors remain accurate when quoted values contain line breaks", () => {
  const result = expectError(csv(['"Title\nLine two",Author,10,20,English,1', "Next,Author,-1,20,English,1"]), /nonnegative/, "price_inr", 3);
  assert.equal(result.errors.length, 1);
});

test("500 data rows are allowed; the 501st rejects the entire file", () => {
  const atLimit = parseCatalogueCsv(csv(Array(MAX_CSV_ROWS).fill(row)));
  assert(atLimit.ok);
  assert.equal(atLimit.books.length, MAX_CSV_ROWS);
  expectError(csv(Array(MAX_CSV_ROWS + 1).fill(row)), /at most 500/);
  expectError(csv([...Array(MAX_CSV_ROWS).fill(row), ",,,,,"]), /at most 500/);
});

test("byte limit includes UTF-8 multibyte text and accepts exactly 256 KiB", () => {
  const skeleton = `${headers}\nTamil தமிழ்,Author,1,1,English,1`;
  const padding = "x".repeat(MAX_CSV_BYTES - new TextEncoder().encode(skeleton).byteLength);
  const atLimit = skeleton.replace("Tamil", padding + "Tamil");
  assert.equal(new TextEncoder().encode(atLimit).byteLength, MAX_CSV_BYTES);
  assert(parseCatalogueCsv(atLimit).ok);
  expectError(atLimit + "x", /256 KiB/);
  expectError("é".repeat(MAX_CSV_BYTES / 2 + 1), /256 KiB/);
});

test("validation errors are bounded and report truncation", () => {
  const result = expectError(csv(Array(30).fill(",,,,English,")), /must not be empty/);
  assert.equal(result.errors.length, 20);
  assert.match(result.errors.at(-1)!.message, /additional validation errors omitted/);
});
