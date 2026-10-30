# Adaptive continuation deadline — 30 October 2026

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

The task authorizes one new protected Example A / unrestricted-book / 45-minute Generate attempt, at most three Gemini requests and one Qloo Insights request. No search, probe, revision, retry or replacement is authorized. Enabled runtime status must be established through the existing provider-free Preview diagnostic. Regardless of outcome, restore the branch switch to false, verify a fresh protected paused replacement, then retire only this task's enabled test deployment. Actual results will be recorded separately from this implementation checkpoint after the pause gate passes.

Production baseline to preserve: `dpl_6FSfbdxAVuuSetqPMddWYU1Bxc2a`, source `910ac80cf08bcfb4e288b418609e83cd841c506f`, <https://afterhours-umber.vercel.app>. No release/merge or new public acceptance is authorized by this deadline change. A single successful protected scenario would not establish sustained reliability or the cause of the earlier latency.
