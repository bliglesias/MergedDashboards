# InternDashboard

Utility dashboard that turns inputs into formatted, copyable text.

## Working rules for Claude
- Build ONE phase at a time, then stop for review.
- After each phase report: what was built, what to check in the browser,
  and any assumptions made.
- The user is learning (The Odin Project level): keep code readable, add
  short comments, avoid clever tricks.
- Current status: back on the skeleton (Phase 1). Everything is static
  HTML/CSS. KEEP app.js EMPTY until the user approves the skeleton.
- Structure lives in HTML, look in CSS, content/behavior in JS. When JS is
  added, use <template> elements from index.html instead of building
  elements with createElement.
- Card grid always shows 8 slots; unused ones are "Coming soon".
- HTML conventions: one <h1> (page title, top of row 1); cards are a <ul>,
  stepper is an <ol>; each input panel is a <form>; checkbox groups use
  <fieldset>/<legend>; every button has type="button"; scripts load in
  <head> with defer. Colors only via CSS variables.
- Sidebar has no nav links. It holds a "Forms to give to client" checklist
  (placeholder Form 1-4), each with an "Open" link. Future: load the form
  list from a Google Drive folder (blank forms only, no client data).

## Goal
Single-page dashboard that turns inputs into formatted, copyable text.
No saving: data lives in memory only and clears on refresh. No backend, no
localStorage, no API calls. Everything stays in the browser tab because
client PII may be entered.

## Stack
Plain HTML, CSS Grid, vanilla JS. No frameworks, no build tools.
Files: index.html, styles.css, app.js, data/prompts.js

## Layout (similar to Claude's UI)
- Left: sidebar (nav), 220px
- Center: grid of action cards; the active card's form/input appears below
- Right: output panel, 320px, placeholder boxes that fill live
- Breakpoints: desktop 3 columns (220px 1fr 320px); tablet hides sidebar,
  2 columns; mobile stacks to 1 column with output below the cards

## Card types
- form: fields -> template fills live on every `input` event
- parser: pasted text -> structure extracted into output boxes
- lookup: keyword -> matching items from a static list
- link: opens an outside site in a new tab (<a target="_blank">); no
  panel, never "active", no data sent

## Cards
1. CIC template (form). Fields: name, businessName, businessType,
   annualSales, naics. Output format is a
   placeholder until the real CIC format is provided.
1b. Business startup steps (form, added by user). Checklist of the 10 Arizona
   steps to start a business. Progress shows in a full-width 10-segment
   stepper across the top of the page (styled after the user's reference:
   done = solid bar, current = half bar + "· now", upcoming = gray).
2. Zoom summary (parser). CHANGED by user: input is a pasted Zoom meeting
   summary (not a raw transcript/.vtt). Textarea + "Fill output" button.
   Output fields so far (labels verbatim):
   - "PURPOSE OF THIS SESSION:"
   - "BRIEF DESCRIPTION OF THE BUSINESS AND/OR OWNERS:"
   - "NEXT STEPS & FOLLOW-UP ACTIONS - CLIENT:"
   - "NEXT STEPS & FOLLOW-UP ACTIONS - ADVISOR:"
   - "IMPACT AREA:" (last field; list is complete) Results go into the shared `session`
   object. Old attendees/action items/questions extraction is dropped
   unless the user brings it back.
2b. My template (form, added by user). Staff paste their own template
   using [Field] tags (e.g. [Client Name], [Client Next Steps]); tags are
   replaced with values from the other cards as they're filled. Clickable
   tag chips insert tags. Unknown/empty tags stay as [Tag]. Reason: unclear
   whether clients receive a next-steps summary, so staff control wording.
3. Follow-up email (form). Fields: recipient, date, topic, next steps.
   Pre-fills attendees/action items from `session` if Zoom was parsed.
4. Prompt library (lookup). User types a topic (e.g. "security"); right
   panel shows matching prompts from a static `promptLibrary` array
   ({title, tags, prompt}). Match on tags first, then title/prompt text.
   Clickable quick-tag chips built from all tags. Use 5 sample prompts.
5. AZ business search (link, added by user). Opens the Arizona Corporation
   Commission entity search (https://ecorp.azcc.gov/EntitySearch/Index).
   Just a link: the site has login/captcha, so no automation or scraping.

## Data model
- `actions` array, one object per card: id, type, title, fields,
  template or parse function, prefillFrom
- `session` object for in-memory shared state between cards
- Core functions: renderCards(), renderForm(), fillTemplate(),
  parseTranscript(), searchPrompts()

## Output behavior
- Empty fields show placeholders like [Client Name]
- Copy button on every output box

## Build phases (do one at a time, stop after each)
1. Layout + responsive grid with static placeholder content
2. Render cards from `actions`; CIC card working end to end
3. Follow-up email + Prompt library cards
4. Zoom parser
5. Zoom -> email pre-fill
6. Copy buttons + polish
