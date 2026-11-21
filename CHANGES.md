# Changes: folder reorganization (Nov 21, 2026)

The Advisor Toolbox site (Client Intake + Toolbox, see `README.md`) used to keep every file in one folder. This change sorts the files into folders by type. **No behaviour, text or styling changed**: files were moved and the paths that point at them were updated.

Starting point: the `SBDC-Advisor-Dashboard.zip` and `SBDC-Advisor-Helper-extension.zip` exports, matching the live site at https://sbdc-p3-dd2e46.pages.dev as of Nov 14, 2026 (see `STATUS.md`).

## New layout

```
index.html                 the dashboard (unchanged location)
pages/                     printable pages (were at the top level)
  bmc.html
  loan-checklist.html
  assets-worksheet.html
css/                       app, flair, leedlime, p2, p3, print, shell (were at the top level)
js/                        all 20 scripts (were at the top level)
assets/                    fonts, images, tabler.min.css, licences (was vendor/)
extension/                 SBDC Advisor Helper Chrome extension (was a separate zip)
tests/  docs/  deploy/     unchanged
README.md  STATUS.md  THIRD_PARTY_NOTICES.md  CHANGES.md
```

## Path changes

| File | Old | New | Count |
|---|---|---|---|
| `index.html` | `app.css`, `p2.css`, … | `css/app.css`, `css/p2.css`, … | 6 |
| `index.html` | `icons.js`, `shell.js`, … | `js/icons.js`, `js/shell.js`, … | 20 |
| `index.html` | `vendor/img/p3-mark.svg`, `vendor/tabler.min.css` | `assets/…` | 2 |
| `index.html` | `bmc.html`, `loan-checklist.html` | `pages/…` | 2 |
| `css/app.css`, `css/flair.css`, `css/leedlime.css` | `url(vendor/…)` | `url(../assets/…)` | 5 |
| `pages/*.html` (3 files) | `print.css` | `../css/print.css` | 3 |
| `pages/*.html` (3 files) | back link `./` | `../` | 3 |
| `js/tools.js` | `bmc.html`, `loan-checklist.html`, `assets-worksheet.html` | `pages/…` | 12 |
| `tests/grade.test.js` | `../grade.js` | `../js/grade.js` | 1 |
| `tests/sheet-store.test.js`, `tests/sheet-store.e2e.test.js` | `../sheet-store.js` | `../js/sheet-store.js` | 2 |
| `THIRD_PARTY_NOTICES.md` | `vendor/…`, `bmc.html`, `icons.js` | `assets/…`, `pages/bmc.html`, `js/icons.js` | 12 |

`js/tools.js` builds print-page links from the page's own address (`BASE`), not from where the script sits, so moving the script itself did not change any link.

Not changed: the extension (it only knows the site's address, not file paths), `deploy/p2-redirect/`, `STATUS.md` (a record of the Nov 14 release, still describes the flat layout).

## Checked

- Every `href`, `src` and CSS `url()` in the site's HTML and CSS points at a file that exists (41 references, 0 missing).
- No doubled paths (`pages/pages/`, `assets/assets/`) and no `vendor/` paths left in site files.

Not checked yet: the pages in a browser, and the test suite (Node.js was not installed on the machine used).

## Before deploying this

1. **Print-page addresses change.** `…/bmc.html` is now `…/pages/bmc.html` (same for the loan checklist and assets worksheet). Advisors have emailed these links to clients, so the old addresses need redirects, e.g. a Cloudflare Pages `_redirects` file:
   ```
   /bmc.html               /pages/bmc.html               301
   /loan-checklist.html    /pages/loan-checklist.html    301
   /assets-worksheet.html  /pages/assets-worksheet.html  301
   ```
2. **Old P2 redirect.** `deploy/p2-redirect/` forwards paths such as `/bmc` to the same path on the live site; the redirects above cover it.
3. **Server copy of `tools.js`.** The tools server keeps its own copy (`vendor/p3-tools.js`). This repo's `js/tools.js` now has `pages/…` links, so the two differ. Check whether the server copy builds print-page links and update it to match.
4. **Deploy the whole folder at once.** The layout no longer matches the live site, so copying single files over would break it. Deploy as in `README.md`, leaving out `deploy/`, `extension/` and `docs/`.
5. **Run the tests**: `node --test tests/` (browser tests need `npm install` in `extension/`).
