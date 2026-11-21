// Matches fill items (from parse.js) to the form fields the page agent found. Pure functions.
import { normalizeLabel } from './parse.js';

export const AUTO_ON = 0.85; // steps at or above this are ticked by default
const MIN_SCORE = 0.6; // below this a line is reported as "no matching field"

const tokens = (s) => new Set(s.split(' ').filter(Boolean));

// Names record systems use for the same session box. The first name in each row is the one the dashboard's
// "Format notes for CIC" header uses. Kept short on purpose: any other name is taught once by pointing.
const DEFAULT_SAME = [
  ['date', 'session date', 'date of session', 'contact date', 'date of contact'],
  ['contact type', 'type of contact', 'session type', 'type of session', 'contact method'],
  ['time', 'start time', 'session time', 'time of session'],
  ['contact hours', 'contact', 'contact time', 'hours', 'session hours', 'total hours', 'counseling hours'],
  ['notes', 'session notes', 'counseling notes'],
];
let SAME = DEFAULT_SAME;
// The dashboard can publish a newer list (lib/settings.js checks it first). No list puts the packaged one back.
export const useSameBoxes = (rows) => { SAME = rows && rows.length ? rows : DEFAULT_SAME; };
const sameBox = (x, y) => SAME.some((row) => row.includes(x) && row.includes(y));

// 0..1 for how well two labels agree. 1 = same words.
export function labelScore(a, b) {
  const x = normalizeLabel(a);
  const y = normalizeLabel(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (sameBox(x, y)) return 0.97;
  const tx = tokens(x);
  const ty = tokens(y);
  const shared = [...tx].filter((t) => ty.has(t)).length;
  if (!shared) return 0;
  const small = Math.min(tx.size, ty.size);
  const big = Math.max(tx.size, ty.size);
  if (shared === big) return 0.95; // same words, different order
  if (shared === small) return small / big >= 0.5 ? 0.8 : 0.65; // one label contains the other: the advisor confirms
  const jaccard = shared / (tx.size + ty.size - shared);
  return jaccard >= 0.5 ? 0.5 + jaccard * 0.3 : 0;
}

const fits = (item, field) => {
  if (field.blocked) return false;
  if (item.kind === 'check') return field.type === 'checkbox';
  return field.type !== 'checkbox';
};

// A loose label match onto a dropdown is only worth suggesting when the dropdown has that choice.
const canChoose = (item, field) => {
  if (item.kind === 'check' || !field.options || !field.options.length) return true;
  const want = normalizeLabel(item.value);
  return field.options.some((o) => { const has = normalizeLabel(o); return has && (has.includes(want) || want.includes(has)); });
};

// Returns { steps, unmatched }.
// Each field is used at most once; the best label pairs win first.
export function planFill(items, fields) {
  const pairs = [];
  items.forEach((item, i) => {
    if (item.kind === 'check' && !item.value) return; // an empty box means "leave it alone"
    fields.forEach((field, f) => {
      if (!fits(item, field)) return;
      // field.learned: the line the advisor pointed this box at last time (same site), if any.
      const score = field.learned && normalizeLabel(field.learned) === normalizeLabel(item.label) ? 1.01 : labelScore(item.label, field.label);
      if (score < AUTO_ON && !canChoose(item, field)) return;
      if (score >= MIN_SCORE) pairs.push({ i, f, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score);

  const usedItem = new Set();
  const usedField = new Set();
  const chosen = new Map();
  for (const p of pairs) {
    if (usedItem.has(p.i) || usedField.has(p.f)) continue;
    usedItem.add(p.i);
    usedField.add(p.f);
    chosen.set(p.i, p);
  }

  const steps = [];
  const unmatched = [];
  items.forEach((item, i) => {
    if (item.kind === 'check' && !item.value) return;
    const p = chosen.get(i);
    if (!p) {
      unmatched.push(item);
      return;
    }
    const field = fields[p.f];
    steps.push({
      action: item.kind === 'check' ? 'check' : field.type === 'select' || field.type === 'radio' ? 'choose' : 'type',
      fieldId: field.id,
      fieldLabel: field.label,
      fieldHas: field.value || '',
      label: item.label,
      value: item.kind === 'check' ? true : item.value,
      score: Math.min(1, p.score),
      learned: !!field.learned && normalizeLabel(field.learned) === normalizeLabel(item.label),
      on: p.score >= AUTO_ON,
    });
  });
  return { steps, unmatched };
}
