# Release hosted acceptance — 22 October 2026

## Current hotspot resumption

The organizer switched to a phone hotspot and reported HTTP 302 from the
credential-free GET. The secure workflow subsequently succeeded here. The
earlier transport-failure sections below are historical.

| Gate | Actual resumed result |
| --- | --- |
| Deployment identity | Authenticated Vercel API confirms `dpl_PeCypUeUagNsVsehvMpXJNzqc86c`, immutable URL `https://afterhours-otv2z3euy-sam-3b2d.vercel.app`, source `8892db227839b0cc7f35e0846bca75cdc7058973`, branch `feat/event-agent`, **READY / Preview**. |
| Hosting/configuration metadata | Existing account/project, Hobby plan, Git connection `watchmk25/afterhours`, Production branch main, and seven variables scoped only to Preview → feat/event-agent verified. Values are Sensitive and were not displayed or assumed correct. |
| Actual paused response | **PASS** through browser interaction: HTTP 503 `LIVE_DISABLED`, usage **0 Gemini / 0 Qloo**, exactly one failed usage-admission trace. Reviewed pre-store rejection establishes **0 Redis dispatches**. Guide selection and edited title retained. |
| Controlled hosted Chromium | **PASS: 56 tests**, 0 skipped, 0 flaky, 0 unexpected, **145,344 ms (2.4 minutes)**; one worker, zero retries. All provider responses controlled and unmocked API routes blocked: **0 live Gemini / Qloo / Redis calls**. |
| Coverage of controlled journeys | Edit preservation, explicit Apply, cancellation, stale responses, initial/continuation pacing denials, other usage-limit errors, keyboard Tab/Space/Enter/typing, CSV workflows and 390px overflow assertions passed. Representative proposal and continuation-denial full-page mobile captures were visually inspected: readable single-column cards, controls and outline fields, with visible focus and no observed clipping. |
| Preview protection | Anonymous GET returned **302 to Vercel SSO** after pause and suite runs. Node-only same-project development OIDC authorized the tests; no token entered browser state or artifacts. Protection and zero bypass entries remained unchanged. |
| Current Production baseline | Authenticated API confirms replacement deployment `dpl_EbD9g6ZD3WaS2x2BsDrZ87pT2YHd`, old main source `574ca8cc0070caefd99ee52743cad3b2bbe45ba4`. It remained unchanged through both checks. |
| Single real generation | **PASS**, one UI action / one generation POST on fresh protected Preview `https://afterhours-auwid1h3y-sam-3b2d.vercel.app`, deployment `dpl_G3Q8QUSfaFfLAcLUp68ffqBJamuK`, same verified source `8892db227839b0cc7f35e0846bca75cdc7058973`. Application HTTP 200; exactly **2 Gemini requests and 1 Qloo ranking**, no probe, retry, revision or replacement. |
| Render, edits and Apply | Valid proposal rendered in **5,028 ms**; selected Guide and edited title/notes remained unchanged until explicit Apply. Apply selected **The Namesake** and populated its proposed title, materials and invitation. Desktop and 390px full-page captures were inspected; mobile document/body width both 390px, no horizontal overflow or observed clipping. |
| Final pause | **PASS** at `https://afterhours-25xbnm1pa-sam-3b2d.vercel.app`, deployment `dpl_7KPtAWQVHeydVrfa3bxrgp2bf9uA`, same full source `8892db227839b0cc7f35e0846bca75cdc7058973`, Ready/Preview. HTTP 503 `LIVE_DISABLED`, one failed pre-store admission trace, **0 additional Gemini/Qloo/Redis dispatches**, Guide selection/title preserved. Anonymous GET still returns 302 to SSO. |
| Enabled-deployment cleanup | **COMPLETE**. The organizer confirmed deleting only `dpl_G3Q8QUSfaFfLAcLUp68ffqBJamuK`. A subsequent authenticated, complete project deployment list (six entries, no next page) corroborated that it is absent and the final paused deployment remains Ready. Production, protection, other six variables and the final switch-update metadata remain unchanged. The earlier CLI deletion timeout was not retried. No API 404 is claimed. |

### Actual live proposal and numerical evidence

Frozen inputs: sample catalogue, Example A (Amélie, 2001 + Norah Jones),
maximum INR 450, maximum 400 pages, Bengali/English/Hindi, 45 minutes. The
proposal selected **The Namesake — Jhumpa Lahiri**, illustrative price INR 450,
304 pages, English, stock 15. The title was **Interactive Reading and Paired
Discussion**. Its agenda was Welcome 5, Paired Discussion 25, Reflection 10,
Closing 5: **exactly 45 minutes**.

The response reported **3 assessed / 6 eligible / 3 supported** books. Actual
selected-book evidence was:

| Evidence / reference | Returned value |
| --- | --- |
| Qloo affinity, `affinity:the-namesake` | `0.7179884704476631` |
| Amélie input contribution, `contribution:the-namesake:B7A0731F-EC92-496A-9C40-47D9770489B6` | `0.6219156325588995` |
| Norah Jones input contribution, `contribution:the-namesake:CFB97CDA-1B2D-4F1A-B707-415E76AFC016` | `0.3780843674411006` |

All three evidence references belonged to the selected eligible book and were
validated against the current run. These are provider values, not probabilities
or proof of recommendation quality. No position or full ordering is inferred
from the selected-book evidence. The proposal retained the warning that
activities and invitation wording are Gemini proposals, not Qloo evidence or
verified literary facts. Expected configured model is `gemini-3.5-flash-lite`;
the Sensitive environment value and upstream model/status metadata were not
exposed in the public response. Successful native tool execution and validated
output are observed independently of that configuration label.

### Actual live timing and request accounting

| Observed stage | Outcome | Elapsed |
| --- | --- | --- |
| Shared usage admission | Completed | 55 ms |
| Initial Gemini pacing | Completed | 12 ms |
| First Gemini request / native tool call | Completed | 761 ms |
| Fresh eligible-book Qloo ranking | Completed | 60 ms |
| Continuation Gemini pacing | Completed | 5 ms |
| Second Gemini request / proposal | Completed | 1,776 ms |
| Proposal validation | Completed | 5 ms |
| Response received, measured from browser action start | HTTP 200 | 4,978 ms |
| Valid proposal rendered | Completed | 5,028 ms |

Observed admission/pacing time totals **72 ms**; this excludes untraced lease
cleanup and other overhead. Loading was observed at 963 ms from automation
action start, including Playwright click/scroll overhead; Generate/Revise were
disabled and Cancel was available while pending. No deadline fired.

Exact task provider totals are **2 Gemini requests / 1 Qloo ranking**, under the
three/one maximum. Both pause and controlled fixture checks sent zero provider
requests. Live Redis admission and both pacing operations succeeded; the public
response does not expose total Redis HTTP dispatch count or an individual
lease-release acknowledgment, so neither is invented. The isolated Redis
diagnostic remains the earlier nine-request PASS and was not repeated.

One successful hosted generation and Apply establishes this bounded acceptance
journey, not sustained performance, provider quota availability, recommendation
quality or anonymous public reliability. The observed 5.028 seconds meets the
earlier 10–15-second per-proposal target for this run only.

### Final pause and cleanup evidence

The organizer restored the scoped Preview switch to false and redeployed the
same source. The final pause browser check passed independently of the initial
pause result and forwarded one real application POST, with zero provider/store
dispatches. The switch's metadata update preceded creation of the fresh paused
deployment. Current project metadata still preserves the other six environment
entries, original protection/no-bypass configuration and the replacement
Production baseline. Local `.env.local`, main and Production were not changed.

Ignored evidence: `pacing-final-pause.json`,
`release-final-pause-verification.json` and
`release-cleanup-after-timeout.json` under `artifacts/playwright/`. No CLI
deletion retry or extra provider request was made after the cleanup uncertainty.
The organizer then confirmed deletion in the dashboard. The complete
authenticated deployment list corroborated absence of only that task-created
enabled deployment, while the final paused Preview remained Ready. The resolved
result is retained in `artifacts/playwright/release-cleanup.json`; this records
dashboard confirmation and list corroboration, not an invented HTTP 404.

The final documentation review covers **eight Markdown files**, **59 local
links**, balanced code fences, no configured-credential matches and a passing
`git diff --check`. These changes update verification, release readiness and the
submission draft only. No application code, dependency, local configuration,
main or Production setting changed. The documentation checkpoint is made after
verified pause and cleanup; its SHA is separate from the tested application
source `8892db2`. Git is connected, so the normal branch push can create a new
paused documentation Preview; it is not relabelled as the tested deployment.

Reports: ignored `playwright-report/index.html`, `test-results/results.json`,
`artifacts/playwright/pacing-initial-pause.json`, and
`artifacts/playwright/release-controlled-verification.json`. Representative
mobile attachments are in the event-agent 390px proposal and usage-controls
continuation-pacing test directories under `test-results/`. These are controlled
fixtures, not live provider observations. No local application suite or Redis
diagnostic was repeated. All pending documentation remains preserved; no commit
or push occurs while the Preview switch is temporarily true.

Live evidence is separately ignored at
`artifacts/playwright/event-agent-pacing-hosted-results.json`, with captures
`event-agent-pacing-hosted-applied-desktop.png` and
`event-agent-pacing-hosted-applied-mobile-390.png` in that same directory. These
contain the actual successful live proposal, not controlled provider fixtures.

## Earlier blocked attempt

### Target and observed state

This record supersedes the earlier deployment handoff's pending-Git and
pending-variable inventory. Application features remain frozen. The checkout
is clean on `feat/event-agent` at
`8892db227839b0cc7f35e0846bca75cdc7058973` before this documentation update.

The organizer reports a **Ready / Preview** deployment from that exact source:

- Deployment-specific target: <https://afterhours-otv2z3euy-sam-3b2d.vercel.app>.
- Branch alias: <https://afterhours-git-feat-event-agent-sam-3b2d.vercel.app>.
- Existing project: [sam-3b2d / afterhours](https://vercel.com/sam-3b2d/afterhours).
- Git is connected; all seven required settings show **Preview → feat/event-agent**.
- Preview protection remains enabled; the initial live switch is intended to be false.

These are organizer-provided dashboard observations. Authenticated deployment
metadata and effective runtime behavior have **not** been independently
verified in this attempt. Variable presence or a Ready badge does not establish
correct values, a paused runtime, provider authentication, or store access.
The immutable deployment URL, rather than the moving alias, is the test target.

**Production correction:** while connecting Git, the organizer redeployed
Production from old main
`574ca8cc0070caefd99ee52743cad3b2bbe45ba4`. The Production deployment changed;
its source stayed at the old main version. The preceding deployment ID in older
records is historical, not the current baseline. This acceptance attempt made
no Production changes. The replacement deployment ID is not independently
observable because the metadata request below failed.

### Actual execution and blocker

| Operation | Observed result |
| --- | --- |
| Local Git inspection | Expected branch and source `8892db2`; no pre-existing working-tree changes. |
| GitHub read-only verification | Remote feature hash `8892db227839b0cc7f35e0846bca75cdc7058973`, remote main `574ca8cc0070caefd99ee52743cad3b2bbe45ba4`; repository private. PR #3 is OPEN, draft, MERGEABLE / CLEAN, with successful Vercel and Vercel Preview Comments checks. These are deployment/check reports, not application acceptance. |
| Dashboard control inventory | `apps: []`, `browsers: []`; no controllable dashboard target. This does not mean standalone Playwright is unavailable. |
| Read-only Vercel deployment/project inspection | No usable response. A subsequent bounded deployment read reached the 45-second wrapper deadline and was terminated with `SIGTERM`. No deployment or environment write was attempted. |
| Same-project development OIDC acquisition through pinned CLI 64.5.0 | Reached the 45-second wrapper deadline, `SIGTERM`; no token was obtained, displayed, or persisted. |
| Credential-free Node GET to the deployment-specific origin | `UND_ERR_CONNECT_TIMEOUT` after **10,717 ms**, before an HTTP status. Redirects disabled; 15-second outer bound. |
| Organizer's own PowerShell connectivity check | Organizer reports the same `UND_ERR_CONNECT_TIMEOUT`, without an HTTP status. No elapsed time was supplied. This separately confirms the reported failure in their terminal; its network cause is still unknown. |
| Deployment-specific live-switch visibility | Organizer reports **not visible** in the deployment dashboard. The effective value remains unverified; the branch setting and Ready status cannot substitute for the paused-response check. |
| Credential-free Windows HTTP HEAD to the same origin | Failed without an HTTP status; this does not establish an authentication rejection or its underlying cause. |
| Provider / store dispatch | **0 Gemini, 0 Qloo, 0 Redis requests**. No application API POST was sent. |

Connection failure precedes application authentication, so it is not evidence
that any configured key, Redis credential, or protection setting is wrong.
No OAuth refresh workaround, copied browser cookie, public test bypass,
fabricated hosting flag/header, or alternative provider request was used.
Failed CLI deployment/environment-write paths were not repeated. No Redis
diagnostic was repeated and no application counter was inspected or reset.

### Acceptance status

| Check | Status / evidence |
| --- | --- |
| Deployed source and Preview environment | **UNVERIFIED independently**; organizer reports source `8892db2`, Ready, Preview. |
| Exact paused response | **UNVERIFIED**; no application request sent. PASS requires HTTP 503, `LIVE_DISABLED`, usage 0/0, and the failed pre-store admission trace. Missing provider configuration is a different failure and cannot pass this check. |
| 56 controlled hosted Chromium regressions | **UNVERIFIED / not run**; secure test authentication and target connectivity were blocked before launch. |
| Hosted edit preservation, explicit Apply, cancellation, pacing/limit errors, keyboard and 390px layout | **UNVERIFIED** on this release deployment. Source review found all five spec files use the guarded fixtures; unmocked provider routes are blocked. This is not a browser-test PASS. |
| Single live generation, current-run Qloo evidence and coverage, 45-minute agenda | **UNVERIFIED / not attempted**. |
| Admission/pacing/provider/validation timings and rendered latency | **UNVERIFIED**; the connection duration above is not proposal latency. |
| Final paused runtime and temporary enabled deployment cleanup | **UNVERIFIED pause**; no switch was changed and no enabled deployment was created, so there is no task-created enabled deployment to delete. |

Reuse the unchanged application's recorded lint, TypeScript, production build,
**289 Node tests** and **56 local production Chromium tests**. The passing
Redis-only check used nine of ten permitted requests and confirmed temporary
cleanup; do not repeat it. Neither result establishes current hosted behavior.
No new hosted screenshot or Chromium report was generated. Sanitized local
connection metadata is ignored under `artifacts/playwright/`.

The seven documentation files passed local-link checks (**49 links**), balanced
code-fence checks, a private comparison against the configured credential values
(no matches), and `git diff --check`. PR #3's description was updated with the
current evidence, zero request totals and the remaining gates; it stays draft
and unmerged. The documentation commit/push is held pending the required paused
runtime gate. No Git push or resulting deployment was triggered by this attempt.

The protected test workflow keeps the OIDC credential only in Node memory,
never browser headers, cookies, screenshots or traces. It forwards no invented
visitor identity headers. The guarded live helper reserves its result file
exclusively before execution and permits one exact-origin generation POST.
The pause helper now retains any unexpected usage before assertions, with
separate initial/final ignored results. Those local helper changes are test
preparation, not a new application feature or evidence of execution.

### Resume handoff — keep paused

1. In the existing Vercel deployment, confirm the **deployment's** non-secret
   `AFTERHOURS_LIVE_ENABLED=false`, source `8892db2`, Preview environment and
   protection. Do not recreate the project or change Production. Project
   settings alone do not change the environment of an older deployment.
2. The organizer completed the following credential-free check in their own
   PowerShell and reported `UND_ERR_CONNECT_TIMEOUT`. Do not repeat it unchanged
   on the same connection. Resolve target connectivity first; a single comparison
   on another available network can help isolate a network-specific failure.
   The command is retained for that comparison, not as another live-agent probe:

   ```powershell
   node -e "fetch('https://afterhours-otv2z3euy-sam-3b2d.vercel.app',{redirect:'manual',signal:AbortSignal.timeout(15000)}).then(r=>console.log(r.status)).catch(e=>console.log(e.cause?.code||e.name))"
   ```

   An HTTP 401/403 or SSO redirect demonstrates reachability and retained
   protection, not AfterHours browser functionality. A connection error still
   requires resolving Node/Vercel connectivity (network, VPN/proxy or outbound
   access as applicable); repeated logins, secret changes and disabling Preview
   protection do not diagnose this observed transport failure. No specific
   network cause has been established.
3. Once the secure Node transport works, obtain the same-project development
   identity privately using the existing workflow. Verify exact paused behavior,
   then run all 56 controlled hosted checks with zero provider calls. Do not run
   the suite anonymously or place an authentication token in command arguments.
4. Only after both gates pass, change **Preview → feat/event-agent** live to
   true in the dashboard and create a **fresh protected Preview of the same
   source commit**. Record its immutable URL and deployment ID. **Do not push
   while true**: Git pushes now trigger deployments.
5. The remaining authorized budget is still **exactly one generation attempt**:
   Example A, INR 450, 400 pages, all sample languages, 45 minutes. First select
   The Guide and edit title/notes. Maximum **three Gemini requests and one Qloo
   ranking**, no probes, retries, revisions or replacement attempts. Preserve
   edits until explicit Apply. Record actual usage (unknown is not zero),
   current-run evidence, coverage, agenda total, stage timings, render latency
   and Apply outcome. Stop live work on failure.
6. Restore the branch Preview switch to false, create a fresh paused Preview
   and verify the exact zero-provider paused response. Only then remove the
   positively identified temporary enabled deployment. Older deployments keep
   their original settings. Preserve historical deployments and Production.
7. After verified pause, commit/push the completed documentation and update
   [draft PR #3](https://github.com/watchmk25/afterhours/pull/3). Keep it draft,
   unmerged and private. Record any resulting paused documentation deployment
   separately from the tested source SHA.

No final public demo is established by this attempt. Protected acceptance,
final pause/cleanup, reviewed publication, public MIT source detection, fresh
anonymous-demo checks, and final submission URLs remain release gates in
[release readiness](release-readiness.md) and the
[submission draft](devpost-submission.md).
