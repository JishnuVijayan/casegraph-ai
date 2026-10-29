import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export function connect(database = 'casegraph', local?: { port: number; password: string }) {
  if (!local && (!process.env.PGPASSWORD || !process.env.PGPORT)) {
    throw new Error('Use the root database commands to load validated local configuration.');
  }
  const pool = new Pool({
    host: '127.0.0.1', port: local?.port ?? Number(process.env.PGPORT), user: 'casegraph',
    password: local?.password ?? process.env.PGPASSWORD, database, ssl: false, max: 2,
    connectionTimeoutMillis: 3000, query_timeout: 10000, idleTimeoutMillis: 1000,
  });
  // Idle connection failures must not crash the API or log credentials. Next queries fail safely.
  pool.on('error', () => undefined);
  return { pool, db: drizzle(pool, { schema }) };
}

export type Database = ReturnType<typeof connect>['db'];
