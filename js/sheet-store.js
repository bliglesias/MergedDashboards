// Keeps the client list (clients.js) in a Google Sheet in the advisor's own Google Drive, so it is the same on
// every computer they sign in on. Optional: switched off until sheet-config.js has a client ID.
// How it works: the advisor clicks Connect and signs in with Google. The page gets a one-hour pass that only
// reaches files this site made (the "drive.file" permission), finds or makes one Sheet, and from then on reads
// the Sheet, merges it with this browser's list and writes the result back. No server of ours is involved.
// The Sheet has one row per client: columns people can read, plus a "Data" column holding the full record.
((root) => {
const TITLE = 'SBDC Advisor Toolbox clients';
const TAB = 'Clients';
const HEAD = ['ID', 'Name', 'Business', 'Email', 'Phone', 'Stage', 'Grade %', 'Sessions', 'Hours', 'Last contact', 'Updated', 'Data'];
const COL = Object.fromEntries(HEAD.map((h, i) => [h, i]));
const CELL_MAX = 45000; // a Sheets cell holds 50,000 characters

// ---------- pure: records to rows and back (tested in tests/sheet-store.test.js)
const str = (v, max) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : '').trim().slice(0, max);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sessKey = (s) => s.id || [s.date, s.mins, s.type].join('|');

// A record from the Sheet is data someone could have typed by hand, so it is rebuilt field by field.
function tidy(raw) {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const facts = {};
  for (const [k, v] of Object.entries(r.facts && typeof r.facts === 'object' && !Array.isArray(r.facts) ? r.facts : {}).slice(0, 80)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,30}$/.test(k)) continue;
    if (Array.isArray(v)) { const list = v.map((x) => str(x, 200)).filter(Boolean).slice(0, 30); if (list.length) facts[k] = list; }
    else if (str(v, 600)) facts[k] = str(v, 600);
  }
  const sessions = (Array.isArray(r.sessions) ? r.sessions : []).slice(0, 500).filter((s) => s && typeof s === 'object').map((s) => {
    const out = { date: str(s.date, 40), mins: Math.max(0, Math.round(num(s.mins))), type: str(s.type, 60) };
    if (str(s.id, 60)) out.id = str(s.id, 60);
    if (str(s.note, 200)) out.note = str(s.note, 200);
    return out;
  });
  const src = {};
  for (const [k, v] of Object.entries(r.src && typeof r.src === 'object' && !Array.isArray(r.src) ? r.src : {}).slice(0, 10)) if (/^[a-z]{1,20}$/.test(k)) src[k] = num(v);
  const out = { id: str(r.id, 40), name: str(r.name, 160), biz: str(r.biz, 160), email: str(r.email, 160), phone: str(r.phone, 160), facts, sessions, src, made: num(r.made), updated: num(r.updated) };
  const events = (Array.isArray(r.events) ? r.events : []).slice(0, 200).filter((e) => e && typeof e === 'object' && str(e.id, 60) && str(e.title, 160)).map((e) => ({ id: str(e.id, 60), t: num(e.t), tool: str(e.tool, 40), kind: str(e.kind, 20), title: str(e.title, 160) }));
  if (events.length) out.events = events;
  return out;
}

// info(c) gives the readable extras: { pct, hours, last }. Example records never leave the browser.
function toRows(clients, info) {
  const rows = [HEAD];
  for (const c of clients) {
    if (!c || c.ex || !c.id) continue;
    const i = info ? info(c) : {};
    let data = JSON.stringify(tidy(c));
    if (data.length > CELL_MAX) data = JSON.stringify({ ...tidy(c), sessions: tidy(c).sessions.slice(-100) });
    if (data.length > CELL_MAX) data = '';
    rows.push([c.id, c.name || '', c.biz || '', c.email || '', c.phone || '', (c.facts && typeof c.facts.stage === 'string' && c.facts.stage) || '', i.pct ?? '', (c.sessions || []).length, i.hours ?? '', i.last || '', c.updated ? new Date(c.updated).toISOString() : '', data]);
  }
  return rows;
}

// Reads the Sheet back. A row someone typed by hand (no Data cell) still becomes a client, and a name, business,
// email, phone or stage edited in the Sheet wins over the stored record: it counts as changed at `now`.
function fromRows(rows, makeId, now = 0) {
  const out = [];
  const seen = new Set();
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!Array.isArray(row)) continue;
    const cell = (h) => str(row[COL[h]], 50000);
    if (cell('ID') === 'ID' && cell('Name') === 'Name') continue;
    let data = null;
    try { data = JSON.parse(cell('Data')); } catch {}
    const c = tidy(data);
    c.id = str(cell('ID'), 40) || c.id || (makeId ? makeId() : '');
    let edited = false;
    for (const [h, k] of [['Name', 'name'], ['Business', 'biz'], ['Email', 'email'], ['Phone', 'phone']]) if (cell(h) && cell(h) !== c[k]) { c[k] = str(cell(h), 160); edited = true; }
    if (cell('Stage') && cell('Stage') !== c.facts.stage) { c.facts.stage = str(cell('Stage'), 600); edited = true; }
    if (data && edited && now) c.updated = now;
    if (!c.id || seen.has(c.id) || (!c.name && !c.biz && !c.email)) continue;
    if (!data) { c.updated = Date.parse(cell('Updated')) || 0; c.src.sheet = c.updated; }
    seen.add(c.id);
    out.push(c);
  }
  return out;
}

const same = (a, b) => (a.id && a.id === b.id) || (!!a.email && !!b.email && a.email.toLowerCase() === b.email.toLowerCase());

// One list from this browser's list and the Sheet's. The side changed most recently wins field by field; facts,
// sessions and sources are joined. gone = { id: time removed here }: a client removed here stays removed unless
// the Sheet's copy was changed after that.
function merge(local, remote, gone = {}) {
  const list = local.map((c) => ({ ...c }));
  for (const r of remote) {
    if (gone[r.id] && gone[r.id] >= (r.updated || 0)) continue;
    const i = list.findIndex((l) => !l.ex && same(l, r));
    if (i < 0) { list.push(r); continue; }
    const l = list[i];
    const [older, newer] = (r.updated || 0) > (l.updated || 0) ? [l, r] : [r, l];
    const m = { ...older, ...newer, id: l.id, facts: { ...older.facts, ...newer.facts }, src: { ...older.src } };
    for (const k of ['name', 'biz', 'email', 'phone']) if (!m[k]) m[k] = older[k] || '';
    for (const [k, v] of Object.entries(newer.src || {})) m.src[k] = Math.max(m.src[k] || 0, v || 0);
    const keys = new Set();
    m.sessions = [...(l.sessions || []), ...(r.sessions || [])].filter((s) => !keys.has(sessKey(s)) && keys.add(sessKey(s)));
    const ids = new Set();
    const events = [...(l.events || []), ...(r.events || [])].filter((e) => !ids.has(e.id) && ids.add(e.id)).sort((a, b) => b.t - a.t).slice(0, 200);
    if (events.length) m.events = events; else delete m.events;
    m.made = Math.min(l.made || Infinity, r.made || Infinity);
    if (!Number.isFinite(m.made)) m.made = 0;
    list[i] = m;
  }
  return list;
}

const okAccount = (email, domain) => {
  const e = String(email || '').toLowerCase(), d = String(domain || '').toLowerCase().replace(/^@/, '');
  if (!/^[^@\s]+@[^@\s]+$/.test(e)) return false;
  return !d || e.endsWith('@' + d) || e.endsWith('.' + d);
};

const api = { TITLE, TAB, HEAD, tidy, toRows, fromRows, merge, okAccount };
if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
root.SBDC_SHEET = api;

// ---------- browser: sign-in, the Sheet, and the card on the Clients page
const CFG = root.SBDC_SHEET_CONFIG || {};
const C = root.SBDC_CLIENTS;
const card = document.getElementById('clSheet');
if (!CFG.clientId || !C || !card) return;

const KEY = 'sbdc-sheet';
const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email'];
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3/files';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const toast = (t) => (root.__toast ? root.__toast(t) : null);
const uid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

let token = '';
let busy = false;
let state = (() => { try { const j = JSON.parse(localStorage.getItem(KEY)); return j && typeof j === 'object' ? j : {}; } catch { return {}; } })();
const keep = (patch) => { state = { ...state, ...patch }; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} paint(); };

function paint(note) {
  const warn = CFG.approved ? '' : '<div class="text-secondary small mt-1">Use made-up clients only until Maricopa approves real client details here.</div>';
  const btn = (act, icon, label, kind = 'btn-outline-secondary') => `<button class="btn ${kind}" type="button" data-sheet="${act}"${busy ? ' disabled' : ''}><i data-icon="${icon}"></i>${label}</button>`;
  let text, buttons;
  if (token) {
    text = `<b>Saved to your Google Sheet</b><div class="text-secondary">${esc(note || (state.last ? 'Last synced ' + new Date(state.last).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Connected'))} · ${esc(state.email || '')}</div>`;
    buttons = `<a class="btn btn-outline-secondary" href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.id || '')}/edit" target="_blank" rel="noopener"><i data-icon="external-link"></i>Open the Sheet</a>${btn('sync', 'refresh', 'Sync now')}${btn('off', 'x', 'Disconnect')}`;
  } else if (state.on) {
    text = `<b>Your list is kept in a Google Sheet</b><div class="text-secondary">${esc(note || 'Reconnect to pick up changes and save new ones.')} ${esc(state.email || '')}</div>`;
    buttons = btn('on', 'refresh', 'Reconnect', 'btn-primary');
  } else {
    text = `<b>Keep this list in a Google Sheet</b><div class="text-secondary">${esc(note || 'Sign in with your Maricopa Google account. The list is then the same on every computer you use.')}</div>`;
    buttons = btn('on', 'file-spreadsheet', 'Connect Google Sheet', 'btn-primary');
  }
  card.innerHTML = `<div class="card-body d-flex gap-3 flex-wrap align-items-center"><div class="me-auto">${text}${warn}</div><div class="d-flex gap-2 flex-wrap">${buttons}</div></div>`;
  card.hidden = false;
  if (root.renderIcons) root.renderIcons(card);
}

async function call(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { Authorization: 'Bearer ' + token, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (res.status === 401) { token = ''; throw new Error('expired'); }
  if (!res.ok) throw new Error('Google answered ' + res.status);
  return res.json();
}

async function findOrMake() {
  const q = encodeURIComponent(`name = '${TITLE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
  const { files = [] } = await call(`${DRIVE}?q=${q}&fields=files(id)&orderBy=modifiedTime desc&pageSize=10`);
  const found = files.find((f) => f.id === state.id) || files[0];
  if (found) return found.id;
  const made = await call(SHEETS, { method: 'POST', body: JSON.stringify({ properties: { title: TITLE }, sheets: [{ properties: { title: TAB, gridProperties: { frozenRowCount: 1 } } }] }) });
  return made.spreadsheetId;
}

const info = (c) => {
  const g = C.grade(c);
  const t = root.SBDC_GRADE.lastContact(c);
  return { pct: g.pct, hours: Math.round(c.sessions.reduce((a, s) => a + (Number(s.mins) || 0), 0) / 6) / 10, last: t ? new Date(t).toLocaleDateString('en-US') : '' };
};

// Read the Sheet, merge, write the result back, then blank any rows left below it.
async function sync(quiet) {
  if (!token || busy) return;
  busy = true; paint('Syncing…');
  try {
    const range = encodeURIComponent(`${TAB}!A1:L`);
    const { values = [] } = await call(`${SHEETS}/${state.id}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`);
    const before = JSON.stringify(C.all());
    const list = merge(C.all(), fromRows(values, uid, Date.now()), C.gone());
    if (JSON.stringify(list) !== before) C.setAll(list);
    const rows = toRows(list, info);
    await call(`${SHEETS}/${state.id}/values/${encodeURIComponent(`${TAB}!A1`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: rows }) });
    if (values.length > rows.length) await call(`${SHEETS}/${state.id}/values/${encodeURIComponent(`${TAB}!A${rows.length + 1}:L`)}:clear`, { method: 'POST', body: '{}' });
    busy = false; keep({ last: Date.now() });
    if (!quiet) toast(`Google Sheet synced: ${rows.length - 1} ${rows.length === 2 ? 'client' : 'clients'}`);
  } catch (e) {
    busy = false;
    paint(e.message === 'expired' ? 'Google signed you out after an hour. Reconnect to keep syncing.' : `Couldn't sync (${e.message}). This browser still has your list.`);
  }
}

const gsi = () => new Promise((done, fail) => {
  if (root.google?.accounts?.oauth2) return done();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.onload = () => (root.google?.accounts?.oauth2 ? done() : fail(new Error('no sign-in')));
  s.onerror = () => fail(new Error('blocked'));
  document.head.appendChild(s);
});

async function connect() {
  try { await gsi(); } catch { return paint("Couldn't reach Google sign-in. Check the connection and try again."); }
  const oauth = root.google.accounts.oauth2;
  oauth.initTokenClient({
    client_id: CFG.clientId, scope: SCOPES.join(' '), login_hint: state.email || undefined,
    error_callback: () => paint('Sign-in was closed before it finished.'),
    callback: async (resp) => {
      if (!resp || resp.error || !resp.access_token) return paint('Google did not sign you in.');
      if (!oauth.hasGrantedAllScopes(resp, ...SCOPES)) return paint('Tick both boxes on the Google screen so the list can be saved, then connect again.');
      token = resp.access_token;
      try {
        const who = await call('https://www.googleapis.com/oauth2/v3/userinfo');
        if (!okAccount(who.email, CFG.domain)) { oauth.revoke(token); token = ''; return paint(`Sign in with your ${CFG.domain} account. ${who.email || 'That account'} can't be used here.`); }
        state = { ...state, email: who.email };
        keep({ on: true, id: await findOrMake() });
        await sync();
      } catch (e) { token = ''; paint(`Couldn't set up the Sheet (${e.message}).`); }
    },
  }).requestAccessToken();
}

card.addEventListener('click', (e) => {
  const act = e.target.closest('[data-sheet]')?.dataset.sheet;
  if (act === 'on') connect();
  else if (act === 'sync') sync();
  else if (act === 'off') {
    if (token && root.google?.accounts?.oauth2) root.google.accounts.oauth2.revoke(token);
    token = ''; state = {}; keep({});
    toast('Disconnected. The Sheet stays in your Google Drive and this browser keeps its list.');
  }
});

// A change to the list here is saved to the Sheet a moment later.
let timer = 0;
document.addEventListener('sbdc:clients', () => { if (!token || busy) return; clearTimeout(timer); timer = setTimeout(() => sync(true), 1500); });
paint();
})(typeof window !== 'undefined' ? window : globalThis);
