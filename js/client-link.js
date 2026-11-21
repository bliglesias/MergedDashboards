// Client link: joins the Toolbox tools (tools.js, toolbox.js) to the client list (clients.js).
// 1. Read: "Fill from a saved client" fills every box a tool has that the client's record can answer.
// 2. Save: after a run the advisor is asked which answers to save to that client. Facts only change when they
//    say yes. The run itself goes on the client's timeline.
// 3. Lists: the follow-up, digest and activity tools can use the saved clients instead of pasted rows.
// Fact names are the ones the client intake and the grade (grade.js) already use, so a saved answer moves the grade.
(() => {
const C = window.SBDC_CLIENTS, TB = window.TB, G = window.SBDC_GRADE;
const dlg = document.getElementById('tm');
if (!C || !TB || !G || !dlg || !window.__tb) return;
const T = Object.fromEntries(TB.TOOLS.map((t) => [t.id, t]));
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const isExample = (s) => /^example\b/i.test(String(s || '').trim());
const first = (s) => String(s || '').trim().split(/\s+/)[0] || '';
const toast = (t) => (window.__toast ? window.__toast(t) : null);
const real = () => C.all().filter((c) => !c.ex);
const label = (c) => `${c.name || c.biz}${c.name && c.biz ? ' · ' + c.biz : ''}`;

// ---------- what each tool reads from a client and what it can save back
const stageWord = (c) => { const s = String(c.facts.stage || '').toLowerCase(); return /not yet|idea|pre-?venture|start/.test(s) ? 'Not Yet in Business' : /exist|establish|in business/.test(s) ? 'In Business' : ''; };
const dayOf = (v) => (String(v || '').match(/^\d{4}-\d{2}-\d{2}/) || [''])[0];
const optLabels = (tool, field) => Object.fromEntries((T[tool]?.run.find((f) => f.id === field)?.opts || []).map(([k, l]) => [k, l]));
const LOAN_DOCS = optLabels('loanready', 'have');
const fact = (k) => (c) => c.facts[k];
const LINK = {
  industry: { read: { industry: fact('industry') }, save: (v) => ({ industry: v.industry }) },
  prep: { read: { industry: fact('industry'), goal: fact('goal') }, save: (v) => ({ industry: v.industry, goal: v.goal, nextSession: [v.date, v.time].filter(Boolean).join(' ') }) },
  // The ticked items also count as "Key documents on hand" in the grade, so their names join the client's documents.
  loanready: { read: { have: fact('loanDocs') }, save: (v, c) => ({ loanDocs: v.have, docs: [...new Set([...(Array.isArray(c.facts.docs) ? c.facts.docs : []), ...(v.have || []).map((k) => LOAN_DOCS[k] || k)])] }) },
  breakeven: { read: { price: fact('price'), cost: fact('cost'), fixed: fact('fixed'), vol: fact('volume') }, save: (v) => ({ price: v.price, cost: v.cost, fixed: v.fixed, volume: v.vol }) },
  zoom: { read: { desc: fact('bizDesc') }, save: (v) => ({ bizDesc: v.desc }) },
  email: { kind: 'email', read: { next: fact('nextSteps'), when: fact('nextMeeting') }, save: (v) => ({ nextSteps: v.next, nextMeeting: v.when }) },
  cic: { read: { status: stageWord, desc: fact('bizDesc') }, save: (v) => ({ stage: v.status, bizDesc: v.desc, nextSteps: v.next, impact: v.impact }) },
  homework: { kind: 'email', read: { next: (c) => dayOf(c.facts.nextSession), items: fact('homework') }, save: (v) => ({ nextSession: v.next, homework: v.items }) },
  graydot: { kind: 'email' }, checkin: { kind: 'email' }, noshow: { kind: 'email' },
};
const WHO = ['name', 'client', 'biz'];
// The name boxes ask for different things: a first name, the business, or either.
const whoValue = (f, c) => {
  const l = f.label.toLowerCase();
  return /first name/.test(l) ? first(c.name || c.biz) : /business/.test(l) && !/client/.test(l) ? c.biz || c.name : c.name || c.biz;
};
const readsOf = (t) => t.run.map((f) => [f, f.id === 'to' ? (c) => c.email : WHO.includes(f.id) ? (c) => whoValue(f, c) : LINK[t.id]?.read?.[f.id]]).filter(([, get]) => get);

// Fact values shown to people: ticked lists use the words on the tool, not the short codes kept in the record.
const SHOW = { loanDocs: LOAN_DOCS, homework: optLabels('homework', 'items') };
const show = (k, v) => (Array.isArray(v) ? v.map((x) => SHOW[k]?.[x] || x).join(', ') : String(v ?? ''));
window.SBDC_FACT_SHOW = show;

// ---------- 1. read: fill a tool from a saved client
const picked = {}; // tool id -> client id chosen in the open tool, so the save step knows who the run was for
function setField(t, f, val) {
  const name = `f-${t.id}-${f.id}`;
  if (f.type === 'checks' || f.type === 'radio') {
    const want = new Set(Array.isArray(val) ? val : [String(val)]);
    document.querySelectorAll(`#tm [name="${name}"]`).forEach((i) => { i.checked = want.has(i.value); });
    return;
  }
  const el = document.getElementById(name);
  if (!el || (f.type === 'select' && ![...el.options].some((o) => o.value === String(val)))) return;
  el.value = val;
  el.classList.remove('is-invalid');
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
function fillFrom(c, t) {
  let n = 0;
  for (const [f, get] of readsOf(t)) {
    const val = get(c);
    if (Array.isArray(val) ? !val.length : String(val ?? '').trim() === '') continue;
    setField(t, f, val);
    n++;
  }
  return n;
}
function addPicker() {
  const run = $('#tmRun'), t = T[window.__tb.cur()];
  if (!run || !t) return;
  run.querySelector('.cl-pick')?.remove();
  delete picked[t.id];
  const list = C.all().filter((c) => !c.ex || C.all().length === 1).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  if (!readsOf(t).length || !list.length) return;
  const box = document.createElement('div');
  box.className = 'tm-f full cl-pick';
  box.innerHTML = `<label class="form-label" for="clPick">Fill from a saved client</label><select class="form-select" id="clPick"><option value="">Choose a client…</option>${list.map((c) => `<option value="${esc(c.id)}">${esc(label(c))}</option>`).join('')}</select>`;
  run.prepend(box);
  box.querySelector('select').addEventListener('change', (e) => {
    const c = C.get(e.target.value);
    if (!c) { delete picked[t.id]; return; }
    picked[t.id] = c.id;
    fillFrom(c, t);
  });
}

// ---------- 3. lists: rows for the list tools, from the saved clients
const mdy = (t) => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; };
// Gray dot = no first meeting yet; yellow = has met, or already in business (the meanings tools.js uses).
function contactRows() {
  const rows = real().map((c) => {
    const last = G.lastContact(c) || c.made || 0;
    return last ? [c.name || c.biz, c.email || '', mdy(last), c.sessions.length || stageWord(c) === 'In Business' ? 'Yellow' : 'Gray'] : null;
  }).filter(Boolean);
  return rows.length ? [['Name', 'Email', 'Last contact', 'Dot'], ...rows].map((r) => r.join('\t')).join('\n') : '';
}
function sessionRows() {
  const rows = real().flatMap((c) => c.sessions.filter((s) => Number.isFinite(Date.parse(s.date)) && Number(s.mins) > 0).map((s) => [mdy(Date.parse(s.date)), c.name || c.biz, Math.min(999, Math.round(Number(s.mins))), s.type || 'Other']));
  return rows.length ? [['Date', 'Client', 'Minutes', 'Type'], ...rows].map((r) => r.join('\t')).join('\n') : '';
}
const LISTS = { tracker: contactRows, digest: contactRows, activity: sessionRows };
window.SBDC_LISTS = LISTS; // toolbox.js: a scheduled list tool runs on these rows
// Home's "Follow-ups due" card shows the saved clients until the advisor runs the tool on a pasted list.
function homeDue() {
  if (window.__tracker && !window.__tracker.saved) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const rows = real().map((c) => G.lastContact(c) || c.made || 0).filter(Boolean).map((t) => ({ days: Math.max(0, Math.floor((today - t) / 864e5)) }));
  if (!rows.length && !window.__tracker) return;
  window.__tracker = { rows, sample: false, saved: true };
  document.dispatchEvent(new CustomEvent('sbdc:tracker'));
}
document.addEventListener('sbdc:clients', homeDue);
homeDue();
function addListButton() {
  const t = T[window.__tb.cur()], make = t && LISTS[t.id];
  const sample = $('#tmRun .tm-sample');
  if (!make || !sample || sample.parentElement.querySelector('[data-clients]') || !make()) return;
  const b = document.createElement('button');
  b.className = 'btn btn-link btn-sm';
  b.type = 'button';
  b.dataset.clients = t.id;
  b.textContent = 'Use my saved clients';
  sample.after(b);
  b.addEventListener('click', () => {
    const ta = document.getElementById(`f-${t.id}-list`);
    ta.value = make();
    ta.classList.remove('is-invalid');
    toast('Rows added from your saved clients');
  });
}
new MutationObserver(() => { if (dlg.open) { addPicker(); addListButton(); } }).observe(dlg, { attributes: true, attributeFilter: ['open'] });

// ---------- 2. save: after a run, offer to save the answers to the client
const same = (a, b) => JSON.stringify(a ?? '') === JSON.stringify(b ?? '');
const blank = (v) => (Array.isArray(v) ? !v.length : String(v ?? '').trim() === '');
function changesFor(tool, v, c) {
  const facts = LINK[tool]?.save?.(v, c) || {};
  return Object.entries(facts).filter(([k, val]) => !blank(val) && !same(val, c.facts[k]));
}
// Who the run was for: the client picked in the tool, else the saved client the typed name or email matches.
function findClient(tool, v) {
  const chosen = picked[tool] && C.get(picked[tool]);
  if (chosen) return chosen;
  const list = real();
  if (v.to) { const hit = list.find((c) => c.email && c.email.toLowerCase() === String(v.to).toLowerCase()); if (hit) return hit; }
  const typed = norm(v.client || v.name || v.biz);
  if (!typed) return null;
  const exact = list.filter((c) => norm(c.name) === typed || norm(c.biz) === typed);
  if (exact.length === 1) return exact[0];
  const firsts = list.filter((c) => norm(first(c.name)) === typed);
  return !exact.length && firsts.length === 1 ? firsts[0] : null;
}

const box = document.createElement('dialog');
box.className = 'tmodal';
box.id = 'clSave';
box.setAttribute('aria-labelledby', 'clSaveT');
box.innerHTML = `<form method="dialog" id="clSaveForm">
  <div class="tm-head"><span class="ttile"><i data-icon="users"></i></span><div class="tm-ht"><h2 id="clSaveT">Save to the client's record</h2><p id="clSaveSub"></p></div></div>
  <div class="tm-body"><div class="tm-grid">
    <div class="tm-f full"><label class="form-label" for="clSaveWho">Client</label><select class="form-select" id="clSaveWho"></select></div>
    <fieldset class="tm-f full tm-checks" id="clSaveList"></fieldset>
  </div></div>
  <div class="tm-foot"><button class="btn btn-ghost-secondary" type="button" id="clSaveNo">Not now</button><button class="btn btn-primary" type="submit"><i data-icon="clipboard-check"></i>Save to record</button></div>
</form>`;
document.body.appendChild(box);
if (window.renderIcons) window.renderIcons(box);

let pending = null; // { tool, v, event, newName }
function paintList() {
  const id = $('#clSaveWho').value;
  const c = id === '__new' ? { facts: {} } : C.get(id);
  const rows = c ? changesFor(pending.tool, pending.v, c) : [];
  $('#clSaveList').innerHTML = `<legend class="form-label">${rows.length ? 'Tick what to save' : 'Nothing new to save from this run'}</legend>${rows.map(([k, val]) => `<label class="form-check"><input class="form-check-input" type="checkbox" value="${esc(k)}" checked><span class="form-check-label"><b>${esc(C.names[k] || k)}:</b> ${esc(show(k, val))}${blank(c.facts[k]) ? '' : ` <span class="text-secondary">(now: ${esc(show(k, c.facts[k]))})</span>`}</span></label>`).join('')}<div class="tm-hint">The run is also added to this client's timeline.</div>`;
}
$('#clSaveWho').addEventListener('change', paintList);
$('#clSaveNo').addEventListener('click', () => { pending = null; box.close(); });
$('#clSaveForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!pending) return box.close();
  const { tool, v, event, newName } = pending;
  const id = $('#clSaveWho').value;
  const c = id === '__new' ? C.upsert(v.client || v.name ? { name: newName, email: v.to || '' } : { biz: newName }, 'toolbox') : C.get(id);
  if (!c) return box.close();
  const ticked = new Set([...box.querySelectorAll('#clSaveList input:checked')].map((i) => i.value));
  const facts = Object.fromEntries(changesFor(tool, v, c).filter(([k]) => ticked.has(k)));
  C.update(c.id, { facts, event });
  pending = null;
  box.close();
  toast(`Saved to ${c.name || c.biz}'s record`);
});

document.addEventListener('sbdc:run', (e) => {
  const { tool, v, rec } = e.detail || {};
  const t = T[tool];
  if (!t || !rec || rec.ex || rec.status !== 'done') return;
  const typed = String(v.client || v.name || v.biz || '').trim();
  if (isExample(typed) || /@example\.com$/i.test(v.to || '')) return;
  const c = findClient(tool, v);
  delete picked[tool];
  if (!c && !typed) return;
  const event = { id: 'e' + rec.id, t: rec.t, tool, kind: LINK[tool]?.kind || 'tool', title: LINK[tool]?.kind === 'email' ? `${t.title}: email drafted` : t.title };
  // A known client with nothing new to save: the run is logged on their timeline and nothing else changes.
  if (c && !changesFor(tool, v, c).length) { C.update(c.id, { event }); return; }
  pending = { tool, v, event, newName: c ? '' : typed };
  $('#clSaveSub').textContent = t.title;
  $('#clSaveWho').innerHTML = `${c ? '' : `<option value="__new">New client: ${esc(typed)}</option>`}${real().sort((a, b) => (b.updated || 0) - (a.updated || 0)).map((x) => `<option value="${esc(x.id)}"${c && x.id === c.id ? ' selected' : ''}>${esc(label(x))}</option>`).join('')}`;
  paintList();
  box.showModal();
});
})();
