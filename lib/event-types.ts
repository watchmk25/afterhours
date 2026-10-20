import type { InterestReference, QlooInterest } from "./qloo-types.ts";
import type { Book, FilterInputs } from "./types.ts";

export type ProposalDraft = {
  selectedBookId: string;
  eventTitle: string;
  rationale: string;
  evidenceRefs: string[];
  agenda: { title: string; minutes: number; activity: string }[];
  materials: string[];
  invitation: string;
};

export type EventAgentInput = {
  catalogueSource: "sample";
  filters: FilterInputs;
  interests: InterestReference[];
  request: string;
  duration: number;
  mode: "generate" | "revise";
  previousProposal?: ProposalDraft;
};

export type EventEvidence = {
  id: string;
  bookId: string;
  kind: "affinity" | "contribution";
  value: number;
  interestId?: string;
  interestName?: string;
};

export type EventProposal = ProposalDraft & {
  book: Book;
  evidence: EventEvidence[];
  coverage: { eligibleCount: number; supportedCount: number; assessedCount: number };
  duration: number;
  interests: QlooInterest[];
  warnings: string[];
};

export type EventNativeOutput =
  | { status: "proposal"; proposal: ProposalDraft }
  | { status: "clarification"; question: string };

export type EventValidatedOutput =
  | { status: "proposal"; proposal: EventProposal }
  | { status: "clarification"; question: string };

export type AgentAction = {
  action: "gemini" | "rank_eligible_books" | "validation";
  status: "completed" | "failed";
  detail: string;
  elapsedMs?: number;
  deadline?: "gemini_request" | "sdk_http" | "agent_run" | "qloo_request" | "user_cancel";
};

export type EventUsage = { geminiRequests: number; qlooRequests: number };

export type EventAgentResponse =
  | { ok: true; result: EventValidatedOutput; trace: AgentAction[]; usage: EventUsage }
  | { ok: false; error: { code: string; message: string; upstreamStatus?: number }; trace: AgentAction[]; usage: EventUsage };
