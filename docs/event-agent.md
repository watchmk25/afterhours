# Bounded Gemini event planner verification

Implemented locally on `feat/event-agent` from
`f3c742b04a2617ed54dc884492d51a7f175694b3`. Main, Vercel configuration,
the public deployment, and the Qloo diagnostic/feasibility scripts are unchanged.

## Implemented behavior

An organizer confirms audience interests, sets sample-inventory filters, enters
an activity request and a 15–180 minute duration, and explicitly generates a
separate proposal. Generate, failures, clarification, and unapplied revisions
preserve a still-eligible selected book and its edited outline. Only Apply
proposal replaces selection and the editable draft, including when the proposed
book is unchanged. Applied materials and invitation remain editable.

A revision sends the historical proposal as non-authoritative context and starts
a fresh run with current constraints. Input changes mark previews stale, including
changing back to old values; old responses cannot revive Apply. Reset/Load clear
planner state. CSV preview cancellation preserves it; replacement/restoration
invalidates it under the existing catalogue contracts. Imported inventory keeps
local filtering/templates but cannot use sample matching/planning.

## Provider and limits

The official `@google/genai` SDK is pinned to **2.30.0**. The server explicitly
passes `GEMINI_API_KEY`, never the environment's `GOOGLE_API_KEY`; Vertex and
enterprise routing are disabled. `GEMINI_MODEL` defaults to `gemini-3.8-flash`.
The fixed native endpoint is POST
`https://generativelanguage.googleapis.com/v1beta/interactions`, low thinking,
`store:false`, no background operation or streaming, and no SDK/network retries.
No billing or hosted credentials are configured.

The single native function is `rank_eligible_books`, with no accepted arguments.
It directly reuses the existing Qloo service, confirmed references, reviewed
sample mappings, and server-computed eligibility. The model cannot supply a host,
candidate list, inventory values, or relaxed filters. Qloo remains fixed to
`https://hackathon.api.qloo.com/v2/insights`.

Per run: **at most three Gemini requests including one repair, and one Qloo
ranking request**. A successful proposal requires a current tool result. Native
call IDs and all opaque thought/signature steps are preserved internally for
stateless continuation; hidden reasoning is not exposed in the UI or reports.

Request/proposal input is capped at 16 KiB; event text is 10–1000 characters.
Gemini transport is capped at 128 KiB request/256 KiB response and 4096 output
tokens, with a 20-second whole-response deadline. Qloo retains its 1 MiB body and
ten-second deadline. A run has a 60-second overall deadline; reading the HTTP
input has a five-second deadline. Cancellation propagates to active transports
and prevents further steps, but cannot retract a dispatched request.

The selected ID must belong to the actual current eligible ranked set. Book
metadata is joined from the server catalogue. Evidence IDs and values must match
the selected book's real tool output. Agenda minutes are positive integers and
must total the requested duration exactly. Unknown fields/tools, repeated calls,
unconfirmed entities, and relaxed constraints are rejected. Missing credentials
and invalid preflight inputs send zero provider requests.

One supported book is enough for the planner; Qloo documents `take >= 1`.
The manual matching panel retains its two-book minimum. At default page/language
limits, a price cap of INR 450 gives six eligible books/three mappings; INR 300
gives three eligible books/one mapping (The Guide). Unsupported books remain
browsable and are not declared absent from Qloo.

Model instructions and conservative prose checks forbid URLs, quotations,
obvious plot/author claims, numerical inventory claims, and attendance guarantees.
They are not a complete semantic fact-checker. Activities and invitation wording
are labelled as Gemini proposals requiring review, separate from Qloo scores.

## Automated verification

- Lint, TypeScript checking, and the Next.js production build passed.
- **177 Node tests passed**: existing suites plus 18 event-loop, 16 event-domain,
  and 15 actual-SDK transport fixture tests. Native function-result IDs/signatures,
  explicit key precedence, one-fetch SDK behavior, no retries, fresh INR 450→300
  eligibility, invalid book/evidence/agenda repair, budget limits, missing
  credentials, sanitized failures, cancellation, and deadlines are covered.
- **46 Chromium tests passed** with one worker, zero retries, and a local **production** preview.
  The original 27 workspace/import/matching journeys retain their assertions;
  only banner copy reflects the new optional planner. Planner journeys use
  intercepted controlled API fixtures, never live model/Qloo calls.
  Nineteen planner journeys include desktop/390px captures, real keyboard actions,
  current-constraint revision, explicit same/different-book Apply, stale responses,
  cancellation, errors/clarification, and CSV/Reset preservation contracts.
- Direct local HTTP checks verified rejection of wrong Origin/content type,
  invalid JSON, oversized bodies, imported inventory, unconfirmed/tampered
  interests, and clarification of a conflicting price. Each reported zero
  Gemini and zero Qloo requests.

Port 3000 was occupied by an older AfterHours preview. Its cached HTML/new build
assets caused the initial CSV interactions to fail; that run was stopped. No
existing process was killed and no lock was deleted. The isolated production
preview at **http://localhost:3100** passed the browser suite.

Run production verification with port 3100 free:

```powershell
npm run lint
npm test
npx --no-install tsc --noEmit
npm run build
# Separate terminal:
npm run start -- --hostname localhost --port 3100
# Test terminal:
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3100'
try { npm run test:e2e } finally { Remove-Item Env:PLAYWRIGHT_BASE_URL }
```

## Live attempt and blocker

The planned audience was the verified Example A pair, Amélie (2001) and Norah
Jones, with default 400 pages/all sample languages. No search or provider
preflight was performed.

| User turn | Intended constraints | Actual result | Gemini requests | Qloo requests | Proposed selection |
|---|---|---|---|---|---|
| A | 45-minute interactive event, INR 450 maximum | First native Gemini request returned **HTTP 400**; local API returned 502. Stopped before tool execution. | 1 | 0 | None |
| B | Revise after changing price to INR 300 | **UNVERIFIED**: no valid first proposal existed to revise; no extra request was invented. | 0 | 0 | None |

**Actual total: one Gemini request, zero Qloo requests.** There was no automatic
retry, repair, tool execution, fallback proposal, changed selection, or applied
outline. The actual trace contained one failed Gemini action. Consequently live
authentication, native tool continuation, proposal generation, and revision are
not verified by this attempt. Controlled tests establish behavior only against
their synthetic providers.

The initial adapter classified the HTTP 400 as generic `GEMINI_BAD_RESPONSE`.
Its fixed message was corrected offline to `GEMINI_REQUEST_REJECTED`, retaining
the numeric upstream status. That correction was not used to repeat the call.
The raw provider error body was deliberately not retained, so the specific
rejection cause remains **unknown**; HTTP 400 does not establish an invalid key.

An offline configuration audit found the effective credential came from ignored
`.env.local`, matched its parsed value, had no unintended whitespace or detected
placeholder/copied label, and was distinct from the Qloo credential. The model
setting was `gemini-3.8-flash`. Current official docs and SDK serialization
support the submitted native request fields; no concrete correction justifying
a retry was identified. No credential values, prefixes, lengths, fingerprints,
raw headers, provider errors, or environment dumps were printed.

Next verification needs the provider's **non-secret error status/reason** or
confirmation in Google AI Studio that this key/project can use the configured
model and Interactions API. Do not send the credential or enable billing to
work around this result. No speculative model/host/provider fallback was tried.

## Artifacts and remaining limits

- `playwright-report/index.html`: complete automated browser report.
- `test-results/results.json`: machine-readable browser results.
- `test-results/<event-agent-Generate-test>/event-proposal-workspace-desktop.png`:
  controlled desktop preview with a preserved edited outline.
- `test-results/<event-agent-390px-test>/event-proposal-workspace-mobile-390.png`:
  full-page controlled preview with eligible books and a preserved edited outline.
- `artifacts/playwright/event-agent-live-stopped.png`: actual failed live UI.
- `artifacts/playwright/event-agent-live-results.json`: minimal sanitized outcome
  and actual trace/counts. No credential or opaque signature is retained.

Generated artifacts stay ignored. Desktop/390px and actual keyboard interactions
are covered in Chromium; other browsers and physical devices are unverified.
Inputs/proposals/drafts are session-only, and the credential-enabled app should
remain local pending public access/quota controls. Main and the existing public
website were not changed or deployed.

Sources: Google's [native function calling](https://ai.google.dev/gemini-api/docs/function-calling),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash),
[Interactions API](https://ai.google.dev/api/interactions-api), and
[troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting);
Qloo's [Insights contract](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md).
