# Intake Assistant: data and how to connect it

For the next developer wiring the Intake Assistant page
(`pages/Intake_assistant_index.html`) to real client data.

## Where everything is

| What | Where |
|---|---|
| **The data contract** (steps, answers, client field names, forms list) | [`js/Intake_assistant_fields.js`](../js/Intake_assistant_fields.js) |
| The page code that uses it | `js/Intake_assistant_app.js` |
| The page | `pages/Intake_assistant_index.html` |
| Check the contract is consistent (no browser, under a second) | `node --test tests/intake-assistant-fields.test.js` |
| Check the page works (opens Chrome, about 40 seconds) | `node --test tests/intake-assistant.e2e.test.js` |

**`js/Intake_assistant_fields.js` is the source of truth.** The tables below are a
readable copy. If they disagree with the file, the file wins (and update this doc).
The file has four sections:

1. **The steps:** `steps` (each step's question, its answers, which answers count as
   done, and the follow-up box), plus the "no ACC filing" and "can wait for
   approval" settings.
2. **Saved clients:** `CLIENTS_KEY` (where clients are read from), `STEP_FACTS`
   (what each answer is called on a client) and `AUTOFILL` (older answers the
   Toolbox already saves).
3. **Forms:** `FORMS`, the starting "Forms to give to client" list (the box below
   the steps). Advisors can also add files from their computer (kept in the tab
   only) and Google Drive links (they sign in to Drive themselves).
4. **Feedback:** `FEEDBACK`, where "Report bug" and "Suggest new feature" send to.
   `email` is empty until someone picks an address; `githubRepo` only works for
   people with access to the (private) repo.

## How the data flows

```
Google Sheet  <-- sync (Toolbox, sheet-store.js) -->  browser list "sbdc-clients"  --> Intake Assistant (reads only)
```

The Google Sheet connection couldn't be tested from a local computer: Google only
accepts sign-in from the live site and from `@domail.maricopa.edu` accounts. So the
page is built on these assumptions. Each says whether it was checked in the code or
is a guess. Revisit the guesses once the Sheet can be connected.

| # | Assumption | Status |
|---|---|---|
| 1 | The Intake Assistant never talks to Google. It only reads the browser's saved client list (`localStorage` key `sbdc-clients`). | Checked: that's how the page works. A test checks the key matches `clients.js`. |
| 2 | After the Toolbox syncs the Sheet, the synced clients are in that same browser list, so the Intake Assistant sees them. | Checked in code: `sheet-store.js` calls `SBDC_CLIENTS.setAll()`, which saves to `sbdc-clients`. Not tested against a real Sheet. |
| 3 | Both pages are on the same site (same address), so they share the browser list. | Checked: both are served from the same site. A page opened as a local file only sees lists saved by other local files. |
| 4 | A client record looks like `{ id, name, biz, email, phone, facts: { ... }, sessions: [ ... ] }`. Answers live in `facts`. | Checked in code (`clients.js`). |
| 5 | New `facts` names round-trip through the Sheet with no new columns: the Sheet's `Data` column holds the whole record as JSON. | Checked in code (`sheet-store.js`, `toRows` / `fromRows`). Not tested against a real Sheet. |
| 6 | The `STEP_FACTS` names below are what the Intake Assistant's answers are called on a client. | **Guess.** Nothing else on the site uses them yet. |
| 7 | Answers are stored as the exact answer text shown in the menus (e.g. `"Approved"`), not as codes. | **Guess.** The older facts (`llc`, `tpt`, `ein`) use codes like `"yes"`; those are still read as before. |
| 8 | The EIN number itself is never saved to a client, only whether they have one. | **Guess**, to keep sensitive numbers out of the browser and the Sheet. |
| 9 | The Intake Assistant only reads, never saves, until saving real client details is approved. In `sheet-config.js`, `approved` is `false`. | Decision: page is read-only for now. "Add new client" on the page is memory only. |
| 10 | The forms list is blank forms only, and for now it's the printable pages already in `pages/`. | Decision. Later: load it from a Google Drive folder of blank forms (not built). |

## Client field names (copy of `STEP_FACTS` and `AUTOFILL`)

| Step | Answer fact | Detail fact | Older fact also read |
|---|---|---|---|
| 1. Choose a name | | `biz` (the record's business name) | |
| 2. Domain name | `domain` | `website` | `online: "both"` |
| 3. Entity type | `entityType` | | |
| 4. Name availability | `nameCheck` | | |
| 5. Secure or form | `secureOrForm` | `reservationEnds` (YYYY-MM-DD) | |
| 6. File with ACC | `accFiling` | `entityId` | `llc: "yes"` -> Approved |
| 7. AZ Dept. of Revenue | `tptLicense` | `tptNumber` | `tpt: yes / no / na / unsure` |
| 8. Local taxes & license | `cityLicense` | `cityLicenseNumbers` | |
| 9. Federal EIN / TIN | `einStatus` | *(not saved, see 8)* | `ein: yes / no` |
| 10. Bank account | `bankAccount` | `bank` | |

When the page fills from a saved client, a new fact (e.g. `accFiling`) wins over
an older one (e.g. `llc`). An answer that isn't one of the step's menu options is
ignored.

## To check once the Sheet can be connected

- [ ] Connect the Sheet on the live site, then open the Intake Assistant on the same
      site: the synced clients appear under "Fill from a saved client" (assumptions 2, 3).
- [ ] Add one of the facts above to a client's `Data` cell in the Sheet, sync, and
      check the Intake Assistant fills that step (assumption 5).
- [ ] Agree on the fact names with whoever owns the Clients list (assumption 6).
- [ ] Decide whether the Intake Assistant may save answers back (assumption 9).
- [ ] Replace `FORMS` with the Google Drive folder of blank forms (assumption 10).
- [ ] Set `FEEDBACK.email` to whoever should get bug reports and feature ideas.
