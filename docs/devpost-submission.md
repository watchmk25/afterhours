# AfterHours — Devpost submission draft

Updated **30 October 2026** after successful anonymous public adaptive acceptance. **Ready for entrant review; not submitted.**

## Submission fields

| Field | Submission-ready value / precise status |
| --- | --- |
| Project name | AfterHours |
| One-line pitch | Find a cultural focus your club can gather around, then shape a grounded, editable event plan. |
| Public demo | **<https://afterhours-umber.vercel.app>** — anonymous adaptive book generation, explicit Apply and edited-plan download passed; Production enabled for judges, subject to shared limits/provider availability. |
| Public source | **<https://github.com/watchmk25/afterhours>** — anonymous access and GitHub MIT detection rechecked. Runnable setup is in README. |
| Reproducible live-tested application | **[`385d7ec75990421909af12dc7e782837f66bcaba`](https://github.com/watchmk25/afterhours/tree/385d7ec75990421909af12dc7e782837f66bcaba)**, normal PR #7 merge, application-identical to verified implementation `65ba642…`. A later documentation-only deployment has the same application files; its exact final SHA is distinguished in the release handoff / [PR #6](https://github.com/watchmk25/afterhours/pull/6). No release tag is claimed. |
| License | Root **MIT**, copyright 2026 Mousam Kumar, covering original code. Dependencies/provider terms remain applicable. |
| Entrant/team | Solo entry previously confirmed. Use the entrant's own Devpost profile; confirm public name/profile URL, eligibility and rights. No additional team member or profile is invented. |
| Optional video | Not recorded/verified here; optional. It does not replace the functional published demo. |
| Screenshots | Current real anonymous acceptance: `artifacts/playwright/public-continuation-live-applied-desktop.png` and `public-continuation-live-applied-mobile-390.png`. Choose/upload sanitized screenshots manually; do not label controlled fixtures as live. |

## Project description

### The organizer problem

A reading circle or bookstore needs more than a title: it needs a focus its audience connects with and a practical gathering people can participate in. Organizers may know the films and musicians their group likes before they know what everyone wants to read. AfterHours brings confirmed cultural interests, practical constraints, provider evidence and an editable event plan into one workspace.

The broader interface also accommodates music societies, film groups and other clubs by letting organizers describe their group and goal in their own words. The demonstrated live scenario is book discovery; other supported formats are implemented and tested with controlled responses, not claimed live-verified. We have not established bookstore adoption, attendance improvements, revenue impact or recommendation quality through user research.

### What it does

Describe the gathering, choose duration/group size and optional budget/location, then confirm representative cultural interests. Reviewed Example A (Amélie + Norah Jones) and Example B (Interstellar + Hans Zimmer) require no API request. A mixed book/artist/movie/place picker supports explicit identity confirmation, Unicode/IME, debounce, cancellation and a bounded session cache. Only confirmed chips influence Qloo; optional free-text notes do not silently become cultural signals.

Choose unrestricted discovery, an explicit focus, illustrative sample inventory or an optional imported resource shortlist. Sample prices, stock, pages and languages are clearly illustrative and server-derived. Five of ten sample books have reviewed mappings; unresolved identities stay visible and unassessed. Discovery can return books beyond those samples. Unknown exact prices, edition facts, stock, bookings, access and rights stay conditional rather than being presented as verified inventory.

Generate previews a proposed cultural focus, current numerical Qloo evidence, agenda, materials and invitation. The server validates candidate membership, evidence references, explicit selection and an exact agenda total. Activities and invitation wording are creative suggestions requiring organizer review. Existing edits survive preview, input changes, cancellation and failure. **Apply proposal** is explicit; conditional requirements need acknowledgment. Applied context retains its actual interests, constraints, coverage, evidence and warnings and becomes historical after relevant input changes.

For a book plan, edit the applied outline and **Download event plan** as readable UTF-8 Markdown, generated entirely in the browser. It contains current edits, not an older model proposal, with saved evidence kept separate. Manual timing edits are not claimed revalidated. Sample and imported-book fixed templates can also be downloaded. Non-book Markdown export is not claimed.

Optional CSV import is browser-local, with preview and explicit atomic confirmation, quoted commas/newlines, escaped quotes, UTF-8/BOM and Windows line-ending support, row/column errors, **256 KiB / 500-row** limits, cancellation and reset behavior. Explicit live matching sends only a chosen batch of at most five rows and necessary context; imported identities require confirmation. No full-file bulk lookup happens automatically. Shortlist live acceptance remains unverified. Workspace data is session-only and lost on reload; do not put private member/catalogue information into provider-bound inputs.

### How Qloo and the native agent work together

The normal run is **Gemini → one native Qloo Insights tool call → Gemini continuation**. Confirmed interests and authoritative constraints determine the current Qloo request. Qloo supplies actual identities, candidates, affinity order and available numerical interest contributions; Gemini chooses only within that current result and turns it into creative gathering suggestions. Evidence validation rejects invented IDs/scores or stale results. Without Qloo, this grounded live path cannot pass; the deliberately labelled manual template remains available separately.

The application uses Next.js 16.4.2, React 19.3.0, TypeScript, Tailwind CSS, browser-local Papa Parse, built-in server fetch for Qloo and pinned `@google/genai` 2.30.0 with `gemini-3.5-flash-lite`, minimal thinking and native Interactions continuation. Call IDs/signature-bearing steps stay internal. The agent tool `discover_cultural_focus` cannot override authoritative inputs or change provider hosts. Qloo uses the issuer-assigned `https://hackathon.api.qloo.com`; the pinned harness stays a separate local diagnostic.

The **30-second** run budget remains. The first Gemini request is capped at 20 seconds; a post-tool continuation/repair can use `min(28 seconds, remaining − 2 seconds)`, leaving a completion reserve. Qloo remains capped at 10 seconds and remaining time. Maximum **3 Gemini / 1 Qloo Insights** per run, no automatic retries or runtime fallback. Shared Redis atomic visitor/global reservations, two expiring event leases and rolling **12 Gemini dispatch reservations per 60 seconds** work across instances sharing the store/namespace. Store checks fail closed, and every model continuation/repair is paced. Credentials stay server-only.

### What we verified and learned

The new public run used reviewed Example A, unrestricted book discovery and 45 minutes. It returned eight current Qloo candidates and selected **What I Talk About When I Talk About Running**, returned disambiguation **2007, Haruki Murakami**. The selected ID and all cited evidence belonged to that same response. The agenda totaled **5 + 15 + 10 + 15 = 45 minutes**. Existing edits stayed intact until Apply; conditional Apply succeeded; a later edited title appeared in the downloaded Markdown.

The actual affinity was **0.8395831843212976**, with input contributions **0.5303264245847119** for Amélie and **0.46967357541528815** for Norah Jones. These are provider values, **not probabilities, narrative cultural explanations or proof of recommendation quality**. Exact prices, edition pages/language and current stock remained unknown/conditional.

Valid render took **5.693 seconds**, using **2 Gemini requests / 1 fresh Qloo Insights**. This is one successful anonymous book scenario, not sustained performance. An earlier public attempt hit the old 20-second continuation deadline after fresh Qloo succeeded; that failed release was rolled back and remains dated evidence. The current continuation finished in 3.087 seconds, below the old cap, so success does not establish the original latency cause or attribute faster execution to the policy change. A deterministic controlled SDK transport separately proves completion beyond 20 seconds under the new bound.

The saved audience comparison changed scores/contributions **without changing ordering** for the same four-book shortlist. We did not change seeds until rankings flipped or force ambiguous catalogue mappings. This shows signal-dependent API output, not established user satisfaction or better recommendations. [Feasibility](qloo-feasibility.md), [coverage review](qloo-coverage-review.md).

### Current limits

Artist/movie/place and shortlist flows remain **live unverified**; book discovery is the public acceptance scenario. A broad artist entity does not establish musician identity. Film discussion can concern a film watched beforehand; a short plan cannot imply a complete longer screening or rights. No booking, retailer synchronization, artist attendance/fees, song-level data, persistent account/workspace or guaranteed inventory is supplied.

Shared controls bound application reservations, not provider TPM, other apps using the same account, a monetary cap, per-person identity or sustained availability. Cancellation cannot refund quota already consumed remotely. Provider outages/latency and exhausted allowances may reject work; failures do not substitute a sample proposal or overwrite edits. Free-plan/eviction management settings and current account quotas were not newly audited for this release. Review rights, practical arrangements and generated wording before holding an event.

## Judge walkthrough — verified public book scenario

Open the public demo without an account. These are judge instructions, not an additional automated live allowance; this release's single allowance has been spent.

1. Click **Try an example**. Example A chips should show **Amélie** and **Norah Jones**, with no provider request. Keep the default neighborhood reading-circle description/goal, **Duration (minutes) = 45**, group size 12 and **Primary cultural focus = Book**.
2. Expand **Budget and relevant constraints (optional)**. Confirm **450**, currency **INR**, basis **Per person**, **Maximum pages = 400**, and Bengali/English/Hindi. These are desired constraints; undisclosed edition/price/stock facts will still need confirmation.
3. Optionally reproduce edit preservation before leaving the sample: choose The Guide, switch focus to **Organizer-led / manual**, **Prepare manual template**, explicitly **Apply proposal**, and edit title/notes. Switch back to **Book**. This is local draft preparation, not a provider call.
4. Click **Discover with Qloo** to choose unrestricted discovery mode, clearing any chosen focus while retaining the draft. Leave no selected focus. Do **not** click the separate **Discover options** action; Generate includes its own fresh discovery. No separate search or ranking is needed.
5. Click **Generate event proposal** once. Review the actual current candidates, selected focus and numerical evidence, conditional requirements, and exact **45-minute** agenda. Do not require a particular book. Existing edits should remain intact until Apply.
6. If the proposal is valid, acknowledge the conditional requirements and click **Apply proposal** explicitly. Edit the applied title or another field, then **Download event plan**. Check the Markdown contains that current edit and separate saved context, including unknown facts and scores-not-probabilities wording.

On pause, busy/limit messages or provider failure, stop and retain the draft rather than repeatedly generating until a preferred result appears. Shared allowances may provide retry guidance; no automatic retry is expected. The demonstrated 5.693 seconds is not a latency guarantee.

## Evidence ledger

| Evidence | Result / boundary |
| --- | --- |
| New anonymous hosted controlled suite | **44/44 PASS in 98.551 s**, source `385d7ec…`, one worker, zero retries/skips/flaky results and **0 live Gemini/Qloo/Redis**. Keyboard, 390px layout, cancellation, errors/limits, revisions, evidence/context, Apply and download included. |
| Reused identical-source checks | **380 Node / 51 focused** tests, lint, TypeScript, production build, 44 local and 44 protected controlled Chromium checks passed at tested `65ba642…`; application tree equality verified. Not claimed newly rerun in this release. |
| Protected patch acceptance | **Historical PASS**, `65ba642…`, **2 Gemini / 1 Qloo**, render **8.566 s**, Apply and edited download. [Deadline record](adaptive-continuation-deadline.md) |
| New anonymous public acceptance | **PASS**, `385d7ec…`, HTTP 200, **2 Gemini / 1 Qloo**, eight current candidates, exact 45 minutes, preserved edits, Apply and edited download, render **5.693 s**. [Current release](adaptive-continuation-release.md) |
| Current public stage timings | Pacing **16 / 7 ms**, Gemini **1,866 / 3,087 ms**, Qloo **92 ms**, validation **4 ms**; HTTP response **5,682 ms**, loading **51 ms**. Exact live Redis request total unknown; no repeat Redis diagnostic. |
| Earlier failure / rollback | Prior `771202c…` public attempt: **504 GEMINI_DEADLINE**, **2 Gemini / 1 Qloo**, **23.064 s**, edits preserved, no valid proposal. Preserved as history, not current status. [Earlier release](adaptive-public-release.md) |
| Source/license/access | Anonymous GitHub API 200, public repository, MIT detected. Adaptive page 200; Preview-only Production diagnostic 404. Source and deployment metadata checked separately; GET alone is not live acceptance. |

## Exact remaining entrant actions

The [official overview](https://qloo.devpost.com/) and [rules](https://qloo.devpost.com/rules) were rechecked on 30 October. Deadline: **31 October 2026, 09:15 IST** (30 October, 23:45 EDT). The internal 29 October target has passed. Required materials include a functional externally published demo, public runnable licensed source and project description; a video is optional. English text or an English translation is required. This document does not certify eligibility.

1. Review/paste this project description and public URLs into the Devpost entry. Use the current adaptive walkthrough and the reproducible source pin above, not the restored-fallback instructions from the earlier failed release.
2. Confirm the entrant's Devpost public name/profile, solo membership, eligibility, third-party rights and required attestations. No unknown profile, testimonial, adoption metric or additional member has been filled in.
3. Select current sanitized screenshots. Add an optional video only if actually recorded, labelling any older/protected/controlled footage accurately and hiding credentials. It cannot replace the working public demo.
4. Submit before the deadline and retain the receipt. Keep the enabled demo available during judging; monitor provider/store allowances without claiming a capacity or spending guarantee. Preview remains protected and paused; the prior accepted deployment remains available for rollback. **No final Devpost submission has been performed by this task.**
