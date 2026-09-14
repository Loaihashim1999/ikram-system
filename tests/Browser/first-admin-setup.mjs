import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = 18560 + (randomBytes(2).readUInt16BE(0) % 1000);
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-first-admin-${randomUUID()}.sqlite`);
const password = `Aa!9${randomBytes(12).toString('hex')}`;
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', LOG_CHANNEL: 'stderr', APP_URL: base, IKRAM_ADMIN_PASSWORD: '' };
fs.writeFileSync(database, '');

const migrate = spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: root, env, encoding: 'utf8' });
if (migrate.status !== 0) throw new Error('First-admin isolated migration failed');

const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/server-router.php')], { cwd: root, env, stdio: 'ignore' });
let browser;
const errors = [];
try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try { if ((await fetch(`${base}/up`)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`console: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`http: ${response.status()} ${new URL(response.url()).pathname}`);
  });

  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  if (!page.url().endsWith('/setup-admin')) {
    throw new Error(`Fresh installation did not redirect to setup (${page.url()}): ${(await page.locator('body').innerText()).slice(0, 200)}`);
  }
  await page.getByLabel('اسم المشرف').fill('مدير اختبار التهيئة');
  await page.getByLabel('اسم المستخدم').fill('first_admin');
  await page.getByLabel('البريد الإلكتروني المسجل').fill('first.admin@example.test');
  await page.getByLabel('كلمة المرور', { exact: true }).fill(password);
  await page.getByLabel('تأكيد كلمة المرور').fill(password);
  await page.screenshot({ path: 'storage/app/reports/qa-first-admin-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'إنشاء حساب المشرف وإكمال الإعداد' }).click();
  await page.waitForURL(`${base}/login`);

  await page.goto(`${base}/setup-admin`, { waitUntil: 'networkidle' });
  if (!page.url().endsWith('/login')) throw new Error('Setup page remained reachable after initialization');

  const bypass = await fetch(`${base}/api/setup-admin`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ full_name: 'Second Admin', username: 'second_admin', email: 'second@example.test', password, password_confirmation: password }),
  });
  if (bypass.status !== 403) throw new Error(`Second setup request returned ${bypass.status}`);

  await page.locator('input[autocomplete="username"]').fill('first_admin');
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.getByRole('button', { name: 'تسجيل الدخول الآمن' }).click();
  await page.waitForURL(`${base}/dashboard`);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.reload({ waitUntil: 'networkidle' });
  await page.screenshot({ path: 'storage/app/reports/qa-first-admin-dashboard.png', fullPage: true });

  if (errors.length) throw new Error(errors.join('; '));
  console.log(JSON.stringify({ checks: 7, errors: 0, status: 'PASS' }));
} finally {
  if (browser) await browser.close();
  server.kill();
  fs.rmSync(database, { force: true });
}
