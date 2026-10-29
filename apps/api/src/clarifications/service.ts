import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { auditEvents, cases, claims, clarifications, eventClaims, timelineEvents } from '../db/schema';
import { Database } from '../db/connection';
import { questions } from './rules';
import type { AnswerDto } from './controller';
type Query = Pick<Database, 'select'>;
async function current(db: Query, caseId: string) {
  const rows = await db.select({ eventId: timelineEvents.id, claimId: claims.id, type: claims.type,
    rawValue: claims.rawValue, sourceKind: claims.sourceKind }).from(timelineEvents)
    .innerJoin(eventClaims, and(eq(eventClaims.eventId, timelineEvents.id), eq(eventClaims.caseId, timelineEvents.caseId)))
    .innerJoin(claims, and(eq(claims.id, eventClaims.claimId), eq(claims.caseId, eventClaims.caseId)))
    .where(and(eq(timelineEvents.caseId, caseId), eq(timelineEvents.eventType, 'payment')));
  return questions([...new Set(rows.map((r) => r.eventId))].map((id) => ({ id,
    claims: rows.filter((r) => r.eventId === id).map((r) => ({ id: r.claimId, type: r.type, rawValue: r.rawValue, sourceKind: r.sourceKind })) })));
}
@Injectable()
export class ClarificationsService {
  constructor(private readonly access: AccessStore) {}
  async list(req: ApiRequest) {
    const caseId = req.caseRecord!.id;
    const result = await this.access.available(async (db) => {
      const active = new Set((await current(db, caseId)).map((q) => q.fingerprint));
      const rows = await db.select().from(clarifications).where(eq(clarifications.caseId, caseId))
        .orderBy(desc(clarifications.priority), asc(clarifications.createdAt), asc(clarifications.id));
      return rows.map((row) => ({ ...row, isCurrent: !!row.fingerprint && active.has(row.fingerprint) }));
    });
    await this.access.findCase(req.actor!, caseId, 'READ');
    await this.access.audit(req.actor!, 'CLARIFICATIONS_LISTED', 'case', caseId, req.requestId);
    return result;
  }
  async refresh(req: ApiRequest) {
    const actor = req.actor!, caseId = req.caseRecord!.id;
    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned || actor.role !== 'victim') throw new ForbiddenException();
      for (const q of await current(tx, caseId)) await tx.insert(clarifications).values({ caseId, ...q })
        .onConflictDoNothing({ target: [clarifications.caseId, clarifications.fingerprint] });
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'CLARIFICATIONS_REFRESHED', resourceType: 'case', resourceId: caseId, requestId: req.requestId });
    }));
    return this.list(req);
  }
  async answer(req: ApiRequest, id: string, dto: AnswerDto) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) throw new ForbiddenException();
    if ((dto.status === 'UNKNOWN' && dto.text !== undefined) || (dto.status === 'ANSWERED' && !dto.text?.trim())) throw new BadRequestException();
    const actor = req.actor!, caseId = req.caseRecord!.id;
    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned || actor.role !== 'victim') throw new ForbiddenException();
      const [q] = await tx.select().from(clarifications).where(and(eq(clarifications.id, id), eq(clarifications.caseId, caseId))).for('update');
      if (!q) throw new ForbiddenException();
      if (q.status !== 'OPEN' || !(await current(tx, caseId)).some((candidate) => candidate.fingerprint === q.fingerprint)) throw new ConflictException();
      await tx.update(clarifications).set({ status: dto.status, answer: { text: dto.status === 'UNKNOWN' ? null : dto.text,
        sourceKind: 'VICTIM_RECOLLECTION', verificationStatus: 'UNVERIFIED', answeredBy: actor.id, answeredAt: new Date().toISOString() } }).where(eq(clarifications.id, id));
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'CLARIFICATION_ANSWERED', resourceType: 'clarification', resourceId: id, requestId: req.requestId });
    }));
    return (await this.list(req)).find((q) => q.id === id);
  }
}
