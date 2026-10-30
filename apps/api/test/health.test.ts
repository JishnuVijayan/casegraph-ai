import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureHttp } from '../src/common/http';
import { DemoConfig } from '../src/auth/config';
describe('local API scaffold', () => {
 let app: INestApplication;
 beforeAll(async () => { const module = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(DemoConfig).useValue({ enabled: false, ttlMs: 1800000 }).compile(); app = module.createNestApplication(); configureHttp(app); await app.init(); });
 afterAll(async () => { await app.close(); });
 it('reports process liveness without claiming dependency readiness', async () => { const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200); expect(response.body.data).toEqual({ status: 'ok', scope: 'process-only', mode: 'local' }); expect(response.body.requestId).toEqual(expect.any(String)); });
 it('denies private routes when demo mode is disabled and keeps readiness unimplemented', async () => { await request(app.getHttpServer()).get('/api/v1/cases').expect(403); await request(app.getHttpServer()).get('/api/v1/health/ready').expect(404); });
});
