// tests/Browser/policyb-settings-gate.mjs
// POLICY-B browser acceptance gate: the financial settings UI (rent safe mode +
// eligibility review gates + draft-only warning) renders, is interactive, and the
// users permission matrix exposes the granular `evaluate` action.
// Self-contained: isolated SQLite fixture + spawned PHP server + headless Chromium.
process.on('unhandledRejection', () => { console.error('Browser runner asynchronous failure (details suppressed)'); process.exitCode = 1; });
const started = new Date();
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const port = 18000 + Math.floor(Math.random() * 1000);
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

  // The production build points VITE_API_URL at the hosted API; proxy every
  // /api/ call through Node to the isolated server (protocol-safe fulfill) and
  // block/neutralize all other external traffic.
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const corsHeaders = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };
  await context.route('**/*', async (route) => {
    try {
      const target = new URL(route.request().url());
      const method = route.request().method();
      if (target.hostname === new URL(base).hostname) { await route.continue(); return; }
      if (target.pathname.startsWith('/api/')) {
        if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: corsHeaders, body: '' }); return; }
        const res = await fetch(`${base}${target.pathname}${target.search}`, {
          method,
          headers: { accept: 'application/json', 'content-type': 'application/json', authorization: `Bearer ${fixtureAuth.token}` },
          body: method === 'GET' || method === 'HEAD' ? undefined : (route.request().postData() ?? undefined),
        });
        const buf = Buffer.from(await res.arrayBuffer());
        await route.fulfill({
          status: res.status,
          headers: { ...corsHeaders, 'content-type': res.headers.get('content-type') || 'application/json' },
          body: buf,
        });
        return;
      }
      if (target.hostname.includes('fonts')) { await route.fulfill({ status: 200, contentType: 'text/css', body: '' }); return; }
      await route.abort();
    } catch (e) { errors.push('ROUTE:' + (e && e.message ? e.message : String(e)).slice(0, 200)); }
  });
  const page = await context.newPage();
  await page.addInitScript((auth) => { localStorage.setItem('token', auth.token); localStorage.setItem('user', JSON.stringify(auth.user)); }, fixtureAuth);
  page.on('pageerror', (e) => errors.push('pageerror:' + (e.message || '').slice(0, 300)));
  page.on('response', (r) => {
    if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });

  // ── Settings page: POLICY-B draft form must render & be interactive ──────
  await navigate(page, base + '/admin/settings');
  await page.waitForFunction(() => document.body.innerText.length > 100, { timeout: 30000 });
  await page.waitForTimeout(1200);
  mark('settings-page-loaded', page.url().includes('/login') ? 'FAIL' : 'PASS');

  const createButton = page.getByRole('button', { name: /إنشاء مسودة جديدة/ });
  try { await createButton.waitFor({ state: 'visible', timeout: 15000 }); mark('create-draft-button', 'PASS'); }
  catch { mark('create-draft-button', 'FAIL', 'button not visible'); }
  await createButton.click();
  await page.waitForTimeout(400);

  const rentSelect = page.locator('select:has(option[value="direct_monthly_preference"])');
  mark('rent-mode-options', (await rentSelect.locator('option[value="annual_preference"]').count()) >= 1 ? 'PASS' : 'FAIL');

  await rentSelect.selectOption('direct_monthly_preference');
  const rentValue = await rentSelect.inputValue();
  mark('rent-mode-interactive', rentValue === 'direct_monthly_preference' ? 'PASS' : 'FAIL', `value=${rentValue}`);

  const modalText = await page.locator('body').innerText();
  mark('review-gate-renders', modalText.includes('مراجعة الوثائق المطلوبة') ? 'PASS' : 'FAIL');
  mark('draft-only-warning', modalText.includes('تؤثر على هذه المسودة فقط') ? 'PASS' : 'FAIL');

  const gate = page.locator('label:has(input[type="checkbox"])').first().locator('input[type="checkbox"]');
  const initiallyChecked = (await gate.isChecked()) === true;
  await gate.uncheck();
  const afterUncheck = (await gate.isChecked()) === false;
  mark('review-gate-interactive', initiallyChecked && afterUncheck ? 'PASS' : 'FAIL', `initial=${initiallyChecked} after=${afterUncheck}`);

  // ── Users page: edit dialog exposes the granular `evaluate` action ──────
  await navigate(page, base + '/admin/users');
  await page.waitForFunction(() => document.body.innerText.length > 100, { timeout: 30000 });
  await page.waitForTimeout(800);
  const editBtn = page.locator('button[title="تعديل الحساب وتخصيص الصلاحيات"]').first();
  await editBtn.waitFor({ state: 'visible', timeout: 15000 });
  await editBtn.click();
  await page.waitForTimeout(500);
  const dialogText = await page.locator('body').innerText();
  mark('users-evaluate-column', dialogText.includes('تقييم مالي') ? 'PASS' : 'FAIL');

  // ── Verdict ──────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.length - passed;
  console.log(`POLICY-B settings gate: ${passed} passed, ${failed} failed (${Math.round((Date.now() - started) / 1000)}s)`);
  for (const r of results) console.log(`  ${r.status === 'PASS' ? 'PASS' : 'FAIL'}  ${r.module}${r.detail ? ' — ' + r.detail : ''}`);
  if (errors.length) { console.log('Errors:'); for (const e of errors.slice(0, 20)) console.log('  ' + e); }
  if (failed > 0 || errors.length) process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
}