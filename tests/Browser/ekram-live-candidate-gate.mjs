import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

let stdin = ''; for await (const chunk of process.stdin) stdin += chunk;
const input = JSON.parse(stdin);
const target = new URL(input.candidate_origin);
if (input.candidate_ready !== true || !input.expected_revision || target.protocol !== 'https:' || (!target.hostname.endsWith('.azurecontainerapps.io') || !target.hostname.startsWith(input.expected_revision + '.')) || target.pathname !== '/' || target.search || target.hash) throw new Error('Exact ready candidate HTTPS origin required');
const base = target.origin; const root = process.cwd(); const output = path.join(root, 'deployment');
const evidence = path.join(root, '.tmp/ekram-live-candidate'); fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(evidence, { recursive: true });
const auth = { ...input.auth }; const ids = input.ids; const results = []; const issues = []; const created = []; let browserCitizen;
const secrets = [auth.token, input.actor?.password, input.driver_token, ...Object.values(input.codes || {})].filter(Boolean);
const sanitize = text => { let value = String(text); for (const secret of secrets) value = value.split(secret).join('[redacted]'); return value.replace(/https?:\/\/[^\s"'<>]+/g, '[candidate-resource]').replace(/[a-f0-9]{64}/gi, '[redacted]').replace(/\b[12][0-9]{9}\b/g, '[identity]').slice(0, 600); };
const check = async (browser, name, fn) => { try { await fn(); results.push({ browser, name, status: 'PASS' }); } catch (error) { results.push({ browser, name, status: 'FAIL', evidence: sanitize(error.message) }); } };
async function api(url, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + '/api' + url, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.token }, ...(body ? { body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error(`Candidate API ${method} ${url.split('?')[0]} returned ${response.status}`);
  return response.headers.get('content-type')?.includes('json') ? response.json() : Buffer.from(await response.arrayBuffer());
}
async function monitoredContext(browser, options = {}, authenticated = false) {
  const context = await browser.newContext({ acceptDownloads: true, ...options });
  await context.route('**/*', route => { const url = new URL(route.request().url()); const approvedDocumentGet = url.origin === 'https://stikramprod399c8d.blob.core.windows.net' && route.request().method() === 'GET'; if (url.origin !== base && !approvedDocumentGet && !['data:', 'blob:'].includes(url.protocol)) { issues.push({ type: 'external-request-blocked', path: sanitize(url.pathname) }); return route.abort(); } return route.continue(); });
  if (authenticated) await context.addInitScript(a => { localStorage.setItem('token', a.token); localStorage.setItem('user', JSON.stringify(a.user)); }, auth);
  context.on('page', page => {
    page.setDefaultTimeout(20000); page.setDefaultNavigationTimeout(30000);
    page.on('pageerror', error => issues.push({ type: 'application-exception', message: sanitize(error.message) }));
    page.on('console', message => { if (message.type() === 'error') issues.push({ type: 'console-error', message: sanitize(message.text()) }); });
    page.on('response', response => { if (response.status() >= 400) issues.push({ type: 'unexpected-http', status: response.status(), path: sanitize(new URL(response.url()).pathname) }); });
  });
  return context;
}
let chrome; let edge; let adminContext; let clean;
try {
  chrome = await chromium.launch({ channel: 'chrome', headless: true });
  adminContext = await monitoredContext(chrome, { viewport: { width: 1440, height: 1000 } }); const page = await adminContext.newPage();
  await check('Chrome', 'dedicated synthetic admin UI login', async () => {
    await page.goto(base + '/login'); await page.getByPlaceholder('أدخل اسم المستخدم').fill(input.actor.username); await page.locator('input[type="password"]').fill(input.actor.password);
    const login = page.waitForResponse(r => new URL(r.url()).pathname === '/api/login' && r.request().method() === 'POST'); await page.getByRole('button', { name: 'تسجيل الدخول الآمن' }).click(); const response = await login;
    if (!response.ok()) throw new Error('Synthetic admin UI login rejected'); const payload = await response.json(); auth.token = payload.data.token; auth.user = payload.data.user; secrets.push(auth.token);
    await page.waitForURL(base + '/dashboard');
  });
  for (const route of ['/beneficiaries', '/beneficiaries/' + ids.beneficiaries[0], '/beneficiaries/add-citizen', '/beneficiaries/add-resident', '/receiver?task=' + ids.pickup, '/delivery?task=' + ids.delivery[0], '/governance', '/admin/settings']) await check('Chrome', 'candidate page smoke ' + route.split('?')[0].replace(ids.beneficiaries[0], 'TEST-ID'), async () => { await page.goto(base + route); await page.locator('main').first().waitFor(); if (new URL(page.url()).pathname !== route.split('?')[0]) throw new Error('Granted candidate page redirected unexpectedly'); });
  await check('Chrome', 'policy administration real settings route', async () => { await page.goto(base + '/admin/settings'); await page.getByRole('heading', { name: /إصدارات سياسة المستفيدين/ }).waitFor(); });
  await check('Chrome', 'driver management real home delivery route', async () => { await page.goto(base + '/delivery'); await page.getByRole('heading', { name: 'تكليف سائق بمهام التوصيل المحددة', exact: true }).waitFor(); await page.getByLabel('السائق', { exact: true }).waitFor(); });
  await check('Chrome', 'reports real governance route', async () => { await page.goto(base + '/governance'); await page.locator('main').first().waitFor(); if (new URL(page.url()).pathname !== '/governance') throw new Error('Reports redirect'); });
  if (input.phase !== 'driver') {
    for (const [index, type] of ['citizen', 'resident'].entries()) await check('Chrome', type + ' registration explicit review confirmation', async () => {
      await page.goto(base + '/beneficiaries/add-' + type);
      const name = 'EKRAM-E2E-TEST ' + input.run_id + ' Browser ' + type;
      const identity = (type === 'citizen' ? '1' : '2') + String(800000000 + Number.parseInt(randomUUID().replaceAll('-', '').slice(0, 6), 16) % 99999999);
      for (const [key, value] of Object.entries({ full_name: name, national_id: identity, phone: '050000101' + index, date_of_birth: '1980-01-01', city: 'مكة المكرمة', district: 'EKRAM-E2E-TEST District', street: 'EKRAM-E2E-TEST Address', ...(type === 'resident' ? { nationality: 'EKRAM-E2E-TEST' } : {}) })) await page.locator(`[name="${key}"]`).fill(value);
      await page.getByRole('button', { name: /التالي/ }).click(); await page.locator('[name="family_status"]').selectOption('poor'); await page.locator('[name="family_members_count"]').fill('1'); await page.locator('[name="housing_type"]').selectOption('own');
      await page.getByRole('button', { name: /التالي/ }).click(); await page.getByRole('button', { name: /التالي/ }).click();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
      for (const field of [type === 'citizen' ? 'national_id_image' : 'residence_id_image', 'national_address_image']) await page.locator(`[name="${field}"]`).setInputFiles({ name: 'EKRAM-E2E-TEST.png', mimeType: 'image/png', buffer: png });
      await page.getByRole('button', { name: /التالي/ }).click(); const save = page.getByRole('button', { name: 'حفظ وتصنيف المستفيد' }); if (!await save.isDisabled()) throw new Error('Review confirmation bypass');
      await page.getByRole('checkbox', { name: /راجعت بيانات/ }).check(); const saving = page.waitForResponse(r => new URL(r.url()).pathname === '/api/beneficiaries' && r.request().method() === 'POST'); await save.click(); const response = await saving; if (response.status() !== 201) throw new Error('Reviewed registration failed');
      const record = (await response.json()).data; created.push({ entity: 'beneficiary', id: record.id }); if (type === 'citizen') browserCitizen = record.id; const persisted = await api('/beneficiaries/' + record.id); if (!persisted.data.confirmed_at) throw new Error('Confirmation timestamp missing');
      const evaluations = await api(`/beneficiary-policy/beneficiaries/${record.id}/evaluations`); if (type === 'resident' && evaluations.data.some(e => e.eligibility_decision !== 'not_applicable')) throw new Error('Resident inherited citizen policy');
      await page.waitForURL(base + '/beneficiaries'); await page.goto(base + '/beneficiaries/' + record.id); await page.getByText(name, { exact: true }).first().waitFor();
    });
    await check('Chrome', 'published policy evaluation and review workspace', async () => {
      if (!browserCitizen) throw new Error('Browser citizen registration prerequisite failed'); await page.goto(base + '/beneficiaries/' + browserCitizen); const versions = await api('/beneficiary-policy/versions'); const rows = versions.data?.data || versions.data || []; const published = rows.find(v => v.id === ids.policy && v.status === 'published'); if (!published) throw new Error('Exact synthetic published policy unavailable');
      await page.getByLabel('إصدار السياسة').selectOption(published.id); const evaluation = page.waitForResponse(r => new URL(r.url()).pathname === '/api/beneficiary-policy/evaluate'); await page.getByRole('button', { name: 'إنشاء تقييم جديد' }).click(); if (!(await evaluation).ok()) throw new Error('Policy evaluation failed');
      await page.getByRole('link', { name: /مراجعة التقييم/ }).first().click(); await page.waitForURL(/beneficiary-policy\/review\//); await page.locator('main').first().waitFor();
    });
    await check('Chrome', 'same reviewed browser citizen home delivery request approval reservation readiness cancellation', async () => {
      if (!browserCitizen) throw new Error('Browser citizen missing');
      const evaluations = await api(`/beneficiary-policy/beneficiaries/${browserCitizen}/evaluations`); if (!evaluations.data.some(e => e.policy_version_id === ids.policy)) throw new Error('Connected policy evaluation missing');
      await page.goto(base + '/support/request?beneficiary=' + browserCitizen); await page.getByLabel('طريقة التسليم').selectOption('delivery'); await page.getByLabel('الصنف 1').selectOption(ids.inventory); await page.getByLabel('الكمية 1').fill('1'); await page.locator('textarea').fill('EKRAM-E2E-TEST ' + input.run_id + ' connected browser journey');
      const saving = page.waitForResponse(r => new URL(r.url()).pathname === '/api/support/distributions' && r.request().method() === 'POST'); await page.getByRole('button', { name: 'حفظ مسودة طلب الدعم' }).click(); const response = await saving; if (!response.ok()) throw new Error('UI support creation failed'); const task = (await response.json()).data; created.push({ entity: 'distribution', id: task.id });
      await page.waitForURL(base + '/delivery?task=' + task.id); const row = page.locator('tr').filter({ hasText: task.id });
      for (const [action, label, expected] of [['approve', 'اعتماد', 'approved'], ['reserve', 'حجز المخزون', 'reserved'], ['ready', 'تجهيز', 'ready']]) {
        const changing = page.waitForResponse(r => new URL(r.url()).pathname === `/api/support/distributions/${task.id}/${action}` && r.request().method() === 'PATCH'); await row.getByRole('button', { name: label, exact: true }).click(); if (!(await changing).ok()) throw new Error('UI support transition failed'); const state = await api(`/support/distributions/${task.id}`); if (state.data.status !== expected || state.data.beneficiary_id !== browserCitizen || state.data.fulfillment_method !== 'delivery') throw new Error('Connected support state mismatch');
      }
      page.once('dialog', dialog => dialog.accept()); const cancelling = page.waitForResponse(r => new URL(r.url()).pathname === `/api/support/distributions/${task.id}/cancel` && r.request().method() === 'PATCH'); await row.getByRole('button', { name: 'إلغاء الدعم', exact: true }).click(); if (!(await cancelling).ok()) throw new Error('Synthetic cancellation failed'); const cancelled = await api(`/support/distributions/${task.id}`); if (cancelled.data.status !== 'cancelled') throw new Error('Synthetic stock release not confirmed');
    });
  }
  if (input.phase !== 'smoke') {
    if (!input.driver_token || !input.codes || input.live_driver_send_verified !== true) throw new Error('Driver phase requires root-controlled live driver-send evidence and transient capability/code inputs');
    edge = await chromium.launch({ channel: 'msedge', headless: true }); clean = await monitoredContext(edge, { viewport: { width: 390, height: 844 } }); const portal = await clean.newPage();
    await check('Edge InPrivate', 'only scoped multiple tasks rendered without application account', async () => {
      await portal.goto(base + '/driver-access#' + input.driver_token); await portal.getByRole('heading', { name: 'مهام التوصيل', exact: true }).waitFor(); if (new URL(portal.url()).hash) throw new Error('Capability remains in browser URL'); if (await portal.evaluate(() => localStorage.getItem('token'))) throw new Error('Driver unexpectedly needs application session');
      for (const id of ids.delivery) await portal.getByText('رقم المهمة: ' + id, { exact: true }).waitFor(); if (await portal.getByText('رقم المهمة: ' + ids.pickup, { exact: true }).count()) throw new Error('Unassigned pickup exposed');
      const response = await fetch(base + '/api/driver-access', { headers: { Accept: 'application/json', 'X-Driver-Token': input.driver_token } }); const view = await response.json(); if (response.status !== 200 || view.data.tasks.length !== ids.delivery.length || view.data.tasks.some(t => !ids.delivery.includes(t.id))) throw new Error('Scoped API task set mismatch');
      if (view.data.tasks.some(t => !t.recipient_name?.startsWith('EKRAM-E2E-TEST') || !t.phone || !t.address || !t.support_type)) throw new Error('Required driver task fields missing');
    });
    await check('Edge InPrivate', 'scoped delivery confirmations and safe replay', async () => {
      for (const id of ids.delivery) {
        const card = portal.locator('article').filter({ hasText: id }); await card.getByRole('button', { name: 'عرض المهمة وتأكيد الاستلام' }).click(); await portal.getByLabel('رمز الاستلام من المستلم').fill(input.codes[id]);
        const confirm = portal.waitForResponse(r => new URL(r.url()).pathname.endsWith('/tasks/' + id + '/confirm')); await portal.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).click(); if ((await confirm).status() !== 200) throw new Error('Driver confirmation failed');
        const replay = await fetch(base + `/api/driver-access/tasks/${id}/confirm`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Driver-Token': input.driver_token }, body: JSON.stringify({ code: input.codes[id] }) }); const state = await replay.json(); if (replay.status !== 200 || !state.already_completed) throw new Error('Driver replay not safely idempotent');
      }
      await portal.getByText('اكتمل التكليف', { exact: true }).waitFor(); if (await portal.locator('input').count()) throw new Error('Completed screenshot still exposes a code input'); await portal.screenshot({ path: path.join(evidence, 'driver-completed-sanitized.png'), fullPage: true });
    });
    await check('Edge InPrivate', 'tampered capability and unrelated task denied once', async () => {
      const tampered = input.driver_token.slice(0, -1) + (input.driver_token.endsWith('a') ? 'b' : 'a');
      const invalid = await fetch(base + '/api/driver-access', { headers: { Accept: 'application/json', 'X-Driver-Token': tampered } }); if (invalid.status !== 401) throw new Error('Tampered capability not rejected');
      const wrong = await fetch(base + `/api/driver-access/tasks/${ids.pickup}`, { headers: { Accept: 'application/json', 'X-Driver-Token': input.driver_token } }); if (wrong.status !== 404) throw new Error('Unrelated task not denied');
    });
    await check('Chrome', 'supervisor completed tasks filters and immutable proof PDFs', async () => {
      for (const id of ids.delivery) { await page.goto(base + '/delivery?task=' + id); await page.getByRole('row').filter({ hasText: id }).getByText('مكتمل', { exact: true }).waitFor(); const list = await api('/support/distributions?reference=' + id); if (list.data.length !== 1 || list.data[0].status !== 'completed' || !list.data[0].proof_available) throw new Error('Supervisor completed state missing'); const pdf = await api(`/support/distributions/${id}/proof`); if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('Delivery proof PDF missing'); }
    });
    await check('Chrome', 'independent direct handover receipt Excel and PDF', async () => {
      await page.goto(base + '/receiver?task=' + ids.pickup); await page.getByLabel('مرجع الدعم').fill(ids.pickup); await page.getByLabel('رمز الاستلام', { exact: true }).fill(input.codes[ids.pickup]); await page.getByRole('button', { name: 'تحقق', exact: true }).click(); await page.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).click(); await page.getByText('تم تأكيد الاستلام وحفظ الإيصال.').waitFor();
      const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'تصدير Excel' }).click(); if (!(await download).suggestedFilename().endsWith('.xlsx')) throw new Error('Filtered receipt Excel missing'); const pdf = await api(`/support/distributions/${ids.pickup}/proof`); if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('Pickup PDF missing');
      const replay = await api(`/support/distributions/${ids.pickup}/verify`, { code: input.codes[ids.pickup] }); if (!replay.already_completed) throw new Error('Pickup replay unsafe');
    });
    await check('Chrome', 'notification exact target persisted read', async () => {
      await page.goto(base + '/dashboard'); await page.getByRole('button', { name: 'التنبيهات والإشعارات' }).click(); const notifications = await api('/notifications'); const notification = notifications.data.find(n => n.action_url?.includes('task=') && [...ids.delivery, ids.pickup].some(id => n.action_url.includes(id))); if (!notification) throw new Error('Synthetic notification deep link missing');
      await page.getByText(notification.message_body, { exact: true }).first().click(); await page.getByRole('button', { name: 'فتح السجل' }).click(); await page.waitForURL(base + notification.action_url); const read = await api('/notifications'); if (!read.data.find(n => n.id === notification.id)?.read_at) throw new Error('Read state not persisted');
    });
  }
} catch (error) { results.push({ browser: 'Environment', name: 'candidate orchestration prerequisites', status: 'FAIL', evidence: sanitize(error.message) }); }
finally { if (clean) await clean.close(); if (adminContext) await adminContext.close(); if (edge) await edge.close(); if (chrome) await chrome.close(); }
const summary = { passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length, networkIssues: issues.filter(i => i.type === 'unexpected-http').length, criticalConsoleIssues: issues.filter(i => ['application-exception', 'console-error'].includes(i.type)).length };
const report = { revision: input.expected_revision, phase: input.phase || 'full', summary, results, issues, created, productionTrafficPromoted: false, liveSmsPerformedByThisRunner: 0 };
fs.writeFileSync(path.join(output, 'EKRAM-LIVE-DRIVER-E2E-' + (input.phase || 'full') + '.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(output, 'EKRAM-LIVE-DRIVER-E2E.md'), '# Controlled candidate browser evidence\n\nCandidate revision: ' + input.expected_revision + '\n\nNo production traffic promotion or SMS provider calls are performed by this browser runner. Root supplies the candidate and controlled-send evidence. Driver tokens, codes and credentials remain in process memory.\n\n| Browser | Gate | Result |\n| --- | --- | --- |\n' + results.map(r => `| ${r.browser} | ${r.name} | ${r.status} |`).join('\n') + '\n\nCleanup must be independently confirmed by the bounded exact-ID cleanup script before promotion. HTTP/API evidence cannot alone prove inventory/audit atomicity; the bounded runtime verification supplies those counts. PDF byte signatures confirm generation; institutional snapshot content requires the separate document verification.\n');
console.log(JSON.stringify({ summary, results, issues, created })); process.exitCode = summary.failed || summary.networkIssues || summary.criticalConsoleIssues ? 1 : 0;
