import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readConfiguration, root } from './local.mjs';
const config = readConfiguration();
const result = spawnSync(process.execPath, [join(root, 'node_modules/jest/bin/jest.js'), '--config', 'jest.claims.config.cjs', '--runInBand'], {
  cwd: join(root, 'apps/api'), stdio: 'inherit', timeout: 120000,
  env: { ...process.env, PGPASSWORD: config.POSTGRES_PASSWORD, PGPORT: config.POSTGRES_PORT },
});
if (result.error || result.status !== 0) throw new Error('Claims/timeline integration tests failed. Check local PostgreSQL and test output.');
