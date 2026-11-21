// data/Intake_assistant_prompts.js
// Where the Prompt library gets its data: the Google Sheet tab,
// published as CSV (File > Share > Publish to web > CSV).
//
// This is the dashboard's ONE outside call. The sheet is downloaded once
// when the page loads; searching happens in the browser and nothing typed
// on the page is ever sent. The sheet must never contain client data.
//
// Paste the published link between the quotes. If the sheet ever moves,
// change this link. Nothing else needs to change.
const PROMPT_SHEET_URL = "";

// How many matching prompts to show. 3 while testing.
const MAX_PROMPT_RESULTS = 3;
