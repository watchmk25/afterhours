// Application identities and organizer facts are distinct from signed Qloo evidence.
export const CULTURAL_KINDS = ["book", "artist", "movie", "place"] as const;
export type CulturalKind = typeof CULTURAL_KINDS[number];
export type EntityReference = { token: string } | { preset: "a" | "b"; index: 0 | 1 } | { sample: string };
export type CulturalMetadata = {
  creator?: string; year?: number; durationMinutes?: number; address?: string;
  priceLevel?: number; musicVerified?: boolean;
};
export type CulturalEntity = {
  entityId: string; kind: CulturalKind; name: string; disambiguation?: string;
  imageUrl?: string; metadata: CulturalMetadata; reference: EntityReference;
};
export type MoneyBudget = { amount: number; currency: string; basis: "per_person" | "total_event" };
export type ResourceFacts = {
  price?: number; currency?: string; priceBasis?: "per_person" | "total_event";
  pages?: number; language?: string; stock?: number; durationMinutes?: number;
};
export type ClubResource = {
  localId: string; kind: CulturalKind; name: string; creator?: string;
  externalId?: { type: "isbn13" | "imdb" | "spotify"; value: string };
  facts: ResourceFacts; reference?: EntityReference;
};
export type ClubInput = {
  club: string; goal: string; duration: number; groupSize: number; location: string;
  budget: MoneyBudget | null; maxPages: number | null; languages: string[];
  format: CulturalKind | "auto" | "manual";
  source: "discovery" | "shortlist" | "sample";
  interests: EntityReference[]; resources: ClubResource[];
  selected: EntityReference | null;
  mode: "generate" | "revise";
  previousPlan?: ClubDraft;
};
export type ConstraintAssessment = {
  constraint: string; status: "satisfied" | "violated" | "needs_confirmation";
  source: "provider" | "organizer" | "illustrative" | "unknown"; detail: string;
};
export type ClubEvidence = {
  id: string; entityId: string; kind: "affinity" | "contribution"; value: number;
  interestId?: string; interestName?: string;
};
export type ClubCandidate = {
  entity: CulturalEntity; localId?: string; facts: ResourceFacts;
  factSource: "provider" | "organizer" | "illustrative";
  assessments: ConstraintAssessment[]; evidence: ClubEvidence[];
};
export type ClubDiscovery = {
  kind: CulturalKind; candidates: ClubCandidate[]; interests: CulturalEntity[];
  pool?: { localId?: string; name: string; kind: CulturalKind; entityId?: string; status: "resolved" | "unresolved" }[];
  coverage: { submitted: number | null; resolved: number | null; assessed: number };
  warnings: string[];
};
export type ClubDraft = {
  selectedEntityId: string; eventTitle: string; formatDescription: string;
  evidenceRefs: string[]; agenda: { title: string; minutes: number; activity: string }[];
  materials: string[]; invitation: string;
};
export type ClubPlan = ClubDraft & {
  focus: ClubCandidate; discovery: ClubDiscovery; snapshot: ClubInput;
  conditional: boolean; warnings: string[];
};
export type ClubTrace = { stage: string; elapsedMs: number; outcome: "completed" | "failed" };
export type ClubError = { code: string; message: string; upstreamStatus?: number; retryAfterSeconds?: number };
export type ClubResult<T> = { status: number; body: ({ ok: true } & T) | { ok: false; error: ClubError } };
export type ClubAgentResponse =
  | { ok: true; result: { status: "proposal"; proposal: ClubPlan } | { status: "clarification"; question: string }; trace: ClubTrace[]; usage: { geminiRequests: number; qlooRequests: number } }
  | { ok: false; error: ClubError; trace: ClubTrace[]; usage: { geminiRequests: number; qlooRequests: number } | null };
