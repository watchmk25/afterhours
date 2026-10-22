# Git-based protected Preview handoff

The organizer confirmed that CLI 64.5.0 `deploy --dry --json --target preview`
also fails in their own PowerShell with `TypeError: fetch failed`. Use Vercel's
Git/dashboard deployment path instead of repeating that upload attempt.

## Reviewed source and existing project

- Repository: private `watchmk25/afterhours`.
- Feature branch: `feat/event-agent`, already pushed; PR #3 stays draft and unmerged.
- Application checkpoint before this documentation: `067f2fc3fcb2f814341c5981e50820554e87b187`.
  The pacing implementation is `93b7ba0bd87318c141c7aada94452c56bdee443b`.
- Existing project: [sam-3b2d / afterhours](https://vercel.com/sam-3b2d/afterhours),
  ID `prj_o1f7kfh65mfLH0RSIho0xsuGwwjr`.
- Observed Git connection: none. Connect this project to the existing repository;
  do not import a second project.
- Observed protection: Vercel Authentication `all_except_custom_domains`, no
  protection bypasses. Leave protection enabled.
- Production remains deployment `dpl_CCyx4UYTePv5iScyMoCUQcWd4mGJ`, source
  `574ca8cc0070caefd99ee52743cad3b2bbe45ba4`. Keep main and production unchanged.
- Existing runtime settings: Next.js preset, Node 24.x, Fluid compute, basic
  build machine. Keep the supported defaults; no paid resources or overrides.

## Preview environment preparation

The first stdin-based CLI environment add timed out; the subsequent metadata
read still showed no variables. A documented bulk API write through the pinned
CLI also failed. The last successful metadata read confirmed the project had **zero
environment variables**, no Git connection, unchanged production, and enabled
Preview protection. The settings below are **prepared, not uploaded**. The
dashboard is the remaining setup path; inspect its current entries before
adding anything, and preserve any existing values rather than overwriting them.

On resuming this handoff on 22 October 2026, a read-only metadata refresh reached
the wrapper's 60-second deadline (`ETIMEDOUT`). No writes were attempted after
the interruption. The project details here are the last confirmed snapshot;
verify them in the dashboard before creating the Preview.

Required settings:

| Name | Source / value | Storage |
| --- | --- | --- |
| `GEMINI_API_KEY` | Existing ignored local credential | Secret |
| `QLOO_API_KEY` | Existing ignored local credential | Secret |
| `UPSTASH_REDIS_REST_URL` | Existing ignored local setting | Secret |
| `UPSTASH_REDIS_REST_TOKEN` | Existing ignored local credential | Secret |
| `AFTERHOURS_USAGE_SECRET` | Existing ignored local secret; preserve it | Secret |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Config |
| `AFTERHOURS_LIVE_ENABLED` | `false` | Config |

Select **Preview only**, never Production or Development. After connecting Git,
select **feat/event-agent** as the Preview branch when adding each setting.
Keep the live switch false throughout the initial deployment and controlled
tests. Do not add `NEXT_PUBLIC_` variables,
manual `VERCEL` flags, fabricated identity headers, or a new visitor secret.

The local setup attempts used existing ignored `.env.local` through quiet
`@next/env` loading and passed values in memory through child stdin, never argv,
stdout, generated environment files, or this document. For the dashboard, copy
each existing value directly from the local editor into its Secret field; do
not copy the whole file or its values into chat. Keep Production and Development
unchecked. Preserve the existing secret values and local live switch. No
credential is requested in chat and no existing variable is overwritten here.

Git-managed Preview variables can be available during the build as well as to
server functions; this differs from the earlier CLI deployment-only runtime
settings. They have no browser prefix and the application reads them only in
server integration code. Deploy only the reviewed private repository and
branch. Secret storage (also called Sensitive in older UI) hides values after
creation; trusted server/build code can still read them.

## Dashboard deployment

1. Open the existing **afterhours** project under **sam-3b2d**, then
   **Deployments → Create Deployment**. Use the reviewed **feat/event-agent** Git
   reference. If Vercel asks to connect a repository first, use this project's
   **Settings → Git → Connect Git Repository** and select only
   **watchmk25/afterhours**, then return to Create Deployment. If GitHub App
   installation access is needed, grant access only to this private repository.
   Do not use **New Project**, repository import, or a Production deployment.
   Configure the variables in step 2 before pressing the final Create button.
2. Keep the Production branch as **main**; do not point it at the feature branch.
   In **Settings → Deployment Protection**, retain the existing Vercel
   Authentication protection. In **Settings → Environment Variables**, add the
   seven entries above with **Preview → feat/event-agent** scope and the stated
   Secret/Config types. Inspect any existing entry first; preserve it instead
   of creating an override. Verify the live switch is false.
3. Return to **Deployments → Create Deployment**. Supply the exact pushed commit
   reported with this handoff, or use
   `https://github.com/watchmk25/afterhours/tree/feat/event-agent` and verify its
   displayed SHA. Choose the **feat/event-agent** branch configuration and
   **Preview** target. Do not select main, Production, promotion, or a domain.
4. Create that Preview using the current Next.js defaults. When it is **Ready**,
   verify the source SHA and branch, **Preview** environment, and protected
   access. Confirm the production deployment ID/source above are still current.
5. Share only the new `https://...vercel.app` URL and displayed source SHA.
   Do not click **Generate proposal** or run a standalone search/ranking yet.
   The controlled hosted suite must pass first.

Connecting Git enables automatic deployments for subsequent branch pushes and
production-branch updates. Do not push/merge main or create unrelated deployment
triggers during this handoff.

## Verification and remaining live budget

Application code is unchanged by this handoff. Reuse the passing lint,
TypeScript, **289 Node tests**, production build, and **56 local production
Chromium checks**. The extended Redis-only diagnostic already passed with **9
of 10 permitted requests**, all HTTP 200 and confirmed temporary-key cleanup;
do not repeat it or reset application counters. Account-owned Upstash Free-plan
and disabled-eviction management settings remain unverified.

This preparation makes **zero Redis, Gemini, or Qloo requests**. Hosted shared
controls, identity handling, the live proposal, latency, Apply, and pause remain
unverified until tested on the new Preview. Creating a deployment alone does
not establish these results.

Preserve the original sequence and budget:

1. Run all controlled hosted browser checks with **zero live provider calls**.
2. Only after they pass, temporarily enable the feature branch's Preview switch
   and create a fresh protected Preview. Perform **exactly one** real UI
   generation: Example A, INR 450, 400 pages, all sample languages, 45 minutes.
   Maximum **three Gemini requests and one Qloo ranking**; no probes, retries,
   revisions, or replacement attempts. Stop on failure and retain sanitized
   usage/timings. Check rendering, preserved edits, and explicit Apply.
3. Restore Preview `AFTERHOURS_LIVE_ENABLED=false`, create a fresh paused Preview,
   and verify the existing paused response with zero additional provider calls.
   Environment changes affect new deployments, not older ones. Remove only the
   temporary enabled deployment after validating its ID/project/nonproduction
   target; leave the final protected Preview paused. Do not delete historical
   deployments or modify production.

Sources: [Git deployment and dashboard references](https://vercel.com/docs/git),
[Preview variable scope](https://vercel.com/docs/environment-variables),
[Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables),
[Environment changes require a new deployment](https://vercel.com/docs/environment-variables/managing-environment-variables).
