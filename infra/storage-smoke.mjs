import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { evidenceDirectory, initialize, root } from './local.mjs';

const children = [];
const filename = `synthetic-t01-${randomUUID()}.txt`;
const sentinelPath = join(evidenceDirectory, filename);
const sentinel = `SYNTHETIC-PRIVATE-EVIDENCE-${randomUUID()}`;
let created = false;

async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${port} is occupied; stop its service before the storage smoke check.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}

function start(args, cwd) {
  const child = spawn(process.execPath, args, { cwd, stdio: 'ignore' });
  child.once('error', () => { child.startFailed = true; });
  children.push(child);
}

async function response(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: 'error' });
  return { status: res.status, text: await res.text() };
}

async function waitFor(url, check) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (children.some((child) => child.startFailed || child.exitCode !== null)) {
      throw new Error('A smoke-check server failed to start.');
    }
    try {
      const res = await response(url);
      if (res.status === 200 && check(res.text)) return;
    } catch { /* bounded startup polling; no assumed success */ }
    await delay(250);
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function checkBuild(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    assert(!entry.isSymbolicLink(), 'Unexpected symlink in frontend build output.');
    if (entry.isDirectory()) checkBuild(path);
    else {
      assert(!entry.name.includes(filename), 'Private evidence filename found in frontend output.');
      assert(!readFileSync(path).includes(Buffer.from(sentinel)), 'Private evidence bytes found in frontend output.');
    }
  }
}

try {
  initialize();
  for (const port of [3000, 15173, 15174]) await freePort(port);
  const ignored = spawnSync('git', ['check-ignore', '--quiet', sentinelPath], { cwd: root });
  assert.equal(ignored.status, 0, 'Private evidence must be gitignored.');
  writeFileSync(sentinelPath, sentinel, { flag: 'wx', mode: 0o600 });
  created = true;
  // Build while the sentinel exists to detect accidental inclusion in assets.
  const build = spawnSync(process.execPath, [process.env.npm_execpath, 'run', 'build'], {
    cwd: root, stdio: 'inherit', timeout: 120_000,
  });
  assert.equal(build.status, 0, 'Build failed.');
  checkBuild(join(root, 'apps', 'web', 'dist'));
  const vite = join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  const web = join(root, 'apps', 'web');
  start([join(root, 'apps', 'api', 'dist', 'main.js')], root);
  start([vite, '--host', '127.0.0.1', '--port', '15173', '--strictPort'], web);
  start([vite, 'preview', '--host', '127.0.0.1', '--port', '15174', '--strictPort'], web);
  const isLive = (text) => JSON.parse(text).data?.scope === 'process-only';
  await waitFor('http://127.0.0.1:3000/api/v1/health/live', isLive);
  await waitFor('http://127.0.0.1:15173/api/v1/health/live', isLive);
  await waitFor('http://127.0.0.1:15174/', (text) => text.includes('CaseGraph AI'));
  const paths = [
    `/.local/evidence/${filename}`,
    `/evidence/${filename}`,
    `/api/v1/evidence/${filename}`,
    `/@fs${sentinelPath}`,
    `/@fs${sentinelPath}?raw`,
    `/@fs${sentinelPath}?import&raw`,
    `/@fs${encodeURI(sentinelPath)}?url`,
  ];
  for (const base of ['http://127.0.0.1:3000', 'http://127.0.0.1:15173', 'http://127.0.0.1:15174']) {
    for (const path of paths) {
      const res = await response(`${base}${path}`);
      assert(res.status < 500, `Unexpected server error for ${base}${path}`);
      assert(!res.text.includes(sentinel), `Private evidence leaked through ${base}${path}`);
      if (base.endsWith(':3000')) assert.equal(res.status, 404);
      if (base.endsWith(':15173') && path.startsWith('/@fs')) assert.equal(res.status, 403);
    }
  }
  console.log('PASS: private storage ignored; 21 HTTP probes across API, Vite and preview disclose no sentinel bytes.');
  console.log('PASS: Vite filesystem probes denied (403); production assets contain no sentinel.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  for (const child of children) {
    if (child.exitCode === null && !child.startFailed) {
      const closed = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      await closed;
      clearTimeout(timer);
    }
  }
  if (created) unlinkSync(sentinelPath);
  console.log('Smoke servers stopped; only this run’s synthetic sentinel removed.');
}
