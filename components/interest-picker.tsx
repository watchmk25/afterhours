"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { CulturalEntity } from "@/lib/club-types";
import { QLOO_PRESETS } from "@/lib/qloo-sample";
import { CulturalThumbnail, EntitySummary } from "./cultural-card";

export const REVIEWED_INTERESTS: CulturalEntity[] = QLOO_PRESETS.flatMap((preset) => preset.interests.map((interest) => ({ ...interest, metadata: {} })));
const CACHE_LIFETIME_MS = 20 * 60 * 1000;

export function InterestPicker({ interests, onChange }: { interests: CulturalEntity[]; onChange(value: CulturalEntity[]): void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const cache = useRef(new Map<string, { at: number; entities: CulturalEntity[] }>());
  const sequence = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const [query, setQuery] = useState("");
  const [composing, setComposing] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState<CulturalEntity[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const normalized = query.trim().normalize("NFC");
  const suggestions = normalized.length < 3;
  const choices = suggestions ? REVIEWED_INTERESTS : results;

  useEffect(() => {
    const current = ++sequence.current;
    controller.current?.abort();
    if (composing || normalized.length < 3) return;
    const timer = setTimeout(async () => {
      const cached = cache.current.get(normalized);
      if (cached && Date.now() - cached.at < CACHE_LIFETIME_MS) {
        setResults(cached.entities); setMessage(cached.entities.length ? "Recent results reused in this page." : "No matching supported interests found."); setLoading(false); return;
      }
      const cancellation = new AbortController();
      controller.current = cancellation;
      setLoading(true); setMessage("Searching cultural interests…"); setResults([]);
      try {
        const response = await fetch("/api/club/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: normalized }), signal: cancellation.signal });
        const body = await response.json();
        if (current !== sequence.current || cancellation.signal.aborted) return;
        if (!body.ok) { setMessage(body.error?.message ?? "Interest search is unavailable. Your confirmed interests are unchanged."); return; }
        const entities: CulturalEntity[] = Array.isArray(body.candidates) ? body.candidates.slice(0, 8) : [];
        cache.current.set(normalized, { at: Date.now(), entities });
        if (cache.current.size > 30) cache.current.delete(cache.current.keys().next().value!);
        setResults(entities); setActive(-1); setMessage(entities.length ? `${entities.length} results. Confirm the intended entity.` : "No matching supported interests found. Try identifying words such as a year or creator.");
      } catch { if (current === sequence.current && !cancellation.signal.aborted) setMessage("Interest search is unavailable. Your confirmed interests are unchanged."); }
      finally { if (current === sequence.current) setLoading(false); }
    }, 475);
    return () => { clearTimeout(timer); controller.current?.abort(); };
  }, [normalized, composing]);

  function add(entity: CulturalEntity) {
    if (interests.some((interest) => interest.entityId === entity.entityId)) { setMessage(`${entity.name} is already confirmed.`); return; }
    if (interests.length >= 5) { setMessage("Five interests are already confirmed. Remove one before adding another."); return; }
    onChange([...interests, entity]); setQuery(""); setResults([]); setActive(-1); setOpen(false); setLoading(false); setMessage(`${entity.name} confirmed.`); input.current?.focus();
  }

  return <div className="club-interest-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }}>
    <label className="field"><span className="field-label">Audience interests</span>
      <input ref={input} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-results`} aria-activedescendant={open && active >= 0 && active < choices.length ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-help ${id}-status`} value={query} maxLength={100} placeholder="Search a book, film, artist or place" onFocus={() => { setOpen(true); setActive(-1); }} onClick={() => setOpen(true)}
        onChange={(event) => { setQuery(event.target.value); setResults([]); setActive(-1); setOpen(true); setLoading(false); }}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={(event) => { setComposing(false); setQuery(event.currentTarget.value); }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || composing) return;
          if (event.key === "Escape") { setOpen(false); setActive(-1); return; }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((current) => choices.length ? current < 0 ? (event.key === "ArrowDown" ? 0 : choices.length - 1) : (current + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length : -1); }
          if (event.key === "Enter") { event.preventDefault(); if (open && active >= 0 && choices[active]) add(choices[active]); }
        }} />
    </label>
    <p id={`${id}-help`} className="quiet">Confirm up to five interests. Search starts after three characters and a short pause; no category choice is needed.</p>
    {open && <div className="club-picker-menu">
      <p className="club-picker-label">{suggestions ? "Reviewed examples — no search required" : "Search results"}</p>
      <div role="listbox" id={`${id}-results`} aria-label={suggestions ? "Reviewed interest examples" : "Cultural interest results"} aria-busy={loading}>
        {choices.map((entity, index) => <button type="button" role="option" id={`${id}-option-${index}`} key={entity.entityId} aria-selected={active === index} className="club-picker-option" onMouseDown={(event) => event.preventDefault()} onClick={() => add(entity)}><CulturalThumbnail entity={entity} /><span className="club-entity-copy"><EntitySummary entity={entity} />{interests.some((item) => item.entityId === entity.entityId) && <small>Already confirmed</small>}</span></button>)}
      </div>
      {suggestions && <p className="quiet">These are examples, not a popularity chart.</p>}
    </div>}
    <p id={`${id}-status`} role="status" className="quiet club-search-status">{loading ? "Searching cultural interests…" : message}</p>
    <ul className="club-chips" aria-label="Confirmed interests">{interests.map((interest) => <li key={interest.entityId}><span><strong>{interest.name}</strong> <small>{interest.kind}{interest.disambiguation ? ` · ${interest.disambiguation}` : ""}</small></span><button type="button" aria-label={`Remove ${interest.name}`} onClick={() => onChange(interests.filter((entry) => entry.entityId !== interest.entityId))}>×</button></li>)}</ul>
    {!interests.length && <p className="quiet">No confirmed interests yet. Only confirmed chips influence Qloo.</p>}
  </div>;
}
