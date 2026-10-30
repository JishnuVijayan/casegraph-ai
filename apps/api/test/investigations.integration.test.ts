import 'reflect-metadata';
import { BadGatewayException, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { DemoConfig } from '../src/auth/config';
import { LOCAL_DATABASE } from '../src/auth/store';
import { configureHttp } from '../src/common/http';
import { connect } from '../src/db/connection';
import { migrateDatabase } from '../src/db/migrate';
import { seedSynthetic } from '../src/db/seed';
import { loadFixtures } from '../src/db/fixtures';

import { TigerGraphClient, GraphConfig } from '../src/investigations/client';
import { caseA,caseB,syntheticPath,syntheticSources } from './graph-fixture';

describe('analyst investigation authorization with explicitly mocked TigerGraph transport',()=>{
  const database=`casegraph_t11_test_${randomUUID().replaceAll('-','')}`;
  const fixture=loadFixtures();let app:INestApplication;let admin:ReturnType<typeof connect>;let connection:ReturnType<typeof connect>;let created=false;
  let a:string;let b:string;let analyst:string;let grantB:string;let leadId:string;
  const graph={execute:jest.fn()};
  const http=()=>request(app.getHttpServer());const auth=(token:string)=>`Bearer ${token}`;
  const path=(id=caseA)=>`/api/v1/investigations/${id}/graph-leads`;
  const grant=async(scope:string)=>(await http().post(`/api/v1/cases/${caseB}/shares`).set('Authorization',auth(b)).send({organizationId:fixture.organization.id,scope}).expect(201)).body.data.id;
  const valid=()=>graph.execute.mockImplementation(async(name:string)=>name==='find_case_links'?{classification:'SYNTHETIC_INVESTIGATIVE_LEAD',paths:[structuredClone(syntheticPath)]}:{classification:'SYNTHETIC_FIXTURE_SOURCES',sources:structuredClone(syntheticSources)});
  beforeAll(async()=>{
    admin=connect();await admin.pool.query(`CREATE DATABASE "${database}"`);created=true;connection=connect(database);await migrateDatabase(connection.db);await seedSynthetic(connection.db);
    const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(DemoConfig).useValue({enabled:true,ttlMs:1800000}).overrideProvider(LOCAL_DATABASE).useValue(connection).overrideProvider(TigerGraphClient).useValue(graph).compile();
    app=module.createNestApplication({logger:false});configureHttp(app);await app.init();
    const login=async(subject:string)=>(await http().post('/api/v1/auth/demo').send({demoSubject:subject}).expect(200)).body.data.token;
    a=await login('synthetic-victim-a');b=await login('synthetic-victim-b');analyst=await login('synthetic-analyst');
  });
  afterAll(async()=>{try{if(app)await app.close();else if(connection)await connection.pool.end();if(created)await admin.pool.query(`DROP DATABASE "${database}"`);}finally{if(admin)await admin.pool.end();}});
  it('denies victims, missing/READ-only/expired grants and injected scope before querying; disabled graph returns unavailable',async()=>{
    valid();graph.execute.mockClear();
    await http().post(path()).send({maxHops:4}).expect(401);
    await http().post(path()).set('Authorization',auth(a)).send({maxHops:4}).expect(403);
    await http().post(path(caseB)).set('Authorization',auth(analyst)).send({maxHops:4}).expect(403);
    await grant('READ');await http().post(path(caseB)).set('Authorization',auth(analyst)).send({maxHops:4}).expect(403);
    await http().post(path(fixture.cases[2].id!)).set('Authorization',auth(analyst)).send({maxHops:4}).expect(403);
    await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4,allowed_case_ids:[caseA,caseB]}).expect(400);
    await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:10}).expect(400);
    expect(graph.execute).not.toHaveBeenCalled();
    const disabled=new TigerGraphClient({enabled:false,port:14240} as GraphConfig,fetch,'/not-used');
    graph.execute.mockImplementation((...args:Parameters<TigerGraphClient['execute']>)=>disabled.execute(...args));
    const unavailable=await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(503);
    expect(unavailable.body.data).toBeUndefined();
  });
  it('reports upstream credential failure separately without leaking details or invalidating the analyst session',async()=>{
    graph.execute.mockRejectedValueOnce(new BadGatewayException('private upstream secret'));
    const response=await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(502);
    expect(response.body.error.code).toBe('GRAPH_AUTHENTICATION_FAILED');
    expect(JSON.stringify(response.body)).not.toContain('private upstream secret');
    await http().get(path()).set('Authorization',auth(analyst)).expect(200);
  });
  it('derives scope, persists source-validated NEEDS_REVIEW snapshots and authorizes drilldown/review',async()=>{
    grantB=await grant('INVESTIGATE');valid();graph.execute.mockClear();
    const response=await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(201);
    const lead=response.body.data.leads[0];leadId=lead.id;
    expect(lead).toMatchObject({reviewStatus:'NEEDS_REVIEW',origin:'TIGERGRAPH_QUERY_SNAPSHOT',path:syntheticPath});
    const allowed=graph.execute.mock.calls[0][1].allowed_case_ids as string[];
    expect(allowed).toContain(caseA);
    expect(allowed).toContain(caseB);
    expect(allowed.length).toBeLessThanOrEqual(21);
    const source=await http().get(`/api/v1/graph-leads/${leadId}/sources/${encodeURIComponent(syntheticPath.source_report_ref)}`).set('Authorization',auth(analyst)).expect(200);
    expect(source.body.data.source).toEqual(syntheticSources[0]);
    await http().get(`/api/v1/graph-leads/${leadId}/sources/fx:unknown`).set('Authorization',auth(analyst)).expect(403);
    await http().get(`/api/v1/graph-leads/${leadId}/sources/${encodeURIComponent(syntheticPath.source_report_ref)}`).set('Authorization',auth(a)).expect(403);
    await http().patch(`/api/v1/graph-leads/${leadId}/review`).set('Authorization',auth(analyst)).send({status:'EXTERNALLY_VERIFIED'}).expect(400);
    await http().patch(`/api/v1/graph-leads/${leadId}/review`).set('Authorization',auth(analyst)).send({status:'REVIEWED'}).expect(200);
    expect((await http().get(path()).set('Authorization',auth(analyst)).expect(200)).body.data[0].reviewStatus).toBe('REVIEWED');
  });
  it('rejects out-of-scope graph results, missing/cross-case sources and malformed labels without exposing payload',async()=>{
    valid();graph.execute.mockImplementationOnce(async()=>({classification:'SYNTHETIC_INVESTIGATIVE_LEAD',paths:[{...syntheticPath,target_case_id:fixture.cases[2].id}]}));
    await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(403);
    graph.execute.mockImplementation(async(name:string)=>name==='find_case_links'?{classification:'SYNTHETIC_INVESTIGATIVE_LEAD',paths:[syntheticPath]}:{classification:'SYNTHETIC_FIXTURE_SOURCES',sources:syntheticSources.slice(1)});
    await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(503);
    graph.execute.mockImplementation(async()=>({classification:'verified criminals',paths:[syntheticPath]}));
    const response=await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(503);
    expect(JSON.stringify(response.body)).not.toContain('verified criminals');
    expect((await http().get(path()).set('Authorization',auth(analyst)).expect(200)).body.data).toHaveLength(1);
  });
  it('rechecks a target grant revoked while the query runs and hides saved paths/sources/reviews',async()=>{
    valid();graph.execute.mockImplementationOnce(async()=>{
      await connection.pool.query('UPDATE case_access_grants SET revoked_at=now() WHERE id=$1',[grantB]);
      return {classification:'SYNTHETIC_INVESTIGATIVE_LEAD',paths:[syntheticPath]};
    });
    await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(403);
    expect((await http().get(path()).set('Authorization',auth(analyst)).expect(200)).body.data).toEqual([]);
    await http().get(`/api/v1/graph-leads/${leadId}/sources/${encodeURIComponent(syntheticPath.source_report_ref)}`).set('Authorization',auth(analyst)).expect(403);
    await http().patch(`/api/v1/graph-leads/${leadId}/review`).set('Authorization',auth(analyst)).send({status:'NOT_RELEVANT'}).expect(403);
  });
  it('returns a truthful empty live-query result and expired scope keeps saved leads hidden',async()=>{
    grantB=await grant('INVESTIGATE');graph.execute.mockResolvedValue({classification:'SYNTHETIC_INVESTIGATIVE_LEAD',paths:[]});
    const response=await http().post(path()).set('Authorization',auth(analyst)).send({maxHops:4}).expect(201);
    expect(response.body.data).toEqual({status:'QUERY_EXECUTED',leads:[]});
    await connection.pool.query("UPDATE case_access_grants SET expires_at='2020-01-01T00:00:00Z' WHERE id=$1",[grantB]);
    expect((await http().get(path()).set('Authorization',auth(analyst)).expect(200)).body.data).toEqual([]);
    const audit=(await connection.pool.query("SELECT action FROM audit_events WHERE resource_id=$1",[leadId])).rows;
    expect(audit).toEqual(expect.arrayContaining([{action:'GRAPH_LEAD_REVIEWED'}]));
  });
});
