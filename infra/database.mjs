import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readConfiguration, root } from './local.mjs';

try {
  const action = process.argv[2];
  if (!['migrate', 'seed', 'verify'].includes(action)) throw new Error('Use migrate, seed or verify.');
  const config = readConfiguration();
  const result = spawnSync(process.execPath, [join(root, 'apps/api/dist/db/cli.js'), action], {
    cwd: root, stdio: 'inherit', timeout: 120_000,
    env: { ...process.env, PGHOST: '127.0.0.1', PGPORT: config.POSTGRES_PORT,
      PGUSER: 'casegraph', PGDATABASE: 'casegraph', PGPASSWORD: config.POSTGRES_PASSWORD },
  });
  if (result.error || result.status !== 0) throw new Error(`Local database ${action} failed. Check infrastructure/configuration; no connection details are logged.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
