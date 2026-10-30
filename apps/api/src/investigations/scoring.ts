import { categoryLabel as labelOf, EntityKind, normalizeCategory, SharedEntity } from '../intake/types';
import { strengthOf } from './entities';

const KIND_WORDS: Record<EntityKind, string> = {
  phone: 'phone number', upi: 'UPI ID', bank_account: 'bank account', url: 'website', email: 'email address',
  person_name: 'name', app_name: 'app', ifsc: 'bank branch code', social_handle: 'social media handle',
};
export const categoryLabel = (id: string) => labelOf(normalizeCategory(id));

/** Deterministic 0-100 score. Strong entities dominate; weak ones and category only support. */
export function scoreMatch(shared: Pick<SharedEntity, 'strength'>[], categoryMatch: boolean): number {
  const strong = shared.filter((s) => s.strength === 'STRONG').length;
  const weak = shared.length - strong;
  if (!shared.length) return 0;
  let score = strong ? 50 + Math.min(strong - 1, 3) * 12 : 0;
  score += Math.min(weak, 2) * (strong ? 6 : 12);
  if (categoryMatch) score += 10;
  return Math.max(5, Math.min(100, score));
}

export function reasonFor(shared: SharedEntity[], categoryMatch: boolean, category: string): string {
  const kinds = [...new Set(shared.map((s) => KIND_WORDS[s.kind]))];
  const list = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds[kinds.length - 1]}` : kinds[0] ?? 'details';
  const strong = shared.some((s) => s.strength === 'STRONG');
  const lead = strong ? `Shares the same ${list}` : `Mentions the same ${list} (common detail, weak match)`;
  return categoryMatch ? `${lead}; also reported as ${categoryLabel(category)}.` : `${lead}.`;
}

export type GraphRow = {
  case_id: string; category?: string; reference?: string; submitted_at?: string; loss_amount?: number;
  '@strong'?: number; '@weak'?: number; '@category_match'?: number; '@shared'?: string[];
};
export type MatchedRow = { caseId: string; category: string; shared: SharedEntity[]; categoryMatch: boolean; score: number; reason: string };

/** Turn one `similar_cases` result row into a ranked match. Throws on malformed rows (never guesses). */
export function parseGraphRow(row: GraphRow): MatchedRow {
  const attrs = (row as { attributes?: GraphRow }).attributes ?? row;
  const caseId = (row as { v_id?: string }).v_id ?? attrs.case_id;
  if (typeof caseId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(caseId)) throw new Error('Bad case id');
  const shared: SharedEntity[] = [];
  for (const item of attrs['@shared'] ?? []) {
    const index = item.indexOf('|');
    const kind = item.slice(0, index) as EntityKind;
    if (index < 1 || !KIND_WORDS[kind]) throw new Error('Bad entity');
    shared.push({ kind, value: item.slice(index + 1), strength: strengthOf(kind) });
  }
  shared.sort((a, b) => (a.strength === b.strength ? a.kind.localeCompare(b.kind) : a.strength === 'STRONG' ? -1 : 1));
  const categoryMatch = (attrs['@category_match'] ?? 0) > 0;
  const category = String(attrs.category ?? 'other');
  return { caseId, category, shared, categoryMatch, score: scoreMatch(shared, categoryMatch), reason: reasonFor(shared, categoryMatch, category) };
}
