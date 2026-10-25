# AfterHours — Devpost submission draft

Updated on **25 October 2026** for the explicitly authorized public release.
PR #3 is already merged at
`e9b5505de388efdd24a333822fc55c845e49af02`; its tree matches accepted checkpoint
`c553f28`. The repository is public and GitHub detects MIT on main. The initial
anonymous Production suite identified a CSS scrolling blocker in two keyboard
journeys. Application source `06cf158ccd930abfc1f3924ec34649ebd7b15a6d` removes only
global smooth scrolling and has now passed all 56 anonymous hosted browser
checks on the actual deployed correction with controlled providers. One real anonymous UI generation then
passed with **2 Gemini requests / 1 Qloo ranking**, a valid proposal rendered in
**3.652 seconds**, preserved edits and successful explicit Apply. Production is
enabled for judges; local and protected Preview live switches remain false. See the
[current public-release record](public-release.md).
The protected Preview remains protected and paused. Final Devpost submission
is the organizer's action; this is a draft, not a submitted entry.

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
| Public demo URL | <https://afterhours-umber.vercel.app> — anonymous access, all 56 controlled hosted browser checks and one real anonymous proposal/Apply journey **PASS** on source `06cf158…`. Production is enabled for judges, subject to shared limits. |
| Public source URL | <https://github.com/watchmk25/afterhours> — anonymous repository API access verified, `private: false`, GitHub license detection **MIT**; raw main LICENSE returned HTTP 200. |
| Submitted source commit / release tag | Verified application source: `06cf158ccd930abfc1f3924ec34649ebd7b15a6d` (minimal keyboard/anchor-scrolling correction after merged `e9b5505…`). Anonymous controlled and live verification passed. No release tag is claimed; record later documentation-only checkpoints separately. |
| Team / entrant and roles | **Solo entry — confirmed by the entrant.** Role: project creator. Use the entrant's own Devpost profile as the only team member. |
| Optional video URL | **TODO if recorded; not required.** |
| Screenshots | Select current readable desktop and 390px captures; label controlled fixtures and historical live results accurately. |

The public Production site served merged source `e9b5505…`, replacing the
historical `574ca8c` deployment. Its first controlled browser suite passed 54
checks and failed two keyboard checks because focused planner controls remained
outside the viewport. A CSS-only override replayed those same two journeys and
assertions unchanged and passed both. Main commit `06cf158…` removes only
`scroll-behavior: smooth` from `html`, preserving scroll padding, design, provider
logic, mappings and dependencies. The full hosted rerun on the actual deployed
fix then passed all **56 original journeys in 119,848 ms (2.0 minutes)**, with no
CSS override, changed assertions, skipped/flaky/unexpected results, or live
provider calls. Production deployment `dpl_3PJSrNDF9fzR2aRDcsCRXMXAuD6s` was
Ready from that source during the paused check. A fresh enabled Production
deployment, `dpl_7Si49UQpNXgy5Uii1wMNionQjoVC`, then passed the one authorized
anonymous UI generation at the same source, with an empty initial cookie store,
HTTP 200 for the initial page and generation response, and actual totals of
**2 Gemini requests / 1 Qloo ranking**. There were no probes, retries, revisions
or replacement attempts. Production remains enabled for judges after success.
The latest verified protected, paused Preview is
`https://afterhours-25xbnm1pa-sam-3b2d.vercel.app`, application source
`8892db227839b0cc7f35e0846bca75cdc7058973`. The same source passed 56 controlled
hosted browser checks and one real proposal/Apply journey before pause was
restored. That protected result remains historical evidence, separate from the
completed anonymous Production journey. See the
[protected hosted acceptance record](hosted-acceptance.md).

The actual public proposal, **AfterHours Interactive Reading Experience**,
selected **The Namesake — Jhumpa Lahiri**, with illustrative price INR 450,
304 pages, English and 15 copies. It assessed **3 of 6 eligible books**, all
three with reviewed mappings. Agenda: Welcome 5, Paired Discussion 25,
Reflection 10, Closing 5 — **exactly 45 minutes**. Existing Guide title and notes
remained unchanged until explicit Apply, which changed selection and populated
the proposal fields. The mobile document and body were both 390px wide with no
horizontal overflow. A valid proposal rendered in **3,652 ms**; the response
arrived in **3,617 ms**. These are one observed journey's timings, not a
reliability or performance guarantee.

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
or complete abuse prevention. Hosted admission and both per-request pacing
operations passed during one real protected run using Vercel's actual visitor
identity path. This verifies that run through the Node test transport, not
per-person identity, cross-instance load behavior or sustained public reliability.

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

## Judge walkthrough

Use the public demo in a fresh browser context; no account is required. The
core walkthrough uses one generation, normally two Gemini requests and one Qloo
ranking, with an enforced maximum of three Gemini requests and one ranking per
run. Shared allowances can reject work. Do not run a separate **Rank with Qloo**
action first. The automated public-release verification has already used its
single authorized generation; this judge walkthrough is not an additional
agent-driven test allowance.

1. Open <https://afterhours-umber.vercel.app> in a fresh browser context. Confirm the
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
documented as historical evidence below. The public acceptance used one
generation without a revision. Additional agent-driven live verification is
outside this completed task's allowance.

## Evidence ledger for the final description

| Claim | Evidence and precise boundary |
| --- | --- |
| Current application regressions | After the CSS correction: lint, explicit TypeScript, **289 Node tests in 11.042 s**, and production build **PASS**, with provider keys disabled and zero live calls. All **56 anonymous hosted Chromium journeys passed in 119,848 ms (2.0 minutes)** on actual deployed source `06cf158…`, with no override or assertion changes. [Public release](public-release.md) |
| Shared admission, leases and pacing against the configured store | Recorded PASS: one isolated **nine-request Redis-only** check; all HTTP 200, cleanup acknowledged and confirmed, **zero Gemini/Qloo requests**. It did not verify management-console plan/eviction settings or hosted identity. No repeat in this task. [Usage controls](usage-controls.md) |
| Real native agent proposals and explicit Apply | Historical local INR 450→300 journey passed with fresh ranking per turn; valid renders took **26.928 s / 14.558 s**. This predates current shared controls. [Event-agent record](event-agent.md) |
| Real hosted proposal | Historical protected deployment generated and explicitly applied The Namesake in **4.246 s**, using **two Gemini requests / one Qloo ranking**, with 3/6 eligible books assessed. This is one earlier turn, not current pacing acceptance or a latency guarantee. [Hosted record](hosted-preview.md) |
| Later audience/context UI on a protected host | Historical **51 controlled Chromium tests** passed against source `7e88b81…`; zero live provider calls. [Audience/context record](audience-event-journey.md) |
| Current shared-control/pacing hosted release | **PASS for bounded protected acceptance** at source `8892db2`: actual initial/final paused responses, **56 controlled hosted Chromium checks**, and one real generation with **2 Gemini requests / 1 Qloo ranking**. The Namesake proposal assessed **3/6** eligible books, totaled **45 minutes**, rendered in **5.028 s**, preserved edits until explicit Apply, and applied successfully. A fresh protected Preview was verified paused afterward; temporary enabled-deployment cleanup confirmation is recorded separately. This is not an anonymous release or latency guarantee. [Current acceptance](hosted-acceptance.md) |
| Taste-effect and coverage evidence | Same ranking, changed scores/contributions; no quality claim. One later detail batch left mappings unresolved and coverage unchanged. [Feasibility](qloo-feasibility.md), [coverage review](qloo-coverage-review.md) |
| Public source and main license | **PASS on 25 October:** anonymous GitHub repository API HTTP 200, repository public and MIT detected; raw main LICENSE HTTP 200, copyright 2026 Mousam Kumar. The MIT license covers original project code, with third-party/provider terms retained. [Public release](public-release.md) |
| Public hosted keyboard correction | Initial anonymous suite: **54 PASS / 2 FAIL**; focused planner controls remained off viewport for the 10-second visibility expectation. The same two journeys/assertions passed **2/2 in 22.135 s** with only a controlled CSS auto-scroll override. Source fix `06cf158…` removes that global property; the subsequent real-deployment run passed all **56** journeys without an override. No assertions or provider safeguards were weakened. [Public release](public-release.md) |
| Anonymous Production live agent | **PASS** at corrected source `06cf158…`: fresh anonymous context, initial GET and generation POST HTTP 200, one real generation using **2 Gemini / 1 Qloo**, The Namesake, **3/6** coverage, **45-minute** agenda, preserved Guide edits and explicit Apply. Valid render **3.652 s**, response **3.617 s**; mobile width 390px without overflow. Production stays enabled for judges. [Public release](public-release.md) |
| Actual public Qloo evidence | The selected book's validated affinity was `0.7179884704476631`; input contributions were `0.6219156325588995` for Amélie and `0.3780843674411006` for Norah Jones. These are provider numerical values, not probabilities or invented cultural explanations. They do not establish recommendation quality. [Public release](public-release.md) |
| Public run stage timings | Admission **58 ms**, pacing **15 / 5 ms**, Gemini **706 / 1,893 ms**, Qloo **58 ms**, validation **4 ms**. Loading feedback was observed at **66 ms** from the browser action. These timings cover one successful bounded journey, not sustained operation. [Public release](public-release.md) |
| Final submission | Final Devpost submission remains the user's action. Team/entrant details and optional-video fields remain explicit; no submission receipt or eligibility certification is claimed. |

## Final submission and operator steps

- Retain the protected acceptance and Redis verification; do not repeat the
  isolated store diagnostic. The corrected source passed the full anonymous
  controlled suite while paused, followed by one successful public generation
  using **2 Gemini / 1 Qloo**. Leave Production enabled for judges as authorized.
  Keep local and Preview switches false and Preview protection enabled. The
  single automated public-generation allowance is spent.
- Confirm the account-owned store's Free plan and disabled eviction in its
  management console, and review current provider quotas, retention and
  monitoring. Shared reservations do not establish a spending cap.
- Public source visibility and Production publication are already explicitly
  authorized, PR #3 is merged, and MIT detection on main has passed. Retain
  third-party licenses and provider terms; the project MIT license does not
  replace them. No further general release approval is required.
- Retain the completed source/history review and applicable asset/provider terms.
  No confirmed credential leak requiring rotation or history rewriting was
  identified. The MIT license covers original project code and does not replace
  third-party terms.
- Retain the verified public URLs and application source SHA above. Complete the
  unknown team names, roles and Devpost profiles, then review the English entry.
  Anonymous functionality has passed one bounded journey; do not describe it as
  sustained public reliability or repeat the live test under this spent allowance.
- If an optional video is recorded, show the real current UI, confirmed inputs,
  coverage, run result and explicit Apply. Label edits or older evidence; hide
  credentials and private participant data. It cannot replace a working demo.
- Complete the draft and final submission by **29 October IST** internally,
  before the published **31 October 09:15 IST** deadline. Keep evidence of final
  submission; this document does not establish Devpost registration/submission
  or certify eligibility.

The 22 October writing and protected-verification history is recorded separately.
The 25 October public-release task has published the source, confirmed anonymous
Production page access, and applied a verified minimal CSS correction following
two hosted keyboard failures. The full hosted rerun passed 56/56 on the actual
deployed fix, followed by one successful anonymous live proposal and explicit
Apply using **2 Gemini requests / 1 Qloo ranking** in **3.652 seconds** to render.
Production is enabled for judges; local and protected Preview live switches
remain false. Final Devpost submission has not been performed.
