# Advisor Toolbox (SBDC)

Static site, no build step. See `README.md` and `STATUS.md` for the Toolbox.

## Intake Assistant (`pages/Intake_assistant_index.html`)

- **Data contract:** `js/Intake_assistant_fields.js` holds the 10 steps, their
  answers, what each answer is called on a saved client, and the forms list.
  Change data there, not in `js/Intake_assistant_app.js` (page code only).
- **How it connects, and which parts are guesses:** `docs/intake-assistant-data.md`.
  Read it before wiring the page to client data or the Google Sheet.
- **The page only reads saved clients** (`localStorage` key `sbdc-clients`) and
  never writes to them until saving is approved.
- **Tests:** `node --test tests/intake-assistant-fields.test.js` (data, fast) and
  `node --test tests/intake-assistant.e2e.test.js` (page, needs Google Chrome).
  Run both after changes.
- **Style for this page:** readable code for a beginner (The Odin Project level),
  short comments, no clever tricks. Structure in HTML, look in CSS, behavior in
  JS; build repeated elements from `<template>`s. Colors: blue = selected,
  green = done, red = answered but not confirmed.
