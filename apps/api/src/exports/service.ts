import { ForbiddenException, Injectable, PayloadTooLargeException, ServiceUnavailableException, StreamableFile } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { createHash, randomUUID } from 'node:crypto';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { auditEvents, cases, claims, claimSources, claimRevisions, clarifications, timelineEvents, eventClaims, evidenceFiles, extractionRegions, reportExports } from '../db/schema';
import { questions } from '../clarifications/rules';
import { renderDraft } from './render';
const MAX_BYTES = 2 * 1024 * 1024;
const meta = { id: reportExports.id, version: reportExports.version, sha256: reportExports.sha256, createdAt: reportExports.createdAt };
function bounded<T>(rows: T[]): T[] { if (rows.length > 1000) throw new PayloadTooLargeException(); return rows; }
@Injectable()
export class ExportsService {
  constructor(private readonly access: AccessStore) {}
  async list(req: ApiRequest) {
    const rows = await this.access.available((db)=>db.select(meta).from(reportExports).where(eq(reportExports.caseId, req.caseRecord!.id)).orderBy(desc(reportExports.version)).limit(100));
    await this.access.findCase(req.actor!, req.caseRecord!.id, 'READ');
    await this.access.audit(req.actor!, 'EXPORTS_LISTED', 'case', req.caseRecord!.id, req.requestId);
    return rows;
  }
  async create(req: ApiRequest) {
    const caseId = req.caseRecord!.id, actor = req.actor!;
    const result = await this.access.available((db)=>db.transaction(async (tx)=>{
      const [record] = await tx.select().from(cases).where(and(eq(cases.id,caseId),eq(cases.synthetic,true))).for('update');
      if (!record) throw new ForbiddenException();
      await this.access.findCaseIn(tx,actor,caseId,'READ');
      const evidence = bounded(await tx.select({id:evidenceFiles.id,sha256:evidenceFiles.sha256,mimeType:evidenceFiles.mimeType,sizeBytes:evidenceFiles.sizeBytes,createdAt:evidenceFiles.createdAt}).from(evidenceFiles).where(eq(evidenceFiles.caseId,caseId)).orderBy(asc(evidenceFiles.createdAt),asc(evidenceFiles.id)).limit(1001));
      const items = bounded(await tx.select().from(claims).where(eq(claims.caseId,caseId)).orderBy(asc(claims.createdAt),asc(claims.id)).limit(1001));
      const sources = bounded(await tx.select({claimId:claimSources.claimId,evidenceId:claimSources.evidenceFileId,regionId:claimSources.extractionRegionId,observedText:extractionRegions.text,textSpan:claimSources.textSpan,boundingBox:claimSources.boundingBox}).from(claimSources).leftJoin(extractionRegions,eq(extractionRegions.id,claimSources.extractionRegionId)).where(eq(claimSources.caseId,caseId)).orderBy(asc(claimSources.id)).limit(1001));
      const revisions = items.length ? bounded(await tx.select().from(claimRevisions).where(inArray(claimRevisions.claimId,items.map((c)=>c.id))).orderBy(asc(claimRevisions.changedAt),asc(claimRevisions.id)).limit(1001)) : [];
      const events = bounded(await tx.select().from(timelineEvents).where(eq(timelineEvents.caseId,caseId)).orderBy(asc(timelineEvents.occurredAt),asc(timelineEvents.createdAt),asc(timelineEvents.id)).limit(1001));
      const links = bounded(await tx.select({eventId:eventClaims.eventId,claimId:eventClaims.claimId}).from(eventClaims).where(eq(eventClaims.caseId,caseId)).orderBy(asc(eventClaims.eventId),asc(eventClaims.claimId)).limit(1001));
      const generated = questions(events.filter((event)=>event.eventType==='payment').map((event)=>({
        id:event.id, claims:links.filter((link)=>link.eventId===event.id).flatMap((link)=>{
          const claim=items.find((item)=>item.id===link.claimId); return claim ? [claim] : [];
        }),
      })));
      const active = new Set(generated.map((q)=>q.fingerprint));
      const prompts = bounded(await tx.select().from(clarifications).where(eq(clarifications.caseId,caseId)).orderBy(desc(clarifications.priority),asc(clarifications.createdAt),asc(clarifications.id)).limit(1001));
      // Include current rule gaps even when the owner has not refreshed T07 yet.
      const questionRows = prompts.map((q)=>({...q,isCurrent:!!q.fingerprint&&active.has(q.fingerprint)}));
      for (const q of generated) if (!prompts.some((p)=>p.fingerprint===q.fingerprint)) questionRows.push({...q,id:q.fingerprint,caseId,status:'OPEN',answer:null,createdAt:new Date(),isCurrent:true});
      const [last] = await tx.select({version:reportExports.version}).from(reportExports).where(eq(reportExports.caseId,caseId)).orderBy(desc(reportExports.version)).limit(1);
      const id = randomUUID(), version = (last?.version??0)+1, generatedAt = new Date().toISOString();
      const contentHtml = renderDraft({case:record,version,generatedAt,evidence,claims:items,sources,revisions,events,links,questions:questionRows});
      if (Buffer.byteLength(contentHtml)>MAX_BYTES) throw new PayloadTooLargeException();
      const sha256 = createHash('sha256').update(contentHtml).digest('hex');
      const [row] = await tx.insert(reportExports).values({id,caseId,version,objectKey:`db-export:${id}`,createdBy:actor.id,contentHtml,sha256}).returning(meta);
      await tx.insert(auditEvents).values({actorId:actor.id,action:'EXPORT_CREATED',resourceType:'export',resourceId:id,requestId:req.requestId});
      return row;
    }, {isolationLevel:'read committed'}));
    await this.access.findCase(actor,caseId,'READ');
    return result;
  }
  async download(req: ApiRequest,id: string) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new ForbiddenException();
    const [row] = await this.access.available((db)=>db.select().from(reportExports).where(and(eq(reportExports.id,id),eq(reportExports.caseId,req.caseRecord!.id))));
    if (!row) throw new ForbiddenException();
    if (!row.contentHtml || Buffer.byteLength(row.contentHtml)>MAX_BYTES || createHash('sha256').update(row.contentHtml).digest('hex')!==row.sha256) throw new ServiceUnavailableException();
    await this.access.findCase(req.actor!,req.caseRecord!.id,'READ');
    await this.access.audit(req.actor!,'EXPORT_DOWNLOADED','export',id,req.requestId);
    await this.access.findCase(req.actor!,req.caseRecord!.id,'READ');
    return new StreamableFile(Buffer.from(row.contentHtml),{type:'text/html; charset=utf-8',disposition:`attachment; filename="casegraph-draft-v${row.version}.html"`});
  }
}
