// A list copied from a page (tabs between columns, one row per line): which dashboard tool it belongs in,
// and the columns that tool reads. Pure functions, no browser APIs.

const TAB = '\t';
const NL = '\n';
const rowsOf = (text) => String(text || '').split(/\r?\n/).filter((l) => l.trim()).map((l) => l.split(TAB).map((c) => c.trim()));
const col = (head, re) => head.findIndex((h) => re.test(h));

function sessionColumns(head) {
  const h = head.map((c) => c.toLowerCase());
  const date = col(h, /\bdate\b/);
  const minutes = col(h, /\bmin(ute)?s?\b/);
  const hours = minutes < 0 ? col(h, /\b(hours?|hrs|duration|contact time)\b/) : -1;
  if (date < 0 || (minutes < 0 && hours < 0)) return null;
  return { date, minutes, hours, client: col(h, /\b(client|name|business|company)\b/), type: col(h, /\b(type|method)\b/) };
}

// 'sessions' = a session log (it has a date and a time-spent column); anything else is a client list.
export function listKind(text) {
  const [head] = rowsOf(text);
  return head && sessionColumns(head) ? 'sessions' : 'clients';
}

// The dashboard's "Monthly activity report" reads Date, Client, Minutes and Type, with its own words for Type.
const TYPE = [[/in.?person|face|office|on.?site/i, 'In person'], [/zoom/i, 'Zoom'], [/online|video|virtual|teams|web/i, 'Virtual'], [/phone|call/i, 'Phone'], [/e-?mail/i, 'Email']];
const typeWord = (s) => (TYPE.find(([re]) => re.test(s)) || [null, s])[1];

export function sessionRows(text) {
  const rows = rowsOf(text);
  const c = rows.length ? sessionColumns(rows[0]) : null;
  if (!c) return String(text || '');
  const out = [['Date', 'Client', 'Minutes', 'Type']];
  for (const r of rows.slice(1)) {
    const spent = Number(String(r[c.minutes >= 0 ? c.minutes : c.hours] || '').replace(/[^\d.]/g, ''));
    if (!r[c.date] || !isFinite(spent)) continue;
    const mins = Math.round(c.minutes >= 0 ? spent : spent * 60);
    out.push([r[c.date], c.client >= 0 ? r[c.client] || '' : '', String(mins), c.type >= 0 ? typeWord(r[c.type] || '') : '']);
  }
  return out.map((r) => r.join(TAB)).join(NL);
}
