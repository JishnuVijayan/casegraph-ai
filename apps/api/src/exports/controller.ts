import { Controller, Get, Req, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CaseScopeGuard, RequireCaseScope, Roles } from '../auth/guards';
import { ApiRequest } from '../common/http';
import { ExportsService } from './service';

@Controller('cases/:caseId')
@Roles('victim')
@RequireCaseScope('OWNER')
@UseGuards(CaseScopeGuard)
export class ExportsController {
  constructor(private readonly service: ExportsService) {}
  @Get('report.html')
  async report(@Req() req: ApiRequest, @Res({ passthrough: true }) res: Response) {
    const { html, filename } = await this.service.report(req);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'");
    res.setHeader('Cache-Control', 'private, no-store');
    return new StreamableFile(Buffer.from(html), { type: 'text/html; charset=utf-8', disposition: `attachment; filename="${filename}"` });
  }
}
