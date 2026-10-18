"use client";

import { useId, useState } from "react";
import type { Book } from "@/lib/types";

type OutlineDraft = {
  title: string;
  agenda: string;
  prompts: string;
  notes: string;
};

function createTemplate(book: Book | null): OutlineDraft {
  return {
    title: book ? `An evening with ${book.title}` : "",
    agenda:
      "Welcome and check-in — 10 minutes\nBook discussion — 40 minutes\nPersonal reflections — 15 minutes\nNext gathering and close — 10 minutes",
    prompts:
      "1. Which passage or moment stayed with you, and why?\n2. What question would you like to ask the group?\n3. Did your perspective change as you read?",
    notes: "",
  };
}

export function EventOutline({ book }: { book: Book | null }) {
  const fieldId = useId();
  const [draft, setDraft] = useState(() => createTemplate(book));

  function updateField(field: keyof OutlineDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  return (
    <section
      className="panel outline-panel"
      id="event-outline"
      aria-labelledby="outline-title"
    >
      <div className="section-heading">
        <div>
          <p className="eyebrow">03 / MAKE A PLAN</p>
          <h2 id="outline-title">Event outline</h2>
        </div>
        <span className="badge">Fixed template · not AI-generated</span>
      </div>

      {book ? (
        <>
          <div className="outline-book">
            <p className="field-label">Your selected book</p>
            <h3>{book.title}</h3>
            <p className="quiet">by {book.author}</p>
          </div>

          <p className="quiet outline-session-note">
            Edits stay in this session. Switching books starts a fresh template.
          </p>

          <div className="outline-grid">
            <div className="field outline-full-width">
              <label className="field-label" htmlFor={`${fieldId}-title`}>
                Event title
              </label>
              <input
                className="input"
                id={`${fieldId}-title`}
                value={draft.title}
                onChange={(event) => updateField("title", event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor={`${fieldId}-agenda`}>
                Running order
              </label>
              <p className="quiet outline-field-hint" id={`${fieldId}-timings`}>
                75-minute starting point. Edit the timings to suit your gathering.
              </p>
              <textarea
                className="textarea"
                id={`${fieldId}-agenda`}
                rows={7}
                aria-describedby={`${fieldId}-timings`}
                value={draft.agenda}
                onChange={(event) => updateField("agenda", event.target.value)}
              />
            </div>

            <div className="field">
              <label className="field-label" htmlFor={`${fieldId}-prompts`}>
                Discussion prompts
              </label>
              <p className="quiet outline-field-hint">
                A few open questions to get the conversation started.
              </p>
              <textarea
                className="textarea"
                id={`${fieldId}-prompts`}
                rows={7}
                value={draft.prompts}
                onChange={(event) => updateField("prompts", event.target.value)}
              />
            </div>

            <div className="field outline-full-width">
              <label className="field-label" htmlFor={`${fieldId}-notes`}>
                Organizer notes
              </label>
              <textarea
                className="textarea"
                id={`${fieldId}-notes`}
                rows={3}
                placeholder="Add venue details, accessibility needs, or reminders…"
                value={draft.notes}
                onChange={(event) => updateField("notes", event.target.value)}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="empty-outline">
          <svg
            aria-hidden="true"
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
          >
            <path
              d="M20 10c-4-3-9-3-15-2v24c6-1 11-1 15 2m0-24c4-3 9-3 15-2v24c-6-1-11-1-15 2m0-24v24"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3>Every good gathering starts with a book.</h3>
          <p className="quiet">
            Choose an eligible book to open an editable event template with a
            running order, discussion prompts, and room for your notes.
          </p>
        </div>
      )}
    </section>
  );
}
