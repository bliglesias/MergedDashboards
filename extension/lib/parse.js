// Turns a pasted "Label: value" block into fill items. Pure functions, no browser APIs, so Node can test them.
// Built for the dashboard's "Copy for CIC" block (cic.js) and the CIC session blocks (tools.js), and it accepts
// any plain "Label: value" list.

// Sections whose lines are notes for the advisor, not fields to fill.
const ADVISOR_ONLY = /^(not captured yet|also check before session 1|missing before session 1|missing \/ to check|ask in session 1)\b/i;
const PLACEHOLDER = /^\((?:add|add, optional|select|leave blank|not started)\)$/i;
const LIST_LINE = /^(?:[-•*]|\d+\.)\s+/;

export function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/\((hours|hrs|minutes|mins)\)/g, ' $1 ') // "Contact (hours)" keeps its unit
    .replace(/\bhrs\b/g, 'hours')
    .replace(/\bmins\b/g, 'minutes')
    .replace(/\(.*?\)/g, ' ')
    .replace(/\bweb site\b/g, 'website')
    .replace(/\be-?mail\b/g, 'email')
    .replace(/\bp\/l\b/g, 'profit loss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const isAllCapsHeading = (label) => label.length >= 12 && label === label.toUpperCase() && /[A-Z]{3}/.test(label);

// Returns { items, skipped }.
//   items:   [{ kind: 'field', label, value } | { kind: 'check', label, value: true|false }]
//   skipped: lines that are not fields (titles, advisor-only notes, blanks with no answer)
export function parseBlock(text) {
  const items = [];
  const skipped = [];
  const notes = [];
  let advisorOnly = false;

  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const box = line.match(/^\[( |x)\]\s*(.+)$/i);
    if (box) {
      advisorOnly = false;
      items.push({ kind: 'check', label: box[2].trim(), value: box[1].toLowerCase() === 'x' });
      continue;
    }
    if (LIST_LINE.test(line)) {
      skipped.push({ line, why: advisorOnly ? 'note for you' : 'list line' });
      continue;
    }

    const pair = line.match(/^([^:]{2,80}):\s*(.*)$/);
    if (!pair) {
      skipped.push({ line, why: 'no label' });
      continue;
    }
    const label = pair[1].trim();
    const value = pair[2].trim();

    if (ADVISOR_ONLY.test(label)) {
      advisorOnly = true;
      skipped.push({ line, why: 'note for you' });
      continue;
    }
    advisorOnly = false;

    // CIC session Notes headings are all caps and belong together in one Notes box.
    if (isAllCapsHeading(label)) {
      notes.push(line);
      continue;
    }
    if (!value || PLACEHOLDER.test(value)) {
      skipped.push({ line, why: 'no answer yet' });
      continue;
    }
    items.push({ kind: 'field', label, value });
  }

  if (notes.length) items.push({ kind: 'field', label: 'Notes', value: notes.join('\n') });
  return { items, skipped };
}
