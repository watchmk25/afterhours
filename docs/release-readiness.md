# Release readiness

## Current gate — 30 October 2026

The adaptive planner is merged on main at `771202c6ea2d95d9c796b0db72e7547d9e0c8b47` (PR #4/#5). Full Node **373/373** and anonymous controlled hosted Chromium **44/44** passed. The single public adaptive generation then failed with `504 GEMINI_DEADLINE` after **23.064 seconds**, using **2 Gemini / 1 Qloo Insights**; existing edits survived, but no valid proposal/Apply acceptance resulted. No retry ran.

The accepted earlier Production deployment was restored: <https://afterhours-umber.vercel.app>, source `910ac80cf08bcfb4e288b418609e83cd841c506f`, deployment `dpl_6FSfbdxAVuuSetqPMddWYU1Bxc2a`. Main and the public demo now differ. The Production project switch is false for future builds; the active immutable rollback retains its original settings and was not given another live check. Local/Preview remain false and Preview protected. Public repository access and MIT detection were rechecked.

**Remaining release gate:** adaptive public live acceptance, specifically the 20-second Gemini continuation timeout. Protected book acceptance is successful historical evidence; other formats and shortlist flows remain live unverified. Preserve the restored demo when reviewing the documentation follow-up: a main push can trigger a paused adaptive Production deployment. Submit only accurately scoped claims for the actual public version, or resolve and separately reverify the adaptive release before claiming it publicly functional. The internal 29 October target has passed; the official deadline is 31 October at 09:15 IST. [Complete outcome/rollback](adaptive-public-release.md), [submission draft](devpost-submission.md).

## Public release — 25 October 2026

The following gates are historical; the current update above supersedes their deployment/switch status.

**Public-release follow-up — 25 October 2026:** explicit publication is now
authorized. PR #3 was already merged at
`e9b5505de388efdd24a333822fc55c845e49af02`; local main was synchronized safely,
with no tree difference from accepted checkpoint `c553f28`. The repository is
now public, anonymous GitHub access passes and GitHub detects MIT on main.
Production now serves the live app anonymously. A confirmed keyboard/anchor
scrolling issue in the first suite was fixed by removing one global smooth-scroll
property at `06cf158ccd930abfc1f3924ec34649ebd7b15a6d`; no provider logic changed.
Lint, TypeScript, 289 Node tests, production build and all **56 anonymous hosted
checks** passed. The one actual public generation used **2 Gemini / 1 Qloo**,
rendered a validated 45-minute Namesake proposal in **3.652 seconds**, preserved
edits until explicit Apply and applied successfully. Production remains enabled
for judges; local/Preview remain paused and Preview protected.
See [the current public-release record](public-release.md).
Older private/draft/main-release gates below describe the earlier phase and
are superseded by this authorization. Preview must remain protected and paused.

| Current release gate | Actual state |
| --- | --- |
| Public source / main license | Repository public; anonymous access passes and GitHub detects MIT. Project original code is MIT; dependency/provider terms remain applicable. |
| Application release source | `06cf158ccd930abfc1f3924ec34649ebd7b15a6d`, after the minimal keyboard-scroll fix; final documentation checkpoints are separate. |
| Public demo | <https://afterhours-umber.vercel.app> — actual anonymous browser and live proposal/Apply passed. |
| Verification | Lint, explicit TypeScript, 289 Node tests, production build and all 56 unchanged anonymous hosted journeys pass. One public live generation: 2 Gemini / 1 Qloo, 3/6 coverage, exact 45-minute agenda, 3.652-second valid render. |
| Operator state | Production enabled for judges; local and protected Preview paused, shared budgets/pacing preserved. |
| Submission material | Actual URLs/source/license/results filled in the Devpost draft. Unknown team/entrant details remain explicit; final Devpost submission is the organizer's action. |

## Historical protected release — 22 October 2026

**Current hosted follow-up:** see [the acceptance record](hosted-acceptance.md).
Hotspot connectivity restored the secure workflow. Vercel metadata confirms
Ready protected Preview `8892db2`, Git connected and all seven branch-scoped
Preview settings. The actual pause check passed (`LIVE_DISABLED`, usage 0/0),
and all **56 controlled hosted Chromium tests passed in 2.4 minutes**, with zero
live provider/store calls. The single live attempt then **passed** on a fresh
enabled Preview of the same source: **2 Gemini / 1 Qloo**, valid 45-minute
Namesake proposal rendered in **5.028 seconds**, edits preserved until explicit
Apply. A fresh paused Preview then passed with zero additional provider/store
dispatches. The organizer deleted the exact temporary enabled Preview; a
complete authenticated deployment list corroborated its absence and the final
paused Preview's Ready state. The earlier CLI deletion timeout was not retried.
The organizer redeployed Production from old main
`574ca8c`: its deployment changed, source unchanged; the replacement ID is now
verified in the acceptance record. Earlier inventories and IDs below are
historical. No Git push is permitted while the Preview switch is true.

Feature development is frozen. This task changes release documentation and the
project license only. Application code, inventory, mappings, prompts, models,
dependencies, deadlines, credentials, and shared usage policies are preserved.

Internal submission target: **29 October 2026, IST**. Published deadline:
**31 October 2026, 09:15 IST** (30 October, 23:45 EDT).

The event requires an externally published functional demo, public licensed
source with runnable instructions, and project text. Video is optional. The
overview excludes private-access-only demos; a protected Preview and private
repository are preparation stages, not the final submission.
[Overview](https://qloo.devpost.com/), [rules](https://qloo.devpost.com/rules).

### Current gates

| Gate | Actual state |
| --- | --- |
| Reviewed starting checkpoint | `d0739cbf40150d1ebf1051b09cf99eddf193b055` on `feat/event-agent`. Use the final pushed commit reported with this release handoff for deployment. |
| Source ownership and license | Root standard MIT `LICENSE`, copyright 2026 Mousam Kumar, prepared from the user-provided identity and sole Git author. Dependencies/provider services retain their own terms. |
| GitHub privacy / PR | Repository private; PR #3 draft and unmerged. Do not change visibility, merge, or change main in this task. |
| GitHub license detection | API reported `licenseInfo: null` on default branch main before this change. A feature-branch license is not proof of About-page detection; verify after a separately authorized main release. |
| Source/history review | See [scope, results, and limitations](public-release-review.md). No history rewrite or credential rotation is authorized or performed. |
| Product/setup documentation | Product-first README, committed lockfile and required assets, empty server-only configuration example, local setup and check commands. Detailed chronology remains in linked records. |
| Submission text | [Devpost draft](devpost-submission.md) prepared; final demo/source/release/team fields remain explicitly pending. Nothing has been submitted to Devpost. |
| Current protected hosted release | Verified application source `8892db227839b0cc7f35e0846bca75cdc7058973`: initial pause, all 56 controlled hosted checks and one real generation **PASS**. Final protected paused Preview is `afterhours-25xbnm1pa-sam-3b2d.vercel.app`; the temporary enabled Preview has been removed. |
| Current hosted live generation / Apply / timings | **PASS**: one real generation, **2 Gemini / 1 Qloo**, current-run evidence for **3 of 6 eligible books**, exact 45-minute agenda, valid preview in **5.028 seconds**, preserved edits and explicit Apply. Final pause and temporary enabled-deployment cleanup completed. |
| Hosted pause | **PASS initially and after live acceptance**: fresh final `afterhours-25xbnm1pa-sam-3b2d.vercel.app`, same source `8892db2`, HTTP 503 `LIVE_DISABLED`, zero Gemini/Qloo usage and pre-store rejection. Anonymous requests still redirect to SSO. |
| Public demo / source | **Not released**. Historical production is not the current live-agent release. |

GitHub confirmed `watchmk25/afterhours` is private, the current user has ADMIN
access, and main remains `574ca8cc0070caefd99ee52743cad3b2bbe45ba4`. GitHub
reported PR #3 `MERGEABLE` / `CLEAN`, with no status-check rollup at the initial
release review. Recheck after the final push; mergeability does not replace
release verification or authorize merging.

### Verification reused and performed

Unchanged application code reuses the recorded PASS for lint, explicit
TypeScript, production build, **289 Node tests**, and **56 local production
Chromium tests**. Routine fixtures made zero live provider calls. These suites
are not rerun or relabelled as new hosted results for documentation/license
changes.

The extended Redis-only diagnostic already passed once: **9/10 maximum
requests**, all HTTP 200, with cleanup acknowledged and confirmed. It is not
repeated. No application counter is inspected or reset. Account-owned Free-plan
and disabled-eviction settings remain unverified without management access.

This release review checks documentation links/whitespace, standard license
text and attribution, required tracked files, and reachable Git history/current
content for credential/private-artifact indicators. See the public-release
review for exact scan scope. Known dependency-tooling findings remain recorded
in [the historical dependency audit](dependency-audit.md); this task does not
run a fresh audit, claim current vulnerability freedom, or upgrade dependencies.

Actual release-only checks passed: **11 required files**, **40 local file links
across five Markdown files**, balanced code fences, manifest/lockfile agreement,
empty secret examples, no current-credential match in the six release materials,
and `git diff --check`. The saved feasibility verifier also passed with global
fetch disabled: the existing 15-request historical ledger, four eligible mapped
books, and both A/B ranking records remain consistent. Those 15 ledger entries
are historical; this verification made **zero new requests**.

### Dashboard blocker and single handoff

The following is the earlier pre-deployment handoff, retained as history. Its
missing-Git/variable inventory and blockers are superseded by the current
[successful protected acceptance record](hosted-acceptance.md).

The available computer/browser inventory returned **`apps: []`, `browsers: []`**.
There is no enabled dashboard target to control in this session. No browser
connection, login, repository connection, environment write, or deployment was
attempted after that inventory. Failed CLI deployment/environment-write paths
are not repeated.

The last successful Vercel metadata read during the preceding handoff showed:

- Existing project `sam-3b2d/afterhours`, ID `prj_o1f7kfh65mfLH0RSIho0xsuGwwjr`.
- No Git connection and no persistent project environment variables.
- Next.js preset, Node 24.x, Fluid compute/basic build machine.
- Vercel Authentication protection `all_except_custom_domains`, no bypasses.
- Production deployment `dpl_CCyx4UYTePv5iScyMoCUQcWd4mGJ`, source
  `574ca8cc0070caefd99ee52743cad3b2bbe45ba4`.

These are last-confirmed details, not a fresh dashboard read. Verify them before
acting. The two prior environment-write attempts failed; their final metadata
read still showed zero variables. **Settings are prepared, not uploaded.**

Use the existing [Git Preview handoff](git-preview-deployment.md):

1. Open [the existing project](https://vercel.com/sam-3b2d/afterhours), then
   **Deployments → Create Deployment**. If needed, connect only private
   `watchmk25/afterhours` through this project's Git settings. Keep Production
   branch main and protection enabled; do not import a second project.
2. Before creating the deployment, add existing values as **Secret** variables
   under **Preview → feat/event-agent** only: `GEMINI_API_KEY`, `QLOO_API_KEY`,
   `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and
   `AFTERHOURS_USAGE_SECRET`. Preserve existing values; copy directly from the
   local editor, never into chat or commands. Add Config
   `GEMINI_MODEL=gemini-3.5-flash-lite` and `AFTERHOURS_LIVE_ENABLED=false`.
   Leave Production/Development unchecked. No manual Vercel flags or identity
   headers are needed.
3. Create **Preview** from the exact final pushed feature commit in this
   handoff. Verify its displayed SHA, branch, environment, Ready status, protected
   access, and unchanged production source. Share only URL and source SHA.

### Acceptance after the protected Preview is available

This bounded sequence has now completed against source `8892db2`, including
final pause and cleanup. The original one-generation budget is spent. The
runbook below does not authorize another live attempt.

1. Run the existing controlled hosted Chromium suite first, with **zero live
   provider calls**, using the documented secure Node-only protection transport.
   Record deployed SHA and reports; do not infer anonymous access from it.
2. Only after controlled checks pass, create a temporary enabled protected
   Preview and perform **exactly one real UI generation**: Example A, INR 450,
   400 pages, all sample languages, 45 minutes. Select The Guide and edit the
   title/notes beforehand. Maximum **three Gemini requests and one Qloo ranking**
   total; no separate search/rank/probe, retry, revision, or replacement attempt.
3. Record actual admission/pacing/provider/validation stages, coverage, evidence,
   agenda total, rendered latency, request usage, preserved edits, and explicit
   Apply. Do not force a particular selected book. Stop live work on failure;
   preserve sanitized evidence and distinguish unknown usage from zero.
4. Restore Preview live=false, create and verify a fresh paused deployment using
   the existing zero-provider procedure, then remove only the validated
   task-created enabled deployment. Old deployments retain their environment;
   a settings change alone does not pause them. Leave the protected Preview
   paused and main/production unchanged.

### Remaining public-release steps after review

These are future actions requiring the separate release decision. No visibility
or protection change is made here.

1. Retain the completed protected acceptance and pause evidence above. Review the
   source/history findings, commit-author metadata disclosure, asset/provider
   rights, existing dependency findings, store ownership/Free/eviction settings,
   issuer quotas, and operator monitoring. Do not imply shared limits establish
   a hard spending cap or cover other applications using the same providers.
2. Approve the exact release snapshot. Merge PR #3 normally only after applicable
   checks/rules permit; do not bypass protections or force-push. Then make the
   reviewed repository public and verify GitHub detects MIT on its default
   branch/About section. `package.json` private=true is an npm publishing guard,
   not GitHub visibility.
3. Authorize and publish the tested agent build as the final external demo,
   with server-only credentials and reviewed shared controls. Verify anonymous
   access in a fresh context, correct source SHA, and controlled browser journeys.
   Keep the protected test Preview separate. Additional live verification beyond
   this task's single generation requires an explicitly renewed request budget.
4. Replace all pending demo/repository/source/team fields in the Devpost draft
   with actual release details. Ensure the intended end-to-end live features are
   available, not paused or replaced by historical results. Plan judged access
   and provider allowances through the judging period; document honest limits.
5. Review and submit in English by **29 October IST** internally. Confirm final
   submission receipt before **31 October, 09:15 IST**. A video is optional and
   cannot substitute for the functional external demo. No Devpost account,
   eligibility declaration, legal acceptance, or final entry is submitted here.
