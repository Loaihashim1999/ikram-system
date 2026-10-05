import process from 'node:process';
import { Buffer } from 'node:buffer';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { it, expect, vi } from 'vitest';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ChangePasswordPage from '../pages/auth/ChangePasswordPage';
import api from '../api/axios';

function Flow() {
  const { user, loading } = useAuth();
  return loading ? <p>loading</p> : user ? <ChangePasswordPage /> : <p>TEST signed out</p>;
}

it('runs the production page and auth client against an isolated local Laravel HTTP endpoint', async () => {
  const root = path.resolve(process.cwd(), '..');
  const temp = fs.mkdtempSync(path.join(root, '.tmp/e2e001-ui-'));
  if (!path.resolve(temp).startsWith(path.resolve(root, '.tmp') + path.sep)) throw new Error('Cleanup path outside local test workspace');

  const database = path.join(temp, 'test.sqlite');
  fs.writeFileSync(database, '');
  const env = { ...process.env, COMMUNICATION_PROVIDER: 'fake', SENTRY_DSN: '', SENTRY_LARAVEL_DSN: '', APP_ENV: 'testing', APP_DEBUG: 'false', APP_KEY: `base64:${Buffer.alloc(32, 'T').toString('base64')}`, DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', SESSION_DRIVER: 'array', CACHE_STORE: 'array', QUEUE_CONNECTION: 'sync', LOG_CHANNEL: 'null', BCRYPT_ROUNDS: '4', APP_CONFIG_CACHE: path.join(temp, 'config.php'), APP_ROUTES_CACHE: path.join(temp, 'routes.php') };
  const fixture = spawnSync('php', ['tests/Support/password-change-ui-fixture.php'], { cwd: root, env, encoding: 'utf8', timeout: 30000 });
  if (fixture.status !== 0) throw new Error('Isolated fixture failed; secret-free diagnostic');
  const auth = JSON.parse(fixture.stdout);
  const probe = net.createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const server = spawn('php', ['-S', `127.0.0.1:${port}`, '-t', 'public', 'tests/Browser/server-router.php'], { cwd: root, env, stdio: 'ignore' });
  const logGuard = vi.spyOn(console, 'error').mockImplementation(() => {});
  const previousBase = api.defaults.baseURL;
  const previousAdapter = api.defaults.adapter;
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(`${base}/up`)).ok) break; } catch { /* startup only */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    api.defaults.baseURL = `${base}/api`;
    api.defaults.adapter = 'http';
    localStorage.setItem('token', auth.token);
    localStorage.setItem('user', JSON.stringify({ must_change_password: true }));
    render(<AuthProvider><Flow /></AuthProvider>);
    await screen.findByText('تغيير كلمة المرور المؤقتة');
    fireEvent.change(screen.getByLabelText('كلمة المرور المؤقتة'), { target: { value: 'TEST-Old!Password123' } });
    fireEvent.change(screen.getByLabelText('كلمة المرور الجديدة'), { target: { value: 'TEST-New!Password456' } });
    fireEvent.change(screen.getByLabelText('تأكيد كلمة المرور الجديدة'), { target: { value: 'TEST-New!Password456' } });
    fireEvent.click(screen.getByRole('button', { name: 'حفظ كلمة المرور وتسجيل الدخول مجدداً' }));
    await waitFor(() => expect(screen.getByText('TEST signed out')).toBeInTheDocument(), { timeout: 10000 });
    expect(localStorage.getItem('token')).toBeNull();
    const response = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ username: 'TEST_LOCAL_STAFF', password: 'TEST-New!Password456' }) });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.data.user.must_change_password).toBe(false);
    const revoked = await fetch(`${base}/api/me`, { headers: { Accept: 'application/json', Authorization: `Bearer ${auth.token}` } });
    expect(revoked.status).toBe(401);
  } finally {
    logGuard.mockRestore();
    cleanup();
    localStorage.clear();
    api.defaults.baseURL = previousBase;
    api.defaults.adapter = previousAdapter;
    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
    
    fs.rmSync(temp, { recursive: true, force: true });
  }
}, 60000);


