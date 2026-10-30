import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { AccessStore } from '../auth/store';
import { caseAnalyses, cases, claimSources, claims, clarifications, evidenceFiles, fileReads, narratives, timelineEvents, users } from '../db/schema';
import { normalizeEntity } from '../investigations/entities';
import {
  Brief, CLAIM_TYPE_ENTITY, Entity, EntityKind, ENTITY_CLAIM_TYPE, Fact, FactGroup, Question, SourceType, TimelineItem, MONEY_CATEGORIES, CategoryId, categoryLabel, normalizeCategory,
} from './types';

/** The five things a useful complaint must say. Asked only when the person's material does not already contain them. */
export const FLOOR = [
  { key: 'when', label: 'When it happened', prompt: 'When did this happen? An approximate date is fine.',
    why: 'The date helps the officer match it with bank, phone and app records.', group: 'time' as FactGroup, label2: 'When it happened' },
  { key: 'amount', label: 'How much money you lost', prompt: 'How much money did you lose in total, in rupees?',
    why: 'The total decides how the case is handled and which bank to alert.', group: 'money' as FactGroup, label2: 'Total money lost' },
  { key: 'money_path', label: 'How the money was sent', prompt: 'How did the money leave your account? Share the UPI ID, bank account number or card used if you have it.',
    why: 'The receiving account is the best lead for freezing the money.', group: 'accounts' as FactGroup, label2: 'How the money was sent',
    options: ['UPI', 'Bank transfer', 'Card', 'Cash', 'Other'] },
  { key: 'contact', label: 'How they reached you', prompt: 'How did the other person reach you, or where did it happen? Share the phone number, app, website, profile name or link if you have it.',
    why: 'A number, profile or website helps link this to other complaints.', group: 'channels' as FactGroup, label2: 'How they reached you',
    options: ['Phone call', 'WhatsApp', 'Telegram', 'Instagram or Facebook', 'SMS', 'Email', 'Website or app'] },
  { key: 'promise', label: 'What they said or wanted', prompt: 'What did they say, promise, ask for or threaten?',
    why: 'Their own words help the officer understand what happened.', group: 'other' as FactGroup, label2: 'What they said or wanted' },
] as const;
export type FloorKey = typeof FLOOR[number]['key'];
export const MAX_OPEN_QUESTIONS = 5;
const PROMISE_LABEL = /promis|offer|claim|told|said|pretend|assur|guarantee|return|profit|reward|prize|job|task|loan/i;

export const questionHash = (caseId: string, kind: string, prompt: string) =>
  createHash('sha256').update(JSON.stringify({ v: 2, caseId, kind, prompt: prompt.toLowerCase().replace(/\s+/g, ' ').trim() })).digest('hex');

const ENTITY_TYPES = Object.values(ENTITY_CLAIM_TYPE);
const answerText = (answer: unknown): string | null =>
  answer && typeof answer === 'object' && typeof (answer as { text?: unknown }).text === 'string' ? (answer as { text: string }).text : null;
export const parseRupees = (text: string): number | null => {
  const match = /(\d[\d,]*(?:\.\d+)?)/.exec(text.replace(/₹|rs\.?|inr/gi, ''));
  const n = match ? Number(match[1].replace(/,/g, '')) : NaN;
  return Number.isFinite(n) && n > 0 && n < 1e10 ? n : null;
};

/** Identifiers a person typed into an answer, validated the same way as everything sent to the case network. */
export function entitiesInText(text: string): Entity[] {
  const found: Entity[] = [];
  const add = (kind: EntityKind, raw: string) => {
    const normal = normalizeEntity(kind, raw);
    if (normal && !found.some((f) => f.kind === kind && f.value === raw)) found.push({ kind, value: raw });
  };
  for (const m of text.matchAll(/(?<![a-z0-9._*@•-])[a-z0-9._-]{2,64}@[a-z][a-z0-9]{1,30}\b(?!\.[a-z])/gi)) add('upi', m[0]);
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi)) add('email', m[0]);
  for (const m of text.matchAll(/(?<![\d*•])(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g)) add('phone', m[0]);
  for (const m of text.matchAll(/\b[A-Z]{4}0[A-Z0-9]{6}\b/g)) add('ifsc', m[0]);
  for (const m of text.matchAll(/\b\d{9,18}\b/g)) if (!/^[6-9]\d{9}$/.test(m[0])) add('bank_account', m[0]);
  for (const m of text.matchAll(/\bhttps?:\/\/[^\s)]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|in|net|org|app|xyz|co|io|me|link|site|online|top|club|shop)\b[^\s)]*/gi)) {
    if (!found.some((f) => f.kind === 'email' && f.value.includes(m[0]))) add('url', m[0]);
  }
  return found;
}


/** Dated steps are put in date order among themselves; undated steps keep the place the story gave them. */
export function keepStoryOrder<T extends { at: string | null }>(items: T[]): T[] {
  const slots = items.flatMap((item, index) => (item.at ? [index] : []));
  const dated = slots.map((index) => items[index]).sort((a, b) => a.at!.localeCompare(b.at!));
  slots.forEach((slot, i) => { items[slot] = dated[i]; });
  return items;
}

export type BriefData = {
  category?: CategoryId; loss: number | null; hasMaterial: boolean; timelineDated: boolean; entities: Entity[]; facts: Fact[];
  answers: Map<string, 'ANSWERED' | 'UNKNOWN'>;
};
/** Which floor items the person's material already covers (deterministic). */
export function floorSatisfied(data: BriefData): Record<FloorKey, boolean> {
  const has = (...kinds: EntityKind[]) => data.entities.some((e) => kinds.includes(e.kind));
  // Money questions only make sense for crimes where money moves (a hacked account or harassment may involve none).
  const noMoney = data.category !== undefined && !MONEY_CATEGORIES.has(data.category) && data.loss === null;
  return {
    when: data.timelineDated,
    amount: data.loss !== null || noMoney,
    money_path: noMoney || has('upi', 'bank_account', 'ifsc') || data.facts.some((f) => f.group === 'accounts'),
    contact: has('phone', 'url', 'email', 'social_handle', 'app_name') || data.facts.some((f) => f.group === 'channels'),
    promise: data.facts.some((f) => PROMISE_LABEL.test(f.label) && f.group !== 'money' && f.group !== 'accounts'),
  };
}
export function computeCompleteness(data: BriefData, openLabels: string[]) {
  const sat = floorSatisfied(data);
  let score = 0;
  for (const item of FLOOR) {
    if (sat[item.key] || data.answers.get(item.key) === 'ANSWERED') score += 1;
    else if (data.answers.get(item.key) === 'UNKNOWN') score += 0.5;
  }
  const percent = data.hasMaterial ? Math.round((score / FLOOR.length) * 100) : 0;
  return { percent, missing: openLabels };
}

@Injectable()
export class BriefService {
  constructor(private readonly access: AccessStore) {}

  async victim(caseId: string): Promise<{ name: string; mobile: string | null }> {
    return this.access.available(async (db) => {
      const [row] = await db.select({ name: users.displayName, subject: users.demoSubject }).from(cases)
        .innerJoin(users, eq(users.id, cases.ownerId)).where(eq(cases.id, caseId));
      return { name: row?.name ?? 'Unknown', mobile: row?.subject?.startsWith('intake:') ? row.subject.slice(7) : null };
    });
  }

  async build(caseId: string): Promise<Brief> { return (await this.load(caseId)).brief; }

  /** The brief plus the answer-free data used to decide which floor questions are still needed. */
  async dataFor(caseId: string): Promise<BriefData> { return (await this.load(caseId)).data; }

  private async load(caseId: string): Promise<{ brief: Brief; data: BriefData }> {
    return this.access.available(async (db) => {
      const [c] = await db.select().from(cases).where(eq(cases.id, caseId));
      const [analysis] = await db.select().from(caseAnalyses).where(eq(caseAnalyses.caseId, caseId));
      const files = await db.select().from(evidenceFiles).where(eq(evidenceFiles.caseId, caseId)).orderBy(asc(evidenceFiles.createdAt), asc(evidenceFiles.id));
      const reads = files.length ? await db.select().from(fileReads).where(inArray(fileReads.evidenceFileId, files.map((f) => f.id))) : [];
      const stories = await db.select().from(narratives).where(eq(narratives.caseId, caseId)).orderBy(asc(narratives.createdAt), asc(narratives.id));
      const claimRows = await db.select().from(claims).where(eq(claims.caseId, caseId)).orderBy(asc(claims.createdAt), asc(claims.id));
      const sources = claimRows.length ? await db.select({ claimId: claimSources.claimId, evidenceId: claimSources.evidenceFileId })
        .from(claimSources).where(eq(claimSources.caseId, caseId)) : [];
      const events = await db.select().from(timelineEvents).where(and(eq(timelineEvents.caseId, caseId), eq(timelineEvents.origin, 'AI')))
        .orderBy(asc(timelineEvents.createdAt), asc(timelineEvents.id));
      const qRows = await db.select().from(clarifications).where(and(eq(clarifications.caseId, caseId), inArray(clarifications.origin, ['AI', 'FLOOR'])))
        .orderBy(desc(clarifications.priority), asc(clarifications.createdAt), asc(clarifications.id));

      const origin = (row: typeof claimRows[number]) => (row.normalizedValue as { origin?: string } | null)?.origin;
      const meta = (row: typeof claimRows[number]) => row.normalizedValue as { origin?: string; label?: string; group?: FactGroup; questionId?: string } | null;
      const evidenceOf = (claimId: string) => sources.find((s) => s.claimId === claimId)?.evidenceId;
      const sourceOf = (row: typeof claimRows[number]): SourceType =>
        row.sourceKind === 'OBSERVED_IN_UPLOAD' ? 'FILE' : row.sourceKind === 'VICTIM_RECOLLECTION' ? 'STORY' : 'AI';

      const facts: Fact[] = claimRows.filter((r) => r.type === 'fact' && origin(r) === 'AI').map((r) => ({
        id: r.id, label: meta(r)?.label ?? 'Detail', value: r.rawValue, group: meta(r)?.group ?? 'other',
        source: sourceOf(r), ...(evidenceOf(r.id) ? { evidenceId: evidenceOf(r.id) } : {}),
      }));
      const entityRows = claimRows.filter((r) => CLAIM_TYPE_ENTITY[r.type] && ['AI', 'ANSWER'].includes(origin(r) ?? ''));
      const entities: Entity[] = [];
      for (const r of entityRows) {
        const kind = CLAIM_TYPE_ENTITY[r.type];
        if (!entities.some((e) => e.kind === kind && e.value.toLowerCase() === r.rawValue.toLowerCase())) entities.push({ kind, value: r.rawValue });
      }
      entities.sort((a, b) => a.kind.localeCompare(b.kind) || a.value.localeCompare(b.value));

      const questionStates = new Map<string, 'ANSWERED' | 'UNKNOWN'>();
      const questions: Question[] = [...qRows].sort((a, b) => Number(a.status !== 'OPEN') - Number(b.status !== 'OPEN')).map((q) => {
        const text = answerText(q.answer);
        if (q.status !== 'OPEN') questionStates.set(q.kind, q.status as 'ANSWERED' | 'UNKNOWN');
        return { id: q.id, prompt: q.prompt, why: q.why ?? '', status: q.status, ...(q.status === 'ANSWERED' && text ? { answer: text } : {}),
          ...(q.options?.length ? { options: q.options } : {}) };
      });
      const aiFacts = [...facts];
      // Answers become facts of what the person told us.
      for (const q of qRows) {
        const text = answerText(q.answer);
        if (q.status !== 'ANSWERED' || !text) continue;
        const floor = FLOOR.find((f) => f.key === q.kind);
        facts.push({ id: q.id, label: floor?.label2 ?? q.prompt.slice(0, 80), value: text, group: floor?.group ?? 'other', source: 'STORY' });
      }

      const timeline: TimelineItem[] = events.map((e) => ({
        id: e.id, at: e.occurredAt ? e.occurredAt.toISOString() : null, atLabel: e.atLabel ?? 'Date not stated',
        precision: e.precision as TimelineItem['precision'], title: e.title ?? '', detail: e.detail ?? '',
        kind: e.eventType as TimelineItem['kind'], sources: e.sources ?? [],
      }));
      keepStoryOrder(timeline);

      const aiLoss = analysis?.totalLoss != null ? Number(analysis.totalLoss) : null;
      let loss = aiLoss;
      const amountAnswer = qRows.find((q) => q.kind === 'amount' && q.status === 'ANSWERED');
      if (loss === null && amountAnswer) loss = parseRupees(answerText(amountAnswer.answer) ?? '');
      const hasMaterial = stories.length > 0 || files.length > 0;
      const data: BriefData = {
        category: normalizeCategory(c.category), loss: aiLoss, hasMaterial, timelineDated: timeline.some((t) => t.precision !== 'UNKNOWN'), entities, facts: aiFacts,
        answers: questionStates,
      };
      const openLabels = questions.filter((q) => q.status === 'OPEN').map((q) => {
        const row = qRows.find((r) => r.id === q.id)!;
        return FLOOR.find((f) => f.key === row.kind)?.label ?? q.prompt;
      });
      const category = normalizeCategory(c.category);
      const brief: Brief = {
        caseId, reference: c.reference, status: c.status === 'DRAFT' ? 'DRAFT' : 'SUBMITTED',
        category, categoryLabel: categoryLabel(category), title: c.title, summary: analysis?.summary ?? '',
        totalLoss: loss !== null ? { amount: loss, currency: 'INR' as const } : null,
        completeness: computeCompleteness(data, openLabels), timeline, facts, entities, questions,
        evidence: files.map((f) => {
          const read = reads.find((r) => r.evidenceFileId === f.id);
          const ext = f.mimeType === 'application/pdf' ? 'pdf' : f.mimeType === 'text/plain' ? 'txt' : f.mimeType.includes('wordprocessing') ? 'docx' : f.mimeType.split('/')[1];
          return { id: f.id, name: f.originalName ?? `file-${f.id.slice(0, 8)}.${ext}`, mime: f.mimeType, sizeBytes: f.sizeBytes, sha256: f.sha256,
            kind: f.mimeType.startsWith('image/') ? 'image' as const : 'document' as const,
            readStatus: read ? (read.status as 'READ' | 'FAILED') : 'PENDING' as const, ...(read?.excerpt ? { excerpt: read.excerpt } : {}) };
        }),
        narratives: stories.map((s) => ({ id: s.id, text: s.text, channel: s.channel as 'typed' | 'voice', createdAt: s.createdAt.toISOString() })),
        analysis: { state: (analysis?.state ?? 'IDLE') as Brief['analysis']['state'], updatedAt: analysis?.updatedAt ? analysis.updatedAt.toISOString() : null },
      };
      return { brief, data };
    });
  }
}
