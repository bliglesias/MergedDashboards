// "Pull": the advisor clicks, the helper reads one page (the open one, or a public record page it opens) and
// holds what it read for the Toolbox. Pure functions, no browser APIs. Nothing runs in the background.

const TAB = '\t';
const NL = '\n';
export const MAX_PULL = 150000;

// Public Arizona record pages that only load in a real browser. `api` is a path on the same site that answers
// with JSON; it is read from inside the opened tab, so the site sees the advisor's own browser.
export const PULL_SOURCES = [
  { id: 'disclosures', name: 'AZ financial disclosures', sub: 'azsos.gov · the list of filed disclosure documents', url: 'https://azsos.gov/node/132' },
  { id: 'lobbyists', name: 'AZ lobbyists', sub: 'azsos.gov · the lobbyist page', url: 'https://azsos.gov/node/60' },
  { id: 'money', name: 'AZ campaign money', sub: 'Spotlight · candidates and committees matching a name', url: 'https://spotlightv2.arizona.vote/Reporting/Api', api: '/api/entities/search?name=', needsName: true },
];

const line = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

// A page the agent read ({ title, url, text, tables, links }) as one block of plain text.
export function pageToText(p, when = new Date()) {
  const out = [`PULLED PAGE: ${line(p.title) || 'Untitled'}`, `From: ${p.url || ''}`, `Pulled: ${when.toLocaleString()}`];
  // Each part gets its own share, so a long list of documents cannot push the lists and the words out.
  const part = (text, max) => (text.length > max ? text.slice(0, text.lastIndexOf(NL, max) > 0 ? text.lastIndexOf(NL, max) : max) + NL + '(cut short)' : text);
  const links = Array.isArray(p.links) ? p.links : [];
  if (links.length) out.push('', `DOCUMENTS (${links.length})`, part(links.map((l) => line(l.text) + TAB + l.url).join(NL), 90000));
  (Array.isArray(p.tables) ? p.tables : []).forEach((t, i) => out.push('', `TABLE ${i + 1} (${t.rows} rows)`, part(String(t.text), 8000)));
  if (p.text) out.push('', 'TEXT', part(String(p.text).trim(), 18000));
  if (p.left) out.push('', `${p.left} protected ${p.left === 1 ? 'item was' : 'items were'} left out (ID numbers and the like).`);
  return out.join(NL).slice(0, MAX_PULL);
}

// JSON a record site answered with, as rows with tabs between columns. Takes a list of objects, or the
// { data: [...] } wrapper paged endpoints use. People who only gave money are left out of a name search.
export function jsonToRows(json, max = 500) {
  const list = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : null;
  if (!list) return null;
  const rows = list.filter((r) => r && typeof r === 'object' && !Array.isArray(r) && r.entityGroupType !== 'Individual');
  if (!rows.length) return { rows: 0, total: list.length, text: '' };
  const cols = [...new Set(rows.slice(0, 50).flatMap((r) => Object.keys(r)))].slice(0, 12);
  const cell = (v) => (v == null ? '' : typeof v === 'object' ? line(JSON.stringify(v)).slice(0, 200) : line(v).slice(0, 300));
  const kept = rows.slice(0, max);
  return { rows: kept.length, total: rows.length, text: [cols.join(TAB), ...kept.map((r) => cols.map((c) => cell(r[c])).join(TAB))].join(NL) };
}

export function rowsToText(source, name, res, when = new Date()) {
  const more = res.total > res.rows ? ` (first ${res.rows} of ${res.total})` : '';
  return [`PULLED: ${source.name}${name ? ` for “${line(name)}”` : ''}`, `From: ${new URL(source.url).origin}${source.api || ''}${name ? encodeURIComponent(line(name)) : ''}`, `Pulled: ${when.toLocaleString()}`, '', `ROWS (${res.rows})${more}`, res.text].join(NL).slice(0, MAX_PULL);
}
