"use client";

import { useState } from "react";
import { SAMPLE_CATALOGUE } from "@/lib/catalogue";
import type { Book, FilterInputs } from "@/lib/types";
import {
  createDefaultInputs,
  createExampleInputs,
  catalogueLanguages,
  filterBooks,
  getEligibleSelection,
  validateFilters,
} from "@/lib/workspace";
import { AudienceInputs } from "./audience-inputs";
import { BookFilters } from "./book-filters";
import { CatalogueImport } from "./catalogue-import";
import { EligibleBooks } from "./eligible-books";
import { EventOutline } from "./event-outline";
import { Icon } from "./icons";

export function OrganizerWorkspace() {
  const [catalogue, setCatalogue] = useState<{
    books: readonly Book[];
    source: "sample" | "imported";
    fileName: string | null;
  }>({ books: SAMPLE_CATALOGUE, source: "sample", fileName: null });
  const [inputs, setInputs] = useState(createDefaultInputs);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const languages = catalogueLanguages(catalogue.books);
  const eligibleBooks = filterBooks(catalogue.books, inputs.filters);
  const selectedBook = getEligibleSelection(selectedId, eligibleBooks);
  const invalid = Object.keys(validateFilters(inputs.filters, languages)).length > 0;

  function replaceCatalogue(books: readonly Book[], fileName: string | null) {
    const source = fileName === null ? "sample" : "imported";
    setCatalogue({ books, source, fileName });
    setInputs((current) => ({
      ...current,
      filters: { ...current.filters, languages: catalogueLanguages(books) },
    }));
    setSelectedId(null);
    setNotice(
      source === "sample"
        ? "Sample catalogue restored. Selection and outline cleared; audience favourites and numeric limits kept."
        : "Imported catalogue applied. Selection and outline cleared; audience favourites and numeric limits kept. All catalogue languages selected.",
    );
  }

  function changeFilters(filters: FilterInputs) {
    setInputs((current) => ({ ...current, filters }));
    if (
      selectedId &&
      !getEligibleSelection(selectedId, filterBooks(catalogue.books, filters))
    ) {
      setSelectedId(null);
      setNotice(
        "Your selected book no longer meets the filters. Its outline has been cleared; choose another eligible book.",
      );
    } else {
      setNotice("");
    }
  }

  function loadInputs(example: boolean) {
    setInputs(example ? createExampleInputs(languages) : createDefaultInputs(languages));
    setSelectedId(null);
    setNotice(
      example
        ? "Example favourites and filters loaded. Choose an eligible book to start an outline."
        : "Workspace reset. Favourites and outline cleared; default filters restored.",
    );
  }

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="#workspace"
            aria-label="AfterHours workspace"
          >
            <span className="brand-symbol">
              <Icon name="book" />
            </span>
            <span>
              AfterHours<span className="brand-period">.</span>
            </span>
          </a>
          <nav className="workspace-nav" aria-label="Workspace sections">
            <a href="#workspace">Workspace</a>
            <a href="#eligible-books">Eligible books</a>
            <a href="#event-outline">Event outline</a>
          </nav>
          <span className="workspace-label">
            <span />
            Organizer workspace
          </span>
        </div>
      </header>
      <main id="workspace" className="workspace-shell">
        <div className="sample-banner">
          <span className="banner-dot" />
          <p>
            <strong>{catalogue.source === "sample" ? "Sample mode" : "Imported inventory"}</strong> — Qloo matching and AI planning are not
            connected.
          </p>
          <span className="sample-badge">{catalogue.source === "sample" ? "SAMPLE DATA" : "SESSION ONLY"}</span>
        </div>
        <div className="workspace-intro">
          <div>
            <p className="eyebrow">FOR BOOKSTORES & BOOK CLUBS</p>
            <h1>
              Good books. <em>Great company.</em>
            </h1>
            <p className="intro-copy">
              Find a book that fits your gathering, then give the evening a little
              shape.
            </p>
          </div>
          <div className="workspace-actions">
            <button
              className="button button-primary"
              onClick={() => loadInputs(true)}
            >
              <Icon name="book" />
              Load example
            </button>
            <button
              className="button button-secondary"
              onClick={() => loadInputs(false)}
            >
              <Icon name="reset" />
              Reset
            </button>
          </div>
        </div>
        <CatalogueImport
          source={catalogue.source}
          fileName={catalogue.fileName}
          bookCount={catalogue.books.length}
          onImport={(books, fileName) => replaceCatalogue(books, fileName)}
          onRestore={() => replaceCatalogue(SAMPLE_CATALOGUE, null)}
        />
        <div className="workspace-grid">
          <aside
            className="panel inputs-panel"
            aria-label="Audience and book filters"
          >
            <AudienceInputs
              value={inputs.audience}
              onChange={(audience) =>
                setInputs((current) => ({ ...current, audience }))
              }
            />
            <BookFilters value={inputs.filters} languages={languages} onChange={changeFilters} />
            <p className="session-note">
              Session only. Nothing is saved after a reload.
            </p>
          </aside>
          <div className="workspace-content">
            <EligibleBooks
              books={eligibleBooks}
              total={catalogue.books.length}
              source={catalogue.source}
              selectedId={selectedBook?.id ?? null}
              invalid={invalid}
              onSelect={(id) => {
                setSelectedId(id);
                setNotice(
                  "Book selected. Your editable event template is ready below.",
                );
              }}
              onResetFilters={() => changeFilters(createDefaultInputs(languages).filters)}
            />
            <p
              className={`workspace-notice${notice ? " has-notice" : ""}`}
              role="status"
              aria-live="polite"
            >
              {notice}
            </p>
            <EventOutline key={selectedBook?.id ?? "none"} book={selectedBook} />
          </div>
        </div>
        <footer className="workspace-footer">
          <span className="footer-brand">
            AfterHours<span>.</span>
          </span>
          <p>A space for books, people, and the conversations between them.</p>
          <span>Organizer workspace · No live integrations</span>
        </footer>
      </main>
    </>
  );
}
