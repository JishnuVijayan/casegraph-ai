import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
describe('local API scaffold', () => {
 let app: INestApplication;
 beforeAll(async () => { const module = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = module.createNestApplication(); app.setGlobalPrefix('api/v1'); await app.init(); });
 afterAll(async () => { await app.close(); });
 it('reports process liveness without claiming dependency readiness', async () => { const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200); expect(response.body.data).toEqual({ status: 'ok', scope: 'process-only', mode: 'local-synthetic' }); expect(response.body.requestId).toEqual(expect.any(String)); });
 it('does not expose unimplemented case or readiness endpoints', async () => { await request(app.getHttpServer()).get('/api/v1/cases').expect(404); await request(app.getHttpServer()).get('/api/v1/health/ready').expect(404); });
});
