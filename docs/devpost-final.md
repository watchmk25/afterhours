# AfterHours — final Devpost submission pack

Copy-ready text for entrant review, updated **31 October 2026** from saved public acceptance evidence. This documentation is ready for publication; the Devpost entry has not been submitted. Detailed counts and engineering records stay outside the project story.

## Project name

AfterHours

## One-line pitch

Turn your club's film and music tastes into a cultural focus and a gathering plan you can make your own.

## Project story

### Inspiration

A bookstore organizer has a room for an evening and a reading circle to bring together. The group loves different films and musicians, but that does not immediately answer two practical questions: what should everyone read, and what should happen when they meet? Choosing a title and planning a welcoming discussion are separate jobs. AfterHours connects them, using confirmed cultural interests as the starting point and leaving the organizer in control of the final gathering.

### What it does

An organizer describes the group and goal, sets a duration and group size, and adds relevant preferences such as budget, book length and language. They confirm the film or music identities they mean, rather than silently treating free-text notes as resolved interests. Reviewed examples make it easy to start. Unrestricted discovery can propose a book, a movie for discussion or an artist focus. An illustrative catalogue and browser-local CSV import offer other ways to organize resources, with unknown practical facts kept visible.

### How it works

Qloo supplies cultural evidence: current candidate identities, affinity ordering and available numerical contributions from the confirmed interests. Gemini starts a native tool call, receives that fresh Qloo result, then proposes a cultural focus and gathering activities using the returned evidence. The server checks candidate membership, cited evidence, authoritative constraints and an agenda that totals the requested duration. Qloo's scores are not probabilities; Gemini's activities and invitation are creative suggestions, not provider-verified cultural explanations. Removing Qloo removes this grounded live path; a deliberately labelled manual template remains separate.

### Built for the organizer's last edit

A proposal is a preview, not an instruction to replace the organizer's work. Existing edits remain intact while the organizer reviews the focus, agenda, evidence and conditional requirements. Only explicit Apply populates the editable event. For book plans, the organizer can then adjust the wording and download the current plan as readable Markdown. The download includes those actual edits, with saved evidence and input context kept separate. The useful output travels beyond the browser without pretending that manual timing edits were revalidated or that non-book export is available.

### How it was built and what was learned

The workspace uses Next.js, React and TypeScript, with server-only Qloo requests and the Google Gen AI SDK for Gemini's native Interactions flow. Papa Parse handles local CSV parsing. Shared Upstash Redis operations provide admission limits, pacing and expiring generation leases. Provider work is bounded, cancellation propagates, and automatic retries are disabled. The hardest lesson was preserving trustworthy boundaries: a matching title is not always a uniquely identified book, an unknown price is not an affordable copy, and generated wording must not become evidence. Errors and late responses must preserve the draft rather than substitute a convincing sample result.

### Accomplishments

The public book journey completed from confirmed Amélie and Norah Jones interests to current Qloo candidates, a validated 45-minute proposal, explicit Apply and a download containing a subsequent edit. Further genuine examples produced an Inception (2010) discussion for a campus film society and a conditional Tori Amos artist plan for a music appreciation circle. Both used current evidence and explicitly applied 45-minute agendas. A saved audience comparison changed scores without changing ordering; these demonstrations do not establish recommendation quality, adoption or improved attendance.

### Current limitations

Unknown inventory and edition facts need confirmation. Film participants watch beforehand; screening permissions remain unconfirmed. The artist example does not independently establish musician identity or lawful playback. Place and shortlist flows remain live unverified, and Markdown export is book-only. Workspace data is session-only and lost on reload. Provider availability and shared allowances can reject live work; these examples do not establish sustained reliability.

### What's next

The next step is observing real organizers using the workflow, then evaluating whether its choices and activities are useful to their groups. Further work should strengthen identity and availability evidence and verify the remaining flows. Those are future goals, not claims of completed research or integrations.

## Built with

- Qloo Insights API and entity search — cultural candidates and numerical evidence.
- Gemini Developer API, `gemini-3.5-flash-lite`, and Google Gen AI SDK (`@google/genai` 2.30.0) — native tool calling and event proposals.
- Next.js 16.4.2, React 19.3.0 and TypeScript — application and server routes.
- Tailwind CSS 4 — responsive presentation.
- Upstash Redis REST API and atomic Lua operations — shared usage controls.
- Papa Parse 5.7.0 — browser-local CSV parsing.
- Node.js 24 and Vercel — runtime and hosting.
- Playwright/Chromium and Node's test runner — controlled verification.

## Links

- Public demo: <https://afterhours-umber.vercel.app>
- Public source and MIT license: <https://github.com/watchmk25/afterhours>
- Current source and documentation: <https://github.com/watchmk25/afterhours/tree/main> — the final documentation merge SHA is recorded in the publication handoff.
- Live-tested application source: <https://github.com/watchmk25/afterhours/tree/385d7ec75990421909af12dc7e782837f66bcaba> — later changes are documentation only.

## Judge walkthrough

1. Open the public demo and click **Try an example**. Confirm **Amélie** and **Norah Jones**, **Book**, **45 minutes** and group size **12**.
2. Expand **Budget and relevant constraints (optional)**. Keep **450 INR / Per person**, **400** maximum pages, and Bengali/English/Hindi. Unknown edition, price and stock facts will still need confirmation.
3. Click **Discover with Qloo** to choose unrestricted discovery mode; leave no selected focus. Do not run the separate **Discover options** action—generation includes fresh discovery.
4. Click **Generate event proposal** once. Review the returned book, current numerical evidence, conditional requirements and exact 45-minute agenda. Do not expect a particular book or a guaranteed response time.
5. Acknowledge the conditional requirements and explicitly **Apply proposal**. Edit the title, then **Download event plan**. Verify that the Markdown contains the current edit and separately labelled saved context. Existing drafts are preserved before Apply; a new draft is optional for this short walkthrough.

If a service/limit error appears, retain the draft and follow the displayed guidance rather than repeatedly generating. These are judge instructions, not a new automated live allowance. Updating this story made no provider/store calls; it reuses the saved acceptance evidence.

## Screenshot selection and captions

Files are in the ignored local folder `artifacts/playwright/submission-assets/`. See its `captions.md` for provenance and upload order.

1. `01-setup-overview.png` — **Public organizer setup. Newly captured provider-free UI; no generated result.** Suggested cover image.
2. `02-real-public-acceptance-desktop.png` — **Saved real public acceptance: current Qloo book options and the explicitly applied, subsequently edited event plan.** Unchanged desktop original.
3. `03-real-public-acceptance-mobile.png` — **The same saved real acceptance at 390px: conditional book facts, editable agenda and Markdown download.** Unchanged mobile original.

The two acceptance images are long full-page captures: open them at native resolution/zoom for readable detail. Focused crops `04-tastes-and-qloo-book-crop.png` and `05-applied-event-and-agenda-crop.png`, plus optional `06-mobile-editor-crop.png`, are unchanged rectangles from those same originals. Do not label the provider-free overview as a live proposal.

Additional film and conditional artist examples have their own real proposal/evidence, entity and applied-plan screenshots under `artifacts/playwright/submission-assets/club-examples-2026-10-31/`, with captions under 140 characters in its `captions.md`. These are separate runs, not frames from the book video. The artist captions preserve the unconfirmed musician-identity and lawful-playback conditions. See the [sanitized record](public-club-examples.md).

## Entrant-only final checklist

- Paste the name, pitch, story and Built with entries into their Devpost fields; use the public demo/source links above.
- Upload selected images with their captions. An optional 75.2-second narrated real book demo, synchronized SRT and narration script are saved under `artifacts/playwright/submission-assets/demobites-afterhours/final/`. Its DemoBites export is unpublished. Review and upload manually if desired; it does not depict the later film/music runs.
- Confirm your Devpost public name/profile, previously stated solo-entry membership, eligibility, third-party rights and required attestations. No profile or teammate has been invented.
- Review the entry preview, submit, and retain the receipt. Final submission remains your action.

**Deadline: 31 October 2026, 09:15 IST.**

Engineering evidence and detailed counts remain in [the release record](adaptive-continuation-release.md), [additional club acceptance](public-club-examples.md) and [the detailed draft](devpost-submission.md), outside the copy-ready story. This publication changes no application code, provider configuration or hosting settings, and makes no claim that the deadline patch caused a faster run.
