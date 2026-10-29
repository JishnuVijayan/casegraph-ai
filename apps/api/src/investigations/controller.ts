import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Equals, IsIn } from 'class-validator';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { ApiRequest, envelope } from '../common/http';
import { InvestigationsService } from './service';
export class QueryDto {@Equals(4) maxHops!:number;}
export class ReviewLeadDto {@IsIn(['REVIEWED','NOT_RELEVANT']) status!:'REVIEWED'|'NOT_RELEVANT';}
@Controller('investigations/:caseId/graph-leads')
@Roles('analyst') @RequireCaseScope('INVESTIGATE') @UseGuards(CaseScopeGuard)
export class InvestigationsController {
  constructor(private readonly service:InvestigationsService){}
  @Post() async query(@Body() _dto:QueryDto,@Req() req:ApiRequest){return envelope(req,await this.service.query(req));}
  @Get() async list(@Req() req:ApiRequest){return envelope(req,await this.service.list(req));}
}
@Controller('graph-leads') @Roles('analyst')
export class GraphLeadsController {
  constructor(private readonly service:InvestigationsService){}
  @Get(':leadId/sources/:sourceId') async source(@Req() req:ApiRequest,@Param('leadId') leadId:string,@Param('sourceId') sourceId:string){return envelope(req,await this.service.source(req,leadId,sourceId));}
  @Patch(':leadId/review') async review(@Req() req:ApiRequest,@Param('leadId') leadId:string,@Body() dto:ReviewLeadDto){return envelope(req,await this.service.review(req,leadId,dto.status));}
}
