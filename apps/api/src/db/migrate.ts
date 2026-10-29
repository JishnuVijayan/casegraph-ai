import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Database } from './connection';

export async function migrateDatabase(db: Database) {
  await migrate(db, { migrationsFolder: resolve(__dirname, '../../drizzle') });
}
