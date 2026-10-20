# Protected release preview

This release stays on `feat/event-agent`; [draft PR #3](https://github.com/watchmk25/afterhours/pull/3)
targets main and must not be merged in this task. The private repository's
cumulative diff was reviewed from `origin/main` at
`574ca8cc0070caefd99ee52743cad3b2bbe45ba4`. It contains Qloo diagnostics and
feasibility evidence, server-only live matching, the bounded Gemini event
planner, UI, tests, and documentation. CSV import/sample filtering are already
on main. Tracked filenames/history and credential-pattern checks found no real
environment files, private uploaded catalogues, keys, or generated artifacts.

## Latency review

The saved successful local A/B record is
`artifacts/playwright/event-agent-responsive-results.json`. A rendered in
26.928 seconds, with 17.961 seconds in the second Gemini call; B rendered in
14.558 seconds. The actual A screenshot already has a one-sentence rationale,
four short actionable activities, three materials, and a brief invitation.
Repeated schema, inventory fields, and interest UUIDs had already been removed.
B carried additional historical proposal context and was faster. Numeric token
usage was not retained, so excessive text/context is **not an established latency
cause**. The working prompt/schema are preserved rather than claiming an
unsupported speed improvement.

The release keeps `gemini-3.5-flash-lite`, minimal thinking, 4096 output tokens,
native tool execution, signature-bearing stateless continuation, and current
server validation. Normal execution is two model calls and one ranking; the
maximum is three model calls/one ranking per run, no automatic retries. The run
deadline is 30 seconds; model calls receive the smaller of 20 seconds and the
remaining budget. Qloo receives the smaller of ten seconds and the remaining
run budget. Apply remains explicit and replaces a draft only after review.

## Hosting and secret scope

The existing linked project is `afterhours` (`prj_o1f7kfh65mfLH0RSIho0xsuGwwjr`),
personal Hobby account `sam-3b2d`, authenticated CLI user `watchmk365-6455`.
Pinned Vercel CLI 64.5.0 is used without upgrades. Project settings show Next.js,
Node 24.x, Fluid compute enabled, and Vercel Authentication
`all_except_custom_domains`. The documented Hobby Fluid default is **300
seconds**, accommodating the five-second input-read cap plus the 30-second
application run and response overhead. No duration, protection, production
environment, or production deployment setting is changed.

The project is CLI-linked and has no Git integration, so Vercel rejects
branch-scoped project environment variables. This release uses the supported
**deployment-only runtime** option instead: `--env GEMINI_API_KEY`,
`--env QLOO_API_KEY`, and `--env GEMINI_MODEL`, with bare names only. A trusted
local Node process loads ignored `.env.local` using `@next/env` and supplies the
values through the child environment. Installed CLI source confirms that bare
names read `process.env` and become that deployment's `env`, separate from build
environment and persistent project variables. Values never enter argv. Do not
use `KEY=value` arguments, `--build-env` secrets, `--debug`, `--public`,
`--prod`, promotion, or protection overrides.

The `.vercelignore` dry-run manifest must exclude `.env.local`, `.git`, `.vercel`,
`node_modules`, `.next`, reports, and `artifacts`; only empty `.env.example`
settings are uploaded. Credentials stay server-side and are not configured for
Production, Development, or other Preview deployments.

## Authorized browser verification

An explicitly supplied `PLAYWRIGHT_BASE_URL` disables the local web server.
Default local/anonymous behavior remains available. For protected access, the
test runner accepts a **process-only** `VERCEL_AUTOMATION_BYPASS_SECRET` and an
explicit HTTPS Vercel origin. Authorization is added inside Node fetch for that
exact origin only, with manual redirects, a bounded response/deadline, fixed
safe errors, and no retries. Secret headers, cookies, encoding metadata, and any
echoed secret bytes are withheld before fulfilling the browser response.
Authorization is never added to Playwright configuration, trace-visible call
arguments, browser headers, storage state, cookies, or URL parameters.

Page-level provider fixtures retain priority. The shared regression fixture
blocks any unmocked `/api/qloo/*` or `/api/event-agent` request, so the full
hosted suite makes zero live provider calls. A separately guarded manual helper
may allow **one** real `/api/event-agent` POST after regressions pass, with the
server's existing three-model/one-ranking maximum. No standalone probe or retry
is authorized. Capture stage/render timings, actual proposal/coverage, edited
outline preservation, and explicit Apply; stop on failure without a substitute.

A temporary time-limited shareable access secret may be created for **this exact
deployment URL only** using Vercel's URL protection-bypass API, held in memory,
passed through child environment, and revoked after verification. Do not create
project-wide automation access, disable protection, or revoke an unrelated
shareable link. Verify unauthenticated access remains blocked and the production
deployment/environment metadata remain unchanged.

## Before anonymous public release

Local release-preparation checks passed: lint, TypeScript, all **216 Node
tests** (including six protected-transport tests), and production build. The
transport tests use synthetic authorization only and cover exact-origin
scoping, Origin preservation, manual redirects, redaction, fixed errors, and
unmocked-provider blocking. These checks make zero live provider calls. Hosted
regressions and the single real hosted turn are recorded after deployment.

Current bounds protect individual invocations; they do **not** impose shared
quotas, aggregate spending limits, or concurrency limits across requests or
serverless instances. UI duplicate-submit prevention is local to a browser.
Entity-reference HMAC signatures verify entity integrity across instances, not
caller identity. Origin checks allow absent Origin and are not authentication.

Before removing protection, define an access policy and authenticated identity
or equivalent gate; enforce durable per-user/IP and global request/spending
quotas plus shared concurrency limits; configure provider budgets and useful
monitoring/alerts; validate abuse controls across instances; and review data
handling and retention. In-memory counters are insufficient. Standalone Qloo
route body-read deadlines and caller-cancellation wiring also remain public
hardening work. No database/provider framework is introduced in this release.

Five sample books have reviewed mappings; current filters may assess only part
of the eligible inventory (local A: 3/6, B: 1/3). Imported rows remain local and
unsupported for live ranking/planning. Scores are not probabilities. Proposed
activities need organizer review, and conservative prose checks are not complete
semantic fact-checking. A successful hosted turn establishes functionality, not
sustained latency, recommendation quality, quota availability, or public reliability.

Sources: [Vercel function limits](https://vercel.com/docs/functions/limitations),
[CLI deploy/runtime variables](https://vercel.com/docs/cli/deploy),
[URL-scoped protection access](https://vercel.com/docs/rest-api/aliases/update-the-protection-bypass-for-a-url),
[shareable link limits](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links).
