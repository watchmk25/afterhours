"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Book, FilterInputs } from "@/lib/types";
import type { QlooInterest } from "@/lib/qloo-types";
import type { EventAgentResponse, EventProposal, ProposalDraft } from "@/lib/event-types";
import { SAMPLE_QLOO_MAPPINGS } from "@/lib/qloo-sample";

type Preview = { scope: string; context: string; attempt: number; proposal: EventProposal };
type RunState = {
  scope: string; pending: boolean; error: string; message: string; question: string;
  trace: EventAgentResponse["trace"]; usage: EventAgentResponse["usage"] | null;
};
const formatNumber = new Intl.NumberFormat("en", { maximumFractionDigits: 4 });
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const actions = { gemini: "Gemini model", rank_eligible_books: "Qloo eligible-book ranking", validation: "Proposal validation" };

function historicalDraft(proposal: EventProposal): ProposalDraft {
  return {
    selectedBookId: proposal.selectedBookId, eventTitle: proposal.eventTitle,
    rationale: proposal.rationale, evidenceRefs: [...proposal.evidenceRefs],
    agenda: proposal.agenda.map((item) => ({ ...item })),
    materials: [...proposal.materials], invitation: proposal.invitation,
  };
}

export function EventAgent({ source, filters, eligibleBooks, invalid, interests, contextScope, onApply }: {
  source: "sample" | "imported";
  filters: FilterInputs;
  eligibleBooks: readonly Book[];
  invalid: boolean;
  interests: readonly QlooInterest[];
  contextScope: string;
  onApply: (context: string, proposal: EventProposal) => void;
}) {
  const fieldId = useId();
  const [request, setRequest] = useState("Plan an interactive event with paired discussion and reflection.");
  const [duration, setDuration] = useState("45");
  const [revision, setRevision] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const controller = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const lock = useRef(false);
  const scope = JSON.stringify([contextScope, revision, request, duration]);
  const currentRun = run?.scope === scope ? run : null;
  const pending = !!currentRun?.pending;
  const requestValid = request.trim().length >= 10 && request.trim().length <= 1000;
  const durationValid = /^\d+$/.test(duration) && Number.isInteger(Number(duration)) && Number(duration) >= 15 && Number(duration) <= 180;
  const supported = source === "sample" ? eligibleBooks.filter((book) => Object.hasOwn(SAMPLE_QLOO_MAPPINGS, book.id)).length : 0;
  const blocked = source !== "sample" || invalid || interests.length === 0 || supported === 0 || !requestValid || !durationValid;
  const stale = !!preview && (preview.scope !== scope || preview.attempt !== attempt);
  const selectedStillEligible = !!preview && eligibleBooks.some((book) => book.id === preview.proposal.selectedBookId);

  useEffect(() => () => {
    generation.current += 1;
    controller.current?.abort();
    lock.current = false;
  }, [scope]);

  function changeInput() {
    generation.current += 1;
    controller.current?.abort();
    lock.current = false;
    setRevision((current) => current + 1);
  }

  function cancel() {
    generation.current += 1;
    controller.current?.abort();
    lock.current = false;
    setRun({ scope, pending: false, error: "", question: "", trace: [], usage: null,
      message: "Generation cancelled locally. Any server work already started may finish; its response will not be applied." });
  }

  async function generate(mode: "generate" | "revise") {
    if (blocked || lock.current || (mode === "revise" && !preview)) return;
    const activeController = new AbortController();
    controller.current?.abort();
    controller.current = activeController;
    const activeGeneration = ++generation.current;
    lock.current = true;
    setAttempt(activeGeneration);
    setRun({ scope, pending: true, error: "", message: "", question: "", trace: [], usage: null });
    try {
      const response = await fetch("/api/event-agent", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: activeController.signal,
        body: JSON.stringify({
          catalogueSource: "sample", filters, interests: interests.map((interest) => interest.reference),
          request: request.trim(), duration: Number(duration), mode,
          ...(mode === "revise" && preview ? { previousProposal: historicalDraft(preview.proposal) } : {}),
        }),
      });
      const payload = await response.json() as EventAgentResponse;
      if (activeController.signal.aborted || activeGeneration !== generation.current) return;
      if (!payload.ok) {
        setRun({ scope, pending: false, error: payload.error.message, message: "", question: "", trace: payload.trace, usage: payload.usage });
      } else if (!response.ok) {
        throw new Error("Unexpected proposal response");
      } else if (payload.result.status === "clarification") {
        setRun({ scope, pending: false, error: "", message: "", question: payload.result.question, trace: payload.trace, usage: payload.usage });
      } else {
        setPreview({ scope, context: contextScope, attempt: activeGeneration, proposal: payload.result.proposal });
        setRun({ scope, pending: false, error: "", question: "", message: "Proposal ready to review. Your selected book and edited outline have not changed.", trace: payload.trace, usage: payload.usage });
      }
    } catch {
      if (activeController.signal.aborted || activeGeneration !== generation.current) return;
      setRun({ scope, pending: false, error: "The proposal service could not complete this request. No proposal was applied and your outline is unchanged. Try again only when you are ready.", message: "", question: "", trace: [], usage: null });
    } finally {
      if (activeGeneration === generation.current) lock.current = false;
    }
  }

  return (
    <section className="panel event-agent-panel" aria-labelledby={`${fieldId}-title`}>
      <div className="section-heading event-agent-heading"><div><p className="eyebrow">OPTIONAL / PROPOSE AN EVENT</p><h2 id={`${fieldId}-title`}>Gemini event planner</h2></div><span className="small-tag">Review before applying</span></div>
      <p className="quiet event-agent-intro">Ask for an event proposal using confirmed interests and the current sample-book limits. Gemini may request a fresh Qloo ranking; the server checks the proposed book, evidence, and timings. Nothing is generated automatically. Your event outline changes only when you apply a proposal.</p>
      {source !== "sample" && <p className="qloo-notice" role="status">Live matching and planning support the sample catalogue only. Imported inventory still works with local filters and the fixed event template.</p>}
      <div className="event-agent-inputs">
        <div className="field"><label className="field-label" htmlFor={`${fieldId}-request`}>Event request</label><textarea id={`${fieldId}-request`} className="textarea" rows={3} maxLength={1000} value={request} disabled={source !== "sample"} aria-invalid={!requestValid} aria-describedby={`${fieldId}-request-help`} onChange={(event) => { changeInput(); setRequest(event.target.value); }} /><p className={requestValid ? "quiet" : "field-error"} id={`${fieldId}-request-help`}>Use 10–1000 characters. Describe activities or accessibility needs; avoid private participant details.</p></div>
        <div className="field"><label className="field-label" htmlFor={`${fieldId}-duration`}>Event duration (minutes)</label><input id={`${fieldId}-duration`} className="input" type="number" min={15} max={180} step={1} value={duration} disabled={source !== "sample"} aria-invalid={!durationValid} aria-describedby={`${fieldId}-duration-help`} onChange={(event) => { changeInput(); setDuration(event.target.value); }} /><p className={durationValid ? "quiet" : "field-error"} id={`${fieldId}-duration-help`}>A whole number from 15 to 180. Agenda timings must total this duration.</p></div>
      </div>
      <div className="event-agent-actions">
        <button className="button button-primary" disabled={blocked || pending} onClick={() => void generate("generate")}>Generate proposal</button>
        <button className="button button-secondary" disabled={blocked || pending || !preview} onClick={() => void generate("revise")}>Revise proposal</button>
        {pending && <button className="button button-secondary" onClick={cancel}>Cancel generation</button>}
      </div>
      {source === "sample" && (invalid || interests.length === 0 || supported === 0) && <p className="quiet event-agent-help">Use valid filters, confirm at least one film or musician, and keep at least one sample book with a reviewed Qloo match eligible.</p>}
      {pending && <p className="event-agent-status" role="status">Preparing proposal…</p>}
      {currentRun?.message && <p className="event-agent-status" role="status">{currentRun.message}</p>}
      {currentRun?.error && <p className="qloo-error" role="alert">{currentRun.error}</p>}
      {currentRun?.question && <div className="qloo-notice" role="status"><h3>Clarification needed</h3><p>{currentRun.question}</p><p className="quiet">Update the event request, then generate or revise explicitly. No proposal has been applied.</p></div>}
      {run && !pending && (run.trace.length > 0 || run.usage) && <details className="event-agent-trace"><summary>Run activity{run.scope !== scope ? " from the previous request" : ""}</summary><ol>{run.trace.map((item, index) => <li key={index}><strong>{actions[item.action]} · {item.status}</strong><p>{item.detail}</p></li>)}</ol>{run.usage && <p>Gemini requests: {run.usage.geminiRequests} · Qloo requests: {run.usage.qlooRequests}</p>}</details>}
      {preview && <section className="event-proposal-preview" aria-labelledby={`${fieldId}-preview-title`}>
        <h3 id={`${fieldId}-preview-title`}>Event proposal preview</h3>
        {stale && <p className="qloo-notice" role="status">This preview is stale. Its inputs changed or a newer attempt did not produce a replacement. Generate or revise with the current inputs before applying.</p>}
        <p className="quiet">Gemini-proposed wording and activities. Qloo supplies the numerical evidence shown separately below. Review all practical details.</p>
        <h4 className="event-proposal-title">{preview.proposal.eventTitle}</h4>
        <div className="event-proposal-book"><h4>{preview.proposal.book.title}</h4><p>by {preview.proposal.book.author}</p><p className="quiet">{money.format(preview.proposal.book.priceInr)} · {preview.proposal.book.pages} pages · {preview.proposal.book.language} · {preview.proposal.book.stock} copies · illustrative sample values</p></div>
        <p className="qloo-coverage">{preview.proposal.coverage.assessedCount} of {preview.proposal.coverage.eligibleCount} eligible books assessed by Qloo; {preview.proposal.coverage.supportedCount} have reviewed mappings.</p>
        <h4>Gemini’s proposed rationale</h4><p className="event-proposal-copy">{preview.proposal.rationale}</p>
        <div className="event-proposal-evidence"><h4>Numerical evidence supplied by Qloo</h4><ul>{preview.proposal.evidence.filter((item) => preview.proposal.evidenceRefs.includes(item.id)).map((item) => <li key={item.id}>{item.kind === "affinity" ? "Qloo affinity" : `Input contribution: ${item.interestName ?? "confirmed interest"}`}: {formatNumber.format(item.value)}</li>)}</ul><p className="quiet">Provider scores are relative values, not probabilities or guarantees of individual preferences.</p></div>
        <h4>Proposed agenda · {preview.proposal.duration} minutes</h4><ol className="event-proposal-agenda">{preview.proposal.agenda.map((item, index) => <li key={index}><strong>{item.title} · {item.minutes} minutes</strong><p>{item.activity}</p></li>)}</ol>
        <h4>Proposed materials</h4>{preview.proposal.materials.length ? <ul className="event-proposal-materials">{preview.proposal.materials.map((material, index) => <li key={index}>{material}</li>)}</ul> : <p className="quiet">No materials proposed.</p>}
        <h4>Proposed invitation</h4><p className="event-proposal-copy">{preview.proposal.invitation}</p>
        {preview.proposal.warnings.map((warning, index) => <p className="qloo-notice" key={index}>{warning}</p>)}
        <p className="event-proposal-apply-note">Applying this proposal replaces your selected book and all event-outline fields, including your edits. Generating or revising alone does not change them.</p>
        <button className="button button-primary" disabled={stale || pending || source !== "sample" || invalid || !selectedStillEligible} onClick={() => {
          if (!stale && !pending && source === "sample" && !invalid && selectedStillEligible) onApply(preview.context, preview.proposal);
        }}>Apply proposal</button>
      </section>}
    </section>
  );
}
