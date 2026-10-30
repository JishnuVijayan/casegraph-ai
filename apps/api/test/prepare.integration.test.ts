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
import { migrateDatabase } from '../src/db/migrate';
import { seedSynthetic } from '../src/db/seed';
import { EVIDENCE_DIRECTORY } from '../src/evidence/storage';
import { extractionRegions, extractionRuns } from '../src/db/schema';

describe('case prepare auto-reconstruction', () => {
  const database = `casegraph_prepare_test_${randomUUID().replaceAll('-', '')}`;
  let app: INestApplication;
  let admin: ReturnType<typeof connect>; let connection: ReturnType<typeof connect>;
  let parent: string; let directory: string; let created = false;
  let a: string; let caseId: string; let evidenceId: string;
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;

  beforeAll(async () => {
    parent = await mkdtemp(join(tmpdir(), 'casegraph-prepare-')); directory = join(parent, 'evidence');
    admin = connect(); await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database); await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DemoConfig).useValue({ enabled: true, ttlMs: 1800000 })
      .overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(EVIDENCE_DIRECTORY).useValue(directory).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    a = (await http().post('/api/v1/auth/demo').send({ demoSubject: 'synthetic-victim-a' }).expect(200)).body.data.token;
    caseId = (await http().post('/api/v1/cases').set('Authorization', auth(a))
      .send({ title: 'Lost money after fake UPI', category: 'payment', syntheticAcknowledged: true }).expect(201)).body.data.id;
    const syntheticImage = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240"><rect width="100%" height="100%" fill="white"/><text x="30" y="145" font-family="Arial" font-size="82">INR 2500</text></svg>')).png().toBuffer();
    evidenceId = (await http().post(`/api/v1/cases/${caseId}/evidence`).set('Authorization', auth(a))
      .attach('file', syntheticImage, { filename: 'synthetic.png', contentType: 'image/png' }).expect(201)).body.data.id;
    const [run] = await connection.db.insert(extractionRuns).values({ evidenceFileId: evidenceId,
      engine: 'synthetic-test-fixture', version: '1', status: 'SUCCEEDED',
      outputText: 'Paid INR 2500 UPI/ABCD1234EFGH on 2026-10-28T11:00:00Z' }).returning();
    await connection.db.insert(extractionRegions).values({ runId: run.id, kind: 'AMOUNT', text: 'INR 2500',
      textSpan: { start: 5, end: 13 }, boundingBox: { x: 0.1, y: 0.2, width: 0.45, height: 0.35 }, confidence: 99 });
  });
  afterAll(async () => {
    try {
      if (app) await app.close(); else if (connection) await connection.pool.end();
      if (created) await admin.pool.query(`DROP DATABASE "${database}"`);
    } finally { if (admin) await admin.pool.end(); if (parent) await rm(parent, { recursive: true, force: true }); }
  });

  it('promotes OCR amounts, scaffolds a payment timeline, and opens clarifications without manual claim POSTs', async () => {
    await http().post(`/api/v1/cases/${caseId}/prepare`).expect(401);
    const prepared = await http().post(`/api/v1/cases/${caseId}/prepare`).set('Authorization', auth(a)).expect(201);
    expect(prepared.body.data).toMatchObject({
      caseId, evidenceCount: 1,
    });
    expect(prepared.body.data.claimCount).toBeGreaterThanOrEqual(3);
    expect(prepared.body.data.openQuestions).toBe(0);

    const claims = (await http().get(`/api/v1/cases/${caseId}/claims`).set('Authorization', auth(a)).expect(200)).body.data;
    expect(claims.some((c: { type: string; sourceKind: string; rawValue: string }) =>
      c.type === 'payment_amount' && c.sourceKind === 'OBSERVED_IN_UPLOAD' && c.rawValue === 'INR 2500')).toBe(true);
    expect(claims.some((c: { type: string; sourceKind: string }) =>
      c.type === 'statement' && c.sourceKind === 'VICTIM_RECOLLECTION')).toBe(true);
    expect(claims.some((c: { type: string; sourceKind:string; rawValue: string }) =>
      c.type === 'payment_reference' && c.sourceKind === 'SYSTEM_INFERENCE' && /UPI\/ABCD1234EFGH/i.test(c.rawValue))).toBe(true);
    expect(claims.some((c: { type: string; sourceKind:string; rawValue: string }) =>
      c.type === 'incident_time' && c.rawValue.startsWith('2026-10-28'))).toBe(true);

    const inferred=claims.filter((c:{sourceKind:string})=>c.sourceKind==='SYSTEM_INFERENCE');
    expect(inferred.every((c:{sources:{evidenceId:string;textSpan:unknown}[]})=>c.sources.some((source)=>source.evidenceId===evidenceId&&source.textSpan))).toBe(true);
    await http().delete(`/api/v1/cases/${caseId}/evidence/${evidenceId}`).set('Authorization',auth(a)).expect(409);

    const timeline = (await http().get(`/api/v1/cases/${caseId}/timeline`).set('Authorization', auth(a)).expect(200)).body.data;
    expect(timeline).toHaveLength(1);
    expect(timeline[0].eventType).toBe('payment');
    expect(timeline[0].precision).toBe('UNKNOWN');
    expect(timeline[0].claims.length).toBeGreaterThanOrEqual(3);

    const questions = (await http().get(`/api/v1/cases/${caseId}/clarifications`).set('Authorization', auth(a)).expect(200)).body.data;
    expect(questions.some((q: { isCurrent: boolean; status: string }) =>
      q.isCurrent && q.status === 'OPEN')).toBe(false);

    // Idempotent prepare
    const again = await http().post(`/api/v1/cases/${caseId}/prepare`).set('Authorization', auth(a)).expect(201);
    expect(again.body.data.claimCount).toBe(prepared.body.data.claimCount);
    expect(again.body.data.openQuestions).toBe(0);
  });
});
