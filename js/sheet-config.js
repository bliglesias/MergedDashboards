// Settings for keeping the client list in a Google Sheet (sheet-store.js).
// clientId: the Google Cloud "OAuth client ID" (Web application) whose allowed JavaScript origin is this site.
//   It is an identifier, not a secret. While it is empty the feature is switched off and nothing about it shows.
// domain: only Google accounts ending in this may connect. The real limit is set in Google Cloud (an "Internal"
//   consent screen); this check gives a clear message to someone who picks the wrong account.
// approved: false shows the "made-up clients only" notice. Set true once Maricopa approves real client data.
window.SBDC_SHEET_CONFIG = {
  clientId: '214988362339-ee672u2lj23grv3254g8a90thbnjqd9h.apps.googleusercontent.com',
  domain: 'maricopa.edu',
  approved: false,
};
