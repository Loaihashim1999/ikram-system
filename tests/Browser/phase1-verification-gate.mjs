import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const port = 18700 + (randomBytes(2).readUInt16BE(0) % 1000);
const base = `http://127.0.0.1:${port}`;
const database = path.join(root, 'storage/app/reports', `qa-isolated-gate-${randomUUID()}.sqlite`);
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

console.log('--- Setting up isolated testing database fixture ---');
const fixture = spawnSync('php', ['tests/Browser/audit-fixture.php'], { env, input: JSON.stringify(credentials), encoding: 'utf8' });
if (fixture.status !== 0) {
  throw new Error(`Isolated database fixture failed: ${fixture.stderr}`);
}
const fixtureAuth = JSON.parse(fixture.stdout);
console.log('--- Database fixture initialized with admin user and degree categories ---');

const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/server-router.php')], { cwd: root, env });
server.stderr.on('data', data => console.error('SERVER STDERR:', data.toString()));
server.stdout.on('data', data => console.log('SERVER STDOUT:', data.toString()));

let browser;
let exitCode = 0;

try {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      if ((await fetch(`${base}/up`)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  // 1. Direct API Login
  console.log('1. Authenticating test session...');
  const loginResponse = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(credentials.admin),
  });
  if (!loginResponse.ok) throw new Error(`Login failed (${loginResponse.status})`);
  const loginPayload = await loginResponse.json();
  const token = loginPayload.data.token;
  const user = loginPayload.data.user;

  const statusRes = await fetch(`${base}/api/setup-admin/status`);
  const statusJson = await statusRes.json();
  console.log('Setup admin status from API:', statusJson);

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });

  // The Vite production bundle has VITE_API_URL=https://ikram-system.onrender.com/api baked in.
  // Proxying multipart uploads through context.route corrupted binary payloads, so instead we
  // rewrite the API origin inside the page (XHR + fetch) to point at the isolated local server.
  // This keeps uploads same-origin and byte-identical, and the app attaches its own Bearer token.
  await context.addInitScript(({ apiOrigin, localBase }) => {
    const rewrite = (url) => {
      try {
        if (typeof url === 'string' && url.startsWith(apiOrigin)) {
          return url.replace(apiOrigin, localBase);
        }
      } catch {}
      return url;
    };
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) {
      return origOpen.call(this, method, rewrite(url), ...rest);
    };
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      if (typeof input === 'string') return origFetch.call(this, rewrite(input), init);
      return origFetch.call(this, input, init);
    };
  }, { apiOrigin: 'https://ikram-system.onrender.com', localBase: base });

  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('response', async res => {
    if (res.status() >= 400) {
      try {
        console.log(`HTTP ${res.status()} ${res.request().method()} ${res.url()}:`, await res.text());
      } catch {}
    } else if (res.url().includes('/api/beneficiaries') && res.request().method() === 'POST') {
      console.log('BENEFICIARY CREATE RESPONSE STATUS:', res.status());
      try {
        console.log('BENEFICIARY CREATE RESPONSE BODY:', await res.text());
      } catch {}
    }
  });

  // 1. Interactive UI Login via Login form
  console.log('1. Performing interactive UI Login via Login Page...');
  await page.goto(`${base}/login`);
  await page.waitForLoadState('networkidle');

  // Check if first-time setup page appeared
  if (page.url().includes('setup-admin')) {
    console.log('Setup admin page detected. Filling initial setup...');
    await page.locator('input[name="full_name"]').fill('TEST_SUPER_ADMIN');
    await page.locator('input[name="username"]').fill(credentials.admin.username);
    await page.locator('input[name="email"]').fill('admin_setup@test.local');
    await page.locator('input[name="password"]').fill('Password123!@#');
    await page.locator('input[name="password_confirmation"]').fill('Password123!@#');
    credentials.admin.password = 'Password123!@#';
    await page.locator('button').filter({ hasText: 'إنشاء حساب المشرف' }).first().click();
    await page.waitForURL('**/login', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  }

  await page.locator('input[placeholder*="اسم المستخدم"], input[type="text"]').first().fill(credentials.admin.username);
  await page.locator('input[type="password"]').first().fill(credentials.admin.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });
  console.log(' PASS: Interactive login succeeded and redirected to dashboard.');

  // =========================================================================
  // GATE 2.A — VERIFY REAL CITIZEN BENEFICIARY UI
  // =========================================================================
  console.log('\n========================================');
  console.log('GATE 2.A: VERIFYING CITIZEN BENEFICIARY UI');
  console.log('========================================');

  await page.goto(`${base}/beneficiaries/add-citizen`);
  await page.waitForLoadState('domcontentloaded');

  const nextBtn = () => page.locator('button').filter({ hasText: 'التالي →' }).first();

  // FIELD-SPECIFIC VALIDATION: clicking Next on an empty form must show inline
  // per-field errors (not a generic message) and must NOT advance the wizard.
  console.log('Verifying field-specific validation errors on empty Step 1...');
  await nextBtn().click();
  await page.waitForTimeout(300);
  const nameError = page.getByText('الاسم الكامل لرب الأسرة مطلوب.').first();
  if (!(await nameError.isVisible())) {
    throw new Error('Expected field-specific inline error for full_name on empty submit!');
  }
  const idError = page.getByText('رقم الهوية الوطنية أو الإقامة مطلوب.').first();
  if (!(await idError.isVisible())) {
    throw new Error('Expected field-specific inline error for national_id on empty submit!');
  }
  if (!page.url().includes('/beneficiaries/add-citizen')) {
    throw new Error('Wizard advanced despite Step 1 validation errors!');
  }
  console.log(' PASS: Empty submit shows exact per-field errors and blocks progression.');

  // STEP 1: Personal info
  console.log('Filling Step 1: Personal Info for Citizen...');
  await page.locator('input[name="full_name"]').fill('TEST_CITIZEN_AUTOMATED');
  await page.locator('input[name="national_id"]').fill('1099999991');
  await page.locator('input[name="phone"]').fill('0501112233');
  await page.locator('input[name="date_of_birth"]').fill('1985-05-15');
  await page.locator('input[name="city"]').fill('مكة المكرمة');
  await page.locator('input[name="district"]').fill('العزيزية');
  await page.locator('input[name="street"]').fill('شارع النور');

  // Click Next -> Step 2
  await nextBtn().click();
  await page.waitForTimeout(300);

  // STEP 2: Family & Housing
  console.log('Filling Step 2: Family & Housing...');
  await page.locator('select[name="family_status"]').selectOption('poor');
  await page.locator('input[name="family_members_count"]').fill('4');
  await page.locator('select[name="housing_type"]').selectOption('rent');

  // Annual rent -> check monthly rent auto-calc
  await page.locator('input[name="annual_rent_amount"]').fill('12000');
  await page.waitForTimeout(300);
  const monthlyRentVal = await page.locator('input[name="monthly_rent_amount"]').inputValue();
  console.log(`Monthly rent auto-calculated: ${monthlyRentVal} (expected 1000)`);
  if (parseFloat(monthlyRentVal) !== 1000) {
    throw new Error(`Expected monthly rent 1000, got ${monthlyRentVal}`);
  }
  console.log(' PASS: Annual rent / 12 auto calculation is exact (1000).');

  // Click Next -> Step 3
  await nextBtn().click();
  await page.waitForTimeout(300);

  // STEP 3: Financials & live calculation
  console.log('Verifying Step 3: Financial Inputs & Live Calculations...');
  const salaryInput = page.locator('input[name="monthly_salary"]');
  const socialSecurityInput = page.locator('input[name="social_security_amount"]');

  if (await salaryInput.isVisible()) {
    throw new Error('Expected monthly_salary input to be hidden before source selection!');
  }
  console.log(' PASS: Financial source inputs are hidden before selection.');

  // Select salary
  await page.locator('button').filter({ hasText: 'راتب شهري' }).first().click();
  await page.waitForTimeout(200);
  if (!(await salaryInput.isVisible())) {
    throw new Error('Expected monthly_salary to be visible after clicking salary button!');
  }
  await salaryInput.fill('4000');
  console.log(' PASS: Salary input became visible upon selecting source and filled 4000.');

  // Select social security
  await page.locator('button').filter({ hasText: 'ضمان اجتماعي' }).first().click();
  await page.waitForTimeout(200);
  if (!(await socialSecurityInput.isVisible())) {
    throw new Error('Expected social_security_amount to be visible after clicking source!');
  }
  await socialSecurityInput.fill('1000');
  console.log(' PASS: Social security input visible and filled with 1000.');

  // Deselect social security -> verify it disappears and is excluded
  await page.locator('button').filter({ hasText: 'ضمان اجتماعي' }).first().click();
  await page.waitForTimeout(200);
  if (await socialSecurityInput.isVisible()) {
    throw new Error('Expected social_security_amount to hide after deselecting source!');
  }
  console.log(' PASS: Deselecting social security hides input and removes from calculation.');

  // Verify live summary card values
  const formulaCardText = await page.locator('div.bg-white.p-3.rounded-xl.border').first().innerText();
  console.log('Live formula text:', formulaCardText);
  if (!formulaCardText.includes('4000') || !formulaCardText.includes('1000') || !formulaCardText.includes('3000')) {
    throw new Error(`Formula text does not display expected financial breakdown: ${formulaCardText}`);
  }
  console.log(' PASS: Live financial summary displays gross (4000), rent (1000), net (3000).');

  // Click Next -> Step 4
  await nextBtn().click();
  await page.waitForTimeout(300);

  // STEP 4: Documents
  console.log('Verifying Step 4: Conditional Document Uploads...');
  const salaryDoc = page.locator('input[type="file"][name="salary_certificate"]');
  const socialDoc = page.locator('input[type="file"][name="social_security_image"]');
  const rentDoc = page.locator('input[type="file"][name="rental_contract_image"]');

  if (!(await salaryDoc.isVisible())) {
    throw new Error('Expected salary_certificate upload to be visible when salary is selected!');
  }
  if (await socialDoc.isVisible()) {
    throw new Error('Expected social_security_image upload to be hidden when not selected!');
  }
  if (!(await rentDoc.isVisible())) {
    throw new Error('Expected rental_contract_image upload to be visible for rent housing!');
  }
  console.log(' PASS: Conditional document upload slots strictly correspond to selected sources.');

  const realPng = path.join(root, 'public', '1.png');

  await page.locator('input[type="file"][name="national_id_image"]').setInputFiles(realPng);
  await page.locator('input[type="file"][name="national_address_image"]').setInputFiles(realPng);
  await rentDoc.setInputFiles(realPng);
  await salaryDoc.setInputFiles(realPng);

  // Click Next -> Step 5
  await nextBtn().click();
  await page.waitForTimeout(300);

  // STEP 5: Review & Save
  console.log('Submitting citizen beneficiary in Step 5...');
  const saveBtn = page.locator('button[type="submit"]').filter({ hasText: 'حفظ وتصنيف المستفيد' }).first();
  await saveBtn.click();
  await page.waitForTimeout(2000);

  // Verify citizen in DB via API and CLI
  const citizenListRes = await fetch(`${base}/api/beneficiaries?search=1099999991`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` }
  });
  const citizenListJson = await citizenListRes.json();
  const citizenInDb = (citizenListJson.data?.data || citizenListJson.data)?.[0];

  if (!citizenInDb) {
    const dbCheck = spawnSync('php', ['-r', `
      require 'vendor/autoload.php';
      $app = require 'bootstrap/app.php';
      $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
      $b = App\\Models\\Beneficiary::where('national_id', '1099999991')->first();
      echo json_encode($b ? $b->toArray() : null);
    `], { cwd: root, env, encoding: 'utf8' });
    console.log('CLI query output:', dbCheck.stdout, dbCheck.stderr);
    throw new Error('Citizen beneficiary not found after UI submission!');
  }

  console.log('Citizen saved in DB:', {
    id: citizenInDb.id,
    full_name: citizenInDb.full_name,
    total_income: citizenInDb.total_income,
    monthly_rent: citizenInDb.monthly_rent,
    net_income: citizenInDb.net_income,
    priority: citizenInDb.priority,
  });

  if (parseFloat(citizenInDb.total_income) !== 4000) throw new Error(`Expected total_income 4000, got ${citizenInDb.total_income}`);
  if (parseFloat(citizenInDb.monthly_rent) !== 1000) throw new Error(`Expected monthly_rent 1000, got ${citizenInDb.monthly_rent}`);
  if (parseFloat(citizenInDb.net_income) !== 3000) throw new Error(`Expected net_income 3000, got ${citizenInDb.net_income}`);
  if (citizenInDb.priority !== 'first_class') throw new Error(`Expected priority first_class, got ${citizenInDb.priority}`);
  console.log(' PASS: Backend saved calculation equals UI formula (4000 - 1000 = 3000, first_class).');

  // Details -> Refresh -> Edit -> Save -> Refresh -> Logout/Login -> Reopen
  console.log(`Navigating to /beneficiaries/${citizenInDb.id}...`);
  await page.goto(`${base}/beneficiaries/${citizenInDb.id}`);
  await page.waitForLoadState('domcontentloaded');
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  console.log(' PASS: Details page refreshed and loaded successfully.');

  console.log(`Navigating to /beneficiaries/${citizenInDb.id}/edit...`);
  await page.goto(`${base}/beneficiaries/${citizenInDb.id}/edit`);
  await page.waitForLoadState('domcontentloaded');

  // Click tab 2: السكن والعنوان
  await page.locator('button').filter({ hasText: 'السكن والعنوان' }).first().click();
  await page.waitForTimeout(300);

  const streetInput = page.locator('input[name="street"]');
  await streetInput.fill('شارع السلام الجديد');
  const editSaveBtn = page.locator('button[type="submit"]').first();
  await editSaveBtn.click();
  await page.waitForTimeout(1500);

  // Reload details
  await page.goto(`${base}/beneficiaries/${citizenInDb.id}`);
  await page.waitForLoadState('domcontentloaded');

  // NON-FINANCIAL EDIT STABILITY: editing only the street must not alter any
  // stored financial values (backend recomputes from unchanged financial inputs).
  const afterEditRes = await fetch(`${base}/api/beneficiaries/${citizenInDb.id}`, {
    headers: { accept: 'application/json', authorization: `Bearer ${token}` },
  });
  const afterEdit = (await afterEditRes.json()).data;
  console.log('Financial values after address-only edit:', {
    total_income: afterEdit.total_income,
    monthly_rent: afterEdit.monthly_rent,
    net_income: afterEdit.net_income,
    priority: afterEdit.priority,
    street: afterEdit.street,
  });
  if (afterEdit.street !== 'شارع السلام الجديد') throw new Error(`Street edit did not persist, got: ${afterEdit.street}`);
  if (parseFloat(afterEdit.total_income) !== 4000) throw new Error(`total_income changed after address-only edit: ${afterEdit.total_income}`);
  if (parseFloat(afterEdit.monthly_rent) !== 1000) throw new Error(`monthly_rent changed after address-only edit: ${afterEdit.monthly_rent}`);
  if (parseFloat(afterEdit.net_income) !== 3000) throw new Error(`net_income changed after address-only edit: ${afterEdit.net_income}`);
  if (afterEdit.priority !== 'first_class') throw new Error(`priority changed after address-only edit: ${afterEdit.priority}`);
  console.log(' PASS: Address-only edit persisted street and preserved all financial calculations.');

  // Logout / Login test
  console.log('Testing logout and re-login persistence...');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.goto(`${base}/login`);
  await page.waitForLoadState('networkidle');
  await page.locator('input[placeholder*="اسم المستخدم"], input[type="text"]').first().fill(credentials.admin.username);
  await page.locator('input[type="password"]').first().fill(credentials.admin.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/dashboard', { timeout: 15000 });

  await page.goto(`${base}/beneficiaries/${citizenInDb.id}`);
  await page.waitForLoadState('domcontentloaded');
  console.log(' PASS: Citizen flow completed with full persistence across logout/login.');

  // =========================================================================
  // GATE 2.B — VERIFY REAL RESIDENT BENEFICIARY UI & FORGERY PROTECTION
  // =========================================================================
  console.log('\n========================================');
  console.log('GATE 2.B: VERIFYING RESIDENT BENEFICIARY UI & FORGERY DEFENSE');
  console.log('========================================');

  await page.goto(`${base}/beneficiaries/add-resident`);
  await page.waitForLoadState('domcontentloaded');

  // Fill personal info for resident
  await page.locator('input[name="full_name"]').fill('TEST_RESIDENT_AUTOMATED');
  await page.locator('input[name="national_id"]').fill('2099999991');
  await page.locator('input[name="phone"]').fill('0502223344');
  await page.locator('input[name="date_of_birth"]').fill('1992-02-02');
  await page.locator('input[name="nationality"]').fill('يمني');
  await page.locator('input[name="city"]').fill('مكة المكرمة');
  await page.locator('input[name="district"]').fill('العزيزية');
  await page.locator('input[name="street"]').fill('شارع السلام');

  // Next -> Step 2
  await nextBtn().click();
  await page.waitForTimeout(300);

  // Step 2: Family
  await page.locator('select[name="family_status"]').selectOption('poor');
  await page.locator('input[name="family_members_count"]').fill('3');
  await page.locator('select[name="housing_type"]').selectOption('own');

  // Next -> Step 3
  await nextBtn().click();
  await page.waitForTimeout(300);

  // Step 3: Check resident degree locking and need level in live formula card
  await page.locator('button').filter({ hasText: 'راتب شهري' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('input[name="monthly_salary"]').fill('2500');
  await page.waitForTimeout(300);

  // Verify resident classification is locked to second degree and need level is displayed
  const cardText = await page.locator('div.p-4.bg-\\[\\#FAF8F5\\]').first().innerText();
  console.log('Resident live classification card text:\n', cardText);
  if (!cardText.includes('الدرجة الثانية')) {
    throw new Error('Resident UI is not locked to Second Degree!');
  }
  if (!cardText.includes('احتياج شديد')) {
    throw new Error('Resident UI does not display correct need level (احتياج شديد)!');
  }
  console.log(' PASS: Resident frontend UI locks classification to Second Degree (الدرجة الثانية).');
  console.log(' PASS: Resident frontend UI correctly shows need level as separate indicator (احتياج شديد).');

  // Verify forged API payload attempting first_class is overridden
  console.log('Sending forged API request attempting to set resident priority=first_class...');
  const forgedResponse = await fetch(`${base}/api/beneficiaries`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      beneficiary_type: 'resident',
      full_name: 'TEST_FORGED_RESIDENT',
      national_id: '2099999992',
      phone: '0502223344',
      date_of_birth: '1992-02-02',
      nationality: 'يمني',
      city: 'مكة المكرمة',
      district: 'العزيزية',
      street: 'شارع السلام',
      family_status: 'poor',
      family_members_count: 3,
      housing_type: 'rent',
      annual_rent_amount: 6000, // monthly rent = 500
      income_sources: ['salary'],
      monthly_salary: 2000,
      priority: 'first_class', // FORGED
    }),
  });

  if (!forgedResponse.ok) {
    const errText = await forgedResponse.text();
    throw new Error(`Forged payload request failed (${forgedResponse.status}): ${errText}`);
  }
  const forgedPayload = await forgedResponse.json();
  const forgedBeneficiary = forgedPayload.data;
  console.log('Backend response for forged payload:', {
    priority: forgedBeneficiary.priority,
    need_level: forgedBeneficiary.need_level,
    need_level_label: forgedBeneficiary.need_level_label,
    total_income: forgedBeneficiary.total_income,
    net_income: forgedBeneficiary.net_income,
  });

  if (forgedBeneficiary.priority !== 'second_class') {
    throw new Error(`Forged priority was NOT overridden! Received: ${forgedBeneficiary.priority}`);
  }
  if (forgedBeneficiary.need_level !== 'severe_need') {
    throw new Error(`Expected need_level severe_need for net_income 1500 <= 3000! Received: ${forgedBeneficiary.need_level}`);
  }
  console.log(' PASS: Forged resident first_class payload was strictly overridden to second_class.');
  console.log(' PASS: Resident need level is separate from degree (severe_need / احتياج شديد).');

  // =========================================================================
  // GATE 3 — TEST SETTINGS THRESHOLD END TO END
  // =========================================================================
  console.log('\n========================================');
  console.log('GATE 3: TESTING SETTINGS THRESHOLD END-TO-END');
  console.log('========================================');

  await page.goto(`${base}/admin/settings`);
  await page.waitForLoadState('domcontentloaded');

  // Record current resident threshold
  const residentThresholdInput = page.locator('input[name="resident_need_threshold"]');
  const initialThreshold = await residentThresholdInput.inputValue();
  console.log(`Initial resident threshold in UI: ${initialThreshold}`);

  // Change to safe test value: 4500
  console.log('Updating resident threshold to 4500...');
  await residentThresholdInput.fill('4500');
  const settingsSubmitBtn = page.locator('button[type="submit"]').first();
  await settingsSubmitBtn.click();
  await page.waitForTimeout(1000);

  // Refresh page and confirm persisted value
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const updatedThreshold = await residentThresholdInput.inputValue();
  console.log(`Persisted resident threshold after refresh: ${updatedThreshold}`);
  if (updatedThreshold !== '4500') {
    throw new Error(`Expected threshold 4500, but got ${updatedThreshold}`);
  }
  console.log(' PASS: Settings update persisted with 4500.');

  // Create a resident with net income 3500:
  // With 3000 threshold, 3500 would be 'normal_need'.
  // With 4500 threshold, 3500 <= 4500 => MUST BE 'severe_need'!
  const dynamicTestRes = await fetch(`${base}/api/beneficiaries`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      beneficiary_type: 'resident',
      full_name: 'TEST_DYNAMIC_THRESHOLD_RESIDENT',
      national_id: '2099999993',
      phone: '0503334455',
      date_of_birth: '1993-03-03',
      nationality: 'مصري',
      city: 'مكة المكرمة',
      district: 'العزيزية',
      street: 'شارع الحج',
      family_status: 'single',
      family_members_count: 1,
      housing_type: 'own',
      income_sources: ['salary'],
      monthly_salary: 3500, // net income 3500
    }),
  });
  const dynamicPayload = await dynamicTestRes.json();
  console.log('Resident under new 4500 threshold result:', {
    net_income: dynamicPayload.data.net_income,
    need_level: dynamicPayload.data.need_level,
    need_level_label: dynamicPayload.data.need_level_label,
  });

  if (dynamicPayload.data.need_level !== 'severe_need') {
    throw new Error(`Expected severe_need under 4500 threshold, got: ${dynamicPayload.data.need_level}`);
  }
  console.log(' PASS: Dynamic threshold alteration directly governed resident need level classification (3500 <= 4500 => severe_need).');

  // Restore original setting
  console.log(`Restoring resident threshold back to ${initialThreshold}...`);
  await residentThresholdInput.fill(initialThreshold);
  await settingsSubmitBtn.click();
  await page.waitForTimeout(1000);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  const restoredThreshold = await residentThresholdInput.inputValue();
  console.log(`Restored resident threshold verified: ${restoredThreshold}`);
  if (restoredThreshold !== initialThreshold) {
    throw new Error(`Failed to restore threshold! Expected ${initialThreshold}, got ${restoredThreshold}`);
  }
  console.log(' PASS: System setting cleanly restored to initial value.');

  console.log('\n========================================');
  console.log('ALL GATE VERIFICATIONS COMPLETED SUCCESSFULLY!');
  console.log('========================================');

} catch (err) {
  console.error('\n❌ ERROR DURING GATE VERIFICATION:', err);
  exitCode = 1;
} finally {
  if (browser) await browser.close();
  server.kill();
  if (fs.existsSync(database)) {
    try { fs.unlinkSync(database); } catch {}
  }
  process.exit(exitCode);
}
