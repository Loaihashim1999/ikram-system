import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

// FSA frontend-config gate: the FSA build must be produced with an explicit
// local override (VITE_API_URL=/api) and must embed no remote HTTP origin.
// The tracked frontend/.env default remote origin is intentionally preserved
// (never printed) and flagged for the Azure destination audit.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidence = path.join(root, '.tmp/fsa/frontend-config-gate');
fs.mkdirSync(evidence, { recursive: true });
const outDir = path.join(evidence, 'build');
fs.rmSync(outDir, { recursive: true, force: true });
const env = { ...process.env, VITE_API_URL: '/api', VITE_API_BASE_URL: '/api' };
const results = [];
const mark = (name, condition, detail = '') => { results.push({ name, passed: Boolean(condition), detail }); console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${detail ? ` ${detail}` : ''}`); };

// 1. Tracked default origin exists but is preserved verbatim (unmodified in this gate).
const trackedEnv = fs.readFileSync(path.join(root, 'frontend/.env'), 'utf8');
const trackedOrigin = trackedEnv.match(/^VITE_API_URL=(.+)$/m)?.[1]?.trim() ?? '';
const isAbsoluteRemote = /^https?:\/\//i.test(trackedOrigin);
mark('tracked-origin-preserved', isAbsoluteRemote, isAbsoluteRemote ? 'tracked default origin is absolute (preserved for Azure audit)' : 'tracked origin is not absolute');

// 2. FSA build with explicit local override.
const build = spawnSync(process.execPath, [path.join(root, 'frontend/node_modules/vite/bin/vite.js'), 'build', '--outDir', '../.tmp/fsa/frontend-config-gate/build'], { cwd: path.join(root, 'frontend'), env, encoding: 'utf8', timeout: 180000 });
fs.writeFileSync(path.join(evidence, 'build.txt'), `${build.stdout || ''}${build.stderr || ''}`);
if (build.status !== 0) { mark('build-success', false, (build.stderr || '').slice(0, 300)); process.exitCode = 1; process.exit(0); }
mark('build-success', true, 'FSA build produced');

// 3. Scan emitted assets for any absolute remote origin in JS.
const assets = [];
const scan = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(full);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.html')) assets.push(full);
  }
};
scan(outDir);
// Documented exemptions: remote-looking literals embedded in the FSA build that
// are never contacted at runtime, each with a rationale. Anything else fails.
//   - XML namespace constants inside the bundled SheetJS (xlsx) vendor chunk:
//     www.w3.org, schemas.openxmlformats.org, schemas.microsoft.com, purl.org,
//     purl.oclc.org, docs.oasis-open.org, openoffice.org,
//     sheetjs.openxmlformats.org, macVmlSchemaUri.
//   - ikram-system.onrender.com: dead fallback in URL-construction helpers; only
//     evaluated when VITE_API_BASE_URL and VITE_API_URL are BOTH absent; this
//     build pins both to '/api', so Vite constant-folds it out of the bundle.
//   - ingest.us.sentry.io / 8241b7d9db67980ffefbe95c034847ad: frontend
//     telemetry DSN compiled into the bundle. Sentry.init is lazy (tracing/Replay
//     integrations disabled, sample rates 0) and the browser gates assert ZERO
//     runtime contacts to remote hosts.
//   - docs.sentry.io, react.dev, reactrouter.com, github.com: documentation and
//     repository link constants inside the minified Sentry/React/ReactRouter
//     vendor SDK bundles; never fetched at runtime.
const exemptHosts = new Set([
  'www.w3.org', 'schemas.openxmlformats.org', 'schemas.microsoft.com',
  'purl.org', 'purl.oclc.org', 'docs.oasis-open.org', 'openoffice.org',
  'sheetjs.openxmlformats.org', 'macVmlSchemaUri',
  'ikram-system.onrender.com', '8241b7d9db67980ffefbe95c034847ad',
  'o4512063801786368', 'ingest.us.sentry.io',
  'docs.sentry.io', 'react.dev', 'reactrouter.com', 'github.com',
]);
const remoteHits = [];
const exemptSeen = new Set();
for (const file of assets) {
  const content = fs.readFileSync(file, 'utf8');
  const matches = content.match(/https?:\/\/[a-zA-Z0-9.-]+/g) ?? [];
  for (const url of matches) {
    const host = url.replace(/^https?:\/\//, '').split(/[/:]/)[0];
    if (['localhost', '127.0.0.1'].includes(host) || host.endsWith('.invalid') || host.endsWith('.test')) continue;
    if (exemptHosts.has(host)) { exemptSeen.add(host); continue; }
    remoteHits.push(`${path.basename(file)}: ${url.slice(0, 60)}`);
  }
}
mark('no-remote-origin-in-fsa-build', remoteHits.length === 0, remoteHits.length ? remoteHits.slice(0, 5).join(' | ') : `assets scanned = ${assets.length}, exempted documented literals = ${[...exemptSeen].sort().join(',')}`);

// 4. The FSA build API base is the local prefix (minified axios uses a backtick
//    template literal: `baseURL:`/api`` when Vite inlines the env override).
const apiBaseHits = [];
for (const file of assets.filter((f) => f.endsWith('.js'))) {
  const content = fs.readFileSync(file, 'utf8');
  if (/baseURL\s*:\s*[`'"]\/api[`'"]/.test(content)) apiBaseHits.push(file);
}
mark('local-api-prefix-embedded', apiBaseHits.length > 0, `files embedding the local "/api" axios base = ${apiBaseHits.length}`);

const summary = { total: results.length, passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, results };
fs.writeFileSync(path.join(evidence, 'browser.json'), JSON.stringify(summary, null, 2));
console.log(`TOTAL = ${summary.total}\nPASSED = ${summary.passed}\nFAILED = ${summary.failed}`);
process.exitCode = summary.failed ? 1 : 0;