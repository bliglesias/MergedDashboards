// Page agent. Injected on demand into the one tab the advisor is working in (chrome.scripting.executeScript),
// in the extension's isolated world. It reads the form fields, shows which field is next, and fills one field
// per message. It never clicks a save or submit control, never presses Enter and never calls form.submit().
(() => {
  if (globalThis.__sbdcHelperAgent) return;
  globalThis.__sbdcHelperAgent = true;

  const MAX_FIELDS = 400;
  const SENSITIVE =
    /pass(word|code|phrase)|\bpin\b|\bssn\b|social.?sec|card.?(num|no)\b|\bcvv\b|\bcvc\b|security.?code|routing|(bank|acc(oun)?t).?(num|no)\b|tax.?id|\bein\b|\bitin\b|date.?of.?birth|\bdob\b|driver.?s?.?lic/i;
  const RISKY_CLICK =
    /\b(save|submit|send|delete|remove|pay|purchase|buy|order|sign|confirm|approve|post|publish|update|register|enroll|log ?(in|out)|apply|finish|complete|upload|share|invite)\b/i;

  const fields = new Map();
  let elToId = new WeakMap();
  let nextId = 1;

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const short = (s, n = 80) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
  const tidyLabel = (s) => short(clean(s).replace(/[\s:*]+$/, ''), 90);
  const humanize = (s) => clean(String(s || '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.[\]]+/g, ' '));

  function textWithoutControls(node) {
    const copy = node.cloneNode(true);
    copy.querySelectorAll('input,select,textarea,button,script,style').forEach((n) => n.remove());
    return clean(copy.textContent);
  }

  function ownLabel(el) {
    const aria = clean(el.getAttribute('aria-label'));
    if (aria) return aria;
    const ids = el.getAttribute('aria-labelledby');
    if (ids) {
      const t = clean(ids.split(/\s+/).map((id) => document.getElementById(id)?.textContent || '').join(' '));
      if (t) return t;
    }
    if (el.labels && el.labels.length) {
      const t = textWithoutControls(el.labels[0]);
      if (t) return t;
    }
    return '';
  }

  // Older record systems lay forms out as tables or as "text, then box". Look to the left and just above.
  function nearbyLabel(el) {
    const cell = el.closest('td,th');
    if (cell) {
      const before = textWithoutControls(cell);
      if (before && before.length <= 90) return before;
      const prev = cell.previousElementSibling;
      if (prev) {
        const t = textWithoutControls(prev);
        if (t && t.length <= 90) return t;
      }
    }
    let node = el;
    for (let up = 0; up < 3 && node && node !== document.body; up++, node = node.parentElement) {
      const prev = node.previousElementSibling;
      if (prev && !prev.querySelector('input,select,textarea')) {
        const t = clean(prev.textContent);
        if (t && t.length <= 90) return t;
      }
    }
    return '';
  }

  const labelOf = (el) =>
    tidyLabel(ownLabel(el) || nearbyLabel(el) || el.getAttribute('placeholder') || el.title || humanize(el.name || el.id));

  function groupLabel(radios) {
    const first = radios[0];
    const set = first.closest('fieldset');
    const legend = set && set.querySelector('legend');
    if (legend && clean(legend.textContent)) return tidyLabel(legend.textContent);
    const group = first.closest('[role="radiogroup"],[role="group"]');
    if (group && clean(group.getAttribute('aria-label'))) return tidyLabel(group.getAttribute('aria-label'));
    let box = first.parentElement;
    while (box && box !== document.body && !radios.every((r) => box.contains(r))) box = box.parentElement;
    return tidyLabel((box && nearbyLabel(box)) || humanize(first.name));
  }

  const closedDetails = (el) => {
    const d = el.closest('details:not([open])');
    return d && !el.closest('summary') ? d : null;
  };
  const visible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const reachable = (el) => visible(el) || (closedDetails(el) && !el.closest('[hidden]'));

  function blockedWhy(el, label) {
    const type = (el.type || '').toLowerCase();
    if (type === 'password') return 'password';
    if (type === 'file') return 'file upload';
    const ac = (el.getAttribute('autocomplete') || '').toLowerCase();
    if (/^cc-|password|one-time-code/.test(ac)) return 'payment or sign-in';
    if (SENSITIVE.test(`${label} ${el.name || ''} ${el.id || ''}`)) return 'sensitive';
    if (el.readOnly) return 'read-only';
    return '';
  }

  function scan() {
    fields.clear();
    elToId = new WeakMap();
    nextId = 1;
    const out = [];
    const radioGroups = new Map();
    const add = (entry, info) => {
      const id = 'f' + nextId++;
      fields.set(id, entry);
      (entry.radios || [entry.el]).forEach((e) => elToId.set(e, id));
      out.push({ id, ...info });
    };

    for (const el of document.querySelectorAll('input,select,textarea')) {
      if (out.length >= MAX_FIELDS) break;
      const type = (el.type || el.tagName).toLowerCase();
      if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
      if (el.disabled || !reachable(el)) continue;

      if (type === 'radio') {
        const key = (el.form ? [...document.forms].indexOf(el.form) : 'x') + '|' + el.name;
        if (!radioGroups.has(key)) radioGroups.set(key, []);
        radioGroups.get(key).push(el);
        continue;
      }

      const label = labelOf(el);
      const blocked = blockedWhy(el, label);
      if (type === 'checkbox') {
        add({ el }, { label, type: 'checkbox', checked: blocked ? undefined : el.checked, blocked });
      } else if (el.tagName === 'SELECT') {
        const options = [...el.options].slice(0, 60).map((o) => clean(o.textContent));
        const value = blocked || el.selectedIndex < 0 ? '' : clean(el.options[el.selectedIndex].textContent);
        add({ el }, { label, type: 'select', options, value: el.value ? short(value) : '', blocked });
      } else {
        add(
          { el },
          {
            label,
            type: el.tagName === 'TEXTAREA' ? 'textarea' : 'text',
            inputType: type,
            value: blocked ? '' : short(clean(el.value)),
            blocked,
          }
        );
      }
    }

    for (const radios of radioGroups.values()) {
      if (out.length >= MAX_FIELDS) break;
      const label = groupLabel(radios);
      const options = radios.map((r) => tidyLabel(ownLabel(r) || r.value));
      const picked = radios.findIndex((r) => r.checked);
      const blocked = SENSITIVE.test(label) ? 'sensitive' : '';
      add({ radios }, { label, type: 'radio', options, value: blocked || picked < 0 ? '' : options[picked], blocked });
    }

    return {
      ok: true,
      title: short(clean(document.title), 120),
      isDashboard: !!document.getElementById('copyCIC') && /Advisor Toolbox/.test(document.title),
      headings: [...document.querySelectorAll('h1,h2,h3')]
        .filter(visible)
        .slice(0, 8)
        .map((n) => short(clean(n.textContent), 70))
        .filter(Boolean),
      fields: out,
    };
  }

  // The filled-in boxes on this page as "Label: value" lines, so they can be written somewhere else.
  // Protected boxes are left out. Needs a scan first.
  function values() {
    const lines = [];
    for (const f of fields.values()) {
      if (f.radios) {
        const on = f.radios.find((r) => r.checked);
        const label = groupLabel(f.radios);
        if (on && label && !SENSITIVE.test(label)) lines.push(`${label}: ${tidyLabel(ownLabel(on) || on.value)}`);
        continue;
      }
      const el = f.el;
      if (!document.contains(el)) continue;
      const label = labelOf(el);
      const why = blockedWhy(el, label);
      if (!label || (why && why !== 'read-only')) continue;
      if (el.type === 'checkbox') {
        if (el.checked) lines.push(`[x] ${label}`);
      } else if (el.tagName === 'SELECT') {
        if (el.value && el.selectedIndex >= 0) lines.push(`${label}: ${clean(el.options[el.selectedIndex].textContent)}`);
      } else if (clean(el.value)) lines.push(`${label}: ${clean(el.value).slice(0, 2000)}`);
    }
    return { ok: true, count: lines.length, text: lines.join(String.fromCharCode(10)) };
  }

  // The biggest plain list (table) on the page, one row per line with tabs between columns.
  function table() {
    let best = null;
    for (const t of document.querySelectorAll('table')) {
      if (!visible(t) || t.querySelector('input,select,textarea')) continue;
      const rows = [...t.rows].filter((r) => r.cells.length >= 2);
      if (rows.length >= 2 && (!best || rows.length > best.length)) best = rows;
    }
    if (!best) return { ok: false, error: 'No list found on this page' };
    const text = best.slice(0, 1000).map((r) => [...r.cells].map((c) => clean(c.textContent)).join(String.fromCharCode(9))).join(String.fromCharCode(10));
    return { ok: true, rows: Math.min(best.length, 1000), text };
  }

  // "Pull": what the page shows, for the Toolbox. Words, plain lists and links to documents. Nothing typed into
  // a box is read, a line or column named like an ID number is left out, and anything shaped like one is cut.
  const DOC_LINK = /\.(pdf|csv|xlsx?|docx?|zip|json|txt)(\?|#|$)/i;
  const ID_SHAPED = /\b\d{3}-\d{2}-\d{4}\b|\b\d{2}-\d{7}\b|\b(?:\d[ -]?){12,15}\d\b/g;
  const noIds = (s) => s.replace(ID_SHAPED, '[left out]');

  function pull() {
    const TABC = String.fromCharCode(9);
    const NLC = String.fromCharCode(10);
    let left = 0;

    const tables = [];
    const taken = new Set();
    for (const t of document.querySelectorAll('table')) {
      if (!visible(t) || t.querySelector('input,select,textarea')) continue;
      const rows = [...t.rows].filter((r) => r.cells.length >= 2).slice(0, 500).map((r) => [...r.cells].map((c) => clean(c.innerText)));
      if (rows.length < 2) continue;
      taken.add(t);
      const hidden = rows[0].map((head) => SENSITIVE.test(head));
      const text = rows
        .map((cells, r) => cells.map((cell, i) => {
          const protect = (r > 0 && hidden[i]) || (i > 0 && SENSITIVE.test(cells[0]));
          if (protect && cell) left++;
          return protect ? '' : noIds(cell);
        }).join(TABC))
        .join(NLC);
      tables.push({ rows: rows.length, text });
    }
    tables.sort((x, y) => y.rows - x.rows);

    const seen = new Set();
    const links = [];
    for (const a of document.querySelectorAll('a[href]')) {
      if (links.length >= 1000) break;
      let url;
      try { url = new URL(a.href); } catch { continue; }
      if (!/^https?:$/.test(url.protocol) || !DOC_LINK.test(url.pathname) || seen.has(url.href)) continue;
      seen.add(url.href);
      // Many record pages label every link the same ("Statement"), so a short label gets the file's own name too.
      let file = url.pathname.split('/').pop();
      try { file = decodeURIComponent(file); } catch {}
      const label = clean(a.textContent);
      links.push({ text: noIds(short(label.length >= 25 ? label : clean(`${label} ${file}`), 140)), url: url.href });
    }

    // The words, one line per block of the page. Lists already taken above are not repeated.
    const lines = [];
    let lastBlock = null;
    let size = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n && size < 60000; n = walker.nextNode()) {
      const t = clean(n.nodeValue);
      const p = n.parentElement;
      if (!t || !p || p.closest('textarea,select,option,button,script,style,noscript,template,[data-sbdc-helper]')) continue;
      const inTable = p.closest('table');
      if ((inTable && taken.has(inTable)) || !visible(p)) continue;
      let block = p;
      while (block !== document.body && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
      if (block === lastBlock) lines[lines.length - 1] += ' ' + t;
      else lines.push(t);
      lastBlock = block;
      size += t.length + 1;
    }
    const kept = lines.filter((l) => !SENSITIVE.test(l));
    left += lines.length - kept.length;
    const text = kept.map(noIds).join(NLC);

    if (!text && !links.length && !tables.length) return { ok: false, error: 'Nothing to pull on this page' };
    return { ok: true, title: clean(document.title), url: location.origin + location.pathname, text, tables: tables.slice(0, 5), links, left };
  }

  // ---- What the advisor sees on the page: a ring round the next field and a bar with a Stop button ----
  let ui = null;
  let ringTarget = null;
  let raf = 0;

  function overlay() {
    if (ui) return ui;
    const host = document.createElement('div');
    host.setAttribute('data-sbdc-helper', '');
    host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :host{all:initial}
      *{box-sizing:border-box;font-family:"DM Sans",system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
      .ring{position:fixed;border:2px solid #111;border-radius:12px;box-shadow:0 0 0 4px #B6E04A,0 8px 24px rgba(20,20,10,.18);display:none}
      .tag{position:fixed;max-width:320px;background:#111;color:#fff;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:none}
      .bar{position:fixed;top:12px;left:50%;transform:translateX(-50%);max-width:calc(100vw - 24px);display:none;align-items:center;gap:10px;background:#fff;color:#161616;border:1px solid #E7E5DF;border-radius:999px;padding:6px 6px 6px 14px;font-size:13px;line-height:1.3;box-shadow:0 8px 24px rgba(20,20,10,.14);pointer-events:auto}
      .dot{width:10px;height:10px;flex:0 0 10px;border-radius:50%;background:#B6E04A}
      .bar.done .dot{background:#3F6B28}
      .bar.stopped .dot{background:#9A2E24}
      .msg{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      button{all:unset;cursor:pointer;background:#111;color:#fff;border-radius:999px;padding:6px 14px;font-size:12px;font-weight:600}
      button:focus-visible{outline:2px solid #111;outline-offset:2px}
    `);
    root.adoptedStyleSheets = [sheet];
    const mk = (cls, tag = 'div') => {
      const n = document.createElement(tag);
      n.className = cls;
      root.appendChild(n);
      return n;
    };
    const ring = mk('ring');
    const tag = mk('tag');
    const bar = mk('bar');
    bar.setAttribute('role', 'status');
    const dot = document.createElement('span');
    dot.className = 'dot';
    const msg = document.createElement('span');
    msg.className = 'msg';
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.textContent = 'Stop';
    stop.addEventListener('click', askStop);
    bar.append(dot, msg, stop);
    document.documentElement.appendChild(host);
    ui = { host, ring, tag, bar, msg, stop };
    return ui;
  }

  function askStop() {
    chrome.runtime.sendMessage({ type: 'page-stop' }).catch(() => {});
  }
  const onKey = (e) => {
    if (e.key === 'Escape' && ui && ui.bar.style.display === 'flex' && !ui.stop.hidden) askStop();
  };

  function place() {
    if (!ui || !ringTarget || !document.contains(ringTarget)) return;
    const r = ringTarget.getBoundingClientRect();
    Object.assign(ui.ring.style, {
      display: 'block',
      left: r.left - 5 + 'px',
      top: r.top - 5 + 'px',
      width: r.width + 10 + 'px',
      height: r.height + 10 + 'px',
    });
    const above = r.top > 44;
    Object.assign(ui.tag.style, {
      display: 'block',
      left: Math.max(8, r.left - 5) + 'px',
      top: (above ? r.top - 38 : r.bottom + 10) + 'px',
    });
    raf = requestAnimationFrame(place);
  }

  function show(id, text) {
    const f = fields.get(id);
    const el = f && (f.el || f.radios[0]);
    if (!el || !document.contains(el)) return { ok: false, error: 'The page changed. Read it again.' };
    const d = closedDetails(el);
    if (d) d.open = true;
    const target = boxOf(f);
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
    ringOn(target, text);
    return { ok: true };
  }

  const boxOf = (f) => (f.radios ? f.radios[0].closest('fieldset,[role="radiogroup"],.form-selectgroup') || f.radios[0].parentElement : f.el);

  function ringOn(target, text) {
    const u = overlay();
    cancelAnimationFrame(raf);
    ringTarget = target;
    u.tag.textContent = text || '';
    place();
  }

  function banner(text, state) {
    const u = overlay();
    u.bar.style.display = 'flex';
    u.bar.className = 'bar ' + (state || '');
    u.msg.textContent = text;
    u.stop.textContent = state === 'pick' ? 'Finish' : 'Stop';
    u.stop.hidden = state === 'done' || state === 'stopped';
    u.stop.style.display = u.stop.hidden ? 'none' : '';
    if (state === 'done' || state === 'stopped') hideRing();
    return { ok: true };
  }

  function hideRing() {
    cancelAnimationFrame(raf);
    ringTarget = null;
    if (ui) ui.ring.style.display = ui.tag.style.display = 'none';
  }

  function clear() {
    pickStop();
    hideRing();
    if (ui) ui.host.remove();
    ui = null;
    return { ok: true };
  }

  // ---- Point and fill: the advisor clicks a box, the side panel decides what goes in it ----
  let pick = null;

  function fieldAt(node) {
    if (!(node instanceof Element) || node.closest('[data-sbdc-helper]')) return null;
    let el = node.closest('input,select,textarea');
    if (!el) {
      const label = node.closest('label');
      el = label && label.control;
    }
    const id = el && elToId.get(el);
    if (!id) return null;
    const f = fields.get(id);
    return { id, f, blocked: f.radios ? '' : blockedWhy(el, labelOf(el)) };
  }
  function onPickHover(e) {
    const hit = fieldAt(e.target);
    if (!hit) return hideRing();
    const hint = pick.hints[hit.id];
    ringOn(boxOf(hit.f), hit.blocked ? 'Protected: fill this one yourself' : hint ? `Click to write: ${hint}` : 'Click to choose what goes here');
  }
  // Only clicks on a box the helper may fill are taken over. Everything else on the page works as normal.
  function onPickPress(e) {
    const hit = fieldAt(e.target);
    if (!hit || hit.blocked) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'click') chrome.runtime.sendMessage({ type: 'page-pick', id: hit.id }).catch(() => {});
  }
  function pickStart(hints) {
    const fresh = !pick;
    pick = { hints: hints || {} };
    if (fresh) {
      document.addEventListener('mouseover', onPickHover, true);
      document.addEventListener('mousedown', onPickPress, true);
      document.addEventListener('click', onPickPress, true);
    }
    return banner('Click a box and the helper writes it in', 'pick');
  }
  function pickStop() {
    if (!pick) return { ok: true };
    pick = null;
    document.removeEventListener('mouseover', onPickHover, true);
    document.removeEventListener('mousedown', onPickPress, true);
    document.removeEventListener('click', onPickPress, true);
    hideRing();
    return { ok: true };
  }

  // ---- Filling one field ----
  const norm = (s) => clean(s).toLowerCase();

  function pickOption(labels, want) {
    const w = norm(want);
    let i = labels.findIndex((l) => norm(l) === w);
    if (i < 0) i = labels.findIndex((l) => norm(l).startsWith(w) || w.startsWith(norm(l)));
    if (i < 0) i = labels.findIndex((l) => norm(l).includes(w));
    // "In-person" and "In Person" are the same choice.
    const loose = (s) => norm(s).replace(/[^a-z0-9]+/g, ' ').trim();
    if (i < 0 && loose(want)) i = labels.findIndex((l) => loose(l) === loose(want));
    if (i < 0 && loose(want)) i = labels.findIndex((l) => loose(l).startsWith(loose(want)));
    return i;
  }

  function forInputType(type, value) {
    const v = String(value);
    if (type === 'date') {
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (!m) throw new Error('Not a date this box accepts');
      return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }
    if (type === 'number' || type === 'range') {
      const n = v.replace(/[$,\s]/g, '');
      if (n === '' || isNaN(Number(n))) throw new Error('Not a number');
      return n;
    }
    if (type === 'time') {
      const m = v.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
      if (!m) throw new Error('Not a time this box accepts');
      let h = Number(m[1]);
      if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
      return `${String(h).padStart(2, '0')}:${m[2]}`;
    }
    return v;
  }

  function setValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fill(id, value) {
    const f = fields.get(id);
    if (!f) return { ok: false, error: 'The page changed. Read it again.' };
    try {
      if (f.radios) {
        const i = pickOption(f.radios.map((r) => ownLabel(r) || r.value), value);
        if (i < 0) throw new Error(`No choice like "${short(String(value), 40)}"`);
        if (!document.contains(f.radios[i]) || f.radios[i].disabled) throw new Error('That choice is not available');
        if (!f.radios[i].checked) f.radios[i].click();
        return { ok: true, after: tidyLabel(ownLabel(f.radios[i]) || f.radios[i].value) };
      }
      const el = f.el;
      if (!document.contains(el)) throw new Error('The page changed. Read it again.');
      if (el.disabled) throw new Error('This box is turned off');
      const why = blockedWhy(el, labelOf(el));
      if (why) throw new Error(`Protected (${why}). Fill it yourself.`);

      if (el.type === 'checkbox') {
        if (value && !el.checked) el.click();
        return { ok: true, after: el.checked ? 'ticked' : 'not ticked' };
      }
      if (el.tagName === 'SELECT') {
        const i = pickOption([...el.options].map((o) => o.textContent), value);
        if (i < 0) throw new Error(`No choice like "${short(String(value), 40)}"`);
        setValue(el, el.options[i].value);
        return { ok: true, after: clean(el.options[i].textContent) };
      }
      let v = forInputType((el.type || '').toLowerCase(), value);
      let note = '';
      if (el.maxLength > 0 && v.length > el.maxLength) {
        v = v.slice(0, el.maxLength);
        note = `Cut to ${el.maxLength} characters (the box's limit)`;
      }
      el.focus({ preventScroll: true });
      setValue(el, v);
      if (el.value !== v && el.tagName !== 'TEXTAREA') throw new Error('The page did not accept this value');
      return { ok: true, after: short(clean(el.value)), note };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // Clicks are only for moving around a page (tabs, links to another view, opening a section).
  // The selector comes from a recipe packaged with the extension, never from page content.
  function click(selector) {
    const el = [...document.querySelectorAll(selector)].find(visible);
    if (!el) return { ok: false, error: 'Could not find that on the page' };
    const label = clean(el.textContent || el.value || el.getAttribute('aria-label'));
    const isLink = el.tagName === 'A' && el.href && new URL(el.href, location.href).origin === location.origin;
    const isPlainControl = el.tagName === 'SUMMARY' || el.getAttribute('role') === 'tab' || (el.tagName === 'BUTTON' && el.type === 'button');
    if (!isLink && !isPlainControl) return { ok: false, error: 'Blocked: the helper only clicks page links, tabs and sections' };
    if (RISKY_CLICK.test(label)) return { ok: false, error: `Blocked: "${short(label, 40)}" is yours to click` };
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    el.click();
    return { ok: true, after: short(label, 60) };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    // Only this extension's own pages (side panel) may drive the agent, never another tab or site.
    if (sender.id !== chrome.runtime.id || sender.tab || !msg || msg.to !== 'sbdc-agent') return;
    const handlers = {
      scan: () => scan(),
      values: () => values(),
      table: () => table(),
      pull: () => pull(),
      show: () => show(msg.id, msg.text),
      fill: () => fill(msg.id, msg.value),
      click: () => click(msg.selector),
      banner: () => banner(msg.text, msg.state),
      pickStart: () => pickStart(msg.hints),
      pickStop: () => pickStop(),
      clear: () => clear(),
    };
    const fn = handlers[msg.type];
    sendResponse(fn ? fn() : { ok: false, error: 'Unknown request' });
  });

  // The side panel holds a connection open during a run. If the panel closes, tidy the page up.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'sbdc-run' || port.sender?.id !== chrome.runtime.id) return;
    document.addEventListener('keydown', onKey, true);
    port.onDisconnect.addListener(() => {
      document.removeEventListener('keydown', onKey, true);
      clear();
    });
  });
})();
