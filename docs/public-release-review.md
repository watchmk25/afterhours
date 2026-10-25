# Public release review

## Current publication follow-up — 25 October 2026

The organizer explicitly authorized public source visibility, Production
publication and one bounded anonymous live verification. PR #3 is already
merged at `e9b5505de388efdd24a333822fc55c845e49af02`; its tree is identical to
accepted checkpoint `c553f28`, with no new application changes. The repository
is now public: anonymous GitHub API access returned HTTP 200 with
`private: false` and MIT detection. Raw main LICENSE returned HTTP 200 with the
existing copyright attribution. The merged Production page returned anonymous
HTTP 200. Its initial controlled suite passed 54 tests and exposed two keyboard
scrolling failures; focused planner controls stayed outside the viewport during
the 10-second expectation. Replaying the same two journeys and assertions with
only a CSS auto-scroll override passed both in 22.135 seconds, with zero provider
calls. Commit `06cf158ccd930abfc1f3924ec34649ebd7b15a6d` removes only the global
`html` smooth-scroll property, retaining its 25px scroll padding. No provider
logic, mappings, validations, architecture or dependency changed. Lint, explicit
TypeScript, all 289 Node tests and production build passed after the correction.
The full anonymous hosted rerun then passed **56/56 original journeys in
119,848 ms (2.0 minutes)** on the actual deployed fix, with no CSS override,
changed assertions, skipped/flaky/unexpected results or live provider calls.
Production deployment `dpl_3PJSrNDF9fzR2aRDcsCRXMXAuD6s` was Ready from source
`06cf158…` during that paused check. Fresh enabled Production deployment
`dpl_7Si49UQpNXgy5Uii1wMNionQjoVC` then passed exactly one anonymous UI
generation at that source: an empty initial cookie store, page and generation
HTTP 200, actual **2 Gemini requests / 1 Qloo ranking**, and no probes, retries,
revisions or replacement attempt. The valid Namesake proposal assessed **3/6**
eligible books, totaled **45 minutes**, rendered in **3.652 seconds** and applied
explicitly after preserving the Guide edits. Mobile document/body widths were
390px without horizontal overflow. Production stays enabled for judges after
success; local and protected Preview live switches remain false. Documentation
checkpoints after this run are separate from tested application source
`06cf158ccd930abfc1f3924ec34649ebd7b15a6d`. See
[the public-release record](public-release.md). This successful bounded journey
does not establish sustained performance, recommendation quality or public
reliability.

The existing MIT license covers the project's original code. Third-party,
dependency and provider terms remain applicable; public redistribution rights
for saved provider material are not certified by this review. Existing author
metadata is published without rewriting history. No new concrete credential
leak was identified requiring rotation. The older private/draft hold statements
below describe the historical preparation stage and are superseded by the
current explicit authorization; they do not require another general approval.

## Historical review — 22 October 2026

This historical review records the original preparation scope and findings.

## Scope and method

- Baseline: `d0739cbf40150d1ebf1051b09cf99eddf193b055` on `feat/event-agent`.
- Read the applicable root `AGENTS.md` and inspected the tracked tree, ignore rules, environment example, package manifests, lockfile, assets, catalogue fixtures, saved provider evidence, and Git attribution.
- Examined all history reachable through the existing local and remote-tracking refs: **32 commits, 424 Git objects, and 267 distinct historical blobs**, covering **104 tracked baseline files**. There were no tag refs. Commit messages were checked too.
- Used local, text-oriented scans for private keys, recognizable provider/token formats, credential-bearing URLs, secret assignments, sensitive configuration filenames, personal email in file contents, and machine-specific home/project paths.
- Compared the effective local project credentials internally against historical content. Only result counts, categories, paths, and commit/object identifiers were exposed; credential values were not printed or copied into this report.
- No provider calls, installations, credential rotation, history rewriting, application edits, or changes to ignored environment files were performed for this review.

## Secret and private-data findings

**No actual credential disclosure was identified within the reviewed scope.** This is a scoped result, not a guarantee that arbitrary secrets cannot exist.

| Check | Observed result |
| --- | --- |
| Current effective local credentials in historical blobs | No matches for the configured Qloo, Gemini, Upstash URL/token, usage-signing secret, or local OIDC credential |
| Current local credentials or recognizable token/private-key formats in commit messages | No matches |
| Tracked or historically reachable environment-secret files, private-key files, or private service-config paths | None found; the intended `.env.example` is tracked |
| Recognizable live token/private-key formats in historical file contents | None found |
| Secret-assignment pattern hits | 24 occurrences across 12 historical test-file blobs; all are descriptive test literals matching the current test fixtures |
| Credential-URL pattern hits | Deliberate invalid/malformed URL inputs in fetch tests and a generic username/password negative-test URL in `tests/usage-control.test.ts`; no actual service credential was identified |
| Known personal email in tracked/historical file contents | No matches |
| Machine-specific user-home or project paths in historical file contents | No matches for the scanned Windows/macOS/Linux path forms |
| Private customer catalogue or uploaded stock file | None identified in tracked paths; the catalogue sources are the bundled sample fixtures and a one-row CSV template |

The assignment false positives occur in `tests/gemini-diagnostics.test.ts`, `tests/gemini-provider.test.ts`, `tests/protected-preview.test.ts`, `tests/qloo-smoke-fetch.test.ts`, `tests/usage-routes.test.ts`, and `tests/usage-runtime.test.ts`. They exercise server-only credentials, redaction, or test configuration. The URL cases also include `tests/qloo-feasibility-fetch.test.ts`. These test literals were left intact.

`.env.local`, `.vercel`, `node_modules`, `.next`, browser artifacts, and test reports are ignored locally. `.vercelignore` also excludes local credentials and generated artifacts from CLI source uploads. The secret fields in `.env.example` are blank; its populated values are nonsecret model/enablement defaults. Neither ignore mechanism removes anything already committed, which is why history was examined separately.

## Attribution and public metadata

All 32 reachable commits name **Mousam Kumar** as author. Repository-local author configuration matches that name. The user explicitly supplied that identity earlier in this project, and the canonical origin and existing GitHub merge records identify `watchmk25/afterhours`. This supports the chosen copyright attribution; it is not independent proof of legal ownership or third-party rights clearance.

The author's personal email is present in the metadata of all 32 reachable commits. Making the repository public would expose that existing metadata. This review has not rewritten history, changed author settings, or repeated the address in documentation.

The release preparation added a canonical MIT `LICENSE` with `Copyright (c) 2026 Mousam Kumar`. At the 22 October review, GitHub metadata reported the repository as private, owner `watchmk25`, and administrative access; default-branch `licenseInfo` was null before the merge. The 25 October publication and MIT detection are recorded above.

## Assets, dependencies, and saved provider material

- `app/icon.svg` is a local vector asset without an external resource reference. The public directory contains the CSV template and the default Next.js starter SVGs (`file`, `globe`, `next`, `vercel`, and `window`). No application or documentation references to those starter SVGs were found in the inspected source paths. They were preserved. The presence of a project MIT license does not independently establish permission to reuse third-party logos or trademarks.
- `package-lock.json` is tracked, uses lockfile version 3, and its resolved package URLs use the public npm registry; no private registry URL was found. The package remains `private: true` for npm publishing. Dependency licenses include MIT, Apache, BSD/ISC, MPL, LGPL, and other notices. The project license does not replace those dependencies' own terms. No dependency audit or license-compliance certification was performed as part of this local release review.
- `lib/qloo-sample.ts` and the saved evidence in `docs/qloo-feasibility-results.json`, `docs/qloo-feasibility-resolutions.json`, and `docs/qloo-coverage-review-results.json` include provider entity metadata or selected response fields. The reviewed JSON does not contain raw authorization/cookie headers. Entity IDs, titles, names, tags, rankings, and similar public-facing metadata are **not classified as authentication secrets** merely because they came from Qloo.
- Public redistribution, attribution, and retention rights for saved Qloo material remain **unconfirmed**. The operator must review the applicable account/hackathon/provider terms before a visibility change, or decide which saved provider material to remove. The MIT license for project code does not resolve those terms.

## Remaining limits and release decisions

- This review covers objects reachable through the refs present locally at the baseline. It does not inspect deleted/unreachable objects, reflogs, GitHub issues or PR discussions, external caches, deployment logs, or every provider/dashboard record.
- Pattern matching and direct comparison with current local credentials can miss unknown, rotated, encoded, split, or binary-embedded secrets. No credentials were validated by contacting their services.
- The separate dashboard browser attempt exposed no controllable applications or browsers (`apps: []`, `browsers: []`). Provider/dashboard state requiring that access remains unverified; this review did not bypass that blocker.
- The 22 October review identified author-email exposure and rights to publish saved provider material as owner release decisions. Publication is now explicitly authorized; these historical review limits are retained rather than presented as an additional approval gate.

No confirmed leak was found requiring rotation or history rewriting. The unresolved provider-redistribution question and the deliberate publication of author metadata remain explicit release decisions.

The final release-material check additionally compared the current effective
project credentials against the rewritten README, dashboard handoff, submission
draft, this report, release-readiness record, and MIT license, with no matches.
It confirmed the secret placeholders are empty, manifest and lockfile agree,
required assets/configuration exist, and the local live switch remains false.
The baseline historical counts above do not claim coverage of unrelated
external records or future commits.
