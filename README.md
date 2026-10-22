# AfterHours

**Choose an eligible book using audience film and music tastes, then plan an event you can edit.**

Independent bookstores and book clubs need to choose books they can stock, afford, and finish, then turn that choice into an event. AfterHours brings audience setup, inventory filtering, cultural-taste matching, and an editable event outline into one organizer workspace.

**Try it locally without credentials:** browse samples, import a CSV, filter eligible books, and edit a fixed event template. The protected release from `8892db2` passed all 56 controlled hosted browser checks and one real generation with explicit Apply: 2 Gemini requests, 1 Qloo ranking, and a valid proposal rendered in 5.028 seconds. A fresh protected Preview was verified paused afterward; there is no verified public live-agent URL for this release. The organizer also redeployed Production while retaining the old main source. See the [current hosted acceptance record](docs/hosted-acceptance.md), [release review](docs/public-release-review.md) and [protected Preview handoff](docs/git-preview-deployment.md).

## The organizer journey

1. **Confirm an audience.** Load example visibly confirms Amélie (2001) + Norah Jones, or choose Interstellar + Hans Zimmer. A live search can resolve another film or musician, but the organizer must inspect and confirm the intended entity. Optional free-text favourites remain personal notes and do not influence matching or planning.
2. **Apply practical limits.** Choose a maximum price per copy in INR, maximum page count, and languages. Only in-stock books satisfying every constraint appear under **Eligible books**, alphabetically. Prices, pages, stock, edition languages, and display covers in the ten-book sample are illustrative, not retailer or publisher data.
3. **Request cultural matching explicitly.** Qloo ranks eligible sample books with reviewed provider identities using the confirmed film/music signals. Unassessed eligible books stay browsable and selectable. Nothing calls a provider on page load, while typing, or when loading an example.
4. **Review a proposed event.** Gemini uses a native tool call to obtain a fresh Qloo ranking, then proposes an eligible book and an agenda for the structured duration. The server validates the book, current numerical evidence, and exact agenda total. Generate and Revise leave the selected book and edited outline intact.
5. **Apply deliberately.** Explicit **Apply proposal** replaces the selection and outline. The editable event retains the confirmed interests, assessed coverage, actual numerical evidence/references, warnings, and filter snapshot. Later audience/filter changes preserve edits while the book stays eligible and mark the event **Based on previous inputs**, with a route back to the planner.

### What Qloo contributes

Qloo resolves cultural entities and supplies the actual ordering, affinity values, and available numerical input contributions for an explicit book shortlist. Gemini supplies proposed event wording and activities; it does not replace Qloo's ranking or invent cultural explanations. Scores are relative provider values, **not probabilities, guarantees of enjoyment, or proof of recommendation quality**.

Only **5 of 10** sample titles have confidently reviewed Qloo mappings. At default filters, **4 of 7 eligible books** can be assessed; the mapped Palace of Illusions is out of stock. Unresolved identities remain unresolved rather than being treated as absent from Qloo. The saved comparison of the two example audiences produced different scores/contributions but the same book ordering. See the [feasibility experiment](docs/qloo-feasibility.md), [reviewed identities](docs/qloo-feasibility-resolutions.json), and [coverage review and negative findings](docs/qloo-coverage-review.md).

Imported inventory supports local filtering and fixed templates only. Matching and Gemini planning currently support the sample catalogue; sample mappings are never applied to imported rows, even when titles match.

## Run locally

Use **Node.js 24 LTS** and npm:

```sh
npm ci
npm run dev
```

Open the Local URL printed by Next.js, normally **http://localhost:3000**. Browsing, CSV import, filters, and fixed templates need no environment file, API key, account, or external service. System fonts and locally drawn display covers avoid external asset requests.

For a local production preview:

```sh
npm run build
npm start
```

**Provider keys alone do not enable live actions in the local UI.** Live application requests additionally require shared usage controls and a server-trusted Vercel visitor identity. Ordinary local Next.js requests fail closed. Do not fabricate hosting flags or identity headers to bypass this boundary. Controlled automated tests and trusted local diagnostics are separate workflows.

### Workspace behavior

- Defaults: **₹600**, **400 pages**, and all languages in the active catalogue. Limits are inclusive. Blank, negative, or otherwise invalid limits and an empty language selection show field guidance and no eligible results.
- **Load example** uses **₹450**, **300 pages**, and English when available, otherwise all active languages. It confirms Example A, fills editable optional notes, clears selection/outline/results, retains the active catalogue, and makes zero API calls.
- **Reset** clears confirmed interests, optional notes, selection, outline, and results; it restores default numeric limits and all active languages while retaining the active catalogue. **Reset filters** preserves audience inputs and inventory.
- Selecting a book opens an editable **75-minute fixed template**, labelled not AI-generated. Switching books starts a fresh template. A book made ineligible clears with its outline and does not return automatically when constraints widen.
- A proposal is a separate preview until Apply. Relevant input changes invalidate previews, including changing back to former values; late responses are ignored. Failures and cancellation preserve existing edits and never substitute saved proposals. Manually edited agenda totals are not automatically revalidated.
- All inventory, audience inputs, rankings, proposals, selections, and edits are **session-only** and lost on reload.

## Import your inventory

Use **Download CSV template** in **Your catalogue**, replace its illustrative row, then choose the file. Required, case-sensitive columns are:

```csv
title,author,price_inr,pages,language,stock
The Guide,R. K. Narayan,299,256,English,18
```

The browser parses UTF-8 CSV locally with pinned Papa Parse 5.7.0. The file is never uploaded to a server.

| Rule | Contract |
| --- | --- |
| File limits | At most **256 KiB (262,144 bytes)** and **500 nonblank data rows**, excluding the header. |
| CSV support | UTF-8 BOM, Windows CRLF, quoted commas, escaped quotes (`""`), and quoted line breaks. |
| Headers and rows | Headers may be reordered; surrounding whitespace is trimmed; extra columns are ignored. Required headers must be present and unique. Each row must match the header's field count. Truly blank records are skipped; comma-only and quoted-empty records are validated. |
| Text | Nonempty trimmed `title`, `author`, and `language`. Organizer language labels are retained; different spelling/case produces distinct choices. |
| Numbers | Finite, nonnegative `price_inr`; positive safe-integer `pages`; nonnegative safe-integer `stock`. Zero-price books are allowed; zero-stock books remain imported but ineligible. Currency display rounds to two decimals. |
| Invalid files | Malformed quoting, invalid UTF-8, invalid values, inconsistent widths, invalid headers, or exceeded limits reject the **entire file** with row/column guidance. No partial import occurs. |

Uploading shows a count and up to five representative rows. **Replace catalogue** is the only confirmation action: it clears selection/outline, preserves confirmed interests, optional notes, and numeric limits, and initially selects all imported languages. Invalid files and **Cancel import** preserve the current inventory, selection, edited outline, and matching state.

Each imported record receives a fresh `local-import-` UUID, separate from Qloo entity IDs. **Restore sample catalogue** restores the ten fixtures and all sample languages, clears selection/outline, and preserves audience inputs and numeric limits. **Reset** retains imported inventory. Reloading discards it and returns to samples.

## Server configuration and live controls

The tracked [`.env.example`](.env.example) contains empty server-only placeholders and a default-off live switch. Copy it to `.env.local` **only if that file does not already exist**; edit existing configuration privately rather than replacing it. Actual `.env*` files are ignored, with only `.env.example` tracked. Never use `NEXT_PUBLIC_`, print credentials, or place them in commands, browser configuration, screenshots, or tracked files. Inherited process variables take precedence over Next.js environment files; restart/redeploy after changing settings.

| Setting | Purpose |
| --- | --- |
| `QLOO_API_KEY` | Issuer-provided Qloo hackathon credential. |
| `GEMINI_API_KEY` | Gemini Developer API credential; `GOOGLE_API_KEY` is not used. |
| `GEMINI_MODEL` | Set to **`gemini-3.5-flash-lite`**, as in the example configuration; this model uses documented **minimal** thinking. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | One account-owned Upstash Redis **Free** database, with eviction disabled. |
| `AFTERHOURS_USAGE_SECRET` | Independent server secret of at least 32 characters for hashing trusted visitor identities. |
| `AFTERHOURS_LIVE_ENABLED` | Exact `true` enables admission; **false/unset pauses live actions**. Keep it off until hosting/store verification is complete. |

Qloo uses the fixed assigned origin **`https://hackathon.api.qloo.com`**, `X-Api-Key` authentication, and only the verified `/search` and `/v2/insights` operations. Callers cannot supply inventory values, mappings, or another host. Search is explicit, bounded to 1–100 characters and three candidates; at most five confirmed interests are used. Standalone ranking needs at least two eligible mapped books; planning may use one. Signed search confirmations expire after 30 minutes or a credential change.

The event agent uses pinned `@google/genai` **2.30.0**, the Developer API's native Interactions contract, stateless continuation, and actual function-call IDs/signature-bearing steps. Normal execution uses **two Gemini requests and one fresh Qloo ranking**; the maximum is **three Gemini requests and one Qloo request** per run. It has a **30-second overall deadline**, at most **20 seconds per Gemini request**, and at most **10 seconds for Qloo**, always bounded by remaining run time. No automatic retries or redirects occur. Cancellation propagates to transports but cannot retract already accepted provider work or establish a quota refund.

Event requests use 10–1000 characters and a whole duration from 15–180 minutes. Structured price/page/duration limits remain authoritative: explicit conflicting totals require clarification, while individual activity timings are allowed. A proposal never silently changes the filters.

Shared Redis controls apply across application instances using the same store/namespace:

| Control | Default |
| --- | --- |
| Per-visitor search / standalone ranking / event admissions | **12 / 6 / 6** per one-hour first-admission window. |
| Shared provider reservations | **100 Qloo / 90 Gemini** per 24-hour first-admission window. |
| Event reservation | **3 Gemini + 1 Qloo** before work, even if fewer requests succeed. |
| Gemini pacing | **12 request reservations per rolling 60 seconds**, before every initial, continuation, and repair dispatch. |
| Concurrent events | **2**, with **45-second expiring leases**. |

Store operations use atomic Lua, bounded fetches, and fail closed. Missing configuration, untrusted identity, store failure, exhausted allowance, or pacing denial prevents the next dispatch; a continuation may be denied after earlier work succeeded. Reservations are not refunded. These are conservative admission controls, **not provider billing guarantees or a monetary spending cap**. Redis stores expiring hashed visitor IDs, counters, and random leases/reservations, never prompts, interests, catalogues, outlines, credentials, or raw IPs. See [shared controls](docs/usage-controls.md) and [Gemini pacing](docs/gemini-pacing.md) for exact boundaries, privacy, and failure behavior.

The isolated, manually invoked store check is `npm run usage` (`usage:check` is an alias). It makes zero provider calls, uses an isolated temporary namespace, permits at most ten Redis requests, and requires confirmed cleanup for PASS. It does not establish live provider access or trusted hosting identity.

## Test and verify

Install Playwright's matching Chromium once:

```sh
npx playwright install chromium
```

Run the separate offline suites and build:

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
npm run test:e2e
```

Routine Node and Chromium checks use controlled transports/provider fixtures and make **zero live Gemini/Qloo calls**. Node tests cover filtering, CSV validation, native contracts, evidence/agenda validation, cancellation, and shared controls; shared-state tests execute production Lua in a test-only Wasmoon VM, not a real Redis service. Chromium journeys cover the organizer flow, explicit Apply/edit preservation, errors, keyboard interaction, and 390px layout. These checks do not establish provider access, physical-device behavior, or sustained live reliability.

Playwright uses one worker, zero automatic retries, and **http://localhost:3000**. It reuses a local responding server or starts `npm run dev` if absent; CI starts a fresh server. The preflight checks the AfterHours title and workspace sections. Wrong targets, port conflicts, redirects, and server-lock problems fail visibly; the runner does not kill unrelated processes or delete locks. To check production output, start `npm start` after the build, then run the suite separately.

Set `PLAYWRIGHT_BASE_URL` to an explicit deployed HTTPS origin to test it; loopback HTTP origins are also supported. An explicit URL disables local-server startup/fallback. An empty/invalid value fails rather than reverting to localhost. Protected Preview access uses the existing secure Node-only OIDC/automation transport; credentials never enter browser requests, URLs, cookies, or traces. Authorized testing does not establish anonymous access. See [protected test access](docs/hosted-preview.md) and [the current deployment handoff](docs/git-preview-deployment.md).

Reports: `playwright-report/index.html` (`npx playwright show-report`) and `test-results/results.json`. Failure screenshots/traces and mobile captures are retained under `test-results/`; locally retained review evidence is under `artifacts/playwright/`. All are ignored, and subsequent runs replace generated reports. Historical results, timings, source commits, and screenshots remain in the linked verification records rather than being presented as current release acceptance.

### Trusted local diagnostics

- **`npm run qloo`** (`qloo:smoke` alias): the pinned official harness 0.1.26 performs at most one bounded book search for The Guide, limited to three candidates. With no credential it reports “Qloo credentials not configured” and sends zero requests. Credentials reach the child only through its environment; assigned-origin, one-request, timeout, and no-redirect guards remain separate from the application runtime. Review actual candidate identity rather than accepting the first result.
- **`npm run qloo:feasibility -- verify`**: offline verification of saved experiment results. No argument prints usage. The completed live experiment's persisted ledger must not be reset or rerun to seek a different outcome; see its [request contract and evidence](docs/qloo-feasibility.md).
- **`npm run usage`**: isolated Redis-only verification described above; it is optional and performs real store requests only when deliberately invoked with configured credentials.

## Documentation and project layout

- [Submission/product narrative](docs/devpost-submission.md), [frozen release handoff](docs/release-readiness.md), and [public-release review](docs/public-release-review.md): current claims, release status, and remaining work.
- [Live matching](docs/live-qloo-matching.md), [feasibility](docs/qloo-feasibility.md), and [coverage review](docs/qloo-coverage-review.md): provider contracts, actual evidence, partial coverage, and negative findings.
- [Event agent](docs/event-agent.md) and [audience-to-event journey](docs/audience-event-journey.md): native tools, validation, applied context, and recorded verification.
- [Hosted Preview](docs/hosted-preview.md), [shared controls](docs/usage-controls.md), [pacing](docs/gemini-pacing.md), and [Git deployment handoff](docs/git-preview-deployment.md): access, limits, verification gaps, and deployment procedure.
- [Dependency audit](docs/dependency-audit.md): recorded advisory paths and exposure assessment; not a guarantee that later releases have no findings.

`app/` contains Next.js routes/layout/styles; `components/` contains the organizer UI; `lib/` contains catalogue/filtering, provider contracts, validation, and server-only integrations/usage controls. `tests/` holds independent Node checks; `e2e/` holds fixture-driven Chromium journeys; `scripts/` holds explicitly invoked trusted diagnostics. The CLI harness and test-only Lua VM are not imported by the application runtime.

## Limitations and release status

The sample catalogue is small and illustrative, coverage is partial, and imported inventory has no live provider mapping. Audience examples are hypothetical, optional notes are unconfirmed, and two examples do not establish recommendation quality. Gemini activities and invitations require organizer review; they are not verified literary analysis or cultural explanations.

No application accounts, saved-workspace database, persistent catalogue upload, exports, retailer synchronization, or broader entity-resolution workflow is included. All workspace content is lost on reload. Redis retains usage metadata only. Shared limits depend on store continuity/eviction settings and trusted hosting headers; shared/rotating IPs, fixed-window bursts, other apps using the same provider account, and provider-side work after cancellation remain limitations.

The repository remains private and PR #3 remains draft/unmerged. Preview protection and production remain unchanged. Current shared-control hosted verification, final release access, provider quotas/cost controls, account-owned Free-plan/eviction settings, and monitoring must be confirmed before a public live demo. Historical local/hosted successes predate these current release checks and do not establish sustained performance or public reliability.

## License

Project code is licensed under [MIT](LICENSE). Third-party dependencies and external provider services retain their own licenses and terms.
