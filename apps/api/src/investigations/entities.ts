import { EntityKind } from '../intake/types';

export const ENTITY_KINDS: readonly EntityKind[] = ['phone', 'upi', 'bank_account', 'url', 'email', 'person_name', 'app_name', 'ifsc', 'social_handle'];
export const STRONG_KINDS: readonly EntityKind[] = ['phone', 'upi', 'bank_account', 'url', 'email', 'social_handle', 'ifsc'];
export const WEAK_KINDS: readonly EntityKind[] = ['app_name', 'person_name'];
/** Postgres claim `type` values that carry an entity, mapped to the graph kind. */
export const CLAIM_TYPE_TO_KIND: Record<string, EntityKind> = {
  phone: 'phone', upi_id: 'upi', upi: 'upi', bank_account: 'bank_account', url: 'url', email: 'email',
  person_name: 'person_name', app_name: 'app_name', ifsc: 'ifsc', social_handle: 'social_handle',
};
export const ENTITY_CLAIM_TYPES = [...Object.keys(CLAIM_TYPE_TO_KIND), 'contact_identifier'];
export const strengthOf = (kind: EntityKind): 'STRONG' | 'WEAK' => (WEAK_KINDS.includes(kind) ? 'WEAK' : 'STRONG');

/** Very common public sites would link unrelated people; they never identify a scammer. */
const COMMON_HOSTS = new Set(['google.com', 'youtube.com', 'facebook.com', 'instagram.com', 'whatsapp.com', 'wa.me', 'play.google.com',
  'x.com', 'twitter.com', 'linkedin.com', 'cybercrime.gov.in', 'npci.org.in', 'rbi.org.in', 'amazon.in', 'amazon.com', 'flipkart.com', 'paytm.com', 'phonepe.com']);

export type NormalizedEntity = { kind: EntityKind; value: string; id: string };

export function normalizeEntity(kind: EntityKind, raw: string): NormalizedEntity | null {
  const text = String(raw ?? '').trim();
  if (!text || text.length > 300) return null;
  if (/[*•]/.test(text) || /x{4,}/i.test(text)) return null; // masked in the source (e.g. ****1234), so it identifies nobody
  let value: string | null = null;
  switch (kind) {
    case 'phone': {
      const digits = text.replace(/\D/g, '');
      value = digits.length >= 10 && digits.length <= 14 ? digits.slice(-10) : null;
      if (value && !/^[6-9]/.test(value) && digits.length === 10) value = null; // Indian mobiles start 6-9
      break;
    }
    case 'upi': {
      const v = text.toLowerCase().replace(/\s+/g, '');
      value = /^[a-z0-9._-]{2,64}@[a-z][a-z0-9.]{1,30}$/.test(v) ? v : null;
      break;
    }
    case 'bank_account': {
      const digits = text.replace(/[\s-]/g, '');
      value = /^\d{9,18}$/.test(digits) ? digits : null;
      break;
    }
    case 'url': {
      try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        value = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && !COMMON_HOSTS.has(host) ? host : null;
      } catch { value = null; }
      break;
    }
    case 'email': {
      const v = text.toLowerCase();
      value = /^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : null;
      break;
    }
    case 'ifsc': {
      const v = text.toUpperCase().replace(/\s+/g, '');
      value = /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? v : null;
      break;
    }
    case 'social_handle': {
      const v = text.toLowerCase().replace(/^https?:\/\/(www\.)?(t\.me|instagram\.com|facebook\.com|x\.com|twitter\.com)\//, '').replace(/^@+/, '').replace(/[/?#].*$/, '');
      value = /^[a-z0-9._]{3,40}$/.test(v) ? `@${v}` : null;
      break;
    }
    case 'person_name': {
      const v = text.toLowerCase().replace(/^(mr|mrs|ms|dr|shri|smt)\.?\s+/, '').replace(/[^a-z\s.'-]/g, '').replace(/\s+/g, ' ').trim();
      value = v.length >= 3 ? v : null;
      break;
    }
    case 'app_name': {
      const v = text.toLowerCase().replace(/\s+/g, ' ').trim();
      // Everyday payment apps are on almost every case, so they say nothing about who the other party is.
      value = v.length >= 2 && !/^(google ?pay|gpay|phone ?pe|paytm|amazon ?pay|bhim|bhim upi|cred|upi)$/.test(v) ? v : null;
      break;
    }
  }
  return value ? { kind, value, id: `${kind}:${value}` } : null;
}

/** Guess the kind of a free-form `contact_identifier` claim. */
export function guessKind(raw: string): EntityKind | null {
  const text = raw.trim();
  if (/^[^\s@]+@[a-z][a-z0-9.]*$/i.test(text) && !text.includes('.', text.indexOf('@'))) return 'upi';
  if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(text)) return 'email';
  if (/^\+?[\d\s-]{10,16}$/.test(text)) return 'phone';
  if (/^@[a-z0-9._]{3,}$/i.test(text) || /(t\.me|instagram\.com)\//i.test(text)) return 'social_handle';
  if (/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(text)) return 'url';
  return null;
}

export function entitiesFromClaims(rows: { type: string; rawValue: string }[]): NormalizedEntity[] {
  const seen = new Map<string, NormalizedEntity>();
  for (const row of rows) {
    const kind = CLAIM_TYPE_TO_KIND[row.type] ?? (row.type === 'contact_identifier' ? guessKind(row.rawValue) : null);
    if (!kind) continue;
    const entity = normalizeEntity(kind, row.rawValue);
    if (entity && !seen.has(entity.id)) seen.set(entity.id, entity);
  }
  return [...seen.values()];
}

export function maskMobile(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length < 6) return '******';
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(2, digits.length - 6))}${digits.slice(-4)}`;
}
