import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
// Production UI with synthetic API responses; no database or remote access.
const output = path.resolve('reports/phase8'), build = path.join(output, 'build');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let file = path.join(build, new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(build + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(build, 'index.html');
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch();
const results = [], errors = [], writes = [];
const user = { id: 'phase8-admin', role: 'admin', full_name: 'مشرف الاختبار', permissions: {} };
let drivers = [{ id: 'driver-1', full_name: 'سائق الاختبار', phone: '966501234567', is_active: true }];
let notificationFailure = false, setupFailure = false, deletionFailure = false;
const notices = Array.from({ length: 20 }, (_, i) => ({ id: `n${i}`, title: `إشعار ${i + 1}`, message_body: 'تفاصيل ' + 'مرجعطويل'.repeat(25), category: 'system_event', read_at: null, created_at: '2026-10-07T08:00:00Z', action_url: '/receiver', target_available: true }));
async function check(name, work) {
  try { await work(); results.push({ name, passed: true }); console.log('PASS', name); }
  catch (e) { results.push({ name, passed: false, reason: e.message.slice(0, 250) }); console.log('FAIL', name, e.message.slice(0, 250)); }
}
async function overflow(page) {
  assert.equal(await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - innerWidth)), 0);
  assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (url.origin !== base) return route.abort();
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const endpoint = url.pathname.slice(4);
    let payload = { data: [], current_page: 1, last_page: 1, total: 0, metrics: {}, districts: [] }, status = 200;
    if (endpoint === '/setup-admin/status') {
      if (setupFailure) return route.abort();
      payload = { data: { setup_required: false } };
    } else if (endpoint === '/me') payload = { data: user };
    else if (endpoint === '/audit') payload = { data: { beneficiaries: [], distributions: [], representatives: [], inventory_movements: [], drivers: [], audit_logs: [] } };
    else if (endpoint.startsWith('/support/drivers')) {
      if (req.method() !== 'GET') {
        const values = req.postDataJSON(); writes.push({ endpoint, method: req.method(), values });
        if (req.method() === 'POST') drivers.push({ id: `created-${writes.length}`, ...values });
        else drivers = drivers.map(d => endpoint.endsWith(d.id) ? { ...d, ...values } : d);
      }
      payload = { data: req.method() === 'GET' ? drivers : drivers.at(-1) };
    } else if (endpoint === '/support/distributions') payload = { data: [{ id: 'support-1', recipient_name: 'مستفيد الاختبار', status: 'completed', items: [], completed_at: '2026-10-06T10:00:00Z', support_date: '2026-10-05', receipt: { employee_name: 'موظف الاختبار' } }], last_page: 1, metrics: {} };
    else if (endpoint.endsWith('/verify-preview')) payload = { data: { id: 'support-1', recipient_name: 'مستفيد الاختبار', status: 'ready', items: [] } };
    else if (endpoint === '/notifications/unread-count') payload = { unread_count: 20 };
    else if (endpoint === '/notifications') {
      if (notificationFailure) { payload = { message: 'offline' }; status = 503; }
      else payload = { data: notices, current_page: Number(url.searchParams.get('page') || 1), last_page: 2, total: 40, unread_count: 20 };
    } else if (endpoint.startsWith('/notifications/')) {
      if (deletionFailure && req.method() === 'DELETE') { status = 503; payload = { message: 'offline' }; }
      else payload = { success: true };
    }
    return route.fulfill({ status, json: payload });
  });
  const page = await context.newPage(); page.setDefaultTimeout(8000); page.on('pageerror', e => errors.push(e.message));
  await check('login-corrupt-storage', async () => {
    await page.goto(base); await page.evaluate(() => localStorage.setItem('user', '{invalid'));
    await page.goto(`${base}/login`); await page.locator('#login-username').waitFor(); assert.equal(errors.length, 0);
  });
  await check('login-offline-startup', async () => {
    setupFailure = true; await page.goto(`${base}/login`); await page.locator('#login-username').waitFor(); setupFailure = false;
  });
  for (const [size, width, height] of [['desktop', 1440, 1000], ['mobile', 375, 812], ['small', 320, 568]]) {
    await page.setViewportSize({ width, height });
    await check(`login-${size}`, async () => {
      await page.evaluate(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); });
      await page.goto(`${base}/login`); await page.locator('#login-password').waitFor(); await overflow(page);
      await page.screenshot({ path: path.join(output, `login-${size}.png`), fullPage: true });
    });
    await page.evaluate(value => { localStorage.setItem('token', 'synthetic'); localStorage.setItem('user', JSON.stringify(value)); }, user);
    await check(`drivers-${size}`, async () => {
      await page.goto(`${base}/admin/drivers`); await page.getByRole('heading', { name: 'إدارة السائقين' }).waitFor();
      await page.getByRole('button', { name: 'إضافة سائق' }).click();
      await page.getByLabel(/اسم السائق/).fill('سائق جديد'); await page.getByLabel(/رقم الجوال/).fill('0507654321');
      await overflow(page); await page.screenshot({ path: path.join(output, `driver-form-${size}.png`), fullPage: true });
      await page.getByRole('button', { name: 'حفظ', exact: true }).click(); await page.getByText('تمت إضافة السائق.', { exact: true }).waitFor();
      assert.equal(writes.at(-1).values.phone, '966507654321');
      const row = page.getByRole('row').filter({ hasText: 'سائق الاختبار' });
      await row.locator('summary').click(); await row.getByRole('button', { name: 'تعديل', exact: true }).click();
      assert.equal(await page.getByLabel(/رقم الجوال/).inputValue(), '0501234567');
      await page.getByLabel(/اسم السائق/).fill('سائق الاختبار معدل'); await page.getByRole('button', { name: 'حفظ', exact: true }).click();
      await page.getByText('تم حفظ بيانات السائق.', { exact: true }).waitFor(); assert.equal(writes.at(-1).method, 'PATCH'); await overflow(page);
    });
    await check(`handover-${size}`, async () => {
      await page.goto(`${base}/receiver`); await page.getByRole('heading', { name: 'الاستلام المباشر', exact: true }).waitFor();
      await page.getByLabel('مرجع الدعم', { exact: true }).fill('support-1'); await page.getByLabel('رمز الاستلام', { exact: true }).fill('1234');
      const referenceBounds = await page.getByLabel('مرجع الدعم', { exact: true }).boundingBox();
      const verifyBounds = await page.getByRole('button', { name: 'تحقق', exact: true }).boundingBox();
      assert.ok(Math.abs(referenceBounds.y - verifyBounds.y) < 2, 'verification controls must share one row');
      await page.getByRole('button', { name: 'تحقق', exact: true }).click(); await page.getByRole('button', { name: 'تأكيد الاستلام' }).waitFor();
      assert.ok(await page.getByRole('columnheader', { name: 'تاريخ الاستحقاق', exact: true }).count());
      await overflow(page); await page.screenshot({ path: path.join(output, `handover-${size}.png`), fullPage: true });
    });
    await check(`notifications-${size}`, async () => {
      await page.getByRole('button', { name: 'التنبيهات والإشعارات', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'مركز الإشعارات والتنبيهات' });
      await dialog.getByText('إشعار 1', { exact: true }).waitFor(); await overflow(page);
      const b = await dialog.boundingBox(); assert.ok(b.x >= 0 && b.x + b.width <= width + 1 && b.y >= 0 && b.y + b.height <= height + 1, 'dialog outside viewport');
      await dialog.getByRole('button', { name: 'التالي', exact: true }).click(); await dialog.getByText('2 / 2', { exact: true }).waitFor();
      await dialog.getByRole('button', { name: 'السابق', exact: true }).click(); await dialog.getByText('1 / 2', { exact: true }).waitFor();
      await dialog.locator('summary').click(); await dialog.getByRole('button', { name: 'تنظيف الإشعارات القديمة' }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `notifications-${size}.png`), fullPage: true });
      await dialog.getByRole('button', { name: 'إغلاق', exact: true }).click();
    });
  }
  await check('notifications-error-retry', async () => {
    notificationFailure = true; await page.getByRole('button', { name: 'التنبيهات والإشعارات', exact: true }).click();
    await page.getByRole('dialog', { name: 'مركز الإشعارات والتنبيهات' }).getByRole('alert').waitFor();
    assert.equal(await page.getByText('لا توجد إشعارات مطابقة', { exact: true }).count(), 0); notificationFailure = false;
    await page.getByRole('button', { name: /إعادة المحاولة|حاول/ }).click(); await page.getByText('إشعار 1', { exact: true }).waitFor();
    await page.getByText('إشعار 1', { exact: true }).click(); deletionFailure = true;
    await page.getByRole('button', { name: 'حذف نهائي', exact: true }).click(); await page.getByRole('button', { name: 'حذف نهائي', exact: true }).last().click();
    await page.getByText('تعذر حذف الإشعارات. حاول مرة أخرى.', { exact: true }).waitFor(); deletionFailure = false;
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click();
    await page.getByRole('dialog', { name: 'مركز الإشعارات والتنبيهات' }).getByRole('button', { name: 'إغلاق', exact: true }).click();
  });
  for (const route of ['/dashboard', '/beneficiaries', '/daily-beneficiaries', '/delivery', '/warehouse', '/admin/users', '/staff', '/representatives', '/audit']) {
    await check(`quick-overflow-${route}`, async () => { await page.goto(`${base}${route}`); await page.locator('main h1').first().waitFor({ timeout: 8000 }); await overflow(page); });
  }
  await check('runtime-errors', async () => assert.deepEqual(errors, []));
} finally {
  fs.writeFileSync(path.join(output, 'browser-results.json'), JSON.stringify({ mode: 'local production build; synthetic API; no database access', results, errors }, null, 2));
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
const failed = results.filter(r => !r.passed); console.log(`RESULT ${results.length - failed.length} passed, ${failed.length} failed`); process.exitCode = failed.length ? 1 : 0;
