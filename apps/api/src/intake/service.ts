import { Inject, Injectable, Optional } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest, PlainError } from '../common/http';
import { auditEvents, caseAnalyses, cases, evidenceFiles, narratives } from '../db/schema';
import { AnalysisService } from './analysis';
import { BriefService } from './brief';
import { QuestionsService } from './questions';
import { SIMILAR_CASES_PROVIDER, SimilarCasesProvider } from './similar';
import { Brief, CategoryId, Narrative, categoryLabel, normalizeCategory } from './types';

@Injectable()
export class IntakeService {
  constructor(private readonly access: AccessStore, private readonly briefs: BriefService, private readonly analysis: AnalysisService,
    private readonly questions: QuestionsService,
    @Optional() @Inject(SIMILAR_CASES_PROVIDER) private readonly similar?: SimilarCasesProvider) {}

  private async draftOwned(req: ApiRequest) {
    const [row] = await this.access.available((db) => db.select().from(cases)
      .where(and(eq(cases.id, req.caseRecord!.id), eq(cases.ownerId, req.actor!.id))));
    if (!row) throw new PlainError(403, 'Access denied.', 'ACCESS_DENIED');
    if (row.status !== 'DRAFT') throw new PlainError(409, 'This complaint was already submitted.', 'ALREADY_SUBMITTED');
    return row;
  }

  async addNarrative(req: ApiRequest, text: string, channel: 'typed' | 'voice'): Promise<Narrative> {
    await this.draftOwned(req);
    const clean = text.replace(/\u0000/g, '').trim();
    if (!clean || clean.length > 20000) throw new PlainError(400, 'Please write between 1 and 20,000 characters.', 'BAD_REQUEST');
    const row = await this.access.available((db) => db.transaction(async (tx) => {
      const [created] = await tx.insert(narratives).values({ caseId: req.caseRecord!.id, text: clean, channel }).returning();
      await tx.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, req.caseRecord!.id));
      // Audit records that a story was added, never its content.
      await tx.insert(auditEvents).values({ actorId: req.actor!.id, action: `NARRATIVE_ADDED_${channel.toUpperCase()}`, resourceType: 'narrative', resourceId: created.id, requestId: req.requestId });
      return created;
    }));
    return { id: row.id, text: row.text, channel: row.channel as 'typed' | 'voice', createdAt: row.createdAt.toISOString() };
  }

  async brief(req: ApiRequest): Promise<Brief> {
    const brief = await this.briefs.build(req.caseRecord!.id);
    await this.access.audit(req.actor!, 'BRIEF_READ', 'case', req.caseRecord!.id, req.requestId);
    return brief;
  }

  async patch(req: ApiRequest, dto: { category?: string; title?: string }): Promise<Brief> {
    const row = await this.draftOwned(req);
    const caseId = row.id;
    await this.access.available((db) => db.transaction(async (tx) => {
      const flags: { userCategory?: boolean; userTitle?: boolean } = {};
      const set: Partial<typeof cases.$inferInsert> = { updatedAt: new Date() };
      if (dto.category) { set.category = dto.category; flags.userCategory = true; }
      if (dto.title) { set.title = dto.title; flags.userTitle = true; }
      await tx.update(cases).set(set).where(eq(cases.id, caseId));
      if (flags.userCategory || flags.userTitle) {
        await tx.insert(caseAnalyses).values({ caseId, ...flags }).onConflictDoUpdate({ target: caseAnalyses.caseId, set: flags });
      }
      await tx.insert(auditEvents).values({ actorId: req.actor!.id, action: 'CASE_EDITED', resourceType: 'case', resourceId: caseId, requestId: req.requestId });
    }));
    return this.briefs.build(caseId);
  }

  /** The victim's own complaints, newest first. */
  async list(req: ApiRequest) {
    const rows = await this.access.available((db) => db.select().from(cases).where(eq(cases.ownerId, req.actor!.id)).orderBy(desc(cases.updatedAt), desc(cases.id)));
    const result = [];
    for (const r of rows) {
      const category: CategoryId = normalizeCategory(r.category);
      const brief = await this.briefs.build(r.id);
      result.push({ id: r.id, reference: r.reference, title: r.title, categoryLabel: categoryLabel(category),
        status: r.status === 'DRAFT' ? 'DRAFT' as const : 'SUBMITTED' as const, updatedAt: r.updatedAt.toISOString(), completenessPercent: brief.completeness.percent });
    }
    await this.access.audit(req.actor!, 'CASES_LISTED', 'user', req.actor!.id, req.requestId);
    return result;
  }

  async submit(req: ApiRequest) {
    const caseId = req.caseRecord!.id;
    await this.draftOwned(req);
    const material = await this.access.available(async (db) => ({
      stories: (await db.select({ id: narratives.id }).from(narratives).where(eq(narratives.caseId, caseId)).limit(1)).length,
      files: (await db.select({ id: evidenceFiles.id }).from(evidenceFiles).where(eq(evidenceFiles.caseId, caseId)).limit(1)).length,
    }));
    if (!material.stories && !material.files) throw new PlainError(400, 'Tell us what happened or add at least one file before you submit.', 'NOTHING_TO_SUBMIT');
    // Make sure the officer sees an up-to-date summary. If the assistant is down, submit anyway.
    const brief = await this.briefs.build(caseId);
    const stale = brief.analysis.state !== 'READY' || !brief.analysis.updatedAt ||
      brief.narratives.some((n) => n.createdAt > brief.analysis.updatedAt!) || brief.evidence.some((e) => e.readStatus === 'PENDING');
    if (stale) { try { await this.analysis.analyze(req); } catch { /* submit proceeds with what we have */ } }
    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.ownerId, req.actor!.id))).for('update');
      if (!owned) throw new PlainError(403, 'Access denied.', 'ACCESS_DENIED');
      if (owned.status !== 'DRAFT') throw new PlainError(409, 'This complaint was already submitted.', 'ALREADY_SUBMITTED');
      await tx.update(cases).set({ status: 'REVIEW_REQUIRED', updatedAt: new Date() }).where(eq(cases.id, caseId));
      await tx.insert(auditEvents).values({ actorId: req.actor!.id, action: 'CASE_SUBMITTED', resourceType: 'case', resourceId: caseId, requestId: req.requestId });
    }));
    let similar: { status: 'READY' | 'UNAVAILABLE' | 'NONE'; count: number } = { status: 'UNAVAILABLE', count: 0 };
    if (this.similar) {
      try { const found = await this.similar.findSimilar(caseId); similar = { status: found.status, count: found.cases.length }; }
      catch { similar = { status: 'UNAVAILABLE', count: 0 }; }
    }
    return { reference: brief.reference, status: 'SUBMITTED' as const, similarCases: similar };
  }
}
