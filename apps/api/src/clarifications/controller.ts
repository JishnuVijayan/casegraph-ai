import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { ApiRequest, envelope } from '../common/http';
import { ClarificationsService } from './service';
export class AnswerDto {
  @IsIn(['ANSWERED', 'UNKNOWN']) status!: 'ANSWERED' | 'UNKNOWN';
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 500) text?: string;
}
@Controller('cases/:caseId/clarifications')
@Roles('victim', 'analyst')
@UseGuards(CaseScopeGuard)
export class ClarificationsController {
  constructor(private readonly service: ClarificationsService) {}
  @Get() async list(@Req() req: ApiRequest) { return envelope(req, await this.service.list(req)); }
  @Post('refresh') @Roles('victim') @RequireCaseScope('OWNER')
  async refresh(@Req() req: ApiRequest) { return envelope(req, await this.service.refresh(req)); }
  @Post(':questionId/answer') @Roles('victim') @RequireCaseScope('OWNER')
  async answer(@Req() req: ApiRequest, @Param('questionId') id: string, @Body() dto: AnswerDto) {
    return envelope(req, await this.service.answer(req, id, dto));
  }
}
