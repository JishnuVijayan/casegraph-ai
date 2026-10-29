import { connect } from './connection';
import { migrateDatabase } from './migrate';
import { seedSynthetic } from './seed';
import { verifyDatabase } from './verify';

async function main() {
  const action = process.argv[2];
  if (action === 'verify') return verifyDatabase();
  if (action !== 'migrate' && action !== 'seed') throw new Error('Unsupported database action.');
  const { db, pool } = connect();
  try {
    if (action === 'migrate') await migrateDatabase(db);
    else await seedSynthetic(db);
    console.log(action === 'migrate' ? 'Local migrations applied (or already current).' : 'Synthetic seed applied; existing rows preserved.');
  } finally { await pool.end(); }
}

void main().catch((error: unknown) => {
  // Never print SQL parameters, connection strings, fixture content or stack traces.
  const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : error;
  const code = cause && typeof cause === 'object' && 'code' in cause ? String(cause.code) : 'CHECK_FAILED';
  console.error(`Database command failed (${code}). Verify local infrastructure, migration and fixture configuration.`);
  process.exitCode = 1;
});
