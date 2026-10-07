import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

// FSA UI-closure gate: full user-facing closure — real login, create a daily
// beneficiary across the UI wizard, verify it in the unified list, logout,
// re-login, confirm the record persisted, then logout cleanly. All local.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/fsa/ui-closure-gate');
fs.mkdirSync(evidence, { recursive: true });
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-fsa-uiclosure-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true });
fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', APP_URL: base, SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php'), VITE_API_URL: '/api', COMMUNICATION_PROVIDER: 'fake', NIGHTWATCH_ENABLED: 'false', FSA_BUILD_DIR: path.join(evidence, 'build') };
const results = []; const errors = []; let unexpectedRemote = 0; let requests = 0;
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`); };
const localFetch = (url, options = {}) => { if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Non-local fetch refused'); return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); };
let server; let browser; let closing = false;
try {
  const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/fsa/ui-closure-gate/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 120000 });
  fs.writeFileSync(path.join(evidence, 'build.txt'), `${build.stdout || ''}${build.stderr || ''}`);
  if (build.status !== 0) throw new Error('Local Vite build failed');
  const credentials = { username: 'FSA_UISESSION_ADMIN', password: 'uiclosure-'.concat(randomBytes(12).toString('hex')) };
  const fixture = spawnSync('php', ['tests/Browser/fsa-closure-fixture.php'], { cwd: root, env, input: JSON.stringify(credentials), encoding: 'utf8', timeout: 120000 });
  if (fixture.status !== 0) throw new Error(`Fixture failed: ${(fixture.stderr || '').slice(0, 300)}`);
  const auth = JSON.parse(fixture.stdout); mark('fixture-contract', Boolean(auth.token && auth.user));
  server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/uiux-server-router.php')], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', (data) => fs.appendFileSync(path.join(evidence, 'server-stderr.log'), data.toString()));
  let ready = false; for (let i = 0; i < 60; i++) { try { if ((await localFetch(`${base}/up`)).ok) { ready = true; break; } } catch {} await new Promise((resolve) => setTimeout(resolve, 200)); }
  if (!ready) throw new Error('PHP readiness timed out');

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const request = route.request(); const target = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(target.hostname)) { unexpectedRemote++; await route.abort('blockedbyclient'); return; }
    if (target.origin !== base) { errors.push(`Unexpected origin: ${target.origin}`); await route.abort(); return; }
    if (!target.pathname.startsWith('/api/')) { await route.continue(); return; }
    try {
      const headers = { accept: '*/*', ...(request.headers().authorization ? { authorization: request.headers().authorization } : {}), ...(request.headers()['content-type'] ? { 'content-type': request.headers()['content-type'] } : {}) };
      const body = request.method() === 'POST' || request.method() === 'PUT' || request.method() === 'PATCH' ? await request.postDataBuffer() : undefined;
      let response; let lastError;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try { response = await localFetch(`${base}${target.pathname}${target.search}`, { method: request.method(), headers, body }); break; }
        catch (error) { lastError = error; if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 400)); }
      }
      if (!response && lastError?.name === 'AbortError') throw lastError;
      if (!response) throw lastError;
      requests++;
      await route.fulfill({ status: response.status, headers: { 'access-control-allow-origin': '*', 'content-type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
    } catch (error) { if (!closing) errors.push(String(error?.message || error)); await route.abort(); }
  });

  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  // ── 1. Real login ─────────────────────────────────────────────────────────
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByPlaceholder('أدخل اسم المستخدم').fill(credentials.username);
  await page.getByPlaceholder('••••••••').fill(credentials.password);
  await page.getByRole('button', { name: /تسجيل الدخول|دخول/ }).first().click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  mark('real-login', true, 'dashboard after real login');

  // ── 2. Create a daily beneficiary through the UI ──────────────────────────
  await page.goto(`${base}/daily-beneficiaries/add`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByText('تسجيل بيانات المستفيد اليومي').waitFor({ timeout: 30000 });
  const fullName = 'CLOSURE DAILY ' + randomUUID().slice(0, 8);
  const nationalId = '2' + String(Math.floor(100000000 + Math.random() * 899999999));
  await page.getByPlaceholder('مثال: إبراهيم سليمان منصور المنصور').fill(fullName);
  await page.getByPlaceholder('10 أرقام (يبدأ بـ 1 أو 2)').fill(nationalId);
  await page.getByPlaceholder('05xxxxxxxx').fill('0500000001');
  await page.getByPlaceholder('اختر أو اكتب اسم الحي...').fill('حي الإغلاق');
  await page.getByRole('button', { name: 'تسجيل المستفيد' }).click();
  await page.waitForTimeout(1500);
  const createdInDB = await localFetch(`${base}/api/daily-beneficiaries?search=${encodeURIComponent(fullName)}`, { headers: { authorization: `Bearer ${auth.token}`, accept: 'application/json' } });
  const createdBody = await createdInDB.json();
  const createdCount = Array.isArray(createdBody.data) ? createdBody.data.length : (createdBody.data?.data?.length ?? 0);
  mark('daily-beneficiary-created', createdCount >= 1, `created record found in API (count=${createdCount})`);

  // ── 3. Logout ─────────────────────────────────────────────────────────────
  await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('heading', { name: 'أقسام وعمليات النظام' }).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /FSA CLOSURE ADMIN/ }).click();
  await page.getByText('تسجيل الخروج', { exact: false }).click();
  await page.waitForURL('**/login', { timeout: 30000 });
  mark('logout-to-login', true, 'logout returns to login');
  const removedToken = await page.evaluate(() => localStorage.getItem('token'));
  mark('logout-clears-token', removedToken === null, 'token cleared on logout');

  // ── 4. Re-login and confirm persistence ───────────────────────────────────
  await page.getByPlaceholder('أدخل اسم المستخدم').fill(credentials.username);
  await page.getByPlaceholder('••••••••').fill(credentials.password);
  await page.getByRole('button', { name: /تسجيل الدخول|دخول/ }).first().click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });
  const afterRelogin = await localFetch(`${base}/api/daily-beneficiaries?search=${encodeURIComponent(fullName)}`, { headers: { authorization: `Bearer ${auth.token}`, accept: 'application/json' } });
  const reloginBody = await afterRelogin.json();
  const reloginCount = Array.isArray(reloginBody.data) ? reloginBody.data.length : (reloginBody.data?.data?.length ?? 0);
  mark('persistence-across-relogin', reloginCount >= 1, `record still present after re-login (count=${reloginCount})`);

  // ── 5. Session closes cleanly ─────────────────────────────────────────────
  await page.getByRole('button', { name: /FSA CLOSURE ADMIN/ }).click();
  await page.getByText('تسجيل الخروج', { exact: false }).click();
  await page.waitForURL('**/login', { timeout: 30000 });
  mark('final-logout', true, 'clean final logout');
  mark('browser-errors-none', errors.length === 0, errors.join('; '));
} catch (error) { mark('execution', false, error.message); }
finally { closing = true; if (browser) await browser.close(); if (server && server.exitCode === null) { server.kill(); await new Promise((resolve) => setTimeout(resolve, 300)); } }
mark('no-hosted-api-contact', unexpectedRemote === 0);
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, unexpected_remote_requests: unexpectedRemote, errors, results };
fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(summary, null, 2));
console.log(`TOTAL = ${summary.total}\nPASSED = ${summary.passed}\nFAILED = ${summary.failed}\nUNEXPECTED_REMOTE_REQUESTS = ${summary.unexpected_remote_requests}`);
process.reallyExit(summary.failed || errors.length || unexpectedRemote ? 1 : 0);