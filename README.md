# AfterHours

A sample organizer workspace for independent bookstores and book clubs. Explore books that fit practical limits and adapt an event outline for your next gathering.

**Sample mode — Qloo matching and AI planning are not connected.**

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
- Maximum price per copy in INR, maximum page count, and English/Hindi/Bengali language filters. Filtering updates immediately; invalid numeric inputs or an empty language selection produce field-specific guidance and no results.
- A bundled ten-book catalogue with identifiable title/author pairs. Prices, page counts, stock, edition languages, and display covers are illustrative fixtures, not retailer or publisher data.
- Only in-stock books satisfying **all** selected constraints appear under **Eligible books**, ordered alphabetically by title. Limits are inclusive. No affinity scores or personalized ranking are computed.
- A helpful empty-results state with a Reset filters control that preserves audience favourites.
- Select an eligible book to edit a fixed event template: title, 75-minute running order, generic discussion prompts, and organizer notes. It is explicitly **not AI-generated**.
- A selection that becomes ineligible is cleared together with its outline and does not return automatically when filters are widened. Filter changes that keep the book eligible preserve the draft. Switching books starts a fresh template.
- **Load example** fills audience favourites and example filters (₹450, 300 pages, English), clearing any selection/outline. **Reset** clears favourites and selection/outline and restores ₹600, 400 pages, and all three languages.

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

`npm test` runs the Node tests in `tests/*.test.ts`, separately from Playwright. Domain tests exercise stock exclusion, alphabetical order, inclusive price/page boundaries, language filtering, invalid inputs, empty results, fresh default/example state, audience independence, and selection validity. Diagnostic tests exercise credential gating and safe smoke-check output using local test fixtures, without Qloo requests. The Node runner uses `--test-isolation=none` for environments that restrict child-process creation.

`npm run test:e2e` runs only `e2e/*.spec.ts`, using pinned Playwright Test 1.64.1 and its own isolated Chromium browser. It does not connect to Brave or alter Windows Computer Use safeguards. Each test starts in a fresh browser context; there is one worker and no automatic retries.

The six browser tests cover:

1. Load example: exactly Malgudi Days, The Blue Umbrella, and The Guide, with English, ₹450, and 300 pages.
2. Select The Guide, edit title and notes, then lower the price limit to ₹400 without switching books; selection and edits persist.
3. Lower the price limit to ₹100; empty results clear the invalid selection and draft. Widening the limit does not resurrect either.
4. Reset: source-defined default filters, blank favourites, and no selected book or stale outline.
5. A 390px viewport: document overflow, application control and card bounds, and a full-page screenshot with eligible books and a selected editable outline.
6. Actual Tab, Space, Enter, and typing: section navigation, visible focus rings, checkbox changes, book selection, and outline editing.

Verification for this change: all six Chromium tests passed against both a fresh development server and the production preview, with one worker and zero retries. The 390px full-page screenshot was visually inspected; narrow-screen cards now use a single full-width column with readable details. Lint, all ten domain tests, and the production build passed. These browser checks cover Chromium and an emulated viewport; other browsers and physical mobile devices are not covered.

### Local server and conflicts

`playwright.config.ts` explicitly uses **http://localhost:3000** as both `baseURL` and the documented [Playwright `webServer`](https://playwright.dev/docs/test-webserver) URL. Locally it reuses a responding server; when absent, Playwright starts `npm run dev -- --hostname localhost --port 3000`. In CI it requires its own server. It never chooses another port automatically.

Before browser interactions, global setup verifies that the response has the AfterHours title and workspace section IDs. A different app or a redirect on port 3000 fails with a target/port-conflict message. Next.js startup and server-lock errors remain visible in the runner output. Inspect the existing server and resolve the conflict manually; the setup does not kill existing processes or delete lock files. Playwright cleans up a server only when that test run started it.

A reused server must serve the current checkout. If its file watcher keeps serving an older stylesheet after source edits, restart that AfterHours server before rerunning. During this setup, an existing dev server served stale CSS; restarting only its verified project process allowed the runner to start the updated checkout without deleting any locks.

To test a production preview, run `npm run build` and `npm start` separately on port 3000, then run `npm run test:e2e` to reuse it. For a visible test browser, use `npm run test:e2e -- --headed`.

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
npm run qloo:smoke
```

The script reads only `QLOO_API_KEY` from the process environment or project-root `.env.local`, using Node's built-in dotenv parser. An explicitly set process value takes precedence, including an empty value. It does not load `.env`, other environment files, or credentials from private harness setup. Without a nonblank key it prints **Qloo credentials not configured**, exits successfully as a skipped diagnostic, and never starts the harness or sends an API request. Configuration alone is not a verified connection.

With a key, it invokes the documented `qloo api search --query "The Guide" --type book --take 3 --json` once. The credential is passed only through the child environment. The endpoint is fixed to the official `https://api.qloo.com`, overriding any private harness base URL. The pinned direct-search implementation makes one fetch and has no automatic retries; the wrapper bounds the whole process to 30 seconds and limits captured output to 1 MiB. It does not use multi-step workflows, pagination, or follow-up entity calls. Failures exit with code 1 and a sanitized category; raw child errors are withheld because upstream text could echo secrets.

On successful CLI completion, the script validates that its JSON output is an array of at most three candidates and prints that JSON with credential-like fields and the configured key redacted. No title/author/ID summary mapping is assumed. Harness 0.1.26 emits the upstream `results` array rather than the complete response envelope, and defaults absent results to `[]`; an empty array does not establish a useful book match. Review the actual returned fields and identify the intended title and author before any future use. No entity is automatically accepted or saved, even if only one candidate is returned. Switching workspace books still starts a fresh local template.

Readiness verification: the missing-credential path was exercised with no harness invocation/API requests. All 26 Node tests (10 domain, 16 diagnostic), lint, the production build, and all six Chromium tests against the production preview passed. The initial development-server browser run timed out waiting for a response within 120 seconds before interactions began; the server configuration was preserved. **Live connectivity and the actual candidate schema are UNVERIFIED: no credential was available, and no live request was made.** Event access, quota, expiry, and whether Qloo unambiguously identifies *The Guide* by R. K. Narayan remain unknown. No sample data is presented as a Qloo response.

The installation audit reported nine development-dependency findings (two moderate, seven high), including transitive harness agent dependencies and the existing lint dependency chain. No broad upgrades or forced audit fixes were applied. The harness is used only for this local diagnostic and is not imported by the web app.

## Structure

- `app/`: Next.js App Router page, root metadata/layout, local icon, and global styles.
- `components/`: workspace state and focused audience, filter, catalogue, and event-outline components.
- `lib/types.ts`: shared sample-domain types.
- `lib/catalogue.ts`: local catalogue fixtures with local slug IDs.
- `lib/workspace.ts`: validation, filtering, default/example inputs, and selection helpers.
- `tests/workspace.test.ts`: automated domain behavior checks.
- `playwright.config.ts`: isolated Chromium runner, server lifecycle, reporters, and failure artifacts.
- `e2e/global-setup.ts`: verifies the localhost target is AfterHours.
- `e2e/workspace.spec.ts`: independent browser interaction, mobile, and keyboard checks.
- `scripts/qloo-smoke.mjs`: manual, credential-gated official CLI book search.
- `tests/qloo-smoke.test.ts`: offline diagnostic safety and output checks.
- `.env.example`: empty local diagnostic credential placeholder.

## Limitations

All inputs, choices, and outline edits live only in the current page session and are lost on reload. The workspace has no runtime API calls, Qloo IDs, taste matches, cultural explanations, LLM-generated content, or invented API responses. The optional local smoke check does not connect Qloo to the workspace. Eligibility does not establish reader suitability or availability at a real shop.

Authentication, databases, catalogue uploads, exports, live inventory, Qloo matching, and AI planning are deferred. The fixture catalogue is intentionally small. This branch is intended for local review and has not been deployed.
