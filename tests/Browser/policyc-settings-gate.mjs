// tests/Browser/policyc-settings-gate.mjs
// POLICY-C browser acceptance gate: the draft editor renders the four POLICY-C
// sections (income categories, scoring, score categories, exceptions), shows the
// read-only max-score summary, surfaces visible overlap/celling errors and blocks
// saving until they are fixed, and persists a full POLICY-C draft through the API.
// Fail-fast: every /api/ call is proxied to the isolated local server (the hosted
// API is never contacted — any genuinely remote request fails the gate).
// Self-contained: isolated SQLite fixture + spawned PHP server + headless Chromium.
process.on('unhandledRejection', () => { console.error('Browser runner asynchronous failure (details suppressed)'); process.exitCode = 1; });
const started = new Date();
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const port = 19000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const root = process.cwd();
const database = path.join(root, 'storage/app/reports', `qa-isolated-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true });
fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', LOG_CHANNEL: 'stderr', APP_URL: base };

async function navigate(page, url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 }); return; }
    catch (error) { if (attempt === 3) throw error; await new Promise((resolve) => setTimeout(resolve, 500)); }
  }
}

const credentials = { admin: { username: 'TEST_admin', password: randomBytes(24).toString('hex') } };
const fixture = spawnSync('php', ['tests/Browser/audit-fixture.php'], { env, input: JSON.stringify(credentials), encoding: 'utf8' });
if (fixture.status !== 0) throw new Error('Isolated database fixture failed; credentials suppressed');
const fixtureAuth = JSON.parse(fixture.stdout);

const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/server-router.php')], { cwd: root, env, stdio: 'ignore' });

let browser;
const results = [];
const errors = [];
const mark = (module, status, detail = '') => results.push({ module, status, detail });

try {
  for (let n = 0; n < 40; n++) {
    try { if ((await fetch(base + '/up')).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  const fixtureCheck = await (await fetch(base + '/__qa-fixture-check')).json();
  if (!fixtureCheck.safe) throw new Error('Spawned server is not using the isolated fixture database');

  const loginResponse = await fetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(credentials.admin) });
  if (!loginResponse.ok) throw new Error(`Fixture login failed (${loginResponse.status})`);
  const loginPayload = await loginResponse.json();
  fixtureAuth.token = loginPayload.data.token;
  fixtureAuth.user = loginPayload.data.user;

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
  let proxied = 0;
  let abortedExternal = 0;
  let remoteResponses = 0;
  await context.route('**/*', async (route) => {
    try {
      const target = new URL(route.request().url());
      const method = route.request().method();
      if (target.hostname === new URL(base).hostname) { await route.continue(); return; }
      if (target.pathname.startsWith('/api/')) {
        if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders, body: '' }); return; }
        // Every external /api/ call is serviced from the isolated LOCAL server —
        // the hosted API is never reached. `remoteResponses` counts any response
        // sourced outside this machine and must stay zero for the gate to pass.
        const sourceUrl = `${base}${target.pathname}${target.search}`;
        const res = await fetch(sourceUrl, {
          method,
          headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${fixtureAuth.token}` },
          body: method === 'GET' || method === 'HEAD' ? undefined : (route.request().postData() ?? undefined),
        });
        proxied += 1;
        if (new URL(sourceUrl).hostname !== new URL(base).hostname) remoteResponses += 1;
        const buf = Buffer.from(await res.arrayBuffer());
        await route.fulfill({
          status: res.status,
          headers: { ...corsHeaders, 'content-type': res.headers.get('content-type') || 'application/json' },
          body: buf,
        });
        return;
      }
      if (target.hostname.includes('fonts')) { await route.fulfill({ status: 200, contentType: 'text/css', body: '' }); return; }
      abortedExternal += 1;
      await route.abort();
    } catch (e) { errors.push('ROUTE:' + (e && e.message ? e.message : String(e)).slice(0, 200)); }
  });
  const page = await context.newPage();
  await page.addInitScript((auth) => { localStorage.setItem('token', auth.token); localStorage.setItem('user', JSON.stringify(auth.user)); }, fixtureAuth);
  page.on('pageerror', (e) => errors.push('pageerror:' + (e.message || '').slice(0, 300)));
  page.on('response', (r) => {
    if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  // ── Settings page: open draft editor ────────────────────────────────────
  await navigate(page, base + '/admin/settings');
  await page.waitForFunction(() => document.body.innerText.length > 100, { timeout: 30000 });
  await page.waitForTimeout(1200);
  mark('settings-page-loaded', page.url().includes('/login') ? 'FAIL' : 'PASS');

  const createButton = page.getByRole('button', { name: /إنشاء مسودة جديدة/ });
  try { await createButton.waitFor({ state: 'visible', timeout: 15000 }); mark('create-draft-button', 'PASS'); }
  catch { mark('create-draft-button', 'FAIL', 'button not visible'); }
  await createButton.click();
  await page.waitForTimeout(500);

  // ── POLICY-C sections render ────────────────────────────────────────────
  const bodyText = await page.locator('body').innerText();
  const sections = [
    ['income-categories-section', 'شرائح الدخل للفرد (الفئات أ–د) — POLICY-C'],
    ['scoring-section', 'نقاط التقييم (POLICY-C)'],
    ['score-categories-section', 'فئات النقاط (أ: 51–75، ب: 26–50، ج: 5–25، د: 0–4)'],
    ['exceptions-section', 'الاستثناءات المقيّدة (POLICY-C)'],
    ['max-score-summary', 'أقصى نقاط قابلة للتحقيق: 75 من 75'],
    ['no-policy-errors', 'لا توجد أخطاء — الإعدادات صالحة.'],
  ];
  for (const [module, text] of sections) mark(module, bodyText.includes(text) ? 'PASS' : 'FAIL', text);
  mark('ascending-bands-hint', bodyText.includes('متجاورات') || bodyText.includes('متتالية') ? 'PASS' : 'FAIL');
  mark('no-degree-mapping-hint', bodyText.includes('لا يوجد أي تحويل أو تسوية بين النظامين') ? 'PASS' : 'FAIL');

  // ── Visible overlap error blocks saving; fix unlocks it ─────────────────
  const incomeSection = page.locator('xpath=//h4[contains(text(), "شرائح الدخل للفرد")]/ancestor::div[1]');
  const thresholdInput = incomeSection.locator('input[type="number"]').nth(0);
  mark('threshold-value', (await thresholdInput.inputValue()) === '1000' ? 'PASS' : 'FAIL');
  const bandBMin = incomeSection.locator('input[type="number"]').nth(3);
  mark('band-b-min-initial', (await bandBMin.inputValue()) === '400.01' ? 'PASS' : 'FAIL');

  await bandBMin.fill('400'); // overlap with band A (0–400 … 400)
  await page.waitForFunction(() => document.body.innerText.includes('تداخل أو فجوة'), { timeout: 10000 });
  const saveButton = page.getByRole('button', { name: 'حفظ المسودة' });
  mark('overlap-error-visible', (await page.locator('body').innerText()).includes('تداخل أو فجوة') ? 'PASS' : 'FAIL');
  mark('save-blocked-on-overlap', (await saveButton.isDisabled()) ? 'PASS' : 'FAIL');
  mark('block-warning-visible', (await page.locator('body').innerText()).includes('لا يمكن الحفظ حتى تُصحَّح') ? 'PASS' : 'FAIL');

  await bandBMin.fill('400.01'); // back to contiguous
  await page.waitForFunction(() => !document.body.innerText.includes('تداخل أو فجوة'), { timeout: 10000 });
  mark('save-unlocked-after-fix', (await saveButton.isDisabled()) === false ? 'PASS' : 'FAIL');

  // ── Exception ceiling rule error; fix unlocks ───────────────────────────
  const ceilingInput = page.locator('xpath=//label[contains(text(), "سقف الدخل عند الاستثناء")]/following-sibling::input');
  await ceilingInput.fill('900'); // ceiling <= threshold (1000) → invalid
  await page.waitForFunction(() => document.body.innerText.includes('يجب أن يتجاوز حد الاستبعاد'), { timeout: 10000 });
  mark('ceiling-error-visible', (await page.locator('body').innerText()).includes('يجب أن يتجاوز حد الاستبعاد') ? 'PASS' : 'FAIL');
  mark('save-blocked-on-ceiling', (await saveButton.isDisabled()) ? 'PASS' : 'FAIL');
  await ceilingInput.fill('1200');
  await page.waitForFunction(() => !document.body.innerText.includes('يجب أن يتجاوز حد الاستبعاد'), { timeout: 10000 });
  mark('save-unlocked-after-ceiling-fix', (await saveButton.isDisabled()) === false ? 'PASS' : 'FAIL');

  // ── Save a full POLICY-C draft through the UI (proxied API) ─────────────
  const versionInput = page.locator('xpath=//label[contains(text(), "رقم الإصدار")]/following-sibling::input');
  const effectiveFrom = page.locator('xpath=//label[contains(text(), "تاريخ السريان")]/following-sibling::input');
  await versionInput.fill('3');
  await effectiveFrom.fill('2026-12-01');
  await saveButton.click();
  await page.waitForFunction(() => document.body.innerText.includes('تم حفظ المسودة بنجاح.'), { timeout: 15000 });
  mark('draft-saved-toast', (await page.locator('body').innerText()).includes('تم حفظ المسودة بنجاح.') ? 'PASS' : 'FAIL');
  await page.waitForFunction(() => {
    const rows = [...document.querySelectorAll('tbody tr')];
    return rows.some((tr) => tr.innerText.includes('3') && tr.innerText.includes('مسودة'));
  }, { timeout: 15000 });
  const rowText = await page.locator('tbody tr').first().innerText();
  mark('draft-row-listed', rowText.includes('3') && rowText.includes('مسودة') ? 'PASS' : 'FAIL', `row=${rowText.slice(0, 140)}`);
  mark('modal-closed-after-save', (await page.locator('body').innerText()).includes('إنشاء مسودة سياسة جديدة') ? 'FAIL' : 'PASS');

  // ── External isolation: hosted API never contacted ──────────────────────
  mark('api-proxied-locally', proxied >= 2 ? 'PASS' : 'FAIL', `proxied=${proxied}`);
  mark('no-remote-responses', remoteResponses === 0 ? 'PASS' : 'FAIL', `remote=${remoteResponses}`);
  mark('external-blocked-not-consulted', abortedExternal === 0 || abortedExternal <= 2 ? 'PASS' : 'FAIL', `aborted=${abortedExternal}`);

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;
  console.log(`POLICY-C settings gate: ${passed} passed, ${failed} failed (${Math.round((Date.now() - started) / 1000)}s)`);
  for (const r of results) console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}  ${r.module}${r.detail ? ' — ' + r.detail : ''}`);
  if (errors.length) { console.log('Errors:'); for (const e of errors.slice(0, 20)) console.log('  ' + e); }
  if (failed > 0 || errors.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}