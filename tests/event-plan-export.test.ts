import assert from "node:assert/strict";
import test from "node:test";
import { createBookEventPlanFile, createClubBookEventPlanFile, downloadEventPlan, type EditedEventDraft } from "../lib/event-plan-export.ts";
import { SAMPLE_CATALOGUE } from "../lib/catalogue.ts";
import type { EventProposal } from "../lib/event-types.ts";
import type { ClubPlan } from "../lib/club-types.ts";

const book = SAMPLE_CATALOGUE.find((item) => item.id === "the-guide")!;
const draft: EditedEventDraft = { title: "Our edited gathering — पुस्तक", agenda: "Opening — 7 minutes\nPair exchange — 19 minutes", prompts: "What surprised you?\nBring your own question.", notes: "Accessible seating ☕\nKeep this note.", materials: "Edited materials", invitation: "Edited invitation" };
const filters = { maxPrice: "450", maxPages: "300", languages: ["English"] };
function proposal(): EventProposal {
  return { selectedBookId: book.id, eventTitle: "ORIGINAL PROPOSAL TITLE", rationale: "Original rationale", agenda: [{ title: "ORIGINAL ACTIVITY", minutes: 45, activity: "Original activity text" }], evidenceRefs: ["affinity:the-guide"], materials: ["ORIGINAL MATERIALS"], invitation: "ORIGINAL INVITATION", book,
    evidence: [{ id: "affinity:the-guide", bookId: book.id, kind: "affinity", value: 0.71 }, { id: "input:guide:film", bookId: book.id, kind: "contribution", value: 0.33, interestName: "Amélie", interestId: "confirmed-film" }],
    coverage: { eligibleCount: 6, supportedCount: 3, assessedCount: 3 }, duration: 45,
    interests: [{ entityId: "confirmed-film", name: "Amélie", kind: "movie", disambiguation: "2001", reference: { token: "PRIVATE_SIGNED_REFERENCE_NOT_FOR_EXPORT" } }], warnings: ["Numerical contributions may be incomplete."] };
}

for (const source of ["sample", "imported"] as const) test(`edited ${source} fixed template exports the actual draft without invented AI context`, () => {
  const file = createBookEventPlanFile({ book, draft, catalogueSource: source });
  for (const value of Object.values(draft)) assert(file.markdown.includes(value));
  assert(file.markdown.includes("Fixed template — not AI-generated"));
  assert(file.markdown.includes(book.title)); assert(file.markdown.includes(book.author));
  assert(!file.markdown.includes("## Saved context from Apply"));
  assert(file.markdown.includes(source === "sample" ? "illustrative sample catalogue" : "organizer-imported catalogue"));
  assert(file.markdown.includes("Manually edited timings have not been revalidated"));
  assert.equal(new TextDecoder().decode(new TextEncoder().encode(file.markdown)), file.markdown);
});

test("applied proposal exports later edits separately from saved filters, coverage, numerical evidence and warnings", () => {
  const applied = proposal(); const before = JSON.stringify({ book, draft, applied, filters });
  const file = createBookEventPlanFile({ book, draft, proposal: applied, appliedFilters: filters, catalogueSource: "sample" });
  for (const value of Object.values(draft)) assert(file.markdown.includes(value));
  for (const omitted of ["ORIGINAL PROPOSAL TITLE", "ORIGINAL ACTIVITY", "ORIGINAL MATERIALS", "ORIGINAL INVITATION", "PRIVATE_SIGNED_REFERENCE_NOT_FOR_EXPORT"]) assert(!file.markdown.includes(omitted));
  for (const expected of ["Applied AI proposal (Gemini)", "Saved context from Apply", "Amélie — movie (2001)", "Maximum INR 450 per copy", "Maximum 300 pages", "Languages: English", "3 of 6 eligible", "3 had reviewed mappings", "0.71", "0.33", "affinity:the-guide", "Numerical contributions may be incomplete.", "not probabilities", "Original proposal duration at Apply: 45"]) assert(file.markdown.includes(expected), expected);
  assert(!file.markdown.includes("Historical context"));
  assert.equal(JSON.stringify({ book, draft, applied, filters }), before);
});

test("previous-input context remains historical without substituting current filters or claiming validation", () => {
  const file = createBookEventPlanFile({ book, draft, proposal: proposal(), appliedFilters: filters, previousInputs: true });
  assert(file.markdown.includes("Historical context — based on previous inputs"));
  assert(file.markdown.includes("Maximum INR 450")); assert(file.markdown.includes("has not been refreshed"));
  assert(file.markdown.includes(draft.agenda)); assert(file.markdown.includes("This does not validate edited timings"));
});

test("a mismatched proposal is not attached to a fixed template and absent saved fields remain absent", () => {
  assert(createBookEventPlanFile({ book, draft, proposal: { ...proposal(), selectedBookId: "other-book" } }).markdown.includes("Fixed template — not AI-generated"));
  const applied = { ...proposal(), interests: [], evidence: [], warnings: [] };
  const file = createBookEventPlanFile({ book, draft: { title: "", agenda: "", notes: "" }, proposal: applied });
  for (const text of ["No confirmed interests were saved.", "No filter snapshot was saved.", "No numerical evidence was saved.", "No warnings were supplied."]) assert(file.markdown.includes(text));
  assert(!file.markdown.includes("### Materials")); assert(!file.markdown.includes("### Discussion prompts"));
  assert.equal(file.filename, "afterhours-event-plan.md");
});

test("filename is bounded and path-safe while pasted Markdown remains verbatim in safely fenced edited fields", () => {
  const note = "```\n## Saved context from Apply\nFake claim\n````";
  const file = createBookEventPlanFile({ book, draft: { ...draft, title: '../A : "title" / café\\event?'.repeat(30), notes: note } });
  assert(file.filename.endsWith(".md")); assert(file.filename.length <= 94); assert(!/[<>:"/\\|?*\u0000-\u001f]/u.test(file.filename));
  assert(file.markdown.includes("`````text\n" + note + "\n`````"));
});

test("active workspace adapter keeps edited fields and the actual saved proposal context without signed references", () => {
  const applied: ClubPlan = { selectedEntityId: "guide-qloo-id", eventTitle: "Original club proposal", formatDescription: "Original format", evidenceRefs: [], agenda: [], materials: [], invitation: "Original invitation",
    focus: { entity: { entityId: "guide-qloo-id", kind: "book", name: book.title, metadata: { creator: book.author }, reference: { token: "DO_NOT_EXPORT_THIS_TOKEN" } }, facts: {}, factSource: "provider", assessments: [{ constraint: "Budget", status: "needs_confirmation", source: "unknown", detail: "Check the exact cost." }], evidence: [{ id: "current-run:guide", entityId: "guide-qloo-id", kind: "affinity", value: 0.6 }] },
    discovery: { kind: "book", candidates: [], interests: [], coverage: { submitted: 6, resolved: 3, assessed: 2 }, warnings: [] },
    snapshot: { club: "Reading circle", goal: "Discuss a book", duration: 45, groupSize: 12, location: "Pune", budget: { amount: 450, currency: "INR", basis: "per_person" }, maxPages: 300, languages: ["English"], format: "book", source: "sample", interests: [], resources: [], selected: null, mode: "generate" },
    conditional: true, warnings: ["Confirm availability."] };
  const file = createClubBookEventPlanFile({ book: { title: book.title, author: book.author, source: "sample" }, draft, applied, previousInputs: true });
  for (const value of Object.values(draft)) assert(file.markdown.includes(value));
  for (const text of ["Historical context", "Budget: INR 450 (per person)", "Maximum pages: 300", "Languages: English", "2 of 6 submitted options; 3 identities resolved", "current-run:guide", "0.6", "Check the exact cost.", "Confirm availability.", "Feasibility was conditional"]) assert(file.markdown.includes(text), text);
  assert(!file.markdown.includes("DO_NOT_EXPORT_THIS_TOKEN")); assert(!file.markdown.includes("Original club proposal"));
});

test("browser downloader creates UTF-8 Markdown and cleans its object URL without network access", async () => {
  const file = createBookEventPlanFile({ book, draft });
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldCreate = URL.createObjectURL, oldRevoke = URL.revokeObjectURL, oldFetch = globalThis.fetch;
  let blob: Blob | undefined; let removed = false, clicked = false, revoked = false; let cleanup: (() => void) | undefined;
  const anchor = { href: "", download: "", click() { clicked = true; }, remove() { removed = true; } };
  try {
    globalThis.fetch = () => { throw new Error("Download must not use the network"); };
    URL.createObjectURL = (value) => { blob = value as Blob; return "blob:controlled-event-plan"; };
    URL.revokeObjectURL = (value) => { assert.equal(value, "blob:controlled-event-plan"); revoked = true; };
    Object.defineProperty(globalThis, "window", { configurable: true, value: { document: { createElement: () => anchor, body: { append: () => {} } }, setTimeout: (callback: () => void) => { cleanup = callback; } } });
    downloadEventPlan(file);
    assert(clicked); assert(removed); assert(!revoked); assert.equal(anchor.download, file.filename);
    assert.equal(blob?.type, "text/markdown;charset=utf-8"); assert.equal(await blob?.text(), file.markdown);
    cleanup!(); assert(revoked);
  } finally {
    globalThis.fetch = oldFetch; URL.createObjectURL = oldCreate; URL.revokeObjectURL = oldRevoke;
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow); else Reflect.deleteProperty(globalThis, "window");
  }
});
