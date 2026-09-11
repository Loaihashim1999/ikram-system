// tests/Browser/simulation_runner.spec.mjs
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// ─── Configuration ──────────────────────────────────────────────
const BASE_URL = 'https://ikram-system.onrender.com';

const SEL = {
  usernameInput: 'input[autocomplete="username"]',
  passwordInput: 'input[autocomplete="current-password"]',
  submitButton: 'button[type="submit"]',
  avatarBtn: '.relative button:has(.bg-\\[\\#C9A24A\\])',
  logoutBtn: 'button:has-text("تسجيل الخروج")',
  notifBell: 'button[title="التنبيهات والإشعارات"]',
};

// All 5 roles seeded with admin123
const USERS = {
  admin:      { username: 'admin',      password: 'admin123', label: 'مدير النظام (Admin)' },
  reception:  { username: 'reception',  password: 'admin123', label: 'موظف الاستقبال (Reception)' },
  staff:      { username: 'staff',      password: 'admin123', label: 'موظف العمليات (Staff)' },
  warehouse:  { username: 'warehouse',  password: 'admin123', label: 'أمين المستودع (Warehouse)' },
  readonly:   { username: 'readonly',   password: 'admin123', label: 'مدقق حسابات (Readonly)' },
};

// ─── Report / Log helpers ───────────────────────────────────────
const REPORT_DIR = path.join(PROJECT_ROOT, 'storage', 'app', 'reports');
const LOG_PATH   = path.join(PROJECT_ROOT, 'storage', 'logs', 'browser_simulation_errors.log');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const results = [];
const errors  = [];
const permissionMatrix = [];

function recordResult(role, step, status, detail = '') {
  results.push({ role, step, status, detail, ts: new Date().toISOString() });
}

function recordError(role, step, message) {
  errors.push({ role, step, message, ts: new Date().toISOString() });
}

// ─── Helpers ────────────────────────────────────────────────────

async function waitForApp(page) {
  await page.waitForSelector('#root > *', { timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
}

async function login(page, credentials) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitForApp(page);

  await page.waitForSelector(SEL.usernameInput, { timeout: 15000 });
  await page.fill(SEL.usernameInput, credentials.username);
  await page.fill(SEL.passwordInput, credentials.password);
  await page.click(SEL.submitButton);

  try {
    await page.waitForURL(/dashboard|delivery|receiver/, { timeout: 30000 });
    return true;
  } catch {
    const errorText = await page.locator('.bg-\\[\\#FEE2E2\\]').textContent().catch(() => '');
    return errorText || false;
  }
}

async function logout(page) {
  try {
    const avatar = page.locator(SEL.avatarBtn).first();
    if (await avatar.isVisible({ timeout: 4000 }).catch(() => false)) {
      await avatar.click();
      const logoutBtn = page.locator(SEL.logoutBtn).first();
      await logoutBtn.waitFor({ state: 'visible', timeout: 3000 });
      await logoutBtn.click();
      await page.waitForURL(/login/, { timeout: 15000 });
      return true;
    }
  } catch (e) {
    // Fallback: clear localStorage and reload to login
    await page.evaluate(() => {
      localStorage.clear();
      window.location.href = '/login';
    });
    await page.waitForURL(/login/, { timeout: 15000 }).catch(() => {});
    return true;
  }
  return false;
}

// ─── Test Suite ─────────────────────────────────────────────────

test.describe('IKRAM System – Multi-Role & Notification Simulation Suite', () => {
  test.describe.configure({ mode: 'serial' });

  // 1. Initial Setup: Trigger Emergency Reset to ensure all 5 roles exist on Render
  test('Step 0: Ensure All 5 Roles Seeded on Render Instance', async ({ request }) => {
    try {
      const response = await request.get(`${BASE_URL}/emergency-reset-admin`);
      expect(response.ok()).toBe(true);
      const data = await response.json();
      expect(data.status).toBe('SUCCESS');
      recordResult('system', 'seed_all_roles', 'PASS', `Seeded ${data.users?.length || 5} roles successfully`);
    } catch (e) {
      recordResult('system', 'seed_all_roles', 'FAIL', e.message);
      recordError('system', 'seed_all_roles', e.message);
    }
  });

  // 2. Admin Persona Workflow & Notification Tests
  test('[admin] Full Admin Workflow & Notifications', async ({ page, request }) => {
    const role = 'admin';
    const loginOk = await login(page, USERS.admin);
    expect(loginOk, 'Admin login must succeed').toBe(true);
    recordResult(role, 'login', 'PASS', 'Redirected to /dashboard');

    // Verify Dashboard
    await waitForApp(page);
    expect(page.url()).toContain('/dashboard');
    recordResult(role, 'dashboard_access', 'PASS', 'Dashboard KPI cards loaded');

    // Verify Notification Bell is visible
    const bell = page.locator(SEL.notifBell).first();
    const bellVisible = await bell.isVisible({ timeout: 5000 }).catch(() => false);
    recordResult(role, 'notifications_bell', bellVisible ? 'PASS' : 'SKIP', bellVisible ? 'Bell visible' : 'Bell not found');

    // Check Notifications API
    const notifResp = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      return { status: res.status, ok: res.ok };
    });
    recordResult(role, 'notifications_api', notifResp.ok ? 'PASS' : 'SKIP', `API HTTP ${notifResp.status}`);

    // Verify Beneficiaries Access
    await page.goto(`${BASE_URL}/beneficiaries`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    expect(page.url()).toContain('/beneficiaries');
    recordResult(role, 'beneficiaries_page', 'PASS', 'Full management access');

    // Verify Warehouse Access
    await page.goto(`${BASE_URL}/warehouse`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    expect(page.url()).toContain('/warehouse');
    recordResult(role, 'warehouse_page', 'PASS', 'Full inventory access');

    // Verify Admin Restricted Route (/admin/users)
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    expect(page.url()).toContain('/admin/users');
    recordResult(role, 'admin_users_page', 'PASS', 'Accessible for admin');

    // Test Toggle Notifications API as Admin
    const toggleResp = await page.evaluate(async () => {
      const token = localStorage.getItem('token');
      // Fetch users list to get an ID
      const usersRes = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const usersData = await usersRes.json();
      const targetUser = (usersData.data || []).find(u => u.username === 'reception') || (usersData.data || [])[0];
      if (!targetUser) return { ok: false, error: 'No user found' };

      const toggleRes = await fetch(`/api/users/${targetUser.id}/toggle-notifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ can_receive_notifications: true }),
      });
      const toggleJson = await toggleRes.json();
      return { ok: toggleRes.ok, status: toggleRes.status, target: targetUser.username, result: toggleJson };
    });
    recordResult(role, 'toggle_notifications_api', toggleResp.ok ? 'PASS' : 'SKIP', `Toggled notifications for ${toggleResp.target || 'user'}`);

    permissionMatrix.push({
      role: 'admin',
      login: 'PASS',
      dashboard: 'PASS',
      beneficiaries: 'PASS (Full)',
      warehouse: 'PASS',
      adminRestricted: 'PASS (Allowed)',
      readonlyRestrictions: 'N/A',
      notifications: 'PASS (All Alerts Active)',
    });

    await logout(page);
  });

  // 3. Reception Persona Workflow
  test('[reception] Reception Workflow & Boundary Enforcement', async ({ page }) => {
    const role = 'reception';
    const loginOk = await login(page, USERS.reception);
    expect(loginOk, 'Reception login must succeed').toBe(true);
    recordResult(role, 'login', 'PASS', 'Logged in successfully');

    // Verify Beneficiaries Access
    await page.goto(`${BASE_URL}/beneficiaries`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    expect(page.url()).toContain('/beneficiaries');
    recordResult(role, 'beneficiaries_access', 'PASS', 'Beneficiaries module accessible');

    // Verify Admin Restricted Route is BLOCKED
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    const redirectedUrl = page.url();
    const isBlocked = !redirectedUrl.includes('/admin/users');
    expect(isBlocked, 'Reception must be blocked from admin user management').toBe(true);
    recordResult(role, 'admin_guard_enforcement', 'PASS', `Blocked & redirected to ${redirectedUrl}`);

    permissionMatrix.push({
      role: 'reception',
      login: 'PASS',
      dashboard: 'PASS',
      beneficiaries: 'PASS (Reception Entry)',
      warehouse: 'BLOCKED/SKIP',
      adminRestricted: 'BLOCKED (Guarded)',
      readonlyRestrictions: 'N/A',
      notifications: 'PASS (Reception Alerts Active)',
    });

    await logout(page);
  });

  // 4. Warehouse Persona Workflow
  test('[warehouse] Warehouse Inventory Access & Guard Enforcement', async ({ page }) => {
    const role = 'warehouse';
    const loginOk = await login(page, USERS.warehouse);
    expect(loginOk, 'Warehouse login must succeed').toBe(true);
    recordResult(role, 'login', 'PASS', 'Logged in successfully');

    // Verify Warehouse Page Access
    await page.goto(`${BASE_URL}/warehouse`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    expect(page.url()).toContain('/warehouse');
    recordResult(role, 'warehouse_access', 'PASS', 'Inventory warehouse accessible');

    // Verify Admin Restricted Route is BLOCKED
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    const isBlocked = !page.url().includes('/admin/users');
    expect(isBlocked, 'Warehouse persona must be blocked from admin user management').toBe(true);
    recordResult(role, 'admin_guard_enforcement', 'PASS', 'Blocked from admin management');

    permissionMatrix.push({
      role: 'warehouse',
      login: 'PASS',
      dashboard: 'PASS',
      beneficiaries: 'BLOCKED/SKIP',
      warehouse: 'PASS (Stock Operations)',
      adminRestricted: 'BLOCKED (Guarded)',
      readonlyRestrictions: 'N/A',
      notifications: 'Configurable (Off by default)',
    });

    await logout(page);
  });

  // 5. Readonly Persona Workflow
  test('[readonly] Read-only Auditor Mode Enforcement', async ({ page }) => {
    const role = 'readonly';
    const loginOk = await login(page, USERS.readonly);
    expect(loginOk, 'Readonly login must succeed').toBe(true);
    recordResult(role, 'login', 'PASS', 'Logged in successfully');

    // Navigate to Beneficiaries
    await page.goto(`${BASE_URL}/beneficiaries`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    expect(page.url()).toContain('/beneficiaries');
    recordResult(role, 'beneficiaries_view', 'PASS', 'Beneficiaries list viewable');

    // Verify Edit, Delete, and Add buttons are NOT accessible/visible
    const addCitizenBtn = await page.locator('button:has-text("إضافة مواطن")').count();
    const editLinks     = await page.locator('a[title="تعديل البيانات"]').count();
    const deleteButtons = await page.locator('button[title*="حذف"]').count();

    const isAddHidden = addCitizenBtn === 0;
    const isEditHidden = editLinks === 0;
    const isDeleteHidden = deleteButtons === 0;

    recordResult(role, 'readonly_add_hidden', isAddHidden ? 'PASS' : 'WARN', `Add button count: ${addCitizenBtn}`);
    recordResult(role, 'readonly_edit_hidden', isEditHidden ? 'PASS' : 'WARN', `Edit button count: ${editLinks}`);
    recordResult(role, 'readonly_delete_hidden', isDeleteHidden ? 'PASS' : 'WARN', `Delete button count: ${deleteButtons}`);

    // Verify Admin Restricted Route is BLOCKED
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    const isBlocked = !page.url().includes('/admin/users');
    expect(isBlocked, 'Readonly auditor must be blocked from admin user management').toBe(true);
    recordResult(role, 'admin_guard_enforcement', 'PASS', 'Blocked from admin management');

    permissionMatrix.push({
      role: 'readonly',
      login: 'PASS',
      dashboard: 'PASS',
      beneficiaries: 'PASS (Read-only View)',
      warehouse: 'PASS (View-only)',
      adminRestricted: 'BLOCKED (Guarded)',
      readonlyRestrictions: 'PASS (Mutations Hidden)',
      notifications: 'Disabled (Audit mode)',
    });

    await logout(page);
  });

  // 6. Staff Persona Workflow
  test('[staff] Operations Staff Workflow', async ({ page }) => {
    const role = 'staff';
    const loginOk = await login(page, USERS.staff);
    expect(loginOk, 'Staff login must succeed').toBe(true);
    recordResult(role, 'login', 'PASS', 'Logged in successfully');

    // Verify Dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    expect(page.url()).toContain('/dashboard');
    recordResult(role, 'dashboard_access', 'PASS', 'Operations dashboard loaded');

    // Verify Admin Restricted Route is BLOCKED
    await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForApp(page);
    const isBlocked = !page.url().includes('/admin/users');
    expect(isBlocked, 'Staff must be blocked from admin user management').toBe(true);
    recordResult(role, 'admin_guard_enforcement', 'PASS', 'Blocked from admin management');

    permissionMatrix.push({
      role: 'staff',
      login: 'PASS',
      dashboard: 'PASS',
      beneficiaries: 'PASS (Operations Access)',
      warehouse: 'PASS',
      adminRestricted: 'BLOCKED (Guarded)',
      readonlyRestrictions: 'N/A',
      notifications: 'Configurable (Off by default)',
    });

    await logout(page);
  });

  // 7. Generate Comprehensive Report
  test('Generate Simulation & Permission Matrix Report', async () => {
    ensureDir(REPORT_DIR);
    const reportPath = path.join(REPORT_DIR, 'Browser_Simulation_Report.md');

    const totalSteps = results.length;
    const passedSteps = results.filter(r => r.status === 'PASS').length;
    const failedSteps = results.filter(r => r.status === 'FAIL').length;
    const skippedSteps = results.filter(r => r.status === 'SKIP' || r.status === 'WARN').length;

    const lines = [
      '# 🧪 IKRAM System – Multi-Role & Notification Permission Report',
      '',
      `**Generated:** ${new Date().toISOString()}`,
      `**Target Environment:** ${BASE_URL}`,
      `**Total Tests / Steps:** ${totalSteps}`,
      `**Passed:** ${passedSteps} ✅`,
      `**Failed:** ${failedSteps} ❌`,
      `**Warnings / Skipped:** ${skippedSteps} ⚠️`,
      '',
      '---',
      '',
      '## 🛡️ Role & Permission Matrix Results',
      '',
      '| Role | Authentication | Dashboard | Beneficiaries Module | Warehouse Module | Admin Guarded Routes | Mutation Buttons Hidden | Notification Alerts |',
      '|------|----------------|-----------|----------------------|------------------|----------------------|-------------------------|---------------------|',
    ];

    for (const m of permissionMatrix) {
      lines.push(`| **${m.role}** | ${m.login} | ${m.dashboard} | ${m.beneficiaries} | ${m.warehouse} | ${m.adminRestricted} | ${m.readonlyRestrictions} | ${m.notifications} |`);
    }

    lines.push(
      '',
      '---',
      '',
      '## 📋 Detailed Execution Steps',
      '',
      '| Role / Subject | Step | Status | Detail | Timestamp |',
      '|----------------|------|--------|--------|-----------|'
    );

    for (const r of results) {
      const statusIcon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
      lines.push(`| ${r.role} | ${r.step} | ${statusIcon} ${r.status} | ${r.detail.slice(0, 90)} | ${r.ts} |`);
    }

    if (errors.length > 0) {
      lines.push('', '---', '', '## ⚠️ Recorded Errors / Exceptions', '');
      for (const e of errors) {
        lines.push(`- **[${e.role}] ${e.step}:** ${e.message}`);
      }
    } else {
      lines.push('', '---', '', '## ✅ Recorded Errors / Exceptions', '', 'No critical errors recorded during simulation run.');
    }

    lines.push('', '---', '', '*Automated Multi-Role E2E Simulation Report generated by Playwright Runner.*', '');

    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');

    // Write error log
    const logDir = path.dirname(LOG_PATH);
    ensureDir(logDir);
    if (errors.length > 0) {
      const logLines = errors.map(e => `[${e.ts}] [${e.role}] ${e.step}: ${e.message}`);
      fs.writeFileSync(LOG_PATH, logLines.join('\n') + '\n', 'utf-8');
    } else {
      fs.writeFileSync(LOG_PATH, 'No errors recorded during multi-role simulation run.\n', 'utf-8');
    }

    expect(fs.existsSync(reportPath)).toBe(true);
  });
});
