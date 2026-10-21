# Shared demo usage controls

This preparation adds a server-only admission layer for AfterHours' eventual anonymous demo. It covers `POST /api/qloo/search`, `POST /api/qloo/rank`, and `POST /api/event-agent`, including generation and revision. No application account is required. Browsing, local CSV processing, eligibility filters, fixed templates, existing drafts, and explicit Apply remain available independently of Redis and provider access.

**Latest real-store verification: PASS.** After the organizer saved the REST credentials, one bounded Redis-only invocation completed **6 Redis requests**, all HTTP 200, with confirmed temporary-key cleanup. It made **0 Qloo requests and 0 Gemini requests**. The existing local visitor secret was preserved and live application actions remain explicitly disabled. No database was provisioned or reconfigured; hosting/provider configuration and production counters were unchanged. Account/Free-plan settings and trusted hosting are separate unverified release items.

## Configuration and operator switch

Use one database owned by the organizer's Upstash account. Select the **Free** plan and keep **eviction disabled**. Do not add a payment method, upgrade a plan, or use an anonymous expiring scratch database. At review, the official Free plan lists one database, 256 MB, 500K monthly commands, and 10 GB monthly bandwidth; verify those limits in the account console before release. Adding a credit card upgrades to paid usage. [Upstash pricing](https://upstash.com/pricing/redis)

Upstash normally rejects writes at the storage limit when eviction is disabled. Eviction can delete allowance or lease keys before their intended expiry, undermining the controls; it must remain off. [Eviction behavior](https://upstash.com/docs/redis/features/eviction)

Set these only in server environment configuration; `.env.example` contains empty placeholders:

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Database's HTTPS REST origin, on `*.upstash.io`, without a path, query, fragment, user info, or custom port. |
| `UPSTASH_REDIS_REST_TOKEN` | Database's write-capable REST token; transported only in the authorization header. |
| `AFTERHOURS_USAGE_SECRET` | Independent random secret, 32–512 characters, with no whitespace/control characters; HMACs visitor identities. |
| `AFTERHOURS_LIVE_ENABLED` | Exact `true` enables the admission path. Default `false`, unset, or any other value disables application live work. |

Existing `QLOO_API_KEY`, `GEMINI_API_KEY`, and `GEMINI_MODEL` retain their server-only meanings. Preserve the existing ignored `.env.local`; edit values privately and never print/copy them into commands, tracked files, screenshots, or browser configuration. Do not use `NEXT_PUBLIC_` for any secret. Next.js' normal inherited process values take precedence over environment files.

**Disable switch:** set `AFTERHOURS_LIVE_ENABLED=false` or remove it, then restart/redeploy the affected runtime. All three public live actions reject before provider dispatch. Already-sent work cannot be recalled. This switch does not disable browsing, CSV filters, manual templates, or editing an existing event.

The switch stays off until real-store and trusted-host validation are completed. Production environment variables, main, repository visibility, and Preview protection are unchanged by this preparation. No database or hosting configuration is changed automatically.

## Conservative defaults and accounting

The constants in `lib/usage-control.ts` are deliberately small and shared by every service instance using the same database and namespace, `afterhours:usage:v1`.

| Scope | Allowance | Window/expiry |
| --- | --- | --- |
| Visitor searches | 12 | One hour |
| Visitor standalone rankings | 6 | One hour |
| Visitor event runs, including revisions | 6 | One hour |
| Shared Qloo reservations | 100 | 24 hours |
| Shared Gemini reservations | 90 | 24 hours |
| Shared event concurrency | 2 admitted runs | Each lease expires after 45 seconds |

The visitor hash has independent search/rank/event fields but one common first-admission expiry. The global hash similarly has one common first-admission expiry for its Qloo/Gemini fields. Later admissions do not extend either window. These are fixed windows anchored at first admission, not sliding windows or UTC-day global quotas; bursts are possible at a window boundary.

Each admitted standalone search or ranking reserves **one Qloo request**. Each admitted event run reserves **three Gemini requests and one Qloo ranking** before any provider work, covering the current maximum including a permitted repair. Normal successful execution may use only two Gemini requests; the unused reservation is intentionally not returned. Failed, clarified, cancelled, or timed-out admitted work retains its reservation, because dispatch and provider accounting can be uncertain. Thirty event reservations exhaust the shared Gemini budget, even if actual model traffic is lower. Searches and standalone rankings consume the same Qloo allowance as event rankings.

Invalid input, missing provider configuration, deterministic clarification, invalid/unconfirmed interests, and insufficient eligible candidates are checked before shared admission and provider dispatch. A denied limit/busy admission does not increment visitor/provider counters. Admission is not a record of actual provider consumption: the response's ordinary agent trace/usage and these conservative reservations have different purposes.

The layer bounds this application's admitted calls under the configured shared state. It does not control separately invoked diagnostics, other applications using the same provider credential, or provider-side token prices, rate limits, quota accounting, model repairs, or work already accepted remotely. It is not a monetary spending cap.

## Atomic store behavior and failure states

One bounded Redis `EVAL` checks visitor limits, shared provider budgets, and event concurrency before incrementing counters and adding a lease. Redis `TIME` supplies the lease clock. All keys are supplied explicitly; a conditional decision and its mutations are one atomic script, rather than a non-atomic pipeline or a process-local counter. [Upstash REST API](https://upstash.com/docs/redis/features/restapi), [Atomic Lua operations](https://upstash.com/blog/lua-scripting-on-upstash-redis-atomic-operations-over-http), [Redis TIME](https://upstash.com/docs/redis/commands/server/time)

The runtime uses built-in fetch with a **one-second deadline per store operation**, including response reads, a 16 KiB response cap, no redirects, no automatic retries, and strict JSON/result validation. Credentials remain in a server authorization header, never the URL. A cleanup operation gets its own bounded deadline, so rejection/cleanup can add store overhead around the unchanged provider deadlines.

No Upstash client or rate-limit SDK is imported. This choice avoids adopting an availability bypass: the official rate-limit SDK documents an allow-on-timeout behavior, while the Redis SDK defaults to network retries. Store failure here always rejects live work. [Rate-limit timeout behavior](https://upstash.com/docs/redis/sdks/ratelimit-ts/features), [Redis SDK retries](https://upstash.com/docs/redis/sdks/ts/retries)

| Condition | Public behavior |
| --- | --- |
| Disabled live switch | HTTP 503, `LIVE_DISABLED`; organizer-paused guidance. |
| Missing/malformed store or visitor configuration, unavailable store, timeout, malformed response | HTTP 503, `USAGE_UNAVAILABLE`; retry later, with no provider dispatch. |
| Visitor/global allowance exhausted | HTTP 429, `USAGE_LIMITED`; known remaining-window seconds in message and `Retry-After`. |
| Both event slots occupied | HTTP 429, `USAGE_BUSY`; retry guidance based on earliest lease expiry. |
| Cancellation before admission/dispatch | Rejected cancellation, with no provider dispatch. |

Rejections preserve existing event edits. The UI does not silently retry, generate a fallback proposal, change the selected book, or Apply content. A brief store outage deliberately makes live actions unavailable while local workspace operations continue.

An admission response can be lost after Redis committed. The caller still rejects provider work and attempts cleanup of its own lease; provider reservations are not refunded. Cleanup failure or server termination leaves only an expiring lease. Do not delete allowance keys, enable eviction, change namespaces per instance, or rotate secrets to recover throughput: these actions can reset protections. Expired leases are removed during subsequent admission; random lease IDs prevent one run from releasing another run's slot.

Cleanup is attempted after success, failure, or cancellation, independently of the caller's aborted signal. The 45-second lease exceeds the existing 30-second agent deadline. Gemini still has at most 20 seconds per request and the remaining run budget; Qloo retains its ten-second request bound and remaining-run cancellation. Cancellation rejects late application responses but cannot prove that remote processing stopped or that any provider quota was refunded. A cancellation before dispatch can report zero provider requests; after work has begun, the outer cancellation response reports `usage: null` when actual counts are unavailable, rather than inventing zero. Concurrency therefore bounds admitted application runs, not a guaranteed count of provider computations still running after a disconnect.

## Visitor privacy and hosting trust

Only a server-confirmed Vercel runtime (`VERCEL=1`) may use `x-vercel-forwarded-for`. The code validates a single IP, normalizes IPv6 spelling, and derives an HMAC-SHA256 identifier from the server secret, current UTC day, and normalized address. It does not trust client-supplied `x-forwarded-for`, `x-real-ip`, arbitrary lists, a user-provided identifier, or browser storage. Vercel documents platform-owned request IP headers and its spoofing protections. [Vercel request headers](https://vercel.com/docs/headers/request-headers)

Redis contains only daily-derived visitor hashes, operation/provider counts, random lease IDs, and bounded expiries. Visitor keys expire after at most one hour from their first admission; global counters expire after 24 hours; each lease is valid for at most 45 seconds. No raw IP, prompt, audience interest, catalogue, outline, credential, or saved workspace data enters these keys/values. The secret and raw header are used in server memory only and are not logged by the layer.

The lease set expires 45 seconds after its latest admission; expired members are also removed before every admission. An old member can physically remain after its own 45-second validity until the set expires, for less than 90 seconds from creation. It never counts toward concurrency after its score expires.

The HMAC changes at UTC midnight, so a visitor may receive a fresh allowance before the old hourly window expires. Rotating the secret also resets visitor identity; neither changes the shared global budget. People sharing an IP can share a limit, and changing networks/IPv6 addresses can change identity. This is a lightweight anonymous-demo approximation, not identity verification or complete abuse prevention.

Ordinary local Next.js requests have no trustworthy hosting IP header and fail closed, even with provider keys and Redis configured. Do not simulate production trust by setting Vercel runtime flags or supplying spoofed headers. Local browsing is fully usable; automated tests use injected transports and controlled responses. Another hosting platform needs a reviewed trusted-identity adapter before enabling live actions.

## Manual Redis-only verification

After privately configuring the account-owned Free database, run:

```sh
npm run usage
```

`npm run usage:check` remains an alias for the same helper. The helper uses existing `@next/env` loading, so inherited process values take precedence over ignored `.env.local`. It imports no provider integration and makes no Qloo/Gemini requests. It uses a random `afterhours:usage:check:<uuid>` namespace, synthetic visitor hashes, and **at most eight Redis REST requests**, each under the same one-second bound.

The check admits two events through separate control instances, verifies denial of a third simultaneous admission, releases one run's lease, verifies a new admission, and deletes only its five exact temporary keys. A successful result requires confirmed cleanup. If cleanup cannot be confirmed, all temporary data has existing bounded TTLs, at most 24 hours, and the result remains UNVERIFIED. It never scans or clears unrelated keys.

Without both REST credentials the helper prints a fixed sanitized UNVERIFIED summary, reports zero requests, and exits 2. With credentials, success exits 0; failure or unconfirmed cleanup exits 1 and reports only sanitized stage/count information. Do not infer provider access, public usability, account ownership, Free-plan settings, trusted-host header handling, or anonymous abuse resistance from this store-only result.

The diagnostic now records only fixed stage/outcome names, elapsed milliseconds, HTTP status actually observed, and a known deadline flag. It retains the first failure even if later cleanup succeeds, and starts no new admissions after an observed failure. A failed release cannot be swallowed into a passing check. HTTP 200 parsing/Redis-error failures remain a combined category when the cause is not observable; raw responses and errors are never printed. No credentials, URLs, headers, Redis contents, namespace/key names, or provider payloads appear in the summary.

`cleanupAcknowledged` means the exact-key delete returned a valid result. `cleanupConfirmed` is more conservative: a prior transport failure or timeout can leave an unresolved write that may complete after deletion on another connection, so acknowledgment alone cannot confirm absence of late writes. Such a result remains UNVERIFIED with the TTL limitation; the check makes no extra probe or retry to resolve that uncertainty.

### Initial configuration verification follow-up — 2026-10-21

The saved ignored `.env.local` and effective process configuration were inspected without displaying values. Required `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` assignments were both **missing**, with no inherited overrides. Their format/authentication therefore could not be verified. The absent visitor secret was generated cryptographically and saved directly to `.env.local` without printing it. Its parsed value is present and valid. `AFTERHOURS_LIVE_ENABLED=false` is explicit in both local and effective configuration. Existing Qloo/Gemini settings were preserved; no Vercel runtime flag or trusted header was fabricated.

The requested `npm run usage` command was invoked **once** after offline checks. Actual result:

| Field | Observed result |
| --- | --- |
| Real store | **UNVERIFIED**: Upstash Redis REST credentials are not configured. |
| Last stage | Configuration. |
| Redis requests | **0**, under the eight-request maximum. |
| HTTP status / timeout | No HTTP response; no store operation or deadline started. |
| Cleanup acknowledged / confirmed | Both false; no temporary keys were created, so no cleanup was needed. |
| Qloo / Gemini requests | **0 / 0**. |
| Production counters | Untouched. |

That attempt stopped after the configuration failure. At that checkpoint, saving the REST URL/token was required before a new bounded check, and real Redis behavior remained unverified. The organizer subsequently confirmed saving both variables, authorizing the separate follow-up recorded below. No automatic retry occurred; the live switch stayed false.

For the diagnostic-only code changes, full lint and explicit TypeScript checks passed. **34 focused offline tests passed**, including eight new manual-check tests: actual admission Lua and isolated cleanup, missing/invalid configuration, first HTTP failure retention, swallowed release failure, malformed responses, fetch/body deadlines and cleanup uncertainty, cleanup failure preventing PASS, and fake-secret-safe output. Runtime application code, dependencies, and provider deadlines did not change. The full application/build/Chromium suites were not repeated; their earlier results below remain historical. The local environment file remains ignored and untracked.

### Saved-credential Redis verification — 2026-10-21

Starting at `8daaebf99b3c51cac5cfa8f72c0c0342e62ef476`, the saved local and effective configuration both contained a valid-format REST URL/token and a valid visitor secret, with no inherited override. Only presence/format flags were displayed. The existing visitor secret and all credentials/settings were preserved; this continuation made no environment-file edits. `AFTERHOURS_LIVE_ENABLED=false` remained explicit locally and effectively. No Vercel runtime flag or trusted header was fabricated.

`npm run usage` was invoked once after the organizer's save confirmation. It exited successfully with `realStore: PASS`, `cleanupAcknowledged: true`, and `cleanupConfirmed: true`:

| Stage | HTTP status | Elapsed | Outcome |
| --- | --- | --- | --- |
| First admission | 200 | 522 ms | Completed. |
| Second admission | 200 | 290 ms | Completed. |
| Shared concurrency denial | 200 | 221 ms | Third admission correctly denied by shared state. |
| Own lease release | 200 | 218 ms | Completed. |
| Admission after release | 200 | 220 ms | Completed. |
| Temporary-key cleanup | 200 | 219 ms | Exact isolated temporary keys deleted; cleanup confirmed. |

Actual totals for this invocation: **6 Redis requests of the maximum 8; 0 Qloo requests; 0 Gemini requests**. No timeout fired, failure was observed, or automatic retry occurred. The earlier missing-credential invocation made zero Redis requests, so both configuration attempts together still total six real Redis requests. Only the diagnostic's isolated temporary namespace was used; production counters were untouched. Credentials, URLs, headers, Redis contents, namespace identifiers, and raw errors were not printed or retained in this record.

This verifies authentication and the actual Redis operations used for shared admission, concurrency denial, own-lease release, admission after release, and temporary-key cleanup on the configured store. It does not establish sustained availability, failover behavior, all real-time expiry/budget boundaries, account ownership, Free-plan/eviction settings, trusted hosted visitor identity, or provider access. Live application actions remain disabled. No code/dependency changes were needed; this follow-up changes documentation only, so the prior passing offline checks were reused and the full application suite was not repeated. `.env.local` remains ignored/untracked; main, production, Preview protection, and repository privacy remain unchanged.

## Offline checks and release boundaries

Focused tests cover shared state across independent instances, simultaneous admission, independent visitor limits, shared provider reservations, window expiry, own-lease release, abandoned leases, failure/timeout/cancellation, and zero provider dispatch after rejection. Transport tests reject unsafe configuration, redirects, malformed/oversized responses, and late successes. Identity tests cover untrusted headers, missing secrets, IPv6 normalization, and daily rotation. Browser checks use controlled provider/limit/busy responses to exercise edit preservation, retry guidance, keyboard access, and 390px layout without live calls.

The test-only pinned Wasmoon 1.16.0 dependency runs the actual production admission/release Lua against fake Redis command state, with network forbidden. It uses a bundled local WebAssembly VM and is never imported by the application. Wasmoon's Lua 5.4 execution of this common Lua 5.1 subset checks script logic; it does not establish Upstash command compatibility, real-store atomicity, failover behavior, or latency. [Wasmoon](https://github.com/ceifa/wasmoon), [Redis Lua API](https://redis.io/docs/latest/develop/programmability/lua-api/)

Initial implementation verification on 2026-10-21 (before the saved-credential check above):

| Check | Actual result |
| --- | --- |
| `npm run lint` | PASS. |
| `node node_modules/typescript/bin/tsc --noEmit --incremental false` | PASS. |
| `npm test` | PASS: 260 tests, including 34 new usage checks. |
| `npm run build` | PASS: production build, all three live routes dynamic. |
| Chromium against `http://localhost:3101` production preview | PASS: 54 tests in 1.4 minutes, one worker, zero retries; includes the original 51 and three new admission-denial journeys. |
| `npm run usage:check` without store credentials | UNVERIFIED, expected missing-configuration exit; zero Redis requests. |
| Configured-secret comparison against tracked/unignored files and `.next/static` | PASS: no matches; `.env.local` remains ignored and untracked. This comparison is not an exhaustive historical secret scan. |

The actual search/rank/event handler tests use isolated synthetic environments and intercepted fetch. They verify rejection before provider dispatch, configuration/validation skips before Redis, conservative reservations, cleanup after a controlled provider failure, and honest unknown counts after in-flight cancellation. The production browser server had provider keys disabled and provider egress blocked. Browser fixtures exercise limit/busy/store-unavailable/operator-paused states, explicit keyboard retries, preserved selection and all edited outline fields, retained applied evidence, disabled stale Apply, and manual editing at 390px. The full-page 390px capture was visually inspected; its controls, error message, cards, and applied context remain readable without horizontal overflow.

Generated artifacts are ignored: `playwright-report/index.html`, `test-results/results.json`, and `test-results/usage-controls-denied-revi-22be6-s-and-readable-390px-states-chromium/usage-denied-applied-event-mobile-390.png`. The earlier ignored hosted-verification helper was adjusted locally to reject unknown usage rather than assuming zero; no raw capture or helper is committed. That initial implementation verification sent **0 live Qloo requests, 0 live Gemini requests, and 0 real Redis requests**; the later real-store check is recorded separately above. No hosted preview was deployed or reverified for these usage-control changes.

The bounded real-store check now passes; trusted-host integration and sustained behavior remain unverified. Upstash documents persistence, but Free lacks paid-tier extra redundancy and its consistency documentation describes replication/failure limitations. Operator changes, store loss, clock discontinuity, identity rotation, and distributed failure can weaken an absolute cap; provider-side hard quotas and monitoring remain necessary. [Durable storage](https://upstash.com/docs/redis/features/durability), [Consistency](https://upstash.com/docs/redis/features/consistency)

Before anonymous release, confirm the actual account/Free plan/disabled eviction and verify hosted store configuration, Vercel header trust, and the operator pause procedure. Confirm provider credential quotas, expiry, access, and cost limits with their issuers. Add appropriate hosting traffic protection and monitoring: even rejected traffic consumes Redis requests and can exhaust the Free store's allowance. Keep Preview protection enabled until a separately authorized public-release decision; this preparation does not merge or deploy to production.
