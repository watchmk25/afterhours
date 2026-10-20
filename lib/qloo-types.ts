import type { FilterInputs } from "./types.ts";

export type InterestKind = "movie" | "artist";
export type InterestReference = { preset: "a" | "b"; index: 0 | 1 } | { token: string };
export type QlooInterest = {
  entityId: string;
  name: string;
  kind: InterestKind;
  disambiguation?: string;
  reference: InterestReference;
};
export type QlooContribution = { interestId: string; score: number };
export type QlooRankedBook = {
  localId: string;
  affinity: number | null;
  contributions: QlooContribution[];
};
export type QlooRanking = {
  ranked: QlooRankedBook[];
  eligibleCount: number;
  supportedCount: number;
  assessedCount: number;
  unassessed: { localId: string; reason: "unresolved" | "not_returned" }[];
  interests: QlooInterest[];
  aggregate: { interestId: string; avgScore: number }[];
  explanationWarnings: string[];
};
export type QlooRankRequest = {
  catalogueSource: "sample";
  filters: FilterInputs;
  interests: InterestReference[];
};
export type QlooError = { code: string; message: string; upstreamStatus?: number };
export type QlooSearchResponse = { ok: true; candidates: QlooInterest[] } | { ok: false; error: QlooError };
export type QlooRankResponse = ({ ok: true } & QlooRanking) | { ok: false; error: QlooError };
