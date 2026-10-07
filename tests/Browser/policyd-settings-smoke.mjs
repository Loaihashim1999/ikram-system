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
const mark = (name, condition, detail = '') => results.push({ name, passed: Boolean(condition), detail });
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
  const fixture = spawnSync('php', ['tests/Browser/audit-fixture.php'], { cwd: root, env, input: JSON.stringify(credentials), encoding: 'utf8', timeout: 120000 });
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
  if (!fixtureCheck.safe || fixtureCheck.users !== 1) throw new Error('Wrong isolated SQLite fixture');
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
  // App registers /admin/settings, not /admin/beneficiary-policy/settings.
  await page.goto(base + '/admin/settings', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('button', { name: /إنشاء مسودة جديدة/ }).waitFor();
  mark('authenticated-settings-route', new URL(page.url()).pathname === '/admin/settings');
  await page.getByRole('button', { name: /إنشاء مسودة جديدة/ }).click();
  const content = await page.locator('body').innerText();
  // Preserve the original assertion, and strengthen it with the exact document control.
  mark('policyd-settings-rendered', content.includes('استثناءات') || content.includes('وثائق') || content.includes('تقييم'));
  mark('document-review-setting', await page.getByText('مراجعة الوثائق المطلوبة', { exact: true }).isVisible());
  await page.screenshot({ path: path.join(evidence, 'settings.png'), fullPage: true });
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
