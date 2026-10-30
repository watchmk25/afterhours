# Additional public club acceptance — 31 October 2026

This sanitized record summarizes saved genuine public-app runs, reviewed for the final documentation update. It supplements the [30 October book acceptance](adaptive-continuation-release.md); earlier records remain dated history. No new provider/store request, application change or hosting-setting change is part of publishing this record.

Public app: <https://afterhours-umber.vercel.app>. The live-tested application is [`385d7ec75990421909af12dc7e782837f66bcaba`](https://github.com/watchmk25/afterhours/tree/385d7ec75990421909af12dc7e782837f66bcaba); the reviewed pre-update main `6525144000c82ab190dc779beba1e33352f034c7` differs only in documentation. This update must preserve that application tree.

## Actual scenarios and request ledger

Both new examples used fresh anonymous browser contexts sequentially, unrestricted discovery, 45 minutes and group size 12. There was no monetary budget, selected candidate, imported resource, page limit or language restriction. Reviewed interests were chosen from the existing suggestions without entering search text. A client-side request-budget guard permitted one real planning POST per scenario and blocked other API actions; responses were not mocked or replaced.

| Scenario | Confirmed interests | Actual selected entity | Current options | Agenda minutes | Reported Gemini / Qloo Insights | Explicit Apply |
| --- | --- | --- | ---: | --- | --- | --- |
| Campus film society | Example B: Interstellar + Hans Zimmer | Inception (2010), Movie | 8 | 5 + 15 + 15 + 10 = 45 | **2 / 1** | PASS |
| Music appreciation circle | Example A: Amélie + Norah Jones | Tori Amos, Artist | 8 | 5 + 15 + 10 + 15 = 45 | **3 / 1** | Conditional PASS |

The actual total was **two Generate actions, two planning POSTs, five Gemini requests and two Qloo Insights requests**. Counts came from the public planning responses. There were no standalone searches/discovery calls, revisions, automatic transport retries or replacement generations. The music run's first proposal failed validation; the existing permitted in-run repair produced the final valid proposal within its three-request cap. The public response does not expose the rejected draft or its rejection reason, so neither is inferred.

Film began at **00:37:28 IST** and music at **00:38:59 IST** on 31 October. Valid proposals were visible after **4.689 s** and **5.313 s**, respectively. These are observed single-run UI times, not guarantees or evidence that the continuation patch caused faster execution. Redis operations were not instrumented; their count is unknown, not zero. Existing admission, pacing and lease controls remained active. No Redis diagnostic was repeated.

## Evidence and validation

Both runs passed requested entity type, selected membership in the current candidate set, cited finite numerical-evidence membership, positive whole agenda minutes summing exactly to 45, the completed native Qloo tool trace and replay through the existing proposal validator. Conditional acknowledgment was required before Apply. Applied title, format, every agenda field, materials and invitation matched the returned proposal. Neither non-book plan offered **Download event plan**.

| Actual provider evidence | Inception | Tori Amos |
| --- | --- | --- |
| Entity ID | `18B098FD-3D84-4609-BFF3-ADF9A0B00E40` | `81543F43-7114-4E2F-8AC0-52399BE0D5AD` |
| Affinity | 0.9210816385707445 | 0.9404495005255908 |
| First input contribution | Interstellar: 0.5031010291159008 | Norah Jones: 0.5060436986694437 |
| Second input contribution | Hans Zimmer: 0.4968989708840992 | Amélie: 0.4939563013305564 |

The proposal cited these current facts for its selected entity. Values are **not probabilities or narrative cultural explanations**. Eight assessed discovery options is not sample-inventory coverage. The separately saved audience comparison changed scores without changing ordering; these examples do not prove recommendation quality, adoption, attendance improvements or sustained reliability.

## Conditions preserved

**Film:** Qloo returned Inception with disambiguation “2010, Christopher Nolan” and a 148-minute runtime. The actual plan requires participants to have watched it beforehand and allocates only discussion and reflection within 45 minutes. It does not schedule a full screening. Access and any screening permission remain `needs_confirmation`, source `unknown`; Apply does not secure rights.

**Artist/music:** the returned Tori Amos record has broad Artist type, empty metadata and disambiguation repeating the name. It does not independently establish musician identity. The format, invitation and saved assessments retain the musician-identity and lawful-playback conditions. Listening equipment is optional. No songs, track lists, links, fees, attendance or performance availability were invented or arranged. This is a **conditional artist-planning acceptance**, not independently verified musician identification.

**Book:** the earlier public run passed book discovery, current evidence, exact duration, edit preservation, explicit Apply and a Markdown download containing a subsequent edit. That export claim remains book-specific. **Place and shortlist flows remain live unverified.** Unknown inventory/edition facts require confirmation; workspace data is session-only.

## Reviewed local evidence and publication boundary

The ignored folder `artifacts/playwright/submission-assets/club-examples-2026-10-31/` contains sanitized `film-result.json`, `music-result.json`, `verification.json`, six native proposal/entity/applied screenshots and `captions.md`. Captions are under 140 characters; screenshots were visually reviewed and contain no credentials, private catalogue or identifiable participant data. Signed entity references were omitted from saved response records. These media, generated records and the task-local helper are **not committed**.

The completed book video remains unchanged against its saved SHA-256 record. It is a separately recorded example, not footage of these film/music runs. No claim is made that its recorder retained an exact Gemini count; the exact book acceptance count above comes from the earlier instrumented acceptance record.

This publication is documentation only: scope/diff, local links and consistency are checked; unchanged application suites are reused rather than rerun. If merging triggers deployment, Ready state, public adaptive content and source-tree equality are checked without Generate or provider/store diagnostics. Production stays enabled and Previews paused/protected; configuration is not changed. See the [detailed submission draft](devpost-submission.md) and [copy-ready story](devpost-final.md#project-story).
