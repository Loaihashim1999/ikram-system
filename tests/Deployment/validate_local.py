"""Local-only EKRAM container configuration integration checks (no Azure calls)."""
import pathlib,subprocess,json,tempfile,socket,time,os,urllib.request,urllib.error,hashlib,re,sys,base64,shutil,uuid
ROOT=pathlib.Path(__file__).resolve().parents[2] if pathlib.Path(__file__).parent.name=='Deployment' else pathlib.Path(r'C:\laragon\www\ikram-system')
OUT=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'.tmp/azure-remediation';OUT.mkdir(parents=True,exist_ok=True)
results=[]
def mark(name,ok,detail=''):results.append({'check':name,'passed':bool(ok),'detail':detail})
def port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
def run(args,**kw):return subprocess.run(args,capture_output=True,text=True,timeout=60,**kw)
php=shutil.which('php') or r'C:\laragon\bin\php\php-8.3.30-Win32-vs16-x64\php.exe'
ini=ROOT/'docker/php-production.ini';code="echo json_encode(array_combine(['display_errors','display_startup_errors','log_errors','expose_php','zend.exception_ignore_args'],array_map('ini_get',['display_errors','display_startup_errors','log_errors','expose_php','zend.exception_ignore_args'])));"
p=run([php,'-c',str(ini),'-r',code]);j=json.loads(p.stdout);mark('production-php-error-and-fingerprint-flags',j['display_errors'] in ['', '0'] and j['display_startup_errors'] in ['', '0'] and j['log_errors']=='1' and j['expose_php'] in ['', '0'] and j['zend.exception_ignore_args']=='1')
p=run([php,'-c',str(ini),'-d','error_log='+str(OUT/'php-synthetic-error.log'),'-r',"trigger_error('AZR synthetic warning', E_USER_WARNING);echo 'ok';"]);mark('php-warning-hidden-from-response-and-logged',p.stdout=='ok' and 'AZR synthetic warning' in (OUT/'php-synthetic-error.log').read_text(encoding='utf-8'))
docker=(ROOT/'Dockerfile').read_text(encoding='utf-8');mark('docker-copies-runtime-overrides-and-headers','COPY docker/php-production.ini /usr/local/etc/php/conf.d/zz-production.ini' in docker and 'COPY docker/security-headers.conf /etc/nginx/security-headers.conf' in docker)
mark('container-keeps-unprivileged-user-and-source-layout','USER www-data' in docker and 'WORKDIR /var/www/html' in docker and 'chmod -R u=rwX,g=rX,o=' in docker)
probes=json.loads((ROOT/'docs/deployment/azure-container-probes.json').read_text(encoding='utf-8'));by={p['type']:p for p in probes['probes']};mark('probe-fragment-three-independent-checks',set(by)=={'Startup','Liveness','Readiness'} and by['Readiness']['httpGet']['path']=='/readiness' and by['Liveness']['httpGet']['path']=='/health' and by['Startup']['httpGet']['path']=='/health' and all(p['httpGet']['port']==8080 and p['successThreshold']==1 for p in by.values()))
mark('canonical-url-template-with-no-wildcard-trust','APP_URL=https://systemben.ekramfb.org.sa' in (ROOT/'docs/deployment/azure-runtime.env.example').read_text(encoding='utf-8') and 'TRUSTED_PROXIES=*' not in (ROOT/'docs/deployment/azure-runtime.env.example').read_text(encoding='utf-8'))
sql=(ROOT/'docs/deployment/postgres-runtime-role.sql').read_text(encoding='utf-8');mark('db-plan-no-admin-capabilities-or-password-literal',all(x in sql for x in ['NOSUPERUSER','NOCREATEDB','NOCREATEROLE','NOBYPASSRLS','NOREPLICATION','NOINHERIT']) and not re.search(r'PASSWORD\s+[\"\']',sql,re.I) and 'GRANT SELECT ON TABLE public.migrations' in sql)
source=(ROOT/'app/Http/Controllers/Beneficiaries/CategoryController.php').read_text(encoding='utf-8');mark('IKR-010-category-detail-fix-present','function show(' in source);mark('IKR-011-storage-excluded-from-spa','storage(?:/|$)' in (ROOT/'routes/web.php').read_text(encoding='utf-8'))
nginx=shutil.which('nginx')
if not nginx:
 matches=list(pathlib.Path(r'C:\laragon\bin\nginx').glob('*/nginx.exe'));nginx=str(matches[-1]) if matches else None
ng=None;cgi=None
try:
 if not nginx:raise RuntimeError('Native nginx unavailable')
 httpport=port();cgport=port();base='http://127.0.0.1:'+str(httpport)
 original=(ROOT/'docker/nginx.conf').read_text(encoding='utf-8');ngroot=pathlib.Path(nginx).parent
 conf=original.replace('/etc/nginx/mime.types',str(ngroot/'conf/mime.types').replace('\\','/')).replace('/etc/nginx/security-headers.conf',str(ROOT/'docker/security-headers.conf').replace('\\','/')).replace('listen 8080;','listen 127.0.0.1:'+str(httpport)+';').replace('root /var/www/html/public;','root '+str(ROOT/'public').replace('\\','/')+';').replace('127.0.0.1:9000','127.0.0.1:'+str(cgport)).replace('/tmp/nginx.pid',str(OUT/'nginx.pid').replace('\\','/')).replace('/dev/stdout',str(OUT/'nginx-access.log').replace('\\','/')).replace('/dev/stderr',str(OUT/'nginx-error.log').replace('\\','/'))
 for suffix in ['client_body','fastcgi','proxy','scgi','uwsgi']:
  (OUT/suffix).mkdir(exist_ok=True);conf=conf.replace('/var/lib/nginx/tmp/'+suffix,str(OUT/suffix).replace('\\','/'))
 fastcgi=ngroot/'conf/fastcgi_params';conf=conf.replace('include fastcgi_params;','include '+str(fastcgi).replace('\\','/')+';')
 # A test-only endpoint for controlled browser CSP checks; never copied into image.
 fixture=OUT/'csp-fixture.html';fixture.write_text('''<!doctype html><html><body><div id="root" style="color:rgb(1, 2, 3)">CSP fixture</div><script>window.inlineScriptExecuted=true</script><script src="/csp-check.js"></script></body></html>''')
 js=OUT/'csp-check.js';js.write_text('window.externalScriptExecuted=true;')
 conf=conf.replace('        location / {','        location = /csp-fixture.html { alias '+str(fixture).replace('\\','/')+'; }\n        location = /csp-check.js { alias '+str(js).replace('\\','/')+'; }\n        location = /synthetic-error { return 503; }\n        location / {')
 config=OUT/'nginx-local.conf';config.write_text(conf,encoding='utf-8');(OUT/'logs').mkdir(exist_ok=True)
 p=run([nginx,'-p',str(OUT)+'/', '-c',str(config),'-t']);mark('native-nginx-config-syntax',p.returncode==0)
 if p.returncode:raise RuntimeError('Nginx syntax check failed: '+p.stderr[-500:])
 env=dict(os.environ);env.update({'APP_ENV':'testing','APP_DEBUG':'false','APP_KEY':'base64:'+base64.b64encode(os.urandom(32)).decode(),'DB_CONNECTION':'sqlite','DB_DATABASE':':memory:','DB_URL':'','DB_HOST':'127.0.0.1','CACHE_STORE':'array','SESSION_DRIVER':'array','QUEUE_CONNECTION':'sync','MAIL_MAILER':'array','COMMUNICATION_PROVIDER':'fake','COMMUNICATIONS_PROVIDER':'fake','LOG_CHANNEL':'null','SENTRY_DSN':'','SENTRY_LARAVEL_DSN':'','NIGHTWATCH_ENABLED':'false','APP_CONFIG_CACHE':str(OUT/'nonexistent-config.php'),'APP_URL':base,'PHP_FCGI_MAX_REQUESTS':'0','PHP_FCGI_CHILDREN':'0'})
 database=OUT/('qa-isolated-fsa-azure-'+uuid.uuid4().hex+'.sqlite');database.touch();env['DB_DATABASE']=str(database)
 p=run([php,str(ROOT/'tests/Browser/fsa-closure-fixture.php')],cwd=ROOT,env=env,input='{}')
 if p.returncode:raise RuntimeError('Guarded synthetic browser fixture failed; credentials omitted')
 fixture_auth=json.loads(p.stdout)
 node=shutil.which('node');build=OUT/'frontend-build';buildenv=dict(env);buildenv.update({'VITE_API_URL':'/api','VITE_API_BASE_URL':'','VITE_SENTRY_DSN':''})
 p=run([node,str(ROOT/'frontend/node_modules/vite/bin/vite.js'),'build','--outDir',str(build)],cwd=ROOT/'frontend',env=buildenv)
 if p.returncode:raise RuntimeError('Isolated frontend production build failed')
 mark('fresh-frontend-production-build',True)
 conf=conf.replace('        location / {','        location = /dashboard { alias '+str(build/'index.html').replace('\\','/')+'; default_type text/html; }\n        location /assets/ { alias '+str(build/'assets').replace('\\','/')+'/; }\n        location / {')
 config.write_text(conf,encoding='utf-8');p=run([nginx,'-p',str(OUT)+'/', '-c',str(config),'-t'])
 if p.returncode:raise RuntimeError('Fresh-build Nginx configuration syntax failed')
 php_cgi=pathlib.Path(php).parent/'php-cgi.exe' if os.name=='nt' else pathlib.Path(shutil.which('php-cgi') or '')
 if not php_cgi.is_file():raise RuntimeError('Local PHP-CGI unavailable')
 flags=['-d','display_errors=0','-d','display_startup_errors=0','-d','log_errors=1','-d','error_log='+str(OUT/'php-cgi-error.log'),'-d','expose_php=0','-d','zend.exception_ignore_args=1','-d','cgi.fix_pathinfo=0']
 creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
 cgi=subprocess.Popen([str(php_cgi),*flags,'-b','127.0.0.1:'+str(cgport)],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=creationflags)
 ng=subprocess.Popen([nginx,'-p',str(OUT)+'/', '-c',str(config),'-g','daemon off;'],cwd=OUT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=creationflags)
 for _ in range(40):
  try:
   urllib.request.urlopen(base+'/health',timeout=1);break
  except:time.sleep(.2)
 required=['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Content-Security-Policy'];responses=[]
 asset=next((build/'assets').glob('*.js'),None)
 paths=['/health','/readiness','/','/api/me','/.env','/synthetic-error','/csp-fixture.html']+(['/assets/'+asset.name] if asset else [])
 for path in paths:
  try:r=urllib.request.urlopen(base+path,timeout=10)
  except urllib.error.HTTPError as e:r=e
  body=r.read();h=dict(r.headers);responses.append({'path':path,'status':r.status,'headers':{k:v for k,v in h.items() if k.lower() in [x.lower() for x in required]+['server','x-powered-by','content-type']}})
  mark('headers-on-'+path,all(r.headers.get(k) for k in required),str(r.status))
  mark('hide-version-on-'+path,'X-Powered-By' not in r.headers and not re.search(r'nginx/\d',r.headers.get('Server','')))
  if path in ['/health','/readiness']:mark('json-contract-'+path,r.status==200 and json.loads(body).get('status') in ['ok','ready'])
  if path=='/api/me':mark('api-unauthenticated-contract',r.status==401)
  if path=='/.env':mark('dotfile-protection',r.status==403)
  if path=='/synthetic-error':mark('error-response-without-spa-fallback',r.status==503)
  if path.startswith('/assets/'):mark('fresh-frontend-static-asset-contract',r.status==200 and 'javascript' in r.headers.get('Content-Type',''))
 (OUT/'http-smoke.json').write_text(json.dumps(responses,indent=2));
 # Installed Playwright only; no downloads. Verify browser policy behavior.
 node=shutil.which('node');playwright=ROOT/'node_modules/@playwright/test/index.mjs'
 if node and playwright.is_file():
  mjs=OUT/'csp-browser.mjs';mjs.write_text('''import fs from 'node:fs';import { chromium } from '''+json.dumps(playwright.as_uri())+''';
const auth=JSON.parse(fs.readFileSync(0,'utf8'));
const browser=await chromium.launch({headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try {const context=await browser.newContext({permissions:['camera']});let remote=0;await context.route('**/*',r=>{if(new URL(r.request().url()).hostname==='127.0.0.1')return r.continue();remote++;return r.abort();});const page=await context.newPage();await page.goto('''+json.dumps(base+'/csp-fixture.html')+''');await page.waitForFunction(()=>window.externalScriptExecuted===true);const checks=await page.evaluate(async()=>{const a={externalScript:window.externalScriptExecuted===true,inlineScriptBlocked:window.inlineScriptExecuted!==true,inlineStyle:getComputedStyle(document.querySelector('#root')).color==='rgb(1, 2, 3)'};const w=new Worker(URL.createObjectURL(new Blob(['postMessage("ok")'],{type:'application/javascript'})));a.blobWorker=await new Promise(r=>{w.onmessage=e=>r(e.data==='ok');w.onerror=()=>r(false);setTimeout(()=>r(false),3000)});w.terminate();const stream=await navigator.mediaDevices.getUserMedia({video:true});a.cameraAllowed=stream.getVideoTracks().length>0;stream.getTracks().forEach(t=>t.stop());return a;});
await context.addInitScript(a=>{localStorage.setItem('token',a.token);localStorage.setItem('user',JSON.stringify(a.user));},auth);
await context.addInitScript(()=>{window.cspViolations=[];document.addEventListener('securitypolicyviolation',e=>window.cspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI.startsWith('http')?new URL(e.blockedURI).origin:e.blockedURI}));});const app=await context.newPage();let cspErrors=0;let pageErrors=0;app.on('console',m=>{if(m.text().includes('Content Security Policy'))cspErrors++;});app.on('pageerror',()=>pageErrors++);await app.goto('''+json.dumps(base+'/dashboard')+''');await app.waitForFunction(()=>document.body.innerText.length>100&&!location.pathname.includes('/login'),{timeout:15000});await app.waitForTimeout(1000);checks.realSpaDashboard=true;checks.realSpaNoCspViolations=cspErrors===0;checks.violationDetails=await app.evaluate(()=>window.cspViolations);checks.realSpaNoUncaughtErrors=pageErrors===0;checks.noExternalRequests=remote===0;
console.log(JSON.stringify(checks));if(Object.values(checks).some(v=>!v))process.exitCode=1;}finally{await browser.close();}''')
  p=run([node,str(mjs)],cwd=ROOT,input=json.dumps(fixture_auth));browser=json.loads(p.stdout) if p.stdout.strip().startswith('{') else {'status':'ISSUE'};(OUT/'csp-browser.json').write_text(json.dumps(browser,indent=2));mark('browser-csp-script-style-worker-camera-and-real-spa',p.returncode==0)
 else:mark('browser-csp-integration',False,'Installed Playwright/Node unavailable')
except Exception as e:mark('native-server-integration',False,type(e).__name__+': '+str(e)[:400])
finally:
 if ng:
  run([nginx,'-p',str(OUT)+'/', '-c',str(OUT/'nginx-local.conf'),'-s','quit'])
  try:ng.wait(timeout=10)
  except:ng.terminate()
 if cgi:
  cgi.terminate()
  try:cgi.wait(timeout=5)
  except:cgi.kill()
(OUT/'validation.json').write_text(json.dumps({'checks':results,'passed':sum(x['passed'] for x in results),'failed':sum(not x['passed'] for x in results),'scope':'local-only; synthetic isolated SQLite fixture; no Azure/production access'},indent=2));print(json.dumps({'passed':sum(x['passed'] for x in results),'failed':[x for x in results if not x['passed']]}));sys.exit(any(not x['passed'] for x in results))
