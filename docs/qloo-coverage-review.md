# Cultural-taste evidence and catalogue coverage review

## Frozen plan before live execution — 2026-10-21

Starting checkpoint: `5e5af7c578edb6089dd006f85acdfaa1ef3f95e0` on
`feat/event-agent`. Preserve the original feasibility responses/resolutions,
sample catalogue values, eligibility rules, model settings, application UI,
main, production, and protected Preview. No new searches or audience seeds.

Reviewed records: [feasibility](qloo-feasibility.md),
[live matching](live-qloo-matching.md), [event agent](event-agent.md), and
[protected Preview](hosted-preview.md), including their saved sanitized results.
Current coverage is 5/10 mapped sample books, 4/7 eligible at source defaults
(INR 600, 400 pages, all sample languages), and 3/6 eligible at INR 450 with
400 pages and all languages. Three eligible books remain unresolved:

| Inventory book | Existing identifying evidence | Missing evidence |
| --- | --- | --- |
| Godaan — Munshi Premchand | Two book IDs, both `1936, Munshi Premchand` | Unique canonical/edition identity; multilingual title alone cannot choose an ID |
| The Blue Umbrella — Ruskin Bond | Two identical-title book IDs, both `1980, Ruskin Bond` | A reliable distinction between those IDs; the different-author Mike Mason candidate is already excluded |
| Pather Panchali — Bibhutibhushan Bandyopadhyay | Three book IDs, same author and 1929, subtitle/translation variants | Authoritative edition/translation or canonical identity tied to inventory |

The source explicitly labels languages/pages/prices/stock illustrative; they
cannot establish edition identity. No ISBN or publisher/translator identifier
exists in the sample model. A Suitable Boy and Raag Darbari are ineligible under
these constraints; no detail calls are planned for them.

### Planned requests and stop conditions

The official [entity lookup reference](https://github.com/qloo/docs-public/blob/main/reference/get-entities.md)
supports `GET /entities` with `entity_ids`. Installed pinned harness 0.1.26
`api entity --help` and source were inspected: comma-separated `--id` performs
one GET, without internal resolution or retries. The reference does not promise
particular response identity fields; inspect the actual payload first.

1. **One Qloo request:** batched `GET /entities`, restricted to these seven saved
   candidate IDs, in this order:
   - Godaan: `691E457E-04BB-4B22-806F-6745F701094C`,
     `2042C96C-7E0A-4B0E-913E-95A726A59AB9`.
   - The Blue Umbrella: `6DF42DB2-CFE7-4CB5-B3E7-8E102D599F67`,
     `51467D19-5DB2-4003-9734-61E68673668E`.
   - Pather Panchali: `C8412519-DA61-49D8-8B7F-AA565EFC0110`,
     `21FEC03E-6D68-4C53-9698-4AB0916B0B2F`,
     `A1B3351B-1CA1-43CB-86DD-FB1D2D07EC27`.
2. Only if identifying evidence confidently adds at least one eligible book to
   the frozen shortlist, run the actual native agent journey once per existing
   confirmed audience, sequentially A then B. Each receives a fresh Qloo ranking
   and normally two Gemini requests. No standalone ranking, probe, search,
   automatic retry, or audience substitution. If coverage cannot expand, make
   **zero ranking/Gemini requests**, preserve the prior experiment, and record
   the limitation.

**This plan's maximum is three Qloo requests and four Gemini requests**, below
the task's ten/four ceilings. Fixed assigned origin
`https://hackathon.api.qloo.com`, X-Api-Key from ignored local configuration,
manual redirects, ten-second detail fetch/body deadline, 1 MiB response cap,
and a 30-second harness-process deadline. Capture bounded sanitized evidence;
never log credentials, headers, raw errors, or complete request URLs. Stop all
live execution on a provider failure. Do not expand this plan after seeing
rankings; any permitted repair must remain inside the same overall count.

### Frozen conditional A/B comparison

- Identical source catalogue at the starting checkpoint; positive stock;
  maximum INR **450**, **400 pages**; Bengali, English, and Hindi selected.
- Event goal, exact text for both: `Plan a 45-minute interactive event with paired discussion and reflection.`
- Duration: **45 minutes**. Generate independently, no prior proposal context.
- A: confirmed Amélie (2001)
  `B7A0731F-EC92-496A-9C40-47D9770489B6` + Norah Jones
  `CFB97CDA-1B2D-4F1A-B707-415E76AFC016`.
- B: confirmed Interstellar (2014)
  `057DA9D9-399B-437E-8BCA-A80E499125EF` + Hans Zimmer
  `37DB91E9-9EE1-4C98-AA01-0AF0C34274EC`.
- Same confidently expanded assessed-ID set for both, frozen before A.
  Record returned order/scores, selected book, evidence references, validation,
  and rendered latency; do not force selections to differ.

## Results

The single planned batch completed **HTTP 200**, returning all seven requested
IDs exactly once. Total harness/process elapsed time was **5,995 ms**; this is
not an isolated API latency measurement. The actual envelope was
`{"results": [...]}`, an array, rather than the Insights envelope's
`results.entities`. Metadata was inspected from that same response offline;
no second lookup was needed. Identifying fields actually returned are preserved
in [the reduced result record](qloo-coverage-review-results.json). Descriptions,
images, tags, popularity, and reader ratings were omitted.

### Actual identity evidence and decisions

| Book / candidate | Returned ISBN13 / ISBN10 | Returned format / pages | Decision |
| --- | --- | --- | --- |
| Godaan `691E457E…` | `9788172242190` / `8172242190` | Kindle Edition / 432 | Unresolved |
| Godaan `2042C96C…` | Same ISBN13 and ISBN10 | Unknown Binding / pages not supplied | Unresolved |
| The Blue Umbrella `6DF42DB2…` | `9788171673407` / `8171673406` | Paperback / 83 | Unresolved |
| The Blue Umbrella `51467D19…` | `9788131948576` / `8131948579` | Paperback / 64 | Unresolved |
| Pather Panchali `C8412519…` | `9780253201867` / ISBN10 not supplied | Paperback / 316 | Unresolved |
| Pather Panchali `21FEC03E…` | `9788184371215` / `8184371217` | Hardcover / pages not supplied | Unresolved |
| Pather Panchali `A1B3351B…` | ISBN13 not supplied / `0253201861` | ebook / 280 | Unresolved |

Full UUIDs and actual Goodreads identifiers are retained in the result record.
Each record retained the same author/year disambiguation seen in the earlier
searches. No entity-level bibliographic author, language, translator,
canonical-ID, or same-as fields were supplied. Nested translated-description
language fields do not establish a book's edition language. This describes the
observed response, not a guarantee that identifying metadata does not exist
elsewhere.

- **Godaan:** two Qloo IDs share an ISBN and identifying title/author/year, but
  different Goodreads IDs and formats. Neither is marked canonical. Matching
  ISBNs establish overlapping identity evidence, not which Qloo ID to submit.
- **The Blue Umbrella:** the two Ruskin Bond records have different ISBNs.
  Inventory has no ISBN or publisher/edition identifier. Its illustrative
  96 pages cannot select between 83- and 64-page provider records.
- **Pather Panchali:** three formats and multiple ISBNs remain. The paperback's
  ISBN13 `9780253201867` corresponds to the ebook's ISBN10 `0253201861`, despite
  their different title-language cues. Inventory has no authoritative ISBN,
  edition, or translator. Its illustrative Bengali/320 pages do not resolve a
  unique provider ID.

No mapping was added. None of these books is classified as absent from Qloo.
Neither search position, popularity, Goodreads ratings, apparent metadata
richness, nor illustrative inventory values were used as a tie-breaker.

| Coverage | Before | After |
| --- | ---: | ---: |
| Mapped catalogue books | 5/10 | **5/10** |
| Default eligible books: INR 600 / 400 pages / all languages | 4/7 | **4/7** |
| Frozen conditional comparison: INR 450 / 400 pages / all languages | 3/6 | **3/6** |

### Taste effects supported by the saved experiment

The original experiment is preserved byte-for-byte. Its two confirmed audiences
used identical default constraints and the same four assessed IDs. Reusing
those saved responses yields the following comparison, with **no new ranking
requests**. Values below are rounded for readability; the original JSON retains
full precision. Delta is A minus B, not a probability or a quality measure.

| Position for both A and B | Book | A affinity | B affinity | Delta |
| --- | --- | ---: | ---: | ---: |
| 1 | The God of Small Things | 0.741271 | 0.680141 | +0.061130 |
| 2 | The Namesake | 0.717988 | 0.666258 | +0.051731 |
| 3 | The Guide | 0.643733 | 0.641457 | +0.002276 |
| 4 | Malgudi Days | 0.615442 | 0.571434 | +0.044009 |

The saved contribution arrays identify the actual audience inputs. For the top
book, A reports Amélie `0.6263674956034208` and Norah Jones
`0.3736325043965792`; B reports Hans Zimmer `0.5517437393200487` and Interstellar
`0.4482562606799512`. These are provider numerical contributions, not narrative
claims about a reader or the novel.

This is evidence that the returned **scores and numerical contributions varied
with the two input signal sets**. The ordering and top book were unchanged; it
does **not** demonstrate changed recommendations or measured quality. The
previous event-agent acceptance turns labelled A/B changed the price limit
(450 to 300) while retaining one audience, so their different selected books
are not a controlled test of cultural-taste effects. The single hosted turn
also tested only audience A.

### Conditional agent comparison and actual request totals

The assessed shortlist could not be expanded confidently. As planned, the new
audience A/B agent comparison was **not run**: no new native-tool traces,
proposals, selected books, or rendered latencies exist for it. Do not present
saved results as new live outputs. Actual task totals are **one Qloo request,
zero Gemini requests**, no retries, redirects, new searches, standalone probes,
or provider failures. The existing fifteen-request experiment is historical
and is not included in this task's count.

## Verification and remaining limitation

Offline detail-guard checks passed for exact assigned origin/parameters/auth
propagation, rejection before dispatch, manual redirects, a one-request limit,
and synthetic-secret redaction. Verification completed:

- **53 existing Node tests passed:** Qloo service, feasibility model, and fetch
  guard suites; all use controlled fetchers and zero live calls.
- `npm run qloo:feasibility -- verify` passed offline, retaining the original
  15-request ledger, four eligible resolved books, and both saved audiences.
- Offline checks confirmed all seven reduced identities and metadata match the
  received response, no missing/foreign/duplicate IDs, unresolved books stay
  excluded, coverage remains 4/7 and 3/6, and actual new request counts are 1/0.
- Git checks confirmed the original feasibility responses/resolutions, sample
  catalogue, and application mappings are unchanged; whitespace checks passed.

Only README and the new documentation/evidence files changed. No lint, build,
TypeScript, or browser rerun was needed for unchanged application code; prior
218 Node / 47 hosted Chromium / lint / TypeScript / build results remain
historical, not newly executed checks. Routine verification makes zero live
requests. Application code, mappings, catalogue,
dependencies, models, prompts, deadlines, UI, main, production, repository
privacy, and Preview protection remain unchanged.

The concrete next requirement is an authoritative inventory ISBN/edition (and,
where relevant, translator/language) plus a reliable provider canonical-ID rule
or duplicate-resolution confirmation. An ISBN alone would still not choose
between Godaan's duplicate IDs. Until that evidence exists, forcing mappings
would inflate coverage and weaken the experiment. More audiences, repeated
queries, or inventory changes were not used to seek a ranking reversal.
