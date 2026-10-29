import { InvestigationsController, GraphLeadsController } from './investigations/controller';
import { InvestigationsService } from './investigations/service';
import { GraphConfig, TigerGraphClient, GRAPH_FETCH, GRAPH_TOKEN_FILE } from './investigations/client';
import { ExportsController } from './exports/controller';
import { ExportsService } from './exports/service';
import { ClarificationsController } from './clarifications/controller';
import { ClarificationsService } from './clarifications/service';
import { Controller, Get, Module, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiRequest, envelope } from './common/http';
import { AuthController } from './auth/controller';
import { DemoConfig } from './auth/config';
import { CaseScopeGuard, Public, RolesGuard, SessionGuard } from './auth/guards';
import { Sessions } from './auth/sessions';
import { AccessStore, LOCAL_DATABASE } from './auth/store';
import { CasesController } from './cases/controller';
import { CasesService } from './cases/service';
import { resolve } from 'node:path';
import { EvidenceController } from './evidence/controller';
import { EvidenceService } from './evidence/service';
import { EVIDENCE_DIRECTORY, EvidenceStorage } from './evidence/storage';
import { connect } from './db/connection';
import { ExtractionController } from './extraction/controller';
import { ExtractionService } from './extraction/service';
import { TESSERACT_BINARY } from './extraction/tesseract';
import { ClaimsController, TimelineController } from './claims/controller';
import { ClaimsService } from './claims/service';

@Controller('health')
class HealthController {
  @Public()
  @Get('live')
  live(@Req() request: ApiRequest) { return envelope(request, { status: 'ok', scope: 'process-only', mode: 'local-synthetic' }); }
}
@Module({
  exports: [AccessStore, CaseScopeGuard],
  controllers: [InvestigationsController, GraphLeadsController, ExportsController, ClarificationsController, HealthController, AuthController, CasesController, EvidenceController, ExtractionController, ClaimsController, TimelineController],
  providers: [InvestigationsService, GraphConfig, TigerGraphClient, {provide:GRAPH_FETCH,useValue:fetch}, {provide:GRAPH_TOKEN_FILE,useValue:resolve(__dirname,'../../../.local/tigergraph-app.token')}, ExportsService, ClarificationsService, CasesService, EvidenceService, EvidenceStorage, ExtractionService, ClaimsService, { provide: TESSERACT_BINARY, useFactory: () => process.env.TESSERACT_BINARY || 'tesseract' }, { provide: EVIDENCE_DIRECTORY, useValue: resolve(__dirname, '../../../.local/evidence') }, DemoConfig, Sessions, AccessStore, CaseScopeGuard,
    { provide: LOCAL_DATABASE, inject: [DemoConfig], useFactory: (config: DemoConfig) => config.enabled ? connect('casegraph', config.database) : undefined },
    { provide: APP_GUARD, useClass: SessionGuard }, { provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
