// Run: node --test tests/sheet-store.test.js
const test = require('node:test');
const assert = require('node:assert');
const { HEAD, toRows, fromRows, merge, okAccount } = require('../js/sheet-store.js');

const pat = { id: 'c1', name: 'Example: Pat Smith', biz: 'Example Bakery LLC', email: 'pat@example.com', phone: '555-0100', facts: { stage: 'existing', docs: ['P&L'] }, sessions: [{ id: 's1', date: '11/3/2026', mins: 60, type: 'Zoom' }], src: { intake: 5 }, made: 1, updated: 100 };
const info = () => ({ pct: 72, hours: 1, last: '11/3/2026' });

test('a client goes to a row and comes back the same', () => {
  const rows = toRows([pat], info);
  assert.deepStrictEqual(rows[0], HEAD);
  assert.deepStrictEqual(rows[1].slice(0, 10), ['c1', 'Example: Pat Smith', 'Example Bakery LLC', 'pat@example.com', '555-0100', 'existing', 72, 1, 1, '11/3/2026']);
  assert.deepStrictEqual(fromRows(rows), [pat]);
});

test('example records and records without an id never go to the Sheet', () => {
  assert.strictEqual(toRows([{ ...pat, ex: true }, { ...pat, id: '' }], info).length, 1);
});

test('a row typed by hand in the Sheet becomes a client, and edited cells win over the stored record', () => {
  const typed = fromRows([HEAD, ['', 'Example: Lee Wong', 'Example Cafe', 'lee@example.com', 5550101, 'idea']], () => 'new1');
  assert.strictEqual(typed.length, 1);
  assert.deepStrictEqual({ id: typed[0].id, name: typed[0].name, phone: typed[0].phone, stage: typed[0].facts.stage, sessions: typed[0].sessions }, { id: 'new1', name: 'Example: Lee Wong', phone: '5550101', stage: 'idea', sessions: [] });

  const rows = toRows([pat], info);
  rows[1][2] = 'Example Bakery and Cafe LLC';
  assert.strictEqual(fromRows(rows)[0].biz, 'Example Bakery and Cafe LLC');
  assert.strictEqual(fromRows(rows, null, 999)[0].updated, 999, 'so the edit beats an older change made in the browser');
  assert.strictEqual(fromRows(toRows([pat], info), null, 999)[0].updated, 100, 'an untouched row keeps its own time');
});

test('bad rows are skipped and odd values are made safe', () => {
  const rows = [HEAD, 'not a row', ['', '', '', ''], ['c9', 'Example: Odd', '', '', '', '', '', '', '', '', '', '{"facts":{"<b>":"x","stage":["a",{"y":1}]},"sessions":"nope","src":[1]}'], ['c9', 'Example: Same id again']];
  const got = fromRows(rows, () => 'x');
  assert.strictEqual(got.length, 1);
  assert.deepStrictEqual(got[0].facts, { stage: ['a'] });
  assert.deepStrictEqual(got[0].sessions, []);
  assert.deepStrictEqual(got[0].src, {});
});

test('merge: new clients are added from both sides, the newer change wins, sessions are joined', () => {
  const here = [{ ...pat, phone: '555-0199', updated: 300, sessions: [...pat.sessions, { id: 's2', date: '11/10/2026', mins: 30, type: 'Phone' }] }, { id: 'c2', name: 'Example: Only here', biz: '', email: '', phone: '', facts: {}, sessions: [], src: {}, updated: 50 }];
  const sheet = [{ ...pat, biz: 'Example Bakery (old name)', facts: { stage: 'existing', revenue: '90000' }, updated: 200 }, { id: 'c3', name: 'Example: Only in the Sheet', biz: '', email: '', phone: '', facts: {}, sessions: [], src: {}, updated: 60 }];
  const got = merge(here, sheet);
  assert.deepStrictEqual(got.map((c) => c.id), ['c1', 'c2', 'c3']);
  assert.strictEqual(got[0].phone, '555-0199');
  assert.strictEqual(got[0].biz, 'Example Bakery LLC');
  assert.strictEqual(got[0].facts.revenue, '90000', 'a fact only the older side knows is kept');
  assert.strictEqual(got[0].sessions.length, 2);
  assert.strictEqual(merge(got, toRows(got, info) && fromRows(toRows(got, info))).length, 3, 'syncing twice adds nothing');
});

test('the timeline travels with the record and the two sides are joined', () => {
  const run = { id: 'e1', t: 500, tool: 'prep', kind: 'tool', title: 'Session prep packet' };
  const mail = { id: 'e2', t: 900, tool: 'email', kind: 'email', title: 'Follow-up email: email drafted' };
  const back = fromRows(toRows([{ ...pat, events: [run, { id: '', title: 'no id' }, 'junk'] }], info));
  assert.deepStrictEqual(back[0].events, [run]);
  const got = merge([{ ...pat, events: [run] }], [{ ...pat, events: [mail, run], updated: 900 }]);
  assert.deepStrictEqual(got[0].events.map((e) => e.id), ['e2', 'e1']);
  assert.strictEqual('events' in merge([pat], [pat])[0], false);
});

test('merge: the same email is the same client even with a different id', () => {
  const got = merge([pat], [{ ...pat, id: 'other', name: 'Example: Pat S.', updated: 500 }]);
  assert.strictEqual(got.length, 1);
  assert.strictEqual(got[0].id, 'c1');
  assert.strictEqual(got[0].name, 'Example: Pat S.');
});

test('merge: a client removed here stays removed, unless the Sheet copy changed afterwards', () => {
  assert.strictEqual(merge([], [pat], { c1: 150 }).length, 0);
  assert.strictEqual(merge([], [{ ...pat, updated: 200 }], { c1: 150 }).length, 1);
});

test('merge: an example record in this browser is kept apart from a real one with the same email', () => {
  const got = merge([{ ...pat, id: 'ex', ex: true }], [pat]);
  assert.strictEqual(got.length, 2);
});

test('only accounts in the allowed domain may connect', () => {
  assert.ok(okAccount('pat@maricopa.edu', 'maricopa.edu'));
  assert.ok(okAccount('Pat@domail.maricopa.edu', 'maricopa.edu'));
  assert.ok(!okAccount('pat@gmail.com', 'maricopa.edu'));
  assert.ok(!okAccount('pat@notmaricopa.edu', 'maricopa.edu'));
  assert.ok(!okAccount('pat@maricopa.edu.example.com', 'maricopa.edu'));
  assert.ok(!okAccount('', 'maricopa.edu'));
});
