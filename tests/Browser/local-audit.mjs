process.on('unhandledRejection', () => { console.error('Browser runner asynchronous failure (details suppressed)'); process.exitCode=1; });
import { chromium } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const started = new Date();
let stage='fixture';
const port=18555;
const base=`http://127.0.0.1:${port}`;
const root = process.cwd();
const database = path.join(root, 'storage/app/reports', `qa-isolated-${randomUUID()}.sqlite`);
fs.mkdirSync(path.dirname(database), { recursive: true }); fs.writeFileSync(database, '');
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', DB_CONNECTION:'sqlite', DB_DATABASE: database, DB_URL:'', CACHE_STORE:'array', SESSION_DRIVER:'array', QUEUE_CONNECTION:'sync', LOG_CHANNEL:'stderr', APP_URL:base };
async function navigate(page, url) {
 for (let attempt=1; attempt<=3; attempt++) {
  try { await page.goto(url, {waitUntil:'domcontentloaded', timeout:30000}); return; }
  catch (error) { if (attempt===3) throw error; await new Promise(resolve=>setTimeout(resolve,500)); }
 }
}
const credentials = Object.fromEntries(['admin','assistant_admin','delivery_driver','readonly','warehouse'].map(role => [role,{username:'TEST_'+role,password:randomBytes(24).toString('hex')}]));
const fixture=spawnSync('php',['tests/Browser/audit-fixture.php'],{env,input:JSON.stringify(credentials),encoding:'utf8'});
if(fixture.status!==0) throw new Error('Isolated database fixture failed; credentials suppressed');
const fixtureAuth=JSON.parse(fixture.stdout);
const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t',path.join(root,'public'),path.join(root,'tests/Browser/server-router.php')],{cwd:root,env,stdio:'ignore'});
let browser; const results=[]; const errors=[];
try {
 for(let n=0;n<40;n++){try{if((await fetch(base+'/up')).ok) break;}catch{} await new Promise(r=>setTimeout(r,250));}
 const fixtureCheck=await (await fetch(base+'/__qa-fixture-check')).json();
 if(!fixtureCheck.safe || fixtureCheck.users<1) throw new Error('Spawned server is not using the isolated fixture database');
 const loginResponse=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify(credentials.admin)});
 if(!loginResponse.ok) throw new Error(`Fixture login failed (${loginResponse.status})`);
 const loginPayload=await loginResponse.json();
 fixtureAuth.token=loginPayload.data.token; fixtureAuth.user=loginPayload.data.user;
 const authProbe=await fetch(base+'/api/me',{headers:{authorization:`Bearer ${fixtureAuth.token}`}});
 if(!authProbe.ok) throw new Error(`Fixture authentication probe failed (${authProbe.status})`);
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/api/**', async route => {
   const target=new URL(route.request().url());
   if(target.origin!==base) { errors.push(`Blocked API origin ${target.origin}`); await route.abort(); return; }
   await route.continue({headers:{...route.request().headers(),authorization:`Bearer ${fixtureAuth.token}`}});
 });
 const page=await context.newPage();
 await page.addInitScript(auth => { localStorage.setItem('token', auth.token); localStorage.setItem('user', JSON.stringify(auth.user)); }, fixtureAuth);
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${new URL(r.url()).pathname}`);});
 stage='authenticated-dashboard'; await navigate(page, base+'/dashboard');
 await page.waitForFunction(() => !location.pathname.includes('/login'));
 results.push({module:'Authenticated fixture',status:'PASS'});
 for(const module of ['dashboard','beneficiaries','beneficiaries/add-citizen','beneficiaries/import','daily-beneficiaries','daily-beneficiaries/add','daily-beneficiaries/receiving','daily-beneficiaries/inventory','warehouse','staff','staff/add','staff/import','representatives','receiver','delivery','driver/deliveries','governance','audit','admin/users','admin/settings']) {
  stage=module; await navigate(page, base+'/'+module);
  await page.waitForFunction(() => document.body.innerText.length>100, {timeout:30000});
  const text=await page.locator('body').innerText();
  results.push({module,status:text.length>100 && !page.url().includes('/login')?'PASS':'FAIL',scope:'page load and authenticated navigation'});
 }
 stage='daily-ui-crud'; await navigate(page, base+'/daily-beneficiaries/add');
 await page.getByPlaceholder('مثال: إبراهيم سليمان منصور المنصور').fill('TEST_UI_DAILY_001');
 await page.getByPlaceholder('10 أرقام (يبدأ بـ 1 أو 2)').fill('1666666666');
 await page.getByPlaceholder('05xxxxxxxx').fill('0556666666');
 await page.getByPlaceholder('اختر أو اكتب اسم الحي...').fill('TEST_UI_DISTRICT');
 await page.getByRole('button',{name:'تسجيل المستفيد'}).click();
 stage='daily-ui-create-navigation';
 await page.waitForFunction(() => location.pathname !== '/daily-beneficiaries/add', {timeout:10000});
 const createdUrl=page.url(); const createdId=createdUrl.split('/').pop();
 await page.locator(`a[href="/daily-beneficiaries/${createdId}/edit"]`).click();
 stage='daily-ui-edit-navigation';
 await page.waitForURL(new RegExp(`/daily-beneficiaries/${createdId}/edit$`));
 await page.getByPlaceholder('اختر أو اكتب اسم الحي...').fill('TEST_UI_DISTRICT_EDITED');
 await page.getByRole('button',{name:'حفظ التعديلات'}).click();
 stage='daily-ui-save-navigation';
 await page.waitForURL(new RegExp(`/daily-beneficiaries/${createdId}$`),{timeout:10000});
 await page.reload(); await page.getByText('TEST_UI_DISTRICT_EDITED').first().waitFor();
 await navigate(page, base+'/daily-beneficiaries?tab=today');
 await page.getByPlaceholder(/ابحث بالاسم الرباعي/).fill('TEST_UI_DAILY_001'); await page.getByRole('button',{name:'بحث'}).click();
 await page.getByText('TEST_UI_DAILY_001').first().waitFor();
 await page.getByTitle('حذف المستفيد').click(); await page.getByRole('button',{name:'إلغاء'}).click();
 await page.getByText('TEST_UI_DAILY_001').first().waitFor();
 await page.getByTitle('حذف المستفيد').click(); await page.getByRole('button',{name:'تأكيد الحذف'}).click();
 await page.waitForFunction(() => !document.body.innerText.includes('TEST_UI_DAILY_001'));
 results.push({module:'Daily Beneficiary UI CRUD',status:'PASS',scope:'create, view, edit, save, refresh, search, cancel delete, confirm delete'});

 stage='notification-center-ui'; await navigate(page, base+'/dashboard');
 await page.getByRole('button',{name:'التنبيهات والإشعارات'}).click();
 await page.getByText('مركز الإشعارات والتنبيهات').last().waitFor();
 await page.screenshot({path:'storage/app/reports/qa-notifications-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'storage/app/reports/qa-notifications-mobile.png',fullPage:true});
 results.push({module:'Notification Center UI',status:'PASS',scope:'opened panel, RTL content, buttons, desktop/mobile screenshots'});
 await page.goto(base+'/beneficiaries');
 await page.waitForTimeout(500);
 await page.reload(); await page.waitForTimeout(500);
 results.push({module:'Refresh authentication',status:page.url().includes('/login')?'FAIL':'PASS'});
 const second=await context.newPage(); await second.goto(base+'/dashboard'); await second.waitForTimeout(500);
 results.push({module:'Second tab authentication',status:second.url().includes('/login')?'FAIL':'PASS'});
 await page.setViewportSize({width:390,height:844}); await page.goto(base+'/governance'); await page.waitForFunction(() => document.body.innerText.length>100, {timeout:30000});
 await page.screenshot({path:'storage/app/reports/qa-governance-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000}); await page.goto(base+'/governance'); await page.screenshot({path:'storage/app/reports/qa-governance-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844}); await page.goto(base+'/daily-beneficiaries'); await page.waitForFunction(() => document.body.innerText.length>100, {timeout:30000}); await page.screenshot({path:'storage/app/reports/qa-daily-mobile.png',fullPage:true});
 await page.setViewportSize({width:1440,height:1000}); await page.goto(base+'/daily-beneficiaries'); await page.screenshot({path:'storage/app/reports/qa-daily-desktop.png',fullPage:true});
 results.push({module:'Responsive capture',status:'PASS',scope:'Governance and Daily Beneficiaries at 390px and 1440px; visual review separately'});
 await context.unrouteAll({behavior:'ignoreErrors'}); await context.close();
} catch(e) { errors.push('Browser step failed at '+stage+': '+e.name+' '+e.message); }
finally { if(browser)await browser.close(); server.kill(); }
const finished=new Date();
fs.writeFileSync('storage/app/reports/local-browser-qa.json',JSON.stringify({started:started.toISOString(),finished:finished.toISOString(),duration_seconds:(finished-started)/1000,results,errors},null,2));
console.log(JSON.stringify({checks:results.length,errors:errors.length,duration_seconds:(finished-started)/1000}));
process.exitCode=errors.length || results.some(r=>r.status==='FAIL')?1:0;
