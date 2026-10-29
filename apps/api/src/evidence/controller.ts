import { Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { ApiRequest, envelope } from '../common/http';
import { EvidenceService } from './service';

@Controller('cases/:caseId/evidence')
@Roles('victim', 'analyst')
@UseGuards(CaseScopeGuard)
export class EvidenceController {
  constructor(private readonly evidence: EvidenceService) {}
  @Post()
  @Roles('victim') @RequireCaseScope('OWNER')
  async upload(@Req() request: ApiRequest) { return envelope(request, await this.evidence.upload(request)); }
  @Get()
  async list(@Req() request: ApiRequest) { return envelope(request, await this.evidence.list(request)); }
  @Get(':evidenceId/view')
  async original(@Param('evidenceId') id: string, @Req() request: ApiRequest, @Res({ passthrough: true }) response: Response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    return this.evidence.original(request, id);
  }
}
