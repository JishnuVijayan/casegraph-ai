import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { ClarificationsService } from '../clarifications/service';
import { auditEvents, cases, evidenceFiles } from '../db/schema';
import { ExportsService } from '../exports/service';
import { InvestigationsService } from '../investigations/service';

@Injectable()
export class CasesService {
  constructor(
    private readonly access: AccessStore,
    private readonly clarifications: ClarificationsService,
    private readonly exports: ExportsService,
    private readonly investigations: InvestigationsService,
  ) {}

  async submit(req: ApiRequest) {
    const actor = req.actor!, caseId = req.caseRecord!.id;
    if (actor.role !== 'victim') throw new ForbiddenException();

    const evidenceCount = await this.access.available(async (db) =>
      (await db.select({ id: evidenceFiles.id }).from(evidenceFiles).where(eq(evidenceFiles.caseId, caseId)).limit(1)).length);
    if (!evidenceCount) throw new BadRequestException('Upload at least one evidence image before submitting.');

    await this.clarifications.refresh(req);
    const listed = await this.clarifications.list(req);
    if (listed.some((q) => q.isCurrent && q.status === 'OPEN')) {
      throw new BadRequestException('Answer or mark unknown all current essential questions before submitting.');
    }

    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select().from(cases)
        .where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned) throw new ForbiddenException();
      if (owned.status !== 'DRAFT') {
        throw new ConflictException('This complaint was already finalized.');
      }
      await tx.update(cases).set({ status: 'REVIEW_REQUIRED', updatedAt: new Date() }).where(eq(cases.id, caseId));
      await tx.insert(auditEvents).values({
        actorId: actor.id, action: 'CASE_SUBMITTED', resourceType: 'case', resourceId: caseId, requestId: req.requestId,
      });
    }));

    req.caseRecord = await this.access.findCase(actor, caseId, 'OWNER');
    const exportRow = await this.exports.create(req);
    const leads = await this.investigations.captureForSubmit(req);
    await this.access.findCase(actor, caseId, 'OWNER');
    return {
      caseId,
      status: 'REVIEW_REQUIRED' as const,
      exportId: exportRow.id,
      exportVersion: exportRow.version,
      leadsStatus: leads.leadsStatus,
      similarCaseCount: leads.similarCaseCount,
    };
  }
}
