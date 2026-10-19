"use client";

import { useId, useRef, useState } from "react";
import { MAX_CSV_BYTES, parseCatalogueCsv } from "@/lib/catalogue-import";
import type { Book } from "@/lib/types";

type ImportError = { row?: number; column?: string; message: string };
type Preview = { books: Book[]; fileName: string };

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function CatalogueImport({
  source,
  fileName,
  bookCount,
  onImport,
  onRestore,
}: {
  source: "sample" | "imported";
  fileName: string | null;
  bookCount: number;
  onImport: (books: Book[], fileName: string) => void;
  onRestore: () => void;
}) {
  const fieldId = useId();
  const readGeneration = useRef(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [reading, setReading] = useState(false);

  function clearPending() {
    readGeneration.current += 1;
    setPreview(null);
    setErrors([]);
    setReading(false);
  }

  async function readFile(file: File) {
    const generation = ++readGeneration.current;
    setPreview(null);
    setErrors([]);
    setReading(false);

    if (file.size > MAX_CSV_BYTES) {
      setErrors([{ message: "Choose a CSV file no larger than 256 KiB." }]);
      return;
    }

    setReading(true);
    try {
      const buffer = await file.arrayBuffer();
      if (generation !== readGeneration.current) return;

      let text: string;
      try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      } catch {
        setErrors([{ message: "The file is not valid UTF-8. Save it as a UTF-8 CSV and try again." }]);
        return;
      }

      const result = parseCatalogueCsv(text);
      if (result.ok) {
        setPreview({ books: result.books, fileName: file.name });
      } else {
        setErrors(result.errors);
      }
    } catch {
      if (generation === readGeneration.current) {
        setErrors([{ message: "This file could not be read. Choose the CSV again or try another file." }]);
      }
    } finally {
      if (generation === readGeneration.current) setReading(false);
    }
  }

  return (
    <section
      id="catalogue"
      className="panel inventory-panel"
      aria-labelledby="inventory-title"
    >
      <div className="section-heading inventory-heading">
        <div>
          <p className="eyebrow">YOUR INVENTORY</p>
          <h2 id="inventory-title">Your catalogue</h2>
        </div>
        <a
          className="button button-secondary"
          href="/catalogue-template.csv"
          download
        >
          Download CSV template
        </a>
      </div>

      <p className="inventory-source">
        <strong>
          {source === "sample"
            ? "Sample inventory — illustrative values"
            : "Imported inventory"}
        </strong>
        {source === "imported" && fileName ? ` · ${fileName}` : ""}
        {` · ${bookCount} ${bookCount === 1 ? "book" : "books"}`}
      </p>
      <p className="quiet">
        Import processing stays in your browser; no file is uploaded to a server.
        Imported inventory is session-only and is lost on reload.
      </p>

      <div className="field inventory-upload">
        <label className="field-label" htmlFor={`${fieldId}-file`}>
          Choose catalogue CSV
        </label>
        <p className="quiet" id={`${fieldId}-help`}>
          UTF-8 CSV, up to 256 KiB and 500 data rows. Required columns:
          {" "}<code>title,author,price_inr,pages,language,stock</code>.
          {" "}The template includes one illustrative example row; replace it with your inventory.
        </p>
        <input
          id={`${fieldId}-file`}
          className="input"
          type="file"
          accept=".csv,text/csv"
          aria-describedby={`${fieldId}-help${errors.length ? ` ${fieldId}-errors` : ""}`}
          aria-invalid={errors.length > 0}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void readFile(file);
          }}
        />
      </div>

      {reading && <p role="status">Reading catalogue…</p>}

      {errors.length > 0 && (
        <div className="import-errors" id={`${fieldId}-errors`} role="alert">
          <p><strong>Catalogue not imported.</strong> Your current inventory and outline are unchanged.</p>
          <ul>
            {errors.slice(0, 20).map((error, index) => (
              <li key={index}>
                {error.row !== undefined ? `Row ${error.row}: ` : ""}
                {error.column ? `${error.column}: ` : ""}
                {error.message}
              </li>
            ))}
          </ul>
          {errors.length > 20 && (
            <p>{errors.length - 20} more errors. Correct these first and upload again.</p>
          )}
        </div>
      )}

      {preview && (
        <section className="import-preview" aria-labelledby={`${fieldId}-preview`}>
          <h3 id={`${fieldId}-preview`}>Catalogue preview</h3>
          <p role="status">
            <strong>{preview.books.length} {preview.books.length === 1 ? "book" : "books"}</strong>
            {` in ${preview.fileName}. `}
            {preview.books.length > 5 ? "Showing the first 5 rows." : "Showing all rows."}
          </p>
          <ul className="import-preview-rows">
            {preview.books.slice(0, 5).map((book) => (
              <li className="import-preview-row" key={book.id}>
                <h4>{book.title}</h4>
                <p className="quiet">by {book.author}</p>
                <p className="import-row-details">
                  {rupees.format(book.priceInr)} · {book.pages} pages · {book.language} · {book.stock} copies
                </p>
              </li>
            ))}
          </ul>
          <p className="import-confirmation-note">
            Replacing the catalogue clears your current book selection and event
            outline. Your audience favourites will be preserved. The new
            catalogue is applied only when you confirm below.
          </p>
          <div className="inventory-actions">
            <button
              className="button button-primary"
              onClick={() => {
                const confirmed = preview;
                clearPending();
                onImport(confirmed.books, confirmed.fileName);
              }}
            >
              Replace catalogue
            </button>
            <button className="button button-secondary" onClick={clearPending}>
              Cancel import
            </button>
          </div>
        </section>
      )}

      {reading && (
        <button className="button button-secondary" onClick={clearPending}>
          Cancel import
        </button>
      )}

      {source === "imported" && (
        <div className="inventory-restore">
          <p className="quiet">
            Restoring the sample catalogue also clears your book selection and
            event outline, while keeping audience favourites.
          </p>
          <button
            className="button button-secondary"
            onClick={() => {
              clearPending();
              onRestore();
            }}
          >
            Restore sample catalogue
          </button>
        </div>
      )}
    </section>
  );
}
