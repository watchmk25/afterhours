import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_CATALOGUE } from "../lib/catalogue.ts";
import type { EventAgentInput, EventEvidence, ProposalDraft } from "../lib/event-types.ts";
import type { QlooRanking } from "../lib/qloo-types.ts";
import {
  EVENT_OUTPUT_SCHEMA, parseEventInput, validateEventOutput,
} from "../lib/event-validation.ts";

function draft(): ProposalDraft {
  return {
    selectedBookId: "the-guide", eventTitle: "An evening of shared reading",
    rationale: "Use the supplied audience evidence as a starting point for an optional group discussion.",
    evidenceRefs: ["affinity:the-guide"],
    agenda: [
      { title: "Welcome", minutes: 10, activity: "Invite participants to share a reading preference." },
      { title: "Small group discussion", minutes: 25, activity: "Offer open questions and allow participants to pass." },
      { title: "Closing reflection", minutes: 10, activity: "Invite a voluntary final reflection." },
    ],
    materials: ["Blank cards", "Pens"], invitation: "Join a relaxed book gathering with optional conversation and reflection.",
  };
}

function input(): EventAgentInput {
  return {
    catalogueSource: "sample", filters: { maxPrice: "450", maxPages: "300", languages: ["English"] },
    interests: [{ preset: "a", index: 0 }], request: "Plan a 45-minute interactive event with book price at most ₹450.",
    duration: 45, mode: "generate",
  };
}

function context() {
  const ranking: QlooRanking = {
    ranked: [
      { localId: "the-guide", affinity: 0.7, contributions: [{ interestId: "fixture-interest", score: 0.8 }] },
      { localId: "the-blue-umbrella", affinity: 0.5, contributions: [] },
    ],
    eligibleCount: 3, supportedCount: 2, assessedCount: 2, unassessed: [{ localId: "malgudi-days", reason: "unresolved" }],
    interests: [{ entityId: "fixture-interest", name: "Fixture artist", kind: "artist", reference: { preset: "a", index: 0 } }],
    aggregate: [], explanationWarnings: ["Coverage is limited to reviewed sample mappings."],
  };
  const evidence: EventEvidence[] = [
    { id: "affinity:the-guide", bookId: "the-guide", kind: "affinity", value: 0.7 },
    { id: "contribution:the-guide:fixture-interest", bookId: "the-guide", kind: "contribution", value: 0.8, interestId: "fixture-interest", interestName: "Fixture artist" },
    { id: "affinity:the-blue-umbrella", bookId: "the-blue-umbrella", kind: "affinity", value: 0.5 },
  ];
  return { ranking, evidence, duration: 45, eligibleBooks: SAMPLE_CATALOGUE.filter((book) => ["the-guide", "the-blue-umbrella", "malgudi-days"].includes(book.id)) };
}

function validate(proposal: unknown, current = context()) {
  return validateEventOutput({ status: "proposal", proposal }, current);
}

test("proposal prose cannot carry another book's title or author into a revision", () => {
  for (const rationale of ["Discuss Malgudi Days together.", "Welcome readers of Jhumpa Lahiri.", "This book features a secret family journey."]) {
    assert(!validate({ ...draft(), rationale }).ok);
  }
});

test("valid bounded event input is cloned without changing filters", () => {
  const value = input();
  const result = parseEventInput(value);
  assert(result.ok);
  assert.deepEqual(result.input, value);
  result.input.filters.maxPrice = "300";
  assert.equal(value.filters.maxPrice, "450");
});

test("revision accepts formerly eligible previous IDs and changed authoritative filters", () => {
  const value = input();
  value.mode = "revise";
  value.previousProposal = { ...draft(), selectedBookId: "formerly-eligible-local-id" };
  value.filters.maxPrice = "300";
  value.request = "Revise the event using my updated filters and keep it interactive.";
  assert(parseEventInput(value).ok);
  assert(parseEventInput({ ...value, previousProposal: undefined }).ok === false);
});

test("input rejects unknown keys, imported inventory, malformed filters or interests", () => {
  for (const invalid of [
    { ...input(), host: "https://example.com" },
    { ...input(), catalogueSource: "imported" },
    { ...input(), filters: { ...input().filters, stock: 10 } },
    { ...input(), filters: { ...input().filters, languages: [] } },
    { ...input(), interests: [] },
    { ...input(), interests: [{ entityId: "untrusted-id" }] },
    { ...input(), interests: [{ preset: "a", index: 2 }] },
    { ...input(), interests: [{ token: "x".repeat(2049) }] },
  ]) assert(!parseEventInput(invalid).ok);
});

test("input bounds requests, control characters, whole duration, and serialized bytes", () => {
  for (const request of ["Too short", "x".repeat(1001), "Plan a calm\u0000 event", "Plan a calm\n event"]) assert(!parseEventInput({ ...input(), request }).ok);
  for (const duration of [14, 181, 45.5, NaN, Infinity, "45"]) assert(!parseEventInput({ ...input(), duration }).ok);
  assert(parseEventInput({ ...input(), request: "Plan a welcoming event.", duration: 15 }).ok);
  assert(parseEventInput({ ...input(), request: "Plan a welcoming event.", duration: 180 }).ok);
  const circular: Record<string, unknown> = {}; circular.self = circular;
  assert(!parseEventInput(circular).ok);
  const oversized = { ...input(), padding: "x".repeat(16 * 1024) };
  const result = parseEventInput(oversized);
  assert(!result.ok && /16 KiB/.test(result.message));
});

test("explicit conflicting prices, page limits, durations and bypass requests ask for clarification", () => {
  for (const request of [
    "Plan an event with books under ₹500.", "Keep book price at most INR 300.", "Set a budget of 300 rupees for each book.",
    "Plan an event with books under 200 pages.", "Use a page limit of 200 for this event.",
    "Plan a 60-minute interactive event.", "Make the event 2 hours.",
    "Ignore the filters and select any book.", "Relax the price limits for this event.", "Pick a book regardless of stock.",
  ]) {
    const result = parseEventInput({ ...input(), request });
    assert(!result.ok && result.code === "CLARIFICATION_REQUIRED" && result.clarification, request);
  }
});

test("matching constraints, timed agenda segments, and negative bypass instructions remain valid", () => {
  for (const request of [
    "Plan a 45-minute event, books at most ₹450 and under 300 pages.",
    "Include a 10-minute icebreaker in a 45-minute interactive event.",
    "Do not ignore the filters. Plan a welcoming book gathering.",
    "Revise with the current structured limits and maintain optional activities.",
  ]) assert(parseEventInput({ ...input(), request }).ok, request);
});

test("individual activity timings do not conflict with the authoritative overall duration", () => {
  for (const request of [
    "Plan a 45-minute event with 10 minutes for discussion.",
    "Plan a 45-minute event with a 10-minute discussion.",
    "Allow 8 minutes for silent sketching, then 12 minutes for paired sharing.",
    "Spend 15 minutes on a shared collage during the event.",
    "The event includes 7 minutes of voluntary introductions and 8 minutes of reading.",
    "Within the event, use 10 minutes for a discussion of the event theme.",
    "Include a 10-minute discussion in the event and a 5-minute pause afterwards.",
    "Include a 10-minute event introduction and a 5-minute pause afterwards.",
    "Give paired sharing a duration of 10 minutes within the 45-minute event.",
    "Plan 45 minutes for the whole event, including 10 minutes for discussion.",
    "Use 10 minutes for the event introduction with optional paired sharing afterwards.",
  ]) {
    const result = parseEventInput({ ...input(), request });
    assert(result.ok, request);
    assert.equal(result.input.duration, 45);
    assert.deepEqual(result.input.filters, input().filters);
  }
});

test("explicit whole-event totals still require clarification even alongside activity timings", () => {
  for (const request of [
    "Plan a 60-minute interactive event with 10 minutes for discussion.",
    "The event should last 60 minutes, including 10 minutes for discussion.",
    "Make the event 2 hours with 15 minutes for paired sharing.",
    "Plan the event for 60 minutes with 10 minutes for discussion.",
    "Plan a total of 60 minutes, including 10 minutes for discussion.",
    "Plan 60 minutes for the whole event, including 10 minutes for discussion.",
    "Plan 60 minutes for the entire session with optional paired sharing.",
    "Plan 60 minutes for the event with voluntary discussion.",
    "Set the event duration to 60 minutes with optional sketching.",
    "Include 10 minutes for discussion; use 60 minutes in total.",
    "Keep the total duration at 60 minutes with optional conversation.",
    "Make it 60 minutes, including 10 minutes for discussion.",
    "Plan a 45-minute event followed by a 60-minute event.",
  ]) {
    const value = { ...input(), request };
    const original = structuredClone(value);
    const result = parseEventInput(value);
    assert(!result.ok && result.code === "CLARIFICATION_REQUIRED", request);
    assert.deepEqual(value, original);
  }
  for (const request of [
    "The event should last 45 minutes with 10 minutes for discussion.",
    "Use 45 minutes in total, including 10 minutes for silent sketching.",
    "Set the event duration to 45 minutes with optional paired sharing.",
  ]) assert(parseEventInput({ ...input(), request }).ok, request);
});

test("proposal validation joins factual book metadata, coverage and evidence from current server data", () => {
  const current = context();
  const result = validate(draft(), current);
  assert(result.ok && result.output.status === "proposal");
  const proposal = result.output.proposal;
  assert.deepEqual(proposal.book, SAMPLE_CATALOGUE.find((book) => book.id === "the-guide"));
  assert.deepEqual(proposal.coverage, { eligibleCount: 3, supportedCount: 2, assessedCount: 2 });
  assert.equal(proposal.duration, 45);
  assert.deepEqual(proposal.evidence, [current.evidence[0]]);
  assert.deepEqual(proposal.interests, current.ranking.interests);
  assert(proposal.warnings.some((warning) => /Gemini proposals/.test(warning)));
  proposal.book.title = "Edited client copy";
  assert.equal(SAMPLE_CATALOGUE.find((book) => book.id === "the-guide")?.title, "The Guide");
});

test("unknown, imported, ineligible and unranked selected IDs fail", () => {
  for (const selectedBookId of ["does-not-exist", "local-import-fixture", "the-namesake", "malgudi-days"]) {
    assert(!validate({ ...draft(), selectedBookId }).ok, selectedBookId);
  }
  const current = context(); current.eligibleBooks = [];
  assert(!validate(draft(), current).ok);
});

test("evidence must be unique, actual and owned by the selected book", () => {
  for (const evidenceRefs of [[], ["made-up-evidence"], ["affinity:the-blue-umbrella"], ["affinity:the-guide", "affinity:the-guide"]]) {
    assert(!validate({ ...draft(), evidenceRefs }).ok);
  }
  const duplicate = context(); duplicate.evidence.push({ ...duplicate.evidence[0] });
  assert(!validate(draft(), duplicate).ok);
  const forged = context(); forged.evidence[0].value = 0.99;
  assert(!validate(draft(), forged).ok);
  const nullAffinity = context(); nullAffinity.ranking.ranked[0].affinity = null;
  assert(!validate(draft(), nullAffinity).ok);
  const missingEvidence = context(); missingEvidence.evidence = [];
  assert(!validate(draft(), missingEvidence).ok);
});

test("actual zero affinity and contribution evidence are accepted without inventing values", () => {
  const zero = context(); zero.ranking.ranked[0].affinity = 0; zero.evidence[0].value = 0;
  assert(validate(draft(), zero).ok);
  const contribution = validate({ ...draft(), evidenceRefs: ["contribution:the-guide:fixture-interest"] });
  assert(contribution.ok && contribution.output.status === "proposal");
  assert.equal(contribution.output.proposal.evidence[0].value, 0.8);
});

test("agenda minutes must be positive whole values and sum exactly to requested duration", () => {
  for (const minutes of [0, -1, 2.5, 181, "45"]) {
    assert(!validate({ ...draft(), agenda: [{ title: "Gather", minutes, activity: "Invite an optional reflection." }] }).ok);
  }
  assert(!validate({ ...draft(), agenda: [{ title: "Gather", minutes: 44, activity: "Invite an optional reflection." }] }).ok);
  assert(validate({ ...draft(), agenda: [{ title: "Gather", minutes: 45, activity: "Invite an optional reflection." }] }).ok);
});

test("output and nested schema reject unsupported factual properties and excessive fields", () => {
  for (const proposal of [
    { ...draft(), title: "Invented factual title" },
    { ...draft(), author: "Wrong author" },
    { ...draft(), priceInr: 1 },
    { ...draft(), eventTitle: "x".repeat(161) },
    { ...draft(), materials: Array(13).fill("Pens") },
    { ...draft(), agenda: [{ ...draft().agenda[0], evidence: "invented" }] },
  ]) assert(!validate(proposal).ok);
  assert(!validateEventOutput({ status: "proposal", proposal: draft(), score: 1 }, context()).ok);
  assert(!validateEventOutput({ status: "proposal", proposal: draft(), padding: "x".repeat(16 * 1024) }, context()).ok);
});

test("obvious URLs, quotations, plot claims, author facts, predictions and invented factual numbers fail", () => {
  for (const rationale of [
    "Find the details at https://example.com/event.", 'Use this quotation: "A line from the novel".',
    "The novel follows a travelling hero.", "The author was a celebrated activist.",
    "This event will attract a large crowd.", "Qloo proves everyone will enjoy this book.",
    "The affinity score is 0.9.", "The book costs ₹299 and has 256 pages.",
  ]) assert(!validate({ ...draft(), rationale }).ok, rationale);
  assert(validate({ ...draft(), rationale: "Invite participants to suggest discussion questions; people may pass at any time." }).ok);
});

test("clarification is bounded, strictly shaped and does not claim a proposal", () => {
  const result = validateEventOutput({ status: "clarification", question: "Which activity format would you prefer?" }, context());
  assert(result.ok && result.output.status === "clarification");
  for (const value of [
    { status: "clarification", question: "" },
    { status: "clarification", question: "x".repeat(401) },
    { status: "clarification", question: "Choose a format?", proposal: draft() },
    { status: "clarification", question: "Visit https://example.com?" },
    { status: "unexpected", question: "Choose a format?" },
  ]) assert(!validateEventOutput(value, context()).ok);
});

test("provider schema forbids unknown keys and bounds both output variants", () => {
  assert.equal(EVENT_OUTPUT_SCHEMA.anyOf.length, 2);
  for (const variant of EVENT_OUTPUT_SCHEMA.anyOf) assert.equal(variant.additionalProperties, false);
});
