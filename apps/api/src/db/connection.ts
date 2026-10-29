import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export function connect(database = 'casegraph') {
  if (!process.env.PGPASSWORD || !process.env.PGPORT) {
    throw new Error('Use the root database commands to load validated local configuration.');
  }
  const pool = new Pool({
    host: '127.0.0.1', port: Number(process.env.PGPORT), user: 'casegraph',
    password: process.env.PGPASSWORD, database, ssl: false, max: 2,
    connectionTimeoutMillis: 3000, query_timeout: 10000, idleTimeoutMillis: 1000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}

export type Database = ReturnType<typeof connect>['db'];
