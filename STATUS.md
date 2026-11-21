# Advisor Toolbox: merged Client Intake (P2) + Toolbox (P3)

Status: **live** since Nov 14, 2026 at https://sbdc-p3-dd2e46.pages.dev (production of Pages project `sbdc-p3-dd2e46`). The old P2 address https://sbdc-p2-12c2ac.pages.dev redirects to `#/intake/overview` here. The P2 repo itself is unchanged.

## Nov 14 fixes

- The "Server: off · Connect" button no longer floats over card corners. It sits at the right end of the top bar on desktop and in the first row of the phone top bar (on phones it takes the place of the small status badge; the same status is on each page).
- The Readiness circle on the Client Intake overview is light (white center, light gray track) before anything is entered, and fills moss green as the intake fills.

## Rollback

Production before this release: P3 deployment `19c4d880` (https://19c4d880.sbdc-p3-dd2e46.pages.dev), P2 deployment `8ab717df` (https://8ab717df.sbdc-p2-12c2ac.pages.dev). File backups of both: [local backup path removed].

1. Fastest: Cloudflare dashboard, Workers & Pages, the project, Deployments, the old deployment, "Rollback to this deployment".
2. Or redeploy a backup folder: `npx wrangler pages deploy <backup-folder> --project-name <project> --branch main`.

One static site, one sidebar, one sign-in. Product name: **Advisor Toolbox**. The P3 tool area is called **Toolbox**; the P2 area is **Client Intake**.

## Sidebar (desktop)

```
[SBDC wordmark]
Advisor Toolbox
Maricopa SBDC · advisors

Home                          shared overview
■ CLIENT INTAKE               moss #3F6B28 rounded square
  Overview
  Intake & brief
  What to bring
  Form questions
● TOOLBOX                     ochre #C17A3A circle
  Overview
  Tools
SHARED
  Automations                 both areas, filter chips All / Client Intake / Toolbox
  Outputs                     all tool runs
[Your week sparkline + Intake progress bar]
```

Phone (under 992 px): white top bar with the SBDC wordmark + "Advisor Toolbox" and a status badge, a row of area pills (Home · Client Intake · Toolbox), a row of page pills for the area you are in, and a white bottom bar (Home, Intake, Toolbox, Automations, Outputs). The menu button still opens the full sidebar.

## Routes

| New route | Page |
|---|---|
| `#/home` (default, also empty hash and unknown routes) | Home: greeting, one card per area, Follow-ups due, Latest outputs |
| `#/intake/overview` | Client Intake overview (readiness, to ask about, funding, sections, next steps) |
| `#/intake/intake` | Intake & brief |
| `#/intake/bring` | What to bring |
| `#/intake/questions` | Form questions |
| `#/toolbox/overview` | Toolbox overview (sections, latest outputs) |
| `#/toolbox` | Tools (all tool cards) |
| `#/toolbox/<section>` | Tools, scrolled to `before`, `during`, `follow`, `report`, `templates` |
| `#/outputs`, `#/outputs/<tool>` | Outputs (all runs, or one tool) |
| `#/automations` | Automations |

Old bookmarks still work (the address bar is rewritten to the new route):

| Old (P2 / P3) | New |
|---|---|
| `#/overview` | `#/home` |
| `#/intake` | `#/intake/intake` |
| `#/bring` | `#/intake/bring` |
| `#/questions` | `#/intake/questions` |
| `#/toolbox`, `#/toolbox/<section>` | unchanged |
| `#/before` | `#/toolbox/before` |
| `#/during`, `#/after` | `#/toolbox/during` |
| `#/followups`, `#/followup` | `#/toolbox/follow` |
| `#/outputs[/<tool>]`, `#/automations` | unchanged |
| `#/intake/<unknown>` | `#/intake/overview` |

Old P2 *site* addresses (sbdc-p2-12c2ac.pages.dev) redirect here: `#/overview` and an empty hash go to `#/intake/overview`, `#/intake` to `#/intake/intake`, `#/bring` and `#/questions` to their Intake pages, `#/automations` to Automations. Other paths (for example `/bmc`) go to the same path here.

## API project context

`window.SBDC_PROJECT` is set by the router on every page change: `p2` on Client Intake pages, `p3` on Toolbox and shared pages. It is not hard-coded in the shell. Toolbox tool runs still call `p3.<tool>` explicitly (unchanged `toolbox.js`). The Automations page asks the server for both `?project=p2` and `?project=p3` and shows them together, each row tagged with its area; if the advisor only has one project, the other request fails quietly and the page shows what it got. API base is unchanged (`https://sbdc-tools.betbotpicks.com`). Storage keys are unchanged: `sbdc-api-key`, `sbdc-api-base`, `sbdc-api-offline`, `sbdc-advisor-name`, `sbdc-setups`, `sbdc-outputs`, `sbdc-tool-use`, `sbdc-ai`.

## Files

Added
- `shell.js`: router (new routes + old-route map), page titles and breadcrumb, greeting/name, phone menu, phone area/page pills and bottom bar state, Home cards, Automations filter chips, `SBDC_PROJECT` per area.
- `shell.css`: area themes (`[data-space=intake|toolbox|shared]` set only `--tile-*`, `--mark-*`), sidebar groups, Home cards, area tags, filter chips, phone pills and bottom bar, extra solid heading color for in-app browsers.
- From P2 (copied unchanged, then trimmed as noted): `p2.js`, `p2.css`, `cic.js`, `vendor/img/p2-mark.svg`.
- `STATUS.md` (this file).

Changed
- `index.html`: one shell. P2 views (overview, intake, bring, questions) and P3 views (overview, toolbox, outputs, tool modal) are copied in from the two sites' `index.html` with only route links and view ids changed. New Home view and merged Automations view.
- `p2.js`: removed its own router, greeting and phone menu (now in `shell.js`); question search and session .ics now use the new `#/intake/intake` route. Everything else (form, branches, brief, readiness flags, CIC copy, examples, what to bring, form questions, master sheet CSV) unchanged.
- `dash.js`: removed its router, greeting and phone menu (now in `shell.js`). Tool search, usage sparkline and Follow-ups due card unchanged.
- `autos-data.js`: example bots from both sites in one list, each with `area`.
- `autos.js`: P3 version (KPIs come from `toolbox.js`), plus an area tag and `data-area` on each row.
- `autos-server.js`: loads bots for both projects; area tag on each row; dropped the P2-only KPI branch (KPIs on the page are the advisor's own Toolbox bots, as on P3).
- `vendor/tabler.min.css`: the P2 and P3 sites each shipped a trimmed Tabler build with different rules. The file is now P3's build followed by P2's build so both areas have every class they use (same Tabler version, duplicate rules are identical).
- `bmc.html`, `loan-checklist.html`, `assets-worksheet.html`: back link now says "← Advisor Toolbox".
- `README.md`: name, live address and deploy commands.
- `deploy/p2-redirect/index.html` (Nov 14): the page served at the old P2 address. Not part of the P3 site upload.

Shared files that were identical in both repos and kept once: `sbdc-api.js`, `autos-server.js` (before this change), `flair.js`, `app.css`, `print.css`, `vendor/fonts`, `vendor/help-card.webp`, `vendor/img/landscape.webp`. `icons.js` and `flair.css`: P3's copies are supersets of P2's, kept P3's. `leedlime.css`: only the icon theme vars differed; kept P3's and the per-area vars live in `shell.css`.

Not used: P2's `vendor/img/p2-briefing.webp` (not referenced by P2 either). P2 PR #2 (`automations-merge`) was **not** pulled in.

## Features checked (headless Chrome, local static server)

- No JavaScript errors on load or while moving through every route.
- All new routes and every old route in the table above land on the right page, with the right sidebar item active and the right breadcrumb.
- Client Intake: example clients load, brief builds, readiness 100% for example C, Home card mirrors readiness and sections, What to bring tabs, Form questions text, question search jumps into the intake form.
- Toolbox: 23 tool cards in 5 sections (includes Jessica Starr's Nov 12 additions in `tools.js`: homework sheet, competition check, prompt library items, gray/yellow dot legend), tool search from any page jumps to Tools, tool modal opens, "Who's due for follow-up" runs offline with example rows and its output appears in Outputs and on Home.
- Automations: 9 example bots (4 Client Intake, 5 Toolbox) with area tags; filter chips hide the other area's rows and the Toolbox bots block; "Run these for real" connect banner still there.
- Print pages (BMC, loan checklist, assets worksheet) load.
- Sign-in: one `sbdc-api.js` dialog and server chip for the whole site.
- Look: light only, `color-scheme: only light`, theme-color `#FAFAF8`, no dark-mode rules added. Every text block sits on a white card; sidebar, top bar, phone top bar and bottom bar are solid white. Greeting heading computed color is `rgb(17,17,17)` with `-webkit-text-fill-color` set.

Not checked here: a real sign-in against the server (needs a work email code), real Snapchat/Instagram in-app browsers on a phone (only Chrome phone emulation), printing to paper.

## Follow-ups (not done)

1. **CORS / sign-in origin.** The tools server only allows the old P2/P3 Pages origins. If this ships on a new address, `SBDC_CORS_ORIGINS` (server `.env`) or the default list in the server code needs the new origin. Riley has to OK that. Reusing `sbdc-p3-dd2e46` avoids it for P3 users.
2. **Old P2 site.** Done: `sbdc-p2-12c2ac.pages.dev` serves `deploy/p2-redirect/index.html`, which maps old P2 links to the new `#/intake/…` routes. Not done: a one-time "bring my settings over" step. A saved sign-in on the old P2 address does not carry over (browser storage is per site), so P2-only users sign in once more with the email code.
3. **Client Intake outputs.** Client Intake does not save runs (the brief is copied or printed), so shared Outputs only lists Toolbox runs. Saving intake briefs as outputs would be a small follow-up.
4. **Automations KPIs** count the advisor's own Toolbox bots (as on P3). Server bots for both areas are listed below them.
5. The plan's dashed "room for more" slot and top-bar search across areas were left out on purpose (not needed yet). Toolbox does not have its own Outputs link; the shared Outputs page is the one place for runs.
6. The server's `vendor/p3-tools.js` copy of `tools.js` is unaffected; `tools.js` was not changed.

## Preview locally

```
cd app
python -m http.server 8765 --bind 127.0.0.1
# open http://127.0.0.1:8765/index.html#/home
```

Any static server works; there is no build step.
