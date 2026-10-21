# Shared Gemini request pacing

This change adds a shared rolling-minute request gate to the existing event agent. It preserves the model, native function calling, evidence validation, explicit Apply, cancellation, and provider deadlines. It adds no queue, cached proposal, automatic retry, provider fallback, or account requirement.

## What is bounded

`lib/gemini-pacing.ts` permits at most **12 Gemini request reservations in a rolling 60-second window** across AfterHours instances using the same Redis database and `afterhours:usage:v1` namespace. Every initial request, tool-result continuation, and permitted repair must pass this check immediately before dispatch. Normal successful generation still uses two Gemini requests and one Qloo ranking; the maximum remains three Gemini requests and one Qloo ranking per run.

An atomic Redis Lua operation uses `TIME`, removes reservations at least 60 seconds old, checks the sorted-set count, and inserts a random UUID only if capacity remains. A full set returns the earliest expiry in whole seconds, rounded up and bounded to 1–60. There is no process-local allowance and no check-then-increment race between instances. [Redis TIME](https://upstash.com/docs/redis/commands/server/time), [Atomic Lua operations](https://upstash.com/blog/lua-scripting-on-upstash-redis-atomic-operations-over-http)

The key expires 60 seconds after the latest accepted reservation. It contains only random reservation IDs and Redis-time scores, never prompts, interests, inventory, outlines, credentials, visitor identifiers, or raw IP addresses. An expired member may remain physically until a subsequent admission or key expiry, for less than 120 seconds from its creation; it never grants extra active capacity.

The existing controls remain independent and unchanged:

| Control | Limit |
| --- | --- |
| Per-visitor searches / standalone rankings / event runs | 12 / 6 / 6 per one-hour first-admission window |
| Shared daily provider reservations | 100 Qloo / 90 Gemini per 24-hour first-admission window |
| Event admission reservation | 3 Gemini + 1 Qloo, charged before work |
| Concurrent event runs | 2, with 45-second expiring leases |
| Complete agent run | 30 seconds |
| Each Gemini request | At most 20 seconds and the remaining run budget |
| Each Qloo ranking | At most 10 seconds and the remaining run budget |

Daily and minute reservations are intentionally not refunded after cancellation, provider failure, a rejected continuation, or an uncertain store response. A reservation can succeed even when its response is lost; the application then rejects the dispatch rather than assuming success. These are conservative admission counts, not a provider billing report.

## Failure and cancellation behavior

Each store operation uses built-in server fetch, with the smaller of **one second and the remaining run budget** for pacing, including response reading. No redirects or automatic retries are enabled. Missing configuration, store failure/timeout, cancellation, or malformed output fails closed before the next Gemini dispatch. The agent does not wait for capacity and does not extend its 30-second deadline. [Upstash REST API](https://upstash.com/docs/redis/features/restapi)

An exhausted minute returns HTTP 429 with `GEMINI_PACING_LIMIT`, known seconds in `Retry-After`, and an understandable message asking the organizer to wait and retry explicitly. No countdown is a promise of capacity: another visitor may use the next slot first. A store failure is HTTP 503 `USAGE_UNAVAILABLE` without invented retry timing.

Initial pacing denial can report zero Gemini/Qloo requests. Continuation denial can occur after one Gemini request and a fresh Qloo ranking; those counts and completed trace stages remain visible. Unknown counts after an outer in-flight cancellation remain `usage: null`. No failed run substitutes recorded content, changes the selected book, replaces edits, or applies a proposal. A previous preview becomes stale and cannot be applied until a new valid run succeeds. Event-lease cleanup still runs after success, failure, or cancellation, with expiry bounding unsuccessful cleanup.

The trace records only actual stage, outcome, duration, and concise explanation: `usage_admission`, `gemini_pacing`, provider/tool execution, and validation where reached. It exposes no prompts, payloads, credentials, or internal reasoning. Cancellation cannot retract a request already accepted by a provider or establish a quota refund.

## Provider limits remain separate

The organizer reported an account screenshot showing **15 RPM**. That is historical user-supplied evidence, not a current verified provider limit, and 12 is a conservative application default rather than proof of headroom. Google applies separate request-per-minute, token-per-minute, and other quotas; limits depend on the model, project/tier, and account state. Other apps or diagnostics using the same Google project can consume that quota without passing this application gate. A request gate neither estimates token consumption nor establishes a monetary cap. Check the project's current limits directly before release. [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

Redis availability, lost state, eviction, failover/replication limitations, clock discontinuities, or operator resets can weaken an absolute distributed bound. Use the account-owned Free database with eviction disabled and retain provider-side quotas and monitoring. Rejected traffic also consumes Redis requests. No billing, store plan, credential, model, namespace, or runtime live-switch change is part of this work. [Upstash consistency](https://upstash.com/docs/redis/features/consistency), [Eviction behavior](https://upstash.com/docs/redis/features/eviction)

To pause live actions, keep `AFTERHOURS_LIVE_ENABLED=false` or unset it and restart/redeploy the affected runtime. Local browsing, CSV filtering, manual templates, and existing edits continue. Enabling the flag alone does not establish trusted hosting identity or a working store.

## Isolated Redis-only check

Run manually using the existing ignored server configuration:

```sh
npm run usage
```

`npm run usage:check` is the same helper. It never imports or calls Gemini/Qloo. The maximum is **10 Redis requests**, with **9 on the normal successful path**:

1. Admit two events from separate service instances.
2. Deny a third concurrent admission.
3. Release the first lease and admit a replacement.
4. Admit a Gemini minute reservation.
5. Seed eleven synthetic UUIDs only into that check's temporary pacing key.
6. Deny another pacing admission from a separate instance.
7. Delete exactly the six known temporary keys, including pacing.

All operations use a fresh random diagnostic namespace. The helper never resets, seeds, scans, or clears application counters. It stops new admissions after failure and retains the first sanitized status/timeout evidence. PASS requires confirmed cleanup; a lost write response can leave cleanup uncertain despite a later delete acknowledgment, so that result remains UNVERIFIED with bounded TTLs. No raw store responses, secret values, credential URLs, headers, or generated key names are printed. Missing credentials make zero requests and exit 2.

The historical six-request Redis PASS in [the shared usage record](usage-controls.md#saved-credential-redis-verification--2026-10-21) covered admission and leases before this extension. It does not establish the new pacing operation's compatibility with the configured store.

## Verification status — 2026-10-21

| Check | Actual current result |
| --- | --- |
| Lint | PASS. |
| Explicit TypeScript check | PASS. |
| Node tests | PASS: **289**, with routine transports controlled and zero live provider calls. |
| Production build | PASS. |
| Local Chromium production regressions | PASS: **56 tests in 1.7 minutes**, controlled fixtures, zero retries. |
| Extended Redis-only pacing check | PASS: invoked once, **9/10 maximum requests**, all HTTP 200, cleanup acknowledged and confirmed. |
| New protected hosted Preview / controlled checks | **UNVERIFIED**: Vercel CLI connection blocker below. |
| Live hosted generation | **UNVERIFIED**: no attempt; zero live Gemini/Qloo calls. |

Offline tests cover actual Lua shared state across separate instances, simultaneous admission, rolling-window boundaries, expiry, store rejection/malformed responses, cancellation, and dispatch accounting for initial, continuation, and repair requests. The passing controlled browser journeys cover pacing denials before the first request and after a ranking, exact displayed usage, preserved selection/all edits/applied context, stale Apply prevention, explicit keyboard interaction, and 390px overflow/readability.

The single Redis-only invocation observed:

| Stage | HTTP status | Elapsed | Outcome |
| --- | --- | --- | --- |
| First admission | 200 | 681 ms | Accepted. |
| Second admission | 200 | 412 ms | Accepted. |
| Shared concurrency denial | 200 | 304 ms | Third run correctly denied. |
| Own lease release | 200 | 324 ms | Released. |
| Admission after release | 200 | 389 ms | Replacement accepted. |
| Gemini pacing admission | 200 | 422 ms | Accepted. |
| Temporary pacing saturation | 200 | 262 ms | Eleven synthetic entries filled only the isolated pacing key. |
| Shared Gemini pacing denial | 200 | 375 ms | Separate instance correctly denied. |
| Temporary-key cleanup | 200 | 306 ms | Six exact temporary keys deleted; cleanup confirmed. |

No timeout or automatic retry occurred. This invocation sent **9 Redis requests, 0 Qloo requests, and 0 Gemini requests**. Only the isolated temporary namespace was used; application counters were not inspected or reset. This establishes actual store authentication and the checked operations, including pacing admission/denial. It does not establish sustained availability, real-time expiry/failover behavior, provider quotas, account/Free-plan ownership/settings, or trusted-host integration.

Generated reports and screenshots remain ignored: `playwright-report/index.html`, `test-results/results.json`, `test-results/usage-controls-initial-Gem-5393c--automatic-retries-at-390px-chromium/gemini-initial-pacing-preserved-event-mobile-390.png`, and `test-results/usage-controls-continuatio-32e04--automatic-retries-at-390px-chromium/gemini-continuation-pacing-preserved-event-mobile-390.png`. Playwright replaces these output directories on later runs.

**Hosting blocker:** existing Vercel CLI metadata reads fail with `fetch failed`; direct Node connections to `api.vercel.com` / `vercel.com` report `UND_ERR_CONNECT_TIMEOUT`. An IPv4-first CLI metadata read also failed. A plain Windows HTTP check returned 308, which does not establish that the CLI/API connection works. No new Preview was created and no live agent request ran. No local environment values were changed; the live flag remains false. The hosted operator-pause check is also **UNVERIFIED**; offline default-off dispatch rejection passed. Main, production, repository privacy, and Preview protection remain unchanged.

The last recorded protected Preview remains `https://afterhours-6p14f62rq-sam-3b2d.vercel.app`, with source `7e88b81174371ab66dcd989340e5ee34026f6b35`. This is historical metadata, not a new read or deployment of pacing. There is no newly deployed source commit, hosted proposal/Apply result, rendered latency, or hosted Redis overhead to report. Exact hosted Gemini/Qloo totals are **0/0**; the single isolated store diagnostic accounts for all nine real Redis requests in this task.

Account-owned Free-plan and disabled-eviction settings remain **UNVERIFIED**. The configured data-plane REST token establishes the checked Redis access, not management-console access; no separate Upstash management authentication or usable management connector/CLI was available. No plan, billing, or eviction setting was changed. Restore Node/Vercel CLI HTTPS access before resuming the protected deployment, controlled hosted checks, exactly one bounded live generation, and final hosted pause verification.

Remaining verification is authorized protected-host integration and its pause check once CLI connectivity works. Existing successful local/hosted proposals remain historical evidence, not a live test of the new shared pacing gate. One successful store or hosted check would not establish sustained availability or public reliability.
