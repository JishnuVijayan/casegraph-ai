import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { ClarificationsService } from '../clarifications/service';
import { ClaimsService } from '../claims/service';
import {
  auditEvents, cases, claims as claimRows, claimSources, eventClaims, evidenceFiles,
  extractionRegions, extractionRuns, timelineEvents,
} from '../db/schema';
import { EvidenceService } from '../evidence/service';
import { ExportsService } from '../exports/service';
import { ExtractionService } from '../extraction/service';
import { normalizeClaimValue } from '../claims/normalization';
import { parsePrepareHints } from './prepare-parse';

@Injectable()
export class CasesService {
  constructor(
    private readonly access: AccessStore,
    private readonly clarifications: ClarificationsService,
    private readonly claims: ClaimsService,
    private readonly evidence: EvidenceService,
    private readonly extraction: ExtractionService,
    private readonly exports: ExportsService,
  ) {}

  /**
   * Victim prepare step: OCR evidence, promote amount regions to claims,
   * parse OCR/summary for reference/time heuristics, scaffold a payment
   * timeline, then refresh clarification questions.
   * Deterministic reconstruction — not bank verification.
   */
  async prepare(req: ApiRequest) {
    const actor = req.actor!, caseId = req.caseRecord!.id;
    if (actor.role !== 'victim') throw new ForbiddenException();
    if(req.caseRecord!.status!=='DRAFT')throw new ConflictException();

    const files = await this.evidence.list(req);
    if (!files.length) throw new BadRequestException('Upload at least one evidence image before continuing.');

    const ocrTexts: {evidenceId:string;text:string}[] = [];
    for (const file of files) {
      let current = await this.extraction.get(req, file.id);
      if (current.status !== 'SUCCEEDED') {
        current = await this.extraction.run(req, file.id);
      }
      const text = 'outputText' in current ? current.outputText : null;
      if (text) ocrTexts.push({evidenceId:file.id,text});
    }

    const regions = await this.access.available(async (db) => db.select({
      regionId: extractionRegions.id,
      evidenceId: evidenceFiles.id,
    }).from(extractionRegions)
      .innerJoin(extractionRuns, eq(extractionRegions.runId, extractionRuns.id))
      .innerJoin(evidenceFiles, eq(extractionRuns.evidenceFileId, evidenceFiles.id))
      .where(and(
        eq(evidenceFiles.caseId, caseId),
        eq(extractionRuns.status, 'SUCCEEDED'),
        eq(extractionRegions.kind, 'AMOUNT'),
      )));

    for (const region of regions) {
      await this.claims.create(req, {
        type: 'payment_amount',
        sourceKind: 'OBSERVED_IN_UPLOAD',
        evidenceId: region.evidenceId,
        regionId: region.regionId,
      });
    }

    let existingClaims = await this.claims.list(req);
    const title = (existingClaims.find((claim)=>claim.type==='statement'&&claim.sourceKind==='VICTIM_RECOLLECTION')?.rawValue??req.caseRecord!.title??'').replace(/^Synthetic\s+/i, '').trim();
    if (title && !existingClaims.some((claim) => claim.type === 'statement')) {
      await this.claims.create(req, {
        type: 'statement',
        sourceKind: 'VICTIM_RECOLLECTION',
        rawValue: title.slice(0, 500),
      });
      existingClaims = await this.claims.list(req);
    }

    // Summary-derived candidates remain recollection. OCR-derived candidates are
    // system interpretations bound to that original, never relabeled as recollection.
    for(const input of [{text:title,evidenceId:null},...ocrTexts]) {
      const hints=parsePrepareHints(input.text);
      for(const [type,values] of [['payment_amount',hints.amounts],['payment_reference',hints.references],['incident_time',hints.incidentTimes]] as const){
        existingClaims=await this.claims.list(req);
        for(const value of values.slice(0,2)) {
          if(existingClaims.some((claim)=>claim.type===type&&claim.rawValue===value))continue;
          // Existing OCR amount regions already carry precise source coordinates.
          if(type==='payment_amount'&&existingClaims.some((claim)=>claim.type===type))continue;
          if(!input.evidenceId){
            await this.claims.create(req,{type,sourceKind:'VICTIM_RECOLLECTION',rawValue:value.slice(0,500)});
          }else{
            await this.access.available((db)=>db.transaction(async(tx)=>{
              const [owned]=await tx.select({id:cases.id}).from(cases).where(and(eq(cases.id,caseId),eq(cases.ownerId,actor.id),eq(cases.synthetic,true))).for('update');
              if(!owned)throw new ForbiddenException();
              const [claim]=await tx.insert(claimRows).values({caseId,type,rawValue:value.slice(0,500),normalizedValue:normalizeClaimValue(type,value),sourceKind:'SYSTEM_INFERENCE',verificationStatus:'UNVERIFIED'}).returning({id:claimRows.id});
              await tx.insert(claimSources).values({caseId,claimId:claim.id,evidenceFileId:input.evidenceId!,textSpan:{start:0,end:input.text.length}});
              await tx.insert(auditEvents).values({actorId:actor.id,action:'CLAIM_INFERRED_FROM_OCR',resourceType:'claim',resourceId:claim.id,requestId:req.requestId});
            }));
          }
        }
      }
    }

    const claimIds = (await this.claims.list(req)).map((claim) => claim.id);
    if (!claimIds.length) {
      throw new BadRequestException('Could not build case details from the uploads. Try another screenshot or add a clearer description.');
    }
    await this.ensurePaymentLinks(req, claimIds);

    await this.access.available((db) => db.insert(auditEvents).values({
      actorId: actor.id, action: 'CASE_PREPARED', resourceType: 'case', resourceId: caseId, requestId: req.requestId,
    }));

    await this.clarifications.refresh(req);
    const listed = await this.clarifications.list(req);
    const openQuestions = listed.filter((q) => q.isCurrent && q.status === 'OPEN').length;
    const claimCount = (await this.claims.list(req)).length;

    return {
      caseId,
      evidenceCount: files.length,
      claimCount,
      openQuestions,
    };
  }

  private async ensurePaymentLinks(req: ApiRequest, claimIds: string[]) {
    const actor = req.actor!, caseId = req.caseRecord!.id;
    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: cases.id }).from(cases).where(and(
        eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned) throw new ForbiddenException();

      const [payment] = await tx.select().from(timelineEvents)
        .where(and(eq(timelineEvents.caseId, caseId), eq(timelineEvents.eventType, 'payment')))
        .orderBy(timelineEvents.createdAt).limit(1);

      let eventId = payment?.id;
      if (!eventId) {
        const [created] = await tx.insert(timelineEvents).values({
          caseId, eventType: 'payment', occurredAt: null, precision: 'UNKNOWN', uncertainty: 'SYSTEM_INFERENCE: provisional grouping; not verified as one payment',
        }).returning({ id: timelineEvents.id });
        eventId = created.id;
        await tx.insert(auditEvents).values({
          actorId: actor.id, action: 'TIMELINE_EVENT_CREATED', resourceType: 'timeline_event',
          resourceId: eventId, requestId: req.requestId,
        });
      }

      const linked = await tx.select({ claimId: eventClaims.claimId }).from(eventClaims)
        .where(and(eq(eventClaims.caseId, caseId), eq(eventClaims.eventId, eventId), inArray(eventClaims.claimId, claimIds)));
      const linkedSet = new Set(linked.map((row) => row.claimId));
      const missing = claimIds.filter((id) => !linkedSet.has(id));
      if (missing.length) {
        await tx.insert(eventClaims).values(missing.map((claimId) => ({ caseId, eventId: eventId!, claimId })));
      }
    }));
  }

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

    if(req.caseRecord!.status!=='DRAFT')throw new ConflictException();
    // Leave the draft retryable if report generation fails.
    const exportRow = await this.exports.create(req);
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
    return {
      caseId,
      status: 'REVIEW_REQUIRED' as const,
      exportId: exportRow.id,
      exportVersion: exportRow.version,
      leadsStatus: 'NOT_REQUESTED' as const,
      similarCaseCount: 0,
    };
  }
}
