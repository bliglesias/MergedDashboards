// Which sites the helper may work on, and the pages the dashboard links to.
// Chrome enforces the list: the helper can only touch an origin after it holds a host permission for it.

export const DASHBOARD_ORIGIN = 'https://sbdc-p3-dd2e46.pages.dev';
// Where the helper reads published settings from. The dashboard; named apart so the test copy can use this computer.
export const SETTINGS_ORIGIN = DASHBOARD_ORIGIN;

// The Arizona Corporation Commission's public business search (the old ecorp.azcc.gov address now asks for a login).
export const AZCC_ORIGIN = 'https://arizonabusinesscenter.azcc.gov';
export const AZCC_SEARCH = AZCC_ORIGIN + '/businesssearch';

const TOOLBOX_SITE = { name: 'Advisor Toolbox', origin: DASHBOARD_ORIGIN, always: true, note: 'Your dashboard. Always on.' };
const DEFAULT_SITES = [{ name: 'AZ Corporation Commission', origin: AZCC_ORIGIN, note: 'Business name search.' }];

const DEFAULT_LINKS = [
  { group: 'Advisor Toolbox', name: 'Tools', url: DASHBOARD_ORIGIN + '/#/toolbox', icon: 'tools' },
  { group: 'Advisor Toolbox', name: 'Outputs', url: DASHBOARD_ORIGIN + '/#/outputs', icon: 'file-text' },
  { group: 'Advisor Toolbox', name: 'Client intake', url: DASHBOARD_ORIGIN + '/#/intake/intake', icon: 'forms' },
  { group: 'Reference', name: 'AZCC business search', url: AZCC_SEARCH, icon: 'search' },
  { group: 'Reference', name: 'AZ transaction privilege tax', url: 'https://azdor.gov/business/transaction-privilege-tax', icon: 'external-link' },
  { group: 'Reference', name: 'IRS: apply for an EIN', url: 'https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online', icon: 'external-link' },
  { group: 'Reference', name: 'SBA loans', url: 'https://www.sba.gov/funding-programs/loans', icon: 'external-link' },
  { group: 'Reference', name: 'SBA Form 413', url: 'https://www.sba.gov/document/sba-form-413-personal-financial-statement', icon: 'external-link' },
  { group: 'Reference', name: 'SBA Form 1919', url: 'https://www.sba.gov/document/sba-form-1919-borrower-information-form', icon: 'external-link' },
];

// The lists above are what the helper ships with. The dashboard can publish newer ones (lib/settings.js checks
// them first); a list it does not publish stays as packaged. The Toolbox itself is never taken from there.
let knownSites = DEFAULT_SITES;
let links = DEFAULT_LINKS;
export function useLists({ sites, links: newLinks } = {}) {
  knownSites = sites ? sites.filter((s) => s.origin !== DASHBOARD_ORIGIN) : DEFAULT_SITES;
  links = newLinks || DEFAULT_LINKS;
}
export const getLinks = () => links;
const builtIn = () => [TOOLBOX_SITE, ...knownSites];

const pattern = (origin) => origin + '/*';

export const hasAccess = (origin) => chrome.permissions.contains({ origins: [pattern(origin)] });

// "Every page I open": one Chrome prompt instead of one per site. Still https only, and the helper still
// does nothing on a page until the advisor clicks a button. Must be asked for inside a click handler.
const EVERY = 'https://*/*';
export const hasEvery = () => chrome.permissions.contains({ origins: [EVERY] });
export const turnOnEvery = () => chrome.permissions.request({ origins: [EVERY] });
export const turnOffEvery = () => chrome.permissions.remove({ origins: [EVERY] });

export async function listSites() {
  const { sites = [] } = await chrome.storage.local.get('sites');
  const known = builtIn();
  const all = [...known, ...sites.filter((s) => !known.some((k) => k.origin === s.origin)).map((s) => ({ ...s, added: true }))];
  return Promise.all(all.map(async (s) => ({ ...s, on: await hasAccess(s.origin) })));
}

// Must run inside a click handler: Chrome shows its own "allow on this site" prompt.
export const turnOn = (origin) => chrome.permissions.request({ origins: [pattern(origin)] });

export async function turnOff(origin) {
  await chrome.permissions.remove({ origins: [pattern(origin)] });
}

// Advisors add their own record system (CenterIC) by address. https only.
export function parseSiteAddress(input) {
  let text = String(input || '').trim();
  if (!text) throw new Error('Type the address first.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = 'https://' + text;
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error("That doesn't look like a web address.");
  }
  if (url.protocol !== 'https:') throw new Error('Only https addresses can be added.');
  if (!url.hostname.includes('.')) throw new Error("That doesn't look like a web address.");
  return url.origin;
}

export async function addSite(name, origin) {
  const { sites = [] } = await chrome.storage.local.get('sites');
  if (builtIn().some((s) => s.origin === origin) || sites.some((s) => s.origin === origin)) return;
  sites.push({ name: String(name || '').trim().slice(0, 40) || new URL(origin).hostname, origin });
  await chrome.storage.local.set({ sites });
}

export async function removeSite(origin) {
  const { sites = [] } = await chrome.storage.local.get('sites');
  await chrome.storage.local.set({ sites: sites.filter((s) => s.origin !== origin) });
  await turnOff(origin);
}
