import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
import { ApiRequest, envelope } from '../common/http';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { ClaimsService } from './service';

const types = ['payment_amount', 'payment_reference', 'incident_time', 'contact_identifier', 'statement'] as const;

export class CreateClaimDto {
  @IsIn(types) type!: typeof types[number];
  @IsIn(['OBSERVED_IN_UPLOAD', 'VICTIM_RECOLLECTION']) sourceKind!: 'OBSERVED_IN_UPLOAD' | 'VICTIM_RECOLLECTION';
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 500) rawValue?: string;
  @IsOptional() @IsUUID('4') evidenceId?: string;
  @IsOptional() @IsUUID('4') regionId?: string;
}

export class CorrectClaimDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 500) rawValue!: string;
  @IsOptional() @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 240) reason?: string;
}

@Controller('cases/:caseId/claims')
@Roles('victim', 'analyst')
@UseGuards(CaseScopeGuard)
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}
  @Get()
  async list(@Req() request: ApiRequest) { return envelope(request, await this.claims.list(request)); }
  @Post()
  @Roles('victim') @RequireCaseScope('OWNER')
  async create(@Body() dto: CreateClaimDto, @Req() request: ApiRequest) {
    return envelope(request, await this.claims.create(request, dto));
  }
  @Patch(':claimId')
  @Roles('victim') @RequireCaseScope('OWNER')
  async correct(@Param('claimId') claimId: string, @Body() dto: CorrectClaimDto, @Req() request: ApiRequest) {
    return envelope(request, await this.claims.correct(request, claimId, dto));
  }
}

const precisions = ['EXACT', 'APPROXIMATE', 'DATE_ONLY', 'UNKNOWN'] as const;
const eventTypes = ['payment', 'contact', 'account_action', 'other'] as const;
export class CreateTimelineEventDto {
  @IsIn(eventTypes) eventType!: typeof eventTypes[number];
  @IsIn(precisions) precision!: typeof precisions[number];
  @IsOptional() @IsString() @Length(10, 40) occurredAt?: string;
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(1, 240) uncertainty!: string;
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(20) @IsUUID('4', { each: true }) claimIds!: string[];
}

@Controller('cases/:caseId/timeline')
@Roles('victim', 'analyst')
@UseGuards(CaseScopeGuard)
export class TimelineController {
  constructor(private readonly claims: ClaimsService) {}
  @Get()
  async list(@Req() request: ApiRequest) { return envelope(request, await this.claims.timeline(request)); }
  @Post()
  @Roles('victim') @RequireCaseScope('OWNER')
  async create(@Body() dto: CreateTimelineEventDto, @Req() request: ApiRequest) {
    return envelope(request, await this.claims.createEvent(request, dto));
  }
}
