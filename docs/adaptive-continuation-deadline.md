# Adaptive continuation deadline — 30 October 2026

**Scope of this historical record:** the implementation and protected acceptance task below did not authorize Production changes. A subsequent task separately released the same application through PR #7 at `385d7ec…`; anonymous public acceptance passed in 5.693 seconds with 2 Gemini / 1 Qloo, and Production remains enabled. See the [current release](adaptive-continuation-release.md). The source/policy/tests and protected results below are preserved; their “no release” boundary describes that earlier allowance.

This focused fix branches from main `771202c6ea2d95d9c796b0db72e7547d9e0c8b47`. It does not merge [release-outcome PR #6](https://github.com/watchmk25/afterhours/pull/6), change Production or replace the restored accepted demo. The earlier public failure reached fresh Qloo discovery, then hit the continuation's 20-second request cap at 23.064 seconds total. The underlying provider latency cause remains unknown; changing the budget does not diagnose it.

## Exact policy and deadline trace

| Layer | Limit / behavior |
| --- | --- |
| Request body | Existing bounded UTF-8/JSON read, at most 5 seconds; precedes live admission. Unchanged. |
| Club route | Existing 30-second live-work timer begins before shared admission. Caller abort propagates to the route controller. The agent receives only the remaining route budget after admission. |
| Adaptive run | Existing maximum 30 seconds, further limited by that route remainder. Pacing, model requests, Qloo and validation share this budget. |
| Completion reserve | **2,000 ms within the remaining budget**, allowing one second for bounded lease cleanup and one second for validation/response handling. This is headroom, not added time or a guarantee of network delivery within 30 seconds. |
| First/pre-tool Gemini request | `min(20,000 ms, remaining − 2,000 ms)`. The normal first-request ceiling stays 20 seconds. A pre-tool repair also retains that ceiling. |
| Post-tool continuation / permitted repair | `min(28,000 ms, remaining − 2,000 ms)`, recomputed after pacing and request construction. No new allowance is created by a repair. |
| Provider wrapper | Default ceiling remains **20,000 ms**. Only the adaptive server factory opts into `maxRequestTimeoutMs: 28_000`; the option is hard-clamped to 28 seconds, and a shorter configured timeout or per-call budget still wins. No client input can set it. |
| SDK HTTP / response body | The same final deadline reaches SDK HTTP `timeout`, Interactions `timeout_ms`, wrapper abort race and bounded full-body reads. Automatic retries remain disabled. Caller cancellation wins; late responses are rejected. |
| Qloo | Unchanged 10-second cap, also bounded by the enclosing run signal. No change to candidates, order, evidence or the one-request tool limit. |
| Validation | Exact agenda, selected-entity membership, evidence and all existing checks retained. An additional active-budget check after synchronous validation prevents accepting a result after the overall deadline. |
| Usage lease | Unchanged 45-second Redis lease with independent expiry; release still runs after success/failure/cancellation using its own bounded one-second store operation. Daily reservations, per-visitor allowances and rolling pacing are unchanged. |
| Browser / verification transport | UI has no shorter automatic cancellation timer; explicit cancellation and stale-response epochs are unchanged. Existing protected Node transport allows 40 seconds; the live helper waits up to 50 seconds for the response, so it does not truncate the server's work budget. |
| Hosting | Existing project uses Hobby, Node 24 and Fluid compute. No per-route `maxDuration` or `vercel.json` override is introduced. [Vercel documents a 300-second Hobby Fluid default](https://vercel.com/docs/functions/configuring-functions/duration), above the unchanged application limit; this is not an increased application allowance. |

When no provider time remains outside the reserve, the agent returns `RUN_TIMEOUT` with a precise completion-reserve message before further pacing/provider dispatch. It never queues, sleeps for quota or silently substitutes a result. A successful late continuation can consume more of the existing run budget; it cannot increase the three-Gemini/one-Qloo maximum.

Changed application paths: `lib/club-agent.ts`, `lib/club-server.ts`, `lib/gemini-provider.ts`. Legacy `lib/event-server.ts`, diagnostic scripts, UI contracts, model, native continuation/signatures, provider paths, filtering/mappings and shared usage implementation remain unchanged.

## Offline verification

- Focused provider/adaptive/route/legacy deadline checks: **51/51 PASS**. Deterministic Node mock timers replace long waits.
- A controlled transport through the actual pinned SDK and real adaptive adapter completes a continuation after **21 seconds**, beyond the old cutoff. With 500 ms already spent on admission, then first-request/pacing/Qloo time, its actual passed continuation budget is **24,750 ms**. It yields a validated 45-minute proposal with two model calls and one controlled Insights call.
- Other checks cover the 28-second absolute opt-in ceiling, shorter explicit/remaining budgets, no dispatch inside the completion reserve, bounded repair and unchanged current evidence, cancellation/overall expiry with late-output rejection, legacy 20-second behavior, route-level opt-in after admission, and lease release.
- Full Node suite: **380/380 PASS**. Lint, TypeScript (`--noEmit --incremental false`) and production build: **PASS**.
- Complete local production Chromium suite: **44/44 PASS**, one worker, no retries. Includes errors/pacing, cancellation, edit preservation, current evidence, explicit Apply, edited download, keyboard operation and 390px layout.
- All these checks use controlled transports with **zero live Gemini, Qloo or Redis requests**. The isolated Redis diagnostic is not repeated. Generated output stays under ignored `artifacts/playwright/continuation-*`, `test-results/` and `playwright-report/`.

## Protected verification boundary

The task authorized one new protected Example A / unrestricted-book / 45-minute Generate attempt, at most three Gemini requests and one Qloo Insights request. It was used exactly once as recorded below. No search, probe, revision, retry or replacement occurred. The implementation checkpoint is **`65ba64218f683fea63b9c1a67f9ac2a536fa8497`**, pushed on `fix/adaptive-continuation-budget`. The results below are a later documentation-only follow-up; no application change followed that tested source.

Production baseline to preserve: `dpl_6FSfbdxAVuuSetqPMddWYU1Bxc2a`, source `910ac80cf08bcfb4e288b418609e83cd841c506f`, <https://afterhours-umber.vercel.app>. No release/merge or new public acceptance is authorized by this deadline change. A single successful protected scenario would not establish sustained reliability or the cause of the earlier latency.

## Actual protected acceptance

**PASS — 30 October 2026**, one Generate click and one actual planning POST, with **2 Gemini requests / 1 fresh Qloo Insights request**, no repair or automatic retry. The existing Node-only same-project OIDC transport handled Preview authentication; provider responses were not fixtures. No trusted visitor header/runtime flag or usage bypass was fabricated. Shared admission, pacing and lease behavior remained active.

The correct branch-only seven Preview entries were configured using saved local credentials privately. The first CLI credential write failed and a read confirmed no entry existed. After the branch was pushed, the documented structured environment API created the scoped entries; the original CLI error reason was not retained, so no cause is asserted. Five credentials remain Secrets; model and exact-string live switch are readable Config. Other branches, Production values/model/store/secret and protection metadata matched the saved baseline throughout. No credential was printed, placed in argv or committed.

| Deployment | Source / evidence |
| --- | --- |
| Initial paused | `afterhours-p229wtxus-sam-3b2d.vercel.app`, `dpl_Bw4go22bGJuJQsmYEik4TC3k79AG`, source `65ba642…`. Runtime diagnostic: HTTP 200, `liveEnabled: false`, exact source. Anonymous access: HTTP 302 to Vercel SSO. |
| Controlled hosted suite | **44/44 PASS in 118.683 seconds**, one worker, no retries/skips/flaky results, zero live Gemini/Qloo/Redis calls, on that paused immutable target. |
| Temporary enabled test | `afterhours-jrowu6xm8-sam-3b2d.vercel.app`, `dpl_HeEvBC9J8YchbS5b6apsZpSBySxz`, source `65ba642…`. Before Generate, the provider-free diagnostic returned HTTP 200 with `liveEnabled: true` and exact source; anonymous access remained protected. |
| Final paused replacement | **<https://afterhours-3nlhetg31-sam-3b2d.vercel.app>**, `dpl_3akFoFDWsfkEFw77nD4AoEppcjmi`, source **`65ba64218f683fea63b9c1a67f9ac2a536fa8497`**, Ready / Preview. Independently verified runtime `liveEnabled: false` and exact source; anonymous HTTP 302 to Vercel SSO. Zero provider/store requests for status checks. |

The actual input was reviewed Example A (Amélie + Norah Jones), unrestricted book discovery, 45 minutes, group size 12, INR 450 per person, 400 pages, Bengali/English/Hindi, with no selected entity, uploaded rows or previous proposal. A local manual Guide template supplied the edited title/notes whose preservation was tested; it did not restrict the discovery.

Current Qloo returned **eight candidates**. The agent selected **What I Talk About When I Talk About Running**, entity `16EA273D-E76A-4C9F-BEE5-FE013489FD26`, with actual returned disambiguation **2007, Haruki Murakami**. Selected membership and every cited evidence reference were checked against that same response and replayed through the proposal validator. Actual selected affinity: **0.8395831843212976**; numerical contributions: **0.5303264245847119** (Amélie), **0.46967357541528815** (Norah Jones). The proposal cited the current affinity and Amélie contribution IDs. Scores are not probabilities or an invented narrative cultural explanation. Same-input results do not prove recommendation quality or improved rankings.

The validated agenda was **5 + 15 + 10 + 10 + 5 = 45 minutes**: welcome/opening, paired discussion, voluntary reflection, creative response and closing. Edited title/organizer notes stayed intact through preview. Budget, pages, language and availability remained `needs_confirmation`, source `unknown`, with no invented stock, price or edition facts. Apply required explicit conditional acknowledgment. Explicit Apply populated the agenda, title, format, materials and invitation while preserving notes. After editing the applied title to **AfterHours hosted edited plan**, the actual Markdown download contained that current edit, retained notes, the selected book, separate saved context, conditional facts and the scores-not-probabilities label. Document and body widths both measured **390px**, without horizontal overflow; desktop and mobile screenshots were retained.

| Observed stage | Elapsed |
| --- | --- |
| Loading feedback | 66 ms |
| First Gemini pacing | 12 ms |
| First Gemini request | 966 ms |
| Fresh Qloo discovery | 126 ms |
| Continuation pacing | 6 ms |
| Second Gemini request | 6,651 ms |
| Validation | 4 ms |
| Planning HTTP 200 response | 8,514 ms |
| Valid proposal rendered | **8,566 ms** |

The live continuation finished below the old 20-second cutoff. **This successful run does not demonstrate that the larger deadline caused success or explain the earlier latency.** The deterministic 21-second controlled transport proves the extended allowance; the live run establishes only this book scenario on this source/configuration. Unseparated admission/cleanup/transport time is not relabelled as measured Redis overhead. Exact Redis request usage during live work was not instrumented and is unknown, not zero. Routine checks and switch-status requests made zero live calls.

The runner restored the fix-branch Config to exact false in cleanup and verified readback before creating the paused replacement. After the final paused runtime proof passed, **only temporary enabled deployment `dpl_HeEvBC9J8YchbS5b6apsZpSBySxz` was deleted**. Complete before/after inventories confirmed it was the sole removed deployment and the paused replacement remained present. All other deployments, including Production, were preserved. All pushes after the implementation checkpoint occur only with the branch paused. Main and the active Production target remain at their preserved sources; PR #6 remains draft/unmerged. Artist/movie/place/shortlist live acceptance, sustained reliability and a new public adaptive release remain outside this task's evidence.

Ignored evidence: `artifacts/playwright/continuation-focused.log`, `continuation-node.log`, `continuation-lint.log`, `continuation-typescript.log`, `continuation-build.log`, `continuation-local-results.json`, `continuation-hosted-controlled.json`, `continuation-hosted-controlled-results.json`, `continuation-runtime-enabled.json`, `continuation-live-attempt.json`, `continuation-runtime-final-paused.json`; screenshots `continuation-live-applied-desktop.png` and `continuation-live-applied-mobile-390.png` in the same directory. No raw provider response, prompt, signature, credential or authentication header is committed. The single task allowance is spent; no additional live request is authorized by this record.
