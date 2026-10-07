import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';

const root = process.cwd();
const evidence = path.join(root, '.tmp/phase2b-evidence');
const build = path.join(evidence, 'frontend-build');
const db = path.join(root, 'storage/app/reports/qa-isolated-phase2b-' + randomUUID() + '.sqlite');
fs.mkdirSync(path.dirname(db), { recursive: true }); fs.writeFileSync(db, '');
const port = 22000 + randomBytes(2).readUInt16BE() % 1000;
const base = 'http://127.0.0.1:' + port;
const backend = 'http://127.0.0.1:' + (port + 1000);
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: 'base64:' + randomBytes(32).toString('base64'), APP_URL: base, DB_CONNECTION: 'sqlite', DB_DATABASE: db, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'database', LOG_CHANNEL: 'null', SENTRY_LARAVEL_DSN: '', SENTRY_DSN: '', APP_CONFIG_CACHE: path.join(evidence, 'no-config.php') };
const fixture = spawnSync('php', ['tests/Browser/phase2b-fixture.php'], { env, encoding: 'utf8' });
assert.equal(fixture.status, 0, 'Fixture must succeed');
const data = JSON.parse(fixture.stdout);
const php = spawn('php', ['-S', '127.0.0.1:' + (port + 1000), '-t', 'public', 'tests/Browser/server-router.php'], { env, stdio: 'ignore' });
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/') || req.url === '/up') {
    try {
      const chunks = []; for await (const part of req) chunks.push(part);
      const result = await fetch(backend + req.url, { method: req.method, headers: req.headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
      res.writeHead(result.status, { 'content-type': result.headers.get('content-type') || 'application/json' }); res.end(Buffer.from(await result.arrayBuffer()));
    } catch { res.writeHead(502); res.end('{}'); } return;
  }
  const url = new URL(req.url, base);
  let file = path.join(build, url.pathname);
  if (!file.startsWith(build)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
  const type = { '.js': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(file)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'referrer-policy': 'no-referrer' }); fs.createReadStream(file).pipe(res);
});
let browser;
try {
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  for (let i = 0; i < 40; i++) { try { if ((await fetch(backend + '/up')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  browser = await chromium.launch({ headless: true });
  const errors = [];
  for (const width of [360, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: 844 } });
    await context.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
    const page = await context.newPage(); page.on('pageerror', () => errors.push('pageerror'));
    await page.goto(base + '/driver-access#' + data.driver_token);
    await page.getByRole('heading', { name: 'TEST جهة الاستلام' }).waitFor();
    assert.equal(new URL(page.url()).hash, '');
    assert.equal(await page.locator('main').getAttribute('dir'), 'rtl');
    assert.equal(await page.locator('aside').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(evidence, 'driver-' + width + '.png'), fullPage: true });
    await page.getByRole('button', { name: 'عرض المهمة وتأكيد الاستلام' }).click();
    const box = await page.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).boundingBox(); assert.ok(box.height >= 44);
    await page.getByLabel('رمز الاستلام من المستلم').fill('0000');
    await page.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'غير صحيح' }).waitFor();
    await page.getByLabel('رمز الاستلام من المستلم').fill('');
    await page.screenshot({ path: path.join(evidence, 'driver-error-' + width + '.png'), fullPage: true });
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage();
  await page.goto(base + '/driver-access#' + data.driver_token);
  await page.getByRole('button', { name: 'عرض المهمة وتأكيد الاستلام' }).click();
  await page.getByLabel('رمز الاستلام من المستلم').fill('0042');
  await page.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).click();
  await page.getByRole('heading', { name: 'اكتمل التكليف' }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'driver-completed.png'), fullPage: true });
  const denied = await fetch(base + '/api/settings', { headers: { Accept: 'application/json', 'X-Driver-Token': data.driver_token } }); assert.equal(denied.status, 401);
  await page.goto(base + '/driver-access#invalid');
  await page.getByRole('heading', { name: 'الرابط غير متاح' }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'driver-invalid.png'), fullPage: true });
  await page.goto(base + '/driver-access#' + data.expired_token);
  await page.getByRole('alert').filter({ hasText: 'انتهت صلاحية' }).waitFor();
  await page.screenshot({ path: path.join(evidence, 'driver-expired.png'), fullPage: true });
  const offline = await context.newPage();
  await offline.route('**/api/driver-access', (route) => route.abort());
  await offline.goto(base + '/driver-access#' + data.driver_token);
  await offline.getByRole('button', { name: 'إعادة المحاولة' }).waitFor();
  await offline.screenshot({ path: path.join(evidence, 'driver-offline.png'), fullPage: true });
  await offline.close();
  const loading = await context.newPage();
  await loading.route('**/api/driver-access', async (route) => { await new Promise((r) => setTimeout(r, 2000)); await route.continue(); });
  await loading.goto(base + '/driver-access#' + data.driver_token);
  await loading.getByRole('status').waitFor();
  await loading.screenshot({ path: path.join(evidence, 'driver-loading.png'), fullPage: true });
  await loading.getByRole('heading', { name: 'اكتمل التكليف' }).waitFor();
  await loading.close();
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await adminContext.route('**/*', (route) => route.request().url().startsWith(base) ? route.continue() : route.abort());
  await adminContext.addInitScript(({ token, user }) => { localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); }, { token: data.admin_token, user: data.user });
  const adminPage = await adminContext.newPage();
  await adminPage.goto(base + '/admin/settings');
  await adminPage.getByRole('heading', { name: 'الاتصالات', exact: true }).waitFor();
  await adminPage.getByLabel('SMS — مستفيد / توصيل', { exact: true }).fill('{recipient_name}: {verification_code}');
  await adminPage.getByRole('button', { name: 'معاينة SMS — مستفيد / توصيل', exact: true }).click();
  await adminPage.getByText('مستلم تجريبي: 0042', { exact: true }).waitFor();
  await adminPage.getByRole('button', { name: 'حفظ قوالب الاتصالات' }).click();
  await adminPage.getByText('تم حفظ قوالب الاتصالات.', { exact: true }).waitFor();
  await adminPage.goto(base + '/support-delivery');
  await adminPage.getByRole('heading', { name: 'تسليم الدعم وتكليف السائق' }).waitFor();
  await adminContext.close();
  assert.deepEqual(errors, []);
  console.log('PASS mobile 360/390/430 RTL, no overflow/sidebar, 44px targets, wrong-code error, leading-zero confirmation, completed/invalid/expired links, loading/offline feedback, admin API denial, settings preview/save; synthetic fixture only.');
} finally { if (browser) await browser.close(); server.close(); php.kill(); }
