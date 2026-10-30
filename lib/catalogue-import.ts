import Papa from "papaparse";
import type { Book } from "./types.ts";

export const MAX_CSV_BYTES = 256 * 1024;
export const MAX_CSV_ROWS = 500;
export const CSV_REQUIRED_HEADERS = [
  "title", "author", "price_inr", "pages", "language", "stock",
] as const;

export type CatalogueImportError = {
  row?: number;
  column?: string;
  message: string;
};

export type CatalogueImportResult =
  | { ok: true; books: Book[] }
  | { ok: false; errors: CatalogueImportError[] };

const COVER_COLORS = ["#805b46", "#426d78", "#5c7450", "#a57242", "#80556d"];
const MAX_SHOWN_ERRORS = 20;

// Papa Parse deliberately tolerates quotes inside unquoted fields. Inventory
// imports require strict quoting so a typo cannot silently alter a book's data.
export function inspectQuoteSyntax(source: string): {
  error?: CatalogueImportError;
  blankRows: Set<number>;
} {
  let state: "start" | "unquoted" | "quoted" | "closed" = "start";
  let row = 1;
  let column = 1;
  let hasContent = false;
  const blankRows = new Set<number>();
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (state === "quoted") {
      if (char === '"') {
        if (source[index + 1] === '"') index += 1;
        else state = "closed";
      }
      continue;
    }
    if (char === ",") {
      hasContent = true;
      state = "start";
      column += 1;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      if (!hasContent) blankRows.add(row);
      hasContent = false;
      state = "start";
      row += 1;
      column = 1;
    } else if (state === "closed") {
      return { blankRows, error: { row, column: `Column ${column}`, message: "Unexpected character after a closing quote. Use a comma or a new line." } };
    } else if (char === '"') {
      if (state !== "start") {
        return { blankRows, error: { row, column: `Column ${column}`, message: 'A quote inside an unquoted field is invalid. Quote the whole field and escape quotes as "".' } };
      }
      hasContent = true;
      state = "quoted";
    } else {
      if (char.trim() !== "") hasContent = true;
      state = "unquoted";
    }
  }
  if (state === "quoted") {
    return { blankRows, error: { row, column: `Column ${column}`, message: "Quoted field is not closed." } };
  }
  if (!hasContent) blankRows.add(row);
  return { blankRows };
}

/** Parse and validate the complete file before returning any inventory. */
export function parseCatalogueCsv(text: string): CatalogueImportResult {
  if (new TextEncoder().encode(text).byteLength > MAX_CSV_BYTES) {
    return { ok: false, errors: [{ message: "CSV files must be 256 KiB or smaller." }] };
  }
  const source = text.replace(/^\uFEFF/, "");
  const { error: quoteError, blankRows } = inspectQuoteSyntax(source);
  if (quoteError) return { ok: false, errors: [quoteError] };

  const parsed = Papa.parse<string[]>(source, {
    delimiter: ",",
    skipEmptyLines: false,
    dynamicTyping: false,
  });
  if (parsed.errors.length) {
    return {
      ok: false,
      errors: parsed.errors.slice(0, MAX_SHOWN_ERRORS).map((error) => ({
        row: error.row === undefined ? undefined : error.row + 1,
        message: `Malformed CSV: ${error.message}`,
      })),
    };
  }

  // Only physically blank records are skipped. Comma-only or quoted-empty
  // records contain CSV syntax and must be validated, not silently discarded.
  const records = parsed.data
    .map((fields, index) => ({ fields, row: index + 1 }))
    .filter(({ row }) => !blankRows.has(row));
  if (records.length === 0) {
    return { ok: false, errors: [{ row: 1, message: "The CSV is empty. Include the required headers and at least one book." }] };
  }
  const [header, ...data] = records;
  const headers = header.fields.map((value) => value.trim());
  const errors: CatalogueImportError[] = [];
  let errorCount = 0;
  const addError = (error: CatalogueImportError) => {
    errorCount += 1;
    if (errors.length < MAX_SHOWN_ERRORS - 1) errors.push(error);
  };
  const failure = (): CatalogueImportResult => {
    if (errorCount > errors.length) {
      errors.push({ message: `${errorCount - errors.length} additional validation errors omitted. Fix the reported rows and try again.` });
    }
    return { ok: false, errors };
  };

  for (const required of CSV_REQUIRED_HEADERS) {
    const count = headers.filter((value) => value === required).length;
    if (count === 0) addError({ row: header.row, column: required, message: `Missing required header: ${required}.` });
    if (count > 1) addError({ row: header.row, column: required, message: `Duplicate required header: ${required}.` });
  }
  if (errorCount) return failure();
  if (data.length === 0) {
    return { ok: false, errors: [{ message: "Include at least one book below the headers." }] };
  }
  if (data.length > MAX_CSV_ROWS) {
    return { ok: false, errors: [{ message: "A CSV can contain at most 500 book rows. No books were imported." }] };
  }

  const books: Book[] = [];
  for (const { fields, row } of data) {
    if (fields.length !== headers.length) {
      addError({ row, message: `Expected ${headers.length} columns but found ${fields.length}. Check commas and quoted fields.` });
      continue;
    }
    const value = (column: typeof CSV_REQUIRED_HEADERS[number]) => fields[headers.indexOf(column)].trim();
    const title = value("title");
    const author = value("author");
    const language = value("language");
    for (const [column, content] of [["title", title], ["author", author], ["language", language]]) {
      if (!content) addError({ row, column, message: `${column} must not be empty.` });
    }
    const priceInr = Number(value("price_inr"));
    const pages = Number(value("pages"));
    const stock = Number(value("stock"));
    if (value("price_inr") === "" || !Number.isFinite(priceInr) || priceInr < 0) {
      addError({ row, column: "price_inr", message: "Price must be a finite, nonnegative number in INR." });
    }
    if (value("pages") === "" || !Number.isSafeInteger(pages) || pages <= 0) {
      addError({ row, column: "pages", message: "Pages must be a positive whole number within the safe integer range." });
    }
    if (value("stock") === "" || !Number.isSafeInteger(stock) || stock < 0) {
      addError({ row, column: "stock", message: "Stock must be a nonnegative whole number within the safe integer range." });
    }
    books.push({
      id: `local-import-${crypto.randomUUID()}`,
      title, author, language, priceInr, pages, stock,
      coverColor: COVER_COLORS[(books.length) % COVER_COLORS.length],
    });
  }
  return errorCount ? failure() : { ok: true, books };
}
