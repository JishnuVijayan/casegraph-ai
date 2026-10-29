import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest } from '../common/http';
import { auditEvents, cases, claimRevisions, claimSources, claims, eventClaims,
  evidenceFiles, extractionRegions, extractionRuns, timelineEvents } from '../db/schema';
import { CreateClaimDto, CreateTimelineEventDto, CorrectClaimDto } from './controller';
import { normalizeClaimValue } from './normalization';

function parseEventTime(precision: CreateTimelineEventDto['precision'], value?: string): Date | null {
  if (precision === 'UNKNOWN') {
    if (value !== undefined) throw new BadRequestException();
    return null;
  }
  if (!value) throw new BadRequestException();
  if (precision === 'DATE_ONLY') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException();
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException();
    return date;
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new BadRequestException();
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new BadRequestException();
  return date;
}

@Injectable()
export class ClaimsService {
  constructor(private readonly access: AccessStore) {}

  async list(request: ApiRequest) {
    const caseId = request.caseRecord!.id;
    const rows = await this.access.available(async (db) => {
      const items = await db.select().from(claims).where(eq(claims.caseId, caseId)).orderBy(asc(claims.createdAt), asc(claims.id));
      if (!items.length) return [];
      const ids = items.map((item) => item.id);
      const sources = await db.select({ claimId: claimSources.claimId, evidenceId: claimSources.evidenceFileId,
        regionId: claimSources.extractionRegionId, textSpan: claimSources.textSpan, boundingBox: claimSources.boundingBox,
        observedText: extractionRegions.text }).from(claimSources).leftJoin(extractionRegions,
        eq(claimSources.extractionRegionId, extractionRegions.id)).where(and(eq(claimSources.caseId, caseId), inArray(claimSources.claimId, ids)));
      const revisions = await db.select().from(claimRevisions).where(inArray(claimRevisions.claimId, ids))
        .orderBy(asc(claimRevisions.changedAt), asc(claimRevisions.id));
      return items.map((item) => ({ ...item,
        sources: sources.filter((source) => source.claimId === item.id).map((source) => ({
          evidenceId: source.evidenceId, regionId: source.regionId, textSpan: source.textSpan,
          boundingBox: source.boundingBox, observedText: source.observedText,
        })),
        revisions: revisions.filter((revision) => revision.claimId === item.id).map((revision) => ({
          id: revision.id, before: revision.before, after: revision.after,
          reason: revision.reason, changedAt: revision.changedAt,
        })),
      }));
    });
    await this.access.findCase(request.actor!, caseId, 'READ');
    await this.access.audit(request.actor!, 'CLAIMS_LISTED', 'case', caseId, request.requestId);
    return rows;
  }

  async create(request: ApiRequest, dto: CreateClaimDto) {
    const actor = request.actor!, caseId = request.caseRecord!.id;
    if (actor.role !== 'victim') throw new ForbiddenException();
    const id = await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: cases.id }).from(cases).where(and(
        eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned) throw new ForbiddenException();
      let rawValue: string; let normalizedValue: Record<string, string> | null;
      let source: { evidenceId: string; regionId: string; textSpan: { start: number; end: number }; boundingBox: { x: number; y: number; width: number; height: number } } | undefined;
      if (dto.sourceKind === 'OBSERVED_IN_UPLOAD') {
        if (dto.type !== 'payment_amount' || dto.rawValue !== undefined || !dto.evidenceId || !dto.regionId) throw new BadRequestException();
        const [region] = await tx.select({ id: extractionRegions.id, text: extractionRegions.text,
          textSpan: extractionRegions.textSpan, boundingBox: extractionRegions.boundingBox,
          evidenceId: evidenceFiles.id }).from(extractionRegions)
          .innerJoin(extractionRuns, eq(extractionRegions.runId, extractionRuns.id))
          .innerJoin(evidenceFiles, eq(extractionRuns.evidenceFileId, evidenceFiles.id))
          .where(and(eq(extractionRegions.id, dto.regionId), eq(evidenceFiles.id, dto.evidenceId),
            eq(evidenceFiles.caseId, caseId), eq(extractionRuns.status, 'SUCCEEDED'), eq(extractionRegions.kind, 'AMOUNT')));
        if (!region) throw new ForbiddenException();
        const [linked] = await tx.select({ claimId: claimSources.claimId }).from(claimSources)
          .where(eq(claimSources.extractionRegionId, region.id));
        if (linked) {
          const [existing] = await tx.select({ id: claims.id }).from(claims)
            .where(and(eq(claims.id, linked.claimId), eq(claims.caseId, caseId)));
          if (!existing) throw new ForbiddenException();
          await tx.insert(auditEvents).values({ actorId: actor.id, action: 'CLAIM_SOURCE_REUSED', resourceType: 'claim', resourceId: existing.id, requestId: request.requestId });
          return existing.id;
        }
        rawValue = region.text; normalizedValue = normalizeClaimValue(dto.type, rawValue);
        source = { evidenceId: region.evidenceId, regionId: region.id, textSpan: region.textSpan, boundingBox: region.boundingBox };
      } else {
        if (dto.evidenceId || dto.regionId || dto.rawValue === undefined) throw new BadRequestException();
        rawValue = dto.rawValue.trim();
        if (!rawValue) throw new BadRequestException();
        normalizedValue = normalizeClaimValue(dto.type, rawValue);
      }
      const [claim] = await tx.insert(claims).values({ caseId, type: dto.type, rawValue,
        normalizedValue, sourceKind: dto.sourceKind, verificationStatus: 'UNVERIFIED' }).returning({ id: claims.id });
      if (source) await tx.insert(claimSources).values({ caseId, claimId: claim.id, evidenceFileId: source.evidenceId,
        extractionRegionId: source.regionId, textSpan: source.textSpan, boundingBox: source.boundingBox });
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'CLAIM_CREATED', resourceType: 'claim', resourceId: claim.id, requestId: request.requestId });
      return claim.id;
    }));
    const row = (await this.list(request)).find((item) => item.id === id);
    if (!row) throw new ForbiddenException();
    return row;
  }

  async correct(request: ApiRequest, claimId: string, dto: CorrectClaimDto) {
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(claimId)) throw new ForbiddenException();
    const actor = request.actor!, caseId = request.caseRecord!.id, nextValue = dto.rawValue.trim();
    if (actor.role !== 'victim') throw new ForbiddenException();
    if (!nextValue) throw new BadRequestException();
    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: cases.id }).from(cases).where(and(
        eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned) throw new ForbiddenException();
      const [claim] = await tx.select().from(claims).where(and(eq(claims.id, claimId), eq(claims.caseId, caseId))).for('update');
      if (!claim) throw new ForbiddenException();
      if (claim.rawValue === nextValue) throw new BadRequestException();
      const before = { rawValue: claim.rawValue, normalizedValue: claim.normalizedValue };
      const normalizedValue = normalizeClaimValue(claim.type, nextValue);
      const after = { rawValue: nextValue, normalizedValue };
      await tx.insert(claimRevisions).values({ claimId, changedBy: actor.id, before, after, reason: dto.reason?.trim() || null });
      await tx.update(claims).set({ rawValue: nextValue, normalizedValue }).where(and(eq(claims.id, claimId), eq(claims.caseId, caseId)));
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'CLAIM_CORRECTED', resourceType: 'claim', resourceId: claimId, requestId: request.requestId });
    }));
    const row = (await this.list(request)).find((item) => item.id === claimId);
    if (!row) throw new ForbiddenException();
    return row;
  }

  async timeline(request: ApiRequest) {
    const caseId = request.caseRecord!.id;
    const data = await this.access.available(async (db) => {
      const events = await db.select().from(timelineEvents).where(eq(timelineEvents.caseId, caseId))
        .orderBy(asc(timelineEvents.occurredAt), asc(timelineEvents.createdAt), asc(timelineEvents.id));
      if (!events.length) return [];
      const linked = await db.select({ eventId: eventClaims.eventId, claimId: claims.id, type: claims.type,
        rawValue: claims.rawValue, sourceKind: claims.sourceKind, verificationStatus: claims.verificationStatus,
        evidenceId: claimSources.evidenceFileId, regionId: claimSources.extractionRegionId,
        textSpan: claimSources.textSpan, boundingBox: claimSources.boundingBox,
        observedText: extractionRegions.text }).from(eventClaims)
        .innerJoin(claims, and(eq(eventClaims.claimId, claims.id), eq(eventClaims.caseId, claims.caseId)))
        .leftJoin(claimSources, and(eq(claims.id, claimSources.claimId), eq(claims.caseId, claimSources.caseId)))
        .leftJoin(extractionRegions, eq(claimSources.extractionRegionId, extractionRegions.id))
        .where(and(eq(eventClaims.caseId, caseId), inArray(eventClaims.eventId, events.map((event) => event.id))));
      return events.map((event) => ({ ...event, claims: linked.filter((item) => item.eventId === event.id)
        .map((item) => ({ claimId: item.claimId, type: item.type, rawValue: item.rawValue,
          sourceKind: item.sourceKind, verificationStatus: item.verificationStatus,
          evidenceId: item.evidenceId, regionId: item.regionId, textSpan: item.textSpan,
          boundingBox: item.boundingBox, observedText: item.observedText })) }));
    });
    await this.access.findCase(request.actor!, caseId, 'READ');
    await this.access.audit(request.actor!, 'TIMELINE_LISTED', 'case', caseId, request.requestId);
    return data;
  }

  async createEvent(request: ApiRequest, dto: CreateTimelineEventDto) {
    const actor = request.actor!, caseId = request.caseRecord!.id;
    if (actor.role !== 'victim') throw new ForbiddenException();
    const occurredAt = parseEventTime(dto.precision, dto.occurredAt);
    const claimIds = [...new Set(dto.claimIds)];
    if (claimIds.length !== dto.claimIds.length) throw new BadRequestException();
    const eventId = await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select({ id: cases.id }).from(cases).where(and(
        eq(cases.id, caseId), eq(cases.ownerId, actor.id), eq(cases.synthetic, true))).for('update');
      if (!owned) throw new ForbiddenException();
      const supporting = await tx.select({ id: claims.id }).from(claims)
        .where(and(eq(claims.caseId, caseId), inArray(claims.id, claimIds)));
      if (supporting.length !== claimIds.length) throw new BadRequestException();
      const [event] = await tx.insert(timelineEvents).values({ caseId, eventType: dto.eventType,
        occurredAt, precision: dto.precision, uncertainty: dto.uncertainty.trim() }).returning({ id: timelineEvents.id });
      await tx.insert(eventClaims).values(claimIds.map((claimId) => ({ caseId, eventId: event.id, claimId })));
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'TIMELINE_EVENT_CREATED', resourceType: 'timeline_event', resourceId: event.id, requestId: request.requestId });
      return event.id;
    }));
    const events = await this.timeline(request);
    return events.find((event) => event.id === eventId);
  }
}
