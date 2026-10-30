import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
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
import { caseAnalyses, narratives, timelineEvents } from '../src/db/schema';

describe('victim complaint report', () => {
  const database = `casegraph_t08_test_${randomUUID().replaceAll('-', '')}`;
  let app: INestApplication;
  let admin: ReturnType<typeof connect>; let connection: ReturnType<typeof connect>;
  let parent: string; let created = false;
  let a: string; let b: string; let analyst: string; let caseId: string;
  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  const hostile = '<script>alert(1)</script><img src=x onerror=alert(2)>';

  beforeAll(async () => {
    parent = await mkdtemp(join(tmpdir(), 'casegraph-t08-'));
    admin = connect(); await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database); await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DemoConfig).useValue({ enabled: true, ttlMs: 1800000 })
      .overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(EVIDENCE_DIRECTORY).useValue(join(parent, 'evidence')).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    const login = async (demoSubject: string) => (await http().post('/api/v1/auth/demo').send({ demoSubject }).expect(200)).body.data.token;
    a = await login('synthetic-victim-a'); b = await login('synthetic-victim-b'); analyst = await login('synthetic-analyst');
    caseId = (await http().post('/api/v1/cases').set('Authorization', auth(a)).send({ title: hostile, category: 'upi_payment_fraud' }).expect(201)).body.data.id;
    await connection.db.insert(narratives).values({ caseId, text: `I was cheated ${hostile}`, channel: 'typed' });
    await connection.db.insert(caseAnalyses).values({ caseId, state: 'READY', summary: `Summary ${hostile}`, totalLoss: '2500.00', updatedAt: new Date() });
    await connection.db.insert(timelineEvents).values({ caseId, eventType: 'payment', precision: 'UNKNOWN', uncertainty: 'Date not stated', origin: 'AI',
      title: `Paid ${hostile}`, detail: 'Sent money', atLabel: 'Some day', sources: [{ type: 'STORY', label: 'What you told us' }] });
  });
  afterAll(async () => {
    try {
      if (app) await app.close(); else if (connection) await connection.pool.end();
      if (created) await admin.pool.query(`DROP DATABASE "${database}"`);
    } finally { if (admin) await admin.pool.end(); if (parent) await rm(parent, { recursive: true, force: true }); }
  });

  it('protects the report: owner only, never other victims or officers', async () => {
    const path = `/api/v1/cases/${caseId}/report.html`;
    await http().get(path).expect(401);
    await http().get(path).set('Authorization', auth(b)).expect(403);
    await http().get(path).set('Authorization', auth(analyst)).expect(403);
    await http().get(`/api/v1/cases/${randomUUID()}/report.html`).set('Authorization', auth(a)).expect(403);
    await http().get(`/api/v1/cases/${caseId}/exports`).set('Authorization', auth(a)).expect(404);
  });

  it('generates a fresh escaped report as an attachment with the helpline and no similar-case data', async () => {
    const res = await http().get(`/api/v1/cases/${caseId}/report.html`).set('Authorization', auth(a)).expect(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['content-disposition']).toMatch(/^attachment; filename="complaint-CG-\d{4}-\d{6}\.html"$/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.text).toContain('&lt;script&gt;');
    expect(res.text).not.toContain('<script>'); expect(res.text).not.toContain('<img ');
    expect(res.text).toContain('1930'); expect(res.text).toContain('cybercrime.gov.in');
    expect(res.text).toContain('₹2,500');
    expect(res.text).not.toMatch(/synthetic|similar|watermark/i);
    await connection.db.insert(narratives).values({ caseId, text: 'A newer detail', channel: 'typed' });
    const again = await http().get(`/api/v1/cases/${caseId}/report.html`).set('Authorization', auth(a)).expect(200);
    expect(again.text).toContain('A newer detail'); // generated fresh each time
  });
});
