/** Shapes of the v2 contract (docs/V2_CONTRACT.md). */
export const CATEGORIES = {
  upi_payment_fraud: 'UPI / payment fraud',
  investment_scam: 'Investment / trading scam',
  job_or_task_scam: 'Job / task scam',
  loan_app_harassment: 'Loan app / harassment',
  phishing_or_kyc: 'Phishing / fake KYC / fake bank call',
  sextortion_blackmail: 'Sextortion / blackmail',
  romance_scam: 'Romance / friendship scam',
  account_hacking: 'Account hacking / takeover',
  online_shopping: 'Online shopping fraud',
  impersonation: 'Impersonation (police, courier, official)',
  online_harassment: 'Harassment, stalking or threats',
  identity_theft: 'Identity theft / data misuse',
  malware_or_ransomware: 'Virus, ransomware or hacked device',
  fake_profile: 'Fake profile or false posts',
  other: 'Another cyber crime',
} as const;
export type CategoryId = keyof typeof CATEGORIES;
export const CATEGORY_IDS = Object.keys(CATEGORIES) as CategoryId[];
/** Crimes where money may move ("other" is included because it means the AI was unsure). The rest are not asked about amounts or payment routes. */
export const MONEY_CATEGORIES = new Set<CategoryId>(['upi_payment_fraud', 'investment_scam', 'job_or_task_scam', 'loan_app_harassment',
  'phishing_or_kyc', 'romance_scam', 'online_shopping', 'impersonation', 'sextortion_blackmail', 'other']);

/** Complaints created before the v2 categories used these ids. */
const LEGACY_CATEGORIES: Record<string, CategoryId> = {
  investment: 'investment_scam', friendship: 'romance_scam', payment: 'upi_payment_fraud',
};
export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(CATEGORIES, value);
}
export function normalizeCategory(value: string | null | undefined): CategoryId {
  if (isCategoryId(value)) return value;
  return (value && LEGACY_CATEGORIES[value]) || 'other';
}
export const categoryLabel = (id: CategoryId) => CATEGORIES[id];

export const ENTITY_KINDS = ['phone', 'upi', 'bank_account', 'url', 'email', 'person_name', 'app_name', 'ifsc', 'social_handle'] as const;
export type EntityKind = typeof ENTITY_KINDS[number];
/** Claim `type` stored in the claims table for each entity kind. */
export const ENTITY_CLAIM_TYPE: Record<EntityKind, string> = {
  phone: 'phone', upi: 'upi_id', bank_account: 'bank_account', url: 'url', email: 'email',
  person_name: 'person_name', app_name: 'app_name', ifsc: 'ifsc', social_handle: 'social_handle',
};
export const CLAIM_TYPE_ENTITY: Record<string, EntityKind> = Object.fromEntries(
  Object.entries(ENTITY_CLAIM_TYPE).map(([kind, type]) => [type, kind as EntityKind]));

export const FACT_GROUPS = ['money', 'people', 'channels', 'accounts', 'time', 'other'] as const;
export type FactGroup = typeof FACT_GROUPS[number];
export type SourceType = 'FILE' | 'STORY' | 'AI';
export const PRECISIONS = ['EXACT', 'APPROXIMATE', 'DATE_ONLY', 'UNKNOWN'] as const;
export type Precision = typeof PRECISIONS[number];
export const TIMELINE_KINDS = ['contact', 'payment', 'account_action', 'other'] as const;
export type TimelineKind = typeof TIMELINE_KINDS[number];

export type CaseStatus = 'DRAFT' | 'SUBMITTED';
export type TimelineItem = {
  id: string; at: string | null; atLabel: string; precision: Precision; title: string; detail: string; kind: TimelineKind;
  sources: { type: SourceType; evidenceId?: string; label: string }[];
};
export type Fact = { id: string; label: string; value: string; group: FactGroup; source: SourceType; evidenceId?: string };
export type Entity = { kind: EntityKind; value: string };
export type Question = { id: string; prompt: string; why: string; status: 'OPEN' | 'ANSWERED' | 'UNKNOWN'; answer?: string; options?: string[] };
export type EvidenceItem = {
  id: string; name: string; mime: string; sizeBytes: number; sha256: string;
  kind: 'image' | 'document'; readStatus: 'PENDING' | 'READ' | 'FAILED'; excerpt?: string;
};
export type Narrative = { id: string; text: string; channel: 'typed' | 'voice'; createdAt: string };
export type Brief = {
  caseId: string; reference: string; status: CaseStatus; category: CategoryId; categoryLabel: string;
  title: string; summary: string; totalLoss: { amount: number; currency: 'INR' } | null;
  completeness: { percent: number; missing: string[] };
  timeline: TimelineItem[]; facts: Fact[]; entities: Entity[]; questions: Question[];
  evidence: EvidenceItem[]; narratives: Narrative[];
  analysis: { state: 'IDLE' | 'RUNNING' | 'READY' | 'FAILED'; updatedAt: string | null };
};
export type SimilarStatus = 'READY' | 'UNAVAILABLE' | 'NONE';
export type SharedEntity = { kind: EntityKind; value: string; strength: 'STRONG' | 'WEAK' };
export type SimilarCase = {
  caseId: string; reference: string; category: CategoryId; categoryLabel: string; title: string; summary: string;
  loss: { amount: number; currency: 'INR' } | null; submittedAt: string; score: number; shared: SharedEntity[]; reason: string;
};
export type Victim = { name: string; mobile: string | null };
