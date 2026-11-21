// Browser test for the small things that make the tools easier: the advisor's name is asked once, the follow-up
// email splits next steps by owner, the prep packet uses the client's record, and the Home card and scheduled list
// tools run on the saved clients. Real pages, made-up clients, nothing leaves this computer.
// Run: node --test tests/tool-polish.e2e.test.js   (needs `npm install` in extension/)
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
const open = (tool, mode = 'run') => page.evaluate(([id, m]) => window.__tb.openModal(id, m), [tool, mode]);
const lastOut = () => page.evaluate(() => window.__tb.O()[0]);
const closeSave = async () => { const b = page.locator('#clSave[open] #clSaveNo'); if (await b.count()) await b.click(); };

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
  await ctx.route('**/*', (route) => (route.request().url().startsWith(base) ? route.continue() : route.abort()));
  await ctx.addInitScript(() => { try { localStorage.setItem('sbdc-api-offline', '1'); } catch {} });
  await ctx.route('**/sheet-config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: 'window.SBDC_SHEET_CONFIG = { clientId: "" };' }));
  page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/index.html#/home`);
  await page.waitForFunction(() => !!window.SBDC_CLIENTS && !!window.__tb && !!window.SBDC_LISTS);
});
test.after(async () => { await browser?.close(); server?.close(); });

test('Home shows no follow-up list until there are saved clients, then fills by itself', async () => {
  assert.strictEqual(await page.locator('#dueEmpty').isVisible(), true);
  const old = new Date(Date.now() - 70 * 864e5).toLocaleDateString('en-US');
  await page.evaluate((date) => {
    window.SBDC_CLIENTS.upsert({ name: 'Practice: Pat Smith', biz: 'Practice Bakery LLC', email: 'pat@example.org', facts: { stage: 'existing', goal: 'Open a second shop' }, sessions: [{ id: 's1', date, mins: 60, type: 'Zoom' }] });
    window.SBDC_CLIENTS.upsert({ name: 'Practice: Lee Wong', email: 'lee@example.org' });
  }, old);
  await page.locator('#dueFull').waitFor({ state: 'visible' });
  assert.strictEqual(await page.locator('#kSrc').innerText(), 'Your saved clients');
  assert.match(await page.locator('#kTotalLbl').innerText(), /clients in the list · 1 due/i);
  assert.strictEqual(await page.locator('#k60').innerText(), '1');
});

test("the advisor's name is typed once and offered to every tool that signs with it", async () => {
  await open('email', 'setup');
  assert.strictEqual(await page.inputValue('#f-email-sig'), '');
  await page.fill('#f-email-sig', 'Jordan Rivera');
  await page.click('#tmSave');
  for (const [tool, field] of [['graydot', 'sig'], ['noshow', 'sig'], ['homework', 'sig'], ['zoom', 'me']]) {
    await open(tool, 'setup');
    assert.strictEqual(await page.inputValue(`#f-${tool}-${field}`), 'Jordan Rivera', tool);
    await page.click('#tmCancel');
  }
  // A tool keeps its own name once one is saved there.
  await open('graydot', 'setup');
  await page.fill('#f-graydot-sig', 'J. Rivera');
  await page.click('#tmSave');
  await open('graydot', 'setup');
  assert.strictEqual(await page.inputValue('#f-graydot-sig'), 'J. Rivera');
  await page.click('#tmCancel');
  await open('email', 'setup');
  assert.strictEqual(await page.inputValue('#f-email-sig'), 'Jordan Rivera');
  await page.click('#tmCancel');
});

test('the follow-up email splits next steps into the client\'s and the advisor\'s, and is signed', async () => {
  await open('email');
  await page.fill('#f-email-name', 'Pat');
  await page.fill('#f-email-to', 'pat@example.org');
  await page.fill('#f-email-next', 'Client: send two years of tax returns\nMe: introduce you to a lender');
  await page.click('#tmRunBtn');
  await closeSave();
  const text = (await lastOut()).text;
  assert.match(text, /Your next steps:\n- Send two years of tax returns\.\n\nWhat I'll do:\n- Introduce you to a lender\./);
  assert.doesNotMatch(text, /Client:|Me:/);
  assert.match(text, /Best,\nJordan Rivera$/);

  // Steps with no owner written stay one plain list.
  await open('email');
  await page.fill('#f-email-name', 'Pat');
  await page.fill('#f-email-to', 'pat@example.org');
  await page.fill('#f-email-next', 'Send the lease\nPrice the new oven');
  await page.click('#tmRunBtn');
  await closeSave();
  assert.match((await lastOut()).text, /Next steps:\n- Send the lease\n- Price the new oven/);
});

test('the prep packet says what the saved client\'s record is missing', async () => {
  await open('prep');
  await page.selectOption('#clPick', { label: 'Practice: Pat Smith · Practice Bakery LLC' });
  await page.fill('#f-prep-date', '2026-12-01');
  await page.click('#tmRunBtn');
  await closeSave();
  const text = (await lastOut()).text;
  assert.match(text, /From their record: grade \d+% \(.+\), based on \d+% of the facts/);
  assert.match(text, /- Would raise it most: .+; .+/);
  assert.match(text, /- Not known yet, worth asking: Legal entity formed; EIN from the IRS/);

  await open('prep');
  await page.fill('#f-prep-client', 'Someone Not Saved');
  await page.fill('#f-prep-date', '2026-12-01');
  await page.click('#tmRunBtn');
  await closeSave();
  assert.doesNotMatch((await lastOut()).text, /From their record/);
});

test('a scheduled "Who\'s due" bot runs on the saved clients instead of asking for a list', async () => {
  await open('tracker', 'setup');
  assert.match(await page.locator('#tmSchedHint').innerText(), /runs this tool on your saved clients/i);
  await page.check('#tmSched');
  await page.click('#tmSave');
  await page.goto(`${base}/index.html#/automations`);
  await page.click('#botList .brun');
  const out = await lastOut();
  assert.deepStrictEqual([out.tool, out.status, out.sched], ['tracker', 'done', true]);
  assert.match(out.title, /^1 of 2 due for follow-up/);
  assert.match(out.text, /Practice: Pat Smith/);

  // With no saved clients it falls back to asking.
  await page.evaluate(() => window.SBDC_CLIENTS.setAll([]));
  await page.click('#botList .brun');
  assert.strictEqual((await lastOut()).status, 'input');
  assert.deepStrictEqual(errors, []);
});
