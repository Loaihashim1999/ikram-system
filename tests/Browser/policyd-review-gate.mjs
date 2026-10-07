// POLICY-D local browser recovery. Production code and assertions are not replaced by mocks.
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/policyd-recovery');
fs.mkdirSync(evidence, { recursive: true });
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = 'http://127.0.0.1:' + port;
const database = path.join(root, 'storage/app/reports', 'qa-isolated-policyd-' + randomUUID() + '.sqlite');
fs.mkdirSync(path.dirname(database), { recursive: true }); fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: 'base64:' + randomBytes(32).toString('base64'), DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', APP_URL: base, SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php'), VITE_API_URL: '/api' };
const results = [];
const errors = [];
let unexpectedRemote = 0;
let server;
let browser;
let requests = 0;
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log((condition ? 'PASS ' : 'FAIL ') + name); };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const localFetch = async (url, options = {}) => {
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Non-local harness fetch refused');
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
};
try {
  console.log('STAGE isolated build');
  const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/policyd-recovery/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 120000 });
  fs.writeFileSync(path.join(evidence, 'build.txt'), (build.stdout || '') + (build.stderr || ''));
  if (build.status !== 0) throw new Error('Local Vite build failed; see build.txt');
  // Fonts are presentation-only. Remove the external font import in this disposable
  // test build, rather than permitting/discounting outbound requests as POLICY-C did.
  for (const name of fs.readdirSync(path.join(evidence, 'build/assets'))) {
    if (!name.endsWith('.css')) continue;
    const file = path.join(evidence, 'build/assets', name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/@import\s*(?:url\(\s*)?(['"])https:\/\/fonts\.googleapis\.com[^'"]*\1\s*\)?\s*;/g, ''));
  }
  console.log('STAGE isolated fixture');
  const credentials = { admin: { username: 'TEST_policy_d', password: randomBytes(24).toString('hex') } };
  const fixture = spawnSync('php', ['tests/Browser/policyd-fixture.php'], { cwd: root, env, input: JSON.stringify(credentials), encoding: 'utf8', timeout: 120000 });
  if (fixture.status !== 0) throw new Error('SQLite fixture failed (credentials withheld)');
  const auth = JSON.parse(fixture.stdout);
  mark('fixture-contract', Boolean(auth.token && auth.user?.id));
  console.log('STAGE local PHP readiness');
  let serverError = '';
  server = spawn('php', ['-S', '127.0.0.1:' + port, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/policyd-server-router.php')], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', () => {});
  server.on('error', (error) => { serverError = error.code || 'startup error'; });
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (serverError || server.exitCode !== null) throw new Error('PHP startup failed: ' + (serverError || server.exitCode));
    try { if ((await localFetch(base + '/up')).ok) { ready = true; break; } } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  if (!ready) throw new Error('PHP readiness timed out');
  mark('php-ready', ready);
  const fixtureCheck = await (await localFetch(base + '/__qa-fixture-check')).json();
  if (!fixtureCheck.safe || fixtureCheck.users !== 2) throw new Error('Wrong isolated SQLite fixture');
  mark('isolated-sqlite', true);
  const login = await localFetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(credentials.admin) });
  if (!login.ok) throw new Error('Local login failed: ' + login.status);
  const payload = await login.json(); auth.token = payload.data.token; auth.user = payload.data.user;
  mark('local-login', true);
  console.log('STAGE Chromium browser');
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(target.hostname)) {
      unexpectedRemote++; await route.abort('blockedbyclient'); return;
    }
    if (target.origin !== base) { errors.push('Unexpected local origin'); await route.abort(); return; }
    if (target.pathname.startsWith('/api/')) {
      try {
        if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: cors }); return; }
        // POLICY-C's local fetch/fulfill mechanism, with no hosted-origin exception.
        const response = await localFetch(base + target.pathname + target.search, { method: request.method(), headers: { accept: 'application/json', 'content-type': 'application/json', ...(request.headers().authorization ? { authorization: request.headers().authorization } : {}) }, ...(request.method() === 'GET' || request.method() === 'HEAD' ? {} : { body: request.postData() || undefined }) });
        requests++;
        await route.fulfill({ status: response.status, headers: { ...cors, 'content-type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
      } catch { errors.push('Local API proxy failed'); await route.abort(); }
      return;
    }
    await route.continue();
  });
  await context.addInitScript((value) => { localStorage.setItem('token', value.token); localStorage.setItem('user', JSON.stringify(value.user)); }, auth);
  const page = await context.newPage();
  page.on('pageerror', () => errors.push('Browser JavaScript error'));
  const reviewPath = '/admin/beneficiary-policy/review/' + auth.evaluation;
  await page.goto(base + reviewPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('heading', { name: 'مراجعة سياسة المستفيد (POLICY-D)' }).waitFor();
  mark('isolated-stylesheet-loaded', await page.locator('main').evaluate((node) => getComputedStyle(node).paddingTop === '24px'));
  mark('real-review-route', new URL(page.url()).pathname === reviewPath);
  mark('real-beneficiary-loaded', await page.getByText('TEST POLICY D BENEFICIARY', { exact: true }).isVisible());
  mark('real-evaluation-loaded', (await page.locator('body').innerText()).includes(auth.evaluation));
  for (const [id, value] of Object.entries(auth.expected)) {
    const rendered = await page.getByTestId(id).innerText();
    mark(id, rendered === value);
  }
  mark('unresolved-reasons-visible', (await page.getByTestId('approval-blockers').innerText()).includes('HEAD_HEALTH_REVIEW_REQUIRED'));
  const clickResponse = async (label, suffix) => {
    const response = page.waitForResponse((r) => r.url().endsWith(suffix) && r.request().method() !== 'GET');
    await page.getByRole('button', { name: label, exact: true }).click();
    const result = await response;
    await page.getByRole('button', { name: label, exact: true }).isVisible().catch(() => false);
    // Wait until the application has finished reloading authoritative state.
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some((b) => b.disabled));
    return result.status();
  };
  await page.getByLabel('رمز السبب الثابت', { exact: true }).fill('DOCUMENTARY_EVIDENCE_COMPLETE');
  await page.getByLabel('شرح القرار', { exact: true }).fill('TEST complete documentary review');
  mark('approval-blocked-while-incomplete', await clickResponse('اعتماد القرار', '/approve') === 422);
  const doc = page.getByTestId('document-national_id');
  mark('document-missing-rendered', (await doc.innerText()).includes('مفقودة'));
  await page.getByLabel('مرجع national_id', { exact: true }).fill('TEST_NATIONAL_ID');
  await page.getByLabel('سبب رفض national_id', { exact: true }).fill('TEST unreadable');
  let response = page.waitForResponse((r) => r.url().endsWith('/documents/national_id') && r.request().method() === 'POST');
  await doc.getByRole('button', { name: 'رفض الوثيقة', exact: true }).click();
  mark('document-reject-real-api', (await response).status() === 200);
  await doc.getByText('مرفوضة', { exact: true }).waitFor();
  for (const code of ['family_record', 'national_id', 'electricity_bill', 'income_evidence']) {
    const row = page.getByTestId('document-' + code);
    await page.getByLabel('مرجع ' + code, { exact: true }).fill('TEST_EVIDENCE_' + code);
    response = page.waitForResponse((r) => r.url().endsWith('/documents/' + code) && r.request().method() === 'POST');
    await row.getByRole('button', { name: 'توثيق', exact: true }).click();
    mark('verify-' + code, (await response).status() === 200);
    await row.getByText('موثقة', { exact: true }).waitFor();
  }
  await page.getByLabel('نسبة الإعاقة', { exact: true }).fill('50');
  await page.getByLabel('مرجع الدليل الطبي', { exact: true }).fill('TEST_MEDICAL');
  mark('medical-evidence-real-api', await clickResponse('توثيق الدليل الطبي', '/medical-evidence') === 200);
  mark('medical-status-rendered', (await page.getByRole('region', { name: 'الدليل الطبي' }).innerText()).includes('50.00'));
  await page.getByLabel('حالة المسكن', { exact: true }).selectOption('poor');
  await page.getByLabel('منطقة الخدمة', { exact: true }).selectOption('verified_inside');
  await page.getByLabel('علاقة المؤجر', { exact: true }).selectOption('no_prohibited_relationship');
  await page.getByLabel('الأطفال المتأثرون', { exact: true }).fill('2');
  await page.getByLabel('تاريخ التقييم', { exact: true }).fill('2026-09-22');
  mark('social-draft-saved', await clickResponse('حفظ المسودة', '/social-assessment') === 200);
  mark('housing-persisted', await page.getByLabel('حالة المسكن', { exact: true }).inputValue() === 'poor');
  mark('service-area-persisted', await page.getByLabel('منطقة الخدمة', { exact: true }).inputValue() === 'verified_inside');
  mark('landlord-result-persisted', await page.getByLabel('علاقة المؤجر', { exact: true }).inputValue() === 'no_prohibited_relationship');
  mark('children-health-persisted', await page.getByLabel('الأطفال المتأثرون', { exact: true }).inputValue() === '2');
  mark('social-submit-real-api', await clickResponse('تقديم التقييم', '/social-assessment/submit') === 200);
  await page.getByLabel('توصية المراجعة', { exact: true }).selectOption('approve');
  mark('social-review-real-api', await clickResponse('إتمام المراجعة', '/social-assessment/review') === 200);
  mark('assessment-reviewed-rendered', (await page.getByTestId('assessment-state').innerText()).includes('تمت المراجعة'));
  mark('valid-fixture-approved', await clickResponse('اعتماد القرار', '/approve') === 200);
  await page.getByTestId('decision-state').getByText('تم الاعتماد', { exact: true }).waitFor();
  mark('decision-history-rendered', (await page.getByTestId('decision-history').innerText()).includes('DOCUMENTARY_EVIDENCE_COMPLETE'));
  await page.screenshot({ path: path.join(evidence, 'review-approved.png'), fullPage: true });
  await page.goto(base + '/admin/beneficiary-policy/review/' + auth.reject_evaluation);
  await page.getByRole('button', { name: 'رفض القرار', exact: true }).waitFor();
  mark('rejection-requires-stable-reason', await clickResponse('رفض القرار', '/reject') === 422);
  await page.getByLabel('رمز السبب الثابت', { exact: true }).fill('DOCUMENTARY_EVIDENCE_INSUFFICIENT');
  await page.getByLabel('شرح القرار', { exact: true }).fill('TEST missing documentary evidence');
  mark('rejection-real-api', await clickResponse('رفض القرار', '/reject') === 200);
  mark('rejection-history-rendered', (await page.getByTestId('decision-history').innerText()).includes('DOCUMENTARY_EVIDENCE_INSUFFICIENT'));
  // Switch actual authentication; outcomes still come from the local backend.
  await context.addInitScript((value) => { localStorage.setItem('token', value.token); localStorage.setItem('user', JSON.stringify(value.user)); }, auth.viewer);
  await page.goto(base + '/admin/beneficiary-policy/review/' + auth.pending_evaluation);
  await page.getByRole('heading', { name: 'مراجعة سياسة المستفيد (POLICY-D)' }).waitFor();
  mark('viewer-no-mutation-controls', await page.getByRole('button', { name: /اعتماد القرار|رفض القرار|توثيق|حفظ المسودة|إتمام المراجعة/ }).count() === 0);
  for (const suffix of ['/approve', '/reject', '/documents/national_id', '/social-assessment/submit', '/social-assessment/review']) {
    const denied = await localFetch(base + '/api/beneficiary-policy/evaluations/' + auth.pending_evaluation + suffix, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + auth.viewer.token }, body: '{}' });
    mark('viewer-forbidden-' + suffix, denied.status === 403);
  }
  await page.evaluate((value) => { localStorage.setItem('token', value.token); localStorage.setItem('user', JSON.stringify(value.user)); }, auth);
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(base + '/admin/beneficiary-policy/review/' + auth.pending_evaluation, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'مراجعة سياسة المستفيد (POLICY-D)' }).waitFor();
    const responsive = await page.evaluate(() => ({
      rtl: getComputedStyle(document.querySelector('main')).direction === 'rtl',
      noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      controlsReachable: Array.from(document.querySelectorAll('button,input,select')).some((node) => {
        const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0 && box.left < window.innerWidth && box.right > 0;
      }),
    }));
    mark('responsive-' + width, responsive.rtl && responsive.noPageOverflow && responsive.controlsReachable, JSON.stringify(responsive));
  }
  mark('api-proxied-locally', requests >= 2, 'requests=' + requests);
  mark('browser-errors', errors.length === 0);
} catch (error) {
  mark('execution', false, error.message);
} finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) {
    const exited = new Promise((resolve) => server.once('exit', resolve));
    server.kill();
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    if (server.exitCode === null && server.signalCode === null) throw new Error('Owned PHP process cleanup failed');
  }
}
mark('no-hosted-api-contact', unexpectedRemote === 0);
const summary = { total: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, unexpected_remote_requests: unexpectedRemote, errors, results };
fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(summary, null, 2));
for (const result of results) console.log((result.passed ? 'PASS ' : 'FAIL ') + result.name + (result.detail ? ': ' + result.detail : ''));
console.log('TOTAL = ' + summary.total + '\nPASSED = ' + summary.passed + '\nFAILED = ' + summary.failed + '\nUNEXPECTED_REMOTE_REQUESTS = ' + summary.unexpected_remote_requests);
if (summary.failed || errors.length || unexpectedRemote) process.exitCode = 1;
