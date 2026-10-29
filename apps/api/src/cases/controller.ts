import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Equals, IsIn, IsISO8601, IsOptional, IsUUID, IsString, Length } from 'class-validator';
import { ApiRequest, envelope } from '../common/http';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { Transform } from 'class-transformer';
import { AccessStore } from '../auth/store';

export class CreateCase {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 120) title!: string;
  @IsIn(['investment', 'friendship', 'payment', 'other']) category!: string;
  @Equals(true) syntheticAcknowledged!: boolean;
}
export class ShareCase {
  @IsUUID('4') organizationId!: string;
  @IsIn(['READ', 'INVESTIGATE']) scope!: 'READ' | 'INVESTIGATE';
  @IsOptional() @IsISO8601({ strict: true }) expiresAt?: string;
}
@Controller('cases')
@Roles('victim', 'analyst')
export class CasesController {
  constructor(private readonly store: AccessStore) {}

  @Post()
  @Roles('victim')
  async create(@Body() dto: CreateCase, @Req() request: ApiRequest) {
    return envelope(request, await this.store.createCase(request.actor!, dto.title, dto.category, request.requestId));
  }
  @Get()
  async list(@Req() request: ApiRequest) {
    const rows = await this.store.list(request.actor!);
    await this.store.audit(request.actor!, 'CASES_LISTED', 'user', request.actor!.id, request.requestId);
    return envelope(request, rows);
  }
  @Get(':caseId')
  @UseGuards(CaseScopeGuard)
  async read(@Req() request: ApiRequest) {
    const row = request.caseRecord!;
    await this.store.audit(request.actor!, 'CASE_READ', 'case', row.id, request.requestId);
    const { id, title, category, status, synthetic, createdAt, updatedAt } = row;
    return envelope(request, { id, title, category, status, synthetic, createdAt, updatedAt });
  }
  @Post(':caseId/shares')
  @Roles('victim')
  @RequireCaseScope('OWNER')
  @UseGuards(CaseScopeGuard)
  async share(@Body() dto: ShareCase, @Req() request: ApiRequest) {
    return envelope(request, await this.store.grant(request.actor!, request.caseRecord!.id, dto.scope, dto.organizationId, dto.expiresAt, request.requestId));
  }
  @Delete(':caseId/shares/:grantId')
  @Roles('victim')
  @RequireCaseScope('OWNER')
  @UseGuards(CaseScopeGuard)
  async revoke(@Param('grantId') grantId: string, @Req() request: ApiRequest) {
    return envelope(request, await this.store.revoke(request.actor!, request.caseRecord!.id, grantId, request.requestId));
  }
}
