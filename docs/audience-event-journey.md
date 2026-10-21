# Audience setup and applied-event context

Prepared on `feat/event-agent` from
`140d114e2ef7265b99d0ae28a14cfbc2f4756515`. Inventory values, provider mappings,
model/SDK configuration, prompts, native tool execution, proposal validation,
deadlines, no-retry policy, and production remain unchanged.

## Organizer behavior

- **Load example** confirms the existing verified Example A (Amélie 2001 +
  Norah Jones) visibly, with existing INR 450 / 300-page / English example
  filters. For imported catalogues, existing language fallback remains intact;
  live providers still require the sample catalogue. Loading an example makes
  zero search, ranking, or generation calls and clears prior selection,
  outline, applied context, ranking, and planner state.
- Confirmed interests are the primary audience input and appear before the
  search/preset controls on desktop and mobile. Free-text favourites remain
  editable under the initially collapsed **Optional audience notes**. They
  influence neither matching nor planning and do not stale applied evidence.
- Reset clears interests, notes, selection, applied context, and planner state,
  restoring existing default filters while retaining the active catalogue.
  CSV cancellation preserves the current state. Confirmed import and restoring
  samples clear the selected book/outline/applied context, retain confirmed
  interests and optional notes, and preserve the existing filter contract.

## Applied context and edits

Explicit Apply now retains the validated proposal's actual confirmed interests,
assessed/supported/eligible coverage, numerical evidence and reference IDs,
warnings, planned duration, and an independent snapshot of the filter strings
and selected languages. The compact **Applied event context** beside the
editable outline exposes filters/evidence in a native expandable disclosure.
It does not infer ranking positions, probabilities, or cultural narratives.

Audience/filter changes mark it **Based on previous inputs** while preserving
all six editable fields if the selected book remains eligible. A monotonic
context revision keeps that notice after changing A→B→A; reverting controls
does not revive old evidence as current. The saved audience and filters remain
those actually used by the applied proposal, rather than the new controls.
**Generate a current proposal** is a keyboard-accessible link back to the planner,
with no request or replacement on navigation. Only an explicit new Generate /
Revise can request a replacement, and only Apply replaces the edited draft.

An ineligible selection clears its outline and applied evidence permanently.
Switching books starts the existing fixed template. Applying again, including
the same book, intentionally replaces the editable fields as before. Manual
agenda edits are not automatically revalidated; the recorded planned duration
describes the validated proposal, not the current edited text.

## Cancellation and duration correction

The Next.js Qloo route now passes `request.signal` to both service operations.
Search accepts the same optional abort signal as ranking. A pre-aborted
operation makes zero upstream calls; in-flight fetch/body cancellation aborts
the transport and resolves as a sanitized cancellation rather than accepting a
late response. Timeout and caller cancellation remain separate, with no retry.
This cannot retract dispatched work or establish provider quota refunds.
Standalone Qloo request-body read deadlines remain separate public hardening
work; the event-agent body-read deadline is unchanged.

The duration parser previously compared every time quantity with the structured
total except for a fixed list of activity names. It now recognizes explicit
whole-event duration attachments/predicates and total/overall wording, allowing
arbitrarily named activity allocations. At structured 45 minutes, **“Plan a
45-minute event with 10 minutes for discussion.”** passes. An explicit
60-minute event, “the event lasts 60 minutes,” or “60 minutes for the whole
event” still requires clarification. Structured duration is never rewritten,
and positive integer agenda minutes must still total it exactly. This is
conservative phrase recognition, not complete natural-language understanding.

## Verification — no live providers

Passed after the application changes:

- `npm run lint`.
- `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- `npm test`: **226 Node tests**, including six new search/rank abort cases
  (before dispatch, in-flight fetch, and response-body reading), timeout/late
  response checks, and duration allocation/explicit-total regressions.
- `npm run build`: successful Next.js production build.
- **51 Chromium regressions** against the local production server on port
  3101, one worker, zero retries, all provider actions intercepted by controlled
  fixtures. The server additionally had provider credentials disabled and
  provider egress blocked. No unrelated process was stopped or lock deleted.

The browser suite verifies the visible confirmed example with no automatic
requests, optional-note keyboard disclosure/edit preservation, actual supplied
applied evidence/coverage/warnings/filter snapshot, all six outline edits across
audience/filter A→B→A, stale-context keyboard navigation, cancellation/import/
selection/reset contracts, and 390px overflow/control readability. Mobile
screenshots with expanded applied evidence were visually inspected.

The first sandboxed Node run blocked two existing synthetic child-process tests
with Windows `EPERM`. The suite then passed 226/226 with child-process access;
assertions and test isolation were unchanged. All fetchers remained controlled.

Local evidence is ignored: `artifacts/playwright/audience-local-browser-results.json`,
`audience-local-applied-filters-390.png`, and
`audience-local-applied-audience-390.png`. Playwright HTML/JSON reports and
screenshots are generated under the usual ignored report directories.

**Task live totals: zero Gemini requests and zero Qloo requests.** Fixture
values are test data, never claimed as new live observations. Earlier live
acceptance and latency evidence remains historical.

## Protected Preview

The existing personal Hobby project/protection and Production settings were
inspected before upload. The pinned CLI dry-run contains 83 source files and
zero forbidden environment/generated paths. Use the existing deployment-only
server runtime credential workflow with bare variable names; values never
enter command arguments, build variables, source uploads, or browser code.

Deployment and hosted controlled-suite results will be recorded after the
reviewed application commit is deployed. Verification uses the same-project
short-lived OIDC identity solely inside the exact-origin Node transport, never
browser headers/storage/config/traces/URLs. The shared fixture blocks unmocked
provider routes. This task's helper has no live-generation operation.

Remaining limitations: session-only edits/context, sample-only live support,
partial catalogue mappings, conservative duration/prose validation, and no
shared authentication/quotas/spending/concurrency controls across serverless
instances. Protection must remain enabled. This controlled verification does
not establish new live provider availability, latency, or sustained reliability.
