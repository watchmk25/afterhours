import assert from "node:assert/strict";
import test from "node:test";
import type { ClubDiscovery, ClubDraft, ClubInput, CulturalKind } from "../lib/club-types.ts";
import { CLUB_OUTPUT_SCHEMA, parseClubInput, validateClubOutput } from "../lib/club-validation.ts";

const entityId = "11111111-1111-4111-8111-111111111111";
function input(kind: CulturalKind = "book"): ClubInput {
  return { club: "Neighborhood curiosity collective", goal: "Plan an interactive gathering with 10 minutes for discussion.",
    duration: 45, groupSize: 12, location: "", budget: null, maxPages: null, languages: [],
    format: kind, source: "discovery", interests: [{ preset: "a", index: 0 }], resources: [], selected: null, mode: "generate" };
}
function draft(): ClubDraft {
  return { selectedEntityId: entityId, eventTitle: "A shared cultural evening", formatDescription: "Offer paired conversation and optional creative responses.",
    evidenceRefs: [`affinity:${entityId}`], agenda: [
      { title: "Welcome", minutes: 5, activity: "Invite introductions or a quiet pass." },
      { title: "Paired conversation", minutes: 30, activity: "Offer open prompts and voluntary responses." },
      { title: "Reflection", minutes: 10, activity: "Invite a final observation or a quiet pass." },
    ], materials: ["Blank cards", "Pens"], invitation: "Join a relaxed cultural gathering with optional conversation." };
}
function discovery(kind: CulturalKind = "book"): ClubDiscovery {
  return { kind, candidates: [{ entity: { entityId, name: "Synthetic cultural focus", kind, metadata: {}, reference: { token: "fixture-reference" } },
    facts: {}, factSource: "provider", assessments: [], evidence: [{ id: `affinity:${entityId}`, entityId, kind: "affinity", value: 0.71 }] }],
    interests: [], coverage: { submitted: null, resolved: null, assessed: 1 }, warnings: [] };
}
function validate(value: ClubDraft = draft(), kind: CulturalKind = "book", current = discovery(kind)) {
  return validateClubOutput({ status: "proposal", proposal: value }, { input: input(kind), discovery: current });
}

test("a free-text group and all four cultural formats share the same validated input and proposal contract", () => {
  for (const kind of ["book", "artist", "movie", "place"] as const) {
    const value = input(kind);
    const parsed = parseClubInput(value);
    assert(parsed.ok); assert.deepEqual(parsed.input, value);
    parsed.input.club = "Changed"; assert.equal(value.club, "Neighborhood curiosity collective");
    const result = validate(draft(), kind);
    assert(result.ok && result.output.status === "proposal");
    assert.equal(result.output.proposal.focus.entity.kind, kind);
    assert.equal(result.output.proposal.agenda.reduce((sum, item) => sum + item.minutes, 0), 45);
  }
});

test("valid activity timings do not conflict, while explicit overall-duration conflicts ask one question", () => {
  for (const goal of ["Plan a 45-minute event with 10 minutes for discussion.", "Plan a gathering with 20 minutes for reflection and 10 minutes for discussion."])
    assert(parseClubInput({ ...input(), goal }).ok);
  for (const goal of ["Plan a 60-minute interactive event.", "The gathering lasts 60 minutes.", "Use a total duration of 60 minutes.", "Plan an event for 1 hour."] ) {
    const result = parseClubInput({ ...input(), goal }); assert(!result.ok && result.clarification);
  }
});

test("input rejects unbounded fields, arbitrary endpoints, unsupported types, invalid numerical units, and malformed references", () => {
  for (const value of [
    { ...input(), endpoint: "https://untrusted.invalid" }, { ...input(), format: "song" }, { ...input(), source: "pdf" },
    { ...input(), duration: 14 }, { ...input(), duration: 181 }, { ...input(), duration: 45.5 }, { ...input(), groupSize: 0 },
    { ...input(), groupSize: 501 }, { ...input(), budget: { amount: NaN, currency: "INR", basis: "per_person" } },
    { ...input(), budget: { amount: 500, currency: "rupees", basis: "per_person" } },
    { ...input(), budget: { amount: 500, currency: "INR", basis: "unknown" } },
    { ...input(), maxPages: -1 }, { ...input(), languages: ["English", "English"] },
    { ...input(), interests: Array.from({ length: 6 }, () => ({ preset: "a", index: 0 })) },
    { ...input(), interests: [{ entityId }] }, { ...input(), interests: [{ token: "x".repeat(4097) }] },
    { ...input(), selected: { preset: "a", index: 2 } }, { ...input(), club: "x".repeat(301) },
    { ...input(), goal: "Plan a\u0000 cultural gathering" }, { ...input(), mode: "revise" },
  ]) assert(!parseClubInput(value).ok, JSON.stringify(value));
  assert(parseClubInput({ ...input(), interests: [{ sample: "the-guide" }] }).ok);
  assert(parseClubInput({ ...input(), mode: "revise", previousPlan: draft() }).ok);
  const cycle: Record<string, unknown> = {}; cycle.self = cycle; assert(!parseClubInput(cycle).ok);
});

test("shortlist batch is small, requires distinct local identities, and labels facts with explicit currency and basis", () => {
  const row = { localId: "resource-a", kind: "book", name: "Same name", creator: "First author", facts: { price: 400, currency: "INR", priceBasis: "per_person" } };
  assert(parseClubInput({ ...input(), source: "shortlist", resources: [row, { ...row, localId: "resource-b", creator: "Second author" }] }).ok);
  for (const resources of [[row, row], Array.from({ length: 6 }, (_, index) => ({ ...row, localId: `${index}` })),
    [{ ...row, facts: { price: 400 } }], [{ ...row, facts: { pages: 0 } }], [{ ...row, facts: { stock: -1 } }],
    [{ ...row, externalId: { type: "url", value: "https://untrusted.invalid" } }]]) assert(!parseClubInput({ ...input(), resources }).ok);
});

test("output requires current-run selected membership, matching type, actual numerical evidence and exact duration", () => {
  assert(!validateClubOutput({ status: "proposal", proposal: draft() }, { input: input(), discovery: null }).ok);
  assert(!validate({ ...draft(), selectedEntityId: "22222222-2222-4222-8222-222222222222" }).ok);
  assert(!validate({ ...draft(), evidenceRefs: ["recorded-evidence-from-an-earlier-run"] }).ok);
  assert(!validate({ ...draft(), evidenceRefs: [`affinity:${entityId}`, `affinity:${entityId}`] }).ok);
  assert(!validate({ ...draft(), agenda: [{ title: "One activity", minutes: 44, activity: "Offer open conversation." }] }).ok);
  const wrong = discovery(); wrong.candidates[0].entity.kind = "movie"; assert(!validate(draft(), "book", wrong).ok);
  const invalid = discovery(); invalid.candidates[0].evidence[0].value = Infinity; assert(!validate(draft(), "book", invalid).ok);
});

test("explicit candidate selection is honored and hard violations cannot become proposals", () => {
  assert(!validateClubOutput({ status: "proposal", proposal: draft() }, { input: input(), discovery: discovery(), selectedEntityId: "22222222-2222-4222-8222-222222222222" }).ok);
  const current = discovery();
  current.candidates[0].assessments.push({ constraint: "budget", source: "organizer", status: "violated", detail: "Supplied cost exceeds the budget." });
  assert(!validate(draft(), "book", current).ok);
});

test("unknown costs and availability remain conditional with their provenance, not silently satisfied", () => {
  const current = discovery("place");
  current.candidates[0].entity.metadata.priceLevel = 2;
  current.candidates[0].assessments.push({ constraint: "budget", status: "needs_confirmation", source: "unknown", detail: "An ordinal venue price level is not an exact monetary price." });
  const result = validate(draft(), "place", current);
  assert(result.ok && result.output.status === "proposal");
  assert.equal(result.output.proposal.conditional, true);
  assert.deepEqual(result.output.proposal.focus.assessments, current.candidates[0].assessments);
  assert(result.output.proposal.warnings.some((item) => item.includes("conditional")));
});

test("a short movie discussion may use a previously watched film, but cannot hide an overlong screening behind discussion", () => {
  const current = discovery("movie"); current.candidates[0].entity.metadata.durationMinutes = 169;
  const good = { ...draft(), agenda: [{ title: "Film discussion", minutes: 45, activity: "Discuss a film watched beforehand through optional paired reflections." }] };
  assert(validate(good, "movie", current).ok);
  for (const activity of ["Screen the entire film and discuss it.", "Watch the film then hold a discussion.", "Screen a previously watched film and discuss it."])
    assert(!validate({ ...draft(), agenda: [{ title: "Shared viewing", minutes: 45, activity }] }, "movie", current).ok);
  assert(!validate({ ...draft(), agenda: [{ title: "Screening", minutes: 45, activity: "Screen the film together." }] }, "movie", discovery("movie")).ok);
});

test("artist membership alone does not establish a musician and fabricated logistics or narrative facts are rejected", () => {
  assert(!validate({ ...draft(), formatDescription: "Offer a music listening session." }, "artist").ok);
  const current = discovery("artist"); current.candidates[0].entity.metadata.musicVerified = true;
  assert(validate({ ...draft(), formatDescription: "Offer a music listening discussion with organizer-confirmed playback." }, "artist", current).ok);
  for (const invitation of ["The artist will perform for everyone.", "Tickets are available and booking confirmed.", "Screening rights are cleared.", "This movie depicts a secret family journey.", "Costs are INR 450 per person.", "Play the track titled Secret Song.", "Listen here https://untrusted.invalid"]) assert(!validate({ ...draft(), invitation }).ok);
});

test("an unverified artist can support an explicitly conditional music activity without becoming a provider fact", () => {
  const current = discovery("artist");
  current.candidates[0].assessments.push({ constraint: "Music identity", source: "unknown", status: "needs_confirmation", detail: "Confirm that the intended artist is a musician before arranging listening activities." });
  const musical = { ...input("artist"), goal: "Plan a music listening gathering." };
  const value = { ...draft(), formatDescription: "Offer conditional music-listening activities after the organizer confirms the intended music identity." };
  const result = validateClubOutput({ status: "proposal", proposal: value }, { input: musical, discovery: current });
  assert(result.ok && result.output.status === "proposal"); assert.equal(result.output.proposal.conditional, true);
  assert.equal(result.output.proposal.focus.entity.metadata.musicVerified, undefined);
  assert.equal(result.output.proposal.focus.assessments[0].source, "unknown");
  for (const formatDescription of ["This artist is a musician.", "Synthetic cultural focus is a singer.", "Qloo confirms this artist's music identity.", "Plan activities with this verified musician."]) {
    assert(!validateClubOutput({ status: "proposal", proposal: { ...value, formatDescription } }, { input: musical, discovery: current }).ok);
  }
  assert(!validateClubOutput({ status: "proposal", proposal: value }, { input: input("artist"), discovery: current }).ok);
});

test("output schema remains bounded and clarification cannot smuggle proposal fields", () => {
  assert(JSON.stringify(CLUB_OUTPUT_SCHEMA).includes("selectedEntityId"));
  const response = validateClubOutput({ status: "clarification", question: "Should the primary focus be a film or a book?" }, { input: input(), discovery: null });
  assert(response.ok && response.output.status === "clarification");
  assert(!validateClubOutput({ status: "clarification", question: "Choose?", proposal: draft() }, { input: input(), discovery: null }).ok);
  assert(!validate({ ...draft(), eventTitle: "x".repeat(161) }).ok);
});
