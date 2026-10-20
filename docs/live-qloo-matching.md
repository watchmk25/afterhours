# Live matching verification

Verified locally on 2026-10-20 from `feat/live-qloo-matching`, based on
`c27993e7c184a06e50d28760095d9ec62a9aac19`. The existing public deployment,
`main`, dependencies, smoke diagnostic, and feasibility tools were not changed.

## Runtime contract

The browser calls only explicit POST `/api/qloo/search` and `/api/qloo/rank`
actions. The server alone reads `QLOO_API_KEY`, fixes
`https://hackathon.api.qloo.com`, and uses native fetch with `X-Api-Key`.
Search uses GET `/search`, movie/artist type, and at most three candidates.
Insights uses GET `/v2/insights`, `filter.type=urn:entity:book`, an explicit
`filter.results.entities` shortlist, `signal.interests.entities`,
`sort_by=affinity`, `feature.explainability=true`, and the shortlist size as `take`.
These are the [documented Insights parameters](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md)
and the contract observed in the feasibility experiment.

Only reviewed preset references or signed, expiring search choices are accepted.
Client-supplied inventory, mappings, origins, arbitrary entity IDs, and unconfirmed
notes are rejected or unused. Eligibility uses the bundled catalogue and existing
stock, price, page, and language rules on the server. There is one upstream fetch
per accepted action, a ten-second whole-response deadline, no redirects/retries,
and no recorded-result fallback. Only selected identity/score fields leave the
server; raw provider errors and warning strings are withheld.

## Automated checks

- Lint and TypeScript checks passed.
- All **128 Node tests** passed, including 26 new controlled-service tests.
  They cover missing credentials/invalid input making zero requests, server-owned
  eligibility and mappings, partial coverage, signed choices and expiry,
  shortlist membership, HTTP/transport/schema failures, sanitization, deadlines,
  body limits, and the observed response fields. No test contacts Qloo.
- The production build passed on installed Next.js 16.4.2. Cache Components uses
  the default Node runtime; no incompatible route `runtime` export is used.
- All **27 Chromium tests passed** against the local **production** preview at
  `http://localhost:3000`, one worker and no retries. Existing workspace/CSV
  assertions were retained; only the old banner assertion changed to accurate
  live-matching copy. New journeys intercept the local Qloo routes using
  controlled responses, including errors, intentionally delayed responses,
  returning filters to their previous values, and cancellation of CSV previews.
- Direct local HTTP boundary checks passed for invalid search/JSON, cross-origin
  requests, body size, content type, imported inventory, tampered interests, and
  unsupported methods. Each is rejected before upstream dispatch.

Run the checks with:

```powershell
npm run lint
npm test
npx --no-install tsc --noEmit
npm run build
# In a separate terminal, with port 3000 free:
npm start
# Then, in the test terminal:
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3000'
try { npm run test:e2e } finally { Remove-Item Env:PLAYWRIGHT_BASE_URL }
```

The runner does not start a development server when an explicit base URL is set.
No real credential is needed for the automated suites. The existing Node child
transport test and Chromium require permission to launch local processes.

## Three-request live check

A fresh Chromium context exercised the local production UI with the existing
ignored server credential. Exactly **three upstream requests** were dispatched:

1. One Amélie film search, followed by explicit radio selection and confirmation
   of `Amélie`, movie, `2001`,
   `B7A0731F-EC92-496A-9C40-47D9770489B6`. Other returned films were
   *Little Amélie or the Character of Rain* (2025) and *Mountain Miracle* (2017).
   Search did not automatically rank.
2. One ranking for Example A: Amélie (2001) and Norah Jones.
3. One ranking for Example B: Interstellar (2014) and Hans Zimmer.

All three local API actions returned HTTP 200 with validated successful Qloo
responses. The application exposes exact upstream HTTP status on failures,
but does not return it separately on success; success establishes an accepted
2xx provider response, not independently recorded provider status metadata.
No redirects, retries, follow-up resolution, pagination, or additional probes
were made. The search confirmation itself makes no request. The two ranking
actions deliberately replaced the confirmed list with the respective fixed pair.

Both requests used default limits (INR 600, 400 pages, all sample languages)
and the same server-derived four-book shortlist. Five of ten sample mappings
are reviewed; The Palace of Illusions is out of stock. **Four of seven eligible
books were assessed** in both responses. Godaan, Pather Panchali, and The Blue
Umbrella remain eligible and browsable but unresolved at the provider-ID level.

| Returned position | Book | Audience A affinity | Audience B affinity |
|---|---|---|---|
| 1 | The God of Small Things | 0.7412713778821529 | 0.6801410057905225 |
| 2 | The Namesake | 0.7179884704476631 | 0.6662579354738624 |
| 3 | The Guide | 0.6437325781964618 | 0.6414568420115073 |
| 4 | Malgudi Days | 0.6154423826453885 | 0.5714336093052628 |

Both supplied numerical per-book contributions for both interests and aggregate
`effect_on_all_recs` metadata; no explanation warning was returned. Aggregate
average input scores were Amélie **0.5877621245669408**, Norah Jones
**0.41223787543305923**, Hans Zimmer **0.5306632077235656**, and Interstellar
**0.46933679227643443**. The UI labels contributions by confirmed interest and
rounds displayed values to four decimal places. It does not invent narratives
or interpret affinity/contributions as probabilities.

All returned books belonged to the submitted shortlist. The same ordering with
different scores is a valid finding; this small technical check does not measure
recommendation quality, cultural representativeness, or individual preference.

## Browser artifacts and limits

The local ignored `playwright-report/index.html` and `test-results/results.json`
record automated results. Full-page controlled and live 390px screenshots include
eligible books and an edited selected outline. Desktop and 390px captures were
visually reviewed; the measured document/control/card bounds fit without
horizontal overflow. Actual Tab, Space, Enter, and typing journeys check focus,
checkboxes, candidate confirmation, book selection, and outline editing.

Live screenshots are retained locally as
`artifacts/playwright/qloo-live-desktop.png` and
`artifacts/playwright/qloo-live-mobile-390.png`. A minimal sanitized local record
is `artifacts/playwright/qloo-live-results.json`; it contains no token, credential,
header, or raw upstream response. Generated artifacts are not committed.

Chromium/emulated layouts were verified; other browsers and physical devices
were not. Imported catalogues remain session-only local filtering/template data
and cannot use sample Qloo mappings. Search confirmations expire, unassessed
books are not declared absent from Qloo, and explanation fields may be omitted
by the provider. At this historical matching checkpoint AI planning and
authentication were unconnected. The later [event-agent record](event-agent.md)
documents live planning, and the [hosted Preview record](hosted-preview.md)
covers protected release verification. The public production website remains
unchanged; application authentication is still deferred.
