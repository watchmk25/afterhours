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
tokens, with up to a 60-second whole-response deadline for local validation. Each
Gemini operation receives the smaller of that limit and the remaining run budget.
Qloo retains its 1 MiB body and ten-second deadline, combined with the remaining
run's abort signal. A run has a 150-second overall deadline; reading the HTTP
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
- **199 Node tests passed**: existing suites plus 18 event-loop, 16 event-domain,
  16 actual-SDK transport fixture tests, 14 sanitized-diagnostic tests, and seven
  mocked-clock deadline tests. Native function-result IDs/signatures,
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

## HTTP 400 investigation and correction (2026-10-20)

The previous checkpoint's first live attempt returned HTTP 400, with one Gemini
request and zero Qloo requests. Its adapter cancelled the error body before the
SDK could read it, so that earlier response could not establish a cause.

Before another request, actual pinned-SDK serialization was tested offline using
the real event-loop input and an injected transport. It confirmed Developer API
routing (`enterprise:false`, `vertexai:false`), `v1beta`, the configured
`gemini-3.8-flash` model, the native function declaration, low thinking, and
stateless history. There were no `generateContent` fields or first-turn
structured-output options. The installed SDK types permit `auto` inside
`allowed_tools`, but those types do not establish server acceptance.

A single authorized diagnostic request recovered the actual native envelope:

| Observed field | Sanitized value |
|---|---|
| HTTP status | 400 |
| `error.code` | `invalid_request` |
| `error.message` | `allowed_tools mode must be either ANY or VALIDATED.` |
| Separate provider status, parameter path, reason details | Not supplied |

This establishes the rejected configuration:
`generation_config.tool_choice.allowed_tools.mode: "auto"`. It does not establish
invalid credentials, unavailable model access, or a schema/thinking problem.
The smallest correction uses documented plain `tool_choice: "auto"` on the
first turn. Only `rank_eligible_books` is declared, so Gemini still chooses that
native tool or clarification. A forced repair retains `allowed_tools.mode:"any"`;
post-tool generation retains `"none"`. Model, API, credentials, function schema,
grounding validation, retries, deadlines, and tool budgets are unchanged.

Rejection bodies are now read under a **16 KiB** cap and the existing deadline.
The adapter interprets the documented native `error.code/message` and includes
numeric code/status or field violations/reasons only when actually present.
Only a bounded, allowlisted summary reaches the server's `[AfterHours Gemini]`
diagnostic log; public errors and draft-preservation behavior remain fixed.
Configured and nested credential/header values, URLs, opaque tokens, full text
steps, and organizer-request echoes are redacted before truncation. Raw bodies,
SDK exceptions, stacks, headers, prompts, and opaque signatures are not logged.
Malformed/oversized errors retain only HTTP status and a fixed explanation.
Missing credentials make zero requests and emit no provider diagnostic.

Fourteen focused offline checks cover native and actually supplied RPC envelopes,
nested credentials, prompt echoes, truncation boundaries, bounded malformed
errors, no retries, callback isolation, deadlines, and zero-request configuration
failures. The real SDK serialization regression verifies plain first-turn auto;
the agent regression verifies forced repair and post-tool choices separately.

## Earlier corrected live turn (checkpoint 09d28a4)

The planned audience was the verified Example A pair, Amélie (2001) and Norah
Jones, with default 400 pages/all sample languages. No entity searches or extra
readiness probes were performed.

| User turn | Intended constraints | Actual result | Gemini requests | Qloo requests | Proposed selection |
|---|---|---|---|---|---|
| Diagnostic | Same first-turn native request, before correction | **HTTP 400**, `invalid_request`; specific mode rejection above. No tool execution. | 1 | 0 | None |
| A | 45-minute interactive event, INR 450 maximum | Corrected request hit the existing **20-second Gemini deadline**; local API returned 504, `GEMINI_DEADLINE`. No upstream HTTP status/body was received. | 1 | 0 | None |
| B | Revise after changing price to INR 300 | **UNVERIFIED**: no valid first proposal existed to revise; no extra request was invented. | 0 | 0 | None |

**That investigation's total: two Gemini attempts, zero Qloo requests**, excluding
the earlier checkpoint's one failed request. The corrected run's actual trace
contained one failed Gemini action: `Gemini did not complete within the request
deadline.` No ranking, proposal, output repair, or Apply occurred. The live browser
screenshot shows the selected Guide and existing title/notes still present.
The revision was not attempted because there was no valid proposal to revise.

The immediate configuration rejection is understood and corrected, but a timeout
does not prove upstream acceptance/authentication or identify the reason for
latency. The timeout and no-retry safeguards were retained and no further live
probe was made. Both live proposals, fresh Qloo tool execution, native
continuation, exact agenda totals, and live Apply remain **UNVERIFIED**.
Controlled tests verify these contracts only with synthetic providers.

## Deadline alignment and isolated probe (current verification)

Offline tracing identifies the old provider wrapper's `20_000` ms timer as the
observed cutoff, not browser cancellation or the overall agent timer. The pinned
SDK receives both `httpOptions.timeout` and per-call `timeout_ms`. Its installed
transport only creates an independent SDK timeout signal when no caller signal
is supplied (`dist/node/index.mjs`, request construction around line 20315).
This app supplies its own controller signal, so the wrapper owns the deadline.
The previous artifact retained the timeout outcome, not a measured elapsed time.

Local validation now aligns these layers:

| Layer | Effective deadline and behavior |
|---|---|
| Gemini SDK settings and provider wrapper | At most 60,000 ms, reduced to the remaining run budget. One bounded request, including reading the body; no retries. |
| Complete agent run | At most 150,000 ms across all model, ranking, repair, and validation stages. |
| Qloo ranking | Unchanged 10,000 ms timer combined with the overall abort signal, so whichever budget expires first cancels it. |
| Browser UI | No automatic fetch cutoff; explicit Cancel, input changes, and unmount still abort/ignore stale work. |
| Local live verification helper | Explicit 170,000 ms response wait for each user turn, allowing the full run and local body/response overhead. Normal 45-second fixture-test limits do not govern this standalone helper. |

Concise existing action traces now include `elapsedMs`, outcome, and an optional
fixed deadline label: `gemini_request`, `sdk_http` (recognized SDK timeout only),
`agent_run`, `qloo_request`, or `user_cancel`. No prompts, payloads, keys, request
URLs, or hidden reasoning enter these timing fields. SDK and wrapper settings
agree, and explicit caller cancellation takes precedence over a local timeout.
The native model/API configuration is unchanged: Developer API `v1beta`,
`gemini-3.8-flash`, `thinking_level:"low"`, 4096 output tokens, plain initial
`tool_choice:"auto"`, and no initial final-response schema. Actual SDK serialized
fields are asserted offline; unsupported `minimal` thinking was not introduced.

Seven focused mocked-clock checks verify both caps, smaller remaining budgets
across ranking/repair, Qloo's own and overall deadlines, cancellation labels,
suppression of late work, timing bounds, and unchanged native serialization.
They make zero live calls. Lint, TypeScript, the production build, and the full
Chromium regression suite use controlled providers only.

The one isolated live probe used the same credential loader (`@next/env` with
production precedence), explicit trimmed server key, configured model, provider
factory, API version, and actual captured ranking-tool declaration. Only the
instruction/input was shortened to ask for a native ranking-function call; no
final proposal schema was supplied. Qloo execution was disabled in this probe.

| Stage | Measured elapsed | Actual outcome | Deadline fired |
|---|---|---|---|
| Isolated Gemini native tool-call probe | **7,284 ms** | HTTP **503**, native `error.code: service_unavailable`; provider explanation says the configured model is experiencing high demand. | None |
| A: generate at INR 450, 45 minutes | Not attempted | **UNVERIFIED**: probe did not succeed. | None |
| B: revise at INR 300 | Not attempted | **UNVERIFIED**: no valid first proposal exists. | None |
| Explicit Apply | Not attempted | **UNVERIFIED** with live output. | None |

**Current task total: one Gemini request, zero Qloo requests.** The last
successful stage was receiving the upstream HTTP response; the failing stage was
provider availability. No successful native interaction, function call, text
output, ranking, proposal, repair, or Apply was observed. No unchanged request
was repeated. HTTP 503 does not prove valid authentication or explain the earlier
generation latency. The model and retries remain unchanged; live acceptance
requires a later authorized attempt when provider availability permits it.

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
- `artifacts/playwright/gemini-400-diagnostic.json`: the prior investigation's one diagnostic
  request and sanitized native rejection evidence.
- `artifacts/playwright/event-agent-fixed-results.json`: corrected turn's actual
  trace, deadline failure, and total counts including the diagnostic.
- `artifacts/playwright/event-agent-fixed-stopped.png`: corrected live UI with
  the deadline error and preserved existing outline.
- `artifacts/playwright/gemini-deadline-probe.json`: current isolated probe's
  measured elapsed time, HTTP status, sanitized provider code/explanation, and
  one-request count. No raw response or opaque model steps are retained.
- `artifacts/playwright/probe-gemini-deadline.mjs`: manually invoked one-probe
  helper, refusing a second attempt when its evidence file already exists.
- `artifacts/playwright/verify-gemini-deadline.mjs`: prepared standalone two-turn
  browser helper with a 170-second response wait; not run because the probe failed.

Generated artifacts stay ignored. Desktop/390px and actual keyboard interactions
are covered in Chromium; other browsers and physical devices are unverified.
Inputs/proposals/drafts are session-only, and the credential-enabled app should
remain local pending public access/quota controls. Main and the existing public
website were not changed or deployed.

Sources: Google's [native function calling](https://ai.google.dev/gemini-api/docs/function-calling),
[supported thinking levels](https://ai.google.dev/gemini-api/docs/thinking),
[structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[model capabilities](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash),
[Interactions API](https://ai.google.dev/api/interactions-api),
[native error envelope](https://ai.google.dev/gemini-api/docs/api-errors), and
[troubleshooting](https://ai.google.dev/gemini-api/docs/troubleshooting);
Qloo's [Insights contract](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md).
