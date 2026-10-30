import { Injectable } from '@nestjs/common';
import { and, eq, inArray, max } from 'drizzle-orm';
import { AccessStore } from '../auth/store';
import { ApiRequest, PlainError } from '../common/http';
import { auditEvents, cases, claims, clarifications, evidenceFiles, narratives } from '../db/schema';
import { AnalysisQuestion } from './schemas';
import { BriefService, FLOOR, MAX_OPEN_QUESTIONS, entitiesInText, floorSatisfied, questionHash } from './brief';
import { ENTITY_CLAIM_TYPE, Brief } from './types';

const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
/** The AI asks at most this many questions about one complaint in total (answered ones count), so it can never become a loop. */
const MAX_AI_QUESTIONS_TOTAL = 8;
const norm = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();

@Injectable()
export class QuestionsService {
  constructor(private readonly access: AccessStore, private readonly briefs: BriefService) {}

  /**
   * Keeps the open questions equal to what is still missing. Floor questions (when, amount, how money moved,
   * how contacted, what was promised) are deterministic; AI questions are replaced whenever `ai` is given.
   * Answered and "unknown" questions are never touched and never asked again.
   */
  async refresh(caseId: string, ai?: AnalysisQuestion[]): Promise<void> {
    const data = await this.briefs.dataFor(caseId);
    const satisfied = floorSatisfied(data);
    await this.access.available((db) => db.transaction(async (tx) => {
      await tx.select({ id: cases.id }).from(cases).where(eq(cases.id, caseId)).for('update');
      const rows = await tx.select().from(clarifications).where(and(eq(clarifications.caseId, caseId), inArray(clarifications.origin, ['AI', 'FLOOR'])));
      // New AI questions are only made when the person added something after the last ones were asked. Re-reading the
      // same story (for example after they answered) must never replace or add questions.
      const [lastAsked] = await tx.select({ at: max(clarifications.createdAt) }).from(clarifications).where(and(eq(clarifications.caseId, caseId), eq(clarifications.origin, 'AI')));
      const [lastStory] = await tx.select({ at: max(narratives.createdAt) }).from(narratives).where(eq(narratives.caseId, caseId));
      const [lastFile] = await tx.select({ at: max(evidenceFiles.createdAt) }).from(evidenceFiles).where(eq(evidenceFiles.caseId, caseId));
      const newest = [lastStory?.at, lastFile?.at].filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0];
      const allowNew = !lastAsked?.at || (!!newest && newest.getTime() > lastAsked.at.getTime());
      const useAi = ai && allowNew ? ai : undefined;
      const drop: string[] = [];
      for (const [index, item] of FLOOR.entries()) {
        const existing = rows.filter((r) => r.kind === item.key);
        const handled = existing.some((r) => r.status !== 'OPEN');
        const open = existing.find((r) => r.status === 'OPEN');
        if (!data.hasMaterial || satisfied[item.key] || handled) { if (open) drop.push(open.id); continue; }
        if (!open) {
          await tx.insert(clarifications).values({
            caseId, kind: item.key, prompt: item.prompt, why: item.why, options: 'options' in item ? [...item.options] : null, origin: 'FLOOR',
            fingerprint: questionHash(caseId, item.key, item.prompt), priority: 100 - index, status: 'OPEN',
          }).onConflictDoNothing({ target: [clarifications.caseId, clarifications.fingerprint] });
        }
      }
      if (useAi) {
        for (const r of rows) if (r.origin === 'AI' && r.status === 'OPEN') drop.push(r.id);
      }
      if (drop.length) await tx.delete(clarifications).where(inArray(clarifications.id, drop));
      const kept = rows.filter((r) => !drop.includes(r.id));
      if (useAi && data.hasMaterial) {
        const known = new Set(kept.map((r) => norm(r.prompt)));
        const floorOpen = (await tx.select({ id: clarifications.id }).from(clarifications)
          .where(and(eq(clarifications.caseId, caseId), eq(clarifications.status, 'OPEN'), eq(clarifications.origin, 'FLOOR')))).length;
        const askedAlready = kept.filter((r) => r.origin === 'AI').length;
        let capacity = Math.min(MAX_OPEN_QUESTIONS - floorOpen, MAX_AI_QUESTIONS_TOTAL - askedAlready);
        for (const [index, q] of useAi.entries()) {
          if (capacity <= 0) break;
          if (known.has(norm(q.prompt))) continue;
          known.add(norm(q.prompt));
          await tx.insert(clarifications).values({
            caseId, kind: 'ai', prompt: q.prompt, why: q.why, options: q.options ?? null, origin: 'AI',
            fingerprint: questionHash(caseId, 'ai', q.prompt), priority: 50 - index, status: 'OPEN',
          }).onConflictDoNothing({ target: [clarifications.caseId, clarifications.fingerprint] });
          capacity--;
        }
      }
      if (!useAi) {
        const open = await tx.select().from(clarifications).where(and(eq(clarifications.caseId, caseId), eq(clarifications.status, 'OPEN'),
          inArray(clarifications.origin, ['AI', 'FLOOR'])));
        const extra = open.sort((a, b) => b.priority - a.priority).slice(MAX_OPEN_QUESTIONS).map((r) => r.id);
        if (extra.length) await tx.delete(clarifications).where(inArray(clarifications.id, extra));
      }
    }));
  }

  /** Records an answer ("UNKNOWN" allowed), turns identifiers in it into case facts, and refreshes what is still missing. */
  async answer(req: ApiRequest, questionId: string, answer: string): Promise<Brief> {
    if (!uuid.test(questionId)) throw new PlainError(404, 'We could not find that question.', 'NOT_FOUND');
    const text = answer.trim();
    if (!text || text.length > 2000) throw new PlainError(400, 'Please type a short answer, or choose "I don\'t know".', 'BAD_REQUEST');
    const unknown = /^unknown$/i.test(text);
    const actor = req.actor!, caseId = req.caseRecord!.id;
    await this.access.available((db) => db.transaction(async (tx) => {
      const [owned] = await tx.select().from(cases).where(and(eq(cases.id, caseId), eq(cases.ownerId, actor.id))).for('update');
      if (!owned) throw new PlainError(403, 'Access denied.', 'ACCESS_DENIED');
      if (owned.status !== 'DRAFT') throw new PlainError(409, 'This complaint was already submitted.', 'ALREADY_SUBMITTED');
      const [q] = await tx.select().from(clarifications).where(and(eq(clarifications.id, questionId), eq(clarifications.caseId, caseId),
        inArray(clarifications.origin, ['AI', 'FLOOR']))).for('update');
      if (!q) throw new PlainError(404, 'We could not find that question.', 'NOT_FOUND');
      if (q.status !== 'OPEN') throw new PlainError(409, 'This question was already answered.', 'ALREADY_ANSWERED');
      await tx.update(clarifications).set({
        status: unknown ? 'UNKNOWN' : 'ANSWERED',
        answer: { text: unknown ? null : text, sourceKind: 'VICTIM_RECOLLECTION', answeredAt: new Date().toISOString() },
      }).where(eq(clarifications.id, questionId));
      if (!unknown) {
        const existing = await tx.select({ type: claims.type, raw: claims.rawValue }).from(claims).where(eq(claims.caseId, caseId));
        for (const entity of entitiesInText(text)) {
          const type = ENTITY_CLAIM_TYPE[entity.kind];
          if (existing.some((e) => e.type === type && e.raw.toLowerCase() === entity.value.toLowerCase())) continue;
          await tx.insert(claims).values({ caseId, type, rawValue: entity.value, sourceKind: 'VICTIM_RECOLLECTION',
            verificationStatus: 'UNVERIFIED', normalizedValue: { origin: 'ANSWER', questionId } });
        }
      }
      await tx.update(cases).set({ updatedAt: new Date() }).where(eq(cases.id, caseId));
      await tx.insert(auditEvents).values({ actorId: actor.id, action: 'QUESTION_ANSWERED', resourceType: 'clarification', resourceId: questionId, requestId: req.requestId });
    }));
    await this.refresh(caseId);
    return this.briefs.build(caseId);
  }
}
