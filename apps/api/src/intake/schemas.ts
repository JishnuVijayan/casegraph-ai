import { CATEGORY_IDS, CategoryId, ENTITY_KINDS, EntityKind, FACT_GROUPS, FactGroup, PRECISIONS, Precision, SourceType, TIMELINE_KINDS, TimelineKind, isCategoryId } from './types';
import { normalizeEntity } from '../investigations/entities';

/** Manual schema validation of model output. Anything outside the shape throws; nothing is repaired silently. */
export class SchemaError extends Error {}

const fail = (path: string): never => { throw new SchemaError(`invalid:${path}`); };
const obj = (value: unknown, path: string): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail(path);
const arr = (value: unknown, path: string, max: number): unknown[] =>
  Array.isArray(value) && value.length <= max ? value : fail(path);
export function str(value: unknown, path: string, max: number, min = 1): string {
  if (typeof value !== 'string') return fail(path);
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim();
  return text.length >= min && text.length <= max ? text : fail(path);
}
const optStr = (value: unknown, path: string, max: number): string | undefined =>
  value === undefined || value === null || value === '' ? undefined : str(value, path, max);
const oneOf = <T extends string>(value: unknown, allowed: readonly T[], path: string): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? value as T : fail(path);

export type FileReadResult = {
  documentType: string; transcript: string;
  entities: { kind: EntityKind; value: string }[];
  amounts: { amount: number; label: string }[];
  events: { when: string | null; title: string; detail: string }[];
};
export function validateFileRead(input: unknown): FileReadResult {
  const root = obj(input, 'root');
  const entities = arr(root.entities ?? [], 'entities', 60).flatMap((item, i) => {
    const e = obj(item, `entities.${i}`);
    const kind = typeof e.kind === 'string' && (ENTITY_KINDS as readonly string[]).includes(e.kind) ? e.kind as EntityKind : null;
    const value = typeof e.value === 'string' ? e.value.trim().slice(0, 300) : '';
    return kind && value ? [{ kind, value }] : [];
  });
  const amounts = arr(root.amounts ?? [], 'amounts', 60).flatMap((item, i) => {
    const a = obj(item, `amounts.${i}`);
    const amount = Number(a.amount);
    return Number.isFinite(amount) && amount > 0 && amount < 1e10 ? [{ amount, label: optStr(a.label, 'label', 120) ?? 'Amount' }] : [];
  });
  const events = arr(root.events ?? [], 'events', 60).map((item, i) => {
    const e = obj(item, `events.${i}`);
    return { when: optStr(e.when, 'when', 80) ?? null, title: str(e.title, 'title', 140), detail: optStr(e.detail, 'detail', 500) ?? '' };
  });
  return {
    documentType: optStr(root.documentType, 'documentType', 80) ?? 'unknown',
    transcript: str(root.transcript ?? '', 'transcript', 12000, 0), entities, amounts, events,
  };
}

export type AnalysisFact = { label: string; value: string; group: FactGroup; source: SourceType; evidenceId?: string };
export type AnalysisTimeline = {
  at: string | null; atLabel: string; precision: Precision; title: string; detail: string; kind: TimelineKind;
  sources: { type: SourceType; evidenceId?: string; label: string }[];
};
export type AnalysisQuestion = { prompt: string; why: string; options?: string[] };
export type AnalysisResult = {
  category: CategoryId; title: string; summary: string; totalLoss: number | null;
  facts: AnalysisFact[]; entities: { kind: EntityKind; value: string; evidenceId?: string }[];
  timeline: AnalysisTimeline[]; missing: string[]; questions: AnalysisQuestion[];
};
const SOURCE_TYPES = ['FILE', 'STORY', 'AI'] as const;

export function parseTimeline(value: unknown): AnalysisTimeline[] {
  return arr(value ?? [], 'timeline', 60).map((item, i) => {
    const t = obj(item, `timeline.${i}`);
    const sources = arr(t.sources ?? [], 'sources', 10).flatMap((s) => {
      const src = obj(s, 'source');
      return [{ type: (SOURCE_TYPES as readonly string[]).includes(String(src.type)) ? src.type as SourceType : 'AI',
        evidenceId: optStr(src.evidenceId, 'evidenceId', 64), label: optStr(src.label, 'label', 120) ?? '' }];
    });
    return {
      at: optStr(t.at, 'at', 40) ?? null, atLabel: optStr(t.atLabel, 'atLabel', 80) ?? 'Date not stated',
      precision: (PRECISIONS as readonly string[]).includes(String(t.precision)) ? t.precision as Precision : 'UNKNOWN',
      title: str(t.title, 'title', 140), detail: optStr(t.detail, 'detail', 600) ?? '',
      kind: (TIMELINE_KINDS as readonly string[]).includes(String(t.kind)) ? t.kind as TimelineKind : 'other', sources,
    };
  });
}

export function validateTimeline(input: unknown): AnalysisTimeline[] { return parseTimeline(obj(input, 'root').timeline); }

export function validateAnalysis(input: unknown): AnalysisResult {
  const root = obj(input, 'root');
  const category = isCategoryId(root.category) ? root.category : 'other';
  const lossRaw = root.totalLoss;
  let totalLoss: number | null = null;
  if (lossRaw !== null && lossRaw !== undefined) {
    const n = typeof lossRaw === 'object' ? Number((lossRaw as { amount?: unknown }).amount) : Number(lossRaw);
    if (Number.isFinite(n) && n >= 0 && n < 1e10) totalLoss = n === 0 ? null : n;
  }
  const facts = arr(root.facts ?? [], 'facts', 80).flatMap((item, i) => {
    const f = obj(item, `facts.${i}`);
    if (typeof f.label !== 'string' || typeof f.value !== 'string' || !f.label.trim() || !f.value.trim()) return [];
    return [{
      label: f.label.trim().slice(0, 80), value: f.value.trim().slice(0, 500),
      group: (FACT_GROUPS as readonly string[]).includes(String(f.group)) ? f.group as FactGroup : 'other',
      source: (SOURCE_TYPES as readonly string[]).includes(String(f.source)) ? f.source as SourceType : 'AI',
      evidenceId: optStr(f.evidenceId, 'evidenceId', 64),
    }];
  });
  const entities = arr(root.entities ?? [], 'entities', 80).flatMap((item, i) => {
    const e = obj(item, `entities.${i}`);
    const kind = typeof e.kind === 'string' && (ENTITY_KINDS as readonly string[]).includes(e.kind) ? e.kind as EntityKind : null;
    const value = typeof e.value === 'string' ? e.value.trim().slice(0, 300) : '';
    return kind && value ? [{ kind, value, evidenceId: optStr(e.evidenceId, 'evidenceId', 64) }] : [];
  });
  const timeline = parseTimeline(root.timeline);
  const missing = arr(root.missing ?? [], 'missing', 20).flatMap((m) => typeof m === 'string' && m.trim() ? [m.trim().slice(0, 160)] : []);
  const questions = arr(root.questions ?? [], 'questions', 20).flatMap((item, i) => {
    const q = obj(item, `questions.${i}`);
    if (typeof q.prompt !== 'string' || !q.prompt.trim()) return [];
    const options = Array.isArray(q.options) ? q.options.flatMap((o) => typeof o === 'string' && o.trim() ? [o.trim().slice(0, 60)] : []).slice(0, 6) : [];
    return [{ prompt: q.prompt.trim().slice(0, 240), why: optStr(q.why, 'why', 240) ?? 'This helps the officer understand what happened.',
      ...(options.length ? { options } : {}) }];
  });
  return {
    category, title: str(root.title, 'title', 120), summary: str(root.summary, 'summary', 2500), totalLoss,
    facts, entities, timeline, missing, questions,
  };
}


/* ---------- exact values read straight from the material (never paraphrased) ---------- */

export type FoundValue = { label: string; value: string };
const REFERENCE_LABEL = /\b(UPI\s+(?:transaction\s+|ref(?:erence)?\s+)?(?:ID|no\.?|number)|UTR(?:\s*(?:no\.?|number|ID))?|RRN|Google\s+transaction\s+ID|Transaction\s+(?:ID|no\.?|number)|Txn\s*(?:ID|no\.?)|Order\s+(?:ID|no\.?|number)|Reference\s+(?:ID|no\.?|number)|Ref(?:erence)?\.?\s*(?:ID|no\.?|number))\s*[:#.-]?\s*([A-Za-z0-9][A-Za-z0-9_-]{5,39})\b/gi;

/** Payment reference numbers (UPI transaction ID, UTR, ...) exactly as printed, with the label as printed. */
export function referencesInText(text: string): FoundValue[] {
  const found: FoundValue[] = [];
  for (const m of text.matchAll(REFERENCE_LABEL)) {
    const value = m[2];
    if (!/\d/.test(value) || found.some((f) => f.value === value)) continue;
    found.push({ label: m[1].replace(/\s+/g, ' ').replace(/^./, (c) => c.toUpperCase()), value });
  }
  return found;
}

export type PartialId = { value: string; side: 'to' | 'from' | null };
/** Same as partialIdsInText, plus whether the screenshot printed it on the receiving ("To") or the paying ("From") side. */
export function partialIdsWithSide(text: string): PartialId[] {
  return partialIdsInText(text).map((value) => {
    const at = text.indexOf(value);
    const before = at > 0 ? text.slice(Math.max(0, at - 60), at) : '';
    const m = /(?:^|[^A-Za-z])(to|from)\s*:?\s*[^*•@:]{0,45}$/i.exec(before);
    return { value, side: m ? (m[1].toLowerCase() as 'to' | 'from') : null };
  });
}

/** Identifiers the source itself shows partly hidden (e.g. ******8466@apl, 98****5678): kept exactly as written, never used to match cases. */
export function partialIdsInText(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z0-9._-]*[*•]{2,}[A-Za-z0-9._-]*@[A-Za-z][A-Za-z0-9.]{1,30}/g)) out.add(m[0]);
  for (const m of text.matchAll(/(?<![\w*•])\+?[\d][\d ]{0,6}[*•]{3,}[\d ]{0,2}\d{2,6}(?!\d)/g)) out.add(m[0].trim());
  for (const m of text.matchAll(/(?<![\w*•])[*•]{3,}\d{2,6}(?![\d@])/g)) out.add(m[0]);
  const all = [...out];
  return all.filter((v) => !all.some((o) => o !== v && o.includes(v))).slice(0, 12); // drop fragments of a longer match
}

/** True when `text` contains a number or ID (4+ digits) that appears nowhere in the person's material. */
export function hasUnsupportedNumber(text: string, sourceText: string): boolean {
  const digits = sourceText.replace(/\D/g, '');
  const squash = sourceText.toLowerCase().replace(/[\s,\-_.()]/g, '');
  for (const token of text.match(/[A-Za-z0-9][A-Za-z0-9,._-]*\d[A-Za-z0-9,._@-]*/g) ?? []) {
    const d = token.replace(/\D/g, '');
    if (d.length < 4) continue;
    if (!digits.includes(d) && !squash.includes(token.toLowerCase().replace(/[\s,\-_.()]/g, ''))) return true;
  }
  return false;
}

/* ---------- grounding: never keep a value the person's own material does not contain ---------- */

const digitsOf = (s: string) => s.replace(/\D/g, '');
const squash = (s: string) => s.toLowerCase().replace(/[\s\-_.()]/g, '');

/** Keeps only identifiers that actually occur in the source text, normalised and de-duplicated. */
export function groundEntities<T extends { kind: EntityKind; value: string }>(items: T[], sourceText: string): T[] {
  const haystack = squash(sourceText), digits = digitsOf(sourceText);
  const seen = new Set<string>();
  const hidden = partialIdsInText(sourceText).map((p) => p.toLowerCase());
  return items.filter((item) => {
    const normal = normalizeEntity(item.kind, item.value);
    if (!normal || seen.has(normal.id)) return false;
    // The tail of a partly hidden ID (e.g. 8466@apl from ******8466@apl) is not the whole ID, so it must not match anyone.
    const needle = item.value.trim().toLowerCase();
    if (needle.length > 1 && hidden.some((h) => h !== needle && h.includes(needle))) return false;
    const present = item.kind === 'phone' || item.kind === 'bank_account'
      ? digits.includes(digitsOf(item.value).slice(-Math.min(10, digitsOf(item.value).length)))
      : haystack.includes(squash(item.value)) || haystack.includes(squash(normal.value));
    if (!present) return false;
    seen.add(normal.id);
    return true;
  });
}

/** A loss figure is kept only when it appears in the material, or is spoken in words (e.g. "50 thousand"). */
export function groundAmount(amount: number | null, sourceText: string, moneyFacts: string[] = []): number | null {
  if (amount === null) return null;
  const numbers = new Set<number>();
  for (const m of sourceText.matchAll(/\d[\d,]*(?:\.\d+)?/g)) numbers.add(Number(m[0].replace(/,/g, '')));
  let total = 0;
  for (const f of moneyFacts) for (const m of f.matchAll(/\d[\d,]*(?:\.\d+)?/g)) total += Number(m[0].replace(/,/g, ''));
  if (numbers.has(amount) || (total > 0 && Math.abs(total - amount) < 0.5)) return amount;
  if (/\b(thousand|lakh|lac|crore|hundred|million|k)\b/i.test(sourceText) && numbers.size) return amount;
  return null;
}

export const CATEGORY_LIST_FOR_PROMPT = CATEGORY_IDS.join(', ');
