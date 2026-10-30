# AfterHours — Devpost submission draft

Updated **30 October 2026**. **Not submitted.** Final Devpost review/submission remains the entrant's action.

**Current release distinction:** main contains the adaptive club planner at `771202c6ea2d95d9c796b0db72e7547d9e0c8b47`. Its 44/44 anonymous controlled hosted checks passed, but the one public live attempt timed out during the second Gemini request. Production was restored to accepted source `910ac80cf08bcfb4e288b418609e83cd841c506f`, which runs the earlier book workspace. Do not describe the current public site as the adaptive UI or treat the failed attempt as a successful proposal. [Release/rollback evidence](adaptive-public-release.md)

## Submission fields

| Field | Draft / verified state |
| --- | --- |
| Project name | AfterHours |
| One-line pitch | Turn a club's confirmed cultural tastes into a grounded book choice and an editable gathering plan. |
| Functional public demo | <https://afterhours-umber.vercel.app> — restored book workspace; anonymous HTTP 200 rechecked on 30 October. Its successful live proposal/Apply evidence is dated 25 October, not a fresh test. |
| Public source | <https://github.com/watchmk25/afterhours> — anonymous repository access and GitHub MIT detection rechecked on 30 October. |
| Public demo source | `910ac80cf08bcfb4e288b418609e83cd841c506f`; application code matches historically public-live-tested `06cf158ccd930abfc1f3924ec34649ebd7b15a6d`. [Browse the deployed snapshot](https://github.com/watchmk25/afterhours/tree/910ac80cf08bcfb4e288b418609e83cd841c506f). |
| Adaptive source on main | `771202c6ea2d95d9c796b0db72e7547d9e0c8b47`, after normal PR #4/#5 merges. Source is public, but this adaptive version is not the active public demo after rollback. No release tag is claimed. |
| License | Root MIT, copyright 2026 Mousam Kumar; dependencies and external providers retain their own terms. |
| Entrant/team | Solo entry previously confirmed by the entrant. Use the entrant's own Devpost profile; confirm its public name, profile URL and eligibility before submission. No additional member is invented. |
| Optional video | Not recorded/verified here; optional, not a substitute for a functional published demo. |
| Screenshots | Use actual current-demo screenshots, or clearly label protected/controlled adaptive screenshots. Do not imply a protected screenshot is today's public deployment. |

## Pitch and organizer problem

Book clubs and bookstores need more than a title: they need a book their group can obtain and finish, and an event that gives people a reason to attend. Organizers often know the films and musicians their audience enjoys before they know what everyone wants to read. AfterHours connects those confirmed interests to practical book constraints and an event outline the organizer can inspect and edit.

This is a prototype for that problem. We have not established bookstore adoption, attendance/revenue improvements, or recommendation quality through user research.

## What the published demo actually does

The restored public workspace lets an organizer load reviewed example interests or explicitly search for and confirm film/musician identities. Unconfirmed free-text notes do not silently influence Qloo. A ten-book sample catalogue supports stock, price, page and language filtering; these inventory values are illustrative, not current retail facts.

Five sample books have reviewed Qloo mappings. All eligible books remain browsable, while provider-supported assessment stays separately labelled. At INR 450 / 400 pages / all sample languages, the historical book scenario had six eligible books and three assessed books. Ambiguous identities are retained as unresolved, not guessed or treated as absent from Qloo.

An explicit event request starts a bounded Gemini native-tool run. Qloo ranks the current eligible reviewed book IDs from confirmed interests. Gemini then writes creative agenda, materials and invitation suggestions using that current evidence. The server validates eligible selection, numerical evidence references and the exact structured duration. A proposal previews separately; **Apply proposal** is explicit. Errors and cancellation preserve existing eligible edits. Applied context keeps the original interests, filters, coverage, numerical evidence and warnings, and becomes historical when inputs change.

Local CSV inventory import uses preview and atomic confirmation, with quoted-field/BOM/CRLF support, row/column errors, a 256 KiB size limit and 500-row limit. In this restored version, imported inventory supports local filters and fixed templates; live matching/planning is sample-only. Workspace data is session-only. Do not describe adaptive shortlist matching or Markdown export as features of this older public deployment.

## Adaptive implementation now in the public source

The merged adaptive source broadens the starting point to any described club/gathering. Organizers confirm up to five cultural interests, choose book/artist/movie/place as a primary focus, and discover outside the sample inventory or deliberately bring a shortlist. Reviewed examples require no API request. Three-character picker searches debounce for 475 ms, with Unicode/IME handling, bounded session reuse, cancellation and explicit identity confirmation.

Generation uses native `discover_cultural_focus`, fresh current-run Qloo candidates and numerical evidence, then a validated proposal. Optional discovery is a separate action and is unnecessary before Generate. Selected focus/shortlist membership, authoritative sample facts and user-confirmed imported identities are checked. Unknown costs, availability, edition facts, access and rights remain conditional rather than provider-verified. Conditional requirements need acknowledgment before Apply.

Generic CSV resources remain browser-local until explicit matching/planning sends only a bounded selected batch of up to five rows and necessary context. Ambiguous rows stay unassessed. No 500-row bulk lookup is triggered. Edited **book** plans can be downloaded as browser-generated UTF-8 Markdown, separating current edits from saved/historical evidence. Manually edited agenda timings are not claimed revalidated. Non-book export is not claimed.

This adaptive book scenario passed once on a **protected Preview**, including real current Qloo evidence, a 45-minute proposal, explicit Apply and export of a subsequent edit. It **did not complete** in the new anonymous public attempt. Artist/movie/place and shortlist flows have controlled coverage only; their live acceptance remains unverified. [Adaptive workflow and protected evidence](adaptive-club-planner.md)

## How Qloo and Gemini work together

Qloo supplies provider identities, affinity ordering and available numerical interest contributions from confirmed entities. Gemini writes creative event suggestions; it does not establish cultural facts, rights, inventory, artist attendance, bookings or prices. Numerical scores are **not probabilities** and are not converted into narrative cultural explanations.

The native flow is normally **Gemini → one Qloo Insights tool call → Gemini continuation**. The current application uses Next.js 16.4.2, React 19.3.0, TypeScript, Tailwind CSS, browser-local Papa Parse, built-in server fetch for Qloo and pinned `@google/genai` 2.30.0. Gemini uses `gemini-3.5-flash-lite`, minimal thinking and stateless Interactions continuation retaining required signatures/call IDs internally. The pinned Qloo harness remains a separate local diagnostic, not an application runtime dependency.

Server routes keep credentials private and fix Qloo's origin to `https://hackathon.api.qloo.com`. Native tool inputs cannot override authoritative constraints or choose a provider host. Output must refer to actual current-run evidence. No recorded response replaces a failed live run.

Shared Redis atomic operations enforce visitor allowances, global conservative daily reservations, two expiring event leases and 12 actual Gemini dispatch reservations per rolling minute. Each event allows at most **3 Gemini / 1 Qloo Insights**, within a **30-second run deadline**, **20 seconds per Gemini request** and **10 seconds for Qloo**, each bounded by remaining time. Store operations are bounded to one second. Missing configuration, failed store admission, cancellation and exhausted allowance reject dispatch. No automatic retries, queues, runtime model fallback or billing changes are added.

These controls do not enforce provider TPM, other applications' use of the same Google project, a financial cap, per-person identity, or sustained availability. Cancelling does not refund provider quota already consumed.

## Taste-effect evidence and honest limits

The saved comparison used the same four-book shortlist with Amélie + Norah Jones versus Interstellar + Hans Zimmer. Scores and numerical contributions changed, but ordering did not. That supports signal-dependent API output, not a claim of better recommendations or a different chosen book. Later detail evidence did not uniquely resolve competing IDs for Godaan, The Blue Umbrella or Pather Panchali; mappings were not forced. [Feasibility](qloo-feasibility.md), [coverage review](qloo-coverage-review.md)

Other limits include session-only drafts, partial catalogue identity coverage, unknown edition/retail/rights facts and external provider latency. A generic artist entity does not prove musician identity. A film discussion can concern a film watched beforehand; a short event cannot imply a full screening of a longer film or permission to screen it. No accounts, bookings, saved workspaces, retailer synchronization or song-level data are claimed.

## Public-demo walkthrough — restored book workspace

This matches the active `910ac80…` public version, **not** the adaptive source. No account is required. The steps describe the historical verified book scenario for judges; they are not another authorized automated acceptance allowance. Shared limits/provider capacity may reject work.

1. Open <https://afterhours-umber.vercel.app>. Confirm the illustrative sample-inventory labels.
2. Click **Load example** to show reviewed Example A interests without a provider call. Set maximum price **INR 450**, pages **400**, and all sample languages: English, Hindi and Bengali. Do not run a separate ranking probe.
3. Select **The Guide**, edit the event title and organizer notes, and retain those edits while reviewing a proposal.
4. In **Event request**, enter `Plan a 45-minute interactive event with paired discussion and reflection.` Keep **Event duration (minutes)** at **45**. Click **Generate proposal** once. Do not require a particular book.
5. If a valid proposal returns, inspect actual coverage, selected eligible book, numerical evidence and the exact 45-minute agenda. The original edits should still be intact until **Apply proposal**. Apply explicitly, then edit normally. Saved context should retain its original inputs and become historical after relevant input changes.
6. Optional local-only check: import a small non-private book CSV, preview/cancel once, then confirm. Verify filters and fixed templates; restore sample inventory separately. Imported live matching and event-plan download are not promised by this restored UI.

If the service is paused, busy, over allowance or fails, report the visible message and preserve the draft. No sample proposal or automatic retry is expected. Do not repeatedly generate until a preferred book appears. The active deployment was not given a new live check after restoration; its successful evidence remains dated 25 October.

### Adaptive book scenario — protected evidence only

At reviewed source `12c1235…`, Example A + unrestricted book discovery + 45 minutes returned eight current candidates and selected **What I Talk About When I Talk About Running** by Haruki Murakami. The exact agenda totaled 45 minutes; unknown price/stock/edition facts remained conditional. Existing edits survived preview; explicit Apply populated the plan, and a subsequent edit appeared in the Markdown download. It rendered in **13.209 seconds**, with **2 Gemini / 1 Qloo Insights**. This is one protected scenario, not the current public walkthrough, other-format acceptance or sustained performance.

## Verification ledger

| Evidence | Actual result and boundary |
| --- | --- |
| Final adaptive release Node suite, 30 October | **373/373 PASS** on `771202c…`; controlled transports, zero live provider/store calls. |
| Final anonymous controlled hosted suite, 30 October | **44/44 PASS in 98.007 s**, one worker, no retries/skips/flaky results; zero live Gemini/Qloo/Redis. Keyboard, 390px layout, cancellation, limits, revisions, Apply and download included. Initial 43/1 exposed an unpaused Playwright clock; test-only correction retained assertions/fixtures. |
| Lint / TypeScript / production build | Lint and TypeScript rerun and passed for the clock correction. Earlier passing application build reused transparently: no application source change since that check. Vercel release builds also reached Ready. |
| Protected adaptive native book acceptance | **PASS**, `12c1235…`, **2 Gemini / 1 Qloo**, valid render **13.209 s**, exact agenda, current evidence, preserved edits, explicit Apply and edited download. Other formats/shortlist live unverified. |
| New public adaptive attempt, 30 October | **FAIL**, `771202c…`: **2 Gemini / 1 Qloo**; first Gemini 2,463 ms and Qloo 111 ms completed, continuation reached 20,001 ms; app **504 GEMINI_DEADLINE**, response **23.064 s**. Edits preserved; no valid proposal, AI Apply or export acceptance. No retry. [Release outcome](adaptive-public-release.md) |
| Restored public book acceptance | **Historical PASS, 25 October**, application `06cf158…`, same app code as restored `910ac80…`: 56 controlled hosted checks; one real anonymous generation **2 Gemini / 1 Qloo**, The Namesake, 3/6 coverage, exact 45 minutes, preserved edits and Apply, rendered **3.652 s**. Not repeated after rollback. [Historical public record](public-release.md) |
| Store operation integration | Earlier isolated Redis-only **9-request PASS**, cleanup confirmed, zero Gemini/Qloo. Reused, not repeated here; account-console Free-plan/eviction status is not newly verified. [Usage controls](usage-controls.md) |
| Public source / license / restored access | Anonymous GitHub API 200, public repository and MIT detected. After restoration, public demo GET 200 showed older workspace; Production Preview diagnostic 404. GET alone is not live acceptance. |

## Final submission and release handoff

The official deadline is **31 October 2026, 09:15 IST** (30 October, 23:45 EDT). The internal 29 October target has passed. The overview requires a functional externally published demo, public runnable source, an open-source license and project description; a video is optional. Materials must be in English or include an English translation. A protected-only adaptive Preview is not substituted for the functional public-demo requirement. Confirm eligibility/rights against the [official overview](https://qloo.devpost.com/) and [rules](https://qloo.devpost.com/rules).

1. **Resolve the version distinction in the submitted entry.** The public demo is the accepted earlier book workspace, while main contains adaptive code. If submitting the restored version, use its pinned source URL and the accurate public walkthrough above; do not claim the adaptive UI/export is live there. An adaptive public release still needs a separately authorized successful acceptance after the continuation-latency issue is investigated. The one attempt in this task is spent; this document authorizes no new request.
2. **Preserve the restored demo while reviewing documentation.** The Production project flag is false for future deployments. The active immutable rollback retains its original environment snapshot and its historical enabled behavior was not re-probed. A main push can replace it with paused adaptive code, so the documentation follow-up is on its own branch/PR and should not be merged without coordinating deployment. Keep local/Preview paused and Preview protected.
3. Confirm the entrant's public Devpost profile, eligibility and rights. Solo-entry status was confirmed; no other member, profile, adoption metric or testimonial is supplied. Add an optional video only if actually recorded, with credentials hidden and version/fixture labels accurate.
4. Review the source/license/setup links and current provider/store allowances; confirm account-console settings where necessary. Existing shared controls are not a guarantee of capacity or spending limits. No credential rotation/history rewrite was justified by this release review.
5. Review and submit the entry before the deadline, then retain the receipt and keep the demo available for judging. **No Devpost submission or eligibility certification has been performed by this task.**
