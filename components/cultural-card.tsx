"use client";

import { useEffect, useState } from "react";
import type { ClubCandidate, CulturalEntity } from "@/lib/club-types";

export const KIND_LABELS = { book: "Book", artist: "Artist", movie: "Movie", place: "Place" };

export function CulturalThumbnail({ entity }: { entity: Pick<CulturalEntity, "name" | "kind" | "imageUrl"> }) {
  const [loaded, setLoaded] = useState<{ source: string; blob: string } | null>(null);
  let image: string | null = null;
  try {
    const url = new URL(entity.imageUrl ?? "");
    if (url.protocol === "https:" && ["images.qloo.com", "staging.images.qloo.com"].includes(url.hostname) &&
      !url.username && !url.password && !url.port && !url.search && !url.hash && /^\/i\/[^/]+\.(?:jpg|jpeg|png|webp)$/i.test(url.pathname)) image = url.href;
  } catch { /* Missing or unsupported images use the same accessible fallback. */ }
  useEffect(() => {
    if (!image) return;
    const source = image;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    const timer = setTimeout(() => controller.abort(), 5000);
    void (async () => {
      try {
        const response = await fetch(source, { signal: controller.signal, redirect: "error", credentials: "omit", referrerPolicy: "no-referrer" });
        if (!response.ok || !["image/jpeg", "image/png", "image/webp"].includes(response.headers.get("content-type")?.split(";", 1)[0] ?? "")) return;
        const reader = response.body?.getReader();
        if (!reader) return;
        let size = 0;
        const chunks: Uint8Array[] = [];
        try {
          while (true) {
            const part = await reader.read();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > 4 * 1024 * 1024 || controller.signal.aborted) { await reader.cancel(); return; }
            chunks.push(part.value);
          }
        } finally { reader.releaseLock(); }
        if (controller.signal.aborted) return;
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: response.headers.get("content-type")! }));
        setLoaded({ source, blob: objectUrl });
      } catch { /* CORS, redirect, timeout and broken images all use the fallback. */ }
      finally { clearTimeout(timer); }
    })();
    return () => { clearTimeout(timer); controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [image]);
  return <span className="club-thumbnail" aria-hidden="true">
    {image && loaded?.source === image
      // A direct, allowlisted public image avoids arbitrary URL proxying and sends no credentials.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={loaded.blob} alt="" loading="lazy" onError={() => setLoaded(null)} />
      : <span className="club-thumbnail-fallback">{KIND_LABELS[entity.kind].slice(0, 1)}<small>No image</small></span>}
  </span>;
}

export function EntitySummary({ entity }: { entity: CulturalEntity }) {
  const details = [entity.disambiguation, entity.metadata.creator, entity.metadata.year?.toString(), entity.metadata.address]
    .filter((value, index, values) => value && values.indexOf(value) === index);
  return <><strong>{entity.name}</strong><span className="club-type">{KIND_LABELS[entity.kind]}</span>
    {details.length > 0 && <small>{details.join(" · ")}</small>}</>;
}

export function CulturalCard({ candidate, selected, onSelect }: { candidate: ClubCandidate; selected: boolean; onSelect(): void }) {
  return <article className={`club-candidate ${selected ? "club-candidate-selected" : ""}`}>
    <div className="club-entity-line"><CulturalThumbnail entity={candidate.entity} /><div className="club-entity-copy"><EntitySummary entity={candidate.entity} /></div></div>
    <p className="quiet">{candidate.factSource === "illustrative" ? "Illustrative sample inventory" : candidate.factSource === "organizer" ? "Organizer-supplied resource facts" : "Qloo identifying metadata"}</p>
    {candidate.entity.kind === "artist" && !candidate.entity.metadata.musicVerified && <p className="quiet">Artist category; musician status needs confirmation.</p>}
    {candidate.entity.metadata.durationMinutes !== undefined && <p className="quiet">Provider runtime: {candidate.entity.metadata.durationMinutes} minutes</p>}
    {candidate.entity.metadata.priceLevel !== undefined && <p className="quiet">Provider price level: {candidate.entity.metadata.priceLevel}/4; this is not a quoted monetary price.</p>}
    <ul className="club-constraints">{candidate.assessments.map((item, index) => <li key={`${item.constraint}-${index}`}><span className={`club-assessment club-assessment-${item.status}`}>{item.status.replaceAll("_", " ")}</span> {item.detail} <small>({item.source})</small></li>)}</ul>
    <button type="button" className={`button ${selected ? "button-primary" : "button-secondary"}`} aria-pressed={selected} onClick={onSelect}>{selected ? "Selected" : `Choose ${candidate.entity.name}`}</button>
  </article>;
}
