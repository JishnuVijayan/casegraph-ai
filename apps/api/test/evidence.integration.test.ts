import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, stat, chmod, writeFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { DemoConfig } from '../src/auth/config';
import { LOCAL_DATABASE } from '../src/auth/store';
import { EVIDENCE_DIRECTORY, MAX_FILE_BYTES } from '../src/evidence/storage';
import { configureHttp } from '../src/common/http';
import { connect } from '../src/db/connection';
import { migrateDatabase } from '../src/db/migrate';
import { seedSynthetic } from '../src/db/seed';
import { loadFixtures } from '../src/db/fixtures';

describe('immutable synthetic image evidence over HTTP', () => {
  const database = `casegraph_t04_test_${randomUUID().replaceAll('-', '')}`;
  const fixture = loadFixtures();
  let app: INestApplication;
  let admin: ReturnType<typeof connect>; let connection: ReturnType<typeof connect>;
  let parent: string; let directory: string; let created = false;
  let a: string; let b: string; let analyst: string; let caseId: string; let evidenceId: string;
  let png: Buffer; let jpeg: Buffer;
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const upload = (bytes: Buffer, mime = 'image/png', target = caseId, token = a) => http().post(`/api/v1/cases/${target}/evidence`)
    .set('Authorization', auth(token)).attach('file', bytes, { filename: '../../synthetic.png', contentType: mime });
  const view = (id = evidenceId, target = caseId, token = a) => http().get(`/api/v1/cases/${target}/evidence/${id}/view`).set('Authorization', auth(token));
  beforeAll(async () => {
    parent = await mkdtemp(join(tmpdir(), 'casegraph-t04-')); directory = join(parent, 'evidence');
    admin = connect(); await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database); await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DemoConfig).useValue({ enabled: true, ttlMs: 1800000 })
      .overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(EVIDENCE_DIRECTORY).useValue(directory).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    const login = async (demoSubject: string) => (await http().post('/api/v1/auth/demo').send(demoSubject === 'synthetic-analyst' ? { demoSubject, password: 'HHGOAOFFICER' } : { demoSubject }).expect(200)).body.data.token;
    a = await login('synthetic-victim-a'); b = await login('synthetic-victim-b'); analyst = await login('synthetic-analyst');
    png = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
    jpeg = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#abcdef' } }).jpeg().toBuffer();
  });
  afterAll(async () => {
    try {
      if (app) await app.close(); else if (connection) await connection.pool.end();
      if (created) await admin.pool.query(`DROP DATABASE "${database}"`);
    } finally { if (admin) await admin.pool.end(); if (parent) await rm(parent, { recursive: true, force: true }); }
  });
  it('creates only victim-owned synthetic drafts and rejects identity injection', async () => {
    const dto = { title: 'Fictional image test', category: 'upi_payment_fraud' };
    await http().post('/api/v1/cases').set('Authorization', auth(analyst)).send(dto).expect(403);
    await http().post('/api/v1/cases').set('Authorization', auth(a)).send({ ...dto, ownerId: fixture.users[1].id }).expect(400);
    await http().post('/api/v1/cases').set('Authorization', auth(a)).send({ ...dto, category: 'bogus' }).expect(400);
    const res = await http().post('/api/v1/cases').set('Authorization', auth(a)).send(dto).expect(201);
    caseId = res.body.data.id;
    expect(res.body.data.reference).toMatch(/^CG-/);
    expect((await connection.pool.query('SELECT owner_id FROM cases WHERE id=$1', [caseId])).rows[0].owner_id).toBe(fixture.users[0].id);
  });
  it('preserves exact PNG bytes, SHA-256 and private read-only original metadata', async () => {
    const res = await upload(png).expect(201); evidenceId = res.body.data.id;
    expect(res.body.data.sha256).toBe(createHash('sha256').update(png).digest('hex'));
    expect(res.body.data.sizeBytes).toBe(png.length);
    expect(res.body.data.objectKey).toBeUndefined();
    expect((await stat(join(directory, `${evidenceId}.original`))).mode & 0o777).toBe(0o400);
    expect(await readFile(join(directory, `${evidenceId}.original`))).toEqual(png);
    const original = await view().expect(200);
    expect(original.body).toEqual(png);
    expect(original.headers['content-type']).toBe('image/png');
    expect(original.headers['content-disposition']).toContain('inline');
    expect(original.headers['x-content-type-options']).toBe('nosniff');
    expect(original.headers['cache-control']).toMatch(/no-store/);
  });
  it('accepts JPEG and duplicate uploads as new sources without replacing originals', async () => {
    const duplicate = await upload(png).expect(201);
    expect(duplicate.body.data.id).not.toBe(evidenceId);
    expect(duplicate.body.data.sha256).toBe(createHash('sha256').update(png).digest('hex'));
    const jpg = await upload(jpeg, 'image/jpeg').expect(201);
    expect((await view(jpg.body.data.id).expect(200)).body).toEqual(jpeg);
    expect(await readFile(join(directory, `${evidenceId}.original`))).toEqual(png);
    await http().put(`/api/v1/cases/${caseId}/evidence/${evidenceId}`).set('Authorization', auth(a)).send({}).expect(404);
  });
  it('rejects forged types, PDF/SVG, corrupt images, empty/multiple files and oversize without residue', async () => {
    const before = await readdir(directory);
    await upload(Buffer.from('%PDF synthetic'), 'application/pdf').expect(415);
    await upload(Buffer.from('<svg/>'), 'image/svg+xml').expect(415);
    await upload(jpeg, 'image/png').expect(415);
    await upload(png.subarray(0, 20)).expect(415);
    await upload(Buffer.alloc(0)).expect(400);
    await upload(Buffer.alloc(MAX_FILE_BYTES + 1)).expect(413);
    await http().post(`/api/v1/cases/${caseId}/evidence`).set('Authorization', auth(a))
      .attach('file', png, 'a.png').attach('file', png, 'b.png').expect(400);
    expect((await readdir(directory)).sort()).toEqual(before.sort());
  });
  it('denies unauthorized upload/list/view and evidence IDs substituted across cases', async () => {
    await upload(png, 'image/png', caseId, b).expect(403);
    await upload(png, 'image/png', caseId, analyst).expect(403);
    await http().get(`/api/v1/cases/${caseId}/evidence`).set('Authorization', auth(b)).expect(403);
    await view(evidenceId, caseId, b).expect(403);
    await view(evidenceId, fixture.cases[1].id!, b).expect(403);
    await view(randomUUID()).expect(403);
    await view('../../fake').expect(404);
  });
  it('grants an analyst original access, then denies the next read/list after revocation', async () => {
    expect((await view(evidenceId, caseId, analyst).expect(200)).body).toEqual(png);
    const list = await http().get(`/api/v1/cases/${caseId}/evidence`).set('Authorization', auth(analyst)).expect(200);
    expect(list.body.data).toHaveLength(3);
    // Auto-grant INVESTIGATE plus any explicit READ must both be revoked to deny.
    const grantIds = (await connection.pool.query(
      'SELECT id FROM case_access_grants WHERE case_id=$1 AND revoked_at IS NULL', [caseId],
    )).rows.map((row: { id: string }) => row.id);
    expect(grantIds.length).toBeGreaterThan(0);
    for (const grantId of grantIds) {
      await http().delete(`/api/v1/cases/${caseId}/shares/${grantId}`).set('Authorization', auth(a)).expect(200);
    }
    await view(evidenceId, caseId, analyst).expect(403);
    await http().get(`/api/v1/cases/${caseId}/evidence`).set('Authorization', auth(analyst)).expect(403);
  });
  it('lets the owner remove a draft upload and deletes private bytes', async () => {
    const res = await upload(png).expect(201);
    const removable = res.body.data.id as string;
    const path = join(directory, `${removable}.original`);
    expect(await readFile(path)).toEqual(png);
    await http().delete(`/api/v1/cases/${caseId}/evidence/${removable}`).set('Authorization', auth(b)).expect(403);
    await http().delete(`/api/v1/cases/${caseId}/evidence/${removable}`).set('Authorization', auth(analyst)).expect(403);
    await http().delete(`/api/v1/cases/${caseId}/evidence/${removable}`).set('Authorization', auth(a)).expect(200);
    await view(removable).expect(403);
    await expect(readFile(path)).rejects.toMatchObject({ code: 'ENOENT' });
    const audit = (await connection.pool.query(
      "SELECT action FROM audit_events WHERE resource_type = 'evidence' AND action = 'EVIDENCE_REMOVED'",
    )).rows;
    expect(audit.length).toBeGreaterThan(0);
  });
  it('fails closed for missing, tampered or symlinked originals instead of serving mismatched bytes', async () => {
    const file = join(directory, `${evidenceId}.original`);
    await chmod(file, 0o600); await writeFile(file, Buffer.alloc(png.length)); await chmod(file, 0o400);
    await view().expect(503);
    await chmod(file, 0o600); await writeFile(file, png); await chmod(file, 0o400);
    const other = join(parent, 'synthetic-link-target'); await writeFile(other, png);
    await rm(file); await symlink(other, file); await view().expect(503);
    await rm(file); await view().expect(503); await writeFile(file, png, { mode: 0o400 });
  });
  it('cleans staging on database failure and records only metadata in successful audit events', async () => {
    const before = await readdir(directory);
    await connection.pool.query(`CREATE FUNCTION synthetic_reject_upload() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$`);
    await connection.pool.query('CREATE TRIGGER synthetic_reject BEFORE INSERT ON evidence_files FOR EACH ROW EXECUTE FUNCTION synthetic_reject_upload()');
    try { await upload(png).expect(503); } finally {
      await connection.pool.query('DROP TRIGGER synthetic_reject ON evidence_files');
      await connection.pool.query('DROP FUNCTION synthetic_reject_upload()');
    }
    expect((await readdir(directory)).sort()).toEqual(before.sort());
    const audit = (await connection.pool.query('SELECT * FROM audit_events')).rows;
    expect(audit.some((row) => row.action === 'CASE_CREATED')).toBe(true);
    expect(audit.some((row) => row.action === 'EVIDENCE_UPLOADED')).toBe(true);
    expect(audit.some((row) => row.action === 'EVIDENCE_READ')).toBe(true);
    expect(JSON.stringify(audit)).not.toContain('../../synthetic.png');
  });
});
