import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const root = process.cwd();
const work = path.join(root, '.tmp/ekram-remediation');
const build = path.join(work, 'frontend-build');
const reports = path.join(root, 'reports');
fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(reports, { recursive: true });
const results = []; const manifest = { marker: 'EKRAM-E2E-TEST', records: [], cleanup: [], noLiveSms: true, noProductionAccess: true };
let sequence = 1;
const safeError = error => String(error.message || error.name).replace(/[a-f0-9]{64}/gi, '[redacted]').replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 700);
function fixture(env, input) {
  const result = spawnSync('php', ['tests/Browser/ekram-remediation-fixture.php'], { cwd: root, env, input: JSON.stringify(input), encoding: 'utf8' });
  if (result.status !== 0) throw new Error('Isolated fixture/preflight failed; inspect source, secret output suppressed');
  return JSON.parse(result.stdout);
}
async function check(browser, name, fn) {
  try { await fn(); results.push({ browser, name, status: 'PASS' }); console.log(`${browser}: ${name}: PASS`); }
  catch (error) { results.push({ browser, name, status: 'FAIL', evidence: safeError(error) }); console.log(`${browser}: ${name}: FAIL: ${safeError(error)}`); }
}
const compile = spawnSync(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/c', 'npm', 'run', 'build', '--', '--outDir', build] : ['run', 'build', '--', '--outDir', build], { cwd: path.join(root, 'frontend'), env: { ...process.env, VITE_API_URL: '/api', VITE_SENTRY_DSN: '' }, encoding: 'utf8' });
if (compile.status !== 0) throw new Error('Dedicated frontend build failed');
const assetText = fs.readdirSync(path.join(build, 'assets')).filter(n => n.endsWith('.js')).map(n => fs.readFileSync(path.join(build, 'assets', n), 'utf8')).join('');
if (/https:\/\/[^"'\s]*azurecontainerapps[^"'\s]*\/api/i.test(assetText)) throw new Error('Hosted API found in isolated build');

for (const channel of ['chrome', 'msedge']) {
  let browser; let php; let frontend; let context; const forbidden = [];
  const database = path.join(work, `${channel}-${randomUUID()}.sqlite`); fs.writeFileSync(database, '');
  const phpPort = 22000 + Math.floor(Math.random() * 1500); const uiPort = phpPort + 1600;
  const base = `http://127.0.0.1:${uiPort}`; const backend = `http://127.0.0.1:${phpPort}`;
  const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: 'base64:' + randomBytes(32).toString('base64'), APP_URL: base, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', COMMUNICATION_PROVIDER: 'fake', SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', QUEUE_CONNECTION: 'database', FILESYSTEM_DISK: 'local', PUBLIC_FILESYSTEM_DRIVER: 'local', CACHE_STORE: 'array', SESSION_DRIVER: 'array', APP_CONFIG_CACHE: path.join(work, 'nonexistent-config.php') };
  try {
    browser = await chromium.launch({ channel, headless: true });
    const seeded = fixture(env, { username: 'EKRAM-E2E-TEST-' + randomUUID(), password: randomBytes(24).toString('hex') });
    const auth = seeded.auth; const ids = seeded.ids;
    manifest.records.push({ browser: channel, entities: ids });
    php = spawn('php', ['-S', `127.0.0.1:${phpPort}`, 'tests/Browser/ekram-remediation-fixture.php'], { cwd: root, env, stdio: 'ignore' });
    for (let i = 0; i < 50; i++) { try { if ((await fetch(backend + '/up')).ok) break; } catch {} await new Promise(r => setTimeout(r, 150)); }
    const safety = await (await fetch(backend + '/up')).json();
    if (safety.DB_DRIVER !== 'sqlite' || safety.COMMUNICATION_PROVIDER !== 'fake' || safety.TELEMETRY_DISABLED !== 'YES') throw new Error('Server resolved safety probe failed');
    frontend = http.createServer(async (req, res) => {
      try {
        if (req.url.startsWith('/api/')) {
          const chunks = []; for await (const chunk of req) chunks.push(chunk);
          const response = await fetch(backend + req.url, { method: req.method, headers: { ...req.headers, host: `127.0.0.1:${phpPort}` }, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: Buffer.concat(chunks) } : {}) });
          res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
        }
        const pathname = decodeURIComponent(new URL(req.url, base).pathname); const requested = path.resolve(build, '.' + pathname);
        const file = requested.startsWith(build + path.sep) && fs.existsSync(requested) && fs.statSync(requested).isFile() ? requested : path.join(build, 'index.html');
        const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.html': 'text/html' }[path.extname(file)] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': mime }); res.end(fs.readFileSync(file));
      } catch { res.writeHead(500); res.end('Isolated proxy failed'); }
    });
    await new Promise(resolve => frontend.listen(uiPort, '127.0.0.1', resolve));
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.route('**/*', route => { const url = new URL(route.request().url()); if (url.origin !== base && !['data:', 'blob:'].includes(url.protocol)) { forbidden.push(url.hostname); return route.abort(); } return route.continue(); });
    await context.addInitScript(a => { localStorage.setItem('token', a.token); localStorage.setItem('user', JSON.stringify(a.user)); }, auth);
    const page = await context.newPage(); page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(20000);
    const api = async (url, body, method = body ? 'POST' : 'GET') => {
      const response = await fetch(base + '/api' + url, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth.token }, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (!response.ok) throw new Error(`Synthetic API ${method} ${url} failed ${response.status}`);
      return response.headers.get('content-type')?.includes('json') ? response.json() : Buffer.from(await response.arrayBuffer());
    };
    await check(channel, 'authenticated loopback navigation', async () => { await page.goto(base + '/dashboard'); await page.waitForURL('**/dashboard'); await page.locator('main').first().waitFor(); });
    for (const type of ['citizen', 'resident']) await check(channel, `${type} registration explicit review`, async () => {
      await page.goto(base + '/beneficiaries/add-' + type);
      const n = sequence++; const name = `EKRAM-E2E-TEST ${channel} ${type} ${n}`;
      for (const [key, value] of Object.entries({ full_name: name, national_id: (type === 'citizen' ? '1' : '2') + String(900000000 + n), phone: '0501234567', date_of_birth: '1980-01-01', city: 'مكة المكرمة', district: 'EKRAM-E2E-TEST District', street: 'EKRAM-E2E-TEST Street', ...(type === 'resident' ? { nationality: 'EKRAM-E2E-TEST' } : {}) })) await page.locator(`[name="${key}"]`).fill(value);
      await page.getByRole('button', { name: /التالي/ }).click();
      await page.locator('[name="family_status"]').selectOption('poor'); await page.locator('[name="family_members_count"]').fill('1'); await page.locator('[name="housing_type"]').selectOption('own');
      await page.getByRole('button', { name: /التالي/ }).click(); await page.getByRole('button', { name: /التالي/ }).click();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');
      for (const field of [type === 'citizen' ? 'national_id_image' : 'residence_id_image', 'national_address_image']) await page.locator(`[name="${field}"]`).setInputFiles({ name: 'EKRAM-E2E-TEST.png', mimeType: 'image/png', buffer: png });
      await page.getByRole('button', { name: /التالي/ }).click();
      const save = page.getByRole('button', { name: /حفظ وتصنيف المستفيد/ }); if (!await save.isDisabled()) throw new Error('Final save enabled without explicit review');
      await page.getByRole('checkbox', { name: /راجعت بيانات/ }).check();
      const request = page.waitForResponse(r => r.url().endsWith('/api/beneficiaries') && r.request().method() === 'POST'); await save.click(); const saved = await request;
      if (saved.status() !== 201 && saved.status() !== 200) throw new Error(`Reviewed registration response ${saved.status()}`);
      const created = await saved.json(); const beneficiaryId = created.data?.id;
      manifest.records.push({ browser: channel, entity: 'beneficiary', id: beneficiaryId, marker: name, type, createdThrough: 'UI' });
      if (!beneficiaryId) throw new Error('Registration did not return beneficiary ID'); const persisted = await api('/beneficiaries/' + beneficiaryId); if (!persisted.data.confirmed_at) throw new Error('Explicit confirmation not persisted'); if (type === 'resident') { const evaluations = await api(`/beneficiary-policy/beneficiaries/${beneficiaryId}/evaluations`); if (evaluations.data.some(e => e.eligibility_decision !== 'not_applicable')) throw new Error('Resident inherited citizen policy'); }
      await page.waitForURL(base + '/beneficiaries'); await page.goto(base + '/beneficiaries/' + beneficiaryId); await page.reload(); await page.getByText(name, { exact: true }).first().waitFor();
    });
    await check(channel, 'beneficiary detail support request entry', async () => { await page.goto(base + '/beneficiaries/' + ids.beneficiary); await page.getByRole('link', { name: /طلب دعم/ }).first().click(); await page.waitForURL(/support/); await page.locator('main').first().waitFor(); await page.getByLabel('موقع الاستلام').selectOption(ids.location); await page.getByLabel('الصنف 1').selectOption(ids.stock); const saved = page.waitForResponse(r => r.url().endsWith('/api/support/distributions') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'حفظ مسودة طلب الدعم' }).click(); const response = await saved; if (response.status() !== 201) throw new Error('UI support draft creation rejected'); const created = await response.json(); manifest.records.push({ browser: channel, entity: 'support_draft', id: created.data.id, createdThrough: 'UI' }); });
    await check(channel, 'policy new evaluation immutable history and review workspace', async () => {
      await page.goto(base + '/beneficiaries/' + ids.beneficiary); await page.getByLabel('إصدار السياسة').selectOption(ids.policy);
      const evaluated = page.waitForResponse(r => r.url().endsWith('/api/beneficiary-policy/evaluate') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'إنشاء تقييم جديد' }).click(); const response = await evaluated; if (!response.ok()) throw new Error('UI policy evaluation rejected');
      const before = await api(`/beneficiary-policy/beneficiaries/${ids.beneficiary}/evaluations`); if (!before.data.length) throw new Error('Evaluation snapshot not persisted');
      const original = JSON.stringify(before.data[0]); const again = page.waitForResponse(r => r.url().endsWith('/api/beneficiary-policy/evaluate') && r.request().method() === 'POST'); await page.getByRole('button', { name: 'إنشاء تقييم جديد' }).click(); if (!(await again).ok()) throw new Error('Second policy evaluation rejected'); const after = await api(`/beneficiary-policy/beneficiaries/${ids.beneficiary}/evaluations`); if (after.data.length !== before.data.length + 1 || JSON.stringify(after.data.find(e => e.id === before.data[0].id)) !== original) throw new Error('Historical policy snapshot was mutated');
      const review = page.getByRole('link', { name: /مراجعة التقييم/ }).first(); await review.click(); await page.waitForURL(/beneficiary-policy\/review\//); await page.locator('main').first().waitFor();
      manifest.records.push({ browser: channel, entity: 'policy_evaluation', id: before.data[0].id, createdThrough: 'UI', decision: before.data[0].current_state });
    });
    await check(channel, 'pickup preview confirmation and idempotent replay', async () => {
      await api(`/support/distributions/${ids.pickup}/receipt-code`, {}); const code = fixture(env, { mode: 'inspect' }).codes[ids.pickup]; if (!code) throw new Error('Receipt code missing from synthetic outbox');
      await page.goto(base + '/receiver?task=' + ids.pickup); await page.getByLabel('مرجع الدعم').fill(ids.pickup); await page.getByLabel('رمز الاستلام', { exact: true }).fill(code); await page.getByRole('button', { name: 'تحقق', exact: true }).click(); await page.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).click();
      await page.getByText('تم تأكيد الاستلام وحفظ الإيصال.').waitFor(); const replay = await api(`/support/distributions/${ids.pickup}/verify`, { code }); if (replay.status !== 200) throw new Error('Receipt replay failed');
      const support = await api(`/support/distributions/${ids.pickup}`); if (support.data.status !== 'completed') throw new Error('Completed pickup not persisted');
    });
    await check(channel, 'pickup Excel and receipt PDF', async () => {
      await page.goto(base + '/receiver'); const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'تصدير Excel' }).click(); const download = await downloaded; if (!(download.suggestedFilename().endsWith('.xlsx'))) throw new Error('Excel download missing');
      const pdf = await api(`/support/distributions/${ids.pickup}/proof`); if (!Buffer.isBuffer(pdf) || pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('Receipt PDF missing');
      fs.writeFileSync(path.join(work, channel + '-receipt.pdf'), pdf);
    });
    let driverToken; let assignmentId; let deliveryCode;
    await check(channel, 'home delivery driver management assignment fake SMS', async () => {
      await page.goto(base + '/delivery'); await page.getByLabel('اسم السائق', { exact: true }).fill('EKRAM-E2E-TEST ' + channel + ' Driver'); await page.getByLabel('هاتف السائق').fill('0501234568'); await page.getByRole('button', { name: 'حفظ السائق' }).click();
      await page.getByRole('option', { name: 'EKRAM-E2E-TEST ' + channel + ' Driver' }).waitFor({ state: 'attached' }); await page.getByLabel('السائق', { exact: true }).selectOption({ label: 'EKRAM-E2E-TEST ' + channel + ' Driver' });
      const row = page.getByRole('row').filter({ hasText: ids.delivery }); await row.getByRole('checkbox').check(); await page.getByRole('button', { name: /إنشاء التكليف/ }).click(); await page.getByText('تم إنشاء التكليف وجدولة رسالة السائق.').waitFor();
      await api(`/support/distributions/${ids.delivery}/receipt-code`, {}); const inspect = fixture(env, { mode: 'inspect' }); assignmentId = Object.keys(inspect.links)[0]; driverToken = inspect.links[assignmentId]; deliveryCode = inspect.codes[ids.delivery]; if (!driverToken || !deliveryCode) throw new Error('Scoped synthetic driver message missing');
      const outbox = inspect.outbox.find(m => m.operation_id === assignmentId); if (outbox?.channel !== 'sms') throw new Error('Driver intent not SMS');
      manifest.records.push({ browser: channel, entity: 'driver_assignment', id: assignmentId, channel: 'sms', provider: 'fake', status: outbox.status });
    });
    await check(channel, 'clean browser driver portal confirm completion and replay', async () => {
      if (!driverToken) throw new Error('Assignment prerequisite failed'); const clean = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await clean.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort()); const portal = await clean.newPage();
      try {
        await portal.goto(base + '/driver-access#' + driverToken); await portal.getByText('EKRAM-E2E-TEST Seed Recipient', { exact: true }).waitFor(); if (await portal.evaluate(() => localStorage.getItem('token'))) throw new Error('Driver portal unexpectedly has application session');
        if (new URL(portal.url()).hash) throw new Error('Driver credential remains in URL');
        await portal.getByRole('button', { name: 'عرض المهمة وتأكيد الاستلام' }).click(); await portal.getByLabel('رمز الاستلام من المستلم').fill(deliveryCode); await portal.getByRole('button', { name: 'تأكيد الاستلام', exact: true }).click(); await portal.getByText('اكتمل التكليف', { exact: true }).waitFor();
        await portal.goto(base + '/driver-access#' + driverToken); await portal.getByText('اكتمل التكليف', { exact: true }).waitFor();
        const replay = await fetch(base + `/api/driver-access/tasks/${ids.delivery}/confirm`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Driver-Token': driverToken }, body: JSON.stringify({ code: deliveryCode }) }); if (replay.status !== 200) throw new Error('Completed driver replay not idempotent');
        await portal.screenshot({ path: path.join(work, channel + '-driver-completed.png'), fullPage: true });
      } finally { await clean.close(); }
    });
    await check(channel, 'supervisor completion and delivery proof', async () => { const list = await api('/support/distributions?fulfillment_method=delivery'); if (!list.data.some(t => t.id === ids.delivery && t.status === 'completed' && t.proof_available)) throw new Error('Supervisor proof state missing'); const pdf = await api(`/support/distributions/${ids.delivery}/proof`); if (pdf.subarray(0, 4).toString() !== '%PDF') throw new Error('Delivery proof PDF missing'); });
    await check(channel, 'notification persisted read exact target navigation', async () => { await page.goto(base + '/dashboard'); await page.getByRole('button', { name: 'التنبيهات والإشعارات' }).first().click(); const notifications = await api('/notifications'); const target = notifications.data.find(n => n.action_url?.includes('task=')); if (!target) throw new Error('Exact notification target missing'); await page.getByText(target.message_body, { exact: true }).first().click(); await page.getByRole('button', { name: 'فتح السجل' }).click(); await page.waitForURL(base + target.action_url); const updated = await api('/notifications'); if (!updated.data.find(n => n.id === target.id)?.read_at) throw new Error('Read state missing after navigation'); });
    await check(channel, 'Arabic template token picker and fake provider mode', async () => { await page.goto(base + '/admin/settings'); await page.getByRole('heading', { name: 'الاتصالات', exact: true }).waitFor(); await page.getByText('وضع محاكاة الرسائل', { exact: true }).waitFor(); const template = page.getByLabel('رسالة SMS للسائق'); if ((await template.inputValue()).includes('{temporary_driver_link}')) throw new Error('Technical token visible'); await page.getByRole('button', { name: 'رابط السائق الآمن', exact: true }).click(); });
    await check(channel, 'deleted notification target graceful fallback', async () => { await page.goto(base + '/receiver?task=' + randomUUID()); await page.getByText('العملية المطلوبة غير متاحة أو مؤرشفة. يمكنك العودة إلى السجل العام.').waitFor(); await page.getByRole('link', { name: 'العودة إلى السجل العام' }).click(); await page.waitForURL(base + '/receiver'); });
    await check(channel, 'beneficiary archive restore preserves historical receipts', async () => {
      await page.goto(base + '/beneficiaries/' + ids.beneficiary); page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'أرشفة المستفيد', exact: true }).click(); await page.getByText('هذا المستفيد مؤرشف؛ سجلاته ووثائقه محفوظة.').waitFor();
      await page.goto(base + '/beneficiaries/' + ids.beneficiary + '/support'); await page.getByText('المستفيد مؤرشف؛ استعد سجله قبل إنشاء دعم جديد.').waitFor();
      const history = await api(`/beneficiaries/${ids.beneficiary}/support-history`); if (!history.data.some(t => t.id === ids.pickup && t.status === 'completed')) throw new Error('Archived beneficiary lost completed support history');
      await page.goto(base + '/beneficiaries/' + ids.beneficiary); const archived = await api('/beneficiaries/' + ids.beneficiary); if (!archived.data.archived_at) throw new Error('Archive disappeared on API reload'); await page.getByText('هذا المستفيد مؤرشف؛ سجلاته ووثائقه محفوظة.').waitFor(); page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'استعادة المستفيد', exact: true }).click(); await page.getByRole('link', { name: 'إنشاء طلب دعم', exact: true }).waitFor();
    });
    await check(channel, 'zero external browser requests', async () => { if (forbidden.length) throw new Error('External browser requests blocked: ' + [...new Set(forbidden)].join(', ')); });
  } catch (error) { results.push({ browser: channel, name: 'browser/environment availability', status: /Executable doesn't exist|not found/.test(error.message) ? 'SKIPPED' : 'FAIL', evidence: safeError(error) }); }
  finally {
    if (fs.existsSync(database)) { try { manifest.records.push({ browser: channel, createdTableManifest: fixture(env, { mode: 'manifest' }).tables }); } catch { manifest.records.push({ browser: channel, createdTableManifest: 'unavailable' }); } }
    if (context) await context.close(); if (browser) await browser.close(); if (frontend) await new Promise(resolve => frontend.close(resolve));
    if (php) { php.kill(); await new Promise(resolve => { if (php.exitCode !== null) return resolve(); php.once('exit', resolve); setTimeout(resolve, 3000); }); }
    for (const suffix of ['', '-wal', '-shm', '-journal']) if (fs.existsSync(database + suffix)) fs.unlinkSync(database + suffix);
    for (const storageType of ['uploads', 'local']) { const isolatedFiles = path.resolve(work, storageType, path.basename(database)); if (isolatedFiles.startsWith(path.resolve(work) + path.sep) && fs.existsSync(isolatedFiles)) fs.rmSync(isolatedFiles, { recursive: true }); }
    manifest.cleanup.push({ browser: channel, isolatedDatabaseRemoved: !fs.existsSync(database), createdRecordsRemovedWithDatabase: !fs.existsSync(database), isolatedUploadsRemoved: !fs.existsSync(path.join(work, 'uploads', path.basename(database))) });
  }
}
manifest.results = results; manifest.summary = { passed: results.filter(r => r.status === 'PASS').length, failed: results.filter(r => r.status === 'FAIL').length, skipped: results.filter(r => r.status === 'SKIPPED').length };
fs.writeFileSync(path.join(reports, 'EKRAM-E2E-TEST-DATA.json'), JSON.stringify(manifest, null, 2));
fs.writeFileSync(path.join(reports, 'EKRAM-E2E-REPORT.md'), '# EKRAM isolated E2E evidence\n\nFresh SQLite fixtures, fake communications, disabled telemetry and loopback-only frontend/API. Credentials, driver links and receipt codes stayed in process memory. No production access or live SMS.\n\n| Browser | Gate | Result |\n| --- | --- | --- |\n' + results.map(r => `| ${r.browser} | ${r.name} | ${r.status} |`).join('\n') + '\n\nSynthetic records were removed with their disposable databases. Dedicated build and sanitized screenshot/PDF evidence remain in .tmp/ekram-remediation. Provider acceptance and actual SMS handset delivery are not established by this local gate.\n');
console.log(JSON.stringify(manifest.summary)); process.exitCode = manifest.summary.failed || manifest.summary.skipped ? 1 : 0;
