import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const basePort = 20000 + (randomBytes(2).readUInt16BE(0) % 1000);
const database = path.join(root, 'storage/app/reports', `qa-isolated-first-admin-race-${randomUUID()}.sqlite`);
const env = { ...process.env, APP_ENV: 'testing', APP_DEBUG: 'false', DB_CONNECTION: 'sqlite', DB_DATABASE: database, DB_URL: '', CACHE_STORE: 'array', SESSION_DRIVER: 'array', QUEUE_CONNECTION: 'sync', LOG_CHANNEL: 'stderr', IKRAM_ADMIN_PASSWORD: '' };
fs.writeFileSync(database, '');
if (spawnSync('php', ['artisan', 'migrate', '--force'], { cwd: root, env }).status !== 0) throw new Error('Race database migration failed');

const servers = [basePort, basePort + 1].map((port) => spawn('php', ['-S', `127.0.0.1:${port}`, '-t', path.join(root, 'public'), path.join(root, 'tests/Browser/server-router.php')], { cwd: root, env, stdio: 'ignore' }));
try {
  for (const port of [basePort, basePort + 1]) {
    for (let attempt = 0; attempt < 40; attempt++) {
      try { if ((await fetch(`http://127.0.0.1:${port}/up`)).ok) break; } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const password = `Aa!9${randomBytes(12).toString('hex')}`;
  const submit = (port, suffix) => fetch(`http://127.0.0.1:${port}/api/setup-admin`, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ full_name: `Race Admin ${suffix}`, username: `race_admin_${suffix}`, email: `race${suffix}@example.test`, password, password_confirmation: password }),
  });
  const responses = await Promise.all([submit(basePort, 'a'), submit(basePort + 1, 'b')]);
  const statuses = responses.map((response) => response.status).sort();
  const count = Number(spawnSync('php', ['-r', `$pdo=new PDO('sqlite:${database.replaceAll('\\', '/')}'); echo $pdo->query('select count(*) from users')->fetchColumn();`], { encoding: 'utf8' }).stdout);
  if (statuses[0] !== 201 || ![403, 422].includes(statuses[1]) || count !== 1) throw new Error(`Race protection failed: statuses=${statuses.join(',')} users=${count}`);
  console.log(JSON.stringify({ simultaneousRequests: 2, usersCreated: count, statuses, status: 'PASS' }));
} finally {
  for (const server of servers) server.kill();
  fs.rmSync(database, { force: true });
}
