import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { DemoConfig } from '../src/auth/config';
import { AccessStore, LOCAL_DATABASE } from '../src/auth/store';
import { configureHttp } from '../src/common/http';
import { connect } from '../src/db/connection';
import { migrateDatabase } from '../src/db/migrate';
import { seedSynthetic } from '../src/db/seed';
import { seedIds } from '../src/db/seed-v2';
import { TigerGraphClient } from '../src/investigations/client';
import { organizations } from '../src/db/schema';

describe('officer inbox, similar cases and access (mocked case-network transport)', () => {
  const database = `casegraph_officer_test_${randomUUID().replaceAll('-', '')}`;
  let app: INestApplication, admin: ReturnType<typeof connect>, connection: ReturnType<typeof connect>, created = false;
  let victim: string, analyst: string;
  const first = seedIds(0).case, second = seedIds(1).case, third = seedIds(2).case, standalone = seedIds(31).case;
  const graph = { enabled: true, queryV2: jest.fn(), upsertV2: jest.fn(), clearMentionsV2: jest.fn() };
  const http = () => request(app.getHttpServer());
  const row = (caseId: string, shared: string[], strong: number, weak = 0) => ({ v_id: caseId, v_type: 'Complaint',
    attributes: { case_id: caseId, category: 'job_or_task_scam', '@strong': strong, '@weak': weak, '@category_match': 1, '@shared': shared } });
  beforeAll(async () => {
    admin = connect(); await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database); await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DemoConfig).useValue({ enabled: true, ttlMs: 1800000 })
      .overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(TigerGraphClient).useValue(graph).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    const login = async (subject: string) => (await http().post('/api/v1/auth/demo').send({ demoSubject: subject, ...(subject === 'synthetic-analyst' ? { password: 'HHGOAOFFICER' } : {}) }).expect(200)).body.data.token;
    victim = await login('synthetic-victim-a'); analyst = await login('synthetic-analyst');
  });
  afterAll(async () => { try { if (app) await app.close(); else if (connection) await connection.pool.end(); if (created) await admin.pool.query(`DROP DATABASE "${database}"`); } finally { if (admin) await admin.pool.end(); } });
  beforeEach(() => {
    graph.queryV2.mockReset().mockResolvedValue([{ similar: [row(second, ['phone|9000011111', 'upi|taskhr.desk@okfictbank', 'app_name|telegram'], 2, 1), row(third, ['upi|taskhr.desk@okfictbank'], 1)] }]);
  });

  it('denies unauthenticated and victim callers', async () => {
    await http().get('/api/v1/officer/cases').expect(401);
    await http().get('/api/v1/officer/cases').set('Authorization', `Bearer ${victim}`).expect(403);
    await http().get(`/api/v1/officer/cases/${first}`).set('Authorization', `Bearer ${victim}`).expect(403);
    await http().get(`/api/v1/officer/cases/${first}/dossier.html`).set('Authorization', `Bearer ${victim}`).expect(403);
    await http().post(`/api/v1/officer/cases/${first}/similar/${second}/review`).set('Authorization', `Bearer ${victim}`).send({ status: 'USEFUL' }).expect(403);
  });

  it('denies an analyst from another organization', async () => {
    const [other] = await connection.db.insert(organizations).values({ name: 'Other fictional org', kind: 'SYNTHETIC', synthetic: true }).returning();
    const store = app.get(AccessStore);
    const stranger = { id: randomUUID(), role: 'analyst' as const, organizationId: other.id, displayName: 'Other analyst' };
    await expect(store.findCase(stranger, first, 'READ')).rejects.toBeDefined();
    expect(await store.list(stranger)).toEqual([]);
  });

  it('lists submitted complaints with masked mobiles, filters and sorts', async () => {
    const res = await http().get('/api/v1/officer/cases').set('Authorization', `Bearer ${analyst}`).expect(200);
    const list = res.body.data as { id: string; victimMobileMasked: string; reference: string; category: string; loss: { amount: number } | null }[];
    expect(list.length).toBeGreaterThanOrEqual(40);
    const mine = list.find((c) => c.id === first)!;
    expect(mine.victimMobileMasked).toBe('90****0001');
    expect(JSON.stringify(list)).not.toContain('9000100001');
    expect(list.every((c) => c.id !== undefined && /^CG-\d{4}-\d{6}$/.test(c.reference))).toBe(true);
    const inv = (await http().get('/api/v1/officer/cases?category=investment_scam&sort=loss').set('Authorization', `Bearer ${analyst}`).expect(200)).body.data as typeof list;
    expect(inv.length).toBeGreaterThan(3); expect(inv.every((c) => c.category === 'investment_scam')).toBe(true);
    expect(inv.map((c) => c.loss?.amount ?? 0)).toEqual([...inv.map((c) => c.loss?.amount ?? 0)].sort((a, b) => b - a));
    const found = (await http().get('/api/v1/officer/cases?q=anita').set('Authorization', `Bearer ${analyst}`).expect(200)).body.data as typeof list;
    expect(found.map((c) => c.id)).toContain(first);
    const byMobile = (await http().get('/api/v1/officer/cases?q=9000100002').set('Authorization', `Bearer ${analyst}`).expect(200)).body.data as typeof list;
    expect(byMobile.map((c) => c.id)).toEqual([second]);
  });

  it('opens a case file with the full mobile and similar cases from the case network', async () => {
    const res = await http().get(`/api/v1/officer/cases/${first}`).set('Authorization', `Bearer ${analyst}`).expect(200);
    const { brief, victim: v, similar } = res.body.data;
    expect(brief.status).toBe('SUBMITTED'); expect(brief.reference).toBe('CG-2026-900001');
    expect(v).toEqual({ name: 'Anita Thomas', mobile: '9000100001' });
    expect(similar.status).toBe('READY');
    expect(similar.cases.map((c: { caseId: string }) => c.caseId)).toEqual([second, third]);
    expect(similar.cases[0].shared[0]).toMatchObject({ kind: 'phone', strength: 'STRONG' });
    expect(similar.cases[0].score).toBeGreaterThan(similar.cases[1].score);
    expect(graph.queryV2).toHaveBeenCalledWith('similar_cases', { case_id: first, max_results: 10 }, expect.anything());
  });

  it('says UNAVAILABLE and invents nothing when the case network is down; drafts stay hidden', async () => {
    graph.queryV2.mockRejectedValue(new Error('down'));
    const res = await http().get(`/api/v1/officer/cases/${first}`).set('Authorization', `Bearer ${analyst}`).expect(200);
    expect(res.body.data.similar).toMatchObject({ status: 'UNAVAILABLE', cases: [] });
    await http().get('/api/v1/officer/cases/30000000-0000-4000-8000-000000000001').set('Authorization', `Bearer ${analyst}`).expect(403); // draft fixture case
  });

  it('shows the shared details of a pair, records a review and renders the dossier', async () => {
    const pair = await http().get(`/api/v1/officer/cases/${first}/similar/${second}`).set('Authorization', `Bearer ${analyst}`).expect(200);
    expect(pair.body.data.brief.caseId).toBe(second);
    expect(pair.body.data.shared.map((s: { kind: string }) => s.kind)).toEqual(expect.arrayContaining(['phone', 'upi']));
    await http().get(`/api/v1/officer/cases/${first}/similar/${standalone}`).set('Authorization', `Bearer ${analyst}`).expect(200)
      .then((r) => expect(r.body.data.shared).toEqual([]));
    await http().post(`/api/v1/officer/cases/${first}/similar/${second}/review`).set('Authorization', `Bearer ${analyst}`).send({ status: 'MAYBE' }).expect(400);
    await http().post(`/api/v1/officer/cases/${first}/similar/${second}/review`).set('Authorization', `Bearer ${analyst}`).send({ status: 'USEFUL' }).expect(201);
    await http().post(`/api/v1/officer/cases/${first}/similar/${second}/review`).set('Authorization', `Bearer ${analyst}`).send({ status: 'NOT_RELATED' }).expect(201);
    const detail = await http().get(`/api/v1/officer/cases/${first}`).set('Authorization', `Bearer ${analyst}`).expect(200);
    expect(detail.body.data.similar.reviews[second]).toBe('NOT_RELATED');
    const html = await http().get(`/api/v1/officer/cases/${first}/dossier.html`).set('Authorization', `Bearer ${analyst}`).expect(200);
    expect(html.headers['content-type']).toMatch(/text\/html/); expect(html.text).toContain('CG-2026-900001');
  });
});
