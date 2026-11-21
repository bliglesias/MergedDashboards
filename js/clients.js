// Clients: one list of every client this browser has seen, with a grade (grade.js) for each.
// Fed by: the client intake form, finished Toolbox runs that name a client (sbdc-outputs), and pasted lists
// (a CIC export, a session log, or a "Label: value" block such as the helper extension's "Copy page").
// Kept in this browser's localStorage (sbdc-clients). Anyone can pull it out as CSV or JSON from the page.
// Example records (name starts with "Example") are never stored unless the advisor asks for the sample.
(() => {
const $ = (s) => document.querySelector(s);
const KEY = 'sbdc-clients';
const G = window.SBDC_GRADE;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const toast = (t) => (window.__toast ? window.__toast(t) : null);
const icon = (n) => `<i data-icon="${n}"></i>`;
const paintIcons = (root) => { if (window.renderIcons) window.renderIcons(root); };

// ---------- the database
function load() { try { const j = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(j?.list) ? j.list : []; } catch { return []; } }
let DB = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, list: DB })); } catch {} document.dispatchEvent(new CustomEvent('sbdc:clients')); }
// Clients removed here, { id: when }, so a copy kept elsewhere (sheet-store.js) does not bring them back.
const GONE = 'sbdc-clients-gone';
function gone() { try { const j = JSON.parse(localStorage.getItem(GONE)); return j && typeof j === 'object' ? j : {}; } catch { return {}; } }
function forget(id) { try { localStorage.setItem(GONE, JSON.stringify({ ...gone(), [id]: Date.now() })); } catch {} }

const sameClient = (a, b) => {
  if (a.email && b.email) return a.email.toLowerCase() === b.email.toLowerCase();
  if (norm(a.biz) && norm(a.biz) === norm(b.biz)) return true;
  return !!norm(a.name) && norm(a.name) === norm(b.name) && (!norm(a.biz) || !norm(b.biz));
};
const sessKey = (s) => s.id || [s.date, s.mins, s.type].join('|');

// Adds what a source knows to the matching client, or makes a new one. Newer non-empty answers win.
function upsert(rec, source) {
  const name = String(rec.name || '').trim(), biz = String(rec.biz || '').trim();
  if (!name && !biz && !rec.email) return null;
  let c = DB.find((x) => sameClient(x, rec));
  if (!c) { c = { id: uid(), name: '', biz: '', email: '', phone: '', facts: {}, sessions: [], src: {}, made: Date.now() }; DB.push(c); }
  for (const k of ['name', 'biz', 'email', 'phone']) if (String(rec[k] || '').trim()) c[k] = String(rec[k]).trim().slice(0, 160);
  for (const [k, v] of Object.entries(rec.facts || {})) {
    if (Array.isArray(v) ? v.length : String(v ?? '').trim() !== '') c.facts[k] = Array.isArray(v) ? v.slice(0, 30) : String(v).trim().slice(0, 600);
  }
  const seen = new Set(c.sessions.map(sessKey));
  for (const s of rec.sessions || []) if (!seen.has(sessKey(s))) { c.sessions.push(s); seen.add(sessKey(s)); }
  c.src[source] = Date.now();
  c.updated = Date.now();
  if (rec.ex) c.ex = true;
  return c;
}

// ---------- feeds
const isExample = (s) => /^example\b/i.test(String(s || '').trim());

function fromIntake() {
  const f = $('#f');
  if (!f) return 0;
  const d = {};
  for (const [k, v] of new FormData(f).entries()) { if (k === 'docs' || k === 'assist') (d[k] = d[k] || []).push(v); else d[k] = typeof v === 'string' ? v.trim() : ''; }
  if (!(d.client || d.biz) || isExample(d.client) || isExample(d.biz)) return 0;
  const { client, biz, email, phone, ...facts } = d;
  return upsert({ name: client, biz, email, phone, facts }, 'intake') ? 1 : 0;
}

const line = (text, re) => (String(text).match(re) || [])[1]?.trim() || '';
function fromOutputs() {
  let outs = [];
  try { outs = JSON.parse(localStorage.getItem('sbdc-outputs')) || []; } catch {}
  let n = 0;
  for (const o of Array.isArray(outs) ? outs : []) {
    if (!o || o.ex || typeof o.text !== 'string') continue;
    const name = line(o.text, /^Client(?:\(s\) Name\(s\))?:\s*(.+)$/m), biz = line(o.text, /^Business Name:\s*(.+)$/m);
    if ((!name && !biz) || isExample(name) || isExample(biz)) continue;
    const hrs = Number(line(o.text, /^Contact \(hours\):\s*([\d.]+)/m));
    const sess = { id: 'o' + o.id, date: line(o.text, /^Date:\s*(.+)$/m) || new Date(o.t).toLocaleDateString('en-US'), mins: hrs ? Math.round(hrs * 60) : 0, type: line(o.text, /^Contact Type:\s*(.+)$/m), note: String(o.title || '').slice(0, 80) };
    const facts = {};
    const status = line(o.text, /^Status:\s*(.+)$/m);
    if (status) facts.stage = status;
    if (upsert({ name: name || biz, biz, facts, sessions: [sess] }, 'toolbox')) n++;
  }
  return n;
}

// CIC screen names and common export headers, mapped to the fact names the intake uses.
const LABELS = {
  name: /^(name|client|client name|customer|contact name)$/, first: /^first name$/, last: /^last name$/, biz: /^(business name|business|company|company name)$/,
  email: /^e-?mail( address)?$/, phone: /^(phone|primary phone|phone number)$/, lastContact: /^(last contact|last session|last contacted)$/,
  stage: /^(status|stage|business stage)$/, revenue: /^(annual sales|annual revenue|revenue|gross sales)$/, pl: /^(annual p l|annual profit|profit|net income)$/,
  ft: /^(employees ft|full time employees)$/, pt: /^(employees pt|part time employees)$/, employees: /^employees$/, startDate: /^(start date|date started)$/,
  website: /^(web site|website)$/, bizDesc: /^business description$/, industry: /^(business type|industry)$/, org: /^business organization$/,
  date: /^(date|session date)$/, mins: /^(minutes|mins)$/, hours: /^(hours|contact|contact hours)$/, type: /^(type|contact type|session type)$/,
};
const fieldOf = (label) => { const l = norm(label.replace(/\$/g, '')); return Object.keys(LABELS).find((k) => LABELS[k].test(l)) || ''; };

function recFrom(pairs) {
  const r = { facts: {}, sessions: [] }, s = {};
  for (const [label, value] of pairs) {
    const k = fieldOf(label), v = String(value ?? '').trim();
    if (!k || !v) continue;
    if (k === 'name' || k === 'biz' || k === 'email' || k === 'phone') r[k] = v;
    else if (k === 'first') r.first = v; else if (k === 'last') r.last = v;
    else if (k === 'org') { if (/llc|corp|inc|partnership/i.test(v)) r.facts.llc = 'yes'; }
    else if (k === 'date' || k === 'mins' || k === 'hours' || k === 'type') s[k] = v;
    else r.facts[k] = v;
  }
  if (!r.name && (r.first || r.last)) r.name = [r.first, r.last].filter(Boolean).join(' ');
  if (s.date && (s.mins || s.hours)) r.sessions.push({ date: s.date, mins: s.mins ? Math.round(Number(s.mins)) || 0 : Math.round(Number(s.hours) * 60) || 0, type: s.type || '' });
  return r;
}

function splitRow(row, sep) {
  if (sep === '\t') return row.split('\t').map((x) => x.trim());
  const out = []; let cur = '', q = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (q) { if (ch === '"' && row[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

// A pasted table (tabs or commas, with a header row) or one "Label: value" block. Returns how many clients it touched.
function importText(text) {
  const rows = String(text || '').split(/\r?\n/).map((r) => r.trimEnd()).filter((r) => r.trim());
  if (!rows.length) return 0;
  const sep = rows[0].includes('\t') ? '\t' : ',';
  const head = splitRow(rows[0], sep);
  const table = head.length > 1 && head.filter((h) => fieldOf(h)).length >= 2;
  const touched = new Set();
  if (table) {
    for (const row of rows.slice(1)) {
      const cells = splitRow(row, sep);
      const rec = recFrom(head.map((h, i) => [h, cells[i]]));
      if (isExample(rec.name) || isExample(rec.biz)) continue;
      const c = upsert(rec, 'import');
      if (c) touched.add(c.id);
    }
  } else {
    const pairs = rows.map((r) => r.match(/^([^:]{2,60}):\s*(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]);
    const c = upsert(recFrom(pairs), 'import');
    if (c) touched.add(c.id);
  }
  return touched.size;
}

const SAMPLE = {
  ex: true, name: 'Example: Sam Patel (fictional)', biz: 'Example Auto Care LLC', email: 'sam@example.com',
  facts: { industry: 'Auto repair', stage: 'existing', years: '6 years', funding: 'yes', goal: 'Loan to add two service bays', expect: 'Help getting the loan package ready', llc: 'yes', ein: 'yes', tpt: 'yes', online: 'both', invested: '85000', employees: '5', revenue: '640000', amount: '250000', use: 'Buildout and two lifts', credit: '720', liquid: '40000', docs: ['Financial statements', 'Tax returns', 'Business plan'] },
  sessions: [{ id: 'ex1', date: new Date(Date.now() - 12 * 864e5).toLocaleDateString('en-US'), mins: 60, type: 'In-person' }, { id: 'ex2', date: new Date(Date.now() - 40 * 864e5).toLocaleDateString('en-US'), mins: 90, type: 'Online' }],
};

function sync() { const a = fromIntake(), b = fromOutputs(); if (a || b) save(); }

// ---------- pulling it out
const hoursOf = (c) => Math.round(c.sessions.reduce((a, s) => a + (Number(s.mins) || 0), 0) / 6) / 10;
const lastOf = (c) => { const t = G.lastContact(c); return t ? new Date(t).toLocaleDateString('en-US') : ''; };
function rowsOut() {
  return DB.map((c) => { const g = G.grade(c); return { c, g }; }).sort((a, b) => b.g.pct - a.g.pct);
}
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
function toCsv() {
  const head = ['Name', 'Business', 'Email', 'Phone', 'Grade %', 'Band', 'Known %', 'Stage', 'Sessions', 'Hours', 'Last contact', 'Would raise it most', 'Sources'];
  const body = rowsOut().map(({ c, g }) => [c.name, c.biz, c.email, c.phone, g.pct, g.band, g.known, c.facts.stage || '', c.sessions.length, hoursOf(c), lastOf(c), g.raise.map((r) => r.label).join('; '), Object.keys(c.src).join(' + ')]);
  return [head, ...body].map((r) => r.map(csvCell).join(',')).join('\r\n');
}
function download(name, type, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- the page
const SRC = { intake: 'Client intake', toolbox: 'Toolbox runs', import: 'Pasted list', sample: 'Example' };
const tone = (g) => (g.thin ? 'thin' : g.pct >= 80 ? 'a' : g.pct >= 60 ? 'b' : g.pct >= 40 ? 'c' : 'd');
const ring = (g, big) => `<span class="gring${big ? ' big' : ''}" data-tone="${tone(g)}" style="--p:${g.pct}" role="img" aria-label="Grade ${g.pct} percent"><b>${g.pct}%</b></span>`;

function listHtml(q) {
  const want = norm(q);
  const all = rowsOut();
  const rows = all.filter(({ c }) => !want || norm([c.name, c.biz, c.email].join(' ')).includes(want));
  if (!all.length) return `<div class="card"><div class="card-body cl-empty"><h2>No clients yet</h2><p>Clients show up here by themselves when you fill in a client intake or run a Toolbox tool that names a client. You can also paste a list from CenterIC.</p><div class="d-flex gap-2 flex-wrap"><button class="btn btn-primary" type="button" data-cl="import">${icon('file-spreadsheet')}Paste a list</button><button class="btn btn-outline-secondary" type="button" data-cl="sample">${icon('eye')}Show an example client</button></div></div></div>`;
  return `<div class="card"><ul class="rows cl-list">${rows.map(({ c, g }) => `<li><a class="cl-row" href="#/clients/${esc(c.id)}">${ring(g)}<span class="cl-who"><b>${esc(c.name || c.biz)}</b><span>${esc(c.name && c.biz ? c.biz : c.email || '')}</span></span><span class="cl-meta"><span class="badge cl-band" data-tone="${tone(g)}">${esc(g.band)}</span><span>${c.sessions.length} ${c.sessions.length === 1 ? 'session' : 'sessions'}${lastOf(c) ? ' · last ' + esc(lastOf(c)) : ''}</span></span></a></li>`).join('') || '<li class="text-secondary">No client matches that search.</li>'}</ul></div>`;
}

const FACT_NAMES = { industry: 'Industry', stage: 'Stage', years: 'Time in business', startDate: 'Start date', revenue: 'Yearly sales', pl: 'Yearly profit or loss', employees: 'Employees', ft: 'Employees FT', pt: 'Employees PT', funding: 'Looking for funding', amount: 'Amount wanted', use: 'Use of funds', invested: "Owner's money in", credit: 'Credit', liquid: 'Cash on hand', llc: 'Legal entity', ein: 'EIN', tpt: 'TPT license', online: 'Online', website: 'Website', goal: 'Goal', expect: 'Expects from SBDC', bizDesc: 'What it sells', docs: 'Documents', lastContact: 'Last contact', nextSession: 'Next session', nextMeeting: 'Next meeting', nextSteps: 'Next steps', impact: 'Impact area', price: 'Price per sale', cost: 'Cost per sale', fixed: 'Monthly fixed costs', volume: 'Sales per month', loanDocs: 'Loan package items on hand', homework: 'Homework given' };
// Lists kept as short codes (client-link.js) are shown with the words the tool uses.
const factText = (k, v) => (window.SBDC_FACT_SHOW ? window.SBDC_FACT_SHOW(k, v) : Array.isArray(v) ? v.join(', ') : String(v ?? ''));
// Sessions and tool runs for one client, newest first.
function timeline(c) {
  const rows = [
    ...c.sessions.map((s) => ({ t: Date.parse(s.date) || 0, date: s.date, text: ['Session', s.mins ? s.mins + ' min' : '', s.type, s.note].filter(Boolean).join(' · ') })),
    ...(c.events || []).map((e) => ({ t: e.t, date: new Date(e.t).toLocaleDateString('en-US'), text: e.title, tool: e.tool })),
  ].sort((a, b) => b.t - a.t);
  return rows.length ? `<ul class="cl-sess">${rows.map((r) => `<li>${esc(r.date)} · ${esc(r.text)}${r.tool ? ` · <a href="#/outputs/${esc(r.tool)}">Outputs</a>` : ''}</li>`).join('')}</ul>` : '<p class="text-secondary m-0">Nothing yet. Sessions and tool runs for this client show up here.</p>';
}

function detailHtml(c) {
  const g = G.grade(c);
  const unknown = g.items.filter((i) => !i.known);
  const facts = Object.entries(FACT_NAMES).filter(([k]) => (Array.isArray(c.facts[k]) ? c.facts[k].length : c.facts[k]));
  return `<p class="cl-back"><a class="btn btn-outline-secondary btn-sm" href="#/clients">${icon('arrow-right')}All clients</a></p>
  <div class="card"><div class="card-body cl-top">${ring(g, true)}<div class="cl-topt"><h2>${esc(c.name || c.biz)}</h2><p>${esc([c.name && c.biz ? c.biz : '', c.email, c.phone].filter(Boolean).join(' · '))}</p>
    <p><span class="badge cl-band" data-tone="${tone(g)}">${esc(g.band)}</span> <span class="text-secondary">Based on ${g.known}% of the facts. ${g.thin ? 'Fill in more before you lean on this number.' : 'Facts not known yet count as zero.'}</span></p></div></div>
    <div class="cl-secs">${g.sections.map((s) => `<div class="cl-sec"><div class="d-flex"><b>${esc(s.name)}</b><span class="ms-auto">${s.got} of ${s.pts}</span></div><div class="cl-bar"><span style="width:${Math.round((s.got / s.pts) * 100)}%"></span></div></div>`).join('')}</div></div>
  <div class="card mt-3"><div class="card-body"><h3 class="card-title">What would raise it most</h3>${g.raise.length ? `<ol class="cl-raise">${g.raise.map((r) => `<li><b>${esc(r.label)}</b> <span class="badge bg-green-lt">up to +${r.pts}</span><div class="text-secondary">${r.known ? esc(r.tip) : 'Not known yet. Ask, then add it to the intake.'}</div></li>`).join('')}</ol>` : '<p class="text-secondary m-0">Nothing left to raise.</p>'}</div></div>
  <div class="card mt-3"><div class="card-body"><h3 class="card-title">How the grade adds up</h3><ul class="cl-items">${g.items.map((i) => `<li data-known="${i.known}"><span>${esc(i.label)}</span><span class="text-secondary">${esc(i.section)}</span><b>${i.known ? i.got + ' of ' + i.pts : 'not known'}</b></li>`).join('')}</ul>
    ${unknown.length ? `<p class="text-secondary mt-2 mb-0">${unknown.length} of ${g.items.length} facts are not known yet.</p>` : ''}</div></div>
  <div class="card mt-3"><div class="card-body"><h3 class="card-title">What we know</h3>${facts.length ? `<dl class="cl-facts">${facts.map(([k, n]) => `<dt>${esc(n)}</dt><dd>${esc(factText(k, c.facts[k]))}</dd>`).join('')}</dl>` : '<p class="text-secondary m-0">Only the name so far.</p>'}
    <h3 class="card-title mt-3">Timeline</h3>${timeline(c)}
    <p class="text-secondary mt-3 mb-0">From: ${esc(Object.keys(c.src).map((k) => SRC[k] || k).join(', '))}. The grade never uses race, sex, age, disability, veteran status or location.</p></div></div>
  <div class="d-flex gap-2 mt-3 flex-wrap"><button class="btn btn-outline-secondary" type="button" data-cl="copy" data-id="${esc(c.id)}">${icon('copy')}Copy summary</button><button class="btn btn-outline-danger" type="button" data-cl="remove" data-id="${esc(c.id)}">${icon('trash')}Remove this client</button></div>`;
}

function summary(c) {
  const g = G.grade(c);
  return [`${c.name || c.biz}${c.name && c.biz ? ' (' + c.biz + ')' : ''}`, `Client grade: ${g.pct}% (${g.band}), based on ${g.known}% of the facts`, ...g.sections.map((s) => `${s.name}: ${s.got} of ${s.pts}`), '', 'Would raise it most:', ...g.raise.map((r, i) => `${i + 1}. ${r.label} (up to +${r.pts})`)].join('\n');
}

let sub = '';
function paint() {
  const box = $('#clBody');
  if (!box) return;
  const c = sub && DB.find((x) => x.id === sub);
  $('#clTools').hidden = !!c || !DB.length;
  box.innerHTML = c ? detailHtml(c) : listHtml($('#clSearch').value);
  paintIcons(box);
  const n = $('#navClients');
  if (n) { n.textContent = DB.length; n.hidden = !DB.length; }
}

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-cl]');
  if (!b) return;
  const act = b.dataset.cl;
  if (act === 'import') {
    const t = await window.SBDC_API.paste('Paste a client list', 'A CenterIC export or a session log with a header row (Name, Email, Business name, Last contact, Date, Minutes), or one client as "Label: value" lines. It stays in this browser.', '');
    if (t == null || !t.trim()) return;
    const n = importText(t);
    if (n) save();
    toast(n ? `${n} ${n === 1 ? 'client' : 'clients'} added or updated` : 'No clients found in that. It needs a header row or "Label: value" lines.');
  } else if (act === 'sample') { upsert(SAMPLE, 'sample'); save(); }
  else if (act === 'intake') { const n = fromIntake(); if (n) save(); toast(n ? 'Client intake added' : 'The client intake has no client name yet'); }
  else if (act === 'csv') { download('sbdc-clients.csv', 'text/csv', toCsv()); toast('Client list downloaded'); }
  else if (act === 'json') { download('sbdc-clients.json', 'application/json', JSON.stringify({ exported: new Date().toISOString(), clients: rowsOut().map(({ c, g }) => ({ ...c, grade: { pct: g.pct, band: g.band, known: g.known, sections: g.sections } })) }, null, 1)); toast('Client data downloaded'); }
  else if (act === 'copy') { const c = DB.find((x) => x.id === b.dataset.id); if (c) { await navigator.clipboard.writeText(summary(c)).catch(() => {}); toast('Summary copied'); } }
  else if (act === 'remove') { const c = DB.find((x) => x.id === b.dataset.id); if (c && confirm(`Remove ${c.name || c.biz} from this browser's client list?`)) { DB = DB.filter((x) => x !== c); forget(c.id); save(); window.__go('#/clients'); } }
});
document.addEventListener('input', (e) => { if (e.target.id === 'clSearch') paint(); });
document.addEventListener('sbdc:clients', paint);
document.addEventListener('sbdc:route', (e) => { if (e.detail.view !== 'clients') return; sub = e.detail.sub || ''; sync(); paint(); });

// Saves answers from a tool run to one client and puts the run on their timeline (client-link.js asks first).
function update(id, { facts = {}, event } = {}) {
  const c = DB.find((x) => x.id === id);
  if (!c) return null;
  for (const [k, v] of Object.entries(facts)) {
    if (Array.isArray(v)) c.facts[k] = v.slice(0, 30);
    else if (String(v ?? '').trim() !== '') c.facts[k] = String(v).trim().slice(0, 600);
  }
  if (event && !(c.events || []).some((e) => e.id === event.id)) c.events = [event, ...(c.events || [])].slice(0, 200);
  c.src.toolbox = Date.now();
  c.updated = Date.now();
  save();
  return c;
}

window.SBDC_CLIENTS = { all: () => DB, get: (id) => DB.find((x) => x.id === id) || null, update, names: FACT_NAMES, setAll: (list) => { DB = list; save(); }, gone, grade: (c) => G.grade(c), upsert: (r, s) => { const c = upsert(r, s || 'import'); save(); return c; }, importText: (t) => { const n = importText(t); if (n) save(); return n; }, toCsv, sync };
sync();
paint();
})();
