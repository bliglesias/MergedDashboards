# SBDC Advisor Helper: design

A Chrome extension (Manifest V3) that sits beside the Advisor Toolbox dashboard. It reads a page, fills forms from a block of text, and moves around the dashboard, one visible step at a time. The advisor watches every step and can stop at any point. Status: built and tested locally, draft PR, not published.

## The problem it solves

The dashboard's Client Intake page has a "Copy for CIC" button. It makes a text block in CIC's own field names (Business Name, Status, Employees FT, the 17 Assistance Requested boxes and so on). Today the advisor pastes that block into the CenterIC client record field by field. The Toolbox makes similar blocks for session notes. The helper does the field-by-field part.

## Related pages

| Page | Why | What the helper does there |
|---|---|---|
| Advisor Toolbox, `sbdc-p3-dd2e46.pages.dev` | The dashboard itself: Client Intake and Toolbox | Always on. Reads the page, opens Intake & brief, collects the CIC block, can fill the intake form from a pasted block |
| CenterIC (CIC) client and session records | Where the CIC block and session notes end up | Off until the advisor adds its address. Then: read the form, match the block to it, fill step by step |
| AZ Corporation Commission business search, `arizonabusinesscenter.azcc.gov/businesssearch` | The Toolbox LLC name check. The old `ecorp.azcc.gov` address now redirects to a login page | Listed, off until the advisor turns it on. "Check the name with AZCC" opens it and types the business name. The advisor presses Business Search |
| Gmail, Outlook on the web, or the computer's mail app | Where the advisor sends the emails the Toolbox writes | No access. "Draft the email" only opens a compose address with the email in it. The advisor presses Send |
| AZ Dept. of Revenue (TPT), IRS (EIN), SBA loans, SBA Forms 413 and 1919 | Linked from the Toolbox tools and checklists | Links only. The helper has no access to these sites |
| Gemini, ChatGPT, Copilot | The Toolbox "AI prompt" buttons open them | Left out on purpose. The helper never puts client details into an AI site |
| Tools server, `sbdc-tools.betbotpicks.com` | The dashboard's own sign-in and tool runs | No access. The helper never calls it and never reads the sign-in token |
| Old Client Intake address, `sbdc-p2-12c2ac.pages.dev` | Only redirects to the dashboard | No access needed |

The CenterIC address for Maricopa is not in the repo or the home base notes, so it is not hard-coded. The advisor types it once under "Sites it can work on" and Chrome asks them to confirm.

## Features

The panel has three parts, top to bottom:

- **The two steps.** "1 Pick up" and "2 Write", always in view. The one the advisor is on is outlined, and step 1 shows a tick and what is held ("12 details ready").
- **This page.** The page's name, one sentence, and only the buttons that fit that page.
- **Quick access**, a bar fixed to the bottom on every page: Toolbox, Copy page, Copy list, Name check and Settings. A button with nothing to work on is dimmed and says why when clicked. Settings (speed, where email drafts open, sites, page extras, related pages) stays hidden until that button opens it. Where this document says "under More", it is now under Settings.

1. **Use the client intake.** On the dashboard, one click picks up the client's details (it calls the dashboard's own "Copy for CIC" builder, so the text is identical).
2. **Fill this page.** On a record page, pairs each detail with a box and shows the list of what it will write: "Write in Business Name", "Choose in Status", "Tick Financing/Capital". Sure matches are ticked. Unsure ones are shown unticked. Start writes them one at a time; One at a time, Pause and Stop are next to it.
3. **Point and fill.** The advisor clicks a box on the page and the helper writes it in.
   - Hovering a box shows what will be written.
   - If the helper does not know what goes in a box, it asks once ("What goes in Company?"), writes the answer, and remembers it for that site. Next time "Fill this page" includes that box without asking.
   - Only the pairing of labels is remembered ("the box called Company gets the Business Name line"), never a client's answers. "Forget what it learned here" under More clears it.
   - Protected boxes are not offered. Clicks on anything that is not a box work as normal.
4. **Use a Toolbox result.** On the dashboard, picks a finished Toolbox run (for example "Format notes for CIC") as the details. On the session record the six CIC headings go into the Notes box as one piece.
5. **Copy this page's details** (under More). Turns what is already filled in on a page into details, so a client's record can be written into the intake form without retyping. Protected boxes are left out.
6. **Copy the list on this page** (under More), then **Put the list into Follow-ups** on the dashboard. Takes a client list such as the CIC "not contacted" list and puts it in the box of the dashboard's "Who's due for follow-up" tool. The advisor checks it and presses Run.
7. **Session fields.** The header of a "Format notes for CIC" result (Date, Contact Type, Time, Contact hours, Status) is written to the session screen in the same run as the notes. A short list of other names for the same box ("Session Date", "Type of Contact", "Contact Hours", "Start Time", "Session Notes") is paired without asking; any other name is taught once with Point and fill. Dates and times are converted for date and time boxes, and "In-person" matches a choice spelled "In Person".
8. **A session log into the Monthly report.** "Copy the list on this page" tells a session log (it has a date and a minutes or hours column) from a client list. A session log goes into the dashboard's "Monthly activity report" box as Date, Client, Minutes and Type, with hours turned into minutes. The advisor presses Run.
9. **Draft the email.** Shown on the dashboard once a Toolbox tool has written an email. Opens it as a new draft in Gmail, Outlook on the web or the computer's mail app, with the address, subject and body filled in. It opens in Gmail unless the advisor picks another under More, because Maricopa accounts are Google accounts. With more than one Google account signed in, Gmail opens the draft in the first one. Nothing is sent. A very long email is cut and says so.
10. **Check the name with AZCC.** Shown on the dashboard once the details hold a business name. Asks Chrome to turn the AZCC site on, opens the public Business Search, types the name into the Business Name box and stops. The advisor presses Business Search.
11. **Client details.** Folded away under the main button. Open it to see, paste or clear the details.
12. **More.** Show the boxes on this page, Go to Intake & brief, fill the intake form from pasted details, speed (Slow, Normal, Fast), where email drafts open, links to related pages, and the list of sites to turn on or off or add.

## Where it can work

- Installed: the live dashboard only.
- The page the advisor opens the helper on (by clicking its toolbar icon) is meant to work straight away, through Chrome's `activeTab` permission, which covers that one tab and shows no warning. Not confirmed yet: whether Chrome grants it when the icon opens a side panel. If it does not, nothing breaks; the next line applies.
- Anywhere else the panel offers one button, "Use it on the pages I open". That asks Chrome once for every `https` page, so advisors who work across several sites are not asked site by site. Chrome shows its own warning and the advisor confirms it. It can be turned off under More.
- Trade-off: that one yes is broad. The helper still injects nothing and reads nothing on a page until the advisor clicks a button there, still skips protected boxes and still never saves. An advisor who prefers can leave it off and turn on single sites under More instead.
- Only `https` addresses can be added.
- On a page that is not turned on, the helper cannot see the address or the content and injects nothing.

## How page driving works

The runner lives in the side panel. A small page agent is injected into the one tab being worked on.

1. **Read.** The agent lists the form boxes with their labels. It finds labels from `<label>`, `aria-label`, table cells to the left (older systems use table layouts), nearby text and placeholders.
2. **Match.** The panel pairs block lines with boxes by label. Each box is used once. Scores below "good match" need the advisor's tick.
3. **Show.** Before each step the page scrolls to the box and draws a ring around it with the value about to go in. A bar at the top of the page says "Advisor Helper · step 3 of 12" with a Stop button.
4. **Wait.** The step pauses for the chosen speed so the advisor can see it.
5. **Fill.** One box is filled. Dates, numbers and times are converted to what the box accepts; lists and choices are matched by their visible text. The step list shows what the box now holds, or why it could not be filled.
6. **Finish.** The panel and the page both say "Nothing was saved or submitted: check the page, then save it yourself."

Ways to stop a run or end pointing: the Stop or Finish button in the panel, the same button on the page, the Esc key on the page, closing the panel, or reloading the page. Switching to another tab pauses a run and ends pointing.

Clicks are separate from fills and much narrower. The helper clicks only a link to the same site, a tab, a section opener or a plain button, the target comes from a recipe packaged in the extension (today: "Go to Intake & brief" on the dashboard), and anything labelled like save, submit, send, delete, pay, sign in or upload is refused.

## What it will never do

- Save, submit, search, send or delete. It never clicks a submit control, never presses Enter and never calls `form.submit()`. The advisor always saves, searches and sends.
- Fill or read passwords, payment card boxes, SSN, EIN, tax ID, bank account, date of birth or driver licence boxes, or upload files.
- Sign in anywhere, or read the dashboard's sign-in token.
- Send anything off the computer by itself. The extension pages are blocked from making network requests, and there is no analytics. The one time details leave the helper is "Draft the email": the advisor's own mail site receives the draft's address, subject and body, the same as the dashboard's own email button.
- Keep client details. The details and any copied list are held in memory and are gone when Chrome closes. Only the speed setting, where email drafts open, the list of added sites and the learned label pairings are saved.
- Run by itself. Nothing is injected, read or filled until the advisor clicks a button, and nothing runs on a schedule or in the background.
- Work on a site the advisor has not turned on.
- Solve captchas, or put client details into an AI site.

## Parts

| File | Job |
|---|---|
| `manifest.json` | Permissions, side panel, strict CSP |
| `background.js` | Opens the side panel from the toolbar icon. No state |
| `panel/` | The side panel: page status, block, steps, runner, links, sites |
| `content/agent.js` | Page agent: read boxes, show ring and Stop bar, fill one box, guarded click |
| `lib/parse.js`, `lib/match.js` | Block parser and label matcher (plain functions, unit tested) |
| `lib/sites.js` | Site list, links, turn on / off |
| `lib/mail.js` | Builds the address that opens an email draft (unit tested) |
| `lib/lists.js` | Tells a session log from a client list and tidies it for the report tool (unit tested) |
| `fonts/`, `img/`, `icons/` | Packaged DM Sans and Instrument Serif, the dashboard's landscape, toolbar icons |

## Look

Same theme as the dashboard: the landscape painting behind, solid white cards with 18px corners, DM Sans body, Instrument Serif headings, black pill buttons, small uppercase labels, lime, moss and ochre marks, and the SBDC lettermark at the top left. Light only. Values are copied from `leedlime.css` and `shell.css`.

## Limits in this version

- The helper has not run on CenterIC itself (it needs a sign-in, and testing on a real SBDC system was off limits). On 2026-11-16 Riley shared screenshots of the three CIC screens (eRFC, client, session). The practice page `tests/fixtures/cic-session-mock.html` copies the session screen's box names, order and layout from them. The markup underneath is still a guess, so the first real use should be watched on Slow.
- The session screen's box names are now known from the screenshots: Date, Time, Contact (under a small "Hours" heading), Contact Type, Status and Notes. `lib/match.js` pairs the dashboard's "Contact (hours)" line with the "Contact" box. A box with another name is shown as "Not sure" or is taught once with Point and fill.
- "Check the name with AZCC" was checked once on the live public search page with a made-up name (typed, not searched). Chrome's "allow this site" prompt and the Outlook and mail-app drafts were not checked.
- Top-level page only. Forms inside an iframe are not read yet.
- Rich-text editors (not a plain box) are not filled.
- The side panel follows the active tab in its own window.
