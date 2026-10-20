import { SAMPLE_CATALOGUE } from "../lib/catalogue.ts";
import { createDefaultInputs, filterBooks } from "../lib/workspace.ts";

// Previously verified by the organizer; callers must still record its evidence.
export const BOOK_GUIDE_ID = "DF4272D0-A6BA-445B-88DC-172A56B5D183";

export type Resolution = {
  key: string;
  entityId: string | null;
  status: "resolved" | "unresolved";
  evidence: string;
};

export type ShortlistItem = { localId: string; title: string; entityId: string };

type SearchItem = { key: string; query: string; type: "book" | "movie" | "artist" };

const audienceSearches: readonly SearchItem[] = [
  { key: "audience-a-film", query: "Amélie", type: "movie" },
  { key: "audience-a-artist", query: "Norah Jones", type: "artist" },
  { key: "audience-b-film", query: "Interstellar", type: "movie" },
  { key: "audience-b-artist", query: "Hans Zimmer", type: "artist" },
];
const knownKeys = new Set([
  ...SAMPLE_CATALOGUE.map((book) => book.id),
  ...audienceSearches.map((item) => item.key),
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireUuid(value: unknown): asserts value is string {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("A resolved entity must have a valid UUID.");
  }
}

/** Fixed requests only; the caller caps each search at three candidates. */
export function buildSearchPlan(): SearchItem[] {
  return [
    ...SAMPLE_CATALOGUE.filter((book) => book.id !== "the-guide").map((book) => ({
      key: book.id, query: book.title, type: "book" as const,
    })),
    ...audienceSearches.map((item) => ({ ...item })),
  ];
}

/** Only explicit, evidenced human resolutions may enter the experiment. */
export function eligibleShortlist(resolutions: readonly Resolution[]): ShortlistItem[] {
  const resolved = new Map<string, string>();
  const seenKeys = new Set<string>();
  const seenIds = new Set<string>();
  for (const resolution of resolutions) {
    if (!knownKeys.has(resolution.key) || seenKeys.has(resolution.key)) {
      throw new Error("Resolution keys must be recognized and unique.");
    }
    seenKeys.add(resolution.key);
    if (resolution.status === "unresolved") continue;
    if (resolution.status !== "resolved") throw new Error("Invalid resolution status.");
    const id = resolution.entityId;
    requireUuid(id);
    if (typeof resolution.evidence !== "string" || !resolution.evidence.trim()) {
      throw new Error("A resolved entity requires explicit review evidence.");
    }
    const normalizedId = id.toLowerCase();
    if (seenIds.has(normalizedId)) throw new Error("Resolved Qloo entity IDs must be unique.");
    seenIds.add(normalizedId);
    resolved.set(resolution.key, id);
  }

  return filterBooks(SAMPLE_CATALOGUE, createDefaultInputs().filters).flatMap((book) => {
    const entityId = resolved.get(book.id);
    return entityId ? [{ localId: book.id, title: book.title, entityId }] : [];
  });
}

function validateShortlist(shortlist: readonly ShortlistItem[]) {
  const ids = new Set<string>();
  const localIds = new Set<string>();
  for (const item of shortlist) {
    requireUuid(item.entityId);
    if (!item.localId.trim() || !item.title.trim() || localIds.has(item.localId)) {
      throw new Error("Shortlist books require unique local IDs and nonempty titles.");
    }
    const normalizedId = item.entityId.toLowerCase();
    if (ids.has(normalizedId)) throw new Error("Shortlist Qloo entity IDs must be unique.");
    ids.add(normalizedId);
    localIds.add(item.localId);
  }
  return ids;
}

/** Parameters restrict ranking to the locally eligible, manually resolved set. */
export function rankingParams(shortlist: readonly ShortlistItem[], signalIds: readonly string[]) {
  if (shortlist.length < 2 || shortlist.length > 50) {
    throw new Error("Ranking requires between 2 and 50 eligible resolved books.");
  }
  validateShortlist(shortlist);
  if (signalIds.length !== 2) throw new Error("Exactly two distinct audience signals are required.");
  signalIds.forEach(requireUuid);
  if (signalIds[0].toLowerCase() === signalIds[1].toLowerCase()) {
    throw new Error("Exactly two distinct audience signals are required.");
  }
  return {
    "filter.type": "urn:entity:book",
    "filter.results.entities": shortlist.map((book) => book.entityId).join(","),
    "signal.interests.entities": signalIds.join(","),
    "feature.explainability": true,
    sort_by: "affinity",
    take: shortlist.length,
  };
}

/** Missing rows are reported separately; a foreign or repeated row is invalid. */
export function verifyMembership(rows: readonly { entity_id: string }[], shortlist: readonly ShortlistItem[]) {
  const allowed = validateShortlist(shortlist);
  const returned = new Set<string>();
  for (const row of rows) {
    requireUuid(row.entity_id);
    const normalizedId = row.entity_id.toLowerCase();
    if (!allowed.has(normalizedId)) throw new Error("Qloo returned a book outside the shortlist.");
    if (returned.has(normalizedId)) throw new Error("Qloo returned a duplicate shortlist book.");
    returned.add(normalizedId);
  }
  return { missing: shortlist.filter((book) => !returned.has(book.entityId.toLowerCase())) };
}

/** Reserve before a request, including a failed request; never exceed 15. */
export function reserveRequest(count: number, max = 15): number {
  if (!Number.isInteger(max) || max < 1 || max > 15 || !Number.isInteger(count) || count < 0) {
    throw new Error("Invalid request budget.");
  }
  if (count >= max) throw new Error("Qloo feasibility request budget exhausted.");
  return count + 1;
}
