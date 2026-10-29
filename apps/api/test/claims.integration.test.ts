import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { DemoConfig } from '../src/auth/config';
import { LOCAL_DATABASE } from '../src/auth/store';
import { configureHttp } from '../src/common/http';
import { connect } from '../src/db/connection';
import { loadFixtures } from '../src/db/fixtures';
import { migrateDatabase } from '../src/db/migrate';
import { seedSynthetic } from '../src/db/seed';
import { EVIDENCE_DIRECTORY } from '../src/evidence/storage';
import { extractionRegions, extractionRuns } from '../src/db/schema';

describe('source-linked claims, revisions and case timeline', () => {
  const database = `casegraph_t06_test_${randomUUID().replaceAll('-', '')}`;
  const fixture = loadFixtures();
  let app: INestApplication;
  let admin: ReturnType<typeof connect>; let connection: ReturnType<typeof connect>;
  let parent: string; let directory: string; let created = false;
  let a: string; let b: string; let analyst: string;
  let caseId: string; let otherCaseId: string; let evidenceId: string; let regionId: string;
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const claimsPath = (id = caseId) => `/api/v1/cases/${id}/claims`;
  const timelinePath = (id = caseId) => `/api/v1/cases/${id}/timeline`;

  beforeAll(async () => {
    parent = await mkdtemp(join(tmpdir(), 'casegraph-t06-')); directory = join(parent, 'evidence');
    admin = connect(); await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database); await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DemoConfig).useValue({ enabled: true, ttlMs: 1800000 })
      .overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(EVIDENCE_DIRECTORY).useValue(directory).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    const login = async (demoSubject: string) => (await http().post('/api/v1/auth/demo').send({ demoSubject }).expect(200)).body.data.token;
    a = await login('synthetic-victim-a'); b = await login('synthetic-victim-b'); analyst = await login('synthetic-analyst');
    const makeCase = async (title: string) => (await http().post('/api/v1/cases').set('Authorization', auth(a))
      .send({ title, category: 'payment', syntheticAcknowledged: true }).expect(201)).body.data.id as string;
    caseId = await makeCase('T06 source-linked review'); otherCaseId = await makeCase('T06 separate synthetic case');
    const syntheticImage = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240"><rect width="100%" height="100%" fill="white"/><text x="30" y="145" font-family="Arial" font-size="82">INR 2500</text></svg>')).png().toBuffer();
    evidenceId = (await http().post(`/api/v1/cases/${caseId}/evidence`).set('Authorization', auth(a))
      .attach('file', syntheticImage, { filename: 'synthetic.png', contentType: 'image/png' }).expect(201)).body.data.id;
    const [run] = await connection.db.insert(extractionRuns).values({ evidenceFileId: evidenceId,
      engine: 'synthetic-test-fixture', version: '1', status: 'SUCCEEDED', outputText: 'INR 2500' }).returning();
    const [region] = await connection.db.insert(extractionRegions).values({ runId: run.id, kind: 'AMOUNT', text: 'INR 2500',
      textSpan: { start: 0, end: 8 }, boundingBox: { x: 0.1, y: 0.2, width: 0.45, height: 0.35 }, confidence: 99 }).returning();
    regionId = region.id;
  });
  afterAll(async () => {
    try {
      if (app) await app.close(); else if (connection) await connection.pool.end();
      if (created) await admin.pool.query(`DROP DATABASE "${database}"`);
    } finally { if (admin) await admin.pool.end(); if (parent) await rm(parent, { recursive: true, force: true }); }
  });

  it('promotes OCR directly from a stored amount region and is idempotent', async () => {
    const body = { type: 'payment_amount', sourceKind: 'OBSERVED_IN_UPLOAD', evidenceId, regionId };
    const first = await http().post(claimsPath()).set('Authorization', auth(a)).send(body).expect(201);
    expect(first.body.data.rawValue).toBe('INR 2500');
    expect(first.body.data.normalizedValue).toEqual({ currency: 'INR', amountMinorUnits: '250000' });
    expect(first.body.data.sourceKind).toBe('OBSERVED_IN_UPLOAD');
    expect(first.body.data.verificationStatus).toBe('UNVERIFIED');
    expect(first.body.data.sources).toEqual([expect.objectContaining({ evidenceId, regionId, observedText: 'INR 2500',
      textSpan: { start: 0, end: 8 }, boundingBox: { x: 0.1, y: 0.2, width: 0.45, height: 0.35 } })]);
    const again = await http().post(claimsPath()).set('Authorization', auth(a)).send(body).expect(201);
    expect(again.body.data.id).toBe(first.body.data.id);
    await http().post(claimsPath()).set('Authorization', auth(a)).send({ ...body, rawValue: 'INR 99000' }).expect(400);
    await http().post(claimsPath()).set('Authorization', auth(a)).send({ ...body, evidenceId: randomUUID() }).expect(403);
  });

  it('records recollections and appends corrections without changing original provenance or verification', async () => {
    const claimId = (await http().post(claimsPath()).set('Authorization', auth(a)).send({ type: 'payment_amount',
      sourceKind: 'OBSERVED_IN_UPLOAD', evidenceId, regionId }).expect(201)).body.data.id;
    const recollection = await http().post(claimsPath()).set('Authorization', auth(a)).send({ type: 'payment_reference',
      sourceKind: 'VICTIM_RECOLLECTION', rawValue: ' synthetic-reference-42 ' }).expect(201);
    expect(recollection.body.data.rawValue).toBe('synthetic-reference-42');
    expect(recollection.body.data.sourceKind).toBe('VICTIM_RECOLLECTION');
    expect(recollection.body.data.verificationStatus).toBe('UNVERIFIED');
    expect(recollection.body.data.sources).toEqual([]);
    expect(recollection.body.data.normalizedValue).toBeNull();
    const revised = await http().patch(`${claimsPath()}/${claimId}`).set('Authorization', auth(a))
      .send({ rawValue: 'INR 2600', reason: 'Synthetic correction example' }).expect(200);
    expect(revised.body.data.rawValue).toBe('INR 2600');
    expect(revised.body.data.normalizedValue).toEqual({ currency: 'INR', amountMinorUnits: '260000' });
    expect(revised.body.data.sourceKind).toBe('OBSERVED_IN_UPLOAD');
    expect(revised.body.data.verificationStatus).toBe('UNVERIFIED');
    expect(revised.body.data.sources[0]).toMatchObject({ evidenceId, regionId, observedText: 'INR 2500' });
    expect(revised.body.data.revisions).toHaveLength(1);
    expect(revised.body.data.revisions[0]).toMatchObject({
      before: { rawValue: 'INR 2500', normalizedValue: { currency: 'INR', amountMinorUnits: '250000' } },
      after: { rawValue: 'INR 2600', normalizedValue: { currency: 'INR', amountMinorUnits: '260000' } },
      reason: 'Synthetic correction example',
    });
    await http().patch(`${claimsPath()}/${claimId}`).set('Authorization', auth(a)).send({ rawValue: 'INR 2600' }).expect(400);
  });

  it('orders timeline events and preserves exact, date-only and unknown time uncertainty', async () => {
    const amountId = (await http().post(claimsPath()).set('Authorization', auth(a)).send({ type: 'payment_amount',
      sourceKind: 'OBSERVED_IN_UPLOAD', evidenceId, regionId }).expect(201)).body.data.id;
    const referenceId = (await http().post(claimsPath()).set('Authorization', auth(a)).send({ type: 'payment_reference',
      sourceKind: 'VICTIM_RECOLLECTION', rawValue: 'synthetic-reference-77' }).expect(201)).body.data.id;
    const otherClaimId = (await http().post(claimsPath(otherCaseId)).set('Authorization', auth(a)).send({ type: 'statement',
      sourceKind: 'VICTIM_RECOLLECTION', rawValue: 'another case only' }).expect(201)).body.data.id;
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'payment', precision: 'DATE_ONLY',
      occurredAt: '2026-10-28', uncertainty: 'Date is shown by the synthetic receipt; not externally verified.', claimIds: [amountId] }).expect(201);
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'contact', precision: 'APPROXIMATE',
      occurredAt: '2026-10-29T12:30:00+05:30', uncertainty: 'Time is an approximate synthetic recollection.', claimIds: [referenceId] }).expect(201);
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'other', precision: 'UNKNOWN',
      uncertainty: 'The event date is unknown.', claimIds: [amountId, referenceId] }).expect(201);
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'payment', precision: 'UNKNOWN',
      occurredAt: '2026-10-29T00:00:00Z', uncertainty: 'Invalid timestamp for unknown precision.', claimIds: [amountId] }).expect(400);
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'payment', precision: 'EXACT',
      occurredAt: '2026-10-29T12:30:00', uncertainty: 'Missing timezone.', claimIds: [amountId] }).expect(400);
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'payment', precision: 'DATE_ONLY',
      occurredAt: '2026-10-29T12:00:00Z', uncertainty: 'Not date-only.', claimIds: [amountId] }).expect(400);
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'payment', precision: 'UNKNOWN',
      uncertainty: 'Cross-case claim cannot support this event.', claimIds: [otherClaimId] }).expect(400);
    const rows = (await http().get(timelinePath()).set('Authorization', auth(a)).expect(200)).body.data;
    expect(rows.map((row: { precision: string }) => row.precision)).toEqual(['DATE_ONLY', 'APPROXIMATE', 'UNKNOWN']);
    expect(rows[0].occurredAt).toBe('2026-10-28T00:00:00.000Z');
    expect(rows[0].claims[0]).toMatchObject({ claimId: amountId, evidenceId, regionId, observedText: 'INR 2500' });
    expect(rows[1].occurredAt).toBe('2026-10-29T07:00:00.000Z');
    expect(rows[2]).toMatchObject({ occurredAt: null, uncertainty: 'The event date is unknown.' });
  });

  it('keeps claim and timeline reads within current grants and denies analyst writes', async () => {
    await http().post(claimsPath()).set('Authorization', auth(a)).send({ type: 'payment_amount',
      sourceKind: 'OBSERVED_IN_UPLOAD', evidenceId, regionId }).expect(201);
    await http().get(claimsPath()).set('Authorization', auth(b)).expect(403);
    await http().get(timelinePath()).set('Authorization', auth(b)).expect(403);
    const share = await http().post(`/api/v1/cases/${caseId}/shares`).set('Authorization', auth(a))
      .send({ organizationId: fixture.organization.id, scope: 'READ' }).expect(201);
    await http().get(claimsPath()).set('Authorization', auth(analyst)).expect(200);
    await http().get(timelinePath()).set('Authorization', auth(analyst)).expect(200);
    await http().post(claimsPath()).set('Authorization', auth(analyst)).send({ type: 'statement',
      sourceKind: 'VICTIM_RECOLLECTION', rawValue: 'cannot write as analyst' }).expect(403);
    await http().delete(`/api/v1/cases/${caseId}/shares/${share.body.data.id}`).set('Authorization', auth(a)).expect(200);
    await http().get(claimsPath()).set('Authorization', auth(analyst)).expect(403);
    await http().get(timelinePath()).set('Authorization', auth(analyst)).expect(403);
  });
});
