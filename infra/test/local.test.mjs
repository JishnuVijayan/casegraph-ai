import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, lstatSync, symlinkSync, rmSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { initialize, readConfiguration } from '../local.mjs';

function fixture(run) {
  const base = mkdtempSync(join(tmpdir(), 'casegraph-t01-test-'));
  try { run(base); } finally { rmSync(base, { recursive: true, force: true }); }
}

test('initialization preserves credentials and existing evidence on repeated runs', () => fixture((base) => {
  initialize(base);
  const before = readFileSync(join(base, '.env'));
  const evidence = join(base, '.local', 'evidence');
  writeFileSync(join(evidence, 'synthetic.txt'), 'synthetic-original', { mode: 0o600 });
  initialize(base);
  assert.deepEqual(readFileSync(join(base, '.env')), before);
  assert.equal(readFileSync(join(evidence, 'synthetic.txt'), 'utf8'), 'synthetic-original');
  assert.equal(lstatSync(evidence).mode & 0o777, 0o700);
  assert.equal(lstatSync(join(base, '.env')).mode & 0o077, 0);
}));

test('missing, placeholder and invalid-port configuration fails without revealing values', () => fixture((base) => {
  assert.throws(() => readConfiguration(base), /Missing .env/);
  writeFileSync(join(base, '.env'), 'POSTGRES_PASSWORD=\n', { mode: 0o600 });
  assert.throws(() => readConfiguration(base), /POSTGRES_PASSWORD must/);
  writeFileSync(join(base, '.env'), `POSTGRES_PASSWORD=${'a'.repeat(32)}\nPOSTGRES_PORT=0\n`);
  assert.throws(() => readConfiguration(base), /POSTGRES_PORT must/);
}));

test('initialization refuses a symlinked private directory', () => fixture((base) => {
  symlinkSync(base, join(base, '.local'));
  assert.throws(() => initialize(base), /real directory/);
}));

test('configuration rejects symlinks and world-readable credentials', () => fixture((base) => {
  const target = join(base, 'credentials');
  writeFileSync(target, `POSTGRES_PASSWORD=${'a'.repeat(32)}\n`, { mode: 0o600 });
  symlinkSync(target, join(base, '.env'));
  assert.throws(() => readConfiguration(base), /regular owner-only file/);
  rmSync(join(base, '.env'));
  writeFileSync(join(base, '.env'), readFileSync(target), { mode: 0o600 });
  chmodSync(join(base, '.env'), 0o644);
  assert.throws(() => readConfiguration(base), /regular owner-only file/);
}));
