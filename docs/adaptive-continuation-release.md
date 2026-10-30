# Adaptive public release — 30 October 2026

**PASS: the adaptive book journey is publicly available at <https://afterhours-umber.vercel.app>.** Production remains enabled for judges. The [public source](https://github.com/watchmk25/afterhours) is MIT licensed; external providers/dependencies retain their terms. Final Devpost submission remains the entrant's action. This record supersedes earlier current-status wording about the fallback, without relabelling the [earlier failed release](adaptive-public-release.md).

## Reviewed source and merge

- Tested implementation: `65ba64218f683fea63b9c1a67f9ac2a536fa8497`.
- Reviewed fix head: `614ff1a18ff98aa68d2481ef4af5ea23c00cec9a`; its later change is documentation only.
- [PR #7](https://github.com/watchmk25/afterhours/pull/7) merged normally at **16:35:23 UTC**, source **`385d7ec75990421909af12dc7e782837f66bcaba`**. Its full tree matched the reviewed head. Comparing against the tested implementation found no differences outside README/docs.
- The eight-path diff contains the three bounded deadline runtime changes, focused regressions, README and the deadline record. No model, dependency, provider contract, candidate order/mapping, quota, pacing, cancellation or Apply behavior changed. The 30-second overall limit remains; first request stays at 20 seconds, continuation/repair gets at most `min(28 seconds, remaining − 2 seconds)`. Legacy callers keep 20 seconds. [Exact policy](adaptive-continuation-deadline.md).
- GitHub reported mergeable, no branch rules, Vercel checks successful. CodeRabbit was still an optional in-progress check and no human approval is claimed. The normal merge used the verified head, with no force push or protection override. Local main synchronized by fast-forward, without reset/stash/discard.
- Scan of **139 tracked files** found zero configured-credential matches and no forbidden real environment/generated paths. `.env.local` remained ignored/untracked, local live=false, and the lockfile remained tracked. No new confirmed leak, rotation or history rewrite was involved; this is not a new exhaustive historical-secret audit.

## Baseline and paused Production

The accepted rollback was positively recorded and preserved: **`dpl_6FSfbdxAVuuSetqPMddWYU1Bxc2a`**, <https://afterhours-33m2z57jz-sam-3b2d.vercel.app>, source **`910ac80cf08bcfb4e288b418609e83cd841c506f`**. Its Ready state, public alias and source were checked before the merge. It is retained, not the final active demo, and no Production deployment was deleted.

Only the existing Production Config `AFTERHOURS_LIVE_ENABLED` was changed, using exact strings through structured updates. It was read as **false** before merging; Production credentials/model, Redis store/namespace/secret, other environment metadata, existing project `sam-3b2d/afterhours`, Git main configuration and protection were preserved. No Preview credential was copied to Production.

Readable Preview switches for `feat/adaptive-club-planner` and `fix/adaptive-continuation-budget` were independently read as false. The older `feat/event-agent` switch is a write-only Secret: its historical pause proof is reused and its ID/type/update metadata remain unchanged, rather than claiming a new decrypted read. Protection remains `all_except_custom_domains`, with zero bypasses. No Preview was enabled in this task.

Automatic paused Production reached Ready at **`dpl_28Pi42YsM7AEr7buC9mJUBQSdc4h`**, <https://afterhours-r904veytn-sam-3b2d.vercel.app>, source `385d7ec…`. Public alias/source and creation after the configured false snapshot were verified. Anonymous GET returned **200**, adaptive content present; `/api/preview/switch-status` returned **404**. No Generate/malformed request was used as a switch probe.

## Verification actually performed

| Check | Actual result |
| --- | --- |
| Exact merged tree / application comparison | PASS: full merge tree equals reviewed head; no application difference from tested `65ba642…`. |
| Complete controlled anonymous hosted Chromium | **44/44 PASS in 98.551 seconds**, source `385d7ec…`, one worker, no retries/skips/flaky/unexpected results. All application APIs controlled; **0 live Gemini / 0 Qloo / 0 Redis**. |
| Anonymous adaptive page / Production diagnostic | HTTP **200 / 404**, respectively. GET alone is not live acceptance. |
| Unchanged offline/protected checks | **Reused, not rerun:** 380 Node tests; 51 focused provider/deadline checks; lint, TypeScript and production build; 44 local Chromium and 44 protected controlled hosted checks. They cover the identical application source. Vercel separately built the new Production deployments. |
| Public source/license | Anonymous GitHub repository API HTTP **200**, public=true, main default branch and MIT detected. |

## The one new anonymous live acceptance

After controlled checks passed, only Production Config was set to exact **true** and read back. A fresh enabled Production deployment from `385d7ec…` reached Ready: **`dpl_CjAMjG8PzoxNdgU5BP5gimi2FpGi`**, <https://afterhours-q453nmyml-sam-3b2d.vercel.app>. Its public alias, source, target and creation after the true update were checked before the one Generate action.

**PASS: exactly one Generate click and one planning POST**, fresh anonymous Chromium context with empty storage, no login/authentication headers and no response interception/mock. A client-side budget guard only blocked extra application actions; the real native fetch delivered actual server responses. Shared admission, trusted hosted visitor handling, pacing and lease cleanup remained active.

The submitted input was Example A (Amélie + Norah Jones), unrestricted **book discovery**, 45 minutes, group size 12, INR 450 per person, 400 pages, Bengali/English/Hindi, no selected entity, uploaded rows or prior proposal. A local Guide manual template supplied the edited title and notes for preservation checks; it did not restrict discovery. There were no searches, standalone discovery calls, probes, retries, repair, revision or replacement attempts.

The server returned HTTP **200**, reporting **2 Gemini requests / 1 Qloo Insights request**. Current Qloo results contained **eight candidates**. The chosen book was **What I Talk About When I Talk About Running**, ID **`16EA273D-E76A-4C9F-BEE5-FE013489FD26`**, actual returned disambiguation **2007, Haruki Murakami**. Selected membership and all three cited evidence references were checked against that same current response, and the result was replayed through the real proposal validator. No particular book was required.

Actual selected affinity: **0.8395831843212976**. Numerical contributions: **0.5303264245847119** for Amélie and **0.46967357541528815** for Norah Jones. The proposal cited that current affinity and both contribution IDs. These are provider numbers, **not probabilities or invented cultural explanations**. Eight assessed discovery options is not sample-inventory coverage or proof of improved recommendation quality.

The agenda totaled **5 + 15 + 10 + 15 = 45 minutes**: welcome/opening, paired discussion, voluntary reflection, creative response/closing. Title and notes survived preview. Unknown budget, edition pages, language and availability stayed `needs_confirmation`, source `unknown`, with no invented stock/price facts. Explicit conditional acknowledgment was required before Apply. Apply populated all agenda fields, title, format, materials and invitation, retaining notes. The subsequent edited title **AfterHours hosted edited plan** appeared in the real downloaded Markdown with saved context, conditional facts and the scores-not-probabilities label. No stale/historical label was falsely attached to unchanged inputs. Desktop/mobile captures were saved; document/body both measured **390px**, without horizontal overflow.

| Observed stage | Elapsed |
| --- | --- |
| Loading feedback | 51 ms |
| First Gemini pacing | 16 ms |
| First Gemini request | 1,866 ms |
| Fresh Qloo discovery | 92 ms |
| Continuation pacing | 7 ms |
| Second Gemini request | 3,087 ms |
| Validation | 4 ms |
| Planning HTTP 200 response | 5,682 ms |
| Valid proposal rendered | **5,693 ms** |

The continuation finished below the old cap. This success **does not establish the earlier provider latency cause, attribute a speed improvement to the deadline change, prove recommendation quality or establish sustained reliability**. The deterministic offline 21-second transport separately proves the extended budget works. Unseparated admission/cleanup/network time is not reported as measured Redis overhead. Exact Redis request usage during the real run was not instrumented: **unknown, not zero**. No Redis diagnostic was repeated.

## Final deployment and documentation coordination

After success, Production remains enabled as authorized. All Preview settings and protection match the baseline. The accepted fallback remains Ready and preserved; no Production deletion or rollback was needed. Environment changes do not alter old immutable deployment snapshots.

[PR #6](https://github.com/watchmk25/afterhours/pull/6) was deliberately reconciled with current main and this actual outcome before documentation merge; its old failure wording was not merged blindly. The initial failed release remains a dated record. The follow-up contains README/verification/submission text only; its application tree must match the live-tested `385d7ec…`. The documentation-only main deployment is verified by its actual alias, source, Ready state, anonymous adaptive content and diagnostic 404, **without a second generation**. The exact final documentation merge/deployment SHA is reported with the release handoff; the reproducible live-tested application pin above remains `385d7ec…`.

The nine-file documentation review passed **47 local-link/heading checks**, balanced code fences, zero configured-credential matches, no application differences from main and `git diff --check`. Unchanged application suites were not repeated for prose. No generated evidence or local configuration enters this commit.

Ignored evidence under `artifacts/playwright/`: `public-continuation-baseline.json`, `public-continuation-review.json`, `public-continuation-node.json` (explicit reuse proof), `public-continuation-controlled.json`, `public-continuation-controlled-results.json`, `public-continuation-live-attempt.json`, `public-continuation-live-summary.json`, and sanitized screenshots `public-continuation-live-applied-desktop.png`, `public-continuation-live-applied-mobile-390.png`. Raw credentials, headers, prompts, signatures and generated reports are not tracked.

This task's allowance is spent: **2 Gemini / 1 Qloo**, all in its single successful real generation. Only unrestricted book discovery has public live acceptance. Artist/movie/place and shortlist flows remain live unverified; book Markdown export is the demonstrated export. Use the [submission-ready draft and judge walkthrough](devpost-submission.md). Final entry/profile/eligibility review and Devpost submission remain the entrant's action by **31 October 2026, 09:15 IST**. The 29 October internal target has passed. No new live request is authorized by this record.
