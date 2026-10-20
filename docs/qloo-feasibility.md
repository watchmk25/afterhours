# AfterHours: local Qloo feasibility experiment

Conducted on 2026-10-20 from verified source checkpoint
`4628b329fcf8626a592dedad591cca8dbfc79ad5`. The sample UI, catalogue fixtures,
filtering, hosting, dependencies, and the original one-request smoke command were
preserved.

**Finding:** the assigned API supports ranking an explicit book shortlist with
film and artist signals, including numerical explainability in the same response.
Both audiences returned the same ordering here, with different affinity and
explanation values. This establishes technical feasibility for this small set,
not recommendation quality.

## Operation and request accounting

The [official Insights deep dive](https://github.com/qloo/docs-public/blob/main/reference/insights-api-deep-dive.md)
documents `filter.results.entities` for restricting result IDs,
`signal.interests.entities` for cross-domain signals, `sort_by=affinity`, and
`feature.explainability=true`. The
[book parameter guide](https://github.com/qloo/docs-public/blob/main/reference/available-parameters-by-entity-type.md#book)
supports the shortlist and signal parameters. The installed pinned harness is
`@qloo/qloo-harness` 0.1.26; its actual `api insights --help` and implementation
were inspected before calling.

All calls used `https://hackathon.api.qloo.com`, the issuer-assigned origin,
`GET`, and `X-Api-Key`. The process-scoped base and trust overrides agree.
The existing complete credential came from ignored `.env.local`; no credential
or header value is retained here.

The live plan was fixed before ranking:

- Nine `GET /search` book searches, one for each source book except the previously
  verified Narayan Guide. Each used its actual catalogue title, book type, and
  `take=3`.
- Four `GET /search` seed searches, one per fixed film/artist, with movie/artist
  type and `take=3`.
- Two `GET /v2/insights` calls, one per fully resolved audience, with the same
  four book IDs, explicit two-entity signals, `take=4`, affinity sorting, and
  explainability requested.

**Actual count: 15 dispatched requests (9 + 4 + 2), all HTTP 200.**
Every child made one guarded fetch. There were no redirects, retries, pagination,
follow-up entity requests, alternative seeds, or extra exploration calls. The
Guide ID reuse consumed zero additional requests.

The higher-level `qloo exec rank` workflow was deliberately not used: inspected
source can resolve UUIDs through extra entity calls and its client may retry.
The direct CLI route makes one API request. Its stdout drops aggregate response
metadata, so a bounded fetch interception captured the actual response envelope
from that same call. Only reviewed identity/year fields, request parameters and
status, actual ranking fields, and explanation metadata were retained. Book
blurbs, images, tags, full request URLs, raw errors, headers, and credentials
were discarded.

## Inventory coverage and local constraints

The experiment imports `SAMPLE_CATALOGUE` and the existing default input/filter
functions from source; no duplicate inventory or eligibility implementation was
introduced. Defaults are maximum INR 600, maximum 400 pages, all available sample
languages (English, Hindi, Bengali), and positive stock. All these inventory
values are illustrative fixtures.

Resolution is intentionally conservative at the **Qloo ID** level. Shared
title/author/year across several IDs establishes a plausible work match but may
not establish which provider ID represents the inventory item. No popularity,
search position, language-looking text, or sample page count was used to break
such ties.

| Local inventory ID | Book / author | Default eligible? | Resolution and experiment use |
|---|---|---|---|
| `the-namesake` | The Namesake — Jhumpa Lahiri | Yes | Resolved: unique exact title, book type, `2003, Jhumpa Lahiri`. Ranked. |
| `godaan` | Godaan — Munshi Premchand | Yes | Unresolved: two IDs with `1936, Munshi Premchand`; multilingual title does not establish edition/ID. Excluded. |
| `the-blue-umbrella` | The Blue Umbrella — Ruskin Bond | Yes | Unresolved: two IDs share exact title and `1980, Ruskin Bond`. Excluded. |
| `a-suitable-boy` | A Suitable Boy — Vikram Seth | No: INR 899, 1,488 pages | Unresolved conservatively: whole-work/series-labelled and volume IDs; no authoritative edition mapping. |
| `pather-panchali` | Pather Panchali — Bibhutibhushan Bandyopadhyay | Yes | Unresolved: three `1929` same-author IDs with subtitle/translation variants. Excluded. |
| `the-guide` | The Guide — R. K. Narayan | Yes | Reused previously verified `1958, R.K. Narayan` ID. Ranked. |
| `the-palace-of-illusions` | The Palace of Illusions — Chitra Banerjee Divakaruni | No: stock 0 | Resolved: exact title and `2008, Chitra Banerjee Divakaruni`; other same-title author excluded. Not ranked. |
| `malgudi-days` | Malgudi Days — R. K. Narayan | Yes | Resolved: exact title and `1943, R.K. Narayan`; Books LLC compilations excluded. Ranked. |
| `raag-darbari` | Raag Darbari — Shrilal Shukla | No: stock 0, 448 pages | Unresolved conservatively: original/translation-labelled IDs with the same author/year. |
| `the-god-of-small-things` | The God of Small Things — Arundhati Roy | Yes | Resolved: exact title and `1997, Arundhati Roy`; study/reader-guide authors excluded. Ranked. |

Coverage: **5/10 catalogue IDs resolved**, including the reused Guide; **4/7
locally eligible books resolved**. Unresolved means insufficient unique-ID
evidence under this experiment's cap, not absence from Qloo. Some unresolved
records clearly concern the intended literary work.

Local inventory IDs stay separate from Qloo UUIDs. All reviewed UUIDs and reasons
are in [the resolution record](qloo-feasibility-resolutions.json). Candidate
alternatives are retained in [the sanitized result record](qloo-feasibility-results.json).

The submitted shortlist, in input order for both audiences:

| Local ID | Qloo entity ID |
|---|---|
| `malgudi-days` | `5FE81158-6890-42CB-9F60-439C14174DB4` |
| `the-god-of-small-things` | `F74BAA1D-6C16-4EED-9BD7-304FB321A0A2` |
| `the-guide` | `DF4272D0-A6BA-445B-88DC-172A56B5D183` |
| `the-namesake` | `CE8065B9-1496-4B0D-B5A6-5D486C867A98` |

## Fixed audiences

| Audience | Fixed seed | Returned type / evidence | Selected Qloo ID |
|---|---|---|---|
| A | Amélie (2001) | `urn:entity:movie`; exact name, release year/disambiguation 2001 | `B7A0731F-EC92-496A-9C40-47D9770489B6` |
| A | Norah Jones | `urn:entity:artist`; exact solo artist, collaborations excluded | `CFB97CDA-1B2D-4F1A-B707-415E76AFC016` |
| B | Interstellar (2014) | `urn:entity:movie`; exact feature title/year, companion documentary excluded | `057DA9D9-399B-437E-8BCA-A80E499125EF` |
| B | Hans Zimmer | `urn:entity:artist`; exact solo artist, collaborations excluded | `37DB91E9-9EE1-4C98-AA01-0AF0C34274EC` |

All four seeds resolved. No seed was replaced after observing ranking results.
Both requests used `filter.type=urn:entity:book`, the exact same CSV
`filter.results.entities`, each audience's fixed film/artist CSV in
`signal.interests.entities`, `sort_by=affinity`, `take=4`, and
`feature.explainability=true`. Exact serialized parameters are saved per request.

## Actual rankings and scores

The table position is the returned array order, not an invented API rank field.
Scores below are the actual `query.affinity` values; they are not probabilities.

| Returned position | Book (same order for A and B) | Audience A: Amélie + Norah Jones | Audience B: Interstellar + Hans Zimmer |
|---|---|---|---|
| 1 | The God of Small Things | 0.7412713778821529 | 0.6801410057905225 |
| 2 | The Namesake | 0.7179884704476631 | 0.6662579354738624 |
| 3 | The Guide | 0.6437325781964618 | 0.6414568420115073 |
| 4 | Malgudi Days | 0.6154423826453885 | 0.5714336093052628 |

Every returned ID was a member of the submitted shortlist; both responses returned
all four exactly once. No foreign, duplicate, or missing book was found.
The responses also supplied a separate `popularity` field, retained by its actual
name in the JSON. It was not used as entity-resolution confidence or relabeled
as affinity.

Ordering was **unchanged**. Affinities and contribution metadata differed between
audiences. This shows the endpoint accepted and processed the different signal
sets, but does not demonstrate different recommendations, causal explanations,
or measured reader satisfaction.

## Explainability actually observed

Both responses supplied per-book
`query.explainability["signal.interests.entities"]` arrays with entity IDs and
`score`, plus aggregate
`query.explainability["signal.interests.entities"]` maps with
`effect_on_top3_recs`, `effect_on_top5_recs`, `effect_on_top10_recs`, and
`effect_on_all_recs` arrays containing `avg_score`.

No `query.explainability.warning` was returned in either response. The top-5 and
top-10 labels were supplied even though only four books were returned; they are
recorded as provider fields, not evidence of additional books or requests.

For example, for The God of Small Things:

- A: Amélie `score=0.6263674956034208`; Norah Jones
  `score=0.3736325043965792`.
- B: Hans Zimmer `score=0.5517437393200487`; Interstellar
  `score=0.4482562606799512`.

Aggregate `effect_on_all_recs`:

- A: Amélie `avg_score=0.5877621245669408`; Norah Jones
  `avg_score=0.41223787543305923`.
- B: Hans Zimmer `avg_score=0.5306632077235656`; Interstellar
  `avg_score=0.46933679227643443`.

These are numerical input-contribution fields. No human-language explanation of
cultural suitability was returned or invented. Full retained per-book and
aggregate values are available offline in the sanitized JSON.

## Probe and verification

`npm run qloo` / `qloo:smoke` retain their existing one-request behavior.
The separate probe is manual:

~~~sh
npm run qloo:feasibility
npm run qloo:feasibility -- verify
~~~

No argument prints usage only. `verify` makes zero requests and verifies saved
budget/membership invariants; its PASS does not by itself establish experiment
completion. The saved ledger here separately records all 15 successful calls.

The authorized live phases used:

~~~sh
npm run qloo:feasibility -- search
# Human review into docs/qloo-feasibility-resolutions.json
npm run qloo:feasibility -- rank
~~~

The saved experiment is now complete. Search/rank refuse repeated stages; the
budget is exhausted. Do not delete its ledger to retry it. This is a local,
single-process experiment, not a concurrent service or resumable job system.

Verification passed:

- 102 Node tests, including 27 focused feasibility model/guard checks.
- Lint and TypeScript checks.
- Offline saved-record verification: 15 reserved/dispatched, both audience
  rankings, four eligible resolved books, no stopped failure.
- Rejection tests for a sixteenth request, altered hosts/parameters, redirects,
  duplicate requests, foreign/duplicate results, and unresolved book inclusion.
- Existing smoke diagnostic assertions remain intact. No live smoke rerun was
  made, and the UI/build/browser suite was not rerun for unchanged application code.

The stored responses are reduced observations, not complete API response dumps.
This experiment has no recommendation-quality benchmark, ISBN-based inventory
mapping, new catalogue sources, bias calibration, repeated-run variance test, or
real audience evaluation. Provider-ID ambiguity and conservative coverage are the
main next-step limitations. Future repeat experiments need a separately agreed
request budget and preserved provenance.

**Conclusion:** the API supports the intended technical sequence of cross-domain
signals ranking a constrained inventory shortlist. This specific experiment
found stable ordering with changed affinity/explanation values. Different rankings
would demonstrate responsiveness, not recommendation quality; unchanged rankings
are a valid result.
