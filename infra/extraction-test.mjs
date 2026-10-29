import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfiguration } from './local.mjs';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = readConfiguration();
const result = spawnSync(process.execPath, [join(root, 'node_modules/jest/bin/jest.js'), '--config', 'jest.extraction.config.cjs', '--runInBand'], {
  cwd: join(root, 'apps/api'), stdio: 'inherit', timeout: 120000,
  env: { ...process.env, PGPASSWORD: config.POSTGRES_PASSWORD, PGPORT: config.POSTGRES_PORT },
});
process.exit(result.status ?? 1);
