# AfterHours

A local organizer workspace for independent bookstores and book clubs. Start with illustrative sample books or import your inventory, explore books that fit practical limits, and adapt an event outline for your next gathering.

**Qloo matching and Gemini event planning are available on explicit request for supported sample books.** The default inventory is illustrative. Imported CSV inventory keeps local filtering and fixed event templates; live matching and planning do not support imported rows in this slice.

**The complete live event-planning journey passed with `gemini-3.5-flash-lite`: generate at INR 450, freshly rank and revise at INR 300, preview, and explicitly Apply.** Valid proposals rendered in **26.928 seconds** and **14.558 seconds** respectively: only the revision met the 10–15-second target. Limits are now 20 seconds per Gemini request and 30 seconds per run. These two successful turns establish local live acceptance, not sustained public reliability. See [actual traces, timings, and limitations](docs/event-agent.md).

**Current protected hosted preview verified:** all **51 Chromium regressions** passed locally and on the updated Preview with controlled fixtures and **zero live Gemini/Qloo calls**. The follow-up adds a usable confirmed example and retained applied-event evidence/context. The preview requires authorized Vercel access; production remains unchanged. See the [current Preview, checks, screenshots, and limitations](docs/audience-event-journey.md). The earlier real hosted generation rendered in **4.246 seconds**, assessed 3 of 6 eligible books, preserved edits until Apply, and applied The Namesake using two Gemini requests and one Qloo ranking; that [historical live result](docs/hosted-preview.md) is not a new live test of this follow-up.

## Run locally

Use Node.js 24 LTS (the built-in TypeScript test runner requires a recent Node version) and npm:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Next.js, normally http://localhost:3000. Browsing, CSV import, filtering, and fixed event templates need no environment file, API key, account, or external service. Live Qloo actions and Gemini proposals require the optional server credentials described below. System fonts and locally drawn display covers keep the workspace independent of external assets.

For a production preview:

```sh
npm run build
npm start
```

## Implemented

- A responsive cream-and-green workspace with AfterHours branding and explicit sample-mode messaging.
- Confirmed film/music interests are the primary audience input. Editable favourites remain under the collapsed **Optional audience notes**, grouped into books, films, and musicians, one per line. These notes do not influence eligibility, ranking, or planning.
- Maximum price per copy in INR, maximum page count, and language filters derived from the active catalogue (English/Hindi/Bengali for the sample). Filtering updates immediately; invalid numeric inputs or an empty language selection produce field-specific guidance and no results.
- A bundled ten-book catalogue with identifiable title/author pairs. Prices, page counts, stock, edition languages, and display covers are illustrative fixtures, not retailer or publisher data.
- Only in-stock books satisfying **all** selected constraints appear under **Eligible books**, ordered alphabetically by title. Limits are inclusive. An optional, separate Qloo result lists the returned ranking of eligible sample books with confirmed provider mappings; it never hides unassessed eligible books.
- A helpful empty-results state with a Reset filters control that preserves audience favourites.
- Select an eligible book to edit a fixed event template: title, 75-minute running order, generic discussion prompts, and organizer notes. Manual templates are labelled **not AI-generated**. Applying a reviewed Gemini proposal explicitly replaces the draft and labels its source separately.
- A selection that becomes ineligible is cleared together with its outline and does not return automatically when filters are widened. Filter changes that keep the book eligible preserve the draft. Switching books starts a fresh template.
- **Load example** visibly confirms the verified Amélie (2001) + Norah Jones example interests and fills optional notes/example filters (₹450, 300 pages, English when available, otherwise all active languages). It clears selection/outline and old results, retains the active catalogue, and makes zero API calls. **Reset** clears confirmed interests, optional notes, selection/outline, and results and restores ₹600, 400 pages, and all active languages.
- A browser-local CSV import with validation, representative preview, explicit replacement confirmation, and a separate **Restore sample catalogue** action.

## Import your catalogue

Use **Download CSV template** in **Your catalogue**. It contains these six required, case-sensitive column names and one illustrative example book row; replace the example with your own inventory:

```csv
title,author,price_inr,pages,language,stock
The Guide,R. K. Narayan,299,256,English,18
```

Choose a UTF-8 CSV file of at most **256 KiB (262,144 bytes)** and **500 nonblank data rows**, excluding the header. A UTF-8 BOM, Windows CRLF line endings, quoted commas, escaped double quotes (`""`), and quoted line breaks are supported. Headers may be reordered; surrounding header/value whitespace is trimmed. Extra columns are ignored, but every record must have the same number of fields as its header. Truly blank records are skipped; comma-only and quoted-empty records are validated rather than silently discarded.

- `title`, `author`, and `language` must be nonempty after trimming. Language labels are supplied by the organizer, not restricted to the sample's three languages; differently spelled/cased labels remain distinct.
- `price_inr` must be a finite, nonnegative number. Zero-price books are allowed. Prices are retained numerically; currency displays round to two decimal places.
- `pages` must be a positive safe integer; `stock` must be a nonnegative safe integer. Books with zero stock are imported but excluded from Eligible books.
- Malformed quoting, missing/duplicate required headers, invalid values, inconsistent record widths, invalid UTF-8, and exceeded limits reject the entire file. There is no partial import. Errors identify the logical CSV record row (header is row 1; quoted newlines stay within one row) and column where applicable. Large error lists are capped with an omitted-error count.

Papa Parse **5.7.0** handles CSV fields, with strict quote validation before parsing. Typings **5.5.2** are development-only. Both are pinned in the lockfile. Parsing and validation happen in the browser; the file is never posted to a server.

Uploading creates a preview with the total count and the first five books (or all books for a smaller file). The active catalogue, selected book, and edited outline remain unchanged until **Replace catalogue** is clicked. Invalid files and **Cancel import** preserve all three. The confirmation notice explains that replacement clears the selection and event outline while retaining audience favourites. Numeric filter limits are also retained; all languages from the new catalogue are initially selected.

Imported rows receive unique `local-import-` UUIDs, including repeated title/author rows. These identify local catalogue records and are separate from Qloo entity IDs. Reimporting creates fresh IDs. Imported books use the same in-stock, inclusive price/page, language, and alphabetical filtering, and the same editable fixed event template as samples. Sample mappings are never applied to imported rows, even when titles match.

**Reset** retains imported inventory while clearing favourites, selection, and outline and restoring default numeric limits/all active languages. **Reset filters** preserves favourites and inventory. **Restore sample catalogue** switches back to the ten fixtures, selects all sample languages, clears selection/outline, and preserves favourites and numeric limits. These actions are distinct from cancelling an unconfirmed import.

Inventory, inputs, selections, and outline edits are session-only. Reloading returns to the sample catalogue and default workspace; nothing is persisted. No matching, affinity, cultural explanation, or AI planning is introduced by import.

## Live Qloo matching (sample catalogue only)

Copy `.env.example` to `.env.local` only if the latter does not already exist, then set `QLOO_API_KEY` in your local editor. Restart the local Next.js server after changing it. Do not paste credentials into commands, screenshots, logs, or tracked files, and never use a `NEXT_PUBLIC_` variable. Next.js loads its normal server environment: an inherited process value takes precedence over `.env.local`; the runtime does not read private harness settings. The assigned upstream is fixed to `https://hackathon.api.qloo.com` with `X-Api-Key` authentication; a caller cannot supply another origin or mapping.

1. Keep the sample catalogue active and set the normal stock, price, page, and language constraints.
2. Choose **Example A: Amélie + Norah Jones** or **Example B: Interstellar + Hans Zimmer** to confirm the verified hypothetical interests. These are examples, not inferred audience profiles.
3. Alternatively, choose Film or Musician, enter a name, and press **Search Qloo**. Inspect up to three returned candidates, select the intended entity, then press **Confirm interest**. A name typed in the search box or the original favourites fields is never an implicit signal. Remove any confirmed interest that should not influence the ranking.
4. Press **Rank with Qloo**. The panel shows the exact confirmed interests used, actual returned book order, available affinity and numerical interest-contribution fields, and coverage. Scores are not probabilities, and numerical contributions do not establish causal explanations or reader satisfaction.

The five reviewed mappings are joined to stable sample IDs in `lib/qloo-sample.ts`, with provenance in [the feasibility resolutions](docs/qloo-feasibility-resolutions.json). Under default filters, **four of seven eligible books** have confirmed mappings: Malgudi Days, The God of Small Things, The Guide, and The Namesake. The Palace of Illusions is mapped but out of stock. The other eligible books remain browsable and selectable with an unassessed label; unresolved mappings do not mean that a book is absent from Qloo. At least two eligible mapped books and one confirmed interest are needed to rank. Imported CSV inventory remains fully usable for filtering and templates, but cannot be ranked with these sample mappings.

Only explicit search and rank actions call the server. Each action makes at most one upstream GET: `/search` with movie/artist type and `take=3`, or `/v2/insights` with the server-derived eligible shortlist, confirmed signal IDs, affinity sorting, and explainability requested in that same response. Search names are bounded to 1–100 characters; at most five confirmed interests are accepted. The server uses built-in fetch, a ten-second timeout, 8 KiB request/1 MiB response limits, no redirects, no caching, and no automatic retries. It never imports the CLI harness or diagnostic scripts. Missing credentials, malformed inputs, unconfirmed/tampered interests, imported inventory, and insufficient candidates fail before any upstream request. Signed search confirmations expire after 30 minutes or a credential change; search again to renew them.

Standalone search and ranking forward browser request cancellation to the upstream fetch and response read. A pre-cancelled operation dispatches nothing; cancellation during an operation rejects late results. This cannot retract a request already sent or establish a provider quota refund.

Filters, confirmed interests, catalogue replacement, Load example, and Reset invalidate old rankings. Responses from older requests are ignored. Ranking never selects or switches a book, and an edited event outline survives while its selected book stays eligible. Invalid/cancelled CSV previews preserve the active inventory, selection, draft, and matching state. Confirming replacement clears the selected book and outline, preserves favourites, and invalidates ranking. Errors and missing explanation fields are shown honestly, without substituting saved experiment results.

**Taste-evidence boundary:** the saved controlled audience comparison returned different scores/contributions but the same book ordering. A subsequent one-request detail review returned all seven competing IDs for Godaan, The Blue Umbrella, and Pather Panchali; ISBN/format evidence still could not identify unique inventory mappings. Coverage remains 4/7 at defaults and 3/6 at INR 450/400 pages/all languages. No audience experiment was repeated. See the [coverage review, actual metadata, negative findings, and request totals](docs/qloo-coverage-review.md).

This flow has no application login, persistent storage, shared quota management, or public-service abuse controls. Credential-enabled operation is limited to local use or an access-protected Preview. The existing public production deployment remains unchanged. See [hosted preview preparation and release controls](docs/hosted-preview.md).

See [the live-matching verification record](docs/live-qloo-matching.md) for the automated checks, three-request live check, actual ordering/affinity values, and remaining limits. Recorded results are documentation only and are never imported into the runtime.

## Bounded Gemini event planner

Keep the existing `.env.local` file and its complete Qloo credential. Add `GEMINI_API_KEY` using your local editor, following the empty tracked `.env.example`; do not place a credential in a command or a `NEXT_PUBLIC_` variable. Optionally configure `GEMINI_MODEL` (default `gemini-3.8-flash`) and restart Next.js. The server explicitly passes **GEMINI_API_KEY** to the pinned official **@google/genai 2.30.0** SDK; it never selects `GOOGLE_API_KEY`, Vertex AI, or another provider automatically. This setup does not enable billing or change the hosted environment.

The current local verification explicitly uses `GEMINI_MODEL=gemini-3.5-flash-lite` in ignored `.env.local`, with documented `minimal` thinking for that exact model. Other configured models retain `low` thinking. Restart Next.js after editing the local model setting; inherited process variables take precedence over `.env.local`. This setting is explicit, with no runtime model fallback. See the measured outcomes in [the verification record](docs/event-agent.md).

1. Keep the sample catalogue active, confirm an audience preset or searched interests, and set the structured book filters.
2. Describe the desired activities in **Event request** and choose **Event duration (minutes)**, a whole number from 15–180. Requests are bounded to 10–1000 characters. Avoid private participant details.
3. Press **Generate proposal**. Gemini can call the single native `rank_eligible_books` tool. The tool takes **no arguments**: the server reuses the existing Qloo core, authoritative sample inventory, current filters, and confirmed entities. The model cannot supply IDs, inventory values, hosts, or relaxed constraints.
4. Review the separate proposal preview: selected book, illustrative inventory facts, actual Qloo evidence/coverage, proposed title and rationale, timed activities, materials, and invitation. Generation does not select a book or overwrite any outline edits.
5. Press **Apply proposal** only when ready to replace the selected book and all outline fields. The applied draft remains editable and is labelled as a Gemini proposal. Manually switching books still starts a fresh fixed template.
6. Change a filter and press **Revise proposal**. The previous preview becomes stale and cannot be applied. A revision starts a fresh run with recomputed eligibility and a new Qloo ranking; the historical proposal is context, never current evidence. Unapplied revisions and failures preserve a still-eligible selected book and its edits.

Normal execution uses **two Gemini requests and one Qloo ranking**. Each run permits **at most three Gemini requests, including one output repair, and one Qloo ranking request**. There are no automatic SDK/network retries, redirects, extra resolution calls, or stored-response fallbacks. Local validation uses `store:false`, bounded outputs, up to **20 seconds per Gemini request and 30 seconds for the run**. Every Gemini call receives the smaller of 20 seconds and the remaining run budget; a repair shares that same deadline. Qloo receives its ten-second limit and the remaining run's abort signal. Native function-result continuation preserves call IDs and opaque signatures internally; hidden reasoning and raw provider errors are never shown. Run traces include concise stage elapsed times and the deadline that fired, when applicable. Loading appears immediately, submission is locked while pending, and explicit cancellation and stale-response protection remain active. Existing edits remain intact until Apply while their selected book stays eligible.

The server validates the input, both credentials, confirmed interests, and eligible mapped books before any model request. A successful proposal requires a real tool result from that run; its selected book must belong to the current eligible ranked set, every cited evidence ID must match actual scores for that book, and positive integer agenda minutes must sum exactly to the requested duration. Factual book metadata and numerical evidence are joined from server-owned data, never trusted from model-supplied fields. Unknown/repeated tools or arguments are rejected. One invalid output may be repaired against the same evidence; an invalid repair fails honestly.

Planning permits a single eligible mapped book (`take=1` is documented by Qloo); the separate manual matching panel retains its existing two-book minimum. For example, with the default page/language limits and a maximum price of INR 300, only The Guide is mapped among three eligible books. This is limited coverage, not evidence that the other books are absent from Qloo.

Explicit conflicts between prose and structured price/page/duration limits, and requests to bypass filters, produce clarification. Gemini is also instructed to clarify uncertain instructions. The planner never silently changes a filter. The request prompt and conservative prose checks forbid quotations, URLs, obvious plot/author claims, factual inventory numbers, and attendance guarantees. Free-form language cannot be exhaustively fact-checked by these checks: proposed activities and invitation wording must be reviewed and are not Qloo explanations or verified literary facts.

Activity timings are distinct from explicit overall-duration conflicts: with duration 45, **“Plan a 45-minute event with 10 minutes for discussion.”** is valid. An explicit 60-minute event total still requires clarification. Detection recognizes overall-duration wording, rather than maintaining a list of activity names; structured duration and exact agenda validation remain authoritative.

Changes to filters, interests, the request, or duration invalidate the preview, including a change back to the former values. Late responses are ignored; cancellation aborts local/server work where possible but cannot retract an upstream request already dispatched. Reset and Load example clear planner state. Invalid/cancelled CSV previews preserve it; confirming import or restoring samples invalidates it and follows the existing selection/outline rules. Imported catalogues cannot use live matching or planning.

After Apply, the editable outline retains the proposal's actual confirmed interests, assessed coverage, numerical evidence/references, warnings, planned duration, and a cloned filter snapshot. Expand **Applied filters and numerical evidence** to inspect the details. Changing audience or filters preserves every edit while the book stays eligible and marks the context **Based on previous inputs**, even after changing back. **Generate a current proposal** returns to the planner; no regeneration or replacement happens automatically. Optional notes do not stale this evidence. Book invalidation, switching books, Reset/Load example, or confirmed catalogue replacement clears the applied context with the outline. Manually edited agenda totals are not revalidated automatically.

See the [audience-to-event change and verification record](docs/audience-event-journey.md) for the current controlled tests and protected Preview. This follow-up uses zero live Gemini/Qloo calls.

Routine Node and Chromium tests use controlled provider fixtures and make **zero live calls**. See [the event-agent verification record](docs/event-agent.md) for actual automated and live results and [protected hosted preview instructions](docs/hosted-preview.md). Workspace state is session-only; main and the public production deployment are unchanged. There is no application login, persistent storage, provider framework, or automatic application/publishing of a proposal.

The protocol follows Google's current [function-calling](https://ai.google.dev/gemini-api/docs/function-calling), [structured-output](https://ai.google.dev/gemini-api/docs/structured-output), [Gemini 3.5 Flash Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite), and [thinking-level](https://ai.google.dev/gemini-api/docs/thinking) documentation. Provider access and quota depend on the configured credential; configuration alone does not verify a live run.

## Checks

Install the locked development dependencies and Playwright's matching Chromium once:

```sh
npm ci
npx playwright install chromium
```

Then run the independent suites:

```sh
npm run lint
npm test
npx tsc --noEmit
npm run test:e2e
npm run build
```

`npm test` runs the Node tests in `tests/*.test.ts`, separately from Playwright. Domain tests exercise stock exclusion, alphabetical order, inclusive price/page boundaries, dynamic language filtering, invalid inputs, empty results, fresh default/example state, audience independence, and selection validity. Fourteen parser tests cover field mapping, unique local IDs, quoted fields/BOM/CRLF, logical rows, headers, malformed quoting, atomic rejection, numeric/text validation, exact byte/row boundaries, and bounded errors. Diagnostic tests exercise credential gating and safe smoke-check output using local test fixtures, without Qloo requests. The Node runner uses `--test-isolation=none` for environments that restrict child-process creation.

`npm run test:e2e` runs only `e2e/*.spec.ts`, using pinned Playwright Test 1.64.1 and its own isolated Chromium browser. It does not connect to Brave or alter Windows Computer Use safeguards. Each test starts in a fresh browser context; there is one worker and no automatic retries.

The six original workspace browser journeys retain their behavior assertions (the banner copy now accurately describes optional live matching) and cover:

1. Load example: exactly Malgudi Days, The Blue Umbrella, and The Guide, with English, ₹450, and 300 pages.
2. Select The Guide, edit title and notes, then lower the price limit to ₹400 without switching books; selection and edits persist.
3. Lower the price limit to ₹100; empty results clear the invalid selection and draft. Widening the limit does not resurrect either.
4. Reset: source-defined default filters, blank favourites, and no selected book or stale outline.
5. A 390px viewport: document overflow, application control and card bounds, and a full-page screenshot with eligible books and a selected editable outline.
6. Actual Tab, Space, Enter, and typing: section navigation, visible focus rings, checkbox changes, book selection, and outline editing.

Eight additional independent CSV browser journeys cover preview/confirmation and filtering, template download and BOM/CRLF quoted fields, atomic invalid-file rejection and limits, cancel versus confirm with edited drafts, dynamic languages and Reset, restoring samples, reload behavior, and 390px preview/imported-outline layout.

CSV import verification: all **41 Node tests** (14 parser, 11 workspace domain, 16 diagnostic), lint, the production build, and all **14 Chromium tests** passed. Chromium ran against the production preview with one worker and zero retries. The 390px full-page import preview and selected-outline screenshots were visually inspected; cards and fields fit without horizontal overflow. These browser checks cover Chromium and emulated viewports; other browsers and physical mobile devices are not covered.

### Local server and conflicts

By default, `playwright.config.ts` uses **http://localhost:3000** as both `baseURL` and the documented [Playwright `webServer`](https://playwright.dev/docs/test-webserver) URL. Locally it reuses a responding server; when absent, Playwright starts `npm run dev -- --hostname localhost --port 3000`. In CI it requires its own server. It never chooses another port automatically.

Before browser interactions, global setup verifies that the response has the AfterHours title and workspace section IDs. A different app or a redirect on port 3000 fails with a target/port-conflict message. Next.js startup and server-lock errors remain visible in the runner output. Inspect the existing server and resolve the conflict manually; the setup does not kill existing processes or delete lock files. Playwright cleans up a server only when that test run started it.

A reused server must serve the current checkout. If its file watcher keeps serving an older stylesheet after source edits, restart that AfterHours server before rerunning. During this setup, an existing dev server served stale CSS; restarting only its verified project process allowed the runner to start the updated checkout without deleting any locks.

To test a production preview, run `npm run build` and `npm start` separately on port 3000, then run `npm run test:e2e` to reuse it. For a visible test browser, use `npm run test:e2e -- --headed`.

### Explicit deployed target

Set `PLAYWRIGHT_BASE_URL` to the actual public app origin to run the same journeys against a deployment. The following PowerShell example uses a placeholder; replace it with the provider-generated URL recorded after deployment:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'https://your-deployment.vercel.app'
try {
  npm run test:e2e
} finally {
  Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
}
```

An explicitly supplied URL disables `webServer` entirely, including when it points to an already-running local production preview. The runner never starts or falls back to a local server in this mode. Targets must be HTTPS origins without embedded credentials, paths, queries, or fragments; loopback HTTP origins such as `http://localhost:3000` are also allowed. An empty or invalid value fails configuration rather than reverting to localhost. Remove the environment variable to restore the default local workflow.

The anonymous-access preflight creates a fresh request context with no login cookies or credentials, requires a successful AfterHours title and workspace-section response, and refuses redirects, HTTP 401/403, and TLS errors. Each browser journey also starts in a new browser context without saved authentication. Visitor protection or a wrong target is a failed verification, not evidence that the app is publicly usable. These checks need no Qloo or LLM credentials and do not bypass hosting protection.

CLI deployments use the tracked `.vercelignore` to exclude actual environment files, local build output, browser reports/screenshots/traces, and other generated artifacts. Git ignore rules alone do not exclude all of these from a Vercel CLI upload. After linking the correct personal Hobby project, inspect filenames with `npx --yes vercel@64.5.0 deploy --dry --json` before deploying a clean, reviewed `main` checkout with `npx --yes vercel@64.5.0 deploy --prod`. Use the Next.js preset and leave Qloo/LLM environment variables unconfigured. Keep the GitHub repository private and do not pass `--public`; anonymous app access is verified separately against the assigned production URL.

### Reports and screenshots

- `playwright-report/index.html`: HTML report, including the mobile screenshot attachment. Open with `npx playwright show-report`.
- `test-results/results.json`: machine-readable results.
- `test-results/<mobile-test-name>/afterhours-mobile-390.png`: full-page mobile capture on every mobile test run, including failed layout checks.
- `test-results/<qloo-mobile-test-name>/qloo-ranked-workspace-mobile-390.png`: controlled matching, eligible shelf, and edited outline at 390px.
- `artifacts/playwright/qloo-live-desktop.png` and `qloo-live-mobile-390.png`: locally retained screenshots from the three-request live verification; no credentials or headers are captured.
- `artifacts/playwright/event-agent-responsive-a-desktop.png`, `event-agent-responsive-b-desktop.png`, and `event-agent-responsive-mobile-390.png`: actual Flash Lite previews, explicit Apply, and the applied outline at 390px. `event-agent-responsive-results.json` records sanitized stage/render timings and request totals.
- `artifacts/playwright/event-agent-hosted-applied-desktop.png` and `event-agent-hosted-applied-mobile-390.png`: the actual protected hosted proposal after explicit Apply. `event-agent-hosted-results.json` retains its sanitized timings, coverage, proposal, and request counts.
- `test-results/<failed-test-name>/test-failed-1.png` and `trace.zip`: retained failure screenshot and trace. Inspect traces with `npx playwright show-trace <path-to-trace.zip>`.
- `artifacts/playwright/`: retained screenshots and the original failure trace from the visual review during this setup.

Generated reports and artifacts are ignored by Git and ESLint. Playwright replaces `test-results/` and `playwright-report/` on subsequent runs; copy a run's artifacts elsewhere before rerunning when you need to retain its history. Browser installation and launch can require local permission for downloads, browser processes, and test workers.

For an access-protected Vercel Preview, the runner accepts a process-only
`PLAYWRIGHT_VERCEL_OIDC_TOKEN` with an explicit HTTPS `PLAYWRIGHT_BASE_URL`.
A trusted wrapper can capture a short-lived same-project identity through the
authenticated Vercel CLI. Existing automation-bypass access is also supported
through `VERCEL_AUTOMATION_BYPASS_SECRET`; supplying both is rejected. Obtain
authorized access through secure provider tooling; do not paste its value
into commands, source, or reports. The test transport adds authorization inside
Node fetch only for that exact Preview origin. It never adds secret headers to
Playwright configuration, browser requests, cookies, URLs, or traces. Existing
page fixtures intercept provider actions; an additional context guard blocks
unmocked provider routes. Omitting authorization preserves the anonymous/local
preflight. This authorized mode verifies protected functionality, not anonymous
visitor access. See [the release record](docs/hosted-preview.md).

## Optional Qloo connection smoke check

This is a manually invoked, trusted local diagnostic, separate from the application's native-fetch integration. The workspace never invokes it; the diagnostic and its one-request contract are unchanged. Follow the official [hackathon kit](https://github.com/qloo/qloo-hackathon-kit), [API access requirements](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md), and [CLI workflow](https://github.com/qloo/qloo-hackathon-kit/blob/main/starter/cli-workflow/README.md). Use an individually issued event credential and confirm the event quota, expiry, and support contact with the organizers.

`npm ci` installs the pinned official `@qloo/qloo-harness` 0.1.26 development dependency locally; a global installation and a model-provider account are unnecessary. Node.js 24 LTS meets the harness's minimum version. Its CLI help can be inspected without making API requests:

```sh
npx --no-install qloo --version
npx --no-install qloo api --help
npx --no-install qloo api search --help
```

For configuration, copy the tracked, empty `.env.example` to `.env.local` **only if that file does not already exist**, then set `QLOO_API_KEY` in your local editor. Alternatively supply `QLOO_API_KEY` through the process environment. Do not share the value in chat, command arguments, logs, screenshots, or source control. Never prefix it with `NEXT_PUBLIC_`. Actual `.env*` files remain ignored; only `.env.example` is allowed in Git.

```sh
npm run qloo
```

`npm run qloo:smoke` remains an alias for the same diagnostic. Both commands invoke the existing pinned harness; neither installs dependencies.

The diagnostic preloads a small request-budget guard into the harness child. It allows only the single fixed book search on the issuer-assigned hackathon origin, rejects any second fetch or other origin (including `api.qloo.com`), and exposes redirects without following them. The official harness still performs the request with `X-Api-Key`; the guard adds no probes or alternate provider.

The script reads only `QLOO_API_KEY` from the process environment or project-root `.env.local`, using Node's built-in dotenv parser. An explicitly set process value takes precedence, including an empty value. It does not load `.env`, other environment files, or credentials from private harness setup. Without a nonblank key it prints **Qloo credentials not configured**, exits successfully as a skipped diagnostic, and never starts the harness or sends an API request. Configuration alone is not a verified connection.

With a key, it invokes the documented `qloo api --verbose search --query "The Guide" --type book --take 3 --json` once. Node launches the absolute harness entry point directly, without a shell or Windows `.cmd` lookup. The credential is passed only through the child environment. The credential issuer explicitly assigned `https://hackathon.api.qloo.com`; this diagnostic fixes both `QLOO_BASE_URL` and `QLOO_TRUSTED_BASE_URL` to that exact origin in the child environment, overriding inherited or private harness settings without changing global configuration. Matching explicit trust is required because harness 0.1.26's built-in origin allowlist recognizes the production server only. The actual request is `GET /search` on the hackathon origin; there is no production fallback. The wrapper bounds the whole process to 30 seconds and limits each captured output stream to 1 MiB. It does not use multi-step workflows, pagination, or follow-up entity calls.

Verify destination changes using an offline intercepted harness fetch, not solely `--dry-run`: this pinned CLI's dry-run display reads stored configuration and may not reflect its actual environment override. The offline interception replaces fetch before the harness loads, confirms the actual destination and credential/header equality, and returns synthetic data without contacting Qloo. The tracked `.env.example` remains only an empty credential placeholder; server selection is fixed by this repository's diagnostic, not copied into the credential file.

Failures exit with code 1 and report sanitized JSON evidence: observable failure stage, whether the child spawned, numeric process exit code, recognized error code, timeout/signal, and HTTP status only when the harness exposes an actual verbose response line. The harness's structured error code must agree with its observed exit code. A local `AUTH_FAILED` credential-resolution error is distinct from HTTP 401/403; `API_ERROR` alone cannot distinguish a server error from a network problem. Child launch and configuration failures establish no request was sent; a launched child or request log alone leaves delivery unknown. Raw stdout/stderr, error messages, exception objects, stacks, headers, and complete request URLs are never forwarded on failure. Explanations use fixed, recognized categories so even unknown error text cannot leak credentials. No automatic retry follows a failure.

On successful CLI completion, the script validates that its JSON output is an array of at most three candidates and prints that JSON with credential-like fields and the configured key redacted. No title/author/ID summary mapping is assumed. Harness 0.1.26 emits the upstream `results` array rather than the complete response envelope, and defaults absent results to `[]`; an empty array does not establish a useful book match. Review the actual returned fields and identify the intended title and author before any future use. No entity is automatically accepted or saved, even if only one candidate is returned. Switching workspace books still starts a fresh local template.

Initial readiness verification exercised the missing-credential path with no harness invocation/API requests. At that checkpoint all 26 Node tests (10 domain, 16 diagnostic), lint, the production build, and all six Chromium production-preview tests passed. No credential was available for that initial check, so it did not establish live connectivity or the actual candidate schema. Current diagnostic tests also cover process launch, child credential transport using synthetic values, structured errors, timeout/signal, output limits, HTTP evidence, parsing failures, and secret-safe output; they never contact Qloo. See the official [troubleshooting guide](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/TROUBLESHOOTING.md). Offline readiness and credential presence do not establish event access, quota, expiry, or whether Qloo unambiguously identifies *The Guide* by R. K. Narayan. No sample data is presented as a Qloo response.

The earlier guarded check on 2026-10-20 reached the production origin `api.qloo.com` and observed HTTP 401 (`API_ERROR`, child exit 5), with no timeout or retry. The issuer subsequently confirmed that this credential belongs on `hackathon.api.qloo.com`, establishing an origin mismatch in that check; the 401 does not establish an invalid key. The existing complete credential is preserved. At that stage authentication on the assigned origin had not been checked. No alternative credentials or fallback hosts are tried. The prior diagnostic fix passed lint, all 74 Node tests (49 diagnostic/guard and 25 workspace/import), and TypeScript checking; application code and dependencies were unchanged.

The corrected assigned-origin check on 2026-10-20 made one live search, received HTTP 200, and returned three book candidates. The actual candidate fields included `name`, `entity_id`, `types`, `properties`, and `disambiguation`. *The Guide* with disambiguation `1958, R.K. Narayan` confidently identifies the intended book among the results; the other candidates were *The Guide* (`2021, Peter Heller`) and *The Guide for the Perplexed* (`1190, Maimonides`). Author attribution here comes from `disambiguation`; no standalone author field was supplied. Authentication and this bounded search are verified, but no entity is automatically accepted, stored in the workspace, or used for recommendations. No redirects or retries occurred. Offline interception confirmed the actual hackathon destination and unchanged credential/header value. Lint, all 75 Node tests (50 diagnostic/guard and 25 workspace/import), and TypeScript checks passed. The sample app, global harness settings, Vercel configuration, and deployed website remain unchanged.

Dependency triage on 2026-10-19 confirmed nine affected package entries (two moderate, seven high), arising from fourteen individual advisories in three transitive development packages. `npm audit --omit=dev --json` reported zero findings. See [the dependency findings and exposure assessment](docs/dependency-audit.md) for every advisory, installed version, path, and fix constraint. The published Qloo agent shrinkwrap prevents selecting the available `brace-expansion` and Undici patches, while `braces` has no published fix. Update previews made no changes; no overrides, forced fixes, or framework downgrades were applied. The harness remains a local diagnostic dependency and is not imported by the web app. Production-only audit results do not assess build tools, Node's bundled libraries, or separately downloaded tools.

## Local Qloo feasibility experiment

The separate, manually invoked `npm run qloo:feasibility` probe tests whether two fixed hypothetical film/music audiences can rank the same locally eligible sample inventory. It does not change the workspace or the one-request `npm run qloo` smoke check. See [the experiment report](docs/qloo-feasibility.md), [minimal sanitized responses and request ledger](docs/qloo-feasibility-results.json), and [reviewed entity resolutions](docs/qloo-feasibility-resolutions.json).

`npm run qloo:feasibility -- verify` checks the saved experiment offline. With no argument the probe only prints usage. The explicit live `search` phase permits the fixed nine remaining book searches plus four audience searches, each capped at three candidates; after human review, `rank` permits at most two direct Insights requests. A persisted ledger and a per-child fetch guard cap the experiment at 15 requests, disallow redirects and retries, and stop on failed requests. Completed stages cannot be repeated; do not remove the ledger to retry this same experiment. Credentials use the existing ignored `.env.local` loader and fixed issuer-assigned hackathon origin in the child process only. Dependencies, global harness settings, UI, and hosting are unchanged.

The probe reuses the actual catalogue and default workspace filters, keeps local inventory IDs separate from Qloo entity IDs, excludes unresolved books/seeds, validates returned shortlist membership, and retains aggregate/per-book explanation fields from the same response rather than making explanation follow-up calls. Recorded score fields are Qloo outputs, not probabilities or validated recommendation quality. Node tests use synthetic transports and make no Qloo requests.

## Structure

- `app/`: Next.js App Router page, root metadata/layout, local icon, and global styles.
- `components/`: workspace state and focused audience, filter, catalogue, and event-outline components.
- `lib/types.ts`: shared sample-domain types.
- `lib/catalogue.ts`: local catalogue fixtures with local slug IDs.
- `lib/catalogue-import.ts`: bounded, strict, atomic CSV parsing and validation with Papa Parse.
- `lib/workspace.ts`: validation, filtering, default/example inputs, and selection helpers.
- `lib/qloo-types.ts` and `lib/qloo-sample.ts`: bounded application contracts and reviewed sample/interest identities.
- `lib/qloo-service.ts` and `lib/qloo-server.ts`: validated native-fetch matching and server-only environment/request boundary.
- `app/api/qloo/search/route.ts` and `app/api/qloo/rank/route.ts`: explicit server actions over the two allowed upstream paths.
- `components/qloo-matching.tsx`: explicit search, entity confirmation, and live ranking with stale-response protection.
- `components/event-agent.tsx`: explicit Generate/Revise, stale proposal preview, observed run activity, and Apply confirmation.
- `lib/event-types.ts` and `lib/event-validation.ts`: bounded event/proposal contracts, clarification, factual/evidence joins, and agenda validation.
- `lib/event-agent.ts`: the three-model/one-ranking native tool loop and overall cancellation/deadline.
- `lib/gemini-provider.ts`: pinned official SDK transport, explicit key, fixed Google endpoint, bounded responses, and sanitized errors.
- `lib/event-server.ts` and `app/api/event-agent/route.ts`: server-only credentials and HTTP boundary.
- `tests/qloo-service.test.ts`: controlled transport tests; no live Qloo calls.
- `e2e/qloo-matching.spec.ts`: fixture-driven browser matching, errors, preservation, mobile, and keyboard checks.
- `components/catalogue-import.tsx`: local file reading, errors, preview/confirmation, and sample restoration.
- `public/catalogue-template.csv`: downloadable required-column template with an illustrative row.
- `tests/workspace.test.ts`: automated domain behavior checks.
- `tests/catalogue-import.test.ts`: focused offline parser checks.
- `playwright.config.ts`: isolated Chromium runner, server lifecycle, reporters, and failure artifacts.
- `e2e/global-setup.ts`: verifies the configured target is AfterHours and accessible without authentication.
- `e2e/workspace.spec.ts`: independent browser interaction, mobile, and keyboard checks.
- `e2e/catalogue-import.spec.ts`: independent CSV import, preservation, filtering, and mobile journeys.
- `scripts/qloo-smoke.mjs`: manual, credential-gated official CLI book search.
- `scripts/qloo-smoke-fetch.mjs`: diagnostic-only one-request and no-redirect guard.
- `tests/qloo-smoke.test.ts`: offline diagnostic safety and output checks.
- `tests/qloo-smoke-fetch.test.ts`: offline request-budget checks with synthetic transports.
- `.env.example`: empty server-only credential placeholder for matching and local diagnostics.

## Limitations

All inputs, confirmed interests, rankings, proposals, choices, and outline edits live only in the current page session and are lost on reload. Live matching and event planning cover only confidently mapped, eligible sample books and explicit confirmed film/musician signals. They do not resolve imported inventory or automatically interpret audience notes. Gemini proposes activities, not narrative cultural explanations or verified book analysis. Eligibility and affinity do not establish reader suitability or availability at a real shop.

Authentication, databases, persistent/server catalogue uploads, exports, retailer/live-inventory synchronization, and broader entity resolution are deferred. Import is capped at 256 KiB/500 rows and stores no drafts or catalogue across reloads. The fixture catalogue is intentionally small. The existing public production deployment remains unchanged. A protected Preview does not make matching/planning ready for anonymous release: shared quotas, concurrency/spending limits, an access policy, and monitoring remain necessary.
