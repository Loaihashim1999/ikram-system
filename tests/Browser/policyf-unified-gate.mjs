import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/policyf-gate');
fs.mkdirSync(evidence, { recursive: true });
const probe = net.createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-policyf-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true }); fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${randomBytes(32).toString('base64')}`, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', MAIL_MAILER: 'array', LOG_CHANNEL: 'null', APP_URL: base, SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php'), VITE_API_URL: '/api' };
const results = []; const errors = []; let unexpectedRemote = 0; let requests = 0;
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}`); };
const localFetch = (url, options = {}) => {
  if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) throw new Error('Non-local harness fetch refused');
  return fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) });
};
let server; let browser;
try {
  const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/policyf-gate/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 120000 });
  fs.writeFileSync(path.join(evidence, 'build.txt'), `${build.stdout || ''}${build.stderr || ''}`);
  if (build.status !== 0) throw new Error('Local Vite build failed');
  for (const name of fs.readdirSync(path.join(evidence, 'build/assets'))) {
    if (!name.endsWith('.css')) continue;
    const file = path.join(evidence, 'build/assets', name);
    fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/@import\s*(?:url\(\s*)?(['"])https:\/\/fonts\.googleapis\.com[^'"]*\1\s*\)?\s*;/g, ''));
  }
  const credentials = { username: 'TEST_policy_f', password: randomBytes(24).toString('hex') };
  const fixture = spawnSync('php', ['tests/Browser/policyf-fixture.php'], { cwd: root, env, input: JSON.stringify(credentials), encoding: 'utf8', timeout: 120000 });
  if (fixture.status !== 0) throw new Error(`SQLite fixture failed: ${(fixture.stderr || '').slice(0, 300)}`);
  const auth = JSON.parse(fixture.stdout);
  mark('fixture-contract', Boolean(auth.token && auth.user));
  server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/policyf-server-router.php')], { cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'] });
  server.stderr.on('data', (data) => fs.appendFileSync(path.join(evidence, 'server-stderr.log'), data));
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await localFetch(`${base}/up`)).ok) { ready = true; break; } } catch {} await new Promise((r) => setTimeout(r, 200)); }
  if (!ready) throw new Error('PHP readiness timed out');
  mark('local-server-ready', true);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', acceptDownloads: true });
  await context.route('**/*', async (route) => {
    const request = route.request(); const target = new URL(request.url());
    if (!['localhost', '127.0.0.1'].includes(target.hostname)) { unexpectedRemote++; await route.abort('blockedbyclient'); return; }
    if (target.origin !== base) { errors.push('Unexpected local origin'); await route.abort(); return; }
    if (!target.pathname.startsWith('/api/')) { await route.continue(); return; }
    try {
      const response = await localFetch(`${base}${target.pathname}${target.search}`, { method: request.method(), headers: { accept: '*/*', ...(request.headers().authorization ? { authorization: request.headers().authorization } : {}) } });
      requests++;
      const headers = { 'access-control-allow-origin': '*', 'content-type': response.headers.get('content-type') || 'application/json' };
      if (response.headers.get('content-disposition')) headers['content-disposition'] = response.headers.get('content-disposition');
      await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
    } catch (error) { errors.push(String(error?.message || error)); await route.abort(); }
  });
  await context.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, auth);
  const page = await context.newPage(); page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${base}/beneficiaries`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.getByRole('heading', { name: 'قائمة المستفيدين الموحدة' }).waitFor();
  await page.getByText('إجمالي المطابق: 32').waitFor();
  mark('real-unified-list', (await page.getByText('إجمالي المطابق: 32').count()) === 1);
  await page.getByLabel('بحث').fill('DAILY BROWSER');
  await page.getByText('إجمالي المطابق: 2').waitFor();
  mark('all-tab-includes-daily-domain', (await page.getByTestId('unified-row').count()) === 2 && (await page.locator('tbody').innerText()).includes('يومي'));
  await page.getByLabel('بحث').fill('');
  await page.getByText('إجمالي المطابق: 32').waitFor();

  await page.getByTestId('tab-permanent').click();
  await page.getByText('إجمالي المطابق: 30').waitFor();
  mark('permanent-tab-isolated', !(await page.locator('tbody').innerText()).includes('يومي'));
  const secondPageResponse = page.waitForResponse((r) => r.url().includes('/beneficiaries/unified') && r.url().includes('page=2'));
  await page.getByRole('button', { name: 'التالي' }).click();
  await page.getByText('صفحة 2 من 2').waitFor();
  mark('pagination-server-driven', new URL((await secondPageResponse).url()).searchParams.get('page') === '2');

  await page.getByTestId('tab-daily').click();
  await page.getByText('إجمالي المطابق: 2').waitFor();
  mark('daily-tab-isolated', (await page.getByTestId('unified-row').count()) === 2 && !(await page.locator('tbody').innerText()).includes('دائم'));
  await page.getByLabel('الحي').fill('North');
  await page.getByText('إجمالي المطابق: 1').waitFor();
  mark('server-column-filter', (await page.locator('tbody').innerText()).includes('DAILY BROWSER ALPHA') && !(await page.locator('tbody').innerText()).includes('BETA'));

  const exportResponse = page.waitForResponse((r) => r.url().includes('/beneficiaries/unified/export'));
  const download = page.waitForEvent('download');
  await page.getByTestId('unified-export').click();
  mark('export-trigger-real-api', (await exportResponse).status() === 200 && (await download).suggestedFilename().endsWith('.xlsx'));
  await page.screenshot({ path: path.join(evidence, 'unified-beneficiaries.png'), fullPage: true });
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${base}/beneficiaries`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'قائمة المستفيدين الموحدة' }).waitFor();
    await page.getByText('إجمالي المطابق: 32').waitFor();
    const responsive = await page.evaluate(() => ({
      rtl: getComputedStyle(document.querySelector('main')).direction === 'rtl',
      noPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      filtersUsable: document.querySelector('[aria-label="بحث"]')?.getBoundingClientRect().width > 0,
      paginationReachable: Array.from(document.querySelectorAll('button')).some((button) => button.textContent?.includes('التالي') && button.getBoundingClientRect().left < window.innerWidth),
    }));
    mark(`responsive-${width}`, responsive.rtl && responsive.noPageOverflow && responsive.filtersUsable && responsive.paginationReachable, JSON.stringify(responsive));
  }
  mark('api-proxied-locally', requests >= 7, `requests=${requests}`);
  mark('browser-errors', errors.length === 0, errors.join('; '));
} catch (error) { mark('execution', false, error.message); }
finally {
  if (browser) await browser.close();
  if (server && server.exitCode === null) { server.kill(); await new Promise((resolve) => setTimeout(resolve, 300)); }
}
mark('no-hosted-api-contact', unexpectedRemote === 0);
const summary = { total: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, unexpected_remote_requests: unexpectedRemote, errors, results };
fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(summary, null, 2));
console.log(`TOTAL = ${summary.total}\nPASSED = ${summary.passed}\nFAILED = ${summary.failed}\nUNEXPECTED_REMOTE_REQUESTS = ${summary.unexpected_remote_requests}`);
if (summary.failed || errors.length || unexpectedRemote) process.exitCode = 1;
