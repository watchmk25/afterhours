import { SAMPLE_CATALOGUE } from "./catalogue.ts";
import type {
  EventAgentInput, EventEvidence, EventValidatedOutput, ProposalDraft,
} from "./event-types.ts";
import type { InterestReference, QlooRanking } from "./qloo-types.ts";
import type { Book, FilterInputs } from "./types.ts";

export const MAX_EVENT_INPUT_BYTES = 16 * 1024;
export const MAX_EVENT_OUTPUT_BYTES = 16 * 1024;
const controls = /[\u0000-\u001f\u007f-\u009f]/u;
const proseControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;

const textSchema = (maxLength: number, minLength = 1) => ({ type: "string", minLength, maxLength });
const draftProperties = {
  selectedBookId: textSchema(100), eventTitle: textSchema(160), rationale: textSchema(600),
  evidenceRefs: { type: "array", minItems: 1, maxItems: 8, uniqueItems: true, items: textSchema(256) },
  agenda: {
    type: "array", minItems: 1, maxItems: 12,
    items: {
      type: "object", additionalProperties: false, required: ["title", "minutes", "activity"],
      properties: { title: textSchema(100), minutes: { type: "integer", minimum: 1, maximum: 180 }, activity: textSchema(400) },
    },
  },
  materials: { type: "array", maxItems: 12, items: textSchema(120) },
  invitation: textSchema(800),
};

/** Provider JSON schema. Server validation below remains authoritative. */
export const EVENT_OUTPUT_SCHEMA = {
  anyOf: [
    {
      type: "object", additionalProperties: false, required: ["status", "proposal"],
      properties: {
        status: { type: "string", enum: ["proposal"] },
        proposal: { type: "object", additionalProperties: false, required: Object.keys(draftProperties), properties: draftProperties },
      },
    },
    {
      type: "object", additionalProperties: false, required: ["status", "question"],
      properties: { status: { type: "string", enum: ["clarification"] }, question: textSchema(400) },
    },
  ],
};

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}
function exactKeys(value: JsonRecord, required: readonly string[], optional: readonly string[] = []): boolean {
  return required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}
function boundedJson(value: unknown, maximum: number): boolean {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" && new TextEncoder().encode(serialized).byteLength <= maximum;
  } catch { return false; }
}
function text(value: unknown, maximum: number, minimum = 1, multiline = false): value is string {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= maximum &&
    !(multiline ? proseControls : controls).test(value);
}

function draftShape(value: unknown): value is ProposalDraft {
  const draft = record(value);
  if (!draft || !exactKeys(draft, Object.keys(draftProperties)) ||
    !text(draft.selectedBookId, 100) || !text(draft.eventTitle, 160, 1, true) ||
    !text(draft.rationale, 600, 1, true) || !text(draft.invitation, 800, 1, true) ||
    !Array.isArray(draft.evidenceRefs) || draft.evidenceRefs.length < 1 || draft.evidenceRefs.length > 8 ||
    draft.evidenceRefs.some((ref) => !text(ref, 256)) || new Set(draft.evidenceRefs).size !== draft.evidenceRefs.length ||
    !Array.isArray(draft.materials) || draft.materials.length > 12 || draft.materials.some((item) => !text(item, 120, 1, true)) ||
    !Array.isArray(draft.agenda) || draft.agenda.length < 1 || draft.agenda.length > 12) return false;
  return draft.agenda.every((value) => {
    const item = record(value);
    return !!item && exactKeys(item, ["title", "minutes", "activity"]) &&
      text(item.title, 100, 1, true) && text(item.activity, 400, 1, true) &&
      Number.isInteger(item.minutes) && Number(item.minutes) > 0 && Number(item.minutes) <= 180;
  });
}

function referenceShape(value: unknown): value is InterestReference {
  const reference = record(value);
  return !!reference && (
    (exactKeys(reference, ["preset", "index"]) && (reference.preset === "a" || reference.preset === "b") && (reference.index === 0 || reference.index === 1)) ||
    (exactKeys(reference, ["token"]) && text(reference.token, 2048))
  );
}

function filterShape(value: unknown): value is FilterInputs {
  const filters = record(value);
  return !!filters && exactKeys(filters, ["maxPrice", "maxPages", "languages"]) &&
    text(filters.maxPrice, 32) && text(filters.maxPages, 32) &&
    Array.isArray(filters.languages) && filters.languages.length >= 1 && filters.languages.length <= 3 &&
    filters.languages.every((language) => text(language, 80));
}

function isOverallDuration(before: string, after: string): boolean {
  // Recognize duration attached to the whole event, rather than guessing from
  // activity names. For example, "10 minutes for discussion" is an allocation;
  // "a 60-minute interactive event" and "the event lasts 60 minutes" are totals.
  const eventNoun = "(?:event|session|gathering|workshop)";
  const eventEnd = "\\b(?=\\s*(?:$|[.,;:!?]|(?:with|for|including|followed|and|or|that|where|which|to|should|must|will|can|is|at)\\b))";
  const eventPhrase = after.match(new RegExp(`^\\s+((?:[\\p{L}][\\p{L}'-]*\\s+){0,4})${eventNoun}${eventEnd}`, "u"));
  if (eventPhrase && !/\b(?:for|of|in|during|within|with|and|or|then|before|after|followed|include|includes|including)\b/u.test(eventPhrase[1])) return true;
  if (new RegExp(`\\b${eventNoun}\\s*(?:(?:(?:should|must|will|would|can|could)\\s+)?(?:be|is|lasts?|lasting|runs?|running|duration(?:\\s+(?:is|of))?)\\s*(?:for\\s+)?|(?:for|of|:|=)\\s*)?$`, "u").test(before)) return true;
  if (/(?:^|[.;!?]\s*|\b(?:set|keep|make|use)\s+(?:the\s+)?)(?:(?:overall|total|event)\s+)?(?:duration|running time)\s*(?:(?:of|is|at|:|=|to)\s*)?$/u.test(before)) return true;
  if (/\b(?:overall|total)\s+(?:duration\s+)?(?:of|is|at|:|=|to)\s*$/u.test(before)) return true;
  if (new RegExp(`^\\s+for\\s+(?:the\\s+)?(?:(?:whole|entire|overall)\\s+)?${eventNoun}${eventEnd}`, "u").test(after)) return true;
  if (/^\s*(?:(?:in\s+)?(?:total|overall)|altogether|in all)\b/u.test(after)) return true;
  return /\b(?:make|keep)\s+(?:it|this)\s*(?:(?:at|to|for)\s*)?$/u.test(before);
}

/** Only explicit conflicts are detected; structured filters are never changed. */
function constraintClarification(request: string, filters: FilterInputs, duration: number): string | null {
  const normalized = request.toLowerCase();
  const withoutNegation = normalized.replace(/\b(?:do not|don't|never|must not)\s+(?:ignore|disregard|bypass|override|relax|remove)\s+(?:the\s+)?(?:filters?|constraints?|limits?|budget|stock)\b/gu, "");
  if (/\b(?:ignore|disregard|bypass|override|relax|remove)\b.{0,30}\b(?:filters?|constraints?|limits?|budget|stock)\b|\bregardless of\b.{0,20}\b(?:price|stock|filters?|limits?)\b|\bany price\b/iu.test(withoutNegation)) {
    return "The structured filters remain authoritative. Change the filters first, then request a new proposal.";
  }
  const money = [...normalized.matchAll(/(?:₹|\binr\b|\brs\.?)[ \t]*(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)[ \t]*rupees?\b/gu)]
    .map((match) => Number((match[1] ?? match[2]).replaceAll(",", "")));
  if (money.some((value) => value !== Number(filters.maxPrice))) {
    return "The price mentioned in your request differs from the current maximum price. Update the price filter or revise the request.";
  }
  const pages = [...normalized.matchAll(/\b(?:max(?:imum)?|at most|no more than|up to|under|below)\s*(\d+)\s*pages?\b|\b(?:page(?:s| count)?\s*(?:limit|maximum)|max pages)\s*(?:of|is|:|=)?\s*(\d+)/gu)]
    .map((match) => Number(match[1] ?? match[2]));
  if (pages.some((value) => value !== Number(filters.maxPages))) {
    return "The page limit in your request differs from the structured page filter. Update the filter or revise the request.";
  }
  const times = [...normalized.matchAll(/\b(\d+(?:\.\d+)?)\s*-?\s*(minutes?|mins?|hours?|hrs?)\b/gu)];
  for (const match of times) {
    const before = normalized.slice(0, match.index);
    const after = normalized.slice((match.index ?? 0) + match[0].length);
    if (!isOverallDuration(before, after)) continue;
    const minutes = Number(match[1]) * (/^(?:hours?|hrs?)$/u.test(match[2]) ? 60 : 1);
    if (minutes !== duration) return "The event duration in your request differs from the duration control. Set the intended duration and try again.";
  }
  return null;
}

export type EventInputResult =
  | { ok: true; input: EventAgentInput }
  | { ok: false; code: string; message: string; clarification?: string };

export function parseEventInput(value: unknown): EventInputResult {
  const input = record(value);
  const invalid = (message: string): EventInputResult => ({ ok: false, code: "INVALID_INPUT", message });
  if (!boundedJson(value, MAX_EVENT_INPUT_BYTES)) return invalid("Keep the event request within 16 KiB.");
  if (!input || !exactKeys(input, ["catalogueSource", "filters", "interests", "request", "duration", "mode"], ["previousProposal"]) ||
    input.catalogueSource !== "sample") return invalid("Event planning currently supports the sample catalogue only. Check the request fields.");
  if (!filterShape(input.filters)) return invalid("Choose valid structured book filters before planning an event.");
  if (!Array.isArray(input.interests) || input.interests.length < 1 || input.interests.length > 5 || !input.interests.every(referenceShape)) {
    return invalid("Confirm between one and five audience films or musicians before planning.");
  }
  if (!text(input.request, 1000, 10)) return invalid("Enter an event request of 10 to 1000 characters without control characters.");
  if (!Number.isInteger(input.duration) || Number(input.duration) < 15 || Number(input.duration) > 180) return invalid("Choose a whole event duration from 15 to 180 minutes.");
  if (input.mode !== "generate" && input.mode !== "revise") return invalid("Choose Generate or Revise.");
  if ((input.mode === "revise" && input.previousProposal === undefined) ||
    (input.previousProposal !== undefined && !draftShape(input.previousProposal))) return invalid("A revision needs a structurally valid previous proposal.");
  const typed = input as EventAgentInput;
  const clarification = constraintClarification(typed.request, typed.filters, typed.duration);
  if (clarification) return { ok: false, code: "CLARIFICATION_REQUIRED", message: clarification, clarification };
  return { ok: true, input: structuredClone(typed) };
}

// These checks reject obvious unsupported claims. They cannot prove that all
// free-form language is factual; the prompt and visible proposal labels matter.
function proseIssue(value: string): string | null {
  if (/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|io)\b)/iu.test(value)) return "Proposal prose must not contain URLs.";
  if (/["“”]|(?:^|\s)'[^'\n]{8,}'/u.test(value)) return "Proposal prose must not include quotations.";
  if (/\b(?:(?:the|this) (?:book|novel|story|plot) (?:follows|tells|explores|centers|centres|features|depicts|chronicles|narrates|recounts|portrays|is set)|protagonist|plot twist|set in|published in|first published|born in|author (?:was|is)|nobel|pulitzer|booker prize)\b/iu.test(value)) return "Proposal prose includes an unsupported plot, publication, or author claim.";
  if (/\b(?:guaranteed?|will (?:attract|draw|bring in)|predict(?:ed|s)? attendance|everyone will|qloo (?:proves|guarantees))\b/iu.test(value)) return "Proposal prose includes an unsupported audience prediction or certainty claim.";
  if (/(?:₹|\bINR\b|\bRs\.?)[ \t]*\d|\b(?:affinity|score|price|stock)\s*(?::|is|of|=)?\s*\d|\b\d+\s*(?:rupees|copies|pages)\b/iu.test(value)) return "Use server-owned book details and evidence instead of factual numbers in proposal prose.";
  return null;
}

export function validateEventOutput(value: unknown, context: {
  ranking: QlooRanking;
  eligibleBooks: readonly Book[];
  duration: number;
  evidence: EventEvidence[];
}): { ok: true; output: EventValidatedOutput } | { ok: false; issues: string[] } {
  const issues: string[] = [];
  const output = record(value);
  if (!boundedJson(value, MAX_EVENT_OUTPUT_BYTES) || !output) return { ok: false, issues: ["Event output is missing or exceeds 16 KiB."] };
  if (output.status === "clarification") {
    if (!exactKeys(output, ["status", "question"]) || !text(output.question, 400, 1, true)) return { ok: false, issues: ["Clarification must contain only a bounded question."] };
    const issue = proseIssue(output.question);
    return issue ? { ok: false, issues: [issue] } : { ok: true, output: { status: "clarification", question: output.question.trim() } };
  }
  if (output.status !== "proposal" || !exactKeys(output, ["status", "proposal"]) || !draftShape(output.proposal)) return { ok: false, issues: ["Proposal fields do not match the required bounded schema."] };
  const draft = output.proposal;
  const book = SAMPLE_CATALOGUE.find((candidate) => candidate.id === draft.selectedBookId);
  const ranked = context.ranking.ranked.find((candidate) => candidate.localId === draft.selectedBookId);
  if (!book || !context.eligibleBooks.some((candidate) => candidate.id === book.id) || !ranked) issues.push("Selected book must belong to the current eligible ranked sample inventory.");
  const evidence = draft.evidenceRefs.flatMap((id) => {
    const matches = context.evidence.filter((entry) => entry.id === id);
    if (matches.length !== 1 || matches[0].bookId !== draft.selectedBookId) {
      issues.push("Each evidence reference must exist uniquely in the current tool result and belong to the selected book.");
      return [];
    }
    const entry = matches[0];
    const actual = entry.kind === "affinity"
      ? ranked?.affinity !== null && ranked?.affinity === entry.value
      : ranked?.contributions.some((part) => part.interestId === entry.interestId && part.score === entry.value);
    if (!Number.isFinite(entry.value) || !actual) {
      issues.push("Evidence must match an actual current ranking score.");
      return [];
    }
    return [entry];
  });
  if (evidence.length === 0) issues.push("A proposal requires actual evidence for the selected book; otherwise ask for clarification.");
  if (!Number.isInteger(context.duration) || context.duration < 15 || context.duration > 180 ||
    draft.agenda.reduce((sum, item) => sum + item.minutes, 0) !== context.duration) issues.push("Positive whole agenda minutes must sum exactly to the requested event duration.");
  const prose = [draft.eventTitle, draft.rationale, draft.invitation, ...draft.materials, ...draft.agenda.flatMap((item) => [item.title, item.activity])];
  if (book && SAMPLE_CATALOGUE.some((other) => other.id !== book.id && prose.some((value) => {
    const normalized = value.toLocaleLowerCase("en");
    return normalized.includes(other.title.toLocaleLowerCase("en")) ||
      (other.author !== book.author && normalized.includes(other.author.toLocaleLowerCase("en")));
  }))) issues.push("Proposal prose names another sample book or author. Use the selected book's server-owned details only.");
  for (const value of prose) {
    const issue = proseIssue(value);
    if (issue && !issues.includes(issue)) issues.push(issue);
  }
  if (issues.length || !book) return { ok: false, issues };
  return { ok: true, output: { status: "proposal", proposal: {
    ...structuredClone(draft), book: structuredClone(book), evidence: structuredClone(evidence),
    coverage: {
      eligibleCount: context.ranking.eligibleCount,
      supportedCount: context.ranking.supportedCount,
      assessedCount: context.ranking.assessedCount,
    },
    duration: context.duration, interests: structuredClone(context.ranking.interests),
    warnings: [...context.ranking.explanationWarnings, "Activities and invitation wording are Gemini proposals, not Qloo evidence or verified literary facts."],
  } } };
}
