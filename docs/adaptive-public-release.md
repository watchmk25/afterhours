# Earlier adaptive public release attempt — 30 October 2026

**Historical failure record.** A later, separately authorized release of the bounded continuation fix passed anonymous public acceptance at `385d7ec75990421909af12dc7e782837f66bcaba`, using 2 Gemini / 1 Qloo and rendering in 5.693 seconds. Production now serves the adaptive application enabled for judges; the fallback below is retained for rollback. See the [current release](adaptive-continuation-release.md) and [current submission draft](devpost-submission.md). Deployment/switch instructions and blockers below describe this earlier failed attempt, not the final state. Its 20-second timeout remains evidence; the underlying latency cause is still unknown.

**Outcome: controlled release checks passed; the single anonymous adaptive live acceptance failed. The earlier accepted public deployment was restored.** No retry, replacement attempt, model change, budget increase or automatic fallback was used.

Public demo: <https://afterhours-umber.vercel.app>. Public source/MIT license: <https://github.com/watchmk25/afterhours>. Main contains the adaptive source; the restored public demo runs the earlier book workspace. These are intentionally different after the failed acceptance. The [Devpost draft](devpost-submission.md) separates the two journeys and does not claim a successful public adaptive release.

## Reviewed and merged source

| Checkpoint | Source and scope |
| --- | --- |
| Previously protected-live-tested application | `12c123511d060611de7c209f81c3db23829daf1a`; one successful unrestricted-book proposal, Apply and edited-plan download. |
| Reviewed feature head | `6be0ce406fbc380c6d4edb017bcb4a1373579f3c`; later changes from the protected tested source are documentation. |
| Adaptive merge, PR #4 | `4eaaea1c1baa4a7ef67b4a20163cc92da6cb1e6c`, merged normally at 15:16:50 UTC. Tree matched the reviewed feature head. [PR #4](https://github.com/watchmk25/afterhours/pull/4) |
| Test-only clock correction | `c7aa7d82d82af40799c4fa8354fb0709581db4db`; only `e2e/qloo-matching.spec.ts`. |
| Final release source, PR #5 | `771202c6ea2d95d9c796b0db72e7547d9e0c8b47`, merged normally at 15:28:27 UTC. No application changes from PR #4. [PR #5](https://github.com/watchmk25/afterhours/pull/5) |
| Restored accepted public source | `910ac80cf08bcfb4e288b418609e83cd841c506f`; application files match the historical public-live-tested `06cf158ccd930abfc1f3924ec34649ebd7b15a6d`. Differences are README/release documentation only. |

The complete main-to-feature review covered 44 paths, including the adaptive UI/state, server tools, validation, CSV/resource handling, book-plan export, Preview switch diagnostic, tests and workflow records. Provider contracts, pinned dependencies/model, reviewed mappings and shared usage policy were preserved. `lib/usage-runtime.ts` delegates the same exact-string comparison to the shared server-only evaluator; missing, false, whitespace or quoted values remain disabled. The diagnostic is Preview-only and uncached, not provider readiness or an admission bypass.

The 137 tracked files at the reviewed checkpoint contained no configured credential matches or forbidden real-environment/generated-artifact paths. `.env.local` remained ignored/untracked and the lockfile remained tracked. No new confirmed credential leak was found; no credential was rotated or history rewritten. This task's exact-value/tracked-path scan is not a claim of a new exhaustive historical-secret audit; the earlier history review remains dated in its own record.

GitHub anonymous repository API access returned HTTP 200, `private: false`, and MIT license detection. Original code remains MIT; third-party/provider terms are retained. PRs #4 and #5 were merged normally, with no force, administrator override, history rewrite or branch deletion. No required checks or branch protection were configured. Vercel deployment checks passed; an optional CodeRabbit check was still in progress at merge, and no completed human review is claimed.

## Production configuration and paused checks

Only the Production `AFTERHOURS_LIVE_ENABLED` setting changed. Its old write-only Secret was replaced with a Config entry so the literal could be verified, using supported environment tooling. Exact `false` was read back before releasing. Production credentials/model, Redis store/namespace/secret/budgets, all Preview variables, `main` as Production branch, project/team and protection policy were preserved. No credentials were copied from Preview to Production or printed. Existing Vercel project: `sam-3b2d/afterhours`; no new project, paid resource or domain was created.

Environment updates affect new deployments, not existing immutable snapshots. The production-only diagnostic returned **404**. Anonymous page access returned **200** and served the adaptive workspace before the controlled suite. No Generate request or malformed planning input was used as a configuration probe.

| Deployment | Target/source | Purpose |
| --- | --- | --- |
| `afterhours-b7von5x8e-sam-3b2d.vercel.app` / `dpl_B2vDaagiWAXbZsRtTtUMTx3Njmit` | Production, `4eaaea1…`, paused | Initial merged source; first controlled suite. |
| `afterhours-gb2ptubzx-sam-3b2d.vercel.app` / `dpl_4Nz8WwoxV1PfyCD8GteHy7rS6GGA` | Production, `771202c…`, paused | Final 44/44 controlled suite. |
| `afterhours-fylwn4ccx-sam-3b2d.vercel.app` / `dpl_G5rdeYWHJaJdRAScBfCWu8Dx4bgf` | Production, `771202c…`, enabled snapshot | Exactly one anonymous live attempt; no longer the public alias. |

## Verification

- Full Node suite on initial merge: **373/373 PASS**. Rerun on final `771202c…`: **373/373 PASS**, approximately 13.45 seconds including the wrapper. Controlled transports, zero live Gemini/Qloo/Redis requests.
- Initial anonymous hosted Chromium suite on `4eaaea1…`: **43 PASS / 1 FAIL**. The debounce test installed Playwright's clock without pausing it. The trace showed 82.335 ms between the Unicode fill starting and the explicit 474 ms advance, crossing the actual 475 ms debounce threshold. This established a test timing defect, not a product debounce defect.
- The test now installs the clock before navigation and pauses it before timed interaction. Every original assertion and fixture remains intact. The focused journey passed **1/1 in 4.3 seconds**. Lint and `tsc --noEmit --incremental false` passed after this test-only change.
- Final complete anonymous hosted Chromium suite on `771202c…`: **44/44 PASS in 98.007 seconds**, one worker, no retries, skips, flaky or unexpected results. This includes setup, current-run evidence, revisions, explicit selection/Apply, edit preservation, export contents, provider/pacing failures, cancellation/late responses, keyboard controls and 390px layout. API fixtures and the network guard prevented live provider/store dispatch: **0 Gemini / 0 Qloo / 0 Redis**.
- The previously passing lint, TypeScript and production build for unchanged application source are reused. No application change followed that build; the clock fix changes one E2E test only. This is not a claim that the build was rerun in the release task. Vercel separately built the release deployments successfully.
- The already-passing isolated Redis diagnostic and protected acceptance were reused, not repeated. The seven-file documentation follow-up passed **39 local-link/heading checks**, balanced code fences, zero configured-credential matches and `git diff --check`, rather than repeating unchanged application suites.

## Single anonymous live attempt

After the controlled gate, Production Config was updated through structured JSON to exact `true`, read back, and a fresh Production deployment from `771202c…` was created. The public alias and source were verified before the one browser action. The browser had fresh storage, no authentication/bypass headers and no provider-response interception. The actual submitted input was checked:

- Reviewed Example A: Amélie (2001) + Norah Jones, with existing confirmed preset references.
- Unrestricted discovery, primary focus book; no chosen candidate, selected imported rows or historical proposal.
- 45 minutes, group size 12, INR 450 per person, maximum 400 pages, Bengali/English/Hindi.
- A manually edited title and organizer notes were present before generation. The Guide template used to prepare those edits did not restrict discovery.

**FAIL: one Generate click and one application planning POST returned HTTP 504, code `GEMINI_DEADLINE`, message “Gemini did not complete within the request deadline.”** The server reported **2 Gemini requests / 1 Qloo Insights request**. Native tool execution reached and completed fresh Qloo discovery, then the second Gemini request reached its unchanged per-request deadline. No third request, repair, retry, standalone lookup, revision or replacement was sent.

| Observed stage | Elapsed |
| --- | --- |
| Loading feedback | 40 ms |
| First Gemini pacing | 15 ms |
| First Gemini request | 2,463 ms, completed |
| Fresh Qloo discovery | 111 ms, completed |
| Continuation pacing | 4 ms |
| Second Gemini request | 20,001 ms, failed |
| Application error response | 23,064 ms from action |

The provider wrapper races its bounded operation against the request abort timer; `lib/club-agent.ts` supplies `min(20,000 ms, remaining overall budget)`. The code and timing identify the **20-second Gemini request deadline**, not the 30-second overall deadline. The underlying reason the continuation did not finish is **unknown**; no upstream HTTP status or provider rejection was supplied. Do not infer invalid credentials, quota exhaustion, truncation or a particular generated response. The first Gemini and Qloo operations completed; no additional probe was authorized or made.

The browser verified that the existing edited title and notes remained intact after failure. No valid public adaptive proposal was returned. Candidate ordering, selected-book/evidence membership, exact generated agenda total, explicit AI Apply and subsequent edited-plan export are **UNVERIFIED in this public attempt**, not failed assertions against an invented result. The paused controlled suite and earlier protected live success are separate evidence. Redis was used through normal admission/pacing/cleanup, but its exact request total was not instrumented; it is **unknown, not zero**.

Sanitized local screenshot: `artifacts/playwright/adaptive-public-live-stopped.png`, visually inspected for the clear timeout state and retained draft. Minimal counts/stage evidence: `adaptive-public-live-attempt.json` and `adaptive-release-live-summary.json` in the same ignored directory. No raw response, prompts, signatures, keys, auth headers or private catalogue were committed.

## Restoration and final state

The failure path restored the Production project Config to exact **`false`** and verified readback. That change alone could not pause the already-built enabled snapshot. The initial CLI rollback exited 1; a read-only alias check proved it had not restored the old target. [Current Vercel documentation](https://vercel.com/docs/deployments/rollback-production-deployment) limits Hobby rollback to the immediately previous Production deployment. The specific CLI error body was not retained, so that documented restriction is not presented as a captured error message.

The supported [`vercel promote`](https://vercel.com/docs/cli/promote) operation then successfully restored the preserved, already-built accepted Production deployment. Independent project and alias reads agreed:

- Public alias: **<https://afterhours-umber.vercel.app>**.
- Active immutable deployment: **<https://afterhours-33m2z57jz-sam-3b2d.vercel.app>**, `dpl_6FSfbdxAVuuSetqPMddWYU1Bxc2a`.
- Active source: **`910ac80cf08bcfb4e288b418609e83cd841c506f`**, target Production, Ready.
- Provider-free anonymous GET after restoration: **200**, AfterHours and the older eligible-book workspace present; adaptive heading absent. Preview-only diagnostic: **404**. These GETs verify routing/content, not new live functionality.
- Production **project setting** is false for future builds. The restored immutable deployment retains its original environment snapshot; its earlier enabled/live acceptance is historical and was not probed again. Do not describe it as newly runtime-paused because the project setting is now false.
- Local switch and branch-scoped adaptive Preview Config both verified **false**. Existing paused Preview `afterhours-r1wb4s5ra-sam-3b2d.vercel.app` remains protected; anonymous access returned **302** to Vercel SSO. Its provider-free runtime pause proof is reused from the protected record.
- Protection remains `all_except_custom_domains`, with zero bypass entries. Other credential/model/environment metadata match the saved baseline. No historical or Production deployment was deleted, including the preserved rollback target.

The full task used **2 Gemini / 1 Qloo Insights** live requests, all in the one spent public generation attempt. Controlled suites and restoration GETs added none. No separate Redis diagnostic ran. No model, quota, deadline, provider integration or admission policy was changed to obtain a pass.

### Documentation handoff

The final documentation is committed on a separate follow-up branch/PR rather than pushed to main: a Git-connected main push could automatically publish the paused adaptive code and replace the restored accepted demo. Do not merge that follow-up merely to update text without coordinating the deployment outcome. Main remains at `771202c…`; the code merge is complete, while adaptive public acceptance is not.

Before another adaptive public acceptance, obtain a new explicit live allowance and investigate continuation latency offline from retained evidence. No new call is authorized by this record. Artist/movie/place/shortlist live acceptance and non-book Markdown export remain outside the verified scenario. Shared controls do not establish provider capacity, TPM enforcement, a financial cap, recommendation quality or sustained reliability.

For submission now, use the restored book workspace and accurately scoped historical evidence, or resolve and reverify the adaptive public release separately before claiming it as the functional demo. The published deadline remains **31 October 2026, 09:15 IST**; final submission is the entrant's action. See the [completed draft and remaining steps](devpost-submission.md).
