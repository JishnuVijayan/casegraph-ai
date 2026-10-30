import { InvestigationsController, GraphLeadsController } from './investigations/controller';
import { InvestigationsService } from './investigations/service';
import { GraphConfig, TigerGraphClient, GRAPH_FETCH, GRAPH_TOKEN_FILE } from './investigations/client';
import { ExportsController } from './exports/controller';
import { VoiceController } from './voice/controller';
import { ExportsService } from './exports/service';
import { ClarificationsController } from './clarifications/controller';
import { ClarificationsService } from './clarifications/service';
import { BEDROCK_CLIENT } from './clarifications/bedrock';
import { OfficerController } from './officer/controller';
import { OfficerService } from './officer/service';
import { BRIEF_READER } from './officer/brief-reader';
import { SimilarGraphService } from './investigations/similar-graph';
import { SIMILAR_CASES_PROVIDER } from './intake/similar';
import { Controller, Get, Module, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiRequest, envelope } from './common/http';
import { AuthController } from './auth/controller';
import { DemoConfig } from './auth/config';
import { CaseScopeGuard, Public, RolesGuard, SessionGuard } from './auth/guards';
import { Sessions } from './auth/sessions';
import { AccessStore, LOCAL_DATABASE } from './auth/store';
import { CasesController } from './cases/controller';
import { AnalysisService } from './intake/analysis';
import { BedrockAi, CONVERSE_CLIENT } from './intake/bedrock';
import { BriefService } from './intake/brief';
import { IntakeController } from './intake/controller';
import { QuestionsService } from './intake/questions';
import { FileReaderService } from './intake/reader';
import { IntakeService } from './intake/service';
import { resolve } from 'node:path';
import { EvidenceController } from './evidence/controller';
import { EvidenceService } from './evidence/service';
import { EVIDENCE_DIRECTORY, EvidenceStorage } from './evidence/storage';
import { connect } from './db/connection';
import { ExtractionController } from './extraction/controller';
import { ExtractionService } from './extraction/service';
import { TESSERACT_BINARY } from './extraction/tesseract';
import { TEXTRACT_CLIENT } from './extraction/textract';
import { ClaimsController, TimelineController } from './claims/controller';
import { ClaimsService } from './claims/service';

@Controller('health')
class HealthController {
  @Public()
  @Get('live')
  live(@Req() request: ApiRequest) { return envelope(request, { status: 'ok', scope: 'process-only', mode: 'local' }); }
}
@Module({
  exports: [AccessStore, CaseScopeGuard],
  controllers: [VoiceController, IntakeController, OfficerController, InvestigationsController, GraphLeadsController, ExportsController, ClarificationsController, HealthController, AuthController, CasesController, EvidenceController, ExtractionController, ClaimsController, TimelineController],
  providers: [OfficerService, SimilarGraphService, { provide: BRIEF_READER, inject: [BriefService], useFactory: (briefs: BriefService) => ({ briefFor: (id: string) => briefs.build(id) }) }, { provide: SIMILAR_CASES_PROVIDER, useExisting: SimilarGraphService }, InvestigationsService, GraphConfig, TigerGraphClient, {provide:GRAPH_FETCH,useValue:fetch}, {provide:GRAPH_TOKEN_FILE,useValue:resolve(__dirname,'../../../.local/tigergraph-app.token')}, ExportsService, ClarificationsService, BedrockAi, BriefService, QuestionsService, FileReaderService, AnalysisService, IntakeService, EvidenceService, EvidenceStorage, ExtractionService, ClaimsService, { provide: TESSERACT_BINARY, useFactory: () => process.env.TESSERACT_BINARY || 'tesseract' }, { provide: TEXTRACT_CLIENT, useValue: undefined }, { provide: BEDROCK_CLIENT, useValue: undefined }, { provide: CONVERSE_CLIENT, useValue: undefined }, { provide: EVIDENCE_DIRECTORY, useValue: resolve(__dirname, '../../../.local/evidence') }, DemoConfig, Sessions, AccessStore, CaseScopeGuard,
    { provide: LOCAL_DATABASE, inject: [DemoConfig], useFactory: (config: DemoConfig) => config.enabled ? connect('casegraph', config.database) : undefined },
    { provide: APP_GUARD, useClass: SessionGuard }, { provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
