import type { Book, FilterInputs } from "./types.ts";
import type { EventProposal } from "./event-types.ts";
import type { ClubPlan } from "./club-types.ts";

export type EditedEventDraft = {
  title: string;
  agenda: string;
  prompts?: string;
  notes: string;
  materials?: string;
  invitation?: string;
  format?: string;
};
export type EventPlanFile = { filename: string; markdown: string };
type ExportBook = { title: string; author?: string; source?: "sample" | "imported" | "provider" };

// Keep organizer text verbatim, without allowing its Markdown to masquerade as
// saved provider context. A longer fence safely contains even pasted backticks.
function textBlock(value: string): string {
  const longest = Math.max(0, ...Array.from(value.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(Math.max(3, longest + 1));
  return `${fence}text\n${value}\n${fence}`;
}
function field(title: string, value: string) { return `### ${title}\n\n${textBlock(value)}`; }
function filename(title: string) {
  const slug = title.normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, " ")
    .replace(/[^\p{L}\p{N} -]/gu, "").trim().replace(/[\s-]+/gu, "-").slice(0, 80).replace(/-+$/u, "");
  return `afterhours-${slug || "event-plan"}.md`;
}
function document(draft: EditedEventDraft, book: ExportBook, context: string[] | null, previousInputs: boolean): EventPlanFile {
  const sections = [
    "# AfterHours event plan",
    context ? "Starting point: **Applied AI proposal (Gemini), with organizer edits.**" : "Starting point: **Fixed template — not AI-generated, with organizer edits.**",
    "## Selected book",
    textBlock(`${book.title}${book.author ? `\nAuthor: ${book.author}` : ""}`),
    ...(book.source ? [book.source === "sample" ? "Inventory source: illustrative sample catalogue. Prices, stock and edition details are fixtures, not current availability."
      : book.source === "imported" ? "Inventory source: organizer-imported catalogue. Inventory facts are organizer-supplied, not provider-verified."
        : "Book identity source: saved Qloo result. Current price, stock and edition availability are not established."] : []),
    "## Current edited event",
    "The fields below are the organizer’s current draft, not a copy of the original proposal.",
    field("Event title", draft.title),
    ...(draft.format !== undefined ? [field("Event format", draft.format)] : []),
    field("Running order", draft.agenda),
    "Manually edited timings have not been revalidated. Review the running order and its total before the event.",
    ...(draft.prompts !== undefined ? [field("Discussion prompts", draft.prompts)] : []),
    field("Organizer notes", draft.notes),
    ...(draft.materials !== undefined ? [field("Materials", draft.materials)] : []),
    ...(draft.invitation !== undefined ? [field("Invitation", draft.invitation)] : []),
  ];
  if (context) sections.push("## Saved context from Apply — separate from edited event",
    previousInputs ? "**Historical context — based on previous inputs.** Inputs changed after Apply. This context has not been refreshed; the edited event is preserved."
      : "This is the saved context of the applied proposal; it is not a new provider assessment of subsequent edits.",
    ...context,
    "Qloo scores are numerical provider values, not probabilities or guarantees of individual preference. No ranking position or cultural explanation is inferred.");
  else sections.push("No applied AI proposal or Qloo evidence is attached to this fixed template.");
  return { filename: filename(draft.title), markdown: sections.join("\n\n") + "\n" };
}

/** Pure formatting; only the supplied edited draft is used as event content. */
export function createBookEventPlanFile({ book, draft, proposal = null, appliedFilters = null, previousInputs = false, catalogueSource }: {
  book: Book; draft: EditedEventDraft; proposal?: EventProposal | null; appliedFilters?: FilterInputs | null;
  previousInputs?: boolean; catalogueSource?: "sample" | "imported";
}): EventPlanFile {
  const applied = proposal?.selectedBookId === book.id ? proposal : null;
  const context = applied ? [
    field("Book in the applied proposal", `${applied.book.title}\nAuthor: ${applied.book.author}`),
    field("Confirmed interests used", applied.interests.map((interest) => `${interest.name} — ${interest.kind}${interest.disambiguation ? ` (${interest.disambiguation})` : ""}`).join("\n") || "No confirmed interests were saved."),
    field("Filter snapshot", appliedFilters ? `Maximum INR ${appliedFilters.maxPrice} per copy\nMaximum ${appliedFilters.maxPages} pages\nLanguages: ${appliedFilters.languages.join(", ")}\nIn stock only` : "No filter snapshot was saved."),
    field("Coverage at Apply", `Qloo assessed ${applied.coverage.assessedCount} of ${applied.coverage.eligibleCount} eligible books; ${applied.coverage.supportedCount} had reviewed mappings.`),
    `Original proposal duration at Apply: ${applied.duration} minutes. This does not validate edited timings.`,
    field("Saved numerical Qloo evidence", applied.evidence.map((item) => `${item.kind === "affinity" ? "Qloo affinity" : `Input contribution: ${item.interestName ?? "confirmed interest"}`}: ${item.value}\nReference: ${item.id}`).join("\n\n") || "No numerical evidence was saved."),
    field("Warnings from the applied proposal", applied.warnings.join("\n") || "No warnings were supplied."),
  ] : null;
  return document(draft, { title: book.title, author: book.author, source: catalogueSource }, context, previousInputs);
}

/** Adapter for the in-progress local workspace; no provider contract is changed. */
export function createClubBookEventPlanFile({ book, draft, applied = null, previousInputs = false }: {
  book: ExportBook; draft: EditedEventDraft; applied?: ClubPlan | null; previousInputs?: boolean;
}): EventPlanFile {
  const context = applied ? [
    field("Focus in the applied proposal", `${applied.focus.entity.name} — ${applied.focus.entity.kind}${applied.focus.entity.metadata.creator ? `\nCreator: ${applied.focus.entity.metadata.creator}` : ""}`),
    field("Confirmed interests used", applied.discovery.interests.map((interest) => `${interest.name} — ${interest.kind}${interest.disambiguation ? ` (${interest.disambiguation})` : ""}`).join("\n") || "No confirmed interests were saved."),
    field("Filter and gathering snapshot", [
      `Club: ${applied.snapshot.club}`, `Goal: ${applied.snapshot.goal}`, `Duration: ${applied.snapshot.duration} minutes`, `Group size: ${applied.snapshot.groupSize}`,
      `Source: ${applied.snapshot.source}`, `Focus: ${applied.snapshot.format}`,
      ...(applied.snapshot.location ? [`Location: ${applied.snapshot.location}`] : []),
      applied.snapshot.budget ? `Budget: ${applied.snapshot.budget.currency} ${applied.snapshot.budget.amount} (${applied.snapshot.budget.basis.replaceAll("_", " ")})` : "No monetary budget specified.",
      ...(applied.snapshot.maxPages !== null ? [`Maximum pages: ${applied.snapshot.maxPages}`] : []),
      ...(applied.snapshot.languages.length ? [`Languages: ${applied.snapshot.languages.join(", ")}`] : []),
    ].join("\n")),
    field("Coverage at Apply", `Qloo assessed ${applied.discovery.coverage.assessed}${applied.discovery.coverage.submitted === null ? " discovered options." : ` of ${applied.discovery.coverage.submitted} submitted options; ${applied.discovery.coverage.resolved} identities resolved.`}`),
    field("Saved numerical Qloo evidence", applied.focus.evidence.map((item) => `${item.kind === "affinity" ? "Qloo affinity" : `Input contribution: ${item.interestName ?? item.interestId ?? "confirmed interest"}`}: ${item.value}\nReference: ${item.id}`).join("\n\n") || "No numerical evidence was saved."),
    field("Saved constraint assessments", applied.focus.assessments.map((item) => `${item.constraint}: ${item.status.replaceAll("_", " ")} (${item.source})\n${item.detail}`).join("\n\n") || "No constraint assessments were saved."),
    ...(applied.conditional ? ["Feasibility was conditional at Apply; unknown requirements still need organizer confirmation."] : []),
    field("Warnings from the applied proposal", applied.warnings.join("\n") || "No warnings were supplied."),
  ] : null;
  return document(draft, book, context, previousInputs);
}

/** Called only by a user click. No upload, fetch, state update, or provider call. */
export function downloadEventPlan(file: EventPlanFile): void {
  const url = URL.createObjectURL(new Blob([file.markdown], { type: "text/markdown;charset=utf-8" }));
  const anchor = window.document.createElement("a");
  anchor.href = url; anchor.download = file.filename;
  try { window.document.body.append(anchor); anchor.click(); }
  finally {
    anchor.remove();
    // Give the browser time to consume the URL before releasing its memory.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
