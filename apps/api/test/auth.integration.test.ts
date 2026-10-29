import 'reflect-metadata';
import { Controller, Get, INestApplication, Req, UseGuards } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { DemoConfig } from '../src/auth/config';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../src/auth/guards';
import { LOCAL_DATABASE } from '../src/auth/store';
import { ApiRequest, configureHttp, envelope } from '../src/common/http';
import { connect } from '../src/db/connection';
import { migrateDatabase } from '../src/db/migrate';
import { seedSynthetic } from '../src/db/seed';
import { loadFixtures } from '../src/db/fixtures';

// Test-only routes exercise default-deny and scope metadata without faking graph results.
@Controller('test')
class ProbeController {
  @Get('unguarded') undeclared() { return 'must not be reachable'; }
  @Get(':caseId/investigate')
  @Roles('analyst') @RequireCaseScope('INVESTIGATE') @UseGuards(CaseScopeGuard)
  investigate(@Req() req: ApiRequest) { return envelope(req, { authorized: true }); }
}

describe('PostgreSQL-backed HTTP authorization', () => {
  const database = `casegraph_t03_test_${randomUUID().replaceAll('-', '')}`;
  const fixture = loadFixtures();
  const caseA = fixture.cases[0].id!;
  const caseB = fixture.cases[1].id!;
  const caseExpired = fixture.cases[2].id!;
  const casePrivate = fixture.cases[3].id!;
  const config = { enabled: true, ttlMs: 1800000 };
  let app: INestApplication;
  let admin: ReturnType<typeof connect>;
  let connection: ReturnType<typeof connect>;
  let created = false;
  let a: string; let b: string; let analyst: string;
  let newGrant: string;

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => `Bearer ${token}`;
  async function login(demoSubject: string) {
    const res = await http().post('/api/v1/auth/demo').send({ demoSubject }).expect(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.token).toMatch(/^[a-f0-9]{64}$/);
    return res.body.data.token as string;
  }
  beforeAll(async () => {
    admin = connect();
    await admin.pool.query(`CREATE DATABASE "${database}"`); created = true;
    connection = connect(database);
    await migrateDatabase(connection.db); await seedSynthetic(connection.db);
    const module = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] })
      .overrideProvider(DemoConfig).useValue(config).overrideProvider(LOCAL_DATABASE).useValue(connection).compile();
    app = module.createNestApplication({ logger: false }); configureHttp(app); await app.init();
    a = await login('synthetic-victim-a'); b = await login('synthetic-victim-b'); analyst = await login('synthetic-analyst');
  });
  afterAll(async () => {
    try {
      if (app) await app.close(); else if (connection) await connection.pool.end();
      if (created) await admin.pool.query(`DROP DATABASE "${database}"`);
    } finally { if (admin) await admin.pool.end(); }
  });
  it('keeps urgent-independent health public and demo mode disabled by default', async () => {
    await http().get('/api/v1/health/live').expect(200);
    config.enabled = false;
    try {
      await http().post('/api/v1/auth/demo').send({ demoSubject: 'synthetic-victim-a' }).expect(403);
      await http().get('/api/v1/cases').set('Authorization', auth(a)).expect(403);
    } finally { config.enabled = true; }
  });
  it('rejects missing/forged sessions, undeclared routes, identity overrides and foreign origins', async () => {
    const denied = await http().get(`/api/v1/cases/${caseA}`).expect(401);
    expect(denied.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Demo sign-in required.' }, requestId: expect.any(String) });
    await http().get('/api/v1/cases').set('Authorization', auth('0'.repeat(64))).expect(401);
    await http().get('/api/v1/test/unguarded').set('Authorization', auth(a)).expect(403);
    await http().post('/api/v1/auth/demo').send({ demoSubject: 'synthetic-victim-a', role: 'analyst', userId: fixture.users[2].id }).expect(400);
    await http().post('/api/v1/auth/demo').send({ demoSubject: 'not-seeded' }).expect(400);
    await http().post('/api/v1/auth/demo').set('Origin', 'https://foreign.invalid').send({ demoSubject: 'synthetic-victim-a' }).expect(403);
  });
  it('allows each owner and scopes list/read from DB, ignoring claimed user headers', async () => {
    const own = await http().get(`/api/v1/cases/${caseA}`).set('Authorization', auth(a)).expect(200);
    expect(own.body.data.synthetic).toBe(true);
    await http().get(`/api/v1/cases/${caseB}`).set('Authorization', auth(b)).expect(200);
    const denied = await http().get(`/api/v1/cases/${caseA}`).set('Authorization', auth(b)).set('X-User-ID', fixture.users[0].id!).expect(403);
    const absent = await http().get(`/api/v1/cases/${randomUUID()}`).set('Authorization', auth(b)).expect(403);
    expect(denied.body.error).toEqual(absent.body.error);
    await http().get('/api/v1/cases/not-a-uuid').set('Authorization', auth(a)).expect(403);
    expect((await http().get('/api/v1/cases').set('Authorization', auth(a)).expect(200)).body.data).toHaveLength(10);
    expect((await http().get('/api/v1/cases').set('Authorization', auth(analyst)).expect(200)).body.data.map((row: { id: string }) => row.id)).toEqual([caseA]);
  });
  it('requires active explicit grants; absent, revoked and expired grants deny analysts', async () => {
    await http().get(`/api/v1/cases/${caseA}`).set('Authorization', auth(analyst)).expect(200);
    for (const id of [caseB, caseExpired, casePrivate]) await http().get(`/api/v1/cases/${id}`).set('Authorization', auth(analyst)).expect(403);
    await http().post(`/api/v1/cases/${caseA}/shares`).set('Authorization', auth(analyst)).send({ organizationId: fixture.organization.id, scope: 'READ' }).expect(403);
    await http().post(`/api/v1/cases/${caseA}/shares`).set('Authorization', auth(b)).send({ organizationId: fixture.organization.id, scope: 'READ' }).expect(403);
  });
  it('lets owners grant READ while the investigation scope and victim role remain denied', async () => {
    const res = await http().post(`/api/v1/cases/${casePrivate}/shares`).set('Authorization', auth(b))
      .send({ organizationId: fixture.organization.id, scope: 'READ' }).expect(201);
    newGrant = res.body.data.id;
    await http().get(`/api/v1/cases/${casePrivate}`).set('Authorization', auth(analyst)).expect(200);
    await http().get(`/api/v1/test/${casePrivate}/investigate`).set('Authorization', auth(analyst)).expect(403);
    await http().get(`/api/v1/test/${caseA}/investigate`).set('Authorization', auth(analyst)).expect(200);
    await http().get(`/api/v1/test/${caseA}/investigate`).set('Authorization', auth(a)).expect(403);
    await http().post(`/api/v1/cases/${caseA}/shares`).set('Authorization', auth(a)).send({ organizationId: randomUUID(), scope: 'READ' }).expect(400);
  });
  it('revocation or expiration denies the very next read and list without renewing a session', async () => {
    await http().delete(`/api/v1/cases/${casePrivate}/shares/${newGrant}`).set('Authorization', auth(a)).expect(403);
    await http().delete(`/api/v1/cases/${casePrivate}/shares/${newGrant}`).set('Authorization', auth(b)).expect(200);
    await http().get(`/api/v1/cases/${casePrivate}`).set('Authorization', auth(analyst)).expect(403);
    await connection.pool.query("UPDATE case_access_grants SET expires_at = now() - interval '1 second' WHERE case_id = $1", [caseA]);
    await http().get(`/api/v1/cases/${caseA}`).set('Authorization', auth(analyst)).expect(403);
    expect((await http().get('/api/v1/cases').set('Authorization', auth(analyst)).expect(200)).body.data).toEqual([]);
    await connection.pool.query('UPDATE case_access_grants SET expires_at = NULL WHERE case_id = $1', [caseA]);
  });
  it('rechecks current role, organization and synthetic identity instead of caching authority', async () => {
    const org = randomUUID();
    await connection.pool.query("INSERT INTO organizations (id,name,kind) VALUES ($1,'Fictional other org','SYNTHETIC')", [org]);
    await connection.pool.query('UPDATE users SET organization_id=$1 WHERE id=$2', [org, fixture.users[2].id]);
    await http().get(`/api/v1/cases/${caseA}`).set('Authorization', auth(analyst)).expect(401);
    await connection.pool.query('UPDATE users SET organization_id=$1 WHERE id=$2', [fixture.organization.id, fixture.users[2].id]);
    analyst = await login('synthetic-analyst');
    await connection.pool.query("UPDATE users SET role='admin' WHERE id=$1", [fixture.users[2].id]);
    await http().get('/api/v1/auth/me').set('Authorization', auth(analyst)).expect(401);
    await connection.pool.query("UPDATE users SET role='analyst' WHERE id=$1", [fixture.users[2].id]);
    analyst = await login('synthetic-analyst');
    await connection.pool.query('UPDATE users SET synthetic=false WHERE id=$1', [fixture.users[2].id]);
    await http().get('/api/v1/auth/me').set('Authorization', auth(analyst)).expect(401);
    await connection.pool.query('UPDATE users SET synthetic=true WHERE id=$1', [fixture.users[2].id]);
    analyst = await login('synthetic-analyst');
  });
  it('expires sessions on the server and invalidates logout tokens', async () => {
    await http().post('/api/v1/auth/logout').set('Authorization', auth(b)).expect(200);
    await http().get('/api/v1/auth/me').set('Authorization', auth(b)).expect(401);
    b = await login('synthetic-victim-b');
    const clock = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + config.ttlMs + 1);
    try { await http().get('/api/v1/auth/me').set('Authorization', auth(b)).expect(401); }
    finally { clock.mockRestore(); }
    a = await login('synthetic-victim-a');
  });
  it('accepts name+mobile intake, upserts a synthetic victim, and reuses the same subject', async () => {
    const first = await http().post('/api/v1/auth/intake')
      .send({ displayName: 'Priya Demo', mobile: '9876543210' }).expect(200);
    expect(first.body.data.user.role).toBe('victim');
    expect(first.body.data.user.displayName).toBe('Priya Demo');
    expect(first.body.data.token).toMatch(/^[a-f0-9]{64}$/);
    await http().post('/api/v1/auth/intake').send({ displayName: 'P', mobile: '123' }).expect(400);
    const second = await http().post('/api/v1/auth/intake')
      .send({ displayName: 'Priya Updated', mobile: '9876543210' }).expect(200);
    expect(second.body.data.user.id).toBe(first.body.data.user.id);
    expect(second.body.data.user.displayName).toBe('Priya Updated');
    const me = await http().get('/api/v1/auth/me').set('Authorization', auth(second.body.data.token)).expect(200);
    expect(me.body.data.displayName).toBe('Priya Updated');
  });
  it('auto-grants INVESTIGATE to the demo consortium when a victim creates a case', async () => {
    a = await login('synthetic-victim-a');
    analyst = await login('synthetic-analyst');
    const created = await http().post('/api/v1/cases').set('Authorization', auth(a))
      .send({ title: 'auto-share inbox case', category: 'payment', syntheticAcknowledged: true }).expect(201);
    const id = created.body.data.id as string;
    const listed = (await http().get('/api/v1/cases').set('Authorization', auth(analyst)).expect(200)).body.data as { id: string }[];
    expect(listed.map((row) => row.id)).toContain(id);
    await http().get(`/api/v1/cases/${id}`).set('Authorization', auth(analyst)).expect(200);
    await http().get(`/api/v1/test/${id}/investigate`).set('Authorization', auth(analyst)).expect(200);
    const audits = (await connection.pool.query(
      "SELECT action FROM audit_events WHERE resource_type = 'grant' AND action = 'CASE_AUTO_SHARED'",
    )).rows;
    expect(audits.length).toBeGreaterThan(0);
  });
  it('writes only redacted audit metadata and returns a structured unavailable state', async () => {
    const audits = (await connection.pool.query('SELECT * FROM audit_events')).rows;
    expect(audits.some((row) => row.action === 'CASE_READ')).toBe(true);
    expect(audits.some((row) => row.action === 'SHARE_GRANTED')).toBe(true);
    expect(audits.some((row) => row.action === 'CASE_AUTO_SHARED')).toBe(true);
    expect(audits.some((row) => row.action === 'SHARE_REVOKED')).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(a);
    expect(Object.keys(audits[0]).sort()).toEqual(['action','actor_id','created_at','id','request_id','resource_id','resource_type']);
    const failure = jest.spyOn(connection.pool, 'query').mockRejectedValueOnce(new Error('synthetic-private-error-detail') as never);
    try {
      const res = await http().get('/api/v1/auth/me').set('Authorization', auth(a)).expect(503);
      expect(res.body.error.code).toBe('UNAVAILABLE');
      expect(JSON.stringify(res.body)).not.toContain('synthetic-private-error-detail');
    } finally { failure.mockRestore(); }
  });
});
