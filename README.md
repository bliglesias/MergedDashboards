# Advisor Toolbox (SBDC)

Static dashboard for Maricopa SBDC advisors: Client Intake (formerly the P2 dashboard) and the Toolbox (formerly P3) in one site. No build step.

Live: https://sbdc-p3-dd2e46.pages.dev (Cloudflare Pages project `sbdc-p3-dd2e46`, production branch `main`).
The old Client Intake address https://sbdc-p2-12c2ac.pages.dev now sends people to `#/intake/overview` on the live site (`deploy/p2-redirect/`).

Deploy (by hand, no build step), from a clean export of `main` without `deploy/`, `extension/` or `docs/`:

```
npx wrangler pages deploy <export-dir> --project-name sbdc-p3-dd2e46 --branch main --commit-hash <sha>
npx wrangler pages deploy deploy/p2-redirect --project-name sbdc-p2-12c2ac --branch main
```

See `STATUS.md` for routes, files, rollback and follow-ups.

Files are sorted into `css/`, `js/`, `pages/` (printables) and `assets/` (fonts, images, Tabler). See `CHANGES.md` for what moved and what to do before deploying the new layout.

## Tools and the client list work together

`client-link.js` joins the Toolbox tools to the Clients list. `LINK` in that file says, per tool, which boxes it reads from a client and which answers it can save back.

- **Read:** "Fill from a saved client" fills every box the client's record can answer (name, email, industry, goal, stage, break-even numbers, loan items on hand and so on).
- **Save:** after a run, a box asks which answers to save to that client. Nothing is saved unless it is ticked. The run goes on the client's timeline. If the client is known and the run has nothing new, it is only logged on the timeline and no box shows. An email tool logs "email drafted" and never counts as a session.
- **Lists:** "Who's due for follow-up", the weekly digest and the monthly activity report have a "Use my saved clients" button that fills their rows from the list.
- Saved answers use the fact names the grade reads (`grade.js`), so a saved goal, break-even or document moves the grade.

Test: `node --test tests/client-link.e2e.test.js`.

## Client list in a Google Sheet (optional)

`sheet-store.js` can keep the Clients list in a Google Sheet in the advisor's own Google Drive, so it is the same on every computer. With no client ID in `sheet-config.js` it is off: nothing shows and Google is never contacted. The client ID there now belongs to a Google Cloud project in the `domail.maricopa.edu` organisation with an "Internal" consent screen, so only `@domail.maricopa.edu` accounts can connect. Google turns `@maricopa.edu` accounts away (a different organisation); advisors on those need a project in that organisation or an "External" consent screen.

- The advisor clicks "Connect Google Sheet" and signs in with Google. The page gets a one-hour pass limited to files this site made (`drive.file`) plus the account's email address. The pass is kept in memory only.
- It finds or makes one Sheet named "SBDC Advisor Toolbox clients" (tab `Clients`): one row per client, readable columns plus a `Data` column with the full record. Rows typed or edited by hand in the Sheet are picked up.
- Each sync reads the Sheet, merges it with the browser's list (newest change wins, removed clients stay removed) and writes it back. No server of ours is involved. Example records stay in the browser.

To switch it on:

1. In the Google Cloud project, enable the Google Sheets API and the Google Drive API.
2. Set up the OAuth consent screen. "Internal" limits sign-in to the organisation's accounts.
3. Create an OAuth client ID of type "Web application" with `https://sbdc-p3-dd2e46.pages.dev` as an authorised JavaScript origin.
4. Put the client ID in `sheet-config.js` (it is an identifier, not a secret) and deploy.
5. Leave `approved: false` until Maricopa approves real client details in Google Drive; it shows a "made-up clients only" notice.

Tests: `node --test tests/sheet-store.test.js` (records, rows, merge) and `node --test tests/sheet-store.e2e.test.js` (the real pages against a pretend Google; needs `npm install` in `extension/`).

`extension/` holds the SBDC Advisor Helper Chrome extension (not published, not part of the site). See `extension/README.md`.
