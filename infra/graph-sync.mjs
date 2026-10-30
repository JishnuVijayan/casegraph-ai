import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { readConfiguration, root } from './local.mjs';

try {
  const config = readConfiguration();
  const result = spawnSync(process.execPath, [join(root, 'apps/api/dist/investigations/sync-cli.js')], {
    cwd: root, stdio: 'inherit', timeout: 300_000,
    env: { ...process.env, TIGERGRAPH_ENABLED: 'true', PGHOST: '127.0.0.1', PGPORT: config.POSTGRES_PORT,
      PGUSER: 'casegraph', PGDATABASE: 'casegraph', PGPASSWORD: config.POSTGRES_PASSWORD },
  });
  if (result.error || result.status !== 0) throw new Error('graph:sync failed. Start the SSH tunnel (npm run aws:tg:tunnel-hint) and install the v2 schema first.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
