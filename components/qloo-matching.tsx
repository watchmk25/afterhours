"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Book, FilterInputs } from "@/lib/types";
import { QLOO_PRESETS, SAMPLE_QLOO_MAPPINGS } from "@/lib/qloo-sample";
import type {
  InterestKind, QlooInterest, QlooRanking, QlooRankResponse, QlooSearchResponse,
} from "@/lib/qloo-types";

type SearchState = { scope: string; pending: boolean; candidates: QlooInterest[]; error: string };
type RankState = { scope: string; pending: boolean; error: string };

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 4 });
const interestLabel = (interest: QlooInterest) =>
  `${interest.name}${interest.disambiguation ? ` (${interest.disambiguation})` : ""}`;

export function QlooMatching({
  source, filters, eligibleBooks, invalid, interests, onInterestsChange,
  ranking, rankingScope, onRankStart, onRanking, onSelect,
}: {
  source: "sample" | "imported";
  filters: FilterInputs;
  eligibleBooks: readonly Book[];
  invalid: boolean;
  interests: readonly QlooInterest[];
  onInterestsChange: (interests: QlooInterest[]) => void;
  ranking: QlooRanking | null;
  rankingScope: string;
  onRankStart: () => void;
  onRanking: (scope: string, ranking: QlooRanking) => void;
  onSelect: (localId: string) => void;
}) {
  const fieldId = useId();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<InterestKind>("movie");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [rank, setRank] = useState<RankState | null>(null);
  const searchGeneration = useRef(0);
  const rankGeneration = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  const rankController = useRef<AbortController | null>(null);
  const searchLock = useRef<string | null>(null);
  const rankLock = useRef<string | null>(null);
  const searchScope = JSON.stringify([source, kind, query]);
  const currentSearch = search?.scope === searchScope ? search : null;
  const currentRank = rank?.scope === rankingScope ? rank : null;
  const sample = source === "sample";
  const supportedCount = sample
    ? eligibleBooks.filter((book) => Object.hasOwn(SAMPLE_QLOO_MAPPINGS, book.id)).length : 0;
  const selectedCandidate = currentSearch?.candidates.find((item) => item.entityId === candidateId);
  const duplicateCandidate = selectedCandidate && interests.some((item) => item.entityId.toLowerCase() === selectedCandidate.entityId.toLowerCase());
  const rankBlocked = !sample || invalid || interests.length === 0 || supportedCount < 2;

  useEffect(() => () => {
    searchGeneration.current += 1;
    searchController.current?.abort();
    searchLock.current = null;
  }, [source]);

  useEffect(() => () => {
    rankGeneration.current += 1;
    rankController.current?.abort();
    rankLock.current = null;
  }, [rankingScope]);

  function changeSearch() {
    searchGeneration.current += 1;
    searchController.current?.abort();
    searchLock.current = null;
    setSearch(null);
    setCandidateId(null);
  }

  async function searchInterests() {
    if (!sample || query.trim().length < 1 || query.trim().length > 100 || searchLock.current === searchScope) return;
    searchController.current?.abort();
    const controller = new AbortController();
    const generation = ++searchGeneration.current;
    searchController.current = controller;
    searchLock.current = searchScope;
    setCandidateId(null);
    setSearch({ scope: searchScope, pending: true, candidates: [], error: "" });
    try {
      const response = await fetch("/api/qloo/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), kind }), signal: controller.signal,
      });
      const payload = await response.json() as QlooSearchResponse;
      if (controller.signal.aborted || generation !== searchGeneration.current) return;
      if (!payload.ok) {
        setSearch({ scope: searchScope, pending: false, candidates: [], error: payload.error.message });
      } else if (!response.ok || !Array.isArray(payload.candidates)) {
        throw new Error("Unexpected search response");
      } else {
        setSearch({ scope: searchScope, pending: false, candidates: payload.candidates, error: "" });
      }
    } catch {
      if (controller.signal.aborted || generation !== searchGeneration.current) return;
      setSearch({ scope: searchScope, pending: false, candidates: [], error: "The search service could not be reached. Your confirmed interests are unchanged. You can try again explicitly." });
    } finally {
      if (generation === searchGeneration.current) searchLock.current = null;
    }
  }

  async function rankBooks() {
    if (rankBlocked || rankLock.current === rankingScope) return;
    rankController.current?.abort();
    const controller = new AbortController();
    const generation = ++rankGeneration.current;
    rankController.current = controller;
    rankLock.current = rankingScope;
    onRankStart();
    setRank({ scope: rankingScope, pending: true, error: "" });
    try {
      const response = await fetch("/api/qloo/rank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogueSource: "sample", filters, interests: interests.map((item) => item.reference) }),
        signal: controller.signal,
      });
      const payload = await response.json() as QlooRankResponse;
      if (controller.signal.aborted || generation !== rankGeneration.current) return;
      if (!payload.ok) {
        setRank({ scope: rankingScope, pending: false, error: payload.error.message });
      } else if (!response.ok || !Array.isArray(payload.ranked)) {
        throw new Error("Unexpected ranking response");
      } else {
        onRanking(rankingScope, payload);
        setRank({ scope: rankingScope, pending: false, error: "" });
      }
    } catch {
      if (controller.signal.aborted || generation !== rankGeneration.current) return;
      setRank({ scope: rankingScope, pending: false, error: "The matching service could not be reached. Your book selection and outline are unchanged. You can try again explicitly." });
    } finally {
      if (generation === rankGeneration.current) rankLock.current = null;
    }
  }

  const contributionName = (id: string) => ranking?.interests.find((item) => item.entityId === id)?.name ?? "Unlabelled confirmed interest";

  return (
    <section className="panel qloo-panel" aria-labelledby="qloo-title">
      <div className="section-heading qloo-heading">
        <div><p className="eyebrow">OPTIONAL / CULTURAL INTERESTS</p><h2 id="qloo-title">Live Qloo matching</h2></div>
        <span className="small-tag">On request</span>
      </div>
      <p className="quiet qloo-intro">
        Confirm films or musicians, then ask Qloo to order supported eligible books.
        Searching and ranking send requests only when you press their buttons.
        Audience notes below are unconfirmed text and are never used as Qloo signals. AI planning is not connected.
      </p>
      {!sample && <p className="qloo-notice" role="status">Qloo matching supports the sample catalogue only. Imported inventory stays available with local filters and event templates. Restore the sample catalogue to use live matching.</p>}
      <div className="qloo-input-grid">
        <div>
          <h3 className="qloo-subtitle">Confirm audience interests</h3>
          <p className="quiet">Each example button confirms its displayed pair, replacing the current confirmed interests.</p>
          <div className="qloo-presets">
            {QLOO_PRESETS.map((preset) => <button key={preset.id} className="button button-secondary" disabled={!sample} onClick={() => onInterestsChange([...preset.interests])}>{preset.label}</button>)}
          </div>
          <div className="qloo-search-fields">
            <div className="field">
              <label className="field-label" htmlFor={`${fieldId}-kind`}>Interest type</label>
              <select id={`${fieldId}-kind`} className="input" value={kind} disabled={!sample} onChange={(event) => { changeSearch(); setKind(event.target.value as InterestKind); }}>
                <option value="movie">Film</option><option value="artist">Musician</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor={`${fieldId}-query`}>Find a film or musician</label>
              <input id={`${fieldId}-query`} className="input" value={query} maxLength={100} disabled={!sample} placeholder="Enter a name to search" aria-describedby={`${fieldId}-search-help`} onChange={(event) => { changeSearch(); setQuery(event.target.value); }} />
            </div>
          </div>
          <p className="quiet qloo-search-help" id={`${fieldId}-search-help`}>Use 1–100 characters. Search returns at most three candidates; check the name and details before confirming.</p>
          <button className="button button-secondary" disabled={!sample || query.trim().length < 1 || !!currentSearch?.pending} onClick={() => void searchInterests()}>{currentSearch?.pending ? "Searching Qloo…" : "Search Qloo"}</button>
          {currentSearch?.error && <p className="qloo-error" role="alert">{currentSearch.error}</p>}
          {currentSearch && !currentSearch.pending && !currentSearch.error && (
            currentSearch.candidates.length > 0 ? <fieldset className="qloo-candidates">
              <legend className="field-label">Search candidates</legend>
              {currentSearch.candidates.map((candidate) => <label className="qloo-candidate" key={candidate.entityId}>
                <input type="radio" name={`${fieldId}-candidate`} checked={candidateId === candidate.entityId} disabled={!sample} onChange={() => setCandidateId(candidate.entityId)} />
                <span><strong>{candidate.name}</strong><span className="quiet">{candidate.kind === "movie" ? "Film" : "Musician"}{candidate.disambiguation ? ` · ${candidate.disambiguation}` : " · No further details supplied"}</span></span>
              </label>)}
              <button className="button button-secondary" disabled={!sample || !selectedCandidate || !!duplicateCandidate || interests.length >= 5} onClick={() => {
                if (selectedCandidate && !duplicateCandidate && interests.length < 5) onInterestsChange([...interests, selectedCandidate]);
              }}>Confirm interest</button>
              {duplicateCandidate && <p className="quiet">This interest is already confirmed.</p>}
            </fieldset> : <p className="quiet qloo-notice" role="status">No candidates found. Try a more specific name.</p>
          )}
        </div>
        <div className="qloo-confirmed">
          <h3 className="qloo-subtitle">Confirmed interests <span className="count-badge">{interests.length}/5</span></h3>
          <p className="quiet">Only this list is sent as audience signals. Removing or changing an interest clears the current ranking.</p>
          {interests.length ? <ul className="qloo-interest-list" aria-label="Confirmed interests">
            {interests.map((interest) => <li key={interest.entityId}>
              <div><strong>{interestLabel(interest)}</strong><p className="quiet">{interest.kind === "movie" ? "Film" : "Musician"}</p></div>
              <button className="button button-secondary" aria-label={`Remove ${interestLabel(interest)}`} onClick={() => onInterestsChange(interests.filter((item) => item.entityId !== interest.entityId))}>Remove</button>
            </li>)}
          </ul> : <p className="quiet qloo-notice">No confirmed interests yet. Choose an example pair or search and confirm a candidate.</p>}
          {interests.length >= 5 && <p className="quiet">Five interests confirmed. Remove one before adding another.</p>}
        </div>
      </div>
      <div className="qloo-rank-action">
        <div><p className="field-label">{sample ? `${supportedCount} of ${eligibleBooks.length} eligible books have reviewed Qloo mappings` : "Live matching unavailable for imported inventory"}</p>
          <p className="quiet">Keep at least two supported books eligible and confirm an interest. Unassessed books stay browsable below.</p></div>
        <button className="button button-primary" disabled={rankBlocked || !!currentRank?.pending} onClick={() => void rankBooks()}>{currentRank?.pending ? "Ranking with Qloo…" : "Rank with Qloo"}</button>
      </div>
      {invalid && sample && <p className="quiet">Correct the marked filters before ranking.</p>}
      {currentRank?.pending && <p role="status" className="quiet">Waiting for Qloo. You can keep editing your workspace; changes invalidate this request.</p>}
      {currentRank?.error && <p className="qloo-error" role="alert">{currentRank.error}</p>}
      {ranking && <section className="qloo-ranking" aria-labelledby={`${fieldId}-ranking-title`}>
        <h3 id={`${fieldId}-ranking-title`} className="qloo-subtitle">Qloo ranking</h3>
        <p className="qloo-coverage" role="status">{ranking.assessedCount} of {ranking.eligibleCount} eligible books assessed by Qloo. {ranking.supportedCount} have reviewed mappings.</p>
        <p className="quiet">Provider affinity is a relative matching score, not a probability or a guarantee that readers will enjoy a book. Choose a book yourself to open its event template.</p>
        <ol className="qloo-ranked-list">
          {ranking.ranked.map((item) => {
            const book = eligibleBooks.find((candidate) => candidate.id === item.localId);
            if (!book) return null;
            return <li key={item.localId}>
              <div className="qloo-ranked-heading"><div><h4>{book.title}</h4><p className="quiet">by {book.author}</p></div><button className="button button-secondary" aria-label={`Select ranked: ${book.title}`} onClick={() => onSelect(book.id)}>Select book</button></div>
              <p className="qloo-affinity">Qloo affinity: <strong>{item.affinity === null ? "Not supplied" : number.format(item.affinity)}</strong></p>
              {item.contributions.length > 0 ? <div className="qloo-contributions"><p className="field-label">Input contributions for this book</p><ul>{item.contributions.map((contribution) => <li key={contribution.interestId}>{contributionName(contribution.interestId)}: {number.format(contribution.score)}</li>)}</ul></div> : <p className="quiet">No numeric input contributions supplied for this book.</p>}
            </li>;
          })}
        </ol>
        {ranking.aggregate.length > 0 && <div className="qloo-aggregate"><h4>Average input contributions across returned books</h4><ul>{ranking.aggregate.map((contribution) => <li key={contribution.interestId}>{contributionName(contribution.interestId)}: {number.format(contribution.avgScore)}</li>)}</ul><p className="quiet">These provider values describe contributions from confirmed inputs. They do not explain a person’s culture or predict individual preferences.</p></div>}
        {ranking.unassessed.length > 0 && <div className="qloo-unassessed"><h4>Not assessed by Qloo</h4><ul>{ranking.unassessed.map((item) => <li key={item.localId}>{eligibleBooks.find((book) => book.id === item.localId)?.title ?? "Eligible book"}: {item.reason === "unresolved" ? "provider identity has not been resolved" : "not returned in this response"}</li>)}</ul></div>}
        {ranking.explanationWarnings.map((warning, index) => <p className="qloo-notice" key={index}>{warning}</p>)}
      </section>}
    </section>
  );
}
