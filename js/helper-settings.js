// Settings the SBDC Advisor Helper extension reads from this page (window.__helperSettings), so these lists can
// change without advisors reinstalling the extension. Data only: the extension checks every value and never runs
// anything from here. A site listed here is only suggested; the advisor still turns it on and Chrome still asks.
// Format and limits: extension/lib/settings.js.
window.__helperSettings = {
  version: 1,
  // Sites offered under "Sites it can work on". https addresses only.
  sites: [
    { name: 'AZ Corporation Commission', origin: 'https://arizonabusinesscenter.azcc.gov', note: 'Business name search.' },
  ],
  // "Related pages" in the helper. url is https, or starts with #/ for a page on this dashboard.
  links: [
    { group: 'Advisor Toolbox', name: 'Tools', url: '#/toolbox', icon: 'tools' },
    { group: 'Advisor Toolbox', name: 'Outputs', url: '#/outputs', icon: 'file-text' },
    { group: 'Advisor Toolbox', name: 'Client intake', url: '#/intake/intake', icon: 'forms' },
    { group: 'Reference', name: 'AZCC business search', url: 'https://arizonabusinesscenter.azcc.gov/businesssearch', icon: 'search' },
    { group: 'Reference', name: 'AZ transaction privilege tax', url: 'https://azdor.gov/business/transaction-privilege-tax', icon: 'external-link' },
    { group: 'Reference', name: 'IRS: apply for an EIN', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online', icon: 'external-link' },
    { group: 'Reference', name: 'SBA loans', url: 'https://www.sba.gov/funding-programs/loans', icon: 'external-link' },
    { group: 'Reference', name: 'SBA Form 413', url: 'https://www.sba.gov/document/sba-form-413-personal-financial-statement', icon: 'external-link' },
    { group: 'Reference', name: 'SBA Form 1919', url: 'https://www.sba.gov/document/sba-form-1919-borrower-information-form', icon: 'external-link' },
  ],
  // Names record systems use for the same session box. The first name in each row is the one the dashboard's
  // "Format notes for CIC" header uses.
  sameBoxes: [
    ['date', 'session date', 'date of session', 'contact date', 'date of contact'],
    ['contact type', 'type of contact', 'session type', 'type of session', 'contact method'],
    ['time', 'start time', 'session time', 'time of session'],
    ['contact hours', 'contact', 'contact time', 'hours', 'session hours', 'total hours', 'counseling hours'],
    ['notes', 'session notes', 'counseling notes'],
  ],
};
