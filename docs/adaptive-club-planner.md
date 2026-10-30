# Adaptive cultural club planner

This feature branch changes the starting product from a sample-book inventory to one gathering workflow: describe a group and goal, confirm representative cultural interests, discover or bring a cultural focus, then review and explicitly Apply an editable plan. Club identity is free text. Books, artists, movies and places are supported recommendation formats, not the only groups that can use AfterHours.

Production is unchanged by this work. This phase uses **zero live Gemini, Qloo or Redis requests**. Controlled responses establish local request construction, validation and browser behavior; they do not establish new live upstream compatibility, recommendation quality, provider capacity or hosted performance.

## Implemented contract

- Fresh workspaces have no inventory requirement and do not render the ten sample books. **Try an example** deliberately loads the existing reviewed Example A interests, book constraints and illustrative inventory without a provider call.
- Gathering inputs include group description, event goal, duration, group size, optional location and an optional monetary budget with currency and a per-person or total-event basis. Edition page and language constraints appear for book formats.
- The visual interest picker searches supported cultural entities without a mandatory category selector. Three-character queries are debounced by 475 ms; only one search remains active. It supports Unicode/IME composition, cancellation, stale-result rejection, arrows/Enter/Escape, explicit confirmation, duplicate prevention and five confirmed chips. Reviewed starters are examples, not popularity claims. Identical recent queries are reused for 20 minutes in a bounded page-session cache.
- Optional discovery returns browsable candidates beyond the bundled books. A user can also generate directly; a separate ranking action is unnecessary. Choosing a candidate restricts subsequent discovery/ranking to that entity or produces an explicit conflict/unassessed error. It never silently substitutes another focus.
- Automatic goal routing chooses one supported focus only when the goal indicates one. Mixed, unclear or unsupported goals receive a concise clarification, or the organizer can deliberately select the manual route. The manual template is local and labelled; it is never substituted for a failed live result.
- Generic CSV import and the existing book CSV format remain browser-local, previewed and all-or-nothing. The limits remain 256 KiB and 500 data rows. Quoted commas/newlines, escaped quotes, UTF-8 BOM and Windows line endings are supported. Types, required/duplicate headers, explicit cost units/currency and numerical bounds are validated. Local resource IDs remain separate from provider identities.
- A matching action sends only a selected batch of at most five resource rows. Each unresolved row consumes at most one sequential lookup. Supplied supported external IDs use entity lookup; other rows search with identifying metadata. Every returned identity requires explicit confirmation, including single results. Unresolved rows remain visible and excluded from provider assessment. Duplicate names with different creators/types are not collapsed into one local resource.
- **Use my own list** opens the optional import controls. Malformed UTF-8 is rejected before parsing without replacing existing inventory or edits. A confirmed imported identity can be cleared and rematched in place after expiry; no reimport or draft loss is needed. Removing a chosen row from the matching batch clears that selection while retaining the edited event. If two eligible rows resolve to the same Qloo identity, the server asks for one row before Insights, rather than arbitrarily binding one row's facts to both.

## Provider and agent boundaries

`club-qloo.ts` validates a small cultural-entity contract, type-specific metadata and signed references. Existing reviewed preset/sample references are resolved from authoritative bundled data. Search-issued references expire after 30 minutes. Client-edited IDs, names or metadata are not provider evidence.

The assigned origin remains `https://hackathon.api.qloo.com`; there is no fallback host. A mixed search omits the optional `types` parameter and requests eight results, then exposes only implemented types. Discovery sends one `GET /v2/insights` with the actual `urn:entity:book`, `urn:entity:artist`, `urn:entity:movie` or `urn:entity:place`, confirmed interest IDs, bounded results and requested explainability. Shortlist ranking uses `filter.results.entities`. Place discovery can use the supplied locality query. An external-ID resolution uses `GET /entities` once. These operations do not fan out across categories or paginate.

The generalized native tool is `discover_cultural_focus`, with empty arguments. Normal planning remains **Gemini → one fresh Qloo Insights call → Gemini continuation**. The existing Gemini transport, configured `gemini-3.5-flash-lite`, minimal thinking, native call IDs, signature-bearing stateless continuation and response diagnostics are retained. There are no automatic retries or recorded-result fallbacks.

Confirmed chips become `signal.interests.entities`; optional audience notes are not sent. Club/goal, duration and group size inform the model; automatic goal routing chooses one Insights type. Sample eligibility and reviewed mappings are derived on the server. An imported batch is reduced to eligible, confirmed identities of the chosen type. Discovery has no sample shortlist restriction; unknown edition facts and costs remain conditional. A place location is an upstream locality filter, while currency budgets are assessed locally without converting price levels or currencies. Empty book-language selection explicitly means no language restriction.

Qloo's returned candidate order and actual evidence are included in the native function result consumed by Gemini. Validation requires a selected current-run candidate, its numerical evidence references, relevant constraints and the exact agenda total. The agent is not forced to select the highest affinity or change books between audiences. Applying a proposal makes its focus the chosen focus; a revision honors that choice while eligible, and obtains fresh Qloo evidence. Clear the chosen focus to let a later run choose again. Audience/constraint edits invalidate pending previews even when changed back; they do not replace an applied edited plan.

| Action | Maximum new provider calls |
| --- | --- |
| Page load, examples, edits, filters, Apply, Reset, import/preview, Markdown download | 0 |
| Debounced uncached interest query (3+ characters; 475 ms) | 1 Qloo search |
| Match selected rows | Up to 5 sequential Qloo lookups, one per unresolved selected row; stop on failure |
| Discover options | 1 Qloo Insights request |
| Generate or Revise | Up to 3 Gemini requests and 1 fresh Qloo Insights request; normal path 2 + 1 |

Cancellation propagates and prevents late application, but cannot refund a request already accepted upstream. Partial coverage remains explicit in the proposal and saved context. A Qloo error, absent evidence, pacing rejection or model failure leaves edits intact; no sample or previous result is substituted. Local manual planning is a deliberate separate choice within the same workspace.

Per run, the maximum remains three Gemini requests and one Qloo Insights request, including the single permitted validation repair. The overall work deadline is 30 seconds; a Gemini request receives at most 20 seconds and the remaining budget, and Qloo receives at most ten seconds and the remaining budget. Cancellation propagates through all operations; late completions cannot advance the run or apply content. Existing shared admission, daily conservative reservations, visitor allowances, expiring event leases, per-request rolling Gemini pacing and fail-closed Redis behavior protect the new routes as well as the retained legacy endpoints.

Validation checks current-run entity membership and type, the organizer's explicit selection, actual numerical evidence references, bounded fields/response sizes, constraint assessments and an exact agenda total. Historical proposals are revision context, not evidence. A legitimate native function-call response needs no final proposal text. Native signatures are retained internally and not exposed as public evidence.

## Facts and conditional feasibility

Provider metadata, organizer-supplied facts and illustrative sample inventory have separate provenance. Unknown costs, stock, access, rights, capacity and bookings are not presented as satisfied hard constraints. Numerical venue price level is not converted into money. An unknown condition requires an explicit acknowledgment before Apply; that acknowledgment is not proof that feasibility has been verified.

Qloo's broad artist category alone does not establish musician identity. Music activities can be conditional on an explicit music-identity confirmation when the organizer's goal is musical; the generated plan cannot promote that uncertainty to a provider-verified musician claim. Artist attendance, performance fees, song-level selections/links/durations and rights are not supplied by this integration. Movie discussions may concern a film watched beforehand; full screenings must have a known runtime fitting the actual agenda and do not establish screening permission.

Free prose is additionally checked for recognizable unsupported cultural, numerical, availability and rights claims. These checks and concise model instructions cannot prove every possible sentence factual; provider facts remain separately displayed, and creative activity/invitation text is explicitly labelled as suggestions requiring organizer review.

## Edits, privacy and images

Generation previews before Apply. Failures, cancellation and limits preserve the existing draft. Every relevant input change invalidates an unapplied proposal, including changing back to an earlier value. Applied plans remain editable and retain their actual input/evidence snapshot with a historical-context notice after later changes. Import, reset, examples and catalogue restoration request confirmation before discarding a dirty event. Import cancellation or invalid files preserve inventory, selection and edits. Reset retains the active inventory; sample restoration is separate.

CSV parsing and manual planning stay in the browser. On an explicit matching/planning action, only the bounded chosen batch and necessary gathering/interest fields are sent to the server/providers. No member records, PDFs or images are interpreted as resolved cultural entities. The workspace is session-only. Provider strings and imported text are data, not tool instructions.

Optional thumbnails use only validated public Qloo image hosts, bounded credential-free image fetches with redirects rejected, and local blob display. Missing, CORS-blocked, broken, oversized or unsupported images use a fallback. There is no arbitrary image proxy or authenticated image URL in browser code. A narrow image CSP and no-referrer policy supplement URL validation.

## Verification and limits

Completion verification on **30 October 2026**:

- Relevant Node checks first: **57/57** before fixes, **59/59** after the new duplicate-identity and audience/constraint-to-native-tool checks. The later full Node suite passed **370/370**.
- Initial full Chromium run: **29 passed / 10 failed**. Two assertions counted native select options along with picker results; eight matched Next.js's empty route-announcer alert as well as the product error. Locators now target the named result listbox or planner error. Expected counts, error text, duplicate limits, evidence and edit-preservation assertions were retained; fixtures were not substituted to obtain a pass.
- Fixed actual workflow gaps: reopening reviewed suggestions when the search field is already focused, in-place expired-identity recovery, clearing a chosen batch row without losing edits, rejecting duplicate confirmed identities before dispatch, exposing the optional import directly and rejecting malformed UTF-8.
- Final lint, `tsc --noEmit --incremental false`, production build and `git diff --check`: **PASS**. A test-only SDK union narrowing error was corrected before the passing build.
- Complete final Chromium suite on the local production build: **44/44 PASS in 45.472 seconds**, one worker, zero retries/skips/flaky results. This includes all four formats, an unrestricted club description, Unicode/IME/debounce/cache, ambiguity/duplicates, absent/broken images, partial shortlist coverage, recovery, audience and practical-limit revision through explicit Apply and download, cancellation, late responses, pause/pacing/quota errors, keyboard focus/operation and 390px layout. The previously passing export checks were retained and passed within this complete run.
- **Live requests: 0 Gemini / 0 Qloo / 0 Redis.** Provider and store transports are controlled; no diagnostic, smoke probe or real-store check was run. No dependency, model, provider contract, mapping, budget or deployment setting was changed. Nothing was staged, committed, pushed or deployed in the completion task.

Ignored artifacts: `artifacts/playwright/adaptive-node-focused.log`, `adaptive-node-final.log`, `adaptive-browser-initial-results.json`, `adaptive-browser-final-results.json`, `adaptive-browser-final.log`; HTML report `playwright-report/index.html`; screenshots `artifacts/playwright/adaptive-club-mobile-390.png`, `event-plan-download-mobile-390.png` and `event-plan-download-desktop.png`. Historical release results remain dated and separate.

The code review found the pending diff belongs to the adaptive workspace, its tests/docs, image restrictions, reusable CSV quoting check and completed book-plan export. Credentials, local configuration, generated reports, provider diagnostics, existing Gemini transport, shared usage controls and reviewed mappings remain outside the checkpoint diff. The branch is ready for a **scoped local checkpoint commit**; it is intentionally left uncommitted for review.

New provider response variations, actual mixed-search result coverage, place locality interpretation, image CORS behavior and newly supported discovery formats remain **live UNVERIFIED in this phase**. No public deployment or existing successful live acceptance is reclassified as testing this feature.

The application policy remains **12 searches per visitor per hour**, six standalone discoveries/rankings and six event admissions, with unchanged shared daily reservations and Gemini pacing. Debounce, reviewed starters, session reuse and a five-row batch prevent uncontrolled fan-out, but there is a genuine capacity tradeoff: a five-row unresolved import can consume five of the twelve search admissions. Repeated exploratory typing can exhaust that allowance. The UI reports exhaustion rather than raising the limit, queueing work or falling back to unguarded requests. The pacing policy does not enforce provider token-per-minute limits or control other applications using the same provider account.

The previous smoke/feasibility diagnostics and legacy sample-domain modules remain isolated from the new application runtime. Existing public release records describe the earlier book-focused deployment, not this feature branch.

## Remaining acceptance and judging risks

Priorities follow the event's [published judging criteria](https://qloo.devpost.com/) and externally published functional-demo requirement; these are readiness judgments, not claims of recommendation quality.

1. **Technological Implementation / functional demo:** this expanded contract has not been live-verified or deployed. Public Production still demonstrates the older accepted book workspace. Controlled tests cannot establish current mixed-search/Insights response variations, Gemini compatibility, account access, hosted timing or shared-store availability for this new source. A separate authorized protected Preview acceptance is the next gate before release review.
2. **Potential Impact / Quality of the Idea:** no new evidence establishes organizer adoption or recommendation quality. Earlier A/B evidence changed scores without changing ordering. The current offline tests establish signal/candidate/evidence plumbing; they do not demonstrate better recommendations or guarantee a changed selection.
3. **Design / practical feasibility:** sample data remains illustrative, reviewed sample mappings are five of ten, and imported identities require organizer confirmation. Unknown costs, availability, rights and musician identity remain conditional. Automatic routing uses conservative English goal cues and asks for a primary focus when unclear; prose validation cannot prove every generated sentence factual. Workspace content is session-only; Markdown export currently covers book plans.
4. **Demo capacity:** twelve searches per visitor/hour can be exhausted through exploration or a five-row resolution batch. Existing shared quotas, provider TPM and image CORS/availability remain operational limits rather than evidence of sustained reliability.

**Smallest live acceptance still needed — proposed only, not executed:** on a separately authorized protected Preview of the reviewed checkpoint, with the existing secure configuration and genuine hosted visitor identity, load the reviewed Example A interests (zero searches), use the local sample/manual template to create and edit a draft, then choose Qloo discovery and book focus without carrying a chosen candidate into discovery. Request one 45-minute gathering with the INR 450 / 400-page constraints. Make exactly one Generate attempt, with **at most 3 Gemini requests and 1 Qloo Insights request**, no search/probe/retry/revision/replacement. Check actual discovery beyond the sample restriction, current evidence and type/membership validation, an exact 45-minute agenda, honest conditional edition/cost requirements, edits preserved until explicit Apply, and download of the final edited plan. Stop on failure and retain sanitized usage/timings; restore the Preview pause afterward with no extra provider calls. A successful single run would not verify all four formats or sustained reliability.

## Official references

- [Qloo search](https://github.com/qloo/docs-public/blob/main/reference/get-search.md)
- [Qloo entity lookup](https://github.com/qloo/docs-public/blob/main/reference/get-entities.md)
- [Parameters by entity type](https://github.com/qloo/docs-public/blob/main/reference/available-parameters-by-entity-type.md)
- [Basic Insights](https://github.com/qloo/docs-public/blob/main/reference/basic-insights-use-case.md)
- [Insights parameter reference](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md)
- [Hackathon access guidance](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md)
