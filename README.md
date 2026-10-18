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

```sh
npm run lint
npm test
npm run build
```

The dependency-free Node tests exercise stock exclusion, alphabetical order, inclusive price/page boundaries, language filtering, invalid inputs, empty results, fresh default/example state, audience independence, and selection validity. The test runner uses `--test-isolation=none` to work in environments that restrict child-process creation.

Browser interaction and responsive layout checks should cover: editable favourites; Load example; Reset and Reset filters; combined filters; invalid numeric inputs; deselecting all languages; no matching books; selecting/editing an outline; retaining a draft for still-eligible books; clearing it after invalidation; and mobile/keyboard use.

Verified for this implementation: lint, all ten automated domain tests, and the production build pass. The local preview returned HTTP 200 and rendered the sample notice, seven default eligible books, and fixed-template label. Domain checks also confirm the exact English example (₹450 / 300 pages), narrowed limits (₹200 / 100 pages), and empty result (₹100), plus negative/blank validation and selection eligibility. These checks do not verify browser interactions.

On the verification retry, the browser connector exposed no browsers and native Windows `get_window_state` timed out twice after refreshing the target. Browser interactions, draft persistence/reset in the rendered UI, navigation scrolling, keyboard operation/focus, and 390px layout/overflow remain unverified. An HTTP response alone does not verify these checks.

Section links retain their anchor destinations and hover/focus styles. The permanently active Workspace underline and `aria-current="page"` were removed because the links navigate sections of the same page, without tracking the current section.

## Structure

- `app/`: Next.js App Router page, root metadata/layout, local icon, and global styles.
- `components/`: workspace state and focused audience, filter, catalogue, and event-outline components.
- `lib/types.ts`: shared sample-domain types.
- `lib/catalogue.ts`: local catalogue fixtures with local slug IDs.
- `lib/workspace.ts`: validation, filtering, default/example inputs, and selection helpers.
- `tests/workspace.test.ts`: automated domain behavior checks.

## Limitations

All inputs, choices, and outline edits live only in the current page session and are lost on reload. There are no runtime API calls, Qloo IDs, taste matches, cultural explanations, LLM-generated content, or invented API responses. Eligibility does not establish reader suitability or availability at a real shop.

Authentication, databases, catalogue uploads, exports, live inventory, Qloo matching, and AI planning are deferred. The fixture catalogue is intentionally small. This branch is intended for local review and has not been deployed.
