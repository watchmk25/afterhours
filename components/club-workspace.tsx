"use client";

import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { ClubAgentResponse, ClubCandidate, ClubDiscovery, ClubDraft, ClubInput, ClubPlan, ClubResource, CulturalEntity, EntityReference } from "@/lib/club-types";
import { SAMPLE_CATALOGUE } from "@/lib/catalogue";
import { SAMPLE_QLOO_MAPPINGS } from "@/lib/qloo-sample";
import { CLUB_CSV_TEMPLATE, parseClubCsv } from "@/lib/club-import";
import { CulturalCard, EntitySummary, KIND_LABELS } from "./cultural-card";
import { InterestPicker, REVIEWED_INTERESTS } from "./interest-picker";
import { Icon } from "./icons";
import { createClubBookEventPlanFile, downloadEventPlan } from "@/lib/event-plan-export";

type Form = { club: string; goal: string; duration: string; groupSize: string; location: string; amount: string; currency: string; basis: "per_person" | "total_event"; maxPages: string; languages: string[]; format: ClubInput["format"] };
type EditableEvent = { title: string; format: string; notes: string; agenda: ClubDraft["agenda"]; materials: string; invitation: string };
type Selection = { reference: EntityReference | null; name: string; localId?: string; entityId?: string };
type ImportPreview = { resources: ClubResource[]; fileName: string };
const initialForm = (): Form => ({ club: "", goal: "", duration: "45", groupSize: "12", location: "", amount: "", currency: "INR", basis: "per_person", maxPages: "", languages: [], format: "auto" });
const sampleLanguages = [...new Set(SAMPLE_CATALOGUE.map((book) => book.language))].sort();

function blankManualEvent(duration: number, focus?: string): EditableEvent {
  const welcome = Math.min(5, Math.floor(duration / 4));
  const closing = welcome;
  const reflection = Math.max(1, Math.floor((duration - welcome - closing) / 3));
  return { title: focus ? `A gathering around ${focus}` : "Our next gathering", format: "Organizer-led conversation and creative responses; a fixed template, not a live recommendation.", notes: "", agenda: [
    { title: "Welcome", minutes: welcome, activity: "Invite each person to share what brought them to the gathering." },
    { title: "Explore together", minutes: duration - welcome - closing - reflection, activity: "Exchange observations in pairs, then bring questions to the group." },
    { title: "Creative reflection", minutes: reflection, activity: "Offer an optional written or spoken response." },
    { title: "Closing", minutes: closing, activity: "Share one takeaway and agree on a next step." },
  ], materials: "Paper\nPens", invitation: "Join us for a welcoming gathering with conversation and optional creative reflection. Confirm practical arrangements with the organizer." };
}

function resourceEligible(resource: ClubResource, form: Form): boolean {
  const facts = resource.facts;
  if (facts.stock !== undefined && facts.stock <= 0) return false;
  if (form.amount && facts.price !== undefined && facts.currency === form.currency && facts.priceBasis === form.basis && facts.price > Number(form.amount)) return false;
  if (resource.kind === "book" && form.maxPages && facts.pages !== undefined && facts.pages > Number(form.maxPages)) return false;
  if (resource.kind === "book" && form.languages.length && facts.language && !form.languages.includes(facts.language)) return false;
  return true;
}

export function ClubWorkspace() {
  const [form, setForm] = useState<Form>(initialForm);
  const [source, setSource] = useState<ClubInput["source"]>("discovery");
  const [resources, setResources] = useState<ClubResource[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [interests, setInterests] = useState<CulturalEntity[]>([]);
  const [pickerEpoch, setPickerEpoch] = useState(0);
  const [notes, setNotes] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [discovery, setDiscovery] = useState<ClubDiscovery | null>(null);
  const [proposal, setProposal] = useState<ClubPlan | null>(null);
  const [manualPreview, setManualPreview] = useState<EditableEvent | null>(null);
  const [draft, setDraft] = useState<EditableEvent | null>(null);
  const [dirty, setDirty] = useState(false);
  const [applied, setApplied] = useState<{ plan: ClubPlan; revision: number } | null>(null);
  const [revision, setRevision] = useState(0);
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState<"generate" | "discover" | "resolve" | null>(null);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [batch, setBatch] = useState<string[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, CulturalEntity[]>>({});
  const [resolvedEntities, setResolvedEntities] = useState<Record<string, CulturalEntity>>({});
  const controller = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const fileEpoch = useRef(0);
  const hasBookConstraints = form.format === "book" || (source === "sample" && form.format !== "manual");
  const activeResources: ClubResource[] = source === "sample" ? SAMPLE_CATALOGUE.map((book) => ({ localId: book.id, kind: "book", name: book.title, creator: book.author,
    facts: { price: book.priceInr, currency: "INR", priceBasis: "per_person", pages: book.pages, language: book.language, stock: book.stock },
    ...(Object.hasOwn(SAMPLE_QLOO_MAPPINGS, book.id) ? { reference: { sample: book.id } } : {}),
  })) : resources;
  const eligibleResources = activeResources.filter((resource) => resourceEligible(resource, form)).sort((a, b) => a.name.localeCompare(b.name));
  const availableLanguages = source === "sample" ? sampleLanguages : [...new Set(resources.flatMap((resource) => resource.facts.language ? [resource.facts.language] : []))].sort();
  const rawNumbers = [form.duration, form.groupSize, ...(form.amount ? [form.amount] : []), ...(hasBookConstraints && form.maxPages ? [form.maxPages] : [])];
  const numericInvalid = rawNumbers.some((value) => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0) ||
    !Number.isInteger(Number(form.duration)) || Number(form.duration) < 15 || Number(form.duration) > 180 ||
    !Number.isInteger(Number(form.groupSize)) || Number(form.groupSize) < 1 || Number(form.groupSize) > 500 ||
    (hasBookConstraints && form.maxPages !== "" && (!Number.isInteger(Number(form.maxPages)) || Number(form.maxPages) < 1));
  const ready = form.club.trim().length >= 3 && form.goal.trim().length >= 10 && !numericInvalid;
  const unresolvedSelection = selection && !selection.reference;

  function invalidate() {
    epoch.current += 1; controller.current?.abort(); controller.current = null;
    setBusy(null); setProposal(null); setManualPreview(null); setAcknowledged(false); setDiscovery(null); setFailure("");
    setRevision((current) => current + 1);
  }
  function change<K extends keyof Form>(key: K, value: Form[K]) {
    invalidate(); setForm((current) => ({ ...current, [key]: value }));
    if (key === "format" && value !== "book" && value !== "manual" && source === "sample") { setSource("discovery"); setSelection(null); }
    if (selection?.localId && activeResources.some((resource) => resource.localId === selection.localId && !resourceEligible(resource, { ...form, [key]: value }))) {
      setSelection(null); setNotice("The selected resource no longer meets the constraints. Existing event edits remain as a previous plan.");
    }
  }
  function updateInterests(value: CulturalEntity[]) { invalidate(); setInterests(value); }
  function chooseCandidate(candidate: ClubCandidate) {
    invalidate(); setDiscovery(discovery); setSelection({ reference: candidate.entity.reference, name: candidate.entity.name, entityId: candidate.entity.entityId, ...(candidate.localId ? { localId: candidate.localId } : {}) });
    setNotice(`Selected ${candidate.entity.name}. Any existing event edits are preserved until you apply another plan.`);
  }
  function chooseResource(resource: ClubResource) {
    if (source === "shortlist" && !batch.includes(resource.localId)) {
      if (batch.length >= 5) { setFailure("The matching batch already contains five rows. Free a batch slot before choosing this resource; your event edits are unchanged."); return; }
      setBatch((current) => [...current, resource.localId]);
    }
    const confirmed = resolvedEntities[resource.localId];
    invalidate(); setSelection({ reference: resource.reference ?? null, name: confirmed?.name ?? resource.name, localId: resource.localId, ...(confirmed ? { entityId: confirmed.entityId } : {}) });
    setNotice(resource.reference ? `${resource.name} selected. Planning will honor this focus.` : `${resource.name} is available for a local template. Confirm its Qloo identity before live planning.`);
  }
  function discardAllowed() { return !dirty || window.confirm("This action clears your edited event. Continue?"); }
  function reset() {
    if (!discardAllowed()) return;
    fileEpoch.current += 1; setPickerEpoch((current) => current + 1);
    invalidate(); setForm({ ...initialForm(), languages: source === "discovery" ? [] : availableLanguages, format: source === "sample" ? "book" : "auto" });
    setInterests([]); setNotes(""); setSelection(null); setDraft(null); setApplied(null); setDirty(false); setImportPreview(null); setBatch([]); setResolutions({}); setNotice("Inputs reset. Confirmed interests, selection and event cleared; your active catalogue is retained.");
  }
  function loadExample() {
    if (!discardAllowed()) return;
    fileEpoch.current += 1; setPickerEpoch((current) => current + 1); setImportPreview(null); setImportErrors([]); setResolvedEntities({});
    invalidate(); setSource("sample"); setResources([]); setFileName(null); setForm({ ...initialForm(), club: "A neighborhood reading circle", goal: "Plan a welcoming interactive conversation about a book for our club.", amount: "450", maxPages: "400", languages: sampleLanguages, format: "book" });
    setInterests(REVIEWED_INTERESTS.slice(0, 2)); setSelection(null); setDraft(null); setApplied(null); setDirty(false); setNotes(""); setBatch([]); setResolutions({});
    setNotice("Example A loaded with illustrative sample inventory. No provider request has been made.");
  }
  function useDiscovery() { invalidate(); setSource("discovery"); setSelection(null); setNotice("Discovery selected. Existing event edits are preserved. No provider request has been made."); }
  function restoreSamples() {
    if (!discardAllowed()) return;
    fileEpoch.current += 1; invalidate(); setSource("sample"); setResources([]); setFileName(null); setSelection(null); setDraft(null); setApplied(null); setDirty(false); setImportPreview(null); setImportErrors([]); setBatch([]); setResolutions({}); setResolvedEntities({});
    setForm((current) => { const kept = current.languages.filter((language) => sampleLanguages.includes(language)); return { ...current, format: "book", languages: kept.length ? kept : sampleLanguages }; });
    setNotice("Sample catalogue restored. Selection and event cleared; gathering inputs, audience interests and optional notes retained. Inventory values are illustrative.");
  }
  function input(mode: "generate" | "revise" = "generate"): ClubInput {
    const previousPlan: ClubDraft | undefined = applied ? { selectedEntityId: applied.plan.selectedEntityId, eventTitle: draft?.title ?? applied.plan.eventTitle,
      formatDescription: draft?.format ?? applied.plan.formatDescription, evidenceRefs: applied.plan.evidenceRefs, agenda: draft?.agenda ?? applied.plan.agenda,
      materials: draft?.materials.split("\n").filter(Boolean) ?? applied.plan.materials, invitation: draft?.invitation ?? applied.plan.invitation } : undefined;
    return { club: form.club.trim(), goal: form.goal.trim(), duration: Number(form.duration), groupSize: Number(form.groupSize), location: form.location.trim(),
      budget: form.amount === "" ? null : { amount: Number(form.amount), currency: form.currency, basis: form.basis }, maxPages: hasBookConstraints && form.maxPages ? Number(form.maxPages) : null,
      languages: hasBookConstraints ? form.languages : [], format: form.format, source, interests: interests.map((interest) => interest.reference),
      resources: source === "shortlist" ? resources.filter((resource) => batch.includes(resource.localId)).slice(0, 5) : [], selected: selection?.reference ?? null, mode,
      ...(mode === "revise" && previousPlan ? { previousPlan } : {}),
    };
  }
  async function run(operation: "generate" | "discover", mode: "generate" | "revise" = "generate") {
    if (busy || !ready) return;
    if (!interests.length) { setFailure("Confirm at least one audience interest before requesting Qloo discovery or a live proposal."); return; }
    if (unresolvedSelection) { setFailure("The chosen resource has no confirmed Qloo identity. Confirm it, clear the focus, or deliberately choose a manual template."); return; }
    const current = ++epoch.current;
    const cancellation = new AbortController(); controller.current = cancellation;
    setBusy(operation); setFailure(""); setNotice(""); setProposal(null); setManualPreview(null); setAcknowledged(false);
    try {
      const response = await fetch(`/api/club/${operation === "generate" ? "plan" : "discover"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input(mode)), signal: cancellation.signal });
      const result = await response.json();
      if (current !== epoch.current || cancellation.signal.aborted) return;
      if (!result.ok) { setFailure(`${result.error?.message ?? "This request could not be completed. No substitute plan was used."}${result.error?.retryAfterSeconds ? ` Try again in ${result.error.retryAfterSeconds} seconds.` : ""}`); return; }
      if (operation === "discover") { setDiscovery(result.discovery as ClubDiscovery); setNotice(result.discovery.candidates.length ? "Options returned by Qloo. Choose a focus or let the agent choose from a fresh current-run result." : "Qloo returned no usable options. Change inputs or deliberately choose a manual template."); }
      else {
        const body = result as Extract<ClubAgentResponse, { ok: true }>;
        if (body.result.status === "clarification") setNotice(body.result.question);
        else { setProposal(body.result.proposal); setDiscovery(body.result.proposal.discovery); setNotice("A validated proposal is ready to review. Your event has not been replaced."); }
      }
    } catch { if (current === epoch.current && !cancellation.signal.aborted) setFailure("The request could not be completed. Existing event edits are unchanged; no substitute proposal was used."); }
    finally { if (current === epoch.current) { setBusy(null); controller.current = null; } }
  }
  function cancel() { epoch.current += 1; controller.current?.abort(); controller.current = null; setBusy(null); setNotice("Request cancelled. Existing event edits are unchanged. A request already received by a provider may still count toward its allowance."); }
  function previewManual() {
    if (!ready) return;
    setProposal(null); setAcknowledged(false); setManualPreview(blankManualEvent(Number(form.duration), selection?.name)); setNotice("Fixed organizer-led template ready to review. No Qloo or Gemini request was made.");
  }
  function applyProposal() {
    if (!proposal || (proposal.conditional && !acknowledged)) return;
    setDraft({ title: proposal.eventTitle, format: proposal.formatDescription, notes: draft?.notes ?? "", agenda: proposal.agenda.map((item) => ({ ...item })), materials: proposal.materials.join("\n"), invitation: proposal.invitation });
    setApplied({ plan: proposal, revision }); setDirty(false); setProposal(null); setSelection({ reference: proposal.focus.entity.reference, name: proposal.focus.entity.name, entityId: proposal.focus.entity.entityId, ...(proposal.focus.localId ? { localId: proposal.focus.localId } : {}) });
    setNotice("Proposal explicitly applied. You can edit every event field below.");
  }
  function editDraft<K extends keyof EditableEvent>(key: K, value: EditableEvent[K]) { setDraft((current) => current ? { ...current, [key]: value } : current); setDirty(true); }
  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    const version = ++fileEpoch.current;
    setImportErrors([]); setImportPreview(null);
    if (!file) return;
    if (file.size > 256 * 1024) { setImportErrors(["File exceeds the 256 KiB limit."]); return; }
    try {
      const parsed = parseClubCsv(new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()));
      if (version !== fileEpoch.current) return;
      if (!parsed.ok) setImportErrors(parsed.errors.map((error) => `${error.row ? `Row ${error.row}: ` : ""}${error.column ? `${error.column}: ` : ""}${error.message}`));
      else setImportPreview({ resources: parsed.resources, fileName: file.name });
    } catch { if (version === fileEpoch.current) setImportErrors(["The file could not be read as UTF-8. Your current inventory and event are unchanged."]); }
  }
  function confirmImport() {
    if (!importPreview || !discardAllowed()) return;
    fileEpoch.current += 1;
    invalidate(); setResources(importPreview.resources); setFileName(importPreview.fileName); setSource("shortlist"); setSelection(null); setDraft(null); setApplied(null); setDirty(false); setBatch([]); setResolutions({}); setResolvedEntities({});
    const languages = [...new Set(importPreview.resources.flatMap((resource) => resource.facts.language ? [resource.facts.language] : []))].sort();
    const kinds = [...new Set(importPreview.resources.map((resource) => resource.kind))];
    setForm((current) => ({ ...current, format: kinds.length === 1 ? kinds[0] : "auto", languages })); setImportPreview(null);
    setNotice("Inventory replaced atomically. Selection and event cleared; confirmed audience interests retained. Nothing was sent to a provider.");
  }
  async function resolveBatch() {
    if (busy || !batch.length) return;
    const current = ++epoch.current; const cancellation = new AbortController(); controller.current = cancellation; setBusy("resolve"); setFailure("");
    try {
      for (const resource of resources.filter((row) => batch.includes(row.localId) && !row.reference).slice(0, 5)) {
        const response = await fetch("/api/club/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: `${resource.name} ${resource.creator ?? ""}`.trim().slice(0, 100), kind: resource.kind, ...(resource.externalId ? { externalId: resource.externalId } : {}) }), signal: cancellation.signal });
        const body = await response.json();
        if (current !== epoch.current || cancellation.signal.aborted) return;
        if (!body.ok) { setFailure(body.error?.message ?? "Matching stopped. No resource identity was automatically confirmed."); break; }
        setResolutions((rows) => ({ ...rows, [resource.localId]: body.candidates }));
      }
      if (current === epoch.current) setNotice("Review each returned identity and explicitly confirm a match. Uncertain or missing rows stay unresolved.");
    } catch { if (current === epoch.current && !cancellation.signal.aborted) setFailure("Resource matching stopped. Confirmed identities and event edits are unchanged."); }
    finally { if (current === epoch.current) { setBusy(null); controller.current = null; } }
  }
  function confirmResolution(localId: string, entity: CulturalEntity) {
    invalidate(); setResources((rows) => rows.map((resource) => resource.localId === localId ? { ...resource, reference: entity.reference } : resource));
    setResolvedEntities((rows) => ({ ...rows, [localId]: entity }));
    setSelection((current) => current?.localId === localId ? { ...current, reference: entity.reference, name: entity.name, entityId: entity.entityId } : current);
    setResolutions((rows) => { const next = { ...rows }; delete next[localId]; return next; }); setNotice(`${entity.name} identity confirmed. Organizer resource facts remain separate from Qloo metadata.`);
  }
  function clearResolution(localId: string) {
    invalidate();
    setResources((rows) => rows.map((resource) => { if (resource.localId !== localId) return resource; const next = { ...resource }; delete next.reference; return next; }));
    setResolvedEntities((rows) => { const next = { ...rows }; delete next[localId]; return next; });
    setResolutions((rows) => { const next = { ...rows }; delete next[localId]; return next; });
    setSelection((current) => current?.localId === localId ? { ...current, reference: null, entityId: undefined } : current);
    setNotice("Identity cleared. Match this selected row again and confirm a fresh result. Existing event edits are preserved.");
  }
  function changeBatch(localId: string, checked: boolean) {
    invalidate();
    setBatch((current) => checked ? [...current, localId] : current.filter((value) => value !== localId));
    if (!checked && selection?.localId === localId) {
      setSelection(null);
      setNotice("The chosen resource was removed from the matching batch. Existing event edits are preserved; choose a focus from the current batch when ready.");
    }
  }
  const totalMinutes = draft?.agenda.reduce((sum, entry) => sum + entry.minutes, 0) ?? 0;
  const preview = proposal ?? manualPreview;
  const selectedResource = activeResources.find((resource) => resource.localId === selection?.localId);
  const appliedBook = applied?.plan.focus.entity.kind === "book" && applied.plan.focus.entity.entityId === selection?.entityId
    ? applied.plan.focus.entity : null;
  const exportBook = selectedResource?.kind === "book"
    ? { title: selectedResource.name, author: selectedResource.creator, source: source === "sample" ? "sample" as const : "imported" as const }
    : appliedBook ? { title: appliedBook.name, author: appliedBook.metadata.creator, source: "provider" as const } : null;

  return <>
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <header className="site-header"><div className="header-inner"><a href="#workspace" className="brand"><span className="brand-symbol"><Icon name="book" /></span>AfterHours<span className="brand-period">.</span></a><nav className="workspace-nav" aria-label="Workspace sections"><a href="#gathering">Gathering</a><a href="#audience">Audience</a><a href="#event-outline">Your event</a></nav></div></header>
    <main id="workspace" className="workspace-shell club-shell">
      <div className="workspace-intro"><div><p className="eyebrow">CULTURE BRINGS US TOGETHER</p><h1>What will your club<br /><em>gather around?</em></h1><p className="intro-copy">Describe your group and its tastes. Discover a cultural focus, then shape a practical gathering.</p></div><div className="workspace-actions"><button className="button button-secondary" type="button" onClick={loadExample}>Try an example</button><button className="button button-secondary" type="button" onClick={reset}>Reset</button></div></div>
      <div className="club-layout">
        <div className="club-inputs">
          <section id="gathering" className="panel club-section"><p className="eyebrow">01 / YOUR GATHERING</p><h2>Start with your people</h2>
            <label className="field"><span className="field-label">Club/group description</span><input value={form.club} maxLength={300} placeholder="A student design society, a neighborhood club…" onChange={(event) => change("club", event.target.value)} /></label>
            <label className="field"><span className="field-label">Event goal</span><textarea aria-label="Event goal" rows={3} value={form.goal} maxLength={1000} placeholder="What would you like people to experience together?" onChange={(event) => change("goal", event.target.value)} /></label>
            <div className="club-two-fields"><label className="field"><span className="field-label">Duration (minutes)</span><input type="number" min="15" max="180" step="1" value={form.duration} onChange={(event) => change("duration", event.target.value)} /></label><label className="field"><span className="field-label">Group size</span><input type="number" min="1" max="500" step="1" value={form.groupSize} onChange={(event) => change("groupSize", event.target.value)} /></label></div>
            <label className="field"><span className="field-label">Location (optional)</span><input value={form.location} maxLength={200} placeholder="City or neighborhood for place discovery" onChange={(event) => change("location", event.target.value)} /></label>
            <label className="field"><span className="field-label">Primary cultural focus</span><select aria-label="Primary cultural focus" value={form.format} onChange={(event) => change("format", event.target.value as Form["format"])}><option value="auto">Choose from my goal</option><option value="book">Book</option><option value="artist">Music / artist</option><option value="movie">Movie</option><option value="place">Place</option><option value="manual">Organizer-led / manual</option></select></label>
            <p className="quiet">For mixed-format events, choose the focus to prioritize. These are event formats, not categories your club must fit.</p>
            <details className="club-details"><summary>Budget and relevant constraints (optional)</summary><div className="club-details-body">
              <label className="field"><span className="field-label">Budget (optional)</span><input type="number" min="0" step="0.01" value={form.amount} placeholder="No monetary limit specified" onChange={(event) => change("amount", event.target.value)} /></label>
              <div className="club-two-fields"><label className="field"><span className="field-label">Currency</span><select aria-label="Currency" value={form.currency} onChange={(event) => change("currency", event.target.value)}><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></label><label className="field"><span className="field-label">Budget basis</span><select aria-label="Budget basis" value={form.basis} onChange={(event) => change("basis", event.target.value as Form["basis"])}><option value="per_person">Per person</option><option value="total_event">Total event</option></select></label></div>
              {hasBookConstraints && <><label className="field"><span className="field-label">Maximum pages (optional)</span><input type="number" min="1" step="1" value={form.maxPages} onChange={(event) => change("maxPages", event.target.value)} /></label>{availableLanguages.length > 0 && <fieldset className="club-language-fields"><legend>Book languages</legend><p className="quiet">No languages selected means no language restriction.</p>{availableLanguages.map((language) => <label key={language}><input type="checkbox" checked={form.languages.includes(language)} onChange={(event) => change("languages", event.target.checked ? [...form.languages, language] : form.languages.filter((value) => value !== language))} /> {language}</label>)}</fieldset>}</>}
              <p className="quiet">Unknown costs, availability and rights require confirmation. A venue price level is not a monetary quote.</p>
            </div></details>
            {numericInvalid && <p role="alert" className="club-error">Use a duration of 15–180 whole minutes, a group of 1–500, a nonnegative budget and a positive whole page limit.</p>}
          </section>
          <section id="audience" className="panel club-section"><p className="eyebrow">02 / AUDIENCE TASTES</p><h2>Find a shared thread</h2><InterestPicker key={pickerEpoch} interests={interests} onChange={updateInterests} /><details className="club-details"><summary>Optional audience notes</summary><label className="field club-details-body"><span className="field-label">Audience notes (do not influence matching)</span><textarea aria-label="Audience notes (do not influence matching)" value={notes} rows={3} onChange={(event) => setNotes(event.target.value)} maxLength={2000} /></label></details></section>
        </div>
        <div className="club-main-column">
          <section id="cultural-options" className="panel club-section"><p className="eyebrow">03 / A CULTURAL FOCUS</p><h2>Discover or bring your own</h2><p className="quiet">Discovery finds options beyond the examples. A live proposal includes its own fresh Qloo discovery; you do not need to rank separately.</p>
            <div className="club-route-buttons"><button type="button" className={`button ${source === "discovery" ? "button-primary" : "button-secondary"}`} aria-pressed={source === "discovery"} onClick={useDiscovery}>Discover with Qloo</button><a className="button button-secondary" href="#own-list" onClick={() => { const details = document.getElementById("own-list"); if (details instanceof HTMLDetailsElement) details.open = true; }}>Use my own list</a></div>
            {source === "sample" && <div className="club-source-note"><strong>Illustrative sample inventory</strong><p>Prices, page counts, languages and stock are sample values, not current retailer facts. Five of ten books have reviewed Qloo identities.</p></div>}
            {source === "shortlist" && <div className="club-source-note"><strong>Imported inventory: {fileName}</strong><p>{resources.length} resources stored in this page session. Lost on reload; no saved catalogue.</p></div>}
            {selection && <div className="club-selection"><p><strong>Chosen focus:</strong> {selection.name}</p><button className="button button-secondary" type="button" onClick={() => { invalidate(); setSelection(null); }}>Clear chosen focus</button></div>}
            {source !== "discovery" && <div id="eligible-books"><h3>Eligible resources ({eligibleResources.length})</h3><p className="quiet">Known violations and out-of-stock rows are excluded. Missing facts still need confirmation.</p>{!eligibleResources.length && <p className="club-source-note">No resources meet the current known constraints. Widen the limits or restore examples.</p>}<div className="club-resource-grid">{eligibleResources.map((resource) => <article key={resource.localId} className="club-resource"><strong>{resource.name}</strong><span className="club-type">{KIND_LABELS[resource.kind]}</span>{resource.creator && <p>{resource.creator}</p>}{resolvedEntities[resource.localId] && <div className="club-confirmed-identity"><p className="quiet">Confirmed Qloo identity:</p><EntitySummary entity={resolvedEntities[resource.localId]} /></div>}<p className="quiet">{resource.facts.price !== undefined ? `${resource.facts.currency ?? "Unspecified currency"} ${resource.facts.price} · ` : ""}{resource.facts.pages !== undefined ? `${resource.facts.pages} pages · ` : ""}{resource.facts.language ?? ""}{resource.facts.stock !== undefined ? ` · Stock ${resource.facts.stock}` : ""}</p><p className="quiet">{resource.reference ? "Confirmed identity; eligible for assessment" : "Unresolved identity; not proof of absence in Qloo"}</p><button type="button" className="button button-secondary" aria-pressed={selection?.localId === resource.localId} onClick={() => chooseResource(resource)}>{selection?.localId === resource.localId ? "Selected" : `Choose ${resource.name}`}</button></article>)}</div></div>}
            <div className="club-discovery-actions"><button type="button" className="button button-secondary" disabled={!!busy || !ready || form.format === "manual"} onClick={() => void run("discover")}>Discover options</button><p className="quiet">One Qloo request per discovery action. Nothing is requested on page load.</p></div>
            {discovery && <div className="club-discovery"><h3>Current Qloo options</h3><p className="quiet">Assessed {discovery.coverage.assessed}{discovery.coverage.submitted !== null ? ` of ${discovery.coverage.submitted} submitted resources; ${discovery.coverage.resolved} resolved` : " discovered options"}. Scores are not probabilities.</p><div className="club-resource-grid">{discovery.candidates.map((candidate) => <CulturalCard key={candidate.entity.entityId} candidate={candidate} selected={selection?.entityId === candidate.entity.entityId} onSelect={() => chooseCandidate(candidate)} />)}</div></div>}
            <details id="own-list" className="club-details"><summary>Use my own list — optional CSV</summary><div className="club-details-body"><p className="quiet">Import a book CSV or a generic list of books, artists, movies and places. Maximum 256 KiB and 500 rows. Parsing stays in your browser. Only up to five selected resource rows and identifying metadata leave the browser when you explicitly match or plan.</p><div className="club-route-buttons"><a className="button button-secondary" href={`data:text/csv;charset=utf-8,${encodeURIComponent(CLUB_CSV_TEMPLATE)}`} download="afterhours-cultural-resources.csv">Download generic CSV template</a><a className="button button-secondary" href="/catalogue-template.csv" download>Download book CSV template</a></div><label className="field"><span className="field-label">Upload catalogue CSV</span><input type="file" accept=".csv,text/csv" onChange={(event) => void upload(event)} /></label>
              {importErrors.length > 0 && <div role="alert" className="club-error"><strong>Import not applied</strong><ul>{importErrors.map((error, index) => <li key={index}>{error}</li>)}</ul><p>Your inventory, selection and event are unchanged.</p></div>}
              {importPreview && <div className="club-source-note"><h3>Preview: {importPreview.resources.length} resources</h3><ul>{importPreview.resources.slice(0, 4).map((resource) => <li key={resource.localId}>{resource.name} — {resource.creator ?? resource.kind}</li>)}</ul><p>Replacing the catalogue clears the current selection and event outline. Audience interests are preserved. Edited events require confirmation.</p><div className="club-route-buttons"><button type="button" className="button button-primary" onClick={confirmImport}>Confirm import</button><button type="button" className="button button-secondary" onClick={() => { fileEpoch.current += 1; setImportPreview(null); setNotice("Import cancelled. Current inventory, selection and event preserved."); }}>Cancel import</button></div></div>}
              {source === "shortlist" && <div><h3>Resolve a selected batch</h3><p className="quiet">Select up to five rows. Matching sends at most one lookup per unresolved selected row. Results require your explicit identity confirmation; no first result is automatically chosen.</p><div className="club-resolution-rows">{resources.map((resource) => <div className="club-resolution-row" key={resource.localId}><label><input type="checkbox" checked={batch.includes(resource.localId)} disabled={!batch.includes(resource.localId) && batch.length >= 5} onChange={(event) => changeBatch(resource.localId, event.target.checked)} /> <strong>{resource.name}</strong> {resource.creator ? `— ${resource.creator}` : ""} <span className="club-type">{resource.kind}</span></label><p className="quiet">{resource.reference ? "Identity confirmed" : "Unresolved"}</p>{resource.reference && <button type="button" className="button button-secondary" onClick={() => clearResolution(resource.localId)}>Clear identity for {resource.name}</button>}{resolvedEntities[resource.localId] && <div className="club-confirmed-identity"><p>Confirmed Qloo identity:</p><EntitySummary entity={resolvedEntities[resource.localId]} /></div>}{resolutions[resource.localId] && <div><p>{resolutions[resource.localId].length ? "Which returned identity is intended?" : "No supported candidate returned. This row remains unresolved."}</p>{resolutions[resource.localId].map((entity) => <button type="button" className="club-resolution-choice" key={entity.entityId} onClick={() => confirmResolution(resource.localId, entity)}><EntitySummary entity={entity} /><span>Confirm this identity</span></button>)}</div>}</div>)}</div><p className="quiet">{resources.filter((resource) => batch.includes(resource.localId) && resource.reference).length} of {batch.length} selected rows resolved.</p><button className="button button-secondary" type="button" disabled={!batch.length || !!busy} onClick={() => void resolveBatch()}>Match selected rows</button></div>}
              {source !== "discovery" && <button type="button" className="button button-secondary" onClick={restoreSamples}>Restore sample catalogue</button>}
            </div></details>
          </section>
          <section id="event-planner" className="panel club-section"><p className="eyebrow">04 / PLAN THE GATHERING</p><h2>A practical plan, on your terms</h2><p className="quiet">A live proposal uses confirmed tastes and a fresh Qloo result. Creative activities are suggestions. Nothing replaces your event until you Apply.</p>
            <div className="club-route-buttons">{form.format === "manual" ? <button type="button" className="button button-primary" disabled={!ready || !!busy} onClick={previewManual}>Prepare manual template</button> : <><button type="button" className="button button-primary" disabled={!ready || !!busy} onClick={() => void run("generate")}>{busy === "generate" ? "Planning…" : "Generate event proposal"}</button>{applied && <button type="button" className="button button-secondary" disabled={!ready || !!busy} onClick={() => void run("generate", "revise")}>Revise event proposal</button>}</>}{busy && <button type="button" className="button button-secondary" onClick={cancel}>Cancel request</button>}</div>
            {!ready && <p className="quiet">Describe your club and a goal of at least ten characters, then check the duration and group size.</p>}
            {busy && <p role="status" className="club-live-status">{busy === "generate" ? "Waiting for a grounded proposal. Existing event edits are safe." : busy === "resolve" ? "Looking up selected resources. Identities still need confirmation." : "Waiting for Qloo options."}</p>}
            {notice && <p role="status" className="club-notice">{notice}</p>}{failure && <p role="alert" className="club-error">{failure}</p>}
            {preview && <div className="club-proposal" aria-label="Proposal preview"><h3>{proposal ? "Live proposal preview" : "Manual template preview"}</h3><h4>{proposal ? proposal.eventTitle : manualPreview?.title}</h4><p>{proposal ? proposal.formatDescription : manualPreview?.format}</p>{proposal && <><p><strong>Focus:</strong> {proposal.focus.entity.name} <span className="club-type">{proposal.focus.entity.kind}</span></p><p className="quiet">Qloo assessed {proposal.discovery.coverage.assessed}{proposal.discovery.coverage.submitted !== null ? ` of ${proposal.discovery.coverage.submitted} submitted options` : " discovered options"}.</p></>}
              <ol className="club-agenda-preview">{(proposal?.agenda ?? manualPreview?.agenda ?? []).map((entry, index) => <li key={index}><strong>{entry.title} · {entry.minutes} min</strong><p>{entry.activity}</p></li>)}</ol><p><strong>Agenda total: {(proposal?.agenda ?? manualPreview?.agenda ?? []).reduce((sum, entry) => sum + entry.minutes, 0)} minutes</strong></p>
              {proposal && <Evidence plan={proposal} />}
              {proposal?.conditional && <label className="club-acknowledgment"><input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} /> I understand this is conditional: I must confirm unknown costs, availability, rights and any listed requirements before the event.</label>}
              <button type="button" className="button button-primary" disabled={!!proposal?.conditional && !acknowledged} onClick={proposal ? applyProposal : () => { if (manualPreview) { setDraft(manualPreview); setManualPreview(null); setApplied(null); setDirty(false); setNotice("Manual template explicitly applied. No provider evidence is claimed."); } }}>Apply proposal</button>
            </div>}
          </section>
          <section id="event-outline" className="panel club-section"><p className="eyebrow">YOUR EDITABLE EVENT</p><h2>Make it yours</h2>{!draft ? <p className="quiet">Review and Apply a proposal, or deliberately choose the organizer-led/manual format for a local template.</p> : <>
            {exportBook && <button type="button" className="button button-secondary" onClick={() => downloadEventPlan(createClubBookEventPlanFile({
              book: exportBook,
              draft: { ...draft, agenda: draft.agenda.map((item) => `${item.title} — ${item.minutes} minutes\n${item.activity}`).join("\n\n") },
              applied: applied?.plan ?? null, previousInputs: !!applied && applied.revision !== revision,
            }))}>Download event plan</button>}
            {applied && <><p className="club-source-note">{applied.revision !== revision ? "Based on previous inputs. Your edits are preserved." : "Applied from the reviewed proposal and the inputs shown in its evidence."} {applied.revision !== revision && <a href="#event-planner">Generate a current proposal</a>}</p><Evidence plan={applied.plan} /></>}
            {!applied && <p className="quiet">Fixed manual template with organizer edits. No live recommendation or cultural explanation is claimed.</p>}
            <label className="field"><span className="field-label">Event title</span><input value={draft.title} maxLength={160} onChange={(event) => editDraft("title", event.target.value)} /></label><label className="field"><span className="field-label">Event format</span><textarea aria-label="Event format" rows={2} value={draft.format} onChange={(event) => editDraft("format", event.target.value)} /></label>
            <div className="club-edit-agenda"><h3>Agenda</h3>{draft.agenda.map((entry, index) => <div key={index} className="club-agenda-entry"><div className="club-two-fields"><label className="field"><span className="field-label">Activity {index + 1} title</span><input value={entry.title} onChange={(event) => editDraft("agenda", draft.agenda.map((item, at) => at === index ? { ...item, title: event.target.value } : item))} /></label><label className="field"><span className="field-label">Activity {index + 1} minutes</span><input type="number" min="1" value={entry.minutes} onChange={(event) => editDraft("agenda", draft.agenda.map((item, at) => at === index ? { ...item, minutes: Number(event.target.value) } : item))} /></label></div><label className="field"><span className="field-label">Activity {index + 1} instructions</span><textarea aria-label={`Activity ${index + 1} instructions`} rows={2} value={entry.activity} onChange={(event) => editDraft("agenda", draft.agenda.map((item, at) => at === index ? { ...item, activity: event.target.value } : item))} /></label></div>)}<p className="quiet">Edited agenda: {totalMinutes} minutes{applied && totalMinutes !== applied.plan.snapshot.duration ? ` (applied duration was ${applied.plan.snapshot.duration})` : ""}. Manual edits are organizer decisions.</p></div>
            <label className="field"><span className="field-label">Materials</span><textarea aria-label="Materials" rows={3} value={draft.materials} onChange={(event) => editDraft("materials", event.target.value)} /></label><label className="field"><span className="field-label">Invitation</span><textarea aria-label="Invitation" rows={3} value={draft.invitation} onChange={(event) => editDraft("invitation", event.target.value)} /></label><label className="field"><span className="field-label">Organizer notes</span><textarea aria-label="Organizer notes" rows={3} value={draft.notes} onChange={(event) => editDraft("notes", event.target.value)} /></label>
          </>}</section>
        </div>
      </div>
      <footer className="workspace-footer"><span className="footer-brand">AfterHours<span>.</span></span><p>Your workspace is session-only. Provider calls happen only through search, matching, discovery or generation actions; manual planning stays local.</p></footer>
    </main>
  </>;
}

function Evidence({ plan }: { plan: ClubPlan }) {
  return <details className="club-details club-evidence"><summary>Evidence, constraints and input context</summary><div className="club-details-body"><p><strong>Confirmed interests:</strong> {plan.discovery.interests.map((interest) => interest.name).join(" · ") || "None"}</p><p className="quiet">Qloo assessed {plan.discovery.coverage.assessed}{plan.discovery.coverage.submitted !== null ? ` of ${plan.discovery.coverage.submitted} submitted; ${plan.discovery.coverage.resolved} identities resolved` : " discovered options"}. Numerical evidence is not a probability or a narrative explanation.</p><ul>{plan.focus.evidence.map((item) => <li key={item.id}>{item.kind === "affinity" ? "Qloo affinity" : `Contribution: ${item.interestName ?? item.interestId}`}: {item.value}</li>)}</ul><ul className="club-constraints">{plan.focus.assessments.map((item, index) => <li key={index}><strong>{item.constraint}: {item.status.replaceAll("_", " ")}</strong> — {item.detail} ({item.source})</li>)}</ul>{plan.discovery.pool && <div><p><strong>Candidate pool snapshot:</strong></p><ul>{plan.discovery.pool.map((entry, index) => <li key={`${entry.localId ?? entry.entityId ?? "pool"}-${index}`}>{entry.name} · {entry.kind} · {entry.status}{entry.entityId ? ` · Qloo ID ${entry.entityId}` : ""}</li>)}</ul></div>}<p><strong>Planning snapshot:</strong> {plan.snapshot.club} · {plan.snapshot.goal}</p><p className="quiet">{plan.snapshot.duration} minutes · {plan.snapshot.groupSize} people · {plan.snapshot.format} focus · {plan.snapshot.source} source{plan.snapshot.location ? ` · ${plan.snapshot.location}` : ""}{plan.snapshot.budget ? ` · ${plan.snapshot.budget.currency} ${plan.snapshot.budget.amount} ${plan.snapshot.budget.basis.replaceAll("_", " ")}` : " · No monetary budget specified"}{plan.snapshot.maxPages ? ` · At most ${plan.snapshot.maxPages} pages` : ""}{plan.snapshot.languages.length ? ` · ${plan.snapshot.languages.join(", ")}` : ""}</p><p className="quiet">Activities and invitation text are generated suggestions, separate from provider facts and organizer-supplied resource facts.</p>{plan.warnings.length > 0 && <ul>{plan.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}</div></details>;
}
