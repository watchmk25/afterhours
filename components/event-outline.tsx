"use client";

import { useId, useState } from "react";
import type { Book, FilterInputs } from "@/lib/types";
import type { EventProposal } from "@/lib/event-types";

type OutlineDraft = {
  title: string;
  agenda: string;
  prompts: string;
  notes: string;
  materials: string;
  invitation: string;
};

function createTemplate(book: Book | null, proposal: EventProposal | null): OutlineDraft {
  return {
    title: proposal?.eventTitle ?? (book ? `An evening with ${book.title}` : ""),
    agenda: proposal ? proposal.agenda.map((item) => `${item.title} — ${item.minutes} minutes\n${item.activity}`).join("\n\n") :
      "Welcome and check-in — 10 minutes\nBook discussion — 40 minutes\nPersonal reflections — 15 minutes\nNext gathering and close — 10 minutes",
    prompts:
      "1. Which passage or moment stayed with you, and why?\n2. What question would you like to ask the group?\n3. Did your perspective change as you read?",
    notes: "",
    materials: proposal?.materials.join("\n") ?? "",
    invitation: proposal?.invitation ?? "",
  };
}

export function EventOutline({ book, proposal = null, appliedFilters = null, previousInputs = false }: {
  book: Book | null;
  proposal?: EventProposal | null;
  appliedFilters?: FilterInputs | null;
  previousInputs?: boolean;
}) {
  const fieldId = useId();
  const applied = proposal?.selectedBookId === book?.id ? proposal : null;
  const [draft, setDraft] = useState(() => createTemplate(book, applied));

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
        <span className="badge">{applied ? "Gemini proposal · editable" : "Fixed template · not AI-generated"}</span>
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
            {applied ? " Applying another proposal replaces this draft." : ""}
          </p>

          {applied && appliedFilters && <section className="applied-event-context" aria-label="Applied event context">
            <h4>Applied event context</h4>
            {previousInputs && <p className="qloo-notice" role="status">
              <strong>Based on previous inputs.</strong> Your confirmed audience or filters changed after Apply. Your edits are kept.
              {" "}<a href="#event-planner">Generate a current proposal</a> to review a replacement; nothing changes until you apply it.
            </p>}
            <p className="quiet applied-interests"><strong>Confirmed interests used:</strong>{" "}
              {applied.interests.map((interest) => `${interest.name}${interest.disambiguation ? ` (${interest.disambiguation})` : ""} — ${interest.kind === "movie" ? "film" : "musician"}`).join("; ")}
            </p>
            <p className="qloo-coverage">Qloo assessed {applied.coverage.assessedCount} of {applied.coverage.eligibleCount} eligible books; {applied.coverage.supportedCount} had reviewed mappings.</p>
            <details className="applied-evidence">
              <summary>Applied filters and numerical evidence</summary>
              <p><strong>Filter snapshot:</strong> Maximum ₹{appliedFilters.maxPrice} per copy · Maximum {appliedFilters.maxPages} pages · Languages: {appliedFilters.languages.join(", ")} · In stock only</p>
              <p><strong>Planned duration:</strong> {applied.duration} minutes. Editing the running order does not revalidate its total.</p>
              <ul aria-label="Applied Qloo evidence">
                {applied.evidence.map((item) => <li key={item.id}>
                  {item.kind === "affinity" ? "Qloo affinity" : `Input contribution: ${item.interestName ?? "confirmed interest"}`}: {item.value}
                  {" "}<span className="quiet">(reference <code>{item.id}</code>)</span>
                </li>)}
              </ul>
              <p className="quiet">These are the numerical values supplied with the applied proposal, not probabilities or guarantees of individual preferences. No ranking position is inferred.</p>
              <h4>Warnings from the applied proposal</h4>
              {applied.warnings.length > 0 ? <ul className="applied-warnings">{applied.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul> : <p className="quiet">No warnings were supplied.</p>}
            </details>
          </section>}

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
                {applied ? `${applied.duration}-minute proposal.` : "75-minute starting point."} Edit the timings to suit your gathering.
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
                {applied ? "Optional generic prompts to use alongside the proposed activities." : "A few open questions to get the conversation started."}
              </p>
              <textarea
                className="textarea"
                id={`${fieldId}-prompts`}
                rows={7}
                value={draft.prompts}
                onChange={(event) => updateField("prompts", event.target.value)}
              />
            </div>

            {applied && <>
              <div className="field">
                <label className="field-label" htmlFor={`${fieldId}-materials`}>Materials</label>
                <textarea className="textarea" id={`${fieldId}-materials`} rows={5} value={draft.materials} onChange={(event) => updateField("materials", event.target.value)} />
              </div>
              <div className="field">
                <label className="field-label" htmlFor={`${fieldId}-invitation`}>Invitation</label>
                <textarea className="textarea" id={`${fieldId}-invitation`} rows={5} value={draft.invitation} onChange={(event) => updateField("invitation", event.target.value)} />
              </div>
            </>}

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
