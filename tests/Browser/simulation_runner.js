// tests/Browser/simulation_runner.js
// Playwright E2E simulation runner for IKRAM SYSTEM

import { test, expect, chromium } from '@playwright/test';
import { randomSleep, logError } from './helpers.js';
import { promises as fs } from 'fs';

// Configuration
const BASE_URL = process.env.APP_URL || 'http://ikram-system.test';

const CREDENTIALS = {
  admin: { email: 'admin@ikram.test', password: 'password' },
  reception: { email: 'reception@ikram.test', password: 'password' },
  staff: { email: 'staff@ikram.test', password: 'password' },
  warehouse: { email: 'warehouse@ikram.test', password: 'password' },
  auditor: { email: 'readonly@ikram.test', password: 'password' },
};

let stats = {
  actions: 0,
  successes: 0,
  failures: 0,
  errors: []
};

async function captureConsole(page) {
  page.on('console', async msg => {
    if (msg.type() === 'error') {
      const errorMsg = `[Console Error] ${msg.text()} - URL: ${page.url()}`;
      await logError(errorMsg);
      stats.errors.push(errorMsg);
    }
  });

  page.on('response', async response => {
    if (!response.ok()) {
      const err = `[HTTP ${response.status()}] ${response.url()}`;
      await logError(err);
      stats.errors.push(err);
    }
  });
}

async function login(page, role) {
  const { email, password } = CREDENTIALS[role];
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/);
  stats.actions++; stats.successes++;
}

async function logout(page) {
  await page.click('text=Logout');
  await expect(page).toHaveURL(/\/login/);
  stats.actions++; stats.successes++;
}

async function beneficiaryWorkflow(page) {
  const timestamp = Date.now();
  const testName = `TEST_E2E_BENEFICIARY_${timestamp}`;
  await page.goto(`${BASE_URL}/beneficiaries`);
  await page.click('text=Add Beneficiary');
  await page.fill('input[name="full_name"]', testName);
  await page.fill('input[name="national_id"]', `${timestamp}`);
  await page.fill('input[name="phone"]', '0123456789');
  await page.click('button:has-text("Save")');
  await expect(page).toHaveURL(/beneficiaries/);
  stats.actions++; stats.successes++;

  // Search and edit
  await page.fill('input[placeholder="Search"]', testName);
  await page.press('input[placeholder="Search"]', 'Enter');
  await page.waitForSelector(`text=${testName}`);
  await page.click(`text=${testName}`);
  await page.fill('input[name="phone"]', '0987654321');
  await page.click('button:has-text("Save")');
  await expect(page).toHaveURL(/beneficiaries/);
  stats.actions++; stats.successes++;

  // Verify persistence
  await page.fill('input[placeholder="Search"]', testName);
  await page.press('input[placeholder="Search"]', 'Enter');
  const exists = await page.isVisible(`text=${testName}`);
  if (!exists) {
    const err = `Beneficiary ${testName} disappeared after edit`;
    await logError(err);
    stats.errors.push(err);
    stats.failures++;
  } else {
    stats.successes++;
  }
  stats.actions++;
}

async function notificationsWorkflow(page) {
  await page.click('css=header .notification-bell');
  const counter = await page.innerText('.notification-counter');
  if (counter.trim() !== '0') {
    await page.click('text=Mark all as read');
    await expect(page.locator('.notification-counter')).toHaveText('0');
    stats.actions += 2; stats.successes += 2;
  }
}

async function inventoryWorkflow(page) {
  await page.goto(`${BASE_URL}/inventory`);
  await page.waitForSelector('.inventory-item');
  await page.click('.inventory-item:first-child .edit-button');
  await page.fill('input[name="quantity"]', '10');
  await page.click('button:has-text("Save")');
  await expect(page.locator('.inventory-item:first-child')).toContainText('10');
  stats.actions += 3; stats.successes += 3;
}

async function runPersona(role) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await captureConsole(page);

  await login(page, role);
  await randomSleep();

  if (role === 'admin') {
    await notificationsWorkflow(page);
    await randomSleep();
  }

  if (role === 'admin' || role === 'reception') {
    await beneficiaryWorkflow(page);
    await randomSleep();
  }

  if (role === 'warehouse') {
    await inventoryWorkflow(page);
    await randomSleep();
  }

  await logout(page);
  await browser.close();
}

async function generateReport() {
  const reportPath = 'storage/app/reports/Browser_Simulation_Report.md';
  const content = `# Browser Simulation Report\n\n` +
    `**Base URL:** ${BASE_URL}\n\n` +
    `## Summary\n` +
    `- Total actions executed: ${stats.actions}\n` +
    `- Successes: ${stats.successes}\n` +
    `- Failures: ${stats.failures}\n` +
    `- Errors logged: ${stats.errors.length}\n\n` +
    `## Errors\n` +
    `${stats.errors.map(e => `- ${e}`).join('\n') || 'None'}\n\n` +
    `## Disappearing Data Verdict\n` +
    `${stats.failures > 0 ? 'Potential data persistence issue detected.' : 'No disappearance observed.'}\n`;
  await fs.mkdir('storage/app/reports', { recursive: true });
  await fs.writeFile(reportPath, content);
}

(async () => {
  try {
    await fs.mkdir('storage/logs', { recursive: true });
    await runPersona('admin');
    await runPersona('reception');
    await runPersona('staff');
    await runPersona('warehouse');
    await runPersona('auditor');
    await generateReport();
    console.log('Simulation completed. Report at storage/app/reports/Browser_Simulation_Report.md');
  } catch (e) {
    const err = `Simulation runner error: ${e.message}`;
    await logError(err);
    console.error(err);
  }
})();
