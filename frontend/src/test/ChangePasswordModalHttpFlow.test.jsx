import process from 'node:process';
import { Buffer } from 'node:buffer';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/common/ChangePasswordModal';
import api from '../api/axios';

function Flow() {
  const { user, loading, logout } = useAuth();
  return loading ? <p>loading</p> : user ? <ChangePasswordModal isOpen onSuccess={logout} /> : <p>TEST signed out</p>;
}

it('runs the repaired modal against isolated Laravel with one audited change and revoked auth', async () => {
  const root = path.resolve(process.cwd(), '..');
  const temp = fs.mkdtempSync(path.join(root, '.tmp/e2e005-ui-'));
  if (!path.resolve(temp).startsWith(path.resolve(root, '.tmp') + path.sep)) throw new Error('Cleanup path outside local workspace');

  const database = path.join(temp, 'test.sqlite'); fs.writeFileSync(database, '');
  const env = { ...process.env, COMMUNICATION_PROVIDER: 'fake', SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${Buffer.alloc(32, 'T').toString('base64')}`, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', SESSION_DRIVER: 'array', CACHE_STORE: 'array', QUEUE_CONNECTION: 'sync', LOG_CHANNEL: 'null', BCRYPT_ROUNDS: '4', APP_CONFIG_CACHE: path.join(temp, 'config.php'), APP_ROUTES_CACHE: path.join(temp, 'routes.php') };
  const fixture = spawnSync('php', ['tests/Support/password-change-ui-fixture.php'], { cwd: root, env, encoding: 'utf8', timeout: 30000 });
  if (fixture.status !== 0) throw new Error('Isolated fixture failed; output withheld');
  const auth = JSON.parse(fixture.stdout);
  const probe = net.createServer(); await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port; await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public', 'tests/Browser/server-router.php'], { cwd: root, env, stdio: 'ignore' });
  const previousBase = api.defaults.baseURL, previousAdapter = api.defaults.adapter;
  const previousPath = window.location.pathname;
  const logGuard = vi.spyOn(console, 'error').mockImplementation(() => {});
  const bodies = [];
  const interceptor = api.interceptors.request.use(config => {
    if (config.url === '/change-password') bodies.push(Object.keys(config.data).sort());
    return config;
  });
  function auditCount() {
    const code = `<?php require 'vendor/autoload.php'; $app=require 'bootstrap/app.php'; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); if(config('database.default')!=='sqlite') throw new RuntimeException('Isolation'); echo App\\Models\\AuditLog::where('action','PASSWORD_CHANGED')->count();`;
    const result = spawnSync('php', [], { cwd: root, env, input: code, encoding: 'utf8', timeout: 10000 });
    if (result.status !== 0 || !/^\d+$/.test(result.stdout)) throw new Error('Local audit probe failed');
    return Number(result.stdout);
  }
  function fill(current, password, confirmation = password) {
    fireEvent.change(screen.getByLabelText(/كلمة المرور الحالية/), { target: { value: current } });
    fireEvent.change(screen.getByLabelText(/^كلمة المرور الجديدة/), { target: { value: password } });
    fireEvent.change(screen.getByLabelText(/تأكيد كلمة المرور الجديدة/), { target: { value: confirmation } });
  }
  const old = 'TEST-Old!Password123', next = 'TEST-New!Password456';
  try {
    for (let n = 0; n < 50; n++) { try { if ((await fetch(`${base}/up`)).ok) break; } catch { /* Backend readiness is retried below. */ } await new Promise(resolve => setTimeout(resolve, 100)); }
    api.defaults.baseURL = `${base}/api`; api.defaults.adapter = 'http';
    // JSDOM cannot execute full navigation; verify AuthProvider sign-out here.
    // The real candidate browser remains the authoritative redirect gate.
    window.history.replaceState(null, '', '/login');
    localStorage.setItem('token', auth.token);
    // Replay the former modal body against the real authoritative validator.
    const former = await fetch(`${base}/api/change-password`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ current_password: old, new_password: next, new_password_confirmation: next }),
    });
    expect(former.status).toBe(422); expect((await former.json()).errors).toHaveProperty('password');
    render(<AuthProvider><Flow /></AuthProvider>);
    await screen.findByLabelText(/كلمة المرور الحالية/);
    expect(auditCount()).toBe(0);
    fill('Wrong-Fixture!123', next); fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }));
    expect(await screen.findByText('كلمة المرور الحالية غير صحيحة.', {}, { timeout: 10000 })).toBeVisible();
    expect(auditCount()).toBe(0); expect(localStorage.getItem('token')).toBe(auth.token);
    fill(old, 'weak'); fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }));
    expect(screen.getByText(/يجب أن لا تقل كلمة المرور عن 12/)).toBeVisible();
    fill(old, next, next + 'x'); fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }));
    expect(screen.getByText('كلمة المرور الجديدة وتأكيدها غير متطابقين.')).toBeVisible();
    fill('', next); fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }));
    expect(screen.getByText('يرجى إدخال كلمة المرور الحالية.')).toBeVisible();
    expect(bodies).toHaveLength(1);
    fill(old, next);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور الجديدة' }));
      const deadline = Date.now() + 10000;
      while (localStorage.getItem('token') && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      expect(localStorage.getItem('token')).toBeNull();
    });
    // The successful modal unmounts when the real logout settles. Assert the
    // durable signed-out result below rather than its transient success status.
    await waitFor(() => expect(screen.getByText('TEST signed out')).toBeVisible(), { timeout: 10000 });
    expect(auditCount()).toBe(1); expect(localStorage.getItem('token')).toBeNull();
    expect(bodies).toEqual([['current_password','password','password_confirmation'], ['current_password','password','password_confirmation']]);
    const login = password => fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ username: 'TEST_LOCAL_STAFF', password }) });
    expect((await login(next)).status).toBe(200);
    expect((await login(old)).status).toBe(422);
    const headers = { Accept: 'application/json', Authorization: `Bearer ${auth.token}` };
    expect((await fetch(`${base}/api/me`, { headers })).status).toBe(401);
    expect((await fetch(`${base}/api/change-password`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: '{}' })).status).toBe(401);
    const logs = JSON.stringify(logGuard.mock.calls);
    expect(logs.includes(old)).toBe(false); expect(logs.includes(next)).toBe(false);
    expect(logGuard).not.toHaveBeenCalled();
  } finally {
    api.interceptors.request.eject(interceptor); api.defaults.baseURL = previousBase; api.defaults.adapter = previousAdapter;
    logGuard.mockRestore(); cleanup(); localStorage.clear();
    window.history.replaceState(null, '', previousPath);
    server.kill(); if (server.exitCode === null) await new Promise(resolve => server.once('exit', resolve));
    
    fs.rmSync(temp, { recursive: true, force: true });
  }
}, 60000);
