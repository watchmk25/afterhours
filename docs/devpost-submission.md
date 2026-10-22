# AfterHours — Devpost submission draft

Prepared on **22 October 2026** from `feat/event-agent`, source checkpoint
`d0739cbf40150d1ebf1051b09cf99eddf193b055`. This is a local writing and
release-readiness draft, not a submitted entry or evidence of a new deployment.
Keep the repository **private**, PR #3 **draft**, and the Preview **protected**
until the organizer separately authorizes release.

## Deadline and submission requirements

The published deadline is **30 October 2026, 11:45 p.m. EDT**, equivalent to
**31 October 2026, 09:15 IST**. The internal completion target is **29 October
2026, IST**, leaving a buffer for final checks and submission. Materials must
be in English, or include an English translation. Confirm entrant eligibility
and third-party rights before submitting. [Official rules](https://qloo.devpost.com/rules)

The current overview requires an externally published functional demo, a public
source repository with runnable instructions, an open-source license visible on
the repository page, and a project description. It explicitly excludes demos
that depend only on local or private access. A video is optional. The judging
categories concern implementation, product design, credible impact, and the
idea. [Hackathon overview](https://qloo.devpost.com/)

The rules also describe private-site testing credentials, while the overview
states a stricter public-demo requirement. Do not assume protected Preview
access satisfies submission eligibility. Resolve access before final submission,
or seek organizer clarification if retaining private access is necessary. Keep
the demo available for judging. [Official rules](https://qloo.devpost.com/rules)

## Submission fields to complete

| Field | Draft / current status |
| --- | --- |
| Project name | AfterHours |
| One-line pitch | Turn confirmed film and music tastes into a constrained book shortlist and an editable event proposal. |
| Public demo URL | **TODO — a released, anonymously tested URL for the frozen agent build.** |
| Public source URL | **TODO — an authorized public source snapshot.** Current repository `https://github.com/watchmk25/afterhours` remains private; root MIT `LICENSE` is prepared on the feature branch, with default-branch detection and publication still pending. |
| Submitted source commit / release tag | **TODO — fill after the final authorized release; do not substitute the historical production commit.** |
| Team / entrant and roles | **TODO — organizer-confirmed names, roles, and Devpost profiles.** |
| Optional video URL | **TODO if recorded; not required.** |
| Screenshots | Select current readable desktop and 390px captures; label controlled fixtures and historical live results accurately. |

The existing public production site, `https://afterhours-umber.vercel.app`, runs
historical source `574ca8cc0070caefd99ee52743cad3b2bbe45ba4`; it is not the
current agent release. The latest recorded protected Preview is
`https://afterhours-6p14f62rq-sam-3b2d.vercel.app`, historical application source
`7e88b81174371ab66dcd989340e5ee34026f6b35`. It does not establish hosted
acceptance of the newer usage controls or Gemini pacing. Neither URL should
silently fill the public-agent-demo placeholder.

## Project description draft

### The problem

A bookstore or book club chooses more than a title: it needs a book the group
can obtain, afford, and finish, followed by a gathering worth attending.
Audience interests often arrive as films and musicians rather than a precise
reading list. AfterHours brings those confirmed interests, practical inventory
constraints, and event planning into one organizer workspace.

This is a prototype for that audience. We have not established bookstore
adoption, measured attendance improvements, revenue impact, or recommendation
quality through user research.

### What AfterHours does

Organizers confirm cultural interests using two clearly labelled example pairs
or an explicit film/musician search with a separate confirmation step. Optional
free-text audience notes remain notes; they do not silently become resolved
Qloo signals.

A bundled ten-book catalogue supports stock, maximum price in INR, page-count,
and language filters. Those catalogue values are illustrative. Eligible books
stay browsable even when provider identity is unresolved. On explicit action,
Qloo orders the eligible, reviewed sample-book IDs and returns available
numerical affinity and input-contribution values. Coverage remains visible.

An organizer can then request an event proposal, with a structured duration
from 15 to 180 minutes. Gemini uses its native ranking function to obtain fresh
Qloo evidence under the current constraints. The server validates the selected
book, evidence references, and exact agenda total. The separate preview shows
an agenda, materials, invitation, and proposed event fields. Generate and
Revise preserve an eligible edited outline; only **Apply proposal** replaces
it. The applied context retains the inputs and evidence actually used and marks
itself as based on previous inputs when the audience or constraints change.

Organizers can also preview and explicitly import a local CSV inventory. Quoted
fields, BOMs, Windows line endings, and row/column validation are supported
under 256 KiB and 500-row limits. Invalid files and cancellation preserve the
workspace. Imported inventory supports local filtering and fixed event
templates; live Qloo matching and Gemini planning currently support only the
bundled sample catalogue. Imported files and workspace edits are session-only.

### What makes Qloo necessary

Qloo supplies cross-domain ranking evidence for confirmed film and musician
entities against an explicit, server-derived shortlist of book entities. The
LLM does not invent Qloo IDs, inventory availability, affinity scores, or
cultural explanations. A generated proposal cannot pass without current-run
ranked-book evidence. Removing Qloo removes that grounded live proposal path;
the local filters and fixed templates remain useful on their own.

The saved controlled comparison used Amélie + Norah Jones and Interstellar +
Hans Zimmer against the same four-book shortlist. Scores and numerical
contributions differed, but the book order did not. That demonstrates a working
signal-dependent API response, not different recommendations or proven reader
satisfaction. A later detail lookup did not resolve the competing IDs for
Godaan, The Blue Umbrella, or Pather Panchali, so their mappings were not forced.

Five of ten sample books have reviewed mappings. Defaults yield **four of seven
eligible books supported**; INR 450 / 400 pages / all sample languages yields
**three of six**. Actual assessment also depends on which supported IDs Qloo
returns. Unresolved means insufficient unique-ID evidence, not absence from
Qloo. Scores and contributions are not probabilities or literary fact checks.

### How it works

The workspace uses Next.js 16.4.2, React 19.3.0, TypeScript, and Tailwind CSS.
Papa Parse handles browser-local CSV parsing. Server routes keep credentials
private and use a fixed Qloo origin, `https://hackathon.api.qloo.com`, with
bounded search and Insights operations. The pinned Qloo harness is a separate
local diagnostic tool and is not imported into the application runtime.

The server uses `@google/genai` 2.30.0 and the configured
`gemini-3.5-flash-lite` model with minimal thinking. It sends native Interactions
requests with stateless continuation, retaining required call IDs and signature
steps internally. Only `rank_eligible_books` is enabled; the model cannot change
inventory constraints or supply a provider host. Normally a run uses two Gemini
requests and one fresh Qloo ranking, with a maximum of three Gemini requests
and one ranking. A 30-second run deadline bounds each Gemini request to at most
20 seconds and each Qloo request to at most 10 seconds, also limited by the
remaining run budget. There are no automatic retries or recorded-result
fallbacks. Cancellation and stale-response protection prevent late content
from replacing the current draft.

The current branch adds shared Redis admission reservations, two expiring event
leases, and a rolling 12-request / 60-second Gemini pacing gate across instances
using the same store and namespace. Store failure rejects live work. An
operator switch defaults off. These controls are conservative application
reservations, not billing measurements, a monetary cap, verified user identity,
or complete abuse prevention. Trusted hosted identity and current hosted live
acceptance still require verification.

### Challenges and what we learned

Provider identity resolution matters as much as API connectivity. Multiple
book records can share a title, author, year, or even an ISBN while retaining
different provider IDs. We kept ambiguous books browsable instead of inflating
coverage. Native function calling also required handling the actual Interactions
response contract and preserving continuation data rather than reconstructing
an incomplete tool conversation.

Separating proposal generation from explicit Apply made errors, cancellation,
revisions, and changing constraints safer for organizers. Provider availability,
latency, and quotas remain external constraints; successful individual turns do
not establish reliable public service.

## Judge walkthrough draft — execute only after release gates pass

These are instructions for the eventual verified release, not an invitation to
bypass the protected Preview or enable live actions now. The core walkthrough
uses one generation, normally two Gemini requests and one Qloo ranking, with a
maximum of three Gemini requests and one ranking. Do not run a separate **Rank
with Qloo** action first. The current protected acceptance budget allows only
this one generation: no probes, retries, revisions, or replacement attempts.

1. Open **TODO: final public demo URL** in a fresh browser context. Confirm the
   sample-inventory label and any live-service pause notice.
2. Click **Load example**. It visibly confirms Example A, without a provider
   request. For the demonstrated planning scenario, set maximum price to
   **INR 450**, maximum pages to **400**, and select English, Hindi, and Bengali.
   Six books are eligible; three have reviewed mappings.
3. Select **The Guide** and edit the event title and organizer notes. These are
   the draft to preserve while previewing.
4. In **Event request**, enter `Plan a 45-minute interactive event with paired discussion and reflection.`
   Keep **Event duration (minutes)** at **45**. Click **Generate proposal** once.
   Review the actual run activity, current coverage, book and numerical evidence,
   and agenda blocks totalling exactly 45 minutes. The edited outline should
   still be intact. Do not require a particular selected book.
5. Review the valid proposal, then click **Apply proposal** explicitly. Verify
   the outline and **Applied event context** reflect that proposal. Edit fields
   normally afterward. Changing confirmed interests should mark the saved
   context as previous inputs while keeping edits if the book stays eligible.
6. Optionally try a small non-private CSV using the downloadable template.
   Preview, cancel once, then confirm replacement. Verify local filters and
   templates still work, and live support is clearly sample-only. Use
   **Restore sample catalogue** to return. Reloading loses session data.

On an error, exhausted allowance, or paused service, stop and report the visible
message; no substitute proposal is expected. A provider failure must preserve
an eligible existing draft. Do not repeatedly click or promise that waiting
will guarantee quota or capacity.

Revision is an implemented feature and the older INR 450-to-300 journey is
documented as historical evidence below. It is not part of this task's remaining
live allowance. Any additional live evaluation needs a separately authorized
request budget after release.

## Evidence ledger for the final description

| Claim | Evidence and precise boundary |
| --- | --- |
| Current application regressions | Recorded PASS: lint, TypeScript, production build, **289 Node tests** and **56 local Chromium tests** with controlled provider fixtures. These are reused results, not rerun for this writing draft. [Pacing record](gemini-pacing.md) |
| Shared admission, leases and pacing against the configured store | Recorded PASS: one isolated **nine-request Redis-only** check; all HTTP 200, cleanup acknowledged and confirmed, **zero Gemini/Qloo requests**. It did not verify management-console plan/eviction settings or hosted identity. No repeat in this task. [Usage controls](usage-controls.md) |
| Real native agent proposals and explicit Apply | Historical local INR 450→300 journey passed with fresh ranking per turn; valid renders took **26.928 s / 14.558 s**. This predates current shared controls. [Event-agent record](event-agent.md) |
| Real hosted proposal | Historical protected deployment generated and explicitly applied The Namesake in **4.246 s**, using **two Gemini requests / one Qloo ranking**, with 3/6 eligible books assessed. This is one earlier turn, not current pacing acceptance or a latency guarantee. [Hosted record](hosted-preview.md) |
| Later audience/context UI on a protected host | Historical **51 controlled Chromium tests** passed against source `7e88b81…`; zero live provider calls. [Audience/context record](audience-event-journey.md) |
| Current shared-control/pacing hosted release | **UNVERIFIED.** Deployment transport failed; no current hosted controlled suite, real generation, or hosted operator-pause verification has completed. [Current blocker](gemini-pacing.md), [dashboard handoff](git-preview-deployment.md) |
| Taste-effect and coverage evidence | Same ranking, changed scores/contributions; no quality claim. One later detail batch left mappings unresolved and coverage unchanged. [Feasibility](qloo-feasibility.md), [coverage review](qloo-coverage-review.md) |
| Anonymous access to the current agent / public source / final submission | **UNVERIFIED / not released.** Repository remains private and Preview protected. This document does not publish or submit them. |

## Final submission gates

- Complete the existing protected dashboard deployment handoff, then verify the
  current source, controlled hosted regressions, one authorized bounded live
  journey, actual timings, explicit Apply, and the hosted pause switch. Do not
  infer these from historical results or repeat the successful Redis diagnostic.
- Confirm the account-owned store's Free plan and disabled eviction in its
  management console, and review current provider quotas, retention and
  monitoring. Shared reservations do not establish a spending cap.
- Obtain separate organizer authorization for the final release, public source
  visibility and demo access changes. Keep present settings unchanged in the
  meantime. A root MIT `LICENSE` is prepared on this feature branch; retain the
  intended license in the reviewed release and verify GitHub detects it before claiming a public
  licensed submission.
- Inspect the exact public source snapshot/history and asset rights for secrets,
  environment files, private catalogues, generated captures, and incompatible
  third-party licensing. Publish only the reviewed authorized material, with
  reproducible setup and no credentials.
- Fill the actual source commit, public repository and working demo URLs, team
  details, and English project text. Test the final links as a judge without
  pre-existing login cookies; confirm the demonstrated features are actually
  accessible and repeatable within the controlled allowance.
- If an optional video is recorded, show the real current UI, confirmed inputs,
  coverage, run result and explicit Apply. Label edits or older evidence; hide
  credentials and private participant data. It cannot replace a working demo.
- Complete the draft and final submission by **29 October IST** internally,
  before the published **31 October 09:15 IST** deadline. Keep evidence of final
  submission; this document does not establish Devpost registration/submission
  or certify eligibility.

No live provider calls, Redis operations, deployments, visibility changes, or
Devpost submission were performed to prepare these materials. Normal backup of
the feature branch is recorded separately in the release handoff.
