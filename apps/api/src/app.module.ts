import { Controller, Get, Module, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ApiRequest, envelope } from './common/http';
import { AuthController } from './auth/controller';
import { DemoConfig } from './auth/config';
import { CaseScopeGuard, Public, RolesGuard, SessionGuard } from './auth/guards';
import { Sessions } from './auth/sessions';
import { AccessStore, LOCAL_DATABASE } from './auth/store';
import { CasesController } from './cases/controller';
import { resolve } from 'node:path';
import { EvidenceController } from './evidence/controller';
import { EvidenceService } from './evidence/service';
import { EVIDENCE_DIRECTORY, EvidenceStorage } from './evidence/storage';
import { connect } from './db/connection';
import { ExtractionController } from './extraction/controller';
import { ExtractionService } from './extraction/service';
import { TESSERACT_BINARY } from './extraction/tesseract';

@Controller('health')
class HealthController {
  @Public()
  @Get('live')
  live(@Req() request: ApiRequest) { return envelope(request, { status: 'ok', scope: 'process-only', mode: 'local-synthetic' }); }
}
@Module({
  exports: [AccessStore, CaseScopeGuard],
  controllers: [HealthController, AuthController, CasesController, EvidenceController, ExtractionController],
  providers: [EvidenceService, EvidenceStorage, ExtractionService, { provide: TESSERACT_BINARY, useFactory: () => process.env.TESSERACT_BINARY || 'tesseract' }, { provide: EVIDENCE_DIRECTORY, useValue: resolve(__dirname, '../../../.local/evidence') }, DemoConfig, Sessions, AccessStore, CaseScopeGuard,
    { provide: LOCAL_DATABASE, inject: [DemoConfig], useFactory: (config: DemoConfig) => config.enabled ? connect('casegraph', config.database) : undefined },
    { provide: APP_GUARD, useClass: SessionGuard }, { provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
