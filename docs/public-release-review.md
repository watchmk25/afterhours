# Public release review

Reviewed on 2026-10-22. This records preparation for a future public release; it does not authorize changing repository visibility or publishing a deployment.

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

The release preparation adds a canonical MIT `LICENSE` with `Copyright (c) 2026 Mousam Kumar`. The latest separately inspected GitHub metadata still reports the repository as private, owner `watchmk25`, and administrative access. GitHub's default-branch `licenseInfo` is currently null because the new license has not yet reached the default branch; license detection remains to be checked after a future reviewed merge. No visibility change is part of this preparation.

## Assets, dependencies, and saved provider material

- `app/icon.svg` is a local vector asset without an external resource reference. The public directory contains the CSV template and the default Next.js starter SVGs (`file`, `globe`, `next`, `vercel`, and `window`). No application or documentation references to those starter SVGs were found in the inspected source paths. They were preserved. The presence of a project MIT license does not independently establish permission to reuse third-party logos or trademarks.
- `package-lock.json` is tracked, uses lockfile version 3, and its resolved package URLs use the public npm registry; no private registry URL was found. The package remains `private: true` for npm publishing. Dependency licenses include MIT, Apache, BSD/ISC, MPL, LGPL, and other notices. The project license does not replace those dependencies' own terms. No dependency audit or license-compliance certification was performed as part of this local release review.
- `lib/qloo-sample.ts` and the saved evidence in `docs/qloo-feasibility-results.json`, `docs/qloo-feasibility-resolutions.json`, and `docs/qloo-coverage-review-results.json` include provider entity metadata or selected response fields. The reviewed JSON does not contain raw authorization/cookie headers. Entity IDs, titles, names, tags, rankings, and similar public-facing metadata are **not classified as authentication secrets** merely because they came from Qloo.
- Public redistribution, attribution, and retention rights for saved Qloo material remain **unconfirmed**. The operator must review the applicable account/hackathon/provider terms before a visibility change, or decide which saved provider material to remove. The MIT license for project code does not resolve those terms.

## Remaining limits and release decisions

- This review covers objects reachable through the refs present locally at the baseline. It does not inspect deleted/unreachable objects, reflogs, GitHub issues or PR discussions, external caches, deployment logs, or every provider/dashboard record.
- Pattern matching and direct comparison with current local credentials can miss unknown, rotated, encoded, split, or binary-embedded secrets. No credentials were validated by contacting their services.
- The separate dashboard browser attempt exposed no controllable applications or browsers (`apps: []`, `browsers: []`). Provider/dashboard state requiring that access remains unverified; this review did not bypass that blocker.
- Before a future public release, the owner must decide whether the existing author-email exposure is acceptable and confirm rights to publish the saved provider material. Repository visibility and any live deployment must remain unchanged until that release is explicitly authorized.

No confirmed leak was found requiring rotation or history rewriting. The unresolved provider-redistribution question and the deliberate publication of author metadata remain explicit release decisions.

The final release-material check additionally compared the current effective
project credentials against the rewritten README, dashboard handoff, submission
draft, this report, release-readiness record, and MIT license, with no matches.
It confirmed the secret placeholders are empty, manifest and lockfile agree,
required assets/configuration exist, and the local live switch remains false.
The baseline historical counts above do not claim coverage of unrelated
external records or future commits.
