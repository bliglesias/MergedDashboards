// Browser test for the link between Toolbox tools and the client list (client-link.js): tools fill from a saved
// client, a run offers to save its answers back, and the list tools use the saved clients. Runs the real pages in
// Playwright's own Chromium with made-up clients; nothing leaves this computer.
// Run: node --test tests/client-link.e2e.test.js   (needs `npm install` in extension/)
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../extension/node_modules/playwright');

const repo = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png' };
let server, base, browser, page;
const errors = [];

const open = (tool) => page.evaluate((id) => window.__tb.openModal(id, 'run'), tool);
const run = () => page.click('#tmRunBtn');
const client = (email) => page.evaluate((e) => window.SBDC_CLIENTS.all().find((c) => c.email === e) || null, email);
const grade = (email) => page.evaluate((e) => { const c = window.SBDC_CLIENTS.all().find((x) => x.email === e); return window.SBDC_CLIENTS.grade(c).pct; }, email);
const field = (tool, id) => page.inputValue(`#f-${tool}-${id}`);
const saveBox = () => page.locator('#clSave[open]');
const noSaveBox = async () => { await page.waitForTimeout(500); assert.strictEqual(await saveBox().count(), 0); };

test.before(async () => {
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(repo, rel);
    if (!file.startsWith(repo) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: !process.env.HEADED });
  const ctx = await browser.newContext();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ctx.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  // Tools run in this browser, with no sign-in and no Google Sheet.
  await ctx.addInitScript(() => { try { localStorage.setItem('sbdc-api-offline', '1'); } catch {} });
  await ctx.route('**/sheet-config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.SBDC_SHEET_CONFIG = { clientId: "" };' }));
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/index.html#/toolbox`);
  await page.waitForFunction(() => !!window.SBDC_CLIENTS && !!window.__tb && !!window.SBDC_FACT_SHOW);
  await page.evaluate(() => {
    window.SBDC_CLIENTS.upsert({ name: 'Practice: Pat Smith', biz: 'Practice Bakery LLC', email: 'pat@example.org', facts: { industry: 'Bakery', goal: 'Open a second shop', bizDesc: 'Bread and pastry shop, one owner', stage: 'existing' }, sessions: [{ id: 's1', date: '11/3/2026', mins: 60, type: 'Zoom' }] });
    window.SBDC_CLIENTS.upsert({ name: 'Practice: Lee Wong', email: 'lee@example.org' });
  });
});
test.after(async () => { await browser?.close(); server?.close(); });

test('a tool fills every box the client record can answer', async () => {
  await open('prep');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  assert.deepStrictEqual([await field('prep', 'client'), await field('prep', 'industry'), await field('prep', 'goal')], ['Practice: Pat Smith', 'Bakery', 'Open a second shop']);
  await page.click('#tmCancel');

  await open('cic');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  assert.deepStrictEqual([await field('cic', 'client'), await field('cic', 'status'), await field('cic', 'desc')], ['Practice: Pat Smith', 'In Business', 'Bread and pastry shop, one owner']);
  await page.click('#tmCancel');

  await open('email');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  assert.deepStrictEqual([await field('email', 'name'), await field('email', 'to')], ['Practice:', 'pat@example.org']);
  await page.click('#tmCancel');
});

test('after a run the advisor chooses what to save, and only that is saved', async () => {
  await open('prep');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  await page.fill('#f-prep-goal', 'Open a second shop by June');
  await page.fill('#f-prep-date', '2026-12-01');
  await page.fill('#f-prep-time', '10:00');
  await run();
  await saveBox().waitFor();
  assert.strictEqual(await page.inputValue('#clSaveWho'), (await client('pat@example.org')).id);
  const lines = await page.locator('#clSaveList label').allInnerTexts();
  assert.strictEqual(lines.length, 2, 'the industry did not change, so it is not offered: ' + lines.join(' | '));
  assert.match(lines.join('\n'), /Goal: Open a second shop by June \(now: Open a second shop\)/);
  assert.match(lines.join('\n'), /Next session: 2026-12-01 10:00/);
  await page.uncheck('#clSaveList input[value="goal"]');
  await page.click('#clSave button[type=submit]');
  const pat = await client('pat@example.org');
  assert.strictEqual(pat.facts.goal, 'Open a second shop', 'the unticked answer was left alone');
  assert.strictEqual(pat.facts.nextSession, '2026-12-01 10:00');
  assert.deepStrictEqual(pat.events.map((e) => [e.tool, e.kind, e.title]), [['prep', 'tool', 'Session prep packet']]);
});

test('"Not now" saves nothing', async () => {
  await open('prep');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  await page.fill('#f-prep-goal', 'Something else entirely');
  await page.fill('#f-prep-date', '2026-12-02');
  await run();
  await saveBox().waitFor();
  await page.click('#clSaveNo');
  const pat = await client('pat@example.org');
  assert.strictEqual(pat.facts.goal, 'Open a second shop');
  assert.strictEqual(pat.events.length, 1);
});

test('saved answers move the grade: break-even numbers and loan documents', async () => {
  const before = await grade('pat@example.org');
  await open('breakeven');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  await page.fill('#f-breakeven-price', '12');
  await page.fill('#f-breakeven-cost', '4');
  await page.fill('#f-breakeven-fixed', '3000');
  await page.fill('#f-breakeven-vol', '600');
  await run();
  await saveBox().waitFor();
  await page.click('#clSave button[type=submit]');
  const mid = await grade('pat@example.org');
  assert.ok(mid > before, `break-even numbers raise the grade (${before} -> ${mid})`);

  await open('loanready');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  for (const k of ['413', 'pl', 'plan']) await page.check(`#tm [name="f-loanready-have"][value="${k}"]`);
  await run();
  await saveBox().waitFor();
  await page.click('#clSave button[type=submit]');
  const pat = await client('pat@example.org');
  assert.deepStrictEqual(pat.facts.loanDocs, ['413', 'pl', 'plan']);
  assert.strictEqual(pat.facts.docs.length, 3);
  assert.ok((await grade('pat@example.org')) > mid, 'documents on hand raise it again');

  // Next time the tool opens for this client, the boxes are already filled and ticked.
  await open('loanready');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  assert.deepStrictEqual(await page.locator('#tm [name="f-loanready-have"]:checked').evaluateAll((els) => els.map((e) => e.value)), ['413', 'pl', 'plan']);
  await page.click('#tmCancel');
  await open('breakeven');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  assert.deepStrictEqual([await field('breakeven', 'price'), await field('breakeven', 'vol')], ['12', '600']);
  await page.click('#tmCancel');
});

test('a typed name finds the saved client; a new name is offered as a new client; examples are ignored', async () => {
  // Typed, not picked: the email matches Lee, and an email draft goes on the timeline as a draft.
  await open('email');
  await page.fill('#f-email-name', 'Lee');
  await page.fill('#f-email-to', 'lee@example.org');
  await page.fill('#f-email-next', 'Client: send the lease');
  await run();
  await saveBox().waitFor();
  assert.strictEqual(await page.inputValue('#clSaveWho'), (await client('lee@example.org')).id);
  await page.click('#clSave button[type=submit]');
  const lee = await client('lee@example.org');
  assert.strictEqual(lee.facts.nextSteps, 'Client: send the lease');
  assert.deepStrictEqual(lee.events.map((e) => e.kind), ['email']);
  assert.match(lee.events[0].title, /email drafted$/);
  assert.strictEqual(lee.sessions.length, 0, 'a draft is not a session');

  // Same client, nothing new to save: no question, the run is just logged.
  await open('checkin');
  await page.fill('#f-checkin-name', 'Lee');
  await page.fill('#f-checkin-to', 'lee@example.org');
  await run();
  await noSaveBox();
  assert.strictEqual((await client('lee@example.org')).events.length, 2);

  // Someone not on the list yet.
  await open('email');
  await page.fill('#f-email-name', 'Practice: Ana Ruiz');
  await page.fill('#f-email-to', 'ana@example.org');
  await run();
  await saveBox().waitFor();
  assert.strictEqual(await page.inputValue('#clSaveWho'), '__new');
  await page.click('#clSave button[type=submit]');
  const ana = await client('ana@example.org');
  assert.deepStrictEqual([ana.name, ana.events.length], ['Practice: Ana Ruiz', 1]);

  // The dashboard's own example names never reach the client list.
  const count = await page.evaluate(() => window.SBDC_CLIENTS.all().length);
  await open('email');
  await page.fill('#f-email-name', 'Example Client');
  await page.fill('#f-email-to', 'someone@example.com');
  await run();
  await noSaveBox();
  await open('breakeven');
  await page.fill('#f-breakeven-price', '9');
  await page.fill('#f-breakeven-cost', '3');
  await run();
  await noSaveBox();
  assert.strictEqual(await page.evaluate(() => window.SBDC_CLIENTS.all().length), count, 'a run with no client named asks nothing');
});

test('the client page shows the timeline and the saved answers in plain words', async () => {
  const pat = await client('pat@example.org');
  await page.goto(`${base}/index.html#/clients/${pat.id}`);
  const text = await page.locator('#clBody').innerText();
  assert.match(text, /Timeline/);
  assert.match(text, /11\/3\/2026 · Session · 60 min · Zoom/);
  assert.match(text, /Session prep packet/);
  assert.match(text, /Break-even calculator/);
  assert.match(text, /Loan package items on hand/);
  assert.doesNotMatch(text, /413, pl, plan/, 'ticked items are shown by name, not by code');
  assert.match(text, /Next session\s+2026-12-01 10:00/);
});

test('the list tools can use the saved clients instead of pasted rows', async () => {
  await page.goto(`${base}/index.html#/toolbox`);
  await open('tracker');
  await page.click('[data-clients="tracker"]');
  const rows = (await field('tracker', 'list')).split('\n');
  assert.strictEqual(rows[0], 'Name\tEmail\tLast contact\tDot');
  assert.ok(rows.includes('Practice: Pat Smith\tpat@example.org\t11/3/2026\tYellow'), rows.join(' | '));
  assert.ok(rows.some((r) => /^Practice: Lee Wong\tlee@example\.org\t\d+\/\d+\/\d+\tGray$/.test(r)), 'never met: gray dot, dated from when they were added');
  await run();
  await noSaveBox();
  const out = await page.evaluate(() => window.__tb.O()[0]);
  assert.match(out.title, /of 3 due for follow-up/);
  assert.strictEqual(out.ex, false);
  assert.match(out.text, /Practice: Pat Smith/);

  await open('activity');
  await page.click('[data-clients="activity"]');
  assert.strictEqual(await field('activity', 'list'), 'Date\tClient\tMinutes\tType\n11/3/2026\tPractice: Pat Smith\t60\tZoom');
  await page.click('#tmCancel');

  // With no saved clients the button is not offered.
  await page.evaluate(() => window.SBDC_CLIENTS.setAll([]));
  await open('tracker');
  assert.strictEqual(await page.locator('[data-clients]').count(), 0);
  await page.click('#tmCancel');
  assert.deepStrictEqual(errors, []);
});
