import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

// FSA HTTP-Error-UX gate: unknown client routes redirect without a crash, API
// 401 auto sign-out is graceful, and no unhandled browser/page errors or
// unexpected remote requests occur across error surfaces. All local.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/fsa/http-error-ux-gate');
fs.mkdirSync(evidence, { recursive: true });
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-fsa-httpux-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true });
fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', APP_URL: base, SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php'), VITE_API_URL: '/api', COMMUNICATION_PROVIDER: 'fake', NIGHTWATCH_ENABLED: 'false', FSA_BUILD_DIR: path.join(evidence, 'build') };
const results = []; const errors = []; let unexpectedRemote = 0; let requests = 0; let staleFlowStarted = false;
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`); };
const localFetch = (url, options = {}) => { if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Non-local fetch refused'); return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(30000) }); };
let server; let browser; let closing = false;
try {
  const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/fsa/http-error-ux-gate/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 120000 });
  fs.writeFileSync(path.join(evidence, 'build.txt'), `${build.stdout || ''}${build.stderr || ''}`);
  if (build.status !== 0) throw new Error('Local Vite build failed');
  const credentials = { username: 'FSA_HTTPUX_ADMIN', password: 'httpux-'.concat(randomBytes(12).toString('hex')) };
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
      fs.appendFileSync(path.join(evidence, 'api-calls.log'), `${new Date().toISOString()} ${request.method()} ${target.pathname}${target.search} -> ${response.status}\n`);
      // Any 401 before the deliberate stale-token scenario is an unexpected
      // authorization failure and must fail the gate.
      if (response.status === 401 && !staleFlowStarted) errors.push(`api:401:${request.method()} ${target.pathname}`);
      await route.fulfill({ status: response.status, headers: { 'access-control-allow-origin': '*', 'content-type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
    } catch (error) { if (!closing) errors.push(String(error?.message || error)); await route.abort(); }
  });
  await context.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, auth);

  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(`pageerror:${error.message}`));
  // 401 resource-load logs are the deliberate stale-token signout assertion below,
  // not defects; any OTHER console error still fails browser-errors-none.
  page.on('console', (message) => { if (message.type() === 'error' && !/status of 401 \(/.test(message.text())) errors.push(`console:${message.text().slice(0, 200)}`); });

  // Unknown client route with a session -> must land somewhere app-owned, not a crash.
  await page.goto(`${base}/no-such-route-xyz`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);
  const unknownUrl = new URL(page.url()).pathname;
  mark('unknown-route-redirects', ['/dashboard', '/login', '/receiver', '/delivery'].includes(unknownUrl), `unknown route landed on ${unknownUrl}`);
  mark('unknown-route-no-crash', !(await page.content()).includes('Cannot read') && !(await page.content()).includes('Uncaught'), 'no raw crash text');

  // 401 on the notifications feed must auto sign-out to /login without a white screen.
  const token = auth.token;
  const page2 = await context.newPage(); page2.on('pageerror', (error) => errors.push(`page2:${error.message}`));
  staleFlowStarted = true;
  await page2.addInitScript(() => { const t = localStorage.getItem('token'); localStorage.setItem('token', 'stale-invalid-token-value'); });
  await page2.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page2.waitForURL('**/login', { timeout: 30000 });
  mark('stale-401-signout-to-login', true, 'invalid token auto signed out to /login');

  // A nonexistent API resource returns a controlled 404 JSON, and the page still renders.
  const notFound = await localFetch(`${base}/api/beneficiaries/not-a-real-id-123`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  mark('api-404-controlled', notFound.status === 404, `not-found endpoint returned ${notFound.status}`);
  const forbidden = await localFetch(`${base}/api/users`, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  mark('api-admin-only-200', forbidden.status === 200, `admin /api/users returned ${forbidden.status}`);
  mark('browser-errors-none', errors.length === 0, errors.join('; '));
} catch (error) { mark('execution', false, error.message); }
finally { closing = true; if (browser) await browser.close(); if (server && server.exitCode === null) { server.kill(); await new Promise((resolve) => setTimeout(resolve, 300)); } }
mark('no-hosted-api-contact', unexpectedRemote === 0);
const summary = { total: results.length, passed: results.filter((item) => item.passed).length, failed: results.filter((item) => !item.passed).length, unexpected_remote_requests: unexpectedRemote, errors, results };
fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(summary, null, 2));
console.log(`TOTAL = ${summary.total}\nPASSED = ${summary.passed}\nFAILED = ${summary.failed}\nUNEXPECTED_REMOTE_REQUESTS = ${summary.unexpected_remote_requests}`);
process.reallyExit(summary.failed || errors.length || unexpectedRemote ? 1 : 0);