# Public release — 25 October 2026

**Historical record. Current update — 30 October 2026:** the adaptive source was merged and passed 44/44 controlled public checks, but its one anonymous live attempt failed on the Gemini continuation deadline. Production was restored to the accepted earlier book deployment at `910ac80cf08bcfb4e288b418609e83cd841c506f`, whose application code matches `06cf158…` tested below. The Production project switch is now false for future builds; the restored immutable deployment retains its original settings. See the [current release outcome](adaptive-public-release.md) and [updated submission draft](devpost-submission.md). Results and “leave enabled” instructions below describe 25 October, not a new acceptance or instruction to change today's switch.

## Authorization and source

The organizer explicitly authorized public repository visibility, Production
publication and one bounded anonymous live verification. No new general release
approval is required. Earlier private/draft/keep-main-unchanged instructions in
historical records are superseded for this release; Preview protection and its
paused state remain required.

PR #3 was already merged before this task, at
`e9b5505de388efdd24a333822fc55c845e49af02`. Its parents are old main `574ca8c`
and accepted feature checkpoint `c553f28`; the merge has **zero tree difference
from c553f28**. Local main was fetched and fast-forwarded to that existing merge,
without a reset or another PR merge. Unchanged application verification and the
scoped source/history review can therefore be reused.

| Source-publication check | Actual result |
| --- | --- |
| Repository | **Public:** <https://github.com/watchmk25/afterhours>. Visibility changed using the authenticated GitHub CLI, under the organizer's explicit authorization. |
| Anonymous repository access | **PASS:** unauthenticated GitHub REST GET returned HTTP 200, `private=false`, expected owner/name and default branch main. No cookies or authentication headers were supplied. |
| License detection | **PASS:** anonymous GitHub response reports SPDX `MIT`; raw main `LICENSE` returned HTTP 200 and the standard MIT text, copyright 2026 Mousam Kumar. |
| Fresh publication preflight | 109 tracked files inspected; no match for the five saved credential values. Actual environment files, `.vercel` and test artifacts remain ignored. The merge adds no content beyond the reviewed checkpoint. No concrete finding required rotation or history rewriting. |
| License scope | Project MIT covers its original code. Dependencies, provider services and provider-supplied data retain their own terms; source publication does not grant additional provider rights. Existing Git author metadata is part of the published history. |

## Production configuration and deployment

Existing project: `sam-3b2d/afterhours`,
`prj_o1f7kfh65mfLH0RSIho0xsuGwwjr`. The Git connection remains
`watchmk25/afterhours`, Production branch main. The initial Production deployment
was already Ready at source `e9b5505`, ID
`dpl_CXNdG2h3cM5nBF7X7fFo24T5wwgu`, with provider-generated public alias
<https://afterhours-umber.vercel.app>. A credential-free GET returned HTTP 200
and the AfterHours workspace. That GET alone does not verify interactions or
live provider functionality.

Initial environment inspection found **zero Production entries** and the seven
existing entries scoped only to Preview / feat/event-agent. Their metadata,
protection `all_except_custom_domains` and zero bypass entries remained
unchanged. Local saved credentials are present without outer whitespace;
local `GEMINI_MODEL=gemini-3.5-flash-lite` and
`AFTERHOURS_LIVE_ENABLED=false` were confirmed without displaying private values.

The attempted secure bulk configuration used the documented Vercel environment
API through pinned CLI 64.5.0, sending values from ignored `.env.local` only via
private stdin. It exited 1. No raw request, stdout/stderr or credential value was
printed; a subsequent read confirmed **no Production entry was created**. No
unchanged write was retried. Documented non-mutating request generation with a
non-secret body confirmed that stdin and JSON content-type generation work; it
did not establish the reason for the actual write failure.

The organizer was given the precise existing-dashboard step to add separate
Production-only entries and redeploy the same main source with live=false:

- Existing saved local values as Secret/Sensitive: `GEMINI_API_KEY`,
  `QLOO_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  `AFTERHOURS_USAGE_SECRET`.
- Config: `GEMINI_MODEL=gemini-3.5-flash-lite`,
  `AFTERHOURS_LIVE_ENABLED=false` initially.

This preserves the same Redis store, namespace, visitor secret, budgets and
pacing. Preview entries and local values must remain unchanged. No `NEXT_PUBLIC_`
key, fabricated Vercel runtime flag, trusted-header override, provider probe,
new dependency, billing change or Redis diagnostic is part of this release.

### Configured paused deployment and first browser gate

The organizer completed the dashboard setup and redeployed main. Authenticated
metadata confirms seven separate Production-only Sensitive entries and Ready
Production deployment `dpl_HHMNgY3jJN3S2MQRmY8RTdNg6hJ6`, immutable URL
`https://afterhours-ge3ux684f-sam-3b2d.vercel.app`, source
`e9b5505de388efdd24a333822fc55c845e49af02`. The public alias remains
`https://afterhours-umber.vercel.app`. Stored values were not displayed.

Preview identities/scopes and the other six entries are unchanged. The organizer
re-saved the Preview pause flag, changing its timestamp while preserving its ID,
type and scope; they report false. Existing protected paused deployment evidence
is reused. Local live=false and protection/no-bypass settings are preserved.

The actual anonymous pause journey **passed** with an initially empty browser
cookie jar: workspace HTTP 200; event POST HTTP 503 `LIVE_DISABLED`; usage
**0 Gemini / 0 Qloo**; one failed pre-store admission trace, establishing **0
Redis dispatches**. Guide selection and edited title/notes were retained.

The first anonymous controlled suite completed with **54 passed / 2 failed** in
**169,263 ms**, one worker and zero retries. No test was skipped or flaky; all
provider calls were intercepted, **0 live Gemini / Qloo / Redis requests**.
The two failures were the applied-context return-to-planner link and real
keyboard navigation: the correct planner target was focused/navigated to but
remained outside the viewport for the full ten-second assertion. The release
gate therefore remains closed; Production was not enabled and the live budget
is unused. Retained traces/screenshots support a controlled scroll investigation;
no assertion is being weakened or replaced with an HTTP-only check.

Evidence is ignored under `artifacts/playwright/`: `public-production-pause.json`,
`public-controlled-verification.json`, `public-chromium-results.json`,
`public-chromium-report/` and per-test screenshot/trace folders in
`public-chromium-results/`. Historical protected evidence remains separate.

### Confirmed keyboard-scrolling release fix

A controlled comparison replayed the **same two failed journeys and assertions**
with only root HTML scrolling forced to `auto`. Both passed in **22,135 ms**,
one worker and zero retries, with zero provider/store dispatches. A source
identity check confirmed the copied test bodies/assertions were unchanged.
The former viewport assertions completed in 14.675 ms and 7.494 ms. This supports
global smooth scrolling as the interaction causing/contributing to the settled
off-screen focus, rather than a provider or data failure.

The minimal application fix removes only `scroll-behavior: smooth` from the
global `html` rule; it retains scroll padding, design, focus styling, inventory,
native tool behavior, deadlines and validation. No test assertion was weakened.
Installed Next.js 16 scroll guidance was inspected; no speculative framework
configuration or provider change was added.

The fix was committed and pushed normally as
`06cf158ccd930abfc1f3924ec34649ebd7b15a6d` — **Fix keyboard and anchor scrolling**.
Only `app/globals.css` was in that commit; the five pending release documents
remained preserved. New validation passed: lint, explicit TypeScript, **289 Node
tests in 11,042 ms**, and production build. Routine transports were controlled
and child provider/store credentials blanked; **zero live calls**. No dependency
or Redis diagnostic was run. Full anonymous hosted verification must pass on
the paused fixed deployment before the one live attempt.

Comparison evidence: ignored `smooth-auto-results.json`, `smooth-auto-run.json`
and `smooth-auto-output/` under `artifacts/playwright/`. The original failure
screenshots/traces and first suite result remain retained separately.

### Full browser gate after the fix

Vercel deployed the fix as Ready Production
`dpl_3PJSrNDF9fzR2aRDcsCRXMXAuD6s`, immutable URL
`https://afterhours-ej6r1tb03-sam-3b2d.vercel.app`, full source
`06cf158ccd930abfc1f3924ec34649ebd7b15a6d`. All 14 environment-entry metadata
and protection settings were unchanged from the configured paused baseline.

All **56 original anonymous hosted Chromium journeys passed in 119,848 ms**,
one worker, zero retries, no skipped/flaky/unexpected tests, **without any CSS
override or assertion changes**. This includes the two previously failing
keyboard/anchor cases, edit preservation, explicit Apply, cancellation, stale
responses, pacing/limit failures, CSV journeys and 390px layout. Every provider
API response was controlled and unmocked routes blocked: **0 live Gemini,
Qloo or Redis calls**. The passing result is separate from the initial failure:
`public-controlled-fixed-verification.json`, `public-fixed-chromium-results.json`
and `public-fixed-chromium-report/` under the ignored artifact directory.

### Enabled Production and single anonymous live acceptance

After that gate passed, a narrow authenticated PATCH changed **only** the
Production `AFTERHOURS_LIVE_ENABLED` entry to string `true`. This non-secret
configuration value was the only value in that command's arguments; no
credential was read or passed there. A documented Git-source deployment pinned
the same source and existing project, with no paid overrides or `--public`
source-exposure flag. The API accepted both operations; the earlier bulk
credential-write failure was not retried.

Ready enabled deployment: `dpl_7Si49UQpNXgy5Uii1wMNionQjoVC`, immutable URL
`https://afterhours-g4lv4xatx-sam-3b2d.vercel.app`, source
`06cf158ccd930abfc1f3924ec34649ebd7b15a6d`. Authenticated metadata confirmed it
held the public aliases, including **https://afterhours-umber.vercel.app**.
Other Production settings, Preview entries and protection were preserved.

Exactly **one anonymous browser generation** passed on the public alias, using
a fresh context with **zero initial cookies**, no test authentication, no Node
proxy and no injected hosting/identity headers. Inputs were Example A (Amélie,
2001 + Norah Jones), INR 450, 400 pages, Bengali/English/Hindi, and 45 minutes.
The actual browser POST returned **HTTP 200**, using **2 Gemini requests and
1 fresh Qloo ranking**. No probe, retry, revision or replacement attempt ran.

The proposal selected **The Namesake — Jhumpa Lahiri**, illustrative price INR
450, 304 pages, English, 15 copies. Qloo assessed **3 of 6 eligible books**, with
three reviewed mappings. Proposal title: **AfterHours Interactive Reading
Experience**. Agenda: Welcome 5, Paired Discussion 25, Reflection 10, Closing 5 —
**exactly 45 minutes**. Existing Guide selection and edited title/notes remained
intact until explicit Apply. Apply selected The Namesake and populated its
title, materials and invitation; desktop and 390px captures were inspected.
Mobile document/body width both measured 390px, with no horizontal overflow or
observed clipping.

| Actual selected-book numerical evidence | Value |
| --- | --- |
| `affinity:the-namesake` | `0.7179884704476631` |
| Amélie contribution | `0.6219156325588995` |
| Norah Jones contribution | `0.3780843674411006` |

All three evidence references were validated against the current run and
selected eligible book. Values are relative provider evidence, not probabilities
or proof of recommendation quality. No full ranking position is inferred.
Activities and invitation wording retain the warning that they are Gemini
proposals, not Qloo evidence or verified literary facts.

| Observed actual stage | Elapsed |
| --- | --- |
| Shared usage admission | 58 ms |
| Initial Gemini pacing | 15 ms |
| Gemini native tool-call response | 706 ms |
| Qloo eligible-book ranking | 58 ms |
| Continuation Gemini pacing | 5 ms |
| Gemini proposal response | 1,893 ms |
| Proposal validation | 4 ms |
| HTTP response received from generation action | 3,617 ms |
| Valid proposal rendered | **3,652 ms** |

Loading was observed at **66 ms** from the browser action; duplicate-submit
controls and Cancel were verified while pending. Observed admission/pacing
subtotal is **78 ms**, excluding untraced cleanup and other overhead. No deadline
fired. The configured expected model remains `gemini-3.5-flash-lite`; its
Sensitive setting/upstream model metadata is not exposed in the public response.

Exact task provider totals: **2 Gemini requests / 1 Qloo ranking**. Routine
checks, the CSS comparison and the paused request contributed zero provider
calls. Live Redis admission and both pacing stages succeeded, but the response
does not expose a total Redis HTTP count or individual lease-release
acknowledgment; neither is invented. The isolated Redis diagnostic was not
repeated. One successful public turn establishes bounded anonymous functionality,
not sustained reliability, future quota availability or recommendation quality.

Ignored actual live evidence: `event-agent-public-release-results.json`,
`event-agent-public-release-applied-desktop.png` and
`event-agent-public-release-applied-mobile-390.png` under `artifacts/playwright/`.
These are actual public live results, separate from controlled fixtures and
the historical protected acceptance.

## Verification ledger

| Gate | Current result |
| --- | --- |
| Public source and MIT | **PASS**, as above. |
| Anonymous Production web page | **PASS:** HTTP 200 from a fresh zero-cookie browser; the real UI journey below also passed. |
| Production seven-variable configuration / paused deployment | **PASS** metadata and actual anonymous paused-response check, as above. This proves pause and required preflight configuration presence, not provider authentication. |
| Anonymous controlled hosted Chromium suite | **PASS 56/56** on the real deployed fix, 119,848 ms. Initial 54/2 failure and the controlled comparison remain recorded above. |
| Single anonymous live proposal / evidence / edits / Apply | **PASS**, actual source `06cf158`, 3/6 coverage, exact 45-minute agenda, preserved edits and explicit Apply, 3.652-second valid render. |
| Current task live request totals | **2 Gemini / 1 Qloo**, one generation attempt, within maximum three/one. No probe, retry, revision or replacement. No further live request is needed. |
| Final operator state | **Production enabled for judges**, as explicitly authorized after success. Local and Preview remain paused; Preview protection remains enabled. |
| Protected Preview | Identities/scopes and other six entries preserved; the organizer re-saved its false switch. Protected acceptance is reused: 56 hosted fixture checks, one successful bounded live run and final paused Preview from 22 October. |
| Redis and application checks | Prior nine-request isolated Redis PASS reused; diagnostic not repeated. After the confirmed CSS fix, lint, explicit TypeScript, 289 controlled Node tests and production build passed anew. |

## Publication handoff and remaining limitations

The authorized public source publication and bounded anonymous live acceptance
are complete. Leave Production enabled for judges. The operator can pause it by
setting only the Production switch to false and redeploying; no automatic retry
or fallback is added. Existing shared budgets, minute pacing, 30-second run
deadline, timeout/cancellation behavior and conservative reservations remain.

The documentation-only main push can create another enabled Production
deployment. Its actual source is reported separately from the live-tested
application commit `06cf158`; application files are unchanged by that push.
Final Devpost submission remains the organizer's action. Unknown team/entrant
details and optional video remain explicit in the submission draft.

The final five-document review passed **47 local-link checks**, balanced code
fences, no configured-credential matches and `git diff --check`. Actual local
environment files, deployment metadata, generated reports and screenshots stay
ignored. No credential rotation, history rewrite or additional live verification
is part of the documentation checkpoint.

Known limitations remain: illustrative inventory; five reviewed sample mappings
and partial eligible coverage; imported inventory limited to local filtering and
templates; session-only edits; no recommendation-quality or adoption claim.
Store Free-plan/eviction management settings and future provider quotas were not
re-audited here. Monitor actual hosting/provider/store allowances and judged
availability; shared admission is not token-per-minute enforcement or a hard
spending guarantee. Dependency/provider terms continue to apply. No new release
approval gate is inferred from these documented limitations.

Official configuration references:
[Vercel environment creation](https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables),
[Git-source deployment](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment),
[scoped variable updates](https://vercel.com/docs/rest-api/projects/edit-an-environment-variable).
