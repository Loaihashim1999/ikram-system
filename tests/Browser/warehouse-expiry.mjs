import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = 18600 + (randomBytes(2).readUInt16BE(0) % 1000);
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-wh-expiry-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true });
fs.writeFileSync(database, '');

const env = {
  ...process.env,
  APP_ENV: 'testing',
  APP_DEBUG: 'false',
  DB_CONNECTION: 'sqlite',
  DB_DATABASE: database,
  DB_URL: '',
  CACHE_STORE: 'array',
  SESSION_DRIVER: 'array',
  QUEUE_CONNECTION: 'sync',
  LOG_CHANNEL: 'stderr',
  APP_URL: base,
};

const credentials = {
  admin: { username: 'TEST_admin', password: randomBytes(24).toString('hex') }
};

const fixture = spawnSync('php', ['tests/Browser/audit-fixture.php'], { env, input: JSON.stringify(credentials), encoding: 'utf8' });
if (fixture.status !== 0) {
  throw new Error(`Isolated database fixture failed: ${fixture.stderr}`);
}
const fixtureAuth = JSON.parse(fixture.stdout);

const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/server-router.php')], { cwd: root, env, stdio: 'ignore' });

let browser;
const errors = [];

try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(`${base}/up`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const loginResponse = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(credentials.admin),
  });
  if (!loginResponse.ok) throw new Error(`Login failed (${loginResponse.status})`);
  const loginPayload = await loginResponse.json();
  const token = loginPayload.data.token;
  const user = loginPayload.data.user;

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const target = new URL(request.url());
    const localUrl = `${base}${target.pathname}${target.search}`;
    try {
      const response = await context.request.fetch(localUrl, {
        method: request.method(),
        headers: {
          ...request.headers(),
          authorization: `Bearer ${token}`,
        },
        data: request.postDataBuffer() || undefined,
      });

      await route.fulfill({ response });
    } catch (err) {
      console.log(`[ROUTE ERROR] ${request.method()} ${request.url()} -> ${err.message}`);
      await route.abort();
    }
  });

  const page = await context.newPage();
  await page.addInitScript((auth) => {
    localStorage.setItem('token', auth.token);
    localStorage.setItem('user', JSON.stringify(auth.user));
  }, { token, user });

  page.on('console', (msg) => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('dialog', async (dialog) => {
    console.log(`[BROWSER DIALOG] ${dialog.type()}: ${dialog.message()}`);
    await dialog.dismiss();
  });
  page.on('pageerror', (err) => {
    console.log(`[BROWSER PAGEERROR] ${err.message}`);
    errors.push(`pageerror: ${err.message}`);
  });
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      console.log(`[BROWSER REQUEST] ${req.method()} ${req.url()}`);
    }
  });
  page.on('response', (res) => {
    if (res.url().includes('/api/')) {
      console.log(`[BROWSER RESPONSE] ${res.status()} ${res.request().method()} ${res.url()}`);
    }
    if (res.status() >= 500) {
      errors.push(`http ${res.status()} ${new URL(res.url()).pathname}`);
    }
  });

  // 1. Navigate to Warehouse page
  await page.goto(`${base}/warehouse`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.innerText.includes('إدارة المستودع والمخزون'));

  // 2. Open Add Item Modal
  await page.getByRole('button', { name: 'إضافة صنف / مادة للسلة' }).click();
  await page.waitForSelector('#input-add-name');

  // Compute test expiry date: 3 days from today (near_expiry)
  const today = new Date();
  const nearExpiryDate = new Date(today);
  nearExpiryDate.setDate(today.getDate() + 3);
  const nearExpiryDateStr = nearExpiryDate.toISOString().slice(0, 10);

  // Fill Add Item form
  const testItemName = 'أرز بسمتي فاخر E2E';
  await page.locator('#input-add-name').fill(testItemName);
  await page.locator('#input-add-quantity').fill('25');
  await page.locator('#input-add-min-threshold').fill('5');
  await page.locator('#input-add-expiration-date').fill(nearExpiryDateStr);
  await page.locator('#input-add-description').fill('شحنة توريد تجريبية لاختبار الصلاحية');

  // Submit form and wait for API call
  const [createResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/inventory') && res.request().method() === 'POST'),
    page.locator('#submit-add-item-btn').click(),
  ]);

  if (!createResponse.ok()) {
    throw new Error(`Create inventory item failed: ${createResponse.status()}`);
  }
  const createJson = await createResponse.json();
  const createdItemId = createJson.data.id;

  if (createJson.data.expiration_date !== nearExpiryDateStr) {
    throw new Error(`API response expiration_date mismatch: expected ${nearExpiryDateStr}, got ${createJson.data.expiration_date}`);
  }
  if (createJson.data.expiry_status !== 'near_expiry') {
    throw new Error(`API response expiry_status mismatch: expected 'near_expiry', got ${createJson.data.expiry_status}`);
  }

  // 3. Verify Table Display: Expiry date, remaining days, and status badge
  await page.waitForSelector(`[data-testid="expiry-date-${createdItemId}"]`);
  const displayedDate = await page.locator(`[data-testid="expiry-date-${createdItemId}"]`).innerText();
  if (displayedDate.trim() !== nearExpiryDateStr) {
    throw new Error(`UI table displayed date mismatch: expected ${nearExpiryDateStr}, got ${displayedDate}`);
  }

  const displayedStatus = await page.locator(`[data-testid="expiry-status-${createdItemId}"]`).innerText();
  if (!displayedStatus.includes('قارب على الانتهاء')) {
    throw new Error(`UI table displayed status mismatch: expected 'قارب على الانتهاء', got ${displayedStatus}`);
  }

  // 4. Open Details Modal and verify
  await page.locator(`button[title="عرض تفاصيل الصنف والصلاحية"]`).first().click();
  await page.waitForFunction(() => document.body.innerText.includes('بطاقة بيانات الصنف'));
  const detailsText = await page.locator('body').innerText();
  if (!detailsText.includes(nearExpiryDateStr)) {
    throw new Error('Details modal does not display the correct expiry date');
  }
  if (!detailsText.includes('قارب على الانتهاء')) {
    throw new Error('Details modal does not display near_expiry status');
  }
  // Close details modal
  await page.getByRole('button', { name: 'إغلاق' }).first().click();
  await page.waitForTimeout(300);

  // 5. Open Edit Modal, change expiry date to 10 days in future (status => 'صالح' / 'valid')
  const validExpiryDate = new Date(today);
  validExpiryDate.setDate(today.getDate() + 10);
  const validExpiryDateStr = validExpiryDate.toISOString().slice(0, 10);

  await page.locator(`button[title="تعديل بيانات الصنف وتاريخ الصلاحية"]`).first().click();
  await page.waitForSelector('input[name="edit_expiration_date"]');

  // Verify input pre-loaded with current date
  const preloadedDate = await page.locator('input[name="edit_expiration_date"]').inputValue();
  if (preloadedDate !== nearExpiryDateStr) {
    throw new Error(`Edit form preloaded date mismatch: expected ${nearExpiryDateStr}, got ${preloadedDate}`);
  }

  // Update date
  await page.locator('input[name="edit_expiration_date"]').fill(validExpiryDateStr);

  const [updateResponse] = await Promise.all([
    page.waitForResponse((res) => res.url().includes(`/api/inventory/${createdItemId}`) && res.request().method() === 'PUT'),
    page.locator('#submit-edit-item-btn').click(),
  ]);

  if (!updateResponse.ok()) {
    throw new Error(`Update inventory item failed: ${updateResponse.status()}`);
  }
  const updateJson = await updateResponse.json();
  if (updateJson.data.expiration_date !== validExpiryDateStr) {
    throw new Error(`API update expiration_date mismatch: expected ${validExpiryDateStr}, got ${updateJson.data.expiration_date}`);
  }
  if (updateJson.data.expiry_status !== 'valid') {
    throw new Error(`API update expiry_status mismatch: expected 'valid', got ${updateJson.data.expiry_status}`);
  }

  // 6. Verify table updated to new date and 'صالح' badge
  await page.waitForFunction((expected) => {
    const el = document.querySelector('[data-testid^="expiry-date-"]');
    return el && el.textContent.includes(expected);
  }, validExpiryDateStr);

  const updatedStatus = await page.locator(`[data-testid="expiry-status-${createdItemId}"]`).innerText();
  if (!updatedStatus.includes('صالح')) {
    throw new Error(`UI table updated status mismatch: expected 'صالح', got ${updatedStatus}`);
  }

  // 7. Reload page and assert persistence
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector(`[data-testid="expiry-date-${createdItemId}"]`);
  const reloadedDate = await page.locator(`[data-testid="expiry-date-${createdItemId}"]`).innerText();
  if (reloadedDate.trim() !== validExpiryDateStr) {
    throw new Error(`Persisted date after reload mismatch: expected ${validExpiryDateStr}, got ${reloadedDate}`);
  }
  const reloadedStatus = await page.locator(`[data-testid="expiry-status-${createdItemId}"]`).innerText();
  if (!reloadedStatus.includes('صالح')) {
    throw new Error(`Persisted status after reload mismatch: expected 'صالح', got ${reloadedStatus}`);
  }

  // Take full-page screenshot
  await page.screenshot({ path: 'storage/app/reports/qa-warehouse-expiry-verified.png', fullPage: true });

  if (errors.length) {
    throw new Error(`Browser errors encountered: ${errors.join('; ')}`);
  }

  console.log(JSON.stringify({
    status: 'PASS',
    test: 'warehouse-expiry-e2e',
    item_id: createdItemId,
    initial_expiry: nearExpiryDateStr,
    updated_expiry: validExpiryDateStr,
  }));

} finally {
  if (browser) await browser.close();
  server.kill();
  await new Promise((r) => setTimeout(r, 300));
  try {
    fs.rmSync(database, { force: true });
  } catch {}
}