// Side panel. Shows one card with the next thing to do, writes a client's details into the page one visible
// step at a time ("Fill this page") or one clicked box at a time ("Point and fill"), and keeps the extra
// controls under "More". All state for a run lives here; closing the panel ends the run.
import { icon, renderIcons } from '../lib/icons.js';
import { parseBlock, normalizeLabel } from '../lib/parse.js';
import { planFill, labelScore, AUTO_ON, useSameBoxes } from '../lib/match.js';
import { DASHBOARD_ORIGIN, SETTINGS_ORIGIN, AZCC_ORIGIN, AZCC_SEARCH, getLinks, useLists, listSites, turnOn, turnOff, hasEvery, turnOnEvery, turnOffEvery, parseSiteAddress, addSite, removeSite } from '../lib/sites.js';
import { MAIL_APPS, draftUrl } from '../lib/mail.js';
import { cleanSettings } from '../lib/settings.js';
import { listKind, sessionRows } from '../lib/lists.js';
import { PULL_SOURCES, pageToText, jsonToRows, rowsToText } from '../lib/pull.js';

const $ = (id) => document.getElementById(id);
const MAX_BLOCK = 20000;

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kids.filter((k) => k != null));
  return el;
}
const short = (s, n = 60) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));
const oneLine = (s) => String(s).replace(/\s+/g, ' ').trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let toastTimer;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), 3200);
}
function badge(id, text, tone = 'secondary-lt') {
  $(id).textContent = text;
  $(id).className = 'badge bg-' + tone;
}
function showResult(text, warn) {
  $('result').textContent = text;
  $('result').className = 'result' + (warn ? ' warn' : '');
  $('result').hidden = false;
}

// The panel normally follows the active tab. "?tab=<id>" pins it to one tab (used when the panel is
// opened as a full page, which is how the automated tests drive it).
const pinnedTab = Number(new URLSearchParams(location.search).get('tab')) || null;

const page = { tabId: null, origin: '', ready: false, every: false, scan: null, isDashboard: false, hasMail: false, title: '' };
let plan = null;
const run = { active: false, paused: false, stop: false, single: false, i: 0, tabId: null, port: null, why: '' };
const pick = { active: false, tabId: null, port: null, items: [], used: new Set(), asking: null, log: [] };
let pulling = false;
const busy = () => run.active || pick.active || pulling;

// ---------- This page ----------
async function currentTab() {
  if (pinnedTab) return chrome.tabs.get(pinnedTab).catch(() => null);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

async function refreshPage() {
  const tab = await currentTab();
  let origin = '';
  try {
    const u = new URL(tab?.url || '');
    if (/^https?:$/.test(u.protocol)) origin = u.origin;
  } catch {}
  // Chrome only shows the helper a page's address once the helper may work there: on the Toolbox, on a site
  // the advisor allowed, or on the page they opened the helper on. So "address visible" means "ready".
  const ready = !!origin;
  const moved = tab?.id !== page.tabId || origin !== page.origin;
  Object.assign(page, { tabId: tab?.id ?? null, origin, ready, title: tab?.title || '', onAzcc: (tab?.url || '').startsWith(AZCC_SEARCH) });
  if (moved) {
    page.scan = null;
    page.isDashboard = origin === DASHBOARD_ORIGIN;
    if (!busy()) dropPlan();
  }
  page.every = await hasEvery();
  await checkMail();
  paintPage();
  if (origin === SETTINGS_ORIGIN) pullSettings(tab.id);
}

// ---------- Settings the dashboard publishes ----------
// Site list, related pages and box names can change on the dashboard without a new install (helper-settings.js).
// Read only from the real Toolbox address, checked by lib/settings.js, kept for the next time the panel opens.
function applySettings(held) {
  useLists(held || {});
  useSameBoxes(held?.same);
}
async function pullSettings(tabId) {
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => { try { return JSON.parse(JSON.stringify(window.__helperSettings ?? null)); } catch { return null; } },
    });
    const clean = cleanSettings(result, SETTINGS_ORIGIN);
    if (!clean) return;
    const { remote = null } = await chrome.storage.local.get('remote');
    if (JSON.stringify(remote) === JSON.stringify(clean)) return;
    await chrome.storage.local.set({ remote: clean });
    applySettings(clean);
    paintLinks();
    paintSites();
  } catch {}
}

// "Draft the email" only shows once the Toolbox has an email to draft.
async function checkMail() {
  page.hasMail = page.ready && page.isDashboard && (await toolResults()).some((o) => o.mail);
}

// The business name in the details, if there is one.
function heldName() {
  const fields = parseBlock($('block').value).items.filter((it) => it.kind === 'field');
  const hit = fields.find((it) => labelScore(it.label, 'Business Name') >= 0.95) || fields.find((it) => /^(business|company|client or business)$/.test(normalizeLabel(it.label)));
  return hit ? oneLine(hit.value).slice(0, 120) : '';
}

const hasBlock = () => !!$('block').value.trim();
let list = null; // { rows, text }: a client list copied from a page, held in memory like the details

// The two steps at the top: 1 pick something up, 2 write it. Shows which one the advisor is on.
function paintFlow(record) {
  const n = parseBlock($('block').value).items.length;
  const held = n > 0 || !!list;
  $('flowPick').className = held ? 'done' : 'now';
  $('flowPick').querySelector('.n').textContent = held ? '✓' : '1';
  $('flowPickSub').textContent = n ? `${n} ${n === 1 ? 'detail' : 'details'} ready` : list ? `list of ${list.rows} rows` : 'from your Toolbox';
  $('flowWrite').className = held ? 'now' : '';
  $('flowWriteSub').textContent = n && record ? 'onto this page' : list && !n ? 'into a Toolbox tool' : 'onto a page';
}

// A result written for CenterIC (session fields, CIC notes, or the client intake block). The advisor's CenterIC
// address is not known, so the helper goes by what it is holding, not by which site is open.
const forCic = () => /CIC SESSION FIELDS|CIC Notes box|CIC CLIENT \/ eRFC/i.test($('block').value);
const postsToCic = () => page.ready && !page.isDashboard && !page.onAzcc && forCic();

// One sentence that says what to do next, and one main button.
function paintPage() {
  const dash = page.ready && page.isDashboard;
  const record = page.ready && !page.isDashboard;
  // Anywhere the next step is "go to the Toolbox", offer the way there.
  $('toolboxBtn').hidden = dash || (record && hasBlock());
  // Until the advisor has said yes once, a page outside the Toolbox offers that one yes.
  $('everyBtn').hidden = page.ready || page.every;
  $('toolboxBtn').className = 'btn ' + ($('everyBtn').hidden ? 'btn-primary' : 'btn-outline');
  $('grabBtn').hidden = $('notesBtn').hidden = !dash;
  $('listBtn').hidden = !dash || !list;
  $('listBtn').lastChild.textContent = list?.kind === 'sessions' ? 'Put the list into Monthly report' : 'Put the list into Follow-ups';
  $('mailBtn').hidden = !dash || !page.hasMail;
  // Quick access buttons are always there; they are dimmed when they have nothing to work on.
  $('llcBtn').classList.toggle('off', !heldName());
  $('llcBtn').disabled = busy();
  $('copyDetailsBtn').classList.toggle('off', !record);
  $('copyListBtn').classList.toggle('off', !record);
  paintFlow(record);
  $('listHeld').hidden = !list;
  $('pullBtn').hidden = dash;
  $('pullBtn').disabled = busy();
  $('pullPutBtn').hidden = !dash || !pulled;
  $('pullHeld').hidden = !pulled;
  if (pulled) $('pullHeldText').textContent = `Holding a pull: ${short(pulled.title, 50)}.`;
  if (dash) $('pullBox').hidden = true;
  if (list) $('listHeldText').textContent = `Holding a ${list.kind === 'sessions' ? 'session log' : 'client list'} of ${list.rows} rows.`;
  if (!dash) $('outs').hidden = true;
  $('planBtn').hidden = $('pickBtn').hidden = !record;
  $('planBtn').disabled = $('pickBtn').disabled = $('checkBtn').disabled = !hasBlock() || busy();
  $('checkBtn').hidden = !postsToCic();
  $('planBtn').lastChild.textContent = postsToCic() ? 'Post to CenterIC' : 'Fill this page';
  $('pickBtn').lastChild.textContent = pick.active ? 'Pointing…' : 'Point and fill';

  $('readBtn').hidden = !page.ready;
  $('openIntakeBtn').hidden = $('fillDashBtn').hidden = !dash;
  $('noPageTools').hidden = page.ready;
  $('found').hidden = !page.scan;
  paintForget();

  if (!page.ready) {
    // The helper is running; it just has nothing it may touch on this page yet. Say what to do, not "off".
    document.body.dataset.page = 'idle';
    $('pageName').textContent = 'Advisor Helper';
    $('pageSub').textContent = page.every
      ? 'There is nothing to fill on this page. Open the page you want, or your Advisor Toolbox.'
      : 'Say yes once and it works on the pages you open. It only acts when you click, and you always save it yourself.';
    return;
  }
  document.body.dataset.page = 'ready';
  $('pageName').textContent = dash ? 'Advisor Toolbox' : page.scan?.title || page.title || new URL(page.origin).hostname;
  $('pageSub').textContent = dash
    ? pulled
      ? 'You have a pulled page. Put it into Outputs to keep it with your tool results.'
      : list
      ? list.kind === 'sessions'
        ? `You have a session log of ${list.rows} rows. Put it into the Monthly report to total your hours.`
        : `You have a list of ${list.rows} rows. Put it into Follow-ups to see who is due.`
      : hasBlock()
      ? forCic()
        ? 'Ready for CenterIC. Open the client or session screen there and click “Post to CenterIC”.'
        : 'Ready to write. Open the page you want to fill and click “Fill this page”.'
      : 'Run a tool in your Toolbox, then pick up the result here.'
    : hasBlock()
      ? postsToCic()
        ? 'Open the CenterIC screen you want, then post. It fills the boxes. You check them and press Save yourself.'
        : 'Fill the whole page, or point at just the boxes you want.'
      : 'Nothing to write yet. Pick something up from your Advisor Toolbox first.';
}

async function inject() {
  await chrome.scripting.executeScript({ target: { tabId: page.tabId }, files: ['content/agent.js'] });
}
const send = (type, extra = {}, tabId = page.tabId) => chrome.tabs.sendMessage(tabId, { to: 'sbdc-agent', type, ...extra });

async function readPage(quiet) {
  if (!page.ready) return null;
  try {
    await inject();
    page.scan = await send('scan');
  } catch {
    page.scan = null;
    toast("Couldn't read this page. Reload it and try again.");
    return null;
  }
  if (page.scan.isDashboard) page.isDashboard = true;
  await checkMail();
  const f = page.scan.fields;
  const filled = f.filter((x) => !x.blocked && (x.value || x.checked)).length;
  const blocked = f.filter((x) => x.blocked).length;
  $('foundSum').textContent = `${f.length} ${f.length === 1 ? 'box' : 'boxes'} found · ${filled} filled in · ${blocked} protected`;
  $('foundList').replaceChildren(
    ...f.map((x) =>
      h('li', {},
        h('div', { class: 'grow' },
          h('div', { class: 'name', text: x.label || '(no label)' }),
          h('div', { class: 'meta', text: x.blocked ? `Protected: ${x.blocked}` : describe(x) })
        ),
        x.blocked ? h('span', { class: 'badge bg-yellow-lt', text: 'Skipped' }) : null
      )
    )
  );
  paintPage();
  if (!quiet) toast(`Found ${f.length} ${f.length === 1 ? 'box' : 'boxes'} on this page`);
  return page.scan;
}

function describe(x) {
  const kind = { text: 'Text', textarea: 'Long text', select: 'List', radio: 'Choice', checkbox: 'Tick box' }[x.type];
  if (x.type === 'checkbox') return `${kind} · ${x.checked ? 'ticked' : 'not ticked'}`;
  return x.value ? `${kind} · has “${x.value}”` : `${kind} · empty`;
}

// Goes to the Toolbox tab if one is open in this window, and opens one if not.
async function openToolbox() {
  try {
    const [tab] = await chrome.tabs.query({ url: DASHBOARD_ORIGIN + '/*', currentWindow: true });
    if (tab) await chrome.tabs.update(tab.id, { active: true });
    else await chrome.tabs.create({ url: DASHBOARD_ORIGIN + '/' });
  } catch {
    toast("Couldn't open the Advisor Toolbox.");
  }
}

// One yes for every https page, instead of adding sites one at a time under More.
async function useEverywhere() {
  try {
    // permissions.request must be the first await: Chrome only allows it straight from a click.
    if (!(await turnOnEvery())) return toast('Chrome did not turn it on.');
  } catch {
    return toast('Chrome did not turn it on.');
  }
  paintSites();
  refreshPage();
}

async function grabCicBlock() {
  try {
    // The dashboard exposes its own "Copy for CIC" text builder as window.__cicText (p2.js).
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: page.tabId },
      world: 'MAIN',
      func: () => (typeof window.__cicText === 'function' ? String(window.__cicText()) : null),
    });
    if (typeof result !== 'string' || !result.trim()) throw new Error('empty');
    $('block').value = result.slice(0, MAX_BLOCK);
    saveBlock(true);
    toast('Got the client intake.');
  } catch {
    toast("Couldn't get the details from this page.");
  }
}

async function openIntake() {
  try {
    await inject();
    const res = await send('click', { selector: 'a[href="#/intake/intake"]' });
    toast(res.ok ? 'Opened Intake & brief' : res.error);
  } catch {
    toast("Couldn't reach this page. Reload it and try again.");
  }
}

// The dashboard's finished Toolbox runs, newest first (it exposes them as window.__tb.O, toolbox.js).
async function toolResults() {
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: page.tabId },
      world: 'MAIN',
      func: () => {
        const tb = window.__tb;
        if (!tb || typeof tb.O !== 'function') return [];
        return tb.O().filter((o) => o && typeof o.text === 'string' && o.text.trim()).slice(0, 12)
          .map((o) => ({
            title: String(o.title || ''), tool: String((tb.T && tb.T[o.tool] && tb.T[o.tool].title) || ''), t: Number(o.t) || 0, text: o.text.slice(0, 20000),
            mail: o.mail && typeof o.mail.body === 'string' ? { to: String(o.mail.to || ''), subject: String(o.mail.subject || ''), body: o.mail.body.slice(0, 20000) } : null,
          }));
      },
    });
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

// A short list of choices in the main card. Each choice is { title, sub, go }.
function ask(question, choices) {
  $('outsQ').textContent = question;
  $('outsList').replaceChildren(
    ...choices.map((c) => h('button', { class: 'choice', type: 'button', onclick: () => { $('outs').hidden = true; c.go(); } }, h('b', { text: c.title }), c.sub ? h('span', { text: c.sub }) : null))
  );
  $('outs').hidden = false;
  $('outs').scrollIntoView({ block: 'nearest' });
}
const whenAnd = (o) => [o.t ? new Date(o.t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '', short(o.title, 60)].filter(Boolean).join(' · ');

// A finished Toolbox run (for example "Format notes for CIC") becomes the details to write.
async function pickNotes() {
  const outs = (await toolResults()).slice(0, 6);
  if (!outs.length) return toast('No tool results yet. Run a Toolbox tool first.');
  ask('Which one?', outs.map((o) => ({ title: o.tool || o.title || 'Result', sub: whenAnd(o), go: () => { $('block').value = o.text; saveBlock(true); toast('Got it. Open the page you want to fill.'); } })));
}

// An email a Toolbox tool wrote opens as a draft in the advisor's own mail. The advisor reads it and presses Send.
async function pickMail() {
  const mails = (await toolResults()).filter((o) => o.mail).slice(0, 6);
  if (!mails.length) return toast('No email yet. Run an email tool in the Toolbox first.');
  if (mails.length === 1) return draftMail(mails[0].mail);
  ask('Which email?', mails.map((o) => ({ title: o.tool || 'Email', sub: whenAnd(o), go: () => draftMail(o.mail) })));
}
async function draftMail(mail) {
  // Gmail unless the advisor picked something else under More: Maricopa accounts are Google accounts.
  let { mailApp } = await chrome.storage.local.get('mailApp');
  if (!MAIL_APPS[mailApp]) mailApp = 'gmail';
  const { url, cut } = draftUrl(mailApp, mail);
  try {
    // The mail app on this computer is opened from the dashboard tab, the same way the dashboard's own button does it.
    if (mailApp === 'app') await chrome.tabs.update(page.tabId, { url });
    else await chrome.tabs.create({ url });
  } catch {
    return toast("Couldn't open the draft.");
  }
  showResult(`Draft opened in ${MAIL_APPS[mailApp]}.${cut ? ' It was long, so the end was cut: copy the rest from your Toolbox results.' : ''} Nothing was sent: read it, then send it yourself.`, cut);
}

// Opens the Arizona Corporation Commission's public search and types the business name. The advisor presses Search.
async function checkName() {
  if (busy()) return;
  const name = heldName();
  if (!name) return toast('No business name in the details yet.');
  let tab;
  try {
    // permissions.request must be the first await: Chrome only allows it straight from a click.
    if (!(await turnOn(AZCC_ORIGIN))) return toast('Chrome did not turn the AZCC site on.');
    tab = await chrome.tabs.create({ url: AZCC_SEARCH });
  } catch {
    return toast("Couldn't open the AZCC search.");
  }
  paintSites();
  toast('Opening the AZCC search…');
  // The search box appears a moment after the page opens, so look for it for up to 20 seconds.
  let box = null;
  for (let i = 0; i < 40 && !box; i++) {
    await sleep(500);
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/agent.js'] });
      const scan = await send('scan', {}, tab.id);
      box = scan.fields.find((f) => !f.blocked && f.type === 'text' && labelScore(f.label, 'Business Name') >= 0.95) || null;
    } catch {}
  }
  if (!box) return showResult('The AZCC page did not show its Business Name box. Type the name yourself.', true);
  try {
    await send('show', { id: box.id, text: short(name, 44) }, tab.id);
    await sleep(Number($('speed').value) || 800);
    const res = await send('fill', { id: box.id, value: name }, tab.id);
    if (!res.ok) throw new Error(res.error);
    await send('banner', { text: 'Name typed. Check it, then press Business Search yourself.', state: 'done' }, tab.id);
    showResult(`Typed “${short(name, 50)}” into the AZCC search. Nothing was searched: check the name, then press Business Search yourself.`);
  } catch {
    showResult('The helper could not type the name on the AZCC page. Type it yourself.', true);
  }
  releasePage(tab.id, null);
}

// Record page -> details: what is already filled in on this page, to write into another page.
async function copyPageDetails() {
  if (!page.ready || page.isDashboard) return toast('Open the page you want to copy from first.');
  if (!(await readPage(true))) return;
  const res = await send('values').catch(() => null);
  if (!res?.ok || !res.count) return toast('Nothing is filled in on this page yet.');
  $('block').value = res.text.slice(0, MAX_BLOCK);
  saveBlock(true);
  dropPlan();
  toast(`Copied ${res.count} details from this page.`);
}

// A client list (for example the CIC "not contacted" list) for the dashboard's Follow-ups tool.
function holdList(next) {
  list = next;
  chrome.storage.session.set({ list });
  paintPage();
}
async function copyList() {
  if (!page.ready || page.isDashboard) return toast('Open the page with the list first.');
  try {
    await inject();
    const res = await send('table');
    if (!res.ok) return toast(res.error);
    const kind = listKind(res.text);
    holdList({ rows: res.rows, text: kind === 'sessions' ? sessionRows(res.text) : res.text, kind });
    toast(`Copied a ${kind === 'sessions' ? 'session log' : 'list'} of ${res.rows} rows. Open your Advisor Toolbox next.`);
  } catch {
    toast("Couldn't read this page. Reload it and try again.");
  }
}
async function listToTool() {
  if (!list) return;
  try {
    // Opens the dashboard's own tool with the list in its box: "Monthly activity report" for a session log,
    // "Who's due for follow-up" for a client list. The advisor presses Run.
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: page.tabId },
      world: 'MAIN',
      args: [list.text, list.kind === 'sessions' ? 'activity' : 'tracker'],
      func: (text, tool) => {
        if (!window.__tb || typeof window.__tb.openModal !== 'function') return false;
        window.__tb.openModal(tool, 'run');
        const box = document.getElementById(`f-${tool}-list`);
        if (!box) return false;
        box.value = text;
        box.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      },
    });
    if (!result) throw new Error('no box');
    toast('The list is in the box. Check it, then press Run.');
  } catch {
    toast("Couldn't open that tool on this page.");
  }
}

// ---------- Pull: read a page for the Toolbox ----------
// Only on a click. Reads the open page, or opens one public record page and reads that. Held in memory like the
// details, then put into the Toolbox's Outputs (or copied) by the advisor.
let pulled = null; // { title, text }
function holdPull(next) {
  pulled = next;
  chrome.storage.session.set({ pulled });
  paintPage();
}

function openPull() {
  if (busy()) return;
  const here = page.ready && !page.isDashboard;
  const choice = (title, sub, go) => h('button', { class: 'choice', type: 'button', onclick: go }, h('b', { text: title }), h('span', { text: sub }));
  $('pullAsk').hidden = true;
  $('pullList').replaceChildren(
    ...(here ? [choice('This page', short(page.title || new URL(page.origin).hostname, 70), pullThisPage)] : []),
    ...PULL_SOURCES.map((s) => choice(s.name, s.sub, () => (s.needsName ? askPullName(s) : pullSource(s, ''))))
  );
  $('pullBox').hidden = false;
  $('pullBox').scrollIntoView({ block: 'nearest' });
}

let pullAsking = null;
function askPullName(source) {
  pullAsking = source;
  $('pullAskQ').textContent = `${source.name}: name to search`;
  $('pullAsk').hidden = false;
  $('pullName').focus();
}

const pullCounts = (res) => `${res.links.length} documents, ${res.tables.length} lists${res.left ? `, ${res.left} protected ${res.left === 1 ? 'item' : 'items'} left out` : ''}`;

async function pullThisPage() {
  if (busy()) return;
  $('pullBox').hidden = true;
  try {
    await inject();
    const res = await send('pull');
    if (!res.ok) return toast(res.error);
    holdPull({ title: res.title || page.title, text: pageToText(res) });
    showResult(`Pulled this page: ${pullCounts(res)}. Open your Advisor Toolbox to keep it, or copy it.`);
  } catch {
    toast("Couldn't read this page. Reload it and try again.");
  }
}

// Opens the record page in a tab the advisor can see, waits for it to finish loading, then reads it there.
async function pullSource(source, name) {
  if (busy()) return;
  const origin = new URL(source.url).origin;
  pulling = true;
  try {
    let tab;
    try {
      // permissions.request must be the first await: Chrome only allows it straight from a click.
      if (!(await turnOn(origin))) return toast('Chrome did not turn that site on.');
      // Listed under "Sites it can work on", so the advisor can turn it off again there.
      await addSite(source.name, origin);
      tab = await chrome.tabs.create({ url: source.url });
    } catch {
      return toast("Couldn't open that page.");
    }
    $('pullBox').hidden = true;
    paintSites();
    paintPage();
    toast(`Opening ${source.name}…`);
    let loaded = false;
    for (let i = 0; i < 80 && !loaded; i++) {
      await sleep(500);
      const t = await chrome.tabs.get(tab.id).catch(() => null);
      if (!t) return showResult('The page was closed before it could be pulled.', true);
      loaded = t.status === 'complete' && !/just a moment|attention required/i.test(t.title || '');
    }
    if (!loaded) return showResult(`${source.name} did not finish loading. If it shows a check, finish it there, then ${source.api ? 'pull it again' : 'pull “This page”'}.`, true);
    // The tab must still be on the site that was asked for: nothing is read from, or sent to, anywhere else.
    const now = await chrome.tabs.get(tab.id).catch(() => null);
    let nowOrigin = '';
    try { nowOrigin = new URL(now?.url || '').origin; } catch {}
    if (nowOrigin !== origin) return showResult(`${source.name} moved to another site, so nothing was pulled.`, true);
    try {
      if (source.api) {
        const [{ result } = {}] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          args: [source.api + encodeURIComponent(name)],
          func: async (path) => {
            try {
              // No Accept header: Spotlight's Cloudflare rule answers 403 to fetches that ask for JSON.
              const r = await fetch(path);
              return { status: r.status, body: (await r.text()).slice(0, 3000000) };
            } catch {
              return { status: 0, body: '' };
            }
          },
        });
        let rows = null;
        try { rows = jsonToRows(JSON.parse(result.body)); } catch {}
        if (!rows) return showResult(`${source.name} did not answer with data (code ${result?.status ?? 0}). Try again in a minute.`, true);
        if (!rows.rows) return showResult(`${source.name} has no candidates or committees matching “${short(name, 40)}”.`, true);
        holdPull({ title: `${source.name}: ${name}`, text: rowsToText(source, name, rows) });
        showResult(`Pulled ${rows.rows} rows from ${source.name}. Open your Advisor Toolbox to keep them, or copy them.`);
      } else {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/agent.js'] });
        const res = await send('pull', {}, tab.id);
        if (!res.ok) return showResult(res.error, true);
        holdPull({ title: source.name, text: pageToText(res) });
        showResult(`Pulled ${source.name}: ${pullCounts(res)}. Open your Advisor Toolbox to keep it, or copy it.`);
      }
    } catch {
      showResult(`The helper could not read ${source.name}. Reload that page, then pull “This page”.`, true);
    }
  } finally {
    pulling = false;
    paintPage();
  }
}

async function putPull() {
  if (!pulled) return;
  try {
    const [{ result } = {}] = await chrome.scripting.executeScript({
      target: { tabId: page.tabId },
      world: 'MAIN',
      args: [pulled],
      func: (p) => !!(window.__tb && typeof window.__tb.addPull === 'function' && window.__tb.addPull(p)),
    });
    if (!result) throw new Error('no hook');
    holdPull(null);
    showResult('The pull is in your Outputs, kept in this browser for 30 days like your other results. Nothing was sent anywhere else.');
  } catch {
    showResult('The Toolbox could not keep this pull. Use Copy, then paste it where you need it.', true);
  }
}

async function copyPull() {
  if (!pulled) return;
  try {
    await navigator.clipboard.writeText(pulled.text);
    toast('Copied the pull.');
  } catch {
    toast("Couldn't copy it.");
  }
}

// ---------- Client details (the block) ----------
let saveTimer;
// Session storage is memory only: the details may name a client, so they are gone when Chrome closes.
const storeBlock = () => chrome.storage.session.set({ block: $('block').value.slice(0, MAX_BLOCK) });
function saveBlock(now) {
  const { items } = parseBlock($('block').value);
  badge('blockStat', items.length ? `${items.length} ready` : 'None yet', items.length ? 'green-lt' : 'secondary-lt');
  clearTimeout(saveTimer);
  if (now) storeBlock();
  else saveTimer = setTimeout(storeBlock, 250);
  paintPage();
}

function dropPlan() {
  plan = null;
  $('stepsCard').hidden = true;
}

// ---------- What the helper learned from pointing ----------
// Only labels are kept ("the box called Company gets the Business Name line"), never a client's answers.
const learnedKey = () => page.origin;
async function learnedHere() {
  const { learned = {} } = await chrome.storage.local.get('learned');
  return learned[learnedKey()] || {};
}
async function learn(fieldLabel, itemLabel) {
  const { learned = {} } = await chrome.storage.local.get('learned');
  (learned[learnedKey()] ||= {})[normalizeLabel(fieldLabel)] = itemLabel;
  await chrome.storage.local.set({ learned });
  paintForget();
}
async function paintForget() {
  $('forgetBtn').hidden = !page.ready || !Object.keys(await learnedHere()).length;
}
async function forget() {
  const { learned = {} } = await chrome.storage.local.get('learned');
  delete learned[learnedKey()];
  await chrome.storage.local.set({ learned });
  paintForget();
  toast('Forgotten for this site.');
}

// Reads the page and pairs the details with its boxes, using anything learned on this site first.
async function makePlan() {
  const { items } = parseBlock($('block').value);
  if (!items.length) {
    toast('Nothing to write yet.');
    return null;
  }
  const scan = await readPage(true);
  if (!scan) return null;
  const known = await learnedHere();
  const fields = scan.fields.map((f) => ({ ...f, learned: known[normalizeLabel(f.label)] }));
  return { items, fields, ...planFill(items, fields) };
}

async function matchToPage() {
  if (busy()) return;
  if (!page.ready) return toast('Open a page the helper works on first.');
  const made = await makePlan();
  if (!made) return;
  plan = made;
  for (const s of plan.steps) {
    s.same = s.action !== 'check' && s.fieldHas && s.fieldHas === short(oneLine(s.value), 80);
    if (s.same) s.on = false;
  }
  Object.assign(run, { i: 0, why: '' });
  $('result').hidden = true;
  paintSteps();
  $('stepsCard').hidden = false;
  $('stepsCard').scrollIntoView({ block: 'start', behavior: 'smooth' });
}

// ---------- Steps ----------
const VERB = { type: 'Write in', choose: 'Choose in', check: 'Tick' };

function stepRow(s, i) {
  const lead = s.state
    ? h('span', { class: 'mark ' + s.state }, icon(s.state === 'ok' ? 'check' : 'x'))
    : h('input', { type: 'checkbox', checked: s.on, disabled: run.active, 'aria-label': `Include: ${s.fieldLabel}`, onchange: (e) => { s.on = e.target.checked; paintCounts(); } });
  const notes = [];
  if (s.state === 'bad') notes.push(h('div', { class: 'note bad', text: s.msg }));
  else if (s.state === 'ok' && s.msg) notes.push(h('div', { class: 'note', text: s.msg }));
  else if (!s.state) {
    // Say something only when the advisor needs to look: a sure match needs no label.
    const n = h('div', { class: 'note' });
    if (s.score < AUTO_ON) n.append(h('span', { class: 'badge bg-yellow-lt', text: `Not sure: from “${short(s.label, 28)}”. Tick to include` }));
    if (s.same) n.append(h('span', { text: 'Already there' }));
    else if (s.fieldHas) n.append(h('span', { text: `Replaces “${short(s.fieldHas, 40)}”` }));
    if (n.childNodes.length) notes.push(n);
  }
  return h('li', { class: i === run.i && run.active ? 'now' : '', 'data-i': i },
    lead,
    h('div', { class: 'what' }, h('span', { class: 'verb', text: VERB[s.action] + ' ' }), s.fieldLabel),
    s.action === 'check' ? null : h('div', { class: 'val', text: String(s.value) }),
    ...notes
  );
}

function paintCounts() {
  const steps = plan.steps;
  const todo = steps.filter((s) => s.on && !s.state).length;
  const done = steps.filter((s) => s.state).length;
  badge('stepsStat', done ? `${done} of ${done + todo} done` : `${todo} to write`, todo || !done ? 'secondary-lt' : 'green-lt');
  $('bar').style.width = done + todo ? Math.round((done / (done + todo)) * 100) + '%' : '0%';
  $('bar').classList.toggle('done', !!done && !todo);
  $('runBtn').disabled = $('stepBtn').disabled = !todo;
}

function paintSteps() {
  const { steps, unmatched } = plan;
  $('steps').replaceChildren(...steps.map(stepRow));
  $('stepsSub').textContent = steps.length
    ? 'Untick anything you don’t want, then press Start. Each box lights up before it is written.'
    : 'None of the details match a box on this page. Try “Point and fill”.';
  $('unmatched').hidden = !unmatched.length;
  $('unmatchedSum').textContent = `${unmatched.length} ${unmatched.length === 1 ? 'detail has' : 'details have'} no box here`;
  $('unmatchedList').replaceChildren(
    ...unmatched.map((u) => h('li', {}, h('div', { class: 'grow' }, h('div', { class: 'name', text: u.label }), h('div', { class: 'meta', text: u.kind === 'check' ? 'Tick box' : short(u.value, 70) }))))
  );
  paintCounts();
  paintRunButtons();
}

function paintRunButtons() {
  $('runBtn').hidden = run.active && !run.paused;
  $('stepBtn').hidden = run.active && !run.paused;
  $('pauseBtn').hidden = !run.active || run.paused;
  $('stopBtn').hidden = !run.active;
  $('runBtn').lastChild.textContent = run.paused ? 'Carry on' : 'Start';
  $('clearBtn').disabled = busy();
  if (run.active) badge('topStat', run.paused ? 'Paused' : 'Writing', run.paused ? 'yellow-lt' : 'dark');
  paintPage();
}

async function waitInterruptible(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end && !run.stop) await sleep(60);
}
async function whilePaused() {
  if (run.paused) {
    paintRunButtons();
    await send('banner', { text: 'Advisor Helper is paused', state: 'paused' }, run.tabId).catch(() => {});
  }
  while (run.paused && !run.stop) await sleep(120);
  paintRunButtons();
}

async function drive(single) {
  if (!plan || pick.active) return;
  if (run.active) {
    run.single = single;
    run.paused = false;
    return;
  }
  const steps = plan.steps;
  if (!steps.some((s) => s.on && !s.state)) return toast('Nothing left to write.');

  Object.assign(run, { active: true, paused: false, stop: false, single, why: '', tabId: page.tabId });
  $('result').hidden = true;
  const speed = Number($('speed').value) || 800;
  const total = steps.filter((s) => s.on).length;
  let n = steps.filter((s) => s.state).length;

  try {
    await inject();
    run.port = chrome.tabs.connect(run.tabId, { name: 'sbdc-run' });
    run.port.onDisconnect.addListener(() => { if (run.active) stop('The page changed, so the helper stopped.'); });
    paintSteps();

    for (run.i = 0; run.i < steps.length; run.i++) {
      const s = steps[run.i];
      if (!s.on || s.state) continue;
      await whilePaused();
      if (run.stop) break;

      paintSteps();
      document.querySelector(`#steps li[data-i="${run.i}"]`)?.scrollIntoView({ block: 'nearest' });
      await send('banner', { text: `Advisor Helper · ${n + 1} of ${total} · ${short(s.fieldLabel, 40)}` }, run.tabId);
      const shown = await send('show', { id: s.fieldId, text: s.action === 'check' ? 'Tick' : short(oneLine(s.value), 44) }, run.tabId);
      if (!shown.ok) { stop(shown.error); break; }

      await waitInterruptible(speed);
      await whilePaused();
      if (run.stop) break;

      const res = await send('fill', { id: s.fieldId, value: s.value }, run.tabId);
      s.state = res.ok ? 'ok' : 'bad';
      s.msg = res.ok ? res.note : res.error;
      n++;
      if (run.single) { run.single = false; run.paused = steps.slice(run.i + 1).some((x) => x.on && !x.state); }
      paintSteps();
      await waitInterruptible(Math.min(400, speed / 2));
    }
  } catch {
    if (!run.why) run.why = 'The page changed or closed, so the helper stopped.';
    run.stop = true;
  }
  await finish();
}

function stop(why) {
  if (!run.active) return;
  run.why = run.why || why || '';
  run.stop = true;
}

function releasePage(tabId, port) {
  setTimeout(() => {
    try { port?.disconnect(); } catch {}
    send('clear', {}, tabId).catch(() => {});
  }, 5000);
}

async function finish() {
  const steps = plan.steps;
  const ok = steps.filter((s) => s.state === 'ok').length;
  const bad = steps.filter((s) => s.state === 'bad').length;
  const left = steps.filter((s) => s.on && !s.state).length;
  const stopped = run.stop;
  const { tabId, port } = run;
  Object.assign(run, { active: false, paused: false, single: false, port: null, i: -1 });

  const summary = `${ok} written${bad ? `, ${bad} could not be written` : ''}${left ? `, ${left} not done` : ''}.`;
  showResult(
    stopped
      ? `Stopped. ${run.why ? run.why + ' ' : ''}${summary} Nothing was saved.`
      : `Done. ${summary} Nothing was saved: check the page, then save it yourself.`,
    stopped || bad
  );
  badge('topStat', stopped ? 'Stopped' : 'Done', stopped ? 'red-lt' : 'green-lt');
  paintSteps();

  await send('banner', { text: stopped ? 'Advisor Helper stopped. Nothing was saved.' : 'Advisor Helper is done. Nothing was saved: check it, then save it yourself.', state: stopped ? 'stopped' : 'done' }, tabId).catch(() => {});
  releasePage(tabId, port);
}

// ---------- Point and fill ----------
// The advisor clicks a box on the page. If the helper knows what goes there it writes it at once.
// If not, it asks once, writes it, and remembers the answer for this site.
const pickLeft = () => pick.items.filter((it, i) => !pick.used.has(i) && !(it.kind === 'check' && !it.value));

function pickHints() {
  const hints = {};
  for (const s of pick.plan.steps) {
    if (!pick.used.has(pick.items.indexOf(s.item))) hints[s.fieldId] = s.action === 'check' ? 'tick' : short(oneLine(s.value), 40);
  }
  return hints;
}

async function startPick() {
  if (busy()) return;
  const made = await makePlan();
  if (!made) return;
  dropPlan();
  // Keep the item behind each step so a detail is only written once.
  made.steps.forEach((s) => { s.item = made.items.find((it) => it.label === s.label && (it.kind === 'check') === (s.action === 'check')); });
  Object.assign(pick, { active: true, tabId: page.tabId, plan: made, items: made.items, used: new Set(), asking: null, log: [] });
  try {
    pick.port = chrome.tabs.connect(pick.tabId, { name: 'sbdc-run' });
    pick.port.onDisconnect.addListener(() => { if (pick.active) endPick('The page changed, so pointing ended.'); });
    await send('pickStart', { hints: pickHints() }, pick.tabId);
  } catch {
    pick.active = false;
    return toast("Couldn't start on this page. Reload it and try again.");
  }
  $('result').hidden = true;
  $('pickCard').hidden = false;
  badge('topStat', 'Pointing', 'dark');
  paintPick();
  paintRunButtons();
}

function paintPick() {
  $('chooser').hidden = !pick.asking;
  if (pick.asking) {
    $('chooserQ').textContent = `What goes in “${pick.asking.label || 'this box'}”?`;
    const left = pickLeft().filter((it) => (it.kind === 'check') === (pick.asking.type === 'checkbox'));
    $('choices').replaceChildren(
      ...(left.length
        ? left.map((it) => h('button', { class: 'choice', type: 'button', onclick: () => choose(it) }, h('b', { text: it.label }), it.kind === 'check' ? null : h('span', { text: short(oneLine(it.value), 90) })))
        : [h('div', { class: 'sub', text: 'No details left for this kind of box.' })])
    );
  }
  $('picked').replaceChildren(
    ...pick.log.map((l) =>
      h('li', {},
        h('span', { class: 'mark ' + (l.ok ? 'ok' : 'bad') }, icon(l.ok ? 'check' : 'x')),
        h('div', { class: 'grow' }, h('div', { class: 'name', text: l.field }), h('div', { class: 'meta', text: l.text }))
      )
    )
  );
}

async function writePicked(field, item, remember) {
  const res = await send('fill', { id: field.id, value: item.kind === 'check' ? true : item.value }, pick.tabId).catch(() => ({ ok: false, error: 'The page changed. Start pointing again.' }));
  if (res.ok) {
    pick.used.add(pick.items.indexOf(item));
    if (remember) await learn(field.label, item.label);
  }
  pick.log.unshift({ ok: res.ok, field: field.label || 'Box', text: res.ok ? res.note || `Wrote: ${res.after}` : res.error });
  pick.asking = null;
  paintPick();
  await send('pickStart', { hints: pickHints() }, pick.tabId).catch(() => {});
}

async function onPagePick(fieldId) {
  if (!pick.active || pick.busy) return;
  const field = pick.plan.fields.find((f) => f.id === fieldId);
  if (!field) return;
  pick.busy = true;
  try {
    const step = pick.plan.steps.find((s) => s.fieldId === fieldId && !pick.used.has(pick.items.indexOf(s.item)));
    if (step) await writePicked(field, step.item, false);
    else {
      pick.asking = field;
      paintPick();
      $('chooser').scrollIntoView({ block: 'nearest' });
    }
  } finally {
    pick.busy = false;
  }
}

const choose = (item) => pick.asking && writePicked(pick.asking, item, true);

async function endPick(why) {
  if (!pick.active) return;
  const { tabId, port } = pick;
  const wrote = pick.log.filter((l) => l.ok).length;
  Object.assign(pick, { active: false, asking: null, port: null });
  $('pickCard').hidden = true;
  showResult(`${why ? why + ' ' : ''}${wrote} ${wrote === 1 ? 'box' : 'boxes'} written. Nothing was saved: check the page, then save it yourself.`, !!why);
  badge('topStat', 'Done', 'green-lt');
  paintRunButtons();
  await send('pickStop', {}, tabId).catch(() => {});
  await send('banner', { text: 'Advisor Helper is done. Nothing was saved: check it, then save it yourself.', state: 'done' }, tabId).catch(() => {});
  releasePage(tabId, port);
}

// ---------- Related pages ----------
function paintLinks() {
  const box = $('links');
  box.replaceChildren();
  let group = '';
  for (const l of getLinks()) {
    if (l.group !== group) {
      group = l.group;
      box.append(h('div', { class: 'grouphead lbl', 'data-space': group === 'Reference' ? 'intake' : 'toolbox' }, h('span', { class: 'space-mark', 'aria-hidden': 'true' }), group));
    }
    box.append(h('a', { class: 'rowlink', href: l.url, target: '_blank', rel: 'noopener noreferrer' }, h('span', { class: 'ri' }, icon(l.icon)), l.name));
  }
}

// ---------- Sites ----------
async function paintSites() {
  const sites = await listSites();
  const every = await hasEvery();
  $('sites').replaceChildren(
    h('li', {},
      h('div', { class: 'grow' }, h('div', { class: 'name', text: 'Every page I open' }), h('div', { class: 'meta', text: 'Any https page. It still only acts when you click.' })),
      every ? h('span', { class: 'badge bg-green-lt', text: 'On' }) : null,
      h('button', {
        class: 'btn btn-sm ' + (every ? 'btn-ghost' : 'btn-outline'), type: 'button', text: every ? 'Turn off' : 'Turn on',
        onclick: async () => { every ? await turnOffEvery() : await turnOnEvery().catch(() => false); paintSites(); refreshPage(); },
      })
    ),
    ...sites.map((s) => {
      const host = new URL(s.origin).hostname;
      const controls = [];
      if (s.always) controls.push(h('span', { class: 'badge bg-green-lt', text: 'On' }));
      else {
        controls.push(
          h('button', {
            class: 'btn btn-sm ' + (s.on ? 'btn-ghost' : 'btn-outline'), type: 'button', text: s.on ? 'Turn off' : 'Turn on',
            onclick: async () => { s.on ? await turnOff(s.origin) : await turnOn(s.origin); paintSites(); refreshPage(); },
          })
        );
        if (s.added) controls.push(h('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': `Remove ${s.name}`, title: 'Remove', onclick: async () => { await removeSite(s.origin); paintSites(); refreshPage(); } }, icon('trash')));
      }
      return h('li', {},
        h('div', { class: 'grow' }, h('div', { class: 'name', text: s.name }), h('div', { class: 'meta', text: s.note ? `${host} · ${s.note}` : host })),
        s.on && !s.always ? h('span', { class: 'badge bg-green-lt', text: 'On' }) : null,
        ...controls
      );
    })
  );
}

async function onAddSite(e) {
  e.preventDefault();
  $('siteErr').hidden = true;
  let origin;
  try {
    origin = parseSiteAddress($('siteUrl').value);
    // permissions.request must be the first await: Chrome only allows it straight from a click.
    if (!(await turnOn(origin))) throw new Error('Chrome did not turn that site on.');
  } catch (err) {
    $('siteErr').textContent = err.message;
    $('siteErr').hidden = false;
    return;
  }
  await addSite('CenterIC', origin);
  $('siteUrl').value = '';
  paintSites();
  refreshPage();
}

// ---------- Wiring ----------
renderIcons();
paintLinks();
paintSites();
chrome.storage.local.get('remote').then(({ remote }) => { if (remote) { applySettings(remote); paintLinks(); paintSites(); } });

$('readBtn').addEventListener('click', () => readPage());
$('grabBtn').addEventListener('click', grabCicBlock);
$('toolboxBtn').addEventListener('click', openToolbox);
$('everyBtn').addEventListener('click', useEverywhere);
$('qToolbox').addEventListener('click', openToolbox);
$('qMore').addEventListener('click', () => { $('more').open = !$('more').open; });
$('more').addEventListener('toggle', () => {
  $('qMore').setAttribute('aria-expanded', $('more').open);
  if ($('more').open) $('more').scrollIntoView({ block: 'start', behavior: 'smooth' });
});
$('openIntakeBtn').addEventListener('click', openIntake);
$('fillDashBtn').addEventListener('click', () => { if (!hasBlock()) { $('blockBox').open = true; return toast('Get or paste the details first.'); } matchToPage(); });
$('forgetBtn').addEventListener('click', forget);
$('notesBtn').addEventListener('click', pickNotes);
$('outsClose').addEventListener('click', () => { $('outs').hidden = true; });
$('copyDetailsBtn').addEventListener('click', copyPageDetails);
$('copyListBtn').addEventListener('click', copyList);
$('listBtn').addEventListener('click', listToTool);
$('mailBtn').addEventListener('click', pickMail);
$('llcBtn').addEventListener('click', checkName);
$('mailApp').addEventListener('change', () => chrome.storage.local.set({ mailApp: $('mailApp').value }));
// A tool run on the dashboard does not reload the page, so look again when the advisor comes back to the panel.
document.documentElement.addEventListener('mouseenter', () => { if (!busy()) refreshPage(); });
$('listClear').addEventListener('click', () => holdList(null));
$('pullBtn').addEventListener('click', openPull);
$('pullClose').addEventListener('click', () => { $('pullBox').hidden = true; });
$('pullAsk').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = oneLine($('pullName').value).slice(0, 80);
  if (name.length < 2) return toast('Type at least 2 letters.');
  if (pullAsking) pullSource(pullAsking, name);
});
$('pullPutBtn').addEventListener('click', putPull);
$('pullCopy').addEventListener('click', copyPull);
$('pullClear').addEventListener('click', () => holdPull(null));
$('block').addEventListener('input', () => { saveBlock(); if (!busy()) dropPlan(); });
$('block').addEventListener('change', () => saveBlock(true));
// For CenterIC the sure boxes are filled in one click; "Check each box first" shows the list before anything is written.
$('planBtn').addEventListener('click', async () => {
  const post = postsToCic();
  await matchToPage();
  if (post && plan && plan.steps.some((s) => s.on)) drive(false);
});
$('checkBtn').addEventListener('click', matchToPage);
$('pickBtn').addEventListener('click', startPick);
$('pickDone').addEventListener('click', () => endPick());
$('chooserSkip').addEventListener('click', () => { pick.asking = null; paintPick(); });
$('clearBtn').addEventListener('click', () => { $('block').value = ''; saveBlock(true); dropPlan(); });
$('runBtn').addEventListener('click', () => drive(false));
$('stepBtn').addEventListener('click', () => drive(true));
$('pauseBtn').addEventListener('click', () => { run.paused = true; paintRunButtons(); });
$('stopBtn').addEventListener('click', () => stop('You stopped it.'));
$('speed').addEventListener('change', () => chrome.storage.local.set({ speed: $('speed').value }));
$('addSite').addEventListener('submit', onAddSite);

chrome.storage.session.get('block').then(({ block = '' }) => { $('block').value = block; saveBlock(true); });
chrome.storage.session.get('pulled').then(({ pulled: held }) => { if (held?.text) { pulled = held; paintPage(); } });
chrome.storage.session.get('list').then(({ list: held }) => { if (held?.text) { list = held; paintPage(); } });
chrome.storage.local.get('mailApp').then(({ mailApp }) => { if (MAIL_APPS[mailApp]) $('mailApp').value = mailApp; });
chrome.storage.local.get('speed').then(({ speed }) => { if (['1500', '800', '300'].includes(speed)) $('speed').value = speed; });

chrome.tabs.onActivated.addListener(() => {
  if (run.active && !pinnedTab && !run.paused) { run.paused = true; toast('Paused: you switched tabs.'); paintRunButtons(); }
  if (pick.active && !pinnedTab) endPick('You switched tabs, so pointing ended.');
  refreshPage();
});
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (run.active && tabId === run.tabId && info.status === 'loading') stop('The page reloaded, so the helper stopped.');
  if (pick.active && tabId === pick.tabId && info.status === 'loading') endPick('The page reloaded, so pointing ended.');
  if (tabId === page.tabId && (info.status === 'complete' || info.url)) { page.scan = null; refreshPage(); }
});
chrome.permissions.onAdded.addListener(() => { paintSites(); refreshPage(); });
chrome.permissions.onRemoved.addListener(() => { paintSites(); refreshPage(); });

// What the page reports back: the Stop / Finish button drawn on it (or Esc), and a clicked box.
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id || !sender.tab) return;
  if (msg?.type === 'page-stop') {
    if (run.active && sender.tab.id === run.tabId) stop('You stopped it.');
    if (pick.active && sender.tab.id === pick.tabId) endPick();
  }
  if (msg?.type === 'page-pick' && pick.active && sender.tab.id === pick.tabId && typeof msg.id === 'string') onPagePick(msg.id);
});

refreshPage();

// ---------- Testing only: pick up a new build by itself ----------
// `npm run dev:sync` copies a new build into the folder Chrome loaded and writes dev-stamp.txt last. While the
// panel is open it re-reads that file and, when it changes, reloads this panel so the new files are used.
// A change to manifest.json or background.js needs Chrome's own reload, so the panel says so instead.
// The packaged zip has no dev-stamp.txt, so an installed copy never does this. Reading a packaged file is
// not a network request.
const packaged = (name) => new Promise((done) => {
  try {
    chrome.runtime.getPackageDirectoryEntry((dir) => dir.getFile(name, {}, (entry) => entry.file((f) => f.text().then(done, () => done(null)), () => done(null)), () => done(null)));
  } catch {
    done(null);
  }
});
Promise.all(['dev-stamp.txt', 'manifest.json', 'background.js'].map(packaged)).then(([stamp, manifest, background]) => {
  if (!stamp) return;
  setInterval(async () => {
    const now = await packaged('dev-stamp.txt');
    if (!now || now === stamp || busy()) return;
    stamp = now;
    const core = (await packaged('manifest.json')) !== manifest || (await packaged('background.js')) !== background;
    if (core) showResult('New test build. This one changed the extension itself: click the reload arrow on chrome://extensions.', true);
    else location.reload();
  }, 3000);
});
