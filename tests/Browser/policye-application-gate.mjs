// POLICY-E5 local browser acceptance. Production code and assertions are not replaced by mocks.
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/policye-gate');
fs.mkdirSync(evidence, { recursive: true });
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = 'http://127.0.0.1:' + port;
const database = path.join(root, 'storage/app/reports', 'qa-isolated-policye-' + randomUUID() + '.sqlite');
fs.mkdirSync(path.dirname(database), { recursive: true }); fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: 'base64:' + randomBytes(32).toString('base64'), DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', APP_URL: base, SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php'), VITE_API_URL: '/api' };
const results = [];
const errors = [];
let unexpectedRemote = 0;
let requests = 0;
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log((condition ? 'PASS ' : 'FAIL ') + name); };
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
const localFetch = async (url, options = {}) => {
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Non-local harness fetch refused');
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
};
let server;
let browser;
try {
  console.log('STAGE isolated build');
  const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/policye-gate/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 120000 });
  fs.writeFileSync(path.join(evidence, 'build.txt'), (build.stdout || '') + (build.stderr || ''));
  if (build.status !== 0) throw new Error('Local Vite build failed; see build.txt');
  // Fonts are presentation-only. Remove the external font import in this disposable
  // test build, rather than permitting/discounting outbound requests.
  for (const name of fs.readdirSync(path.join(evidence, 'build/assets'))) {
    if (!name.endsWith('.css')) continue;
    const file = path.join(evidence, 'build/assets', name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/@import\s*(?:url\(\s*)?(['\"])https:\/\/fonts\.googleapis\.com[^'\"]*\1\s*\)?\s*;/g, ''));
  }
  console.log('STAGE isolated fixture');
  const credentials = { admin: { username: 'TEST_policy_e', password: randomBytes(24).toString('hex') }, apply: { username: 'TEST_policy_e_apply', password: randomBytes(24).toString('hex') } };
  const fixture = spawnSync('php', ['tests/Browser/policye-fixture.php'], { cwd: root, env, input: JSON.stringify(credentials), encoding: 'utf8', timeout: 120000 });
  if (fixture.status !== 0) throw new Error('SQLite fixture failed (credentials withheld): ' + (fixture.stderr || '').slice(0, 400));
  const auth = JSON.parse(fixture.stdout);
  mark('fixture-contract', Boolean(auth.token && auth.apply?.token && auth.versionId && auth.beneficiaryName));
  console.log('STAGE local PHP readiness');
  let serverError = '';
  server = spawn('php', ['-S', '127.0.0.1:' + port, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/policye-server-router.php')], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', (data) => { fs.appendFileSync(path.join(evidence, 'server-stderr.log'), data); });
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
  const login = await (await localFetch(base + '/api/login', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(credentials.admin) })).json();
  if (!login?.data?.token) throw new Error('Local login failed');
  auth.token = login.data.token; auth.user = login.data.user;
  mark('local-login', true);

  // E5 gate root-cause probe (harness-only diagnostics, never production logic):
  // the prior E5 run reached Chromium with 8 identical proxy aborts and no PHP
  // trace. Verify the exact localFetch/proxy shape against the real PHP server
  // before launching the browser so a mis-shaped request cannot hide as "CSS".
  const versionProbe = await localFetch(base + '/api/beneficiary-policy/versions/' + auth.versionId, {
    method: 'GET',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + auth.token },
  });
  const versionProbeBody = await versionProbe.text();
  if (versionProbe.status !== 200) throw new Error('Local version probe failed: HTTP ' + versionProbe.status + ' ' + versionProbeBody.slice(0, 200));
  const runsProbe = await localFetch(base + '/api/beneficiary-policy/versions/' + auth.versionId + '/application-runs', {
    method: 'GET',
    headers: { accept: 'application/json', 'content-type': 'application/json', authorization: 'Bearer ' + auth.token },
  });
  if (runsProbe.status !== 200) throw new Error('Local runs probe failed: HTTP ' + runsProbe.status + ' ' + (await runsProbe.text()).slice(0, 200));

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
        const response = await localFetch(base + target.pathname + target.search, { method: request.method(), headers: { accept: 'application/json', 'content-type': 'application/json', ...(request.headers().authorization ? { authorization: request.headers().authorization } : {}) }, ...(request.method() === 'GET' || request.method() === 'HEAD' ? {} : { body: request.postData() || undefined }) });
        requests++;
        await route.fulfill({ status: response.status, headers: { ...cors, 'content-type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
      } catch (error) { errors.push('Local API proxy failed: ' + String(error?.message || error).slice(0, 240)); await route.abort(); }
      return;
    }
    await route.continue();
  });
  const authScript = (value) => { localStorage.setItem('token', value.token); localStorage.setItem('user', JSON.stringify(value.user)); };
  await context.addInitScript(authScript, auth);
  const page = await context.newPage();
  page.on('pageerror', () => errors.push('Browser JavaScript error'));
  const runsPath = '/admin/beneficiary-policy/versions/' + auth.versionId + '/application-runs';
  await page.goto(base + runsPath, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const heading = page.getByRole('heading', { name: 'تطبيق نطاق السياسة (POLICY-E)' });
  await heading.waitFor();
  const stylesheetProbe = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets || []);
    const local = sheets.filter((sheet) => { try { return new URL(sheet.href || location.href, location.href).origin === location.origin; } catch { return false; } });
    let rules = 0;
    for (const sheet of local) { try { rules += sheet.cssRules?.length || 0; } catch {} }
    const main = document.querySelector('main');
    return { sheets: local.length, rules, paddingTop: main ? getComputedStyle(main).paddingTop : null };
  });
  mark('isolated-stylesheet-loaded', stylesheetProbe.rules > 0, JSON.stringify(stylesheetProbe));
  mark('real-runs-route', new URL(page.url()).pathname === runsPath);
  mark('empty-ledger-state', (await page.getByTestId('runs-empty').innerText()).includes('لا توجد محاكاة'));

  const clickAction = async (label, suffix) => {
    const response = page.waitForResponse((r) => r.url().includes(suffix) && r.request().method() !== 'GET');
    await page.getByRole('button', { name: label, exact: true }).click();
    const result = await response;
    await page.waitForFunction(() => !Array.from(document.querySelectorAll('button')).some((b) => b.disabled));
    return result;
  };

  // Run 1 — full lifecycle: create + simulate (read-only), approve, execute.
  const simulate1 = await clickAction('إنشاء محاكاة جديدة (قراءة فقط)', '/simulate');
  mark('create-simulate-real-api', simulate1.status() === 200);
  const run1 = (await simulate1.json()).data.id;
  mark('simulate-rendered-message', (await page.getByTestId('policye-message').innerText()).includes('تمت المحاكاة'));
  mark('simulated-row-rendered', (await page.getByTestId('run-status').innerText()).includes('تمت المحاكاة'));

  await page.getByRole('button', { name: 'تفاصيل ' + run1, exact: true }).click();
  await page.getByTestId('freshness').waitFor();
  mark('freshness-fresh', (await page.getByTestId('freshness').innerText()).includes('المحاكاة محدثة'));
  mark('simulation-summary-rendered', (await page.getByTestId('simulation-summary').innerText()).includes('محاكى: 1'));
  mark('items-rendered', (await page.getByTestId('items-body').innerText()).includes(auth.beneficiaryName));
  mark('no-evaluations-before-execution', !((await page.getByTestId('items-body').innerText()).match(/[0-9a-f]{8}-[0-9a-f]{4}/)));

  const approve1 = await clickAction('اعتماد للتنفيذ ' + run1, '/approve-application');
  mark('approve-real-api', approve1.status() === 200);
  mark('approved-status-rendered', (await page.getByTestId('detail-status').innerText()).includes('معتمد للتنفيذ'));

  const execute1 = await clickAction('تنفيذ ' + run1, '/execute');
  mark('execute-real-api', execute1.status() === 200);
  mark('completed-status-rendered', (await page.getByTestId('detail-status').innerText()).includes('مكتمل'));
  mark('execution-counters-rendered', (await page.getByTestId('run-counters').innerText()).includes('المرشحون: 1'));
  await page.screenshot({ path: path.join(evidence, 'run-completed.png'), fullPage: true });

  // Run 2 — approved, then proven against the 403 permission gate and the 409 staleness gate.
  const simulate2 = await clickAction('إنشاء محاكاة جديدة (قراءة فقط)', '/simulate');
  const run2 = (await simulate2.json()).data.id;
  mark('second-run-distinct', run2 !== run1);
  const approve2 = await clickAction('اعتماد للتنفيذ ' + run2, '/approve-application');
  mark('second-run-approved', approve2.status() === 200);

  // apply_scope-only user: the real backend must refuse execution (403) and the UI must render it.
  await context.addInitScript(authScript, auth.apply);
  await page.goto(base + runsPath, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'تطبيق نطاق السياسة (POLICY-E)' }).waitFor();
  await page.getByRole('button', { name: 'تفاصيل ' + run2, exact: true }).click();
  await page.getByTestId('freshness').waitFor();
  mark('unauthorized-execute-hidden', !(await page.getByRole('button', { name: 'تنفيذ ' + run2, exact: true }).count()));
  const forbidden = await localFetch(base + '/api/beneficiary-policy/application-runs/' + run2 + '/execute', { method: 'POST', headers: { accept: 'application/json', authorization: 'Bearer ' + auth.apply.token } });
  mark('apply-user-execute-forbidden', forbidden.status === 403);
  await page.screenshot({ path: path.join(evidence, 'forbidden.png'), fullPage: true });

  // Admin: a registration after approval drifts the reviewed candidate set.
  await context.addInitScript(authScript, auth);
  await page.goto(base + runsPath, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'تطبيق نطاق السياسة (POLICY-E)' }).waitFor();
  const stamp = String(Date.now());
  const drift = await localFetch(base + '/api/beneficiaries', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: 'Bearer ' + auth.token },
    body: JSON.stringify({ full_name: 'TEST POLICY E DRIFT', national_id: '9' + stamp.slice(-9), phone: '05' + stamp.slice(-8), beneficiary_type: 'citizen', city: 'صنعاء', district: 'حي الاختبار', street: 'شارع الاختبار', date_of_birth: '1990-05-05', family_status: 'poor', family_members_count: 3, housing_type: 'own', status: 'active', income_sources: ['salary'], monthly_salary: 700 }),
  });
  mark('post-approval-registration-accepted', drift.status === 201);

  await page.getByRole('button', { name: 'تفاصيل ' + run2, exact: true }).click();
  await page.getByTestId('freshness').waitFor();
  mark('freshness-turns-stale-after-drift', (await page.getByTestId('freshness').innerText()).includes('قديمة — SIMULATION_STALE'));
  const stale = page.waitForResponse((r) => r.url().includes('/execute') && r.request().method() !== 'GET');
  await page.getByRole('button', { name: 'تنفيذ ' + run2, exact: true }).click();
  mark('stale-execute-conflict-409', (await stale).status() === 409);
  mark('stable-conflict-code-rendered', (await page.getByTestId('policye-error').innerText()).includes('SIMULATION_STALE'));
  mark('approval-not-overridden', (await page.getByTestId('detail-status').innerText()).includes('معتمد للتنفيذ'));
  await page.screenshot({ path: path.join(evidence, 'stale-conflict.png'), fullPage: true });

  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(base + runsPath, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'تطبيق نطاق السياسة (POLICY-E)' }).waitFor();
    const createControl = page.getByRole('button', { name: 'إنشاء محاكاة جديدة (قراءة فقط)', exact: true });
    await createControl.scrollIntoViewIfNeeded();
    const responsive = await page.evaluate(() => ({
      rtl: getComputedStyle(document.querySelector('main')).direction === 'rtl',
      noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
    }));
    responsive.controlsReachable = await createControl.isVisible() && await createControl.isEnabled();
    mark('responsive-' + width, responsive.rtl && responsive.noPageOverflow && responsive.controlsReachable, JSON.stringify(responsive));
  }

  mark('api-proxied-locally', requests >= 8, 'requests=' + requests);
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
