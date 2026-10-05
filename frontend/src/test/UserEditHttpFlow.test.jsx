import process from 'node:process';
import { Buffer } from 'node:buffer';
import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import Users from '../pages/admin/Users';
import api from '../api/axios';
vi.mock('../components/layout/MainLayout',()=>({default:({children})=><main>{children}</main>}));
it('saves the real account edit form to an isolated Laravel database and preserves authorization/security state',async()=>{
 const root=path.resolve(process.cwd(),'..');const temp=fs.mkdtempSync(path.join(root,'.tmp/e2e004-ui-'));
  if(!path.resolve(temp).startsWith(path.resolve(root,'.tmp')+path.sep))throw new Error('Unsafe cleanup path');
const database=path.join(temp,'test.sqlite');fs.writeFileSync(database,'');
 const env={...process.env, COMMUNICATION_PROVIDER: 'fake', SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '',APP_ENV:'testing',APP_DEBUG:'false',APP_KEY:`base64:${Buffer.alloc(32,'T').toString('base64')}`,DB_CONNECTION:'sqlite',DB_DATABASE:database,DB_URL:'',SESSION_DRIVER:'array',CACHE_STORE:'array',QUEUE_CONNECTION:'sync',LOG_CHANNEL:'null',BCRYPT_ROUNDS:'4',APP_CONFIG_CACHE:path.join(temp,'config.php'),APP_ROUTES_CACHE:path.join(temp,'routes.php')};
 const fixture=spawnSync('php',['tests/Support/user-edit-ui-fixture.php'],{cwd:root,env,encoding:'utf8',timeout:30000});if(fixture.status!==0)throw new Error('Isolated fixture unavailable; raw output withheld');const auth=JSON.parse(fixture.stdout);
 const probe=net.createServer();await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));const port=probe.address().port;await new Promise(resolve=>probe.close(resolve));const base=`http://127.0.0.1:${port}`;
 const server=spawn('php',['-S',`127.0.0.1:${port}`,'-t','public','tests/Browser/server-router.php'],{cwd:root,env,stdio:'ignore'});const logGuard=vi.spyOn(console,'error').mockImplementation(()=>{});const previousBase=api.defaults.baseURL;const previousAdapter=api.defaults.adapter;let view;
 const dbState=()=>{const code='$d=new PDO("sqlite:".getenv("DB_DATABASE"));$s=$d->prepare("SELECT full_name,email,phone,username,role,is_active,must_change_password,password FROM users WHERE username=?");$s->execute(["EKRAM-E2E-TEST-STAFF"]);echo json_encode($s->fetch(PDO::FETCH_ASSOC));';const result=spawnSync('php',['-r',code],{cwd:root,env,encoding:'utf8',timeout:5000});if(result.status!==0)throw new Error('Local persistence read failed');return JSON.parse(result.stdout);};
 try{
  for(let n=0;n<50;n++){try{if((await fetch(`${base}/up`)).ok)break;}catch { /* Backend readiness is retried below. */ }await new Promise(resolve=>setTimeout(resolve,100));}
  api.defaults.baseURL=`${base}/api`;api.defaults.adapter='http';localStorage.setItem('token',auth.admin_token);const before=dbState();const user=userEvent.setup();const put=vi.spyOn(api,'put');
  const mount=()=>render(<MemoryRouter><Users/></MemoryRouter>);view=mount();await user.click(within((await screen.findByText('EKRAM-E2E-TEST-STAFF',{exact:true})).closest('tr')).getByRole('button',{name:'تعديل',exact:true}));
  const name=screen.getByPlaceholderText('مثال: عمر بن خالد السلمي');await user.clear(name);await user.type(name,'EKRAM-E2E-TEST اسم محفوظ');expect(name).toHaveFocus();const email=screen.getByPlaceholderText('name@example.com');await user.clear(email);await user.type(email,'saved@example.invalid');expect(email).toHaveFocus();
  await user.click(screen.getByRole('button',{name:'حفظ التعديلات والتصاريح'}));await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),{timeout:10000});expect(put).toHaveBeenCalledTimes(1);
  const after=dbState();expect(after.full_name).toBe('EKRAM-E2E-TEST اسم محفوظ');expect(after.email).toBe('saved@example.invalid');for(const key of ['username','phone','role','is_active','must_change_password','password'])expect(after[key]).toBe(before[key]);
  view.unmount();view=mount();await user.click(within((await screen.findByText('EKRAM-E2E-TEST-STAFF',{exact:true})).closest('tr')).getByRole('button',{name:'تعديل',exact:true}));expect(screen.getByPlaceholderText('مثال: عمر بن خالد السلمي')).toHaveValue(after.full_name);expect(screen.getByPlaceholderText('name@example.com')).toHaveValue(after.email);
  const denied=await fetch(`${base}/api/users/${auth.user_id}`,{method:'PUT',headers:{Accept:'application/json','Content-Type':'application/json',Authorization:`Bearer ${auth.readonly_token}`},body:JSON.stringify({full_name:'DENIED TEST'})});expect(denied.status).toBe(403);expect(dbState().full_name).toBe(after.full_name);
  const guest=await fetch(`${base}/api/users/${auth.user_id}`,{method:'PUT',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({full_name:'DENIED TEST'})});expect(guest.status).toBe(401);put.mockRestore();
 }finally{logGuard.mockRestore();cleanup();localStorage.clear();api.defaults.baseURL=previousBase;api.defaults.adapter=previousAdapter;server.kill();await new Promise(resolve=>server.once('exit',resolve));fs.rmSync(temp,{recursive:true,force:true});}
},60000);
