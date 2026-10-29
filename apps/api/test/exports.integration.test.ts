import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import sharp from 'sharp';
import { createHash, randomUUID } from 'node:crypto';
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

describe('versioned draft exports', () => {
  const database = `casegraph_t08_test_${randomUUID().replaceAll('-', '')}`;
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
    parent = await mkdtemp(join(tmpdir(), 'casegraph-t08-')); directory = join(parent, 'evidence');
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

  let exportId: string; let firstHtml: string; let claimId: string;
  const path = (id=caseId) => `/api/v1/cases/${id}/exports`;
  it('exports a corrected observed value with its original, unknowns, manifest and escaped hostile text', async()=>{
    claimId=(await http().post(claimsPath()).set('Authorization',auth(a)).send({type:'payment_amount',sourceKind:'OBSERVED_IN_UPLOAD',evidenceId,regionId}).expect(201)).body.data.id;
    await http().patch(`${claimsPath()}/${claimId}`).set('Authorization',auth(a)).send({rawValue:'INR 2600',reason:'Synthetic review'}).expect(200);
    const statement=(await http().post(claimsPath()).set('Authorization',auth(a)).send({type:'statement',sourceKind:'VICTIM_RECOLLECTION',rawValue:'<script>fetch("https://malicious.invalid")</script>'}).expect(201)).body.data.id;
    await http().post(timelinePath()).set('Authorization',auth(a)).send({eventType:'payment',precision:'DATE_ONLY',occurredAt:'2026-10-29',uncertainty:'Synthetic date; time unknown',claimIds:[claimId,statement]}).expect(201);
    await http().post(timelinePath()).set('Authorization',auth(a)).send({eventType:'other',precision:'UNKNOWN',uncertainty:'Time not recalled',claimIds:[statement]}).expect(201);
    const qp=`/api/v1/cases/${caseId}/clarifications`;
    const question=(await http().post(`${qp}/refresh`).set('Authorization',auth(a)).send({}).expect(201)).body.data[0];
    await http().post(`${qp}/${question.id}/answer`).set('Authorization',auth(a)).send({status:'UNKNOWN'}).expect(201);
    await http().post(path()).set('Authorization',auth(a)).send({}).expect(400);
    const row=(await http().post(path()).set('Authorization',auth(a)).send({draftAcknowledged:true}).expect(201)).body.data;
    exportId=row.id;expect(row.version).toBe(1);expect(row.objectKey).toBeUndefined();
    const download=await http().get(`${path()}/${exportId}/download`).set('Authorization',auth(a)).expect(200);
    firstHtml=download.text;
    expect(download.headers['content-disposition']).toContain('attachment');expect(download.headers['cache-control']).toBe('no-store');
    expect(download.headers['content-security-policy']).toContain('sandbox');
    for(const value of ['DRAFT','INR 2600','INR 2500','Correction history',evidenceId,regionId,claimId,'DATE_ONLY','UNKNOWN','VICTIM_RECOLLECTION','UNVERIFIED','SHA-256','1930']) expect(firstHtml).toContain(value);
    expect(firstHtml).toContain('&lt;script&gt;');expect(firstHtml).not.toContain('<script>');
    const hash=(await connection.pool.query('SELECT sha256 FROM evidence_files WHERE id=$1',[evidenceId])).rows[0].sha256;
    expect(firstHtml).toContain(hash);expect(createHash('sha256').update(firstHtml).digest('hex')).toBe(row.sha256);
    expect(firstHtml).not.toContain('.original');
  });
  it('retains frozen versions across corrections and serializes concurrent version creation',async()=>{
    await http().patch(`${claimsPath()}/${claimId}`).set('Authorization',auth(a)).send({rawValue:'INR 2700'}).expect(200);
    const results=await Promise.all([1,2].map(()=>http().post(path()).set('Authorization',auth(a)).send({draftAcknowledged:true}).expect(201)));
    expect(results.map((r)=>r.body.data.version).sort()).toEqual([2,3]);
    expect((await http().get(`${path()}/${exportId}/download`).set('Authorization',auth(a)).expect(200)).text).toBe(firstHtml);
    const newer=await http().get(`${path()}/${results[0].body.data.id}/download`).set('Authorization',auth(a)).expect(200);
    expect(newer.text).toContain('INR 2700');expect(firstHtml).not.toContain('INR 2700');
    expect((await http().get(path()).set('Authorization',auth(a)).expect(200)).body.data.map((r:{version:number})=>r.version)).toEqual([3,2,1]);
  });
  it('protects generation/list/download including substituted IDs and revoked analysts',async()=>{
    await http().post(path()).send({draftAcknowledged:true}).expect(401);
    for(const token of [b,analyst]){
      await http().get(path()).set('Authorization',auth(token)).expect(403);
      await http().post(path()).set('Authorization',auth(token)).send({draftAcknowledged:true}).expect(403);
      await http().get(`${path()}/${exportId}/download`).set('Authorization',auth(token)).expect(403);
    }
    await http().get(`${path(otherCaseId)}/${exportId}/download`).set('Authorization',auth(a)).expect(403);
    const grant=(await http().post(`/api/v1/cases/${caseId}/shares`).set('Authorization',auth(a)).send({organizationId:fixture.organization.id,scope:'READ'}).expect(201)).body.data;
    await http().post(path()).set('Authorization',auth(analyst)).send({draftAcknowledged:true}).expect(201);
    await http().get(path()).set('Authorization',auth(analyst)).expect(200);
    await http().get(`${path()}/${exportId}/download`).set('Authorization',auth(analyst)).expect(200);
    await http().delete(`/api/v1/cases/${caseId}/shares/${grant.id}`).set('Authorization',auth(a)).expect(200);
    await http().get(path()).set('Authorization',auth(analyst)).expect(403);
    await http().get(`${path()}/${exportId}/download`).set('Authorization',auth(analyst)).expect(403);
    await http().post(path()).set('Authorization',auth(analyst)).send({draftAcknowledged:true}).expect(403);
  });
  it('rejects oversized case sections without committing a partial draft',async()=>{
    await connection.pool.query("INSERT INTO claims (case_id,type,raw_value,source_kind) SELECT $1,'statement','Synthetic bounded claim','VICTIM_RECOLLECTION' FROM generate_series(1,1001)",[otherCaseId]);
    await http().post(path(otherCaseId)).set('Authorization',auth(a)).send({draftAcknowledged:true}).expect(413);
    expect((await http().get(path(otherCaseId)).set('Authorization',auth(a)).expect(200)).body.data).toEqual([]);
  });
  it('fails closed for corrupt snapshot bytes',async()=>{
    await connection.pool.query("UPDATE exports SET content_html='synthetic tampering' WHERE id=$1",[exportId]);
    await http().get(`${path()}/${exportId}/download`).set('Authorization',auth(a)).expect(503);
  });
});
