import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { connect } from './connection';
import { loadFixtures } from './fixtures';
import { migrateDatabase } from './migrate';
import { seedSynthetic } from './seed';

// This database name is generated here, never accepted from user input.
export async function verifyDatabase() {
  const database = `casegraph_t02_test_${randomUUID().replaceAll('-', '')}`;
  const admin = connect();
  let test: ReturnType<typeof connect> | undefined;
  let created = false;
  try {
    await admin.pool.query(`CREATE DATABASE "${database}"`);
    created = true;
    test = connect(database);
    const { pool, db } = test;
    await migrateDatabase(db);
    const journal = (await pool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows;
    assert.equal(journal.length, 7);
    await migrateDatabase(db);
    assert.deepEqual((await pool.query('SELECT * FROM drizzle.__drizzle_migrations ORDER BY id')).rows, journal);
    const expectedTables = [
      'audit_events', 'case_access_grants', 'case_analyses', 'cases', 'claim_revisions', 'claim_sources', 'claims',
      'clarifications', 'event_claims', 'evidence_files', 'exports', 'extraction_regions', 'extraction_runs', 'file_reads', 'graph_leads',
      'narratives', 'organizations', 'timeline_events', 'users',
    ];
    assert.deepEqual((await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename")).rows.map((row) => row.tablename), expectedTables);
    const indexes = (await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")).rows.map((row) => row.indexname);
    for (const name of ['cases_owner_idx', 'evidence_case_idx', 'claims_case_idx', 'claim_sources_claim_idx', 'grants_case_organization_scope_unique', 'audit_created_idx']) {
      assert(indexes.includes(name), `Missing required index ${name}`);
    }
    console.log('PASS: fresh migration, repeat no-op, 16 tables and required indexes.');
    await seedSynthetic(db);
    const fixture = loadFixtures();
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const table of ['organizations', 'users', 'cases', 'case_access_grants']) {
        result[table] = (await pool.query(`SELECT * FROM ${table} ORDER BY id`)).rows;
      }
      return result;
    };
    const before = await snapshot();
    assert.equal((before.organizations as unknown[]).length, 1);
    assert.ok((before.users as unknown[]).length >= 3);
    assert.ok((before.cases as unknown[]).length >= 200);
    assert.ok((before.case_access_grants as unknown[]).length >= fixture.grants.length);
    await seedSynthetic(db);
    assert.deepEqual(await snapshot(), before);
    const firstCase = fixture.cases[0].id!;
    const secondCase = fixture.cases[1].id!;
    const victim = fixture.users[0].id!;
    const grant = fixture.grants[0].id!;
    await pool.query("UPDATE cases SET title = 'Synthetic manually edited title', status = 'REVIEW_REQUIRED' WHERE id = $1", [firstCase]);
    await pool.query("UPDATE case_access_grants SET revoked_at = '2026-10-29T00:00:00Z' WHERE id = $1", [grant]);
    const edited = await snapshot();
    await seedSynthetic(db);
    assert.deepEqual(await snapshot(), edited);
    console.log(`PASS: 1 organization, 3+ users, 200+ cases, ${fixture.grants.length} grants; repeated seed unchanged and edits/revocations preserved.`);

    async function rejects(statement: string, values: unknown[], code: string) {
      await assert.rejects(() => pool.query(statement, values), (error: unknown) =>
        typeof error === 'object' && error !== null && 'code' in error && error.code === code);
    }
    await rejects('INSERT INTO cases (owner_id, category, title) VALUES ($1, $2, $3)', [randomUUID(), 'synthetic', 'Synthetic invalid owner'], '23503');
    await rejects('INSERT INTO users (role, demo_subject, display_name) VALUES ($1, $2, $3)', ['victim', fixture.users[0].demoSubject, 'Fictional duplicate'], '23505');
    await rejects('INSERT INTO users (role, demo_subject, display_name) VALUES ($1, $2, $3)', ['criminal', 'synthetic-invalid-role', 'Fictional invalid'], '22P02');
    const evidence = randomUUID();
    const claim = randomUUID();
    await rejects('INSERT INTO evidence_files (case_id, uploader_id, object_key, sha256, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5,$6)', [firstCase, victim, 'synthetic-invalid', 'not-a-hash', 'image/png', 1], '23514');
    await rejects('INSERT INTO evidence_files (case_id, uploader_id, object_key, sha256, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5,$6)', [firstCase, victim, 'synthetic-invalid', 'a'.repeat(64), 'image/png', 0], '23514');
    await pool.query('INSERT INTO evidence_files (id, case_id, uploader_id, object_key, sha256, mime_type, size_bytes) VALUES ($1,$2,$3,$4,$5,$6,$7)', [evidence, firstCase, victim, 'synthetic-test-only', 'a'.repeat(64), 'image/png', 1]);
    const extraction = randomUUID();
    await pool.query('INSERT INTO extraction_runs (id, evidence_file_id, engine, version, status) VALUES ($1,$2,$3,$4,$5)', [extraction, evidence, 'tesseract', 'test', 'SUCCEEDED']);
    await rejects('INSERT INTO extraction_regions (run_id, kind, text, text_span, bbox_json, confidence) VALUES ($1,$2,$3,$4,$5,$6)', [extraction, 'TEXT', 'synthetic', JSON.stringify({ start: 0, end: 8 }), JSON.stringify({ x: 0.9, y: 0, width: 0.2, height: 0.5 }), 90], '23514');
    await rejects('INSERT INTO extraction_regions (run_id, kind, text, text_span, bbox_json, confidence) VALUES ($1,$2,$3,$4,$5,$6)', [extraction, 'TEXT', 'synthetic', JSON.stringify({ start: 0, end: 8 }), JSON.stringify({ x: 0, y: 0, width: 0.5, height: 0.5 }), 101], '23514');
    await rejects('INSERT INTO timeline_events (case_id, event_type, precision, uncertainty, occurred_at) VALUES ($1,$2,$3,$4,$5)', [firstCase, 'payment', 'SOMEDAY', 'synthetic uncertainty', null], '23514');
    await rejects('INSERT INTO timeline_events (case_id, event_type, precision, uncertainty, occurred_at) VALUES ($1,$2,$3,$4,$5)', [firstCase, 'payment', 'UNKNOWN', 'synthetic uncertainty', new Date()], '23514');
    await rejects('INSERT INTO timeline_events (case_id, event_type, precision, uncertainty, occurred_at) VALUES ($1,$2,$3,$4,$5)', [firstCase, 'payment', 'DATE_ONLY', 'synthetic uncertainty', new Date('2026-10-29T12:00:00Z')], '23514');
    await pool.query('INSERT INTO claims (id, case_id, type, raw_value, source_kind) VALUES ($1,$2,$3,$4,$5)', [claim, secondCase, 'synthetic', 'synthetic-value', 'OBSERVED_IN_UPLOAD']);
    assert.equal((await pool.query('SELECT verification_status FROM claims WHERE id=$1', [claim])).rows[0].verification_status, 'UNVERIFIED');
    await rejects('INSERT INTO claim_sources (case_id, claim_id, evidence_file_id) VALUES ($1,$2,$3)', [secondCase, claim, evidence], '23503');
    const event = randomUUID();
    await pool.query('INSERT INTO timeline_events (id, case_id, event_type, precision, uncertainty) VALUES ($1,$2,$3,$4,$5)', [event, firstCase, 'other', 'UNKNOWN', 'UNKNOWN']);
    await rejects('INSERT INTO event_claims (case_id, event_id, claim_id) VALUES ($1,$2,$3)', [firstCase, event, claim], '23503');
    await rejects('INSERT INTO case_access_grants (case_id, organization_id, scope, granted_by) VALUES ($1,$2,$3,$4)', [firstCase, fixture.organization.id, 'INVESTIGATE', victim], '23505');
    await rejects('INSERT INTO exports (case_id, version, object_key, created_by) VALUES ($1,$2,$3,$4)', [firstCase, 0, 'synthetic-export', victim], '23514');
    const sameCaseClaim = randomUUID();
    await pool.query('INSERT INTO claims (id, case_id, type, raw_value, source_kind) VALUES ($1,$2,$3,$4,$5)', [sameCaseClaim, firstCase, 'synthetic', 'synthetic-value', 'OBSERVED_IN_UPLOAD']);
    await pool.query('INSERT INTO claim_sources (case_id, claim_id, evidence_file_id) VALUES ($1,$2,$3)', [firstCase, sameCaseClaim, evidence]);
    await pool.query('INSERT INTO event_claims (case_id, event_id, claim_id) VALUES ($1,$2,$3)', [firstCase, event, sameCaseClaim]);
    console.log('PASS: foreign keys, uniqueness, role enum, hash/size/version checks, bounded OCR spans/boxes, UNVERIFIED default, cross-case rejection and valid same-case provenance.');
  } finally {
    if (test) await test.pool.end();
    if (created) {
      // Never remove the working casegraph database or its volume.
      await admin.pool.query(`DROP DATABASE "${database}"`);
      console.log('Temporary synthetic verification database removed.');
    }
    await admin.pool.end();
  }
}
