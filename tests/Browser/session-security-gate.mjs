import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

// FSA Session-Security gate: multi-tab session continuity and stale-session
// auto sign-out. Real login, two tabs in one context, server-side token
// revocation, then the stale tab must be refused by the API and redirected to
// the login page with its token cleared. Everything stays on 127.0.0.1.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/fsa/session-security-gate');
fs.mkdirSync(evidence, { recursive: true });
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-fsa-session-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true });
fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', APP_URL: base, SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php'), VITE_API_URL: '/api', COMMUNICATION_PROVIDER: 'fake', NIGHTWATCH_ENABLED: 'false', FSA_BUILD_DIR: path.join(evidence, 'build') };
const results = []; const errors = []; let unexpectedRemote = 0; let requests = 0;
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`); };
const localFetch = (url, options = {}) => { if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Non-local fetch refused'); return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); };
let server; let browser; let closing = false;
try {
  const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/fsa/session-security-gate/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 120000 });
  fs.writeFileSync(path.join(evidence, 'build.txt'), `${build.stdout || ''}${build.stderr || ''}`);
  if (build.status !== 0) throw new Error('Local Vite build failed');
  const credentials = { username: 'FSA_SESSION_ADMIN', password: 'session-pass-'.concat(randomBytes(12).toString('hex')) };
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

  // Tab A: real UI login with the fixture credentials.
  const tabA = await context.newPage(); tabA.on('pageerror', (error) => errors.push(`tabA:${error.message}`));
  await tabA.goto(`${base}/login`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await tabA.getByPlaceholder('أدخل اسم المستخدم').fill(credentials.username);
  await tabA.getByPlaceholder('••••••••').fill(credentials.password);
  await tabA.getByRole('button', { name: /تسجيل الدخول|دخول/ }).first().click();
  await tabA.waitForURL('**/dashboard', { timeout: 30000 });
  await tabA.getByRole('heading', { name: 'أقسام وعمليات النظام' }).waitFor({ timeout: 15000 });
  mark('login-dashboard', true, 'authenticated dashboard rendered after real login');
  const tabATokenBefore = await tabA.evaluate(() => localStorage.getItem('token'));
  const meCheck = await localFetch(`${base}/api/me`, { headers: { authorization: `Bearer ${tabATokenBefore}`, accept: 'application/json' } });
  mark('tab-a-token-valid-session', Boolean(tabATokenBefore) && meCheck.status === 200, `token after real login is a live session (${meCheck.status})`);

  // Tab B: same context -> same storage -> same session, must fully work.
  const tabB = await context.newPage(); tabB.on('pageerror', (error) => errors.push(`tabB:${error.message}`));
  await tabB.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await tabB.getByRole('heading', { name: 'أقسام وعمليات النظام' }).waitFor({ timeout: 30000 });
  mark('tab-b-shared-session', (await tabB.evaluate(() => localStorage.getItem('token'))) === tabATokenBefore, 'second tab shares the session token');

  // Server-side revocation: logout from tab A (open profile menu, then logout) invalidates the token for both tabs.
  await tabA.getByRole('button', { name: /FSA CLOSURE ADMIN/ }).click();
  await tabA.getByText('تسجيل الخروج', { exact: false }).click();
  await tabA.waitForURL('**/login', { timeout: 30000 });
  const tabATokenAfter = await tabA.evaluate(() => localStorage.getItem('token'));
  mark('tab-a-logout-clears-token', tabATokenAfter === null, 'tab A token cleared after logout');

  // Tab B holds the now-stale token; its next request must be refused (401) and the UI must redirect to /login.
  await tabB.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
  await tabB.waitForURL('**/login', { timeout: 30000 });
  const staleStatus = await localFetch(`${base}/api/me`, { headers: { authorization: `Bearer ${tabATokenBefore}`, accept: 'application/json' } });
  mark('stale-token-api-401', staleStatus.status === 401, `stale session token rejected with ${staleStatus.status}`);
  const tabBTokenAfter = await tabB.evaluate(() => localStorage.getItem('token'));
  mark('stale-tab-signed-out', tabBTokenAfter === null, 'stale second tab auto signed out');
} catch (error) { mark('execution', false, error.message); }
finally { closing = true; if (browser) await browser.close(); if (server && server.exitCode === null) { server.kill(); await new Promise((resolve) => setTimeout(resolve, 300)); } }
mark('no-hosted-api-contact', unexpectedRemote === 0);
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, unexpected_remote_requests: unexpectedRemote, errors, results };
fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(summary, null, 2));
console.log(`TOTAL = ${summary.total}\nPASSED = ${summary.passed}\nFAILED = ${summary.failed}\nUNEXPECTED_REMOTE_REQUESTS = ${summary.unexpected_remote_requests}`);
process.reallyExit(summary.failed || errors.length || unexpectedRemote ? 1 : 0);