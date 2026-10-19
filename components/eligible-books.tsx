import type { CSSProperties } from "react";
import type { Book } from "@/lib/types";
import { Icon } from "./icons";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export function EligibleBooks({
  books,
  total,
  source,
  selectedId,
  invalid,
  onSelect,
  onResetFilters,
}: {
  books: readonly Book[];
  total: number;
  source: "sample" | "imported";
  selectedId: string | null;
  invalid: boolean;
  onSelect: (id: string) => void;
  onResetFilters: () => void;
}) {
  return (
    <section
      id="eligible-books"
      className="results-section"
      aria-labelledby="eligible-title"
    >
      <div className="section-heading results-heading">
        <div>
          <p className="eyebrow">02 / EXPLORE THE SHELF</p>
          <h2 id="eligible-title">
            Eligible books <span className="count-badge">{books.length}</span>
          </h2>
        </div>
        <span className="sort-label">
          Title, A–Z <span aria-hidden="true">↓</span>
        </span>
      </div>
      <p className="quiet results-summary" aria-live="polite" aria-atomic="true">
        {invalid
          ? "Check your filters to see eligible books."
          : `${books.length} of ${total} ${source === "sample" ? "sample" : "imported"} books · In stock and within your limits`}
      </p>
      <p className="sample-data-note" id="sample-values">
        {source === "sample"
          ? "Prices, page counts, stock, and edition languages are illustrative sample values. Display covers are illustrations."
          : "Prices, page counts, stock, and languages come from your imported CSV and have not been independently verified. Display covers are illustrations."}
      </p>
      {books.length > 0 ? (
        <ul className="book-grid" aria-describedby="sample-values">
          {books.map((book) => {
            const selected = selectedId === book.id;
            return (
              <li
                key={book.id}
                className={`book-card${selected ? " is-selected" : ""}`}
              >
                <div className="book-card-main">
                  <div
                    className="book-cover"
                    style={{ "--cover-color": book.coverColor } as CSSProperties}
                    aria-hidden="true"
                  >
                    <span className="cover-rule" />
                    <span className="cover-title">{book.title}</span>
                    <span className="cover-author">{book.author}</span>
                    <span className="cover-publisher">{source === "sample" ? "THE SAMPLE SHELF" : "YOUR CATALOGUE"}</span>
                  </div>
                  <div className="book-details">
                    <span className="book-language">{book.language}</span>
                    <h3>{book.title}</h3>
                    <p className="book-author">{book.author}</p>
                    <p className="book-measures">
                      <strong>{rupees.format(book.priceInr)}</strong>
                      <span aria-hidden="true">·</span>
                      <span>{book.pages} pages</span>
                    </p>
                  </div>
                </div>
                <div className="book-card-footer">
                  <span className="stock-label">
                    <span />
                    {book.stock} copies in stock
                  </span>
                  <button
                    className={`button book-select${selected ? " selected-button" : ""}`}
                    aria-label={`${selected ? "Selected" : "Select"}: ${book.title}`}
                    aria-pressed={selected}
                    onClick={() => onSelect(book.id)}
                  >
                    {selected ? (
                      <>Selected <Icon name="check" /></>
                    ) : (
                      <>Select book <Icon name="arrow" /></>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="empty-results" role="status">
          <span className="empty-symbol">
            <Icon name="book" />
          </span>
          <h3>
            {invalid
              ? "A small adjustment first."
              : "No books fit these limits yet."}
          </h3>
          <p>
            {invalid
              ? "Fix the marked fields: enter a valid price and page count, and select at least one language."
              : "Try a higher price or page limit, or include another language. Only in-stock books appear here."}
          </p>
          <button
            className="button button-secondary"
            onClick={onResetFilters}
          >
            <Icon name="reset" />
            Reset filters
          </button>
        </div>
      )}
    </section>
  );
}
