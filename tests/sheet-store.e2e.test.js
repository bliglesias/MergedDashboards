// Browser test for the Google Sheet client list (sheet-store.js). It runs the real dashboard pages in Playwright's
// own Chromium against a pretend Google that lives in this file: no request leaves this computer and no real
// account or Sheet is used. Run: node --test tests/sheet-store.e2e.test.js   (needs `npm install` in extension/)
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('../extension/node_modules/playwright');
const { HEAD } = require('../js/sheet-store.js');

const repo = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png' };
let server, base, browser;

// The pretend Google: one account's Drive, holding at most one Sheet.
const google = { email: 'pat.smith@maricopa.edu', sheet: null, calls: [], expired: false };
const SIGN_IN = `window.google = { accounts: { oauth2: {
  initTokenClient: (cfg) => ({ requestAccessToken: () => setTimeout(() => cfg.callback({ access_token: 'practice-pass', scope: cfg.scope }), 0) }),
  hasGrantedAllScopes: () => true,
  revoke: () => { window.__revoked = true; },
} } };`;

async function pretendGoogle(route) {
  const req = route.request();
  const url = new URL(req.url());
  const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  if (url.hostname === 'accounts.google.com') return route.fulfill({ contentType: 'text/javascript', body: SIGN_IN });
  google.calls.push(`${req.method()} ${url.hostname}${decodeURIComponent(url.pathname)}`);
  if (google.expired || req.headers().authorization !== 'Bearer practice-pass') return json({ error: 'no pass' }, 401);
  if (url.pathname === '/oauth2/v3/userinfo') return json({ email: google.email });
  if (url.pathname === '/drive/v3/files') return json({ files: google.sheet ? [{ id: 'sheet1' }] : [] });
  if (url.pathname === '/v4/spreadsheets' && req.method() === 'POST') { google.sheet = []; return json({ spreadsheetId: 'sheet1' }); }
  if (!google.sheet || !url.pathname.startsWith('/v4/spreadsheets/sheet1/values/')) return json({ error: 'not found' }, 404);
  if (req.method() === 'GET') return json({ values: google.sheet });
  if (req.method() === 'PUT') {
    assert.strictEqual(url.searchParams.get('valueInputOption'), 'RAW', 'text is stored as typed, never run as a formula');
    const { values } = JSON.parse(req.postData());
    google.sheet = [...values, ...google.sheet.slice(values.length)];
    return json({});
  }
  if (url.pathname.endsWith(':clear')) { google.sheet = google.sheet.slice(0, Number(decodeURIComponent(url.pathname).match(/!A(\d+):L:clear$/)[1]) - 1); return json({}); }
  return json({ error: 'unexpected' }, 400);
}

// A fresh browser profile (its own localStorage), like a different computer. clientId '' = not set up.
async function computer(clientId = 'practice-client-id') {
  const ctx = await browser.newContext();
  const outside = [];
  await ctx.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    if (/^https:\/\/(accounts\.google\.com|[a-z]+\.googleapis\.com)\//.test(url) && !/fonts\.googleapis/.test(url)) { outside.push(url); return pretendGoogle(route); }
    return route.abort();
  });
  await ctx.route('**/sheet-config.js', (route) => route.fulfill({ contentType: 'text/javascript', body: `window.SBDC_SHEET_CONFIG = { clientId: '${clientId}', domain: 'maricopa.edu', approved: false };` }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.accept());
  await page.goto(`${base}/index.html#/clients`);
  await page.waitForFunction(() => !!window.SBDC_CLIENTS);
  return { ctx, page, outside, errors };
}
const names = (page) => page.evaluate(() => window.SBDC_CLIENTS.all().map((c) => c.name).sort());
const sheetNames = () => google.sheet.slice(1).map((r) => r[1]).sort();
const synced = (page) => page.locator('#clSheet', { hasText: 'Last synced' }).waitFor();

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
});
test.after(async () => { await browser?.close(); server?.close(); });

test('with no client ID the feature is off: no card, and Google is never contacted', async () => {
  const pc = await computer('');
  await pc.page.evaluate(() => window.SBDC_CLIENTS.upsert({ name: 'Practice: Pat Smith', email: 'pat@example.com' }));
  assert.strictEqual(await pc.page.locator('#clSheet').isHidden(), true);
  await pc.page.waitForTimeout(2000);
  assert.deepStrictEqual(pc.outside, []);
  assert.deepStrictEqual(pc.errors, []);
  await pc.ctx.close();
});

test('nothing is sent to Google before the advisor clicks Connect', async () => {
  const pc = await computer();
  await pc.page.locator('#clSheet', { hasText: 'Keep this list in a Google Sheet' }).waitFor();
  assert.match(await pc.page.locator('#clSheet').innerText(), /made-up clients only/i);
  await pc.page.evaluate(() => window.SBDC_CLIENTS.upsert({ name: 'Practice: Pat Smith', email: 'pat@example.com' }));
  await pc.page.waitForTimeout(2000);
  assert.deepStrictEqual(pc.outside, []);
  await pc.ctx.close();
});

test('the wrong kind of Google account is turned away and its pass is cancelled', async () => {
  google.email = 'someone@gmail.com';
  const pc = await computer();
  await pc.page.click('[data-sheet="on"]');
  await pc.page.locator('#clSheet', { hasText: "someone@gmail.com can't be used here" }).waitFor();
  assert.strictEqual(await pc.page.evaluate(() => window.__revoked), true);
  assert.strictEqual(google.sheet, null, 'no Sheet was made');
  google.email = 'pat.smith@maricopa.edu';
  await pc.ctx.close();
});

test('two computers share one list through the Sheet', async () => {
  // Computer A has two clients and an example record, and connects: the Sheet is made and filled.
  const a = await computer();
  await a.page.evaluate(() => {
    window.SBDC_CLIENTS.upsert({ name: 'Practice: Pat Smith', biz: 'Practice Bakery LLC', email: 'pat@example.com', facts: { stage: 'existing' }, sessions: [{ id: 's1', date: '11/3/2026', mins: 60, type: 'Zoom' }] });
    window.SBDC_CLIENTS.upsert({ name: 'Practice: Lee Wong', email: 'lee@example.com' });
    window.SBDC_CLIENTS.upsert({ name: 'Example: Sam Patel (fictional)', email: 'sam@example.com', ex: true }, 'sample');
  });
  await a.page.click('[data-sheet="on"]');
  await synced(a.page);
  assert.deepStrictEqual(google.sheet[0], HEAD);
  assert.deepStrictEqual(sheetNames(), ['Practice: Lee Wong', 'Practice: Pat Smith'], 'the example record stays in the browser');
  const patRow = google.sheet.find((r) => r[1] === 'Practice: Pat Smith');
  assert.deepStrictEqual([patRow[2], patRow[3], patRow[5], patRow[7], patRow[8]], ['Practice Bakery LLC', 'pat@example.com', 'existing', 1, 1]);
  assert.match(await a.page.locator('#clSheet').innerText(), /pat\.smith@maricopa\.edu/);
  assert.strictEqual(await a.page.locator('#clSheet a').getAttribute('href'), 'https://docs.google.com/spreadsheets/d/sheet1/edit');

  // Computer B starts empty, connects with the same account and gets both clients.
  const b = await computer();
  assert.deepStrictEqual(await names(b.page), []);
  await b.page.click('[data-sheet="on"]');
  await synced(b.page);
  assert.deepStrictEqual(await names(b.page), ['Practice: Lee Wong', 'Practice: Pat Smith']);
  await b.page.locator('#clBody', { hasText: 'Practice Bakery LLC' }).waitFor();

  // A change on B is saved by itself a moment later.
  await b.page.evaluate(() => window.SBDC_CLIENTS.upsert({ name: 'Practice: Pat Smith', email: 'pat@example.com', phone: '555-0100' }));
  await assert.doesNotReject(b.page.waitForFunction(() => true).then(async () => { for (let i = 0; i < 40 && google.sheet.find((r) => r[1] === 'Practice: Pat Smith')[4] !== '555-0100'; i++) await b.page.waitForTimeout(250); }));
  assert.strictEqual(google.sheet.find((r) => r[1] === 'Practice: Pat Smith')[4], '555-0100');

  // Someone types a new row straight into the Sheet and fixes a business name there. A picks both up.
  google.sheet.push(['', 'Practice: Ana Ruiz', 'Practice Tacos', 'ana@example.com']);
  google.sheet.find((r) => r[1] === 'Practice: Pat Smith')[2] = 'Practice Bakery and Cafe LLC';
  await a.page.click('[data-sheet="sync"]');
  await a.page.locator('#clBody', { hasText: 'Practice: Ana Ruiz' }).waitFor();
  const pat = await a.page.evaluate(() => window.SBDC_CLIENTS.all().find((c) => c.email === 'pat@example.com'));
  assert.deepStrictEqual([pat.biz, pat.phone, pat.sessions.length], ['Practice Bakery and Cafe LLC', '555-0100', 1]);
  assert.strictEqual(google.sheet.length, 4, 'the typed row was given an id, not written twice');
  assert.ok(google.sheet.every((r) => r[0]), 'every row has an id');

  // A removes a client: the row leaves the Sheet, and B does not get it back.
  const leeId = await a.page.evaluate(() => window.SBDC_CLIENTS.all().find((c) => c.email === 'lee@example.com').id);
  await a.page.goto(`${base}/index.html#/clients/${leeId}`);
  await a.page.click('[data-cl="remove"]');
  for (let i = 0; i < 40 && sheetNames().includes('Practice: Lee Wong'); i++) await a.page.waitForTimeout(250);
  assert.deepStrictEqual(sheetNames(), ['Practice: Ana Ruiz', 'Practice: Pat Smith']);
  assert.strictEqual(google.sheet.length, 3, 'the leftover last row was blanked');

  // After a reload the pass is gone (it is never stored): the card asks to reconnect and nothing is sent.
  const before = google.calls.length;
  await a.page.reload();
  await a.page.locator('#clSheet', { hasText: 'Your list is kept in a Google Sheet' }).waitFor();
  assert.strictEqual(google.calls.length, before);
  assert.doesNotMatch(JSON.stringify(await a.page.evaluate(() => ({ ...localStorage }))), /practice-pass/);
  await a.page.click('[data-sheet="on"]');
  await synced(a.page);

  // Google ends the pass after an hour: the card says so, and the browser still has the list.
  google.expired = true;
  await a.page.click('[data-sheet="sync"]');
  await a.page.locator('#clSheet', { hasText: 'Google signed you out after an hour' }).waitFor();
  assert.strictEqual((await names(a.page)).length, 3);
  google.expired = false;

  // Disconnect: the pass is cancelled, the Sheet and the browser's list both stay.
  await a.page.click('[data-sheet="on"]');
  await synced(a.page);
  await a.page.click('[data-sheet="off"]');
  await a.page.locator('#clSheet', { hasText: 'Keep this list in a Google Sheet' }).waitFor();
  assert.strictEqual(await a.page.evaluate(() => window.__revoked), true);
  assert.strictEqual(google.sheet.length, 3);
  assert.strictEqual((await names(a.page)).length, 3);

  assert.deepStrictEqual([...a.errors, ...b.errors], []);
  assert.ok(google.calls.every((c) => /^(GET|POST|PUT) (www|sheets)\.googleapis\.com\/(oauth2\/v3\/userinfo|drive\/v3\/files|v4\/spreadsheets(\/sheet1\/values\/Clients!A\d+(:L)?(:clear)?)?)$/.test(c)), 'only sign-in, the file search and the one Sheet are touched: ' + [...new Set(google.calls)].join(', '));
  await a.ctx.close();
  await b.ctx.close();
});
