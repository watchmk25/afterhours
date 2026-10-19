# Dependency audit triage

Reviewed 2026-10-19 on `feat/sample-workspace`, starting from readiness commit `cf02a1fe127677495dc04323fbe5ff9949079fbb`. Node `24.14.1`, npm `11.12.1`. This report describes the checked-in lockfile and observed local source paths; it is not proof that every installed feature is exploitable or unreachable.

## Audit results and counting

| Command | Result | Meaning |
| --- | --- | --- |
| `npm audit --json` | Exit 1; 9 affected package entries: 7 high, 2 moderate | 3 root packages contain 14 individual advisories. The other 6 package rows inherit findings through dependencies. |
| `npm audit --omit=dev --json` | Exit 0; 0 findings | No reported advisories in the locked production dependency graph. This excludes development/build/test tooling and is not a whole-system security assessment. |

The fourteen individual advisories comprise five high, six moderate, and three low advisories. npm's nine-package severity totals count affected package entries, not unique advisories. Raw generated audit reports are not committed.

Commands used to trace the graph included `npm explain braces`, `npm explain undici`, and `npm explain node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion --json`. Package metadata and official advisory pages were checked online. Restricted/offline npm results were not used to claim an absence of findings.

## Root packages, paths, and decisions

Every root package below is **transitive** and marked `dev: true` in the application lockfile. None is a direct production dependency.

| Root package and installed version | Advisories / highest severity | Dependency path from AfterHours | Available fix and decision |
| --- | --- | --- | --- |
| `brace-expansion@5.0.9` | 3; high | Direct dev `@qloo/qloo-harness@0.1.26` → `@earendil-works/pi-coding-agent@0.84.2` → `minimatch@10.2.5` → `brace-expansion@5.0.9`. Also agent → `glob@13.0.6` → that minimatch. | `5.0.12` fixes all three and satisfies minimatch's `^5.0.5`. However, the published agent shrinkwrap locks `5.0.9`. Online targeted update and compatible audit-fix previews changed zero packages. Await an upstream release that refreshes the shrinkwrap; no consumer override or manual lockfile bypass was applied. |
| `braces@3.0.3` | 1; high | Direct dev `eslint-config-next@16.4.2` → `@next/eslint-plugin-next@16.4.2` → `fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`. | No patched release published; npm latest is `3.0.3`. Audit proposes `eslint-config-next@14.2.35`, a breaking downgrade from the Next 16-aligned config. Not applied. Await an upstream fix or a separately reviewed lint-chain change. |
| npm `undici@8.9.0` | 10; high | Direct dev `@qloo/qloo-harness@0.1.26` → `@earendil-works/pi-coding-agent@0.84.2` → `undici@8.9.0`. | All ten are fixed in npm `8.10.2`. The agent declares exact `8.9.0` and publishes it in its shrinkwrap; harness declares exact agent `0.84.2`. Harness latest was still `0.1.26`. No supported consumer update is available through these constraints; await an upstream harness/agent release. No override applied. |

The project lock entry for the agent has `hasShrinkwrap: true`; its installed `npm-shrinkwrap.json` explicitly records `brace-expansion@5.0.9`, `minimatch@10.2.5`, and `undici@8.9.0`. A semver-compatible patch existing on npm is therefore insufficient to make it selectable in this published dependency tree. npm documents that published shrinkwraps constrain consumers' transitive updates. [npm shrinkwrap documentation](https://docs.npmjs.com/cli/v11/configuring-npm/npm-shrinkwrap-json/).

Read-only previews:

```sh
npm update brace-expansion --dry-run --ignore-scripts --json
npm audit fix --dry-run --package-lock-only --ignore-scripts --json
```

Both reported zero changed packages. The update preview also proposed pruning some pre-existing extraneous optional packages; it was not applied. No actual `audit fix`, forced fix, install, downgrade, override, or unrelated cleanup was performed. `package.json` and `package-lock.json` remain unchanged. Already-patched brace-expansion copies `1.1.21` in the ESLint tree and `5.0.12` in the TypeScript-ESLint tree were preserved.

## Individual advisory details

### Brace-expansion

All three rows concern installed `brace-expansion@5.0.9` on the Qloo agent paths above. Exploitation requires a crafted brace/glob pattern to reach its expansion/parser functions. The fixed book search supplies a public book title, not a user-controlled glob. Broader agent and extension glob use was not exhaustively traced: **reachability is uncertain**, not proven absent. These packages are not imported by the workspace or browser tests.

| Advisory | Severity | Exposure conditions | Patched version / status |
| --- | --- | --- | --- |
| [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) | Moderate | Crafted brace rewrites cause quadratic CPU consumption. | `5.0.12`; blocked by upstream shrinkwrap. |
| [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) | High | Deeply nested brace groups exhaust the stack. | First fixed `5.0.11`; use `5.0.12` for all three; blocked by shrinkwrap. |
| [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) | High | Nested comma-part parsing exhausts the stack. | First fixed `5.0.10`; use `5.0.12` for all three; blocked by shrinkwrap. |

### Braces

| Package / advisory | Severity | Exposure conditions and observed usage | Fix |
| --- | --- | --- | --- |
| `braces@3.0.3` — [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | High | Deeply nested attacker-controlled patterns can exhaust the stack. The identified Next ESLint plugin call to `fast-glob.globSync` occurs when `settings.next.rootDir` is configured as a string/array. Current `eslint.config.mjs` does not set that option. No application-input-to-glob path was found; other tooling paths were not exhaustively proven unreachable. | No published patched version. The suggested config downgrade is breaking and was rejected. |

### Undici

All ten rows concern the **npm package `undici@8.9.0`** on the Qloo agent path above. All are fixed in npm `8.10.2`, but the exact upstream dependency and published shrinkwrap prevent that supported update here. Package-level highest severity is high; individual severities differ.

| Advisory | Severity | Required feature / exposure conditions | Observed fixed smoke path |
| --- | --- | --- | --- |
| [GHSA-3wwx-pv8p-q78v](https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v) | Moderate | A WebSocket peer supplies malformed compressed data that triggers an uncaught inflater failure. | No WebSocket use observed. |
| [GHSA-pmjh-fq2x-6v4x](https://github.com/nodejs/undici/security/advisories/GHSA-pmjh-fq2x-6v4x) | Moderate | RetryHandler encounters a partial response followed by a nonretryable response, leaving the original body pending. | No RetryHandler; one GET without retries, with a separate 30-second process deadline. |
| [GHSA-r53p-7pc4-xj5r](https://github.com/nodejs/undici/security/advisories/GHSA-r53p-7pc4-xj5r) | Low | Retry interceptor resumes a body while a proxy forwards the original Content-Length, enabling downstream response splitting. | No retry interceptor or downstream response forwarding. |
| [GHSA-rfgv-xxqx-mfg5](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5) | High | A WebSocket handshake returns an unrequested subprotocol and causes an uncaught exception. | No WebSocket use observed. |
| [GHSA-3xpg-4rpp-hhhm](https://github.com/nodejs/undici/security/advisories/GHSA-3xpg-4rpp-hhhm) | Moderate | Explicit decompression interceptor accepts a response with unbounded expanded size. | No decompression interceptor observed; this finding does not establish that every fetch is affected. |
| [GHSA-2jfj-6hjv-fm6j](https://github.com/nodejs/undici/security/advisories/GHSA-2jfj-6hjv-fm6j) | Moderate | Shared cache interceptor stores/replays Set-Cookie across callers. | No cache interceptor or shared multi-user responses. |
| [GHSA-2gqq-gqf2-x968](https://github.com/nodejs/undici/security/advisories/GHSA-2gqq-gqf2-x968) | Low | Dump interceptor mishandles oversized chunked responses and returns a misleading truncated response. | No dump interceptor observed. |
| [GHSA-w293-vg96-wgc3](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3) | High | BalancedPool drops custom function-valued TLS verification/connector options; default certificate checks remain but custom checks are bypassed. | No BalancedPool or custom TLS verification observed. |
| [GHSA-8436-99hf-9mmv](https://github.com/nodejs/undici/security/advisories/GHSA-8436-99hf-9mmv) | Low | Cache interceptor stores/replays unsafe-method responses, potentially preventing writes from reaching the origin. | One GET; no cache interceptor. |
| [GHSA-rx4f-c7p8-82vq](https://github.com/nodejs/undici/security/advisories/GHSA-rx4f-c7p8-82vq) | Moderate | WebSocketStream peer closes abruptly while a writer is locked, causing an unhandled rejection. | No WebSocketStream use observed. |

Loading the direct API router indirectly loads the agent through `update-manager.js`, the Pi entry point, and `http-dispatcher.js`. npm Undici initializes a default Agent and dispatcher symbols at import. An isolated inspection with fetch/TCP/TLS operations denied observed dispatcher initialization and zero network attempts. Thus the harness's call to global fetch can dispatch through the npm package; **the npm Undici dependency must not be described as absent or wholly unreachable**. No affected feature use was observed in the fixed search, but broader startup, agent/model modes, proxies, and extensions remain **uncertain**. A missing key still returns before loading this harness at all.

## Parent package rows are not additional advisories

| Affected parent in npm audit | Installed version | Direct or transitive | Inherited root |
| --- | --- | --- | --- |
| `micromatch` | `4.0.8` | Transitive dev | `braces` |
| `fast-glob` | `3.3.1` | Transitive dev | `braces` through micromatch |
| `@next/eslint-plugin-next` | `16.4.2` | Transitive dev | `braces` through fast-glob |
| `eslint-config-next` | `16.4.2` | Direct dev | Same lint chain |
| `@earendil-works/pi-coding-agent` | `0.84.2` | Transitive dev | `undici` (npm labels this parent moderate) |
| `@qloo/qloo-harness` | `0.1.26` | Direct dev | Same Undici chain (npm labels this parent moderate) |

## Production, build, development, tests, and npx

- **Production workspace:** Next `16.4.2`, React/React DOM `19.3.0`. None of the three root packages is a direct production dependency or imported by application components. The production-only audit is clean for its reported advisory set, not a guarantee of safety.
- **Build:** `npm run build` runs Next/Turbopack, the Tailwind loader, and TypeScript. Build tools can be development dependencies, so omitting dev does not assess this phase. No use of these root packages was found in the application build configuration; lint runs separately.
- **Development/lint:** `npm run lint` loads the Next ESLint chain. A malicious repository/configuration/glob is the relevant pattern-input concern; browser audience inputs are not supplied to it.
- **Manual diagnostic:** Qloo's agent tree is installed for the official CLI package, but AfterHours invokes only the fixed single-search command. It is not integrated into the workspace. The credential gate prevents harness startup without a key.
- **Tests:** Node domain/diagnostic tests and Playwright remain separate. Diagnostic substitutes are synthetic offline fixtures; no live Qloo API is exercised. Browser binaries are separate installed artifacts, not npm audit package findings.
- **npx:** README Playwright commands resolve the pinned local Playwright installation; Qloo commands use `npx --no-install`. No separately fetched npx tool was required for this triage. A separately downloaded npx-cache package has its own tree and is not covered by this application's lockfile audit. Global npm and any other external tooling are also outside it.
- **Node built-in fetch:** Node `24.14.1` reports bundled Undici `7.24.4` through `process.versions.undici`. That runtime component is distinct from npm `undici@8.9.0` and is not upgraded by editing this lockfile. These audits do not establish its vulnerability status; assess runtime advisories separately before future live use. [Node fetch documentation](https://nodejs.org/api/globals.html#fetch).

## Verification and remaining work

Only this report and the README were changed. Dependencies, application code, smoke logic, test assertions, configuration, generated reports, and author settings were preserved. Both audit commands and dependency tracing completed; update previews made no changes. `git diff --check` passed, and all fourteen unique advisory links are present. The actual missing-credential command printed `Qloo credentials not configured`; an additional run with child-process launch and fetch blocked recorded zero child-process attempts and zero fetch attempts. Full lint/Node/build/browser regression suites are not repeated for a documentation-only update; the readiness checkpoint records their preceding passing run.

All nine affected package entries remain. Recheck upstream fixes before enabling broader harness features or accepting untrusted tool inputs. A future harness release must update the agent's dependency/shrinkwrap, and the lint chain needs a published braces fix or a separately reviewed replacement. Live Qloo connectivity remains **UNVERIFIED** without credentials. Neither configuration nor this dependency assessment verifies a live connection.
