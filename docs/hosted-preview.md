# Protected release preview

For the subsequent audience-setup, applied-context, cancellation, and duration
corrections with zero live calls, see the [audience-to-event verification record](audience-event-journey.md).
The deployment and live timings below describe the earlier release checkpoint.

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
test runner accepts a **process-only** `PLAYWRIGHT_VERCEL_OIDC_TOKEN` and an
explicit HTTPS Vercel origin. A trusted Node wrapper privately captures
`project token afterhours --scope sam-3b2d --json` from pinned Vercel CLI 64.5.0;
its stdout is a credential and must never be printed or persisted. The same
project's development identity can reach its own Preview using the existing
Trusted Sources default. No trust rules, static bypasses, environment settings,
or production access are added. The transport sends the identity in
`x-vercel-trusted-oidc-idp-token` internally. Existing process-only
`VERCEL_AUTOMATION_BYPASS_SECRET` access remains supported; specifying both
methods is rejected. Authorization is added inside Node fetch for that
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

The first authorized hosted suite passed 46 checks; its CSV download check
reached Vercel SSO because Chromium's native download escaped ordinary request
routing. The trace showed no CSV route fulfillment. For protected targets only,
that test now validates the exact existing CSV link, fetches the **real hosted
file** through Node with HTTP 200 required, and transfers those bytes to a
temporary browser Blob URL on the existing anchor. The click, download event,
filename, downloaded-file/header, and subsequent BOM/quoted import assertions
remain intact. The link is restored and Blob revoked afterward. Local testing
keeps the original native path. This transport adaptation does not verify the
separate hosted cookie-authenticated native-download path, and does not change
application code or substitute a sample CSV.

The first setup guard stopped at HTTP 302 to `vercel.com/sso-api`, before any
access creation or provider request; that exact redirect is now recognized as
anonymous protection. A subsequent URL-scoped shareable access attempt failed
the authorized workspace preflight and was revoked before browser journeys or
provider calls. It is not used as an automation credential. The same-project
OIDC access check then returned **HTTP 200** with the actual AfterHours title and
workspace section markers. The OIDC credential stays in process memory and child
environment only, is discarded afterward, and expires automatically. Verify
unauthenticated access remains blocked and production deployment/environment
metadata remain unchanged. No project-wide automation bypass is created.

## Deployed Preview

The protected Preview is
[afterhours-1mnhg6i1r-sam-3b2d.vercel.app](https://afterhours-1mnhg6i1r-sam-3b2d.vercel.app),
deployment `dpl_J1PCLKqDQApctdtSg4RGzKiK8DdQ`, source commit
`e92b2f9fd711c5a9483003e99f09944867b8418c`. Vercel reported **READY** and
the expected `feat/event-agent` source metadata. Later test-access and results
documentation changes do not change the deployed application code.
Opening the plain URL requires authorized Vercel project access; no credential
or shareable access parameter is included in this link.

After the OIDC test-access correction, lint, explicit TypeScript, all **218 Node
tests** (eight protected-transport checks), and production build passed.
Neither application prompts, provider settings, nor dependencies changed.

## Hosted verification — 2026-10-21

All **47 Chromium regression tests passed against this protected Preview**,
using one worker, zero retries, controlled provider fixtures, and no live
provider requests. They cover the workspace, CSV import, confirmed Qloo
interests and ranking, event previews/revisions, cancellation/stale responses,
edit preservation, explicit Apply, keyboard interaction, and 390px layouts.
The protected CSV download uses the actual hosted bytes through the transport
adaptation described above. The eight offline transport tests additionally
cover exact-origin authorization, Origin preservation, manual redirects,
redaction, fixed errors, and unmocked-provider blocking.

After that suite passed, a fresh browser context performed **exactly one real
generation** through the hosted UI, using Example A (Amélie + Norah Jones),
INR 450, 400 pages, all three sample languages, and a 45-minute interactive
request. No standalone probe, revision, fallback, or retry was made. The
application returned HTTP 200 with **two Gemini requests and one Qloo ranking**.

| Observed stage | Duration |
| --- | ---: |
| Loading feedback visible | 278 ms after Generate |
| First Gemini request | 735 ms |
| Fresh Qloo ranking | 79 ms |
| Second Gemini request | 1,912 ms |
| Proposal validation | 5 ms |
| Application response | 4,194 ms after Generate |
| Valid proposal rendered | **4,246 ms after Generate** |

The validated proposal selected **The Namesake by Jhumpa Lahiri**, at illustrative
INR 450, with **3 of 6 eligible books assessed**. Its four agenda blocks were
5 + 20 + 10 + 10 = **45 minutes**. Current-run evidence contained the returned
affinity and contributions for the two confirmed interests; these are not
probabilities or a verified literary explanation. The existing selected Guide,
edited title, and organizer notes remained unchanged before Apply. An explicit
**Apply proposal** then selected The Namesake and populated the proposal's
title, materials, and invitation. Desktop and 390px screenshots were inspected;
the mobile document and body measured 390px with no horizontal overflow, and
the book cards, proposal, and outline fields remained readable.

This one hosted result was below the 10–15-second target. It does not establish
a stable latency distribution or explain the previous local 26.928-second run.
The prompt and output budget were unchanged. Sanitized evidence is retained
locally in ignored files:

- `artifacts/playwright/event-agent-hosted-results.json`: actual proposal,
  coverage, timings, request counts, edit/Apply and overflow assertions.
- `artifacts/playwright/event-agent-hosted-applied-desktop.png` and
  `event-agent-hosted-applied-mobile-390.png`: actual applied hosted proposal.
- `artifacts/playwright/release-hosted-regressions.log`,
  `playwright-report/index.html`, and `test-results/results.json`: passing suite.
- `artifacts/playwright/release-preview-oidc-verification.json`: plain URL
  remains protected (HTTP 302 to Vercel SSO); production deployment, project
  environment variables, and protection unchanged; no project-wide bypass.

The short-lived OIDC identity was removed from the child environment afterward
and is not saved. Only the deployment's server-side runtime holds the Qloo and
Gemini credentials. Test-access and documentation changes after the deployed
source commit do not change its application runtime.

## Before anonymous public release

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
route body-read deadlines remain public hardening work. Search/rank now forward
caller cancellation to fetch/body reading; a dispatched request cannot be
retracted and cancellation does not establish a quota refund. No
database/provider framework is introduced in this release.

Five sample books have reviewed mappings; current filters may assess only part
of the eligible inventory (local A: 3/6, B: 1/3). Imported rows remain local and
unsupported for live ranking/planning. Scores are not probabilities. Proposed
activities need organizer review, and conservative prose checks are not complete
semantic fact-checking. A successful hosted turn establishes functionality, not
sustained latency, recommendation quality, quota availability, or public reliability.

Sources: [Vercel function limits](https://vercel.com/docs/functions/limitations),
[CLI deploy/runtime variables](https://vercel.com/docs/cli/deploy),
[Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources),
[URL-scoped protection access](https://vercel.com/docs/rest-api/aliases/update-the-protection-bypass-for-a-url),
[shareable link limits](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/sharable-links).
