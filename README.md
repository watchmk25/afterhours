# AfterHours

A local organizer workspace for independent bookstores and book clubs. Start with illustrative sample books or import your inventory, explore books that fit practical limits, and adapt an event outline for your next gathering.

**Qloo matching and AI planning are not connected.** The default sample inventory is illustrative; imported inventory comes from your CSV and is not independently verified.

## Run locally

Use Node.js 24 LTS (the built-in TypeScript test runner requires a recent Node version) and npm:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Next.js, normally http://localhost:3000. No environment file, API key, account, or external service is needed. System fonts and locally drawn display covers keep the workspace independent of external assets.

For a production preview:

```sh
npm run build
npm start
```

## Implemented

- A responsive cream-and-green workspace with AfterHours branding and explicit sample-mode messaging.
- Editable audience favourites grouped into books, films, and musicians, one favourite per line. These are collected for future taste matching and **do not influence eligibility** in this version.
- Maximum price per copy in INR, maximum page count, and language filters derived from the active catalogue (English/Hindi/Bengali for the sample). Filtering updates immediately; invalid numeric inputs or an empty language selection produce field-specific guidance and no results.
- A bundled ten-book catalogue with identifiable title/author pairs. Prices, page counts, stock, edition languages, and display covers are illustrative fixtures, not retailer or publisher data.
- Only in-stock books satisfying **all** selected constraints appear under **Eligible books**, ordered alphabetically by title. Limits are inclusive. No affinity scores or personalized ranking are computed.
- A helpful empty-results state with a Reset filters control that preserves audience favourites.
- Select an eligible book to edit a fixed event template: title, 75-minute running order, generic discussion prompts, and organizer notes. It is explicitly **not AI-generated**.
- A selection that becomes ineligible is cleared together with its outline and does not return automatically when filters are widened. Filter changes that keep the book eligible preserve the draft. Switching books starts a fresh template.
- **Load example** fills audience favourites and example filters (₹450, 300 pages, English when available, otherwise all active languages), clearing any selection/outline while retaining the active catalogue. **Reset** clears favourites and selection/outline and restores ₹600, 400 pages, and all languages from the active catalogue.
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

Imported rows receive unique `local-import-` UUIDs, including repeated title/author rows. These identify local catalogue records and are separate from any future Qloo entity ID. Reimporting creates fresh IDs. Imported books use the same in-stock, inclusive price/page, language, and alphabetical filtering, and the same editable fixed event template as samples.

**Reset** retains imported inventory while clearing favourites, selection, and outline and restoring default numeric limits/all active languages. **Reset filters** preserves favourites and inventory. **Restore sample catalogue** switches back to the ten fixtures, selects all sample languages, clears selection/outline, and preserves favourites and numeric limits. These actions are distinct from cancelling an unconfirmed import.

Inventory, inputs, selections, and outline edits are session-only. Reloading returns to the sample catalogue and default workspace; nothing is persisted. No matching, affinity, cultural explanation, or AI planning is introduced by import.

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
npm run test:e2e
npm run build
```

`npm test` runs the Node tests in `tests/*.test.ts`, separately from Playwright. Domain tests exercise stock exclusion, alphabetical order, inclusive price/page boundaries, dynamic language filtering, invalid inputs, empty results, fresh default/example state, audience independence, and selection validity. Fourteen parser tests cover field mapping, unique local IDs, quoted fields/BOM/CRLF, logical rows, headers, malformed quoting, atomic rejection, numeric/text validation, exact byte/row boundaries, and bounded errors. Diagnostic tests exercise credential gating and safe smoke-check output using local test fixtures, without Qloo requests. The Node runner uses `--test-isolation=none` for environments that restrict child-process creation.

`npm run test:e2e` runs only `e2e/*.spec.ts`, using pinned Playwright Test 1.64.1 and its own isolated Chromium browser. It does not connect to Brave or alter Windows Computer Use safeguards. Each test starts in a fresh browser context; there is one worker and no automatic retries.

The six original workspace browser tests remain unchanged and cover:

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
- `test-results/<failed-test-name>/test-failed-1.png` and `trace.zip`: retained failure screenshot and trace. Inspect traces with `npx playwright show-trace <path-to-trace.zip>`.
- `artifacts/playwright/`: retained screenshots and the original failure trace from the visual review during this setup.

Generated reports and artifacts are ignored by Git and ESLint. Playwright replaces `test-results/` and `playwright-report/` on subsequent runs; copy a run's artifacts elsewhere before rerunning when you need to retain its history. Browser installation and launch can require local permission for downloads, browser processes, and test workers.

## Optional Qloo connection smoke check

This is a manually invoked, trusted local diagnostic. The sample workspace does not call it and its eligibility, templates, and sample-mode notice are unchanged. Follow the official [hackathon kit](https://github.com/qloo/qloo-hackathon-kit), [API access requirements](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md), and [CLI workflow](https://github.com/qloo/qloo-hackathon-kit/blob/main/starter/cli-workflow/README.md). Use an individually issued event credential and confirm the event quota, expiry, and support contact with the organizers.

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

The diagnostic preloads a small request-budget guard into the harness child. It allows only the single fixed official book search, rejects any second fetch, and exposes redirects without following them. Host and authentication remain those of the official harness; the guard adds no probes or alternate provider.

The script reads only `QLOO_API_KEY` from the process environment or project-root `.env.local`, using Node's built-in dotenv parser. An explicitly set process value takes precedence, including an empty value. It does not load `.env`, other environment files, or credentials from private harness setup. Without a nonblank key it prints **Qloo credentials not configured**, exits successfully as a skipped diagnostic, and never starts the harness or sends an API request. Configuration alone is not a verified connection.

With a key, it invokes the documented `qloo api --verbose search --query "The Guide" --type book --take 3 --json` once. Node launches the absolute harness entry point directly, without a shell or Windows `.cmd` lookup. The credential is passed only through the child environment. The endpoint is fixed to the official `https://api.qloo.com`, overriding any private harness base URL. The pinned direct-search implementation makes one fetch and has no automatic retries; the wrapper bounds the whole process to 30 seconds and limits each captured output stream to 1 MiB. It does not use multi-step workflows, pagination, or follow-up entity calls.

Failures exit with code 1 and report sanitized JSON evidence: observable failure stage, whether the child spawned, numeric process exit code, recognized error code, timeout/signal, and HTTP status only when the harness exposes an actual verbose response line. The harness's structured error code must agree with its observed exit code. A local `AUTH_FAILED` credential-resolution error is distinct from HTTP 401/403; `API_ERROR` alone cannot distinguish a server error from a network problem. Child launch and configuration failures establish no request was sent; a launched child or request log alone leaves delivery unknown. Raw stdout/stderr, error messages, exception objects, stacks, headers, and complete request URLs are never forwarded on failure. Explanations use fixed, recognized categories so even unknown error text cannot leak credentials. No automatic retry follows a failure.

On successful CLI completion, the script validates that its JSON output is an array of at most three candidates and prints that JSON with credential-like fields and the configured key redacted. No title/author/ID summary mapping is assumed. Harness 0.1.26 emits the upstream `results` array rather than the complete response envelope, and defaults absent results to `[]`; an empty array does not establish a useful book match. Review the actual returned fields and identify the intended title and author before any future use. No entity is automatically accepted or saved, even if only one candidate is returned. Switching workspace books still starts a fresh local template.

Initial readiness verification exercised the missing-credential path with no harness invocation/API requests. At that checkpoint all 26 Node tests (10 domain, 16 diagnostic), lint, the production build, and all six Chromium production-preview tests passed. No credential was available for that initial check, so it did not establish live connectivity or the actual candidate schema. Current diagnostic tests also cover process launch, child credential transport using synthetic values, structured errors, timeout/signal, output limits, HTTP evidence, parsing failures, and secret-safe output; they never contact Qloo. See the official [troubleshooting guide](https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/TROUBLESHOOTING.md). Offline readiness and credential presence do not establish event access, quota, expiry, or whether Qloo unambiguously identifies *The Guide* by R. K. Narayan. No sample data is presented as a Qloo response.

The guarded live check on 2026-10-20 launched the harness and observed HTTP 401 (`API_ERROR`, child exit 5), with no timeout or retry. The request reached Qloo, but authentication was not accepted. This does not establish why; the previous opaque attempt's specific cause remains unknown. No candidates were available, so identifying *The Guide* by R. K. Narayan remains unverifiable. No alternative key, endpoint, or follow-up request was tried. The diagnostic fix passed lint, all 74 Node tests (49 diagnostic/guard and 25 workspace/import), and TypeScript checking; application code and dependencies were unchanged.

Dependency triage on 2026-10-19 confirmed nine affected package entries (two moderate, seven high), arising from fourteen individual advisories in three transitive development packages. `npm audit --omit=dev --json` reported zero findings. See [the dependency findings and exposure assessment](docs/dependency-audit.md) for every advisory, installed version, path, and fix constraint. The published Qloo agent shrinkwrap prevents selecting the available `brace-expansion` and Undici patches, while `braces` has no published fix. Update previews made no changes; no overrides, forced fixes, or framework downgrades were applied. The harness remains a local diagnostic dependency and is not imported by the web app. Production-only audit results do not assess build tools, Node's bundled libraries, or separately downloaded tools.

## Structure

- `app/`: Next.js App Router page, root metadata/layout, local icon, and global styles.
- `components/`: workspace state and focused audience, filter, catalogue, and event-outline components.
- `lib/types.ts`: shared sample-domain types.
- `lib/catalogue.ts`: local catalogue fixtures with local slug IDs.
- `lib/catalogue-import.ts`: bounded, strict, atomic CSV parsing and validation with Papa Parse.
- `lib/workspace.ts`: validation, filtering, default/example inputs, and selection helpers.
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
- `.env.example`: empty local diagnostic credential placeholder.

## Limitations

All inputs, choices, and outline edits live only in the current page session and are lost on reload. The workspace has no runtime API calls, Qloo IDs, taste matches, cultural explanations, LLM-generated content, or invented API responses. The optional local smoke check does not connect Qloo to the workspace. Eligibility does not establish reader suitability or availability at a real shop.

Authentication, databases, persistent/server catalogue uploads, exports, retailer/live-inventory synchronization, Qloo matching, and AI planning are deferred. Import is capped at 256 KiB/500 rows and stores no drafts or catalogue across reloads. The fixture catalogue is intentionally small. Hosting the app does not enable any of these integrations or persistence.
