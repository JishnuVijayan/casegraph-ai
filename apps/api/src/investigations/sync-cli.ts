import { eq } from 'drizzle-orm';
import { resolve } from 'node:path';
import { AccessStore } from '../auth/store';
import { connect } from '../db/connection';
import { cases } from '../db/schema';
import { GraphConfig, TigerGraphClient } from './client';
import { SimilarGraphService } from './similar-graph';

/** `npm run graph:sync`: upsert every submitted Postgres case into TigerGraph v2, then refresh stored similar-case results. */
async function main() {
  const connection = connect();
  try {
    const config = new GraphConfig();
    if (!config.enabled) throw new Error('TIGERGRAPH_ENABLED is false.');
    const token = resolve(__dirname, '../../../../.local/tigergraph-app.token');
    const service = new SimilarGraphService(new AccessStore(connection), new TigerGraphClient(config, fetch, token));
    const ids = (await connection.db.select({ id: cases.id }).from(cases).where(eq(cases.status, 'REVIEW_REQUIRED'))).map((r) => r.id);
    let upserted = 0, mentions = 0;
    for (const id of ids) { mentions += await service.upsertCase(id); upserted += 1; }
    let ready = 0, none = 0, unavailable = 0;
    for (const id of ids) {
      const r = await service.refresh(id);
      if (r.status === 'READY') ready += 1; else if (r.status === 'NONE') none += 1; else unavailable += 1;
    }
    console.log(JSON.stringify({ status: unavailable ? 'PARTIAL' : 'SYNCED', cases: upserted, mentions, similarReady: ready, similarNone: none, similarUnavailable: unavailable }));
    if (unavailable) process.exitCode = 1;
  } finally { await connection.pool.end(); }
}
void main().catch(() => {
  // Never print tokens, response bodies or connection details.
  console.error('Graph sync failed. Check the SSH tunnel, the installed CaseGraphV2 schema/query and .local/tigergraph-app.token.');
  process.exitCode = 1;
});
