import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { compose, readConfiguration } from './local.mjs';

// Only a unique synthetic smoke table is created/dropped. Never truncate app data.
const table = `t01_smoke_${randomUUID().replaceAll('-', '')}`;
function sql(statement) {
  return compose(['exec', '-T', 'postgres', 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -Atq'],
  { capture: true, input: statement });
}
let created = false;
try {
  compose(['config', '--quiet']);
  const services = JSON.parse(compose(['ps', '--format', 'json'], { capture: true }));
  const postgres = (Array.isArray(services) ? services : [services]).find((service) => service.Service === 'postgres');
  assert.equal(postgres?.Health, 'healthy', 'Start a healthy database with npm run infra:up first.');
  const publishers = postgres.Publishers ?? [];
  const port = Number(readConfiguration().POSTGRES_PORT);
  assert(publishers.some((item) => item.URL === '127.0.0.1' && item.PublishedPort === port && item.TargetPort === 5432));
  assert(publishers.every((item) => !item.PublishedPort || item.URL === '127.0.0.1'), 'Database port must stay loopback-only.');
  assert.equal(sql('SELECT 1;'), '1');
  console.log('PASS: healthy PostgreSQL, password-authenticated TCP query and loopback-only port.');
  sql(`CREATE TABLE ${table} (value text NOT NULL); INSERT INTO ${table} VALUES ('synthetic-t01-marker');`);
  created = true;
  compose(['down', '--timeout', '15']);
  compose(['up', '-d', '--wait', '--wait-timeout', '90']);
  assert.equal(sql(`SELECT value FROM ${table};`), 'synthetic-t01-marker');
  console.log('PASS: synthetic marker persisted through container removal/recreation.');
  console.log(`PostgreSQL version: ${sql('SHOW server_version;')}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) {
    try { sql(`DROP TABLE ${table};`); } catch {
      console.error(`Cleanup failed: remove only smoke table ${table} after the database is available.`);
      process.exitCode = 1;
    }
  }
}
