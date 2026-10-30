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
import { ExtractionService } from '../src/extraction/service';
import { tesseractTsv } from '../src/extraction/tesseract';

describe('local Tesseract extraction and source-region access', () => {
  const database = `casegraph_t05_test_${randomUUID().replaceAll('-', '')}`;
  let app: INestApplication;
  let admin: ReturnType<typeof connect>; let connection: ReturnType<typeof connect>;
  let parent: string; let directory: string; let created = false;
  let a: string; let b: string; let analyst: string; let caseId: string; let evidenceId: string;
  let receipt: Buffer; let blank: Buffer;
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const upload = (bytes: Buffer) => http().post(`/api/v1/cases/${caseId}/evidence`).set('Authorization', auth(a))
    .attach('file', bytes, { filename: 'synthetic.png', contentType: 'image/png' });
  const run = (id = evidenceId, token = a) => http().post(`/api/v1/cases/${caseId}/extractions`)
    .set('Authorization', auth(token)).send({ evidenceId: id });
  const read = (id = evidenceId, token = a) => http().get(`/api/v1/cases/${caseId}/extractions/${id}`).set('Authorization', auth(token));

  beforeAll(async () => {
    parent = await mkdtemp(join(tmpdir(), 'casegraph-t05-')); directory = join(parent, 'evidence');
    admin = connect(); await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database); await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DemoConfig).useValue({ enabled: true, ttlMs: 1800000 })
      .overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(EVIDENCE_DIRECTORY).useValue(directory).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    const login = async (demoSubject: string) => (await http().post('/api/v1/auth/demo').send({ demoSubject }).expect(200)).body.data.token;
    a = await login('synthetic-victim-a'); b = await login('synthetic-victim-b'); analyst = await login('synthetic-analyst');
    const draft = await http().post('/api/v1/cases').set('Authorization', auth(a)).send({ title: 'OCR source region', category: 'upi_payment_fraud' }).expect(201);
    caseId = draft.body.data.id;
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="360"><rect width="100%" height="100%" fill="white"/><text x="70" y="210" font-family="Arial,sans-serif" font-size="112" fill="black">Synthetic payment INR 2500</text></svg>');
    receipt = await sharp(svg).png().toBuffer();
    blank = await sharp({ create: { width: 640, height: 240, channels: 3, background: '#ffffff' } }).png().toBuffer();
  });
  afterAll(async () => {
    try {
      if (app) await app.close(); else if (connection) await connection.pool.end();
      if (created) await admin.pool.query(`DROP DATABASE "${database}"`);
    } finally { if (admin) await admin.pool.end(); if (parent) await rm(parent, { recursive: true, force: true }); }
  });

  it('recognizes only a source-linked synthetic amount, stores bounded spans and opens its original crop', async () => {
    evidenceId = (await upload(receipt).expect(201)).body.data.id;
    const first = await run().expect(201);
    expect(first.body.data.engine).toBe('tesseract');
    expect(first.body.data.version).toMatch(/^\d+\.\d+/);
    expect(first.body.data.status).toBe('SUCCEEDED');
    expect(first.body.data.amountStatus).toBe('OBSERVED_IN_UPLOAD');
    expect(first.body.data.verificationStatus).toBe('UNVERIFIED');
    expect(first.body.data.outputText).toMatch(/2500/);
    const amount = first.body.data.regions.find((region: { kind: string }) => region.kind === 'AMOUNT');
    expect(amount.text).toMatch(/2500/);
    expect(amount.textSpan.start).toBeGreaterThanOrEqual(0);
    expect(amount.textSpan.end).toBeGreaterThan(amount.textSpan.start);
    expect(amount.boundingBox.x).toBeGreaterThanOrEqual(0);
    expect(amount.boundingBox.y).toBeGreaterThanOrEqual(0);
    expect(amount.boundingBox.x + amount.boundingBox.width).toBeLessThanOrEqual(1);
    expect(amount.boundingBox.y + amount.boundingBox.height).toBeLessThanOrEqual(1);
    const second = await run().expect(201);
    expect(second.body.data.id).toBe(first.body.data.id);
    expect((await read().expect(200)).body.data.regions).toHaveLength(first.body.data.regions.length);
    const crop = await http().get(`/api/v1/cases/${caseId}/extractions/${evidenceId}/regions/${amount.id}/crop`).set('Authorization', auth(a)).expect(200);
    expect(crop.headers['content-type']).toContain('image/png');
    expect(crop.headers['x-content-type-options']).toBe('nosniff');
    const cropMetadata = await sharp(crop.body).metadata();
    expect(cropMetadata.width).toBeLessThanOrEqual(1600);
    expect(cropMetadata.height).toBeLessThanOrEqual(360);
    expect(await tesseractTsv('tesseract', crop.body)).toMatch(/2500/);
  });

  it('keeps unreadable evidence unknown without inventing an amount', async () => {
    const id = (await upload(blank).expect(201)).body.data.id;
    const result = (await run(id).expect(201)).body.data;
    expect(result.status).toBe('SUCCEEDED');
    expect(result.amountStatus).toBe('UNKNOWN');
    expect(result.regions.filter((region: { kind: string }) => region.kind === 'AMOUNT')).toHaveLength(0);
    expect(result.outputText).toBe('');
  });

  it('shows unavailable OCR with a safe code and retries with a later available engine version', async () => {
    const id = (await upload(receipt).expect(201)).body.data.id;
    const service = app.get(ExtractionService) as unknown as { binary: string };
    const available = service.binary; service.binary = '/no/such/tesseract';
    const failed = (await run(id).expect(201)).body.data;
    expect(failed.status).toBe('FAILED'); expect(failed.amountStatus).toBe('UNKNOWN');
    expect(failed.errorCode).toBe('OCR_UNAVAILABLE');
    service.binary = available;
    expect((await run(id).expect(201)).body.data.status).toBe('SUCCEEDED');
  });

  it('applies current case grants to extraction reads and source crops', async () => {
    const id = (await upload(receipt).expect(201)).body.data.id;
    const extraction = (await run(id).expect(201)).body.data;
    const amount = extraction.regions.find((region: { kind: string }) => region.kind === 'AMOUNT');
    await run(id, b).expect(403); await read(id, b).expect(403);
    await read(id, analyst).expect(200); // auto INVESTIGATE from createCase
    const active = (await connection.pool.query(
      'SELECT id FROM case_access_grants WHERE case_id = $1 AND revoked_at IS NULL', [caseId])).rows as { id: string }[];
    for (const grant of active) {
      await http().delete(`/api/v1/cases/${caseId}/shares/${grant.id}`).set('Authorization', auth(a)).expect(200);
    }
    await read(id, analyst).expect(403);
    await http().get(`/api/v1/cases/${caseId}/extractions/${id}/regions/${amount.id}/crop`).set('Authorization', auth(analyst)).expect(403);
  });
});
