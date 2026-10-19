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

`npm test` runs only the existing Node domain tests in `tests/*.test.ts`. They exercise stock exclusion, alphabetical order, inclusive price/page boundaries, language filtering, invalid inputs, empty results, fresh default/example state, audience independence, and selection validity. The Node runner uses `--test-isolation=none` for environments that restrict child-process creation.

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

## Limitations

All inputs, choices, and outline edits live only in the current page session and are lost on reload. There are no runtime API calls, Qloo IDs, taste matches, cultural explanations, LLM-generated content, or invented API responses. Eligibility does not establish reader suitability or availability at a real shop.

Authentication, databases, catalogue uploads, exports, live inventory, Qloo matching, and AI planning are deferred. The fixture catalogue is intentionally small. This branch is intended for local review and has not been deployed.
