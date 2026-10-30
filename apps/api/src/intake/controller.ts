import { Body, Controller, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { ApiRequest, envelope } from '../common/http';
import { AnalysisService } from './analysis';
import { IntakeService } from './service';
import { QuestionsService } from './questions';
import { CATEGORY_IDS } from './types';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class NarrativeDto {
  @Transform(trim) @IsString() @Length(1, 20000) text!: string;
  @IsIn(['typed', 'voice']) channel!: 'typed' | 'voice';
}
export class AnswerQuestionDto { @Transform(trim) @IsString() @Length(1, 2000) answer!: string; }
export class PatchCaseDto {
  @IsOptional() @IsIn(CATEGORY_IDS) category?: string;
  @IsOptional() @Transform(trim) @IsString() @Length(1, 120) title?: string;
}

@Controller('cases/:caseId')
@Roles('victim')
@RequireCaseScope('OWNER')
@UseGuards(CaseScopeGuard)
export class IntakeController {
  constructor(private readonly intake: IntakeService, private readonly analysis: AnalysisService, private readonly questions: QuestionsService) {}

  @Post('narrative')
  async narrative(@Body() dto: NarrativeDto, @Req() req: ApiRequest) { return envelope(req, await this.intake.addNarrative(req, dto.text, dto.channel)); }

  @Post('analyze') @HttpCode(200)
  async analyze(@Req() req: ApiRequest) { return envelope(req, await this.analysis.analyze(req)); }

  /** Owner and officers with access (READ scope) can read the brief. */
  @Get('brief')
  @Roles('victim', 'analyst') @RequireCaseScope('READ')
  async brief(@Req() req: ApiRequest) { return envelope(req, await this.intake.brief(req)); }

  @Post('questions/:questionId/answer') @HttpCode(200)
  async answer(@Param('questionId') questionId: string, @Body() dto: AnswerQuestionDto, @Req() req: ApiRequest) {
    return envelope(req, await this.questions.answer(req, questionId, dto.answer));
  }

  @Patch()
  async patch(@Body() dto: PatchCaseDto, @Req() req: ApiRequest) { return envelope(req, await this.intake.patch(req, dto)); }

  @Post('submit') @HttpCode(200)
  async submit(@Req() req: ApiRequest) { return envelope(req, await this.intake.submit(req)); }
}
