// Checks the settings the dashboard publishes (window.__helperSettings, helper-settings.js) before the helper
// uses them. Pure functions. The settings are data from a web page, so anything that is not a short string or an
// https address is dropped, and a list that fails the check falls back to the one packaged with the helper.

import { normalizeLabel } from './parse.js';

export const SETTINGS_VERSION = 1;
const MAX = { sites: 20, links: 30, rows: 40, names: 12 };

const text = (v, max) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');

function httpsUrl(v) {
  if (typeof v !== 'string' || v.length > 300) return null;
  try {
    const u = new URL(v.trim());
    return u.protocol === 'https:' && u.hostname.includes('.') && !u.username && !u.password ? u : null;
  } catch {
    return null;
  }
}

function cleanSites(list) {
  const seen = new Set();
  const out = [];
  for (const s of list.slice(0, MAX.sites)) {
    const u = httpsUrl(s?.origin);
    const name = text(s?.name, 40);
    if (!u || !name || seen.has(u.origin)) continue;
    seen.add(u.origin);
    out.push({ name, origin: u.origin, note: text(s?.note, 80) });
  }
  return out;
}

function cleanLinks(list, dashboardOrigin) {
  const out = [];
  for (const l of list.slice(0, MAX.links)) {
    const name = text(l?.name, 60);
    const group = text(l?.group, 30);
    const raw = typeof l?.url === 'string' ? l.url.trim() : '';
    const url = /^#\/[\w\-/]{0,80}$/.test(raw) ? dashboardOrigin + '/' + raw : httpsUrl(raw)?.href;
    if (!name || !group || !url) continue;
    out.push({ group, name, url, icon: typeof l.icon === 'string' && /^[a-z-]{1,30}$/.test(l.icon) ? l.icon : 'external-link' });
  }
  return out;
}

function cleanSame(rows) {
  const out = [];
  for (const row of rows.slice(0, MAX.rows)) {
    if (!Array.isArray(row)) continue;
    const names = [...new Set(row.slice(0, MAX.names).map((n) => normalizeLabel(text(n, 40))).filter(Boolean))];
    if (names.length >= 2) out.push(names);
  }
  return out;
}

// Returns { sites?, links?, same? } holding only the lists that passed, or null when nothing usable was given.
export function cleanSettings(raw, dashboardOrigin) {
  if (!raw || typeof raw !== 'object' || raw.version !== SETTINGS_VERSION) return null;
  const out = {};
  if (Array.isArray(raw.sites)) out.sites = cleanSites(raw.sites);
  if (Array.isArray(raw.links)) { const links = cleanLinks(raw.links, dashboardOrigin); if (links.length) out.links = links; }
  if (Array.isArray(raw.sameBoxes)) { const same = cleanSame(raw.sameBoxes); if (same.length) out.same = same; }
  return Object.keys(out).length ? out : null;
}
