import { Body, Controller, Get, Header, Param, Post, Query, Req } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { ApiRequest, envelope } from '../common/http';
import { OfficerService } from './service';

export class ReviewSimilarDto { @IsIn(['USEFUL', 'NOT_RELATED']) status!: 'USEFUL' | 'NOT_RELATED'; }

@Controller('officer/cases')
@Roles('analyst')
export class OfficerController {
  constructor(private readonly service: OfficerService) {}
  @Get() async list(@Req() req: ApiRequest, @Query('q') q?: string, @Query('category') category?: string, @Query('sort') sort?: string) {
    return envelope(req, await this.service.list(req, { q, category, sort }));
  }
  @Get(':caseId') @RequireCaseScope('READ') @UseGuards(CaseScopeGuard)
  async detail(@Req() req: ApiRequest) { return envelope(req, await this.service.detail(req)); }

  @Get(':caseId/similar/:otherId') @RequireCaseScope('READ') @UseGuards(CaseScopeGuard)
  async pair(@Req() req: ApiRequest, @Param('otherId') otherId: string) { return envelope(req, await this.service.pair(req, otherId)); }

  @Post(':caseId/similar/:otherId/review') @RequireCaseScope('READ') @UseGuards(CaseScopeGuard)
  async review(@Req() req: ApiRequest, @Param('otherId') otherId: string, @Body() dto: ReviewSimilarDto) {
    return envelope(req, await this.service.review(req, otherId, dto.status));
  }

  @Get(':caseId/dossier.html') @RequireCaseScope('READ') @UseGuards(CaseScopeGuard)
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'")
  async dossier(@Req() req: ApiRequest) { return this.service.dossier(req); }
}
