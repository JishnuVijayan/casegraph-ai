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

describe('deterministic clarification workflow', () => {
  const database = `casegraph_t07_test_${randomUUID().replaceAll('-', '')}`;
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
    parent = await mkdtemp(join(tmpdir(), 'casegraph-t07-')); directory = join(parent, 'evidence');
    admin = connect(); await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database); await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DemoConfig).useValue({ enabled: true, ttlMs: 1800000 })
      .overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(EVIDENCE_DIRECTORY).useValue(directory).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    const login = async (demoSubject: string) => (await http().post('/api/v1/auth/demo').send(demoSubject === 'synthetic-analyst' ? { demoSubject, password: 'HHGOAOFFICER' } : { demoSubject }).expect(200)).body.data.token;
    a = await login('synthetic-victim-a'); b = await login('synthetic-victim-b'); analyst = await login('synthetic-analyst');
    const makeCase = async (title: string) => (await http().post('/api/v1/cases').set('Authorization', auth(a))
      .send({ title, category: 'upi_payment_fraud' }).expect(201)).body.data.id as string;
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

  let amountId: string;
  let questionId: string;
  const questionPath = () => `/api/v1/cases/${caseId}/clarifications`;
  it('generates source snapshots, focused conflicts and repeatable question IDs', async () => {
    const makeClaim = async (type: string, rawValue: string) => (await http().post(claimsPath()).set('Authorization', auth(a))
      .send({ type, rawValue, sourceKind: 'VICTIM_RECOLLECTION' }).expect(201)).body.data.id;
    amountId = (await http().post(claimsPath()).set('Authorization', auth(a)).send({ type: 'payment_amount',
      sourceKind: 'OBSERVED_IN_UPLOAD', evidenceId, regionId }).expect(201)).body.data.id;
    const ids = [amountId, await makeClaim('payment_amount', 'INR 2600'),
      await makeClaim('incident_time', '2026-10-29T12:00:00+05:30'), await makeClaim('incident_time', '2026-10-29T07:00:00Z')];
    await http().post(timelinePath()).set('Authorization', auth(a)).send({ eventType: 'payment', precision: 'UNKNOWN',
      uncertainty: 'Synthetic payment under review', claimIds: ids }).expect(201);
    const first = (await http().post(`${questionPath()}/refresh`).set('Authorization', auth(a)).send({}).expect(201)).body.data;
    expect(first.map((q: {kind: string}) => q.kind)).toEqual(['AMOUNT_CONFLICT', 'TIME_CONFLICT', 'MISSING_REFERENCE']);
    expect(first[0].context.claims).toEqual(expect.arrayContaining([expect.objectContaining({id: amountId, rawValue: 'INR 2500', sourceKind: 'OBSERVED_IN_UPLOAD'})]));
    questionId = first[0].id;
    const repeated = (await http().post(`${questionPath()}/refresh`).set('Authorization', auth(a)).send({}).expect(201)).body.data;
    expect(repeated.map((q: {id: string}) => q.id)).toEqual(first.map((q: {id: string}) => q.id));
  });
  it('records UNKNOWN once without rewriting claims and rejects stale question answers', async () => {
    const answerPath = `${questionPath()}/${questionId}/answer`;
    await http().post(answerPath).set('Authorization', auth(a)).send({status:'ANSWERED'}).expect(400);
    await http().post(answerPath).set('Authorization', auth(a)).send({status:'UNKNOWN',text:'contradictory'}).expect(400);
    const answered = (await http().post(answerPath).set('Authorization', auth(a)).send({status:'UNKNOWN'}).expect(201)).body.data;
    expect(answered).toMatchObject({status:'UNKNOWN', answer:{text:null,sourceKind:'VICTIM_RECOLLECTION',verificationStatus:'UNVERIFIED'}});
    await http().post(answerPath).set('Authorization', auth(a)).send({status:'ANSWERED',text:'overwrite'}).expect(409);
    const rows = (await http().get(questionPath()).set('Authorization', auth(a)).expect(200)).body.data;
    const stale = rows.find((q: {kind:string}) => q.kind === 'TIME_CONFLICT');
    await http().patch(`${claimsPath()}/${amountId}`).set('Authorization', auth(a)).send({rawValue:'INR 2700'}).expect(200);
    await http().post(`${questionPath()}/${stale.id}/answer`).set('Authorization', auth(a)).send({status:'UNKNOWN'}).expect(409);
    const changed = (await http().post(`${questionPath()}/refresh`).set('Authorization', auth(a)).send({}).expect(201)).body.data;
    expect(changed.find((q: {id:string}) => q.id === questionId)).toMatchObject({status:'UNKNOWN',isCurrent:false});
    const next = changed.find((q: {status:string,isCurrent:boolean}) => q.status === 'OPEN' && q.isCurrent);
    await http().post(`${questionPath()}/${next.id}/answer`).set('Authorization', auth(a)).send({status:'ANSWERED',text:'Synthetic recollection only'}).expect(201);
    const claims = (await http().get(claimsPath()).set('Authorization', auth(a)).expect(200)).body.data;
    expect(claims.find((c: {id:string}) => c.id === amountId)).toMatchObject({rawValue:'INR 2700',verificationStatus:'UNVERIFIED', sources:[expect.objectContaining({observedText:'INR 2500'})]});
  });
  it('scopes reads, generation and answers, including immediate grant revocation', async () => {
    await http().get(questionPath()).expect(401);
    await http().get(questionPath()).set('Authorization', auth(b)).expect(403);
    await http().post(`${questionPath()}/refresh`).set('Authorization', auth(b)).send({}).expect(403);
    await http().post(`/api/v1/cases/${otherCaseId}/clarifications/${questionId}/answer`).set('Authorization', auth(a)).send({status:'UNKNOWN'}).expect(403);
    await http().get(questionPath()).set('Authorization', auth(analyst)).expect(200); // auto INVESTIGATE from create
    await http().post(`${questionPath()}/refresh`).set('Authorization', auth(analyst)).send({}).expect(403);
    await http().post(`${questionPath()}/${questionId}/answer`).set('Authorization', auth(analyst)).send({status:'UNKNOWN'}).expect(403);
    const active = (await connection.pool.query(
      'SELECT id FROM case_access_grants WHERE case_id = $1 AND revoked_at IS NULL', [caseId])).rows as { id: string }[];
    for (const grant of active) {
      await http().delete(`/api/v1/cases/${caseId}/shares/${grant.id}`).set('Authorization', auth(a)).expect(200);
    }
    await http().get(questionPath()).set('Authorization', auth(analyst)).expect(403);
  });
});
