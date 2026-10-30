import Papa from "papaparse";
import { inspectQuoteSyntax, MAX_CSV_BYTES, MAX_CSV_ROWS, parseCatalogueCsv, type CatalogueImportError } from "./catalogue-import.ts";
import { CULTURAL_KINDS, type ClubResource, type ResourceFacts } from "./club-types.ts";

export const CLUB_CSV_TEMPLATE = "type,name,creator,price,currency,price_basis,pages,language,stock,duration_minutes,external_id_type,external_id\r\nbook,The Guide,R. K. Narayan,,,,,,,,,\r\nartist,Norah Jones,,,,,,,,,,\r\n";
const columns = ["type", "name", "creator", "price", "currency", "price_basis", "pages", "language", "stock", "duration_minutes", "external_id_type", "external_id"];
export type ClubImportResult = { ok: true; resources: ClubResource[]; format: "book" | "generic" } | { ok: false; errors: CatalogueImportError[] };

/** Browser-only, all-or-nothing. No imported string is executable or provider evidence. */
export function parseClubCsv(text: string): ClubImportResult {
  const fail = (message: string): ClubImportResult => ({ ok: false, errors: [{ message }] });
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) return fail("CSV files must be 256 KiB or smaller.");
  const source = text.replace(/^\uFEFF/u, "");
  const syntax = inspectQuoteSyntax(source);
  if (syntax.error) return { ok: false, errors: [syntax.error] };
  const parsed = Papa.parse<string[]>(source, { delimiter: ",", skipEmptyLines: false, dynamicTyping: false });
  if (parsed.errors.length) return fail("Malformed CSV quoting or delimiter. No rows were imported.");
  const records = parsed.data.map((fields, index) => ({ fields, row: index + 1 })).filter(({ row }) => !syntax.blankRows.has(row));
  const header = records[0]?.fields.map((value) => value.trim());
  if (!header) return fail("Include headers and at least one resource.");
  if (header.includes("title") || header.includes("price_inr")) {
    const books = parseCatalogueCsv(text);
    if (!books.ok) return books;
    const errors: CatalogueImportError[] = [];
    for (const [index, book] of books.books.entries()) {
      for (const [column, value, limit] of [["title", book.title, 200], ["author", book.author, 200], ["language", book.language, 80]] as const) {
        if (value.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(value)) errors.push({ row: index + 2, column, message: `${column} must be readable text of at most ${limit} characters.` });
      }
      if (book.pages > 100_000 || book.stock > 1_000_000 || book.priceInr > 1_000_000) errors.push({ row: index + 2, column: "values", message: "Use at most 100000 pages, 1000000 stock and 1000000 price." });
    }
    if (errors.length) return { ok: false, errors: errors.slice(0, 20) };
    return { ok: true, format: "book", resources: books.books.map((book) => ({ localId: book.id, kind: "book", name: book.title, creator: book.author,
      facts: { price: book.priceInr, currency: "INR", priceBasis: "per_person", pages: book.pages, language: book.language, stock: book.stock } })) };
  }
  const errors: CatalogueImportError[] = [];
  let errorCount = 0;
  const add = (row: number, column: string, message: string) => { errorCount++; if (errors.length < 19) errors.push({ row, column, message }); };
  for (const required of ["type", "name"]) if (!header.includes(required)) add(1, required, `Missing required header: ${required}.`);
  for (const column of header) {
    if (!columns.includes(column)) add(1, column, "Unsupported column. Use the supplied resource template; personal member data is not supported.");
    if (header.indexOf(column) !== header.lastIndexOf(column)) add(1, column, `Duplicate header: ${column}.`);
  }
  if (errors.length) return { ok: false, errors };
  if (records.length < 2) return fail("Include at least one resource below the headers.");
  if (records.length - 1 > MAX_CSV_ROWS) return fail("A CSV can contain at most 500 data rows. No rows were imported.");
  const resources: ClubResource[] = [];
  for (const { fields, row } of records.slice(1)) {
    if (fields.length !== header.length) { add(row, "record", `Expected ${header.length} columns, found ${fields.length}.`); continue; }
    const value = (column: string) => fields[header.indexOf(column)]?.trim() ?? "";
    const kind = value("type");
    const name = value("name");
    const creator = value("creator");
    if (!CULTURAL_KINDS.includes(kind as ClubResource["kind"])) add(row, "type", "Use book, artist, movie, or place. Songs, images and PDFs are not supported entities.");
    for (const [column, content] of [["name", name], ["creator", creator], ["language", value("language")]]) {
      const limit = column === "language" ? 80 : 200;
      if ((column === "name" && !content) || content.length > limit || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(content)) add(row, column, `${column} must be bounded readable text (at most ${limit} characters).`);
    }
    if (kind === "book" && !creator) add(row, "creator", "Supply the book author so identities can be disambiguated.");
    const facts: ResourceFacts = {};
    for (const [column, key, integer, positive] of [
      ["price", "price", false, false], ["pages", "pages", true, true], ["stock", "stock", true, false], ["duration_minutes", "durationMinutes", true, true],
    ] as const) {
      const raw = value(column);
      if (!raw) continue;
      const number = Number(raw);
      const limit = column === "pages" || column === "duration_minutes" ? 100_000 : 1_000_000;
      if (!/^\d+(?:\.\d+)?$/u.test(raw) || !Number.isFinite(number) || number > limit || (positive && number <= 0) || (integer && !Number.isSafeInteger(number))) {
        add(row, column, `${column} must be a ${positive ? "positive" : "nonnegative"} ${integer ? "whole number" : "number"} up to ${limit}, without a unit suffix.`);
      } else facts[key] = number;
    }
    if (value("pages") && kind !== "book") add(row, "pages", "Page count applies only to books.");
    if (value("language")) { if (kind !== "book") add(row, "language", "Edition language applies only to books."); else facts.language = value("language"); }
    if (value("currency") || value("price_basis") || value("price")) {
      if (!value("price")) add(row, "price", "Currency and price_basis require a price.");
      if (!/^[A-Z]{3}$/u.test(value("currency"))) add(row, "currency", "Supply a three-letter uppercase currency code, e.g. INR.");
      if (!["per_person", "total_event"].includes(value("price_basis"))) add(row, "price_basis", "Use per_person or total_event explicitly.");
      facts.currency = value("currency"); facts.priceBasis = value("price_basis") as ResourceFacts["priceBasis"];
    }
    let externalId: ClubResource["externalId"];
    if (value("external_id_type") || value("external_id")) {
      const type = value("external_id_type"), id = value("external_id");
      const valid = type === "isbn13" && kind === "book" && /^\d{13}$/u.test(id) && [...id].reduce((sum, digit, at) => sum + Number(digit) * (at % 2 ? 3 : 1), 0) % 10 === 0 || type === "imdb" && kind === "movie" && /^tt\d{7,10}$/u.test(id) || type === "spotify" && kind === "artist" && /^[A-Za-z0-9]{22}$/u.test(id);
      if (!valid) add(row, "external_id", "Use a matching book ISBN-13, movie IMDb tt ID, or artist Spotify ID. IDs still require explicit identity confirmation.");
      else externalId = { type: type as NonNullable<ClubResource["externalId"]>["type"], value: id };
    }
    resources.push({ localId: `local-resource-${crypto.randomUUID()}`, kind: kind as ClubResource["kind"], name, ...(creator ? { creator } : {}), facts, ...(externalId ? { externalId } : {}) });
  }
  if (errorCount) return { ok: false, errors: [...errors, ...(errorCount > errors.length ? [{ message: `${errorCount - errors.length} additional errors omitted.` }] : [])] };
  return { ok: true, format: "generic", resources };
}
