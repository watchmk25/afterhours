# AfterHours

**Describe your club and its tastes; find a cultural focus and turn it into a practical gathering.**

AfterHours is for organizers of reading circles, music societies, film groups, student associations and other clubs. Describe the people and goal in your own words, confirm representative cultural interests, discover a book, artist, movie or place, and review an editable event plan before explicitly applying it.

**Release status — 30 October 2026:** the adaptive planner is merged on main through [PR #4](https://github.com/watchmk25/afterhours/pull/4), with a test-clock correction in [PR #5](https://github.com/watchmk25/afterhours/pull/5), at `771202c6ea2d95d9c796b0db72e7547d9e0c8b47`. Its public controlled checks passed **44/44**, but the single anonymous live attempt timed out on the second Gemini request after fresh Qloo discovery. The [public demo](https://afterhours-umber.vercel.app) was therefore restored to the earlier accepted book workspace, source `910ac80cf08bcfb4e288b418609e83cd841c506f`. **The public demo currently differs from main.** [Source and MIT license](https://github.com/watchmk25/afterhours) are public; GitHub's MIT detection and anonymous repository access were rechecked.

The adaptive book journey previously passed on a protected Preview, including explicit Apply and edited-plan download; that does not make the failed public attempt a success. See the [30 October release outcome and rollback](docs/adaptive-public-release.md), [protected acceptance](docs/adaptive-club-planner.md#switch-status-correction-and-new-acceptance-allowance--30-october-2026), and [historical public book-workspace acceptance](docs/public-release.md). The journey below describes the adaptive source. Use the [submission draft's separate public-demo walkthrough](docs/devpost-submission.md#public-demo-walkthrough--restored-book-workspace) for the restored site.

## One organizer journey

1. **Describe a gathering.** Enter any club description, a goal, duration and group size. Location and a monetary budget are optional; budgets include currency and a per-person or total-event basis. Book edition constraints appear only for a book focus.
2. **Confirm cultural interests.** One visual picker searches supported books, artists, movies and places. After three characters and a 475 ms pause it makes one mixed search, with up to eight results and no category fan-out. Check names, type badges and supplied disambiguation, then click or press Enter to confirm. Reviewed example suggestions require no request. Only confirmed chips influence matching; optional audience notes do not.
3. **Discover or bring a shortlist.** Qloo can discover beyond the sample books. For mixed or unclear goals, choose a primary cultural focus or deliberately use organizer-led planning. **Try an example** reveals illustrative sample inventory and Example A, without provider calls. **Use my own list** is an optional local CSV route, with preview and confirmation.
4. **Generate and review.** Generation includes its own fresh Qloo discovery/ranking; a separate discovery action is optional. Gemini uses one native function call, receives current-run Qloo candidates and evidence, then proposes an agenda. An explicitly chosen focus is honored or a conflict is reported. No recorded response replaces a failed live operation.
5. **Apply deliberately.** Review the proposal, its exact agenda total, and compact evidence/constraints. Unknown costs, availability, rights and other requirements make feasibility conditional and require acknowledgment. Apply is explicit. Existing edits survive errors, cancellation and input changes; an applied plan retains historical input context rather than silently regenerating.
6. **Take a book plan away.** Edit the applied book outline and choose **Download event plan**. The browser saves the current edits and accurately labelled saved context as Markdown; it makes no provider request. Artist/movie/place exports are not claimed.

Qloo supplies identities, returned order, affinity and available numerical interest contributions. Gemini supplies **creative activity suggestions**, not proof of cultural affinity or verified practical arrangements. Scores are **not probabilities**. Qloo's artist type does not itself establish that a result is a musician. Film discussion may concern a film watched beforehand; a short event cannot promise a full screening of a longer film.

## Run locally

Use Node.js 24 LTS and the locked dependencies:

```sh
npm ci
npm run dev
```

Open the local URL printed by Next.js, normally http://localhost:3000. Manual planning, CSV parsing, local filtering and reviewed examples need no keys or network requests. Provider thumbnails are optional: only allowlisted public Qloo image URLs are fetched, without credentials or redirects; failure shows a fallback.

For a local production preview:

```sh
npm run build
npm start
```

Workspace inputs, imported resources, confirmed search results and drafts are page-session only and are lost on reload. Reset clears inputs, selected focus and event while retaining the active catalogue; destroying a dirty draft requires confirmation. Restore sample catalogue is separate from loading the full example. Changing back to old inputs does not revive an invalidated proposal.

**Download event plan** saves the selected book’s current edited outline as a UTF-8 Markdown file entirely in the browser. Sample and imported fixed templates are supported. For an applied AI proposal, the file separates the edited event from saved interests, filters, coverage, numerical Qloo evidence and warnings, and labels previous-input context as historical. Edited timings are not revalidated; scores are not probabilities. Downloading sends no provider request and changes no selection, draft or proposal.

## Optional resource CSV

Download the [generic resource template](public/club-resource-template.csv) or the [original book template](public/catalogue-template.csv). Both support UTF-8/BOM, CRLF, quoted commas, escaped quotes and quoted newlines. Limits remain **256 KiB and 500 data rows**. The whole file is validated before an explicit atomic import; cancellation or invalid files preserve inventory, selection and edited event.

The original book columns remain supported:

```csv
title,author,price_inr,pages,language,stock
The Guide,R. K. Narayan,299,256,English,18
```

Generic required columns are `type,name`. Optional columns are `creator,price,currency,price_basis,pages,language,stock,duration_minutes,external_id_type,external_id`.

- Types: `book`, `artist`, `movie`, `place`; books also require `creator` (author). Distinct creators and types retain separate local identities even when names match. Songs, personal member records, PDFs and images are unsupported.
- Price: finite, nonnegative, at most 1000000; requires an uppercase three-letter currency and `per_person` or `total_event`. No currency conversion or implicit basis conversion occurs. Pages and duration are positive whole numbers up to 100000; stock is a nonnegative whole number up to 1000000. Edition page/language fields apply to books. Names/creators are at most 200 characters, languages 80.
- External IDs: checksum-valid `isbn13` for books, `imdb` title IDs for movies, `spotify` artist IDs. An external lookup still requires explicit confirmation of the returned identity. Otherwise matching uses identifying names/creators, never the first result automatically.
- Only a **selected batch of up to five rows** can be explicitly matched. Each unresolved selected row costs at most one lookup; a 500-row upload never triggers bulk resolution. Unresolved and ambiguous rows stay visible and unassessed. Only confirmed identities enter ranking, and returned shortlist membership is checked.
- File parsing stays in the browser. **Explicit matching/planning sends only the selected bounded rows, identifying metadata, organizer facts, constraints and confirmed references to the server.** The raw file and unselected rows are not uploaded. Relevant bounded context then reaches Qloo/Gemini; do not put personal or confidential data in it. Data and provider metadata are never tool instructions.

Imported numeric facts are organizer-supplied, not Qloo evidence. Sample prices, stock, pages and languages remain clearly illustrative and server-derived; only five of ten sample books have reviewed mappings. Unknown hard constraints never become silently satisfied. No current retailer prices, tickets, bookings, artist attendance, fees, tracks, rights or edition facts are invented.

## Server configuration and shared controls

Use [`.env.example`](.env.example) for names only; preserve an existing ignored `.env.local`. No key uses `NEXT_PUBLIC_` or enters browser props. Process variables take precedence over Next.js environment files; restart after changing configuration.

| Setting | Purpose |
| --- | --- |
| `QLOO_API_KEY` | Issued hackathon credential, fixed upstream `https://hackathon.api.qloo.com`. |
| `GEMINI_API_KEY` | Gemini Developer API key; `GOOGLE_API_KEY` is not used. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite`, minimal thinking, pinned SDK 2.30.0. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Existing shared Redis store for atomic admission, pacing and leases. |
| `AFTERHOURS_USAGE_SECRET` | Server-only secret for bounded trusted visitor hashes. |
| `AFTERHOURS_LIVE_ENABLED` | Operator switch; false/unset rejects live work before provider dispatch. |

Keys alone do not enable local live requests. Trusted Vercel visitor identity and shared store admission are required; ordinary local requests fail closed. Do not fabricate hosting flags or trusted headers. No public fixture bypass is included.

Limits are unchanged: **12 searches, 6 standalone discoveries/rankings and 6 generations per visitor/hour; 100 Qloo requests and 90 conservative Gemini reservations/day globally; 2 concurrent event leases; 12 actual Gemini dispatch reservations per rolling 60 seconds**. An event reserves up to three Gemini requests and one Qloo Insights request. Every continuation/repair is paced. There are no automatic retries, queues or waits for allowance.

Each uncached debounced search and each explicit shortlist lookup consumes one search/Qloo allowance. Recent identical queries are reused for 20 minutes in this page (at most 30 cached queries); starter examples use none. **Exploratory typing can exhaust 12 searches/hour**; debounce does not remove that capacity constraint or secretly increase quotas. Provider TPM, other applications, and work already accepted remotely remain outside this policy. Cancellation does not refund quota.

Normal generation is **Gemini → one Qloo tool call → Gemini continuation**, at most 3 Gemini/1 Insights per run, within the unchanged 30-second work deadline. The first adaptive request stays capped at 20 seconds; after the tool, a continuation or permitted repair can use up to 28 seconds, always limited to remaining run time minus a two-second completion reserve. Legacy callers retain their 20-second cap. Qloo remains capped at ten seconds and the remaining run time. Store operations are at most one second; lease cleanup has its independent bounded deadline. Missing configuration, invalid inputs and failed admission cause no provider dispatch. See the [exact adaptive deadline policy](docs/adaptive-continuation-deadline.md), [usage controls](docs/usage-controls.md), [pacing](docs/gemini-pacing.md), and [adaptive Qloo contract](docs/club-qloo-contract.md).

## Verification

```sh
npm run lint
npx tsc --noEmit --incremental false
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Node tests remain independent from Playwright. Browser tests use controlled API fixtures, one worker, no retries and retained failure traces/screenshots. They intercept every application API and prevent live provider/store traffic. For a production-build target, start it separately and set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3100` (PowerShell: `$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:3100'`); an explicit target never starts a local server. Public/authorized Preview URLs must be HTTPS origins. Existing protected testing tooling remains separate and unchanged.

**Release verification — 30 October 2026:** all **373 Node tests** passed on final release source `771202c…`. The complete anonymous hosted Chromium suite passed **44/44 in 98.007 seconds**, with one worker, no retries/skips/flaky results and **zero live Gemini/Qloo/Redis calls**. It covers revisions, errors, cancellation, evidence/context, edit preservation, explicit Apply, download, keyboard use and 390px layout. A failing debounce check was corrected by pausing Playwright's clock; the product debounce, fixtures and assertions were preserved. Lint and TypeScript passed for that test-only correction. The earlier passing production build is reused because application code is unchanged. [Exact release checks](docs/adaptive-public-release.md#verification).

**Live evidence is separate:** the protected unrestricted-book journey passed at `12c1235…`, with **2 Gemini / 1 Qloo Insights**, a valid 45-minute proposal rendered in **13.209 seconds**, explicit Apply and download of a subsequent edit. The new public attempt at `771202c…` used **2 Gemini / 1 Qloo Insights** and failed with `504 GEMINI_DEADLINE` after **23.064 seconds**; edits survived, but no valid proposal or Apply/export acceptance resulted. No retry was made. Artist/movie/place and shortlist live acceptance remain **unverified**. Neither individual success establishes sustained reliability. Earlier local export (368 tests/21 browser checks) and adaptive completion (370/44) results remain dated in the [workflow record](docs/adaptive-club-planner.md), rather than being presented as new checks.

The saved [audience comparison](docs/qloo-feasibility.md) changed scores and numerical contributions **without changing ordering**. [Coverage findings](docs/qloo-coverage-review.md) preserve unresolved identities. Neither record proves recommendation quality or adoption.

Trusted diagnostics (`npm run qloo`, `npm run usage`, `npm run qloo:feasibility`) are manually invoked separate tools. They retain their existing request behavior and were **not run** in this release task. Do not run them as routine application tests.

## Scope and license

No accounts, saved workspaces, uploads to a database, booking, retailer synchronization, song-level data, LLM/provider framework or additional model is added. The browser-only Markdown download does not persist the workspace. Expanded live support requires separately authorized verification against actual provider responses; unknown account access, quotas and metadata variations remain limitations. Review generated suggestions and conditional requirements before organizing an event.

Original project code is [MIT licensed](LICENSE). Dependencies and external providers retain their own licenses and terms. The repository remains public. Production is restored to the accepted earlier deployment; the Production project switch is false for future builds, while that immutable restored deployment retains its original settings. Local and adaptive Preview switches are false and Preview protection remains enabled. The [release record](docs/adaptive-public-release.md#restoration-and-final-state) distinguishes these snapshots and the remaining public adaptive-release blocker.
