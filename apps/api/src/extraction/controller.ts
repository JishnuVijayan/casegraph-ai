import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { IsUUID } from 'class-validator';
import { CaseScopeGuard, Roles } from '../auth/guards';
import { ApiRequest, envelope } from '../common/http';
import { ExtractionService } from './service';

class RunExtractionDto { @IsUUID() evidenceId!: string; }

@Controller('cases/:caseId/extractions')
@Roles('victim', 'analyst')
@UseGuards(CaseScopeGuard)
export class ExtractionController {
  constructor(private readonly extraction: ExtractionService) {}
  @Post()
  async run(@Body() body: RunExtractionDto, @Req() request: ApiRequest) {
    return envelope(request, await this.extraction.run(request, body.evidenceId));
  }
  @Get(':evidenceId')
  async get(@Param('evidenceId') evidenceId: string, @Req() request: ApiRequest) {
    return envelope(request, await this.extraction.get(request, evidenceId));
  }
  @Get(':evidenceId/regions/:regionId/crop')
  async crop(@Param('evidenceId') evidenceId: string, @Param('regionId') regionId: string,
    @Req() request: ApiRequest, @Res({ passthrough: true }) response: Response) {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    return this.extraction.crop(request, evidenceId, regionId);
  }
}
