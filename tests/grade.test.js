// Run: node --test tests/grade.test.js
const test = require('node:test');
const assert = require('node:assert');
const { grade } = require('../js/grade.js');

const NOW = Date.parse('2026-11-16T12:00:00');
const strong = {
  facts: { industry: 'Auto repair', biz: 'Example Auto Care LLC', stage: 'existing', years: '6 years', funding: 'yes', goal: 'Loan', expect: 'Loan package', llc: 'yes', ein: 'yes', tpt: 'yes', online: 'both', invested: '85000', employees: '5', revenue: '640000', amount: '250000', use: 'Buildout', credit: '720', liquid: '40000', pl: '52000', price: '100', cost: '40', volume: '300', fixed: '9000', docs: ['a', 'b', 'c'] },
  sessions: [{ date: '11/10/2026', mins: 120 }, { date: '10/20/2026', mins: 120 }, { date: '10/1/2026', mins: 90 }],
};
const item = (g, label) => g.items.find((i) => i.label === label);

test('the points add up to 100 and a complete, strong client scores 100', () => {
  const g = grade(strong, NOW);
  assert.equal(g.items.reduce((a, i) => a + i.pts, 0), 100);
  assert.equal(g.pct, 100);
  assert.equal(g.known, 100);
  assert.equal(g.band, 'Strong');
  assert.equal(g.raise.length, 0);
});

test('an empty record is 0 and says there is not enough to go on', () => {
  const g = grade({ facts: {}, sessions: [] }, NOW);
  assert.equal(g.pct, 0);
  assert.equal(g.band, 'Not enough info yet');
  assert.ok(g.thin);
  assert.equal(g.raise.length, 3);
});

test('an idea-stage client with the basics missing lands low, with the biggest gaps first', () => {
  const g = grade({ facts: { stage: 'idea', llc: 'no', ein: 'no', tpt: 'unsure', online: 'none', revenue: '0', invested: '0', credit: 'lt620', liquid: '0', goal: 'Open a cafe', expect: 'A plan', funding: 'yes', industry: 'Cafe', employees: '0', years: '0', docs: [] }, sessions: [] }, NOW);
  assert.ok(g.pct < 40, 'got ' + g.pct);
  assert.equal(g.band, 'Early');
  assert.equal(g.raise[0].label, 'Stage of the business');
});

test('more hours and a recent session raise the grade', () => {
  const base = { facts: { stage: 'startup', goal: 'Grow' }, sessions: [] };
  const seen = { ...base, sessions: [{ date: '11/12/2026', mins: 300 }] };
  assert.ok(grade(seen, NOW).pct > grade(base, NOW).pct);
});

test('personal traits never change the grade', () => {
  const a = grade(strong, NOW).pct;
  const b = grade({ ...strong, facts: { ...strong.facts, race: 'x', sex: 'x', age: '70', veteran: 'yes', disability: 'yes', county: 'x', language: 'Spanish' } }, NOW).pct;
  assert.equal(a, b);
});

test('CIC status words are read as stages', () => {
  assert.equal(item(grade({ facts: { stage: 'In Business' }, sessions: [] }, NOW), 'Stage of the business').got, 10);
  assert.equal(item(grade({ facts: { stage: 'Not Yet in Business' }, sessions: [] }, NOW), 'Stage of the business').got, 2);
});
