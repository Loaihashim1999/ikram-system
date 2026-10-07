import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/uiux-gate');
fs.mkdirSync(evidence, { recursive: true });
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-policyf-uiux-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true });
fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', APP_URL: base, SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php'), VITE_API_URL: '/api' };
const results = []; const errors = []; let unexpectedRemote = 0; let requests = 0;
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`); };
const localFetch = (url, options = {}) => { if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Non-local fetch refused'); return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); };
let server; let browser; let closing = false;
try {
  const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/uiux-gate/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 120000 });
  fs.writeFileSync(path.join(evidence, 'build.txt'), `${build.stdout || ''}${build.stderr || ''}`);
  if (build.status !== 0) throw new Error('Local Vite build failed');
  const credentials = { username: 'TEST_uiux', password: randomBytes(24).toString('hex') };
  const fixture = spawnSync('php', ['tests/Browser/policyf-fixture.php'], { cwd: root, env, input: JSON.stringify(credentials), encoding: 'utf8', timeout: 120000 });
  if (fixture.status !== 0) throw new Error(`Fixture failed: ${(fixture.stderr || '').slice(0, 300)}`);
  const auth = JSON.parse(fixture.stdout); mark('fixture-contract', Boolean(auth.token && auth.user));
  server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/uiux-server-router.php')], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', (data) => fs.appendFileSync(path.join(evidence, 'server-stderr.log'), data));
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
      const response = await localFetch(`${base}${target.pathname}${target.search}`, { method: request.method(), headers: { accept: '*/*', ...(request.headers().authorization ? { authorization: request.headers().authorization } : {}) } });
      requests++;
      await route.fulfill({ status: response.status, headers: { 'access-control-allow-origin': '*', 'content-type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
    } catch (error) { if (!closing) errors.push(String(error?.message || error)); await route.abort(); }
  });
  await context.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, auth);
  const permanentResponse = await localFetch(`${base}/api/beneficiaries/unified?tab=permanent&per_page=1`, { headers: { authorization: `Bearer ${auth.token}` } });
  const dailyResponse = await localFetch(`${base}/api/beneficiaries/unified?tab=daily&per_page=1`, { headers: { authorization: `Bearer ${auth.token}` } });
  const permanentId = (await permanentResponse.json()).data.data[0].id;
  const dailyId = (await dailyResponse.json()).data.data[0].id;
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  const routes = [
    ['/beneficiaries', 'قائمة المستفيدين الموحدة', 'beneficiaries-all'],
    [`/beneficiaries/${permanentId}`, /بطاقة بيانات المستفيد:/, 'beneficiary-details'],
    ['/beneficiaries/add-citizen', 'تسجيل مستفيد مواطن جديد', 'beneficiary-registration'],
    ['/daily-beneficiaries', 'منظومة المستفيدين اليوميين الموحدة', 'daily-module'],
    [`/daily-beneficiaries/${dailyId}`, /ملف المستفيد:/, 'daily-details'],
    ['/daily-beneficiaries/add', 'إضافة مستفيد يومي جديد', 'daily-registration'],
    ['/support-delivery', 'تسليم الدعم وتكليف السائق', 'support-delivery'],
    ['/delivery', 'تسليم الدعم وتكليف السائق', 'delivery-route'],
    ['/governance', 'منظومة الحوكمة والتحليلات الشاملة', 'governance'],
    ['/admin/users', 'إدارة الحسابات ومصفوفة الصلاحيات', 'accounts'],
    ['/admin/settings', 'إعدادات النظام وضوابط التصنيف المالي والمستودع', 'settings'],
    ['/representatives', 'إدارة الجهات المستفيدة والشريكة', 'organizations'],
    ['/staff', 'إدارة وقوائم موظفي الجمعية', 'staff'],
  ];
  for (const [route, heading, name] of routes) {
    await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('heading', { name: heading }).first().waitFor({ timeout: 30000 });
    const state = await page.evaluate(() => ({ rtl: getComputedStyle(document.querySelector('main')).direction === 'rtl', noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1, hasFocusTarget: Boolean(document.querySelector('button, a, input, select, textarea')) }));
    mark(`page-${name}`, state.rtl && state.noOverflow && state.hasFocusTarget, JSON.stringify(state));
  }
  for (const width of [360, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${base}/beneficiaries/add-citizen`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'تسجيل مستفيد مواطن جديد' }).waitFor();
    const state = await page.evaluate(() => ({ noOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1, controlsFit: Array.from(document.querySelectorAll('main input, main select, main button')).filter((node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; }).every((node) => { const rect = node.getBoundingClientRect(); return rect.left >= -1 && rect.right <= window.innerWidth + 1; }) }));
    mark(`registration-responsive-${width}`, state.noOverflow && state.controlsFit, JSON.stringify(state));
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/admin/users`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: path.join(evidence, 'accounts-1440.png'), fullPage: true });
  mark('api-proxied-locally', requests >= 15, `requests=${requests}`);
  mark('browser-errors', errors.length === 0, errors.join('; '));
} catch (error) { mark('execution', false, error.message); }
finally { closing = true; if (browser) await browser.close(); if (server && server.exitCode === null) { server.kill(); await new Promise((resolve) => setTimeout(resolve, 300)); } }
mark('no-hosted-api-contact', unexpectedRemote === 0);
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, unexpected_remote_requests: unexpectedRemote, errors, results };
fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(summary, null, 2));
console.log(`TOTAL = ${summary.total}\nPASSED = ${summary.passed}\nFAILED = ${summary.failed}\nUNEXPECTED_REMOTE_REQUESTS = ${summary.unexpected_remote_requests}`);
const exitCode = summary.failed || errors.length || unexpectedRemote ? 1 : 0;
process.reallyExit(exitCode);
