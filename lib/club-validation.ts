import { CULTURAL_KINDS } from "./club-types.ts";
import type { ClubDraft, ClubInput, ClubDiscovery, ClubPlan, EntityReference, ResourceFacts } from "./club-types.ts";

export const MAX_CLUB_INPUT_BYTES = 48 * 1024;
export const MAX_CLUB_OUTPUT_BYTES = 16 * 1024;
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}
function exact(value: RecordValue, required: readonly string[], optional: readonly string[] = []) {
  return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
}
function text(value: unknown, maximum: number, minimum = 1): value is string {
  return typeof value === "string" && value.trim().length >= minimum && value.length <= maximum && !controls.test(value);
}
function bounded(value: unknown, bytes: number) {
  try { const json = JSON.stringify(value); return typeof json === "string" && Buffer.byteLength(json) <= bytes; }
  catch { return false; }
}
function integer(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}
export function clubReferenceShape(value: unknown): value is EntityReference {
  const ref = record(value);
  return !!ref && ((exact(ref, ["token"]) && text(ref.token, 4096)) ||
    (exact(ref, ["sample"]) && text(ref.sample, 100)) ||
    (exact(ref, ["preset", "index"]) && (ref.preset === "a" || ref.preset === "b") && (ref.index === 0 || ref.index === 1)));
}
function factsShape(value: unknown): value is ResourceFacts {
  const facts = record(value);
  if (!facts || !exact(facts, [], ["price", "currency", "priceBasis", "pages", "language", "stock", "durationMinutes"])) return false;
  if (facts.price !== undefined && (typeof facts.price !== "number" || !Number.isFinite(facts.price) || facts.price < 0 || facts.price > 10_000_000 ||
    typeof facts.currency !== "string" || !/^[A-Z]{3}$/u.test(facts.currency) || (facts.priceBasis !== "per_person" && facts.priceBasis !== "total_event"))) return false;
  if (facts.currency !== undefined && (typeof facts.currency !== "string" || !/^[A-Z]{3}$/u.test(facts.currency))) return false;
  if (facts.priceBasis !== undefined && facts.priceBasis !== "per_person" && facts.priceBasis !== "total_event") return false;
  return (facts.pages === undefined || integer(facts.pages, 1, 100_000)) &&
    (facts.language === undefined || text(facts.language, 80)) &&
    (facts.stock === undefined || integer(facts.stock, 0, 1_000_000)) &&
    (facts.durationMinutes === undefined || integer(facts.durationMinutes, 1, 100_000));
}
const textSchema = (maximum: number, minimum = 1) => ({ type: "string", minLength: minimum, maxLength: maximum });
const draftProperties = {
  selectedEntityId: textSchema(36), eventTitle: textSchema(160), formatDescription: textSchema(600),
  evidenceRefs: { type: "array", minItems: 1, maxItems: 8, uniqueItems: true, items: textSchema(256) },
  agenda: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false,
    required: ["title", "minutes", "activity"], properties: { title: textSchema(100), minutes: { type: "integer", minimum: 1, maximum: 180 }, activity: textSchema(400) } } },
  materials: { type: "array", maxItems: 12, items: textSchema(120) }, invitation: textSchema(800),
};
export const CLUB_OUTPUT_SCHEMA = { anyOf: [
  { type: "object", additionalProperties: false, required: ["status", "proposal"], properties: {
    status: { type: "string", enum: ["proposal"] }, proposal: { type: "object", additionalProperties: false, required: Object.keys(draftProperties), properties: draftProperties },
  } },
  { type: "object", additionalProperties: false, required: ["status", "question"], properties: { status: { type: "string", enum: ["clarification"] }, question: textSchema(400) } },
] };

export function clubDraftShape(value: unknown): value is ClubDraft {
  const draft = record(value);
  if (!draft || !exact(draft, Object.keys(draftProperties)) || !text(draft.selectedEntityId, 36) || !uuid.test(draft.selectedEntityId) ||
    !text(draft.eventTitle, 160) || !text(draft.formatDescription, 600) || !text(draft.invitation, 800) ||
    !Array.isArray(draft.materials) || draft.materials.length > 12 || draft.materials.some((item) => !text(item, 120)) ||
    !Array.isArray(draft.evidenceRefs) || draft.evidenceRefs.length < 1 || draft.evidenceRefs.length > 8 ||
    draft.evidenceRefs.some((item) => !text(item, 256)) || new Set(draft.evidenceRefs).size !== draft.evidenceRefs.length ||
    !Array.isArray(draft.agenda) || draft.agenda.length < 1 || draft.agenda.length > 12) return false;
  return draft.agenda.every((value) => {
    const item = record(value);
    return !!item && exact(item, ["title", "minutes", "activity"]) && text(item.title, 100) && text(item.activity, 400) && integer(item.minutes, 1, 180);
  });
}

// Timings attached to the whole gathering are authoritative conflicts; activity
// allocations such as '10 minutes for discussion' are intentionally not totals.
function overallDurationConflict(goal: string, duration: number) {
  const normalized = goal.toLowerCase();
  for (const match of normalized.matchAll(/\b(\d+(?:\.\d+)?)\s*-?\s*(minutes?|mins?|hours?|hrs?)\b/gu)) {
    const before = normalized.slice(0, match.index);
    const after = normalized.slice((match.index ?? 0) + match[0].length);
    const event = "(?:event|session|gathering|workshop|meetup)";
    const beforeTotal = new RegExp(`\\b${event}\\s*(?:(?:(?:should|must|will|can)\\s+)?(?:be|is|lasts?|runs?|duration(?:\\s+is)?)\\s*(?:for\\s+)?|(?:for|of|:|=)\\s*)?$`, "u");
    const afterTotal = after.match(new RegExp(`^\\s+((?:[\\p{L}][\\p{L}'-]*\\s+){0,4})${event}\\b`, "u"));
    const adjectival = !!afterTotal && !/\b(?:for|of|in|during|with|and|then|before|after|include|including)\b/u.test(afterTotal[1]);
    const total = beforeTotal.test(before) || adjectival || /\b(?:overall|total)\s+(?:duration\s+)?(?:of|is|at|:|=|to)\s*$/u.test(before) ||
      /^\s*(?:(?:in\s+)?(?:total|overall)|altogether|in all)\b/u.test(after);
    if (total && Number(match[1]) * (/^(?:hour|hr)/u.test(match[2]) ? 60 : 1) !== duration) return true;
  }
  return false;
}

export type ClubInputResult = { ok: true; input: ClubInput } | { ok: false; code: string; message: string; clarification?: string };
export function parseClubInput(value: unknown): ClubInputResult {
  const invalid = (message: string): ClubInputResult => ({ ok: false, code: "INVALID_INPUT", message });
  if (!bounded(value, MAX_CLUB_INPUT_BYTES)) return invalid("Keep the selected planning inputs within 48 KiB.");
  const input = record(value);
  if (!input || !exact(input, ["club", "goal", "duration", "groupSize", "location", "budget", "maxPages", "languages", "format", "source", "interests", "resources", "selected", "mode"], ["previousPlan"])) return invalid("Check the gathering fields and selected candidate batch.");
  if (!text(input.club, 300, 3) || !text(input.goal, 1000, 5) || !text(input.location, 200, 0)) return invalid("Describe your group and gathering goal; keep the location optional and concise.");
  if (!integer(input.duration, 15, 180) || !integer(input.groupSize, 1, 500)) return invalid("Use a whole duration from 15 to 180 minutes and group size from 1 to 500.");
  if (!CULTURAL_KINDS.includes(input.format as never) && input.format !== "auto" && input.format !== "manual") return invalid("Choose a supported cultural focus or the organizer-led route.");
  if (input.source !== "discovery" && input.source !== "shortlist" && input.source !== "sample") return invalid("Choose discovery, a selected shortlist, or the illustrative example.");
  if (input.mode !== "generate" && input.mode !== "revise") return invalid("Choose Generate or Revise.");
  if (input.budget !== null) {
    const budget = record(input.budget);
    if (!budget || !exact(budget, ["amount", "currency", "basis"]) || typeof budget.amount !== "number" || !Number.isFinite(budget.amount) || budget.amount < 0 || budget.amount > 10_000_000 ||
      typeof budget.currency !== "string" || !/^[A-Z]{3}$/u.test(budget.currency) || (budget.basis !== "per_person" && budget.basis !== "total_event")) return invalid("A budget needs a finite nonnegative amount, three-letter currency, and per-person or total-event basis.");
  }
  if (input.maxPages !== null && !integer(input.maxPages, 1, 100_000)) return invalid("A book page limit must be a positive whole number or left blank.");
  if (!Array.isArray(input.languages) || input.languages.length > 20 || input.languages.some((item) => !text(item, 80)) || new Set(input.languages).size !== input.languages.length) return invalid("Use distinct language labels or leave the language filter empty.");
  if (!Array.isArray(input.interests) || input.interests.length > 5 || !input.interests.every(clubReferenceShape)) return invalid("Confirm up to five cultural interests from the picker.");
  if (input.selected !== null && !clubReferenceShape(input.selected)) return invalid("Confirm the selected cultural focus again.");
  if (!Array.isArray(input.resources) || input.resources.length > 5) return invalid("Choose at most five shortlist rows for explicit matching or planning.");
  const ids = new Set<string>();
  for (const value of input.resources) {
    const item = record(value);
    if (!item || !exact(item, ["localId", "kind", "name", "facts"], ["creator", "externalId", "reference"]) || !text(item.localId, 100) || ids.has(item.localId) || !CULTURAL_KINDS.includes(item.kind as never) ||
      !text(item.name, 200) || (item.creator !== undefined && !text(item.creator, 200)) || !factsShape(item.facts) || (item.reference !== undefined && !clubReferenceShape(item.reference))) return invalid("Shortlist rows need unique local IDs, supported types, names, and valid organizer-supplied facts.");
    ids.add(item.localId);
    if (item.externalId !== undefined) {
      const external = record(item.externalId);
      if (!external || !exact(external, ["type", "value"]) || !text(external.value, 100) ||
        !((external.type === "isbn13" && /^\d{13}$/u.test(external.value)) || (external.type === "imdb" && /^tt\d{5,12}$/u.test(external.value)) || (external.type === "spotify" && /^[A-Za-z0-9]{22}$/u.test(external.value)))) return invalid("Use only a supported ISBN-13, IMDb title ID, or Spotify artist ID.");
    }
  }
  if ((input.mode === "revise" && input.previousPlan === undefined) || (input.previousPlan !== undefined && !clubDraftShape(input.previousPlan))) return invalid("A revision needs a bounded previous proposal; it is historical context, not current evidence.");
  if (overallDurationConflict(input.goal as string, input.duration as number)) {
    const question = "The overall duration in the goal differs from the duration control. Which total should the gathering use? Update the control or goal first.";
    return { ok: false, code: "CLARIFICATION_REQUIRED", message: question, clarification: question };
  }
  return { ok: true, input: structuredClone(input) as ClubInput };
}

function proseIssue(value: string): string | null {
  if (/(?:https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|io)\b)/iu.test(value)) return "Proposal prose cannot contain playback, booking, or other URLs.";
  if (/\b(?:guaranteed?|booking confirmed|booked for you|tickets? (?:are )?available|rights (?:are )?cleared|licen[cs](?:e|ing) (?:is )?(?:secured|included)|will (?:attend|perform)|performance fee|everyone will|qloo (?:proves|guarantees))\b/iu.test(value)) return "Proposal prose contains an unverified availability, rights, attendance, or cultural claim.";
  if (/(?:[₹$€£]|\b(?:INR|USD|EUR|GBP)\b)\s*\d|\b(?:affinity|score|price|stock|fee)\s*(?::|is|of|=)?\s*\d|\b\d+\s*(?:rupees|copies|pages)\b/iu.test(value)) return "Keep numerical facts in the sourced evidence and constraint fields, not generated prose.";
  if (/\b(?:the|this)\s+(?:book|novel|story|plot|film|movie|artist)\s+(?:follows|tells|explores|features|depicts|chronicles|narrates|is set|was born)|\b(?:published in|first published|won the|nobel|pulitzer|booker prize)\b/iu.test(value)) return "Proposal prose contains unsupported cultural or biographical facts.";
  if (/\b(?:track(?:s)? (?:called|named|titled)|play(?:back)? (?:the )?song|listen to (?:the )?song|play (?:the )?track)\b/iu.test(value)) return "Song-level selections and playback facts are not supplied by this tool.";
  return null;
}

export function validateClubOutput(value: unknown, context: { input: ClubInput; discovery: ClubDiscovery | null; selectedEntityId?: string }):
  { ok: true; output: { status: "proposal"; proposal: ClubPlan } | { status: "clarification"; question: string } } | { ok: false; issues: string[] } {
  const output = record(value);
  if (!bounded(value, MAX_CLUB_OUTPUT_BYTES) || !output) return { ok: false, issues: ["Output is missing or exceeds 16 KiB."] };
  if (output.status === "clarification") {
    if (!exact(output, ["status", "question"]) || !text(output.question, 400)) return { ok: false, issues: ["Clarification must be one bounded question."] };
    const issue = proseIssue(output.question);
    return issue ? { ok: false, issues: [issue] } : { ok: true, output: { status: "clarification", question: output.question.trim() } };
  }
  if (output.status !== "proposal" || !exact(output, ["status", "proposal"]) || !clubDraftShape(output.proposal)) return { ok: false, issues: ["Proposal fields do not match the required bounded cultural-plan schema."] };
  const draft = output.proposal;
  const discovery = context.discovery;
  const focus = discovery?.candidates.find((item) => item.entity.entityId === draft.selectedEntityId);
  const issues: string[] = [];
  if (!discovery || !focus || focus.entity.kind !== discovery.kind) issues.push("Selected focus must belong to the current-run candidate set and recommendation type.");
  if (context.selectedEntityId && draft.selectedEntityId !== context.selectedEntityId) issues.push("Honor the organizer's explicit candidate selection; do not silently choose another entity.");
  if (focus?.assessments.some((assessment) => assessment.status === "violated")) issues.push("Selected focus violates an authoritative constraint.");
  const evidence = draft.evidenceRefs.flatMap((id) => {
    const matches = focus?.evidence.filter((item) => item.id === id) ?? [];
    if (matches.length !== 1 || matches[0].entityId !== draft.selectedEntityId || !Number.isFinite(matches[0].value)) {
      issues.push("Each evidence reference must match a current-run numerical fact for the selected focus."); return [];
    }
    return matches;
  });
  if (!evidence.length) issues.push("A Qloo-backed proposal requires actual current-run numerical evidence; there is no recorded-results fallback.");
  if (draft.agenda.reduce((sum, item) => sum + item.minutes, 0) !== context.input.duration) issues.push("Positive whole agenda minutes must sum exactly to the requested duration.");
  const prose = [draft.eventTitle, draft.formatDescription, draft.invitation, ...draft.materials, ...draft.agenda.flatMap((item) => [item.title, item.activity])];
  for (const value of prose) { const issue = proseIssue(value); if (issue && !issues.includes(issue)) issues.push(issue); }
  if (focus?.entity.kind === "movie") {
    const screen = draft.agenda.filter((item) => {
      const activity = `${item.title} ${item.activity}`;
      // Merely appending 'and discussion' must never exempt a full screening.
      const withoutNegation = activity.replace(/\b(?:no|without|do not)\s+(?:screen(?:ing)?|watch(?:ing)?)\b/giu, "");
      return /\b(?:screen(?:ing)?|watch(?:ing)?)\b/iu.test(withoutNegation);
    });
    const runtime = focus.entity.metadata.durationMinutes ?? focus.facts.durationMinutes;
    if (screen.length && (runtime === undefined || screen.reduce((sum, item) => sum + item.minutes, 0) < runtime)) issues.push("A screening needs a known full runtime that fits its allotted agenda; use discussion of a previously watched film instead.");
  }
  if (focus?.entity.kind === "artist" && focus.entity.metadata.musicVerified !== true) {
    const conditionalMusic = /\b(?:music|musical|listening|musician|concert|playlist)\b/iu.test(context.input.goal) &&
      focus.assessments.some((assessment) => assessment.constraint.toLowerCase() === "music identity" && assessment.status === "needs_confirmation");
    const namedFocus = focus.entity.name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const assertedIdentity = new RegExp(`(?:\\b(?:the|this)\\s+(?:artist|focus|entity|performer)|${namedFocus})\\s+(?:is|are)\\s+(?:a\\s+|the\\s+)?(?:musician|singer|band)\\b`, "iu");
    if (prose.some((value) => assertedIdentity.test(value) || /\b(?:verified|confirmed)\s+(?:musician|singer|band)\b|\bqloo\b.{0,30}\b(?:verif(?:ied|ies)|confirms?)\b.{0,30}\b(?:music|musician)\b/iu.test(value))) issues.push("The broad artist category cannot be presented as a verified musician identity.");
    if (!conditionalMusic && prose.some((value) => /\b(?:musician|music|listening|concert|songs?|tracks?|playback)\b/iu.test(value))) issues.push("Music activities require an explicit music-identity confirmation condition for an unverified artist.");
  }
  if (issues.length || !focus || !discovery) return { ok: false, issues: [...new Set(issues)] };
  const conditional = focus.assessments.some((assessment) => assessment.status === "needs_confirmation");
  return { ok: true, output: { status: "proposal", proposal: {
    ...structuredClone(draft), focus: structuredClone(focus), discovery: structuredClone(discovery), snapshot: structuredClone(context.input), conditional,
    warnings: [...discovery.warnings, "Activities and invitation are generated suggestions; provider facts and organizer-supplied facts are shown separately.",
      ...(conditional ? ["Feasibility is conditional. Confirm the listed unknown constraints before applying or making arrangements."] : [])],
  } } };
}
