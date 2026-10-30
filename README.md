# AfterHours

**Describe your club and its tastes; find a cultural focus and turn it into a practical gathering.**

AfterHours is for organizers of reading circles, music societies, film groups, student associations and other clubs. Describe the people and goal in your own words, confirm representative cultural interests, discover a book, artist, movie or place, and review an editable event plan before explicitly applying it.

**Try the [public adaptive demo](https://afterhours-umber.vercel.app)** — no account required. The [public source](https://github.com/watchmk25/afterhours) is MIT licensed. Click **Try an example**, choose **Discover with Qloo** for unrestricted book discovery, keep the 45-minute duration, then **Generate event proposal**. Review conditional requirements before Apply; edit and download the resulting book plan. Shared allowances and provider availability can reject live work; local manual planning remains available.

**Live acceptance — 31 October 2026:** book discovery, explicit Apply and edited Markdown download passed. Additional genuine examples produced an explicitly applied **45-minute Inception (2010) discussion** and a **45-minute conditional Tori Amos artist plan**, each with verified current Qloo evidence. Film participants watch beforehand; screening permissions remain unconfirmed. Musician identity and lawful playback remain unconfirmed for the artist example. **Place and shortlist flows remain live unverified.** See the [sanitized acceptance record](docs/public-club-examples.md), [judge walkthrough](docs/devpost-submission.md#judge-walkthrough--verified-public-book-scenario) and [copy-ready submission story](docs/devpost-final.md#project-story).

The live-tested application is the [PR #7](https://github.com/watchmk25/afterhours/pull/7) merge **`385d7ec75990421909af12dc7e782837f66bcaba`**; subsequent release changes are documentation only. Production stays enabled for judges; Previews remain paused/protected. The [30 October release record](docs/adaptive-continuation-release.md) and [earlier failed public attempt and rollback](docs/adaptive-public-release.md) remain dated history. These examples establish neither recommendation quality nor sustained reliability.

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

**Historical checks for the 30 October application release:** the complete controlled anonymous hosted suite passed **44/44 in 98.551 seconds** on `385d7ec…`, one worker, no retries/skips/flaky results and **zero live Gemini/Qloo/Redis calls**. Anonymous page access returned HTTP 200 and the Preview-only diagnostic returned 404. Coverage includes cancellation, limits/errors, evidence/context, revisions, edit preservation, explicit Apply, download, keyboard use and 390px layout. No assertions or fixtures were weakened. These unchanged application suites were not rerun for this documentation update.

**Reused unchanged verification:** **380 Node tests**, **51 focused deadline/provider checks**, lint, TypeScript, production build, **44 local** and **44 protected hosted** Chromium checks passed for implementation `65ba642…`. The merged application tree matches that exact tested source; only documentation differs. These checks were reused, not presented as new executions. The deterministic SDK transport test completes a continuation after 21 seconds. [Deadline policy and protected record](docs/adaptive-continuation-deadline.md).

**Historical live book acceptance — 30 October:** the anonymous public attempt returned HTTP 200, assessed eight current candidates and validated a **45-minute** proposal, preserving edits until explicit Apply and exporting a subsequent edit. First Gemini **1.866 s**, Qloo **0.092 s**, continuation **3.087 s**, validation **4 ms**; valid render **5.693 s**. Exactly **2 Gemini / 1 Qloo**, with no probe, retry, repair, revision or replacement. The continuation finished below the old cap, so success does not establish the earlier latency cause or that the budget change caused faster execution. Earlier failures and protected runs remain separately dated in the [workflow record](docs/adaptive-club-planner.md).

**Additional live examples — 31 October:** Inception used **2 Gemini / 1 Qloo Insights**; Tori Amos used **3 Gemini / 1 Qloo Insights**, including one permitted in-run validation repair. Each used one Generate, eight current candidates, an exact 45-minute agenda and explicit conditional acknowledgment/Apply. There was no replacement generation. Current candidate and evidence membership and the applied fields were checked; neither non-book journey offered Markdown export. The artist's musician-identity warning remains unresolved. [Inputs, results and limitations](docs/public-club-examples.md). Publishing this documentation makes no new live Gemini, Qloo or Redis calls.

The saved [audience comparison](docs/qloo-feasibility.md) changed scores and numerical contributions **without changing ordering**. [Coverage findings](docs/qloo-coverage-review.md) preserve unresolved identities. Neither record proves recommendation quality or adoption.

Trusted diagnostics (`npm run qloo`, `npm run usage`, `npm run qloo:feasibility`) are manually invoked separate tools. They retain their existing request behavior and were **not run** in this release task. Do not run them as routine application tests.

## Scope and license

No accounts, saved workspaces, uploads to a database, booking, retailer synchronization, song-level data, LLM/provider framework or additional model is added. The browser-only Markdown download does not persist the workspace. Expanded live support requires separately authorized verification against actual provider responses; unknown account access, quotas and metadata variations remain limitations. Review generated suggestions and conditional requirements before organizing an event.

Original project code is [MIT licensed](LICENSE). Dependencies and external providers retain their own licenses and terms. Anonymous repository access and GitHub MIT detection were rechecked. Production serves the verified adaptive application with its live switch true; local and Preview live settings stay paused and Preview protection remains enabled. The prior accepted deployment is preserved as rollback, not the current public version. Final Devpost submission remains the entrant's action; see the [submission draft](docs/devpost-submission.md).
