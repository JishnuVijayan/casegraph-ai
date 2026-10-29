import { Body, Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Equals } from 'class-validator';
import { Response } from 'express';
import { CaseScopeGuard, Roles } from '../auth/guards';
import { ApiRequest, envelope } from '../common/http';
import { ExportsService } from './service';
export class CreateExportDto { @Equals(true) draftAcknowledged!: boolean; }
@Controller('cases/:caseId/exports')
@Roles('victim', 'analyst')
@UseGuards(CaseScopeGuard)
export class ExportsController {
  constructor(private readonly service: ExportsService) {}
  @Post() async create(@Body() _dto: CreateExportDto, @Req() req: ApiRequest) { return envelope(req, await this.service.create(req)); }
  @Get() async list(@Req() req: ApiRequest) { return envelope(req, await this.service.list(req)); }
  @Get(':exportId/download')
  async download(@Req() req: ApiRequest, @Param('exportId') id: string, @Res({passthrough:true}) res: Response) {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'");
    return this.service.download(req, id);
  }
}
