import { createHash } from 'node:crypto';
import { normalizeClaimValue } from '../claims/normalization';

export type Support = { id: string; type: string; rawValue: string; sourceKind: string };
export type Payment = { id: string; claims: Support[] };
export function questions(events: Payment[]) {
  return events.flatMap((event) => {
    const support = [...event.claims].sort((a, b) => a.id.localeCompare(b.id));
    const context = { eventId: event.id, claims: support };
    const result: { kind: string; prompt: string; priority: number; fingerprint: string; context: typeof context }[] = [];
    const add = (kind: string, prompt: string, priority: number) => result.push({ kind, prompt, priority, context,
      fingerprint: createHash('sha256').update(JSON.stringify({ version: 1, kind, context })).digest('hex') });
    const amounts = support.filter((c) => c.type === 'payment_amount' && Boolean(normalizeClaimValue(c.type,c.rawValue)));
    if (!support.some((c) => c.type === 'payment_reference' && c.rawValue.trim() && !/^(unknown|n\/a)$/i.test(c.rawValue.trim())))
      add('MISSING_REFERENCE', 'Do you remember the reference for this reported payment? You can answer Unknown.', 10);
    const normalized = amounts.map((c) => normalizeClaimValue(c.type, c.rawValue)?.amountMinorUnits).filter(Boolean);
    // Only a deterministically usable amount resolves the missing-amount question.
    if (amounts.length === 0)
      add('MISSING_AMOUNT', 'Do you recall the approximate amount for this payment? You can answer Unknown.', 25);
    if (normalized.length > 1 && new Set(normalized).size > 1)
      add('AMOUNT_CONFLICT', 'The claims linked to this payment show different amounts. Which amount do you recall, or is it unknown?', 30);
    const times = support.filter((c) => c.type === 'incident_time').map((c) => {
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(c.rawValue)) return null;
      const calendar = new Date(c.rawValue.slice(0, 10) + 'T00:00:00Z');
      if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== c.rawValue.slice(0, 10)) return null;
      const timestamp = Date.parse(c.rawValue);
      return Number.isFinite(timestamp) ? timestamp : null;
    }).filter((time) => time !== null);
    if (!support.some((c) => c.type === 'incident_time') || times.length === 0)
      add('MISSING_TIME', 'About when did this payment happen (date or approximate time)? You can answer Unknown.', 15);
    if (new Set(times).size > 1)
      add('TIME_CONFLICT', 'The explicit timestamps linked to this payment disagree. What time do you recall, or is it unknown?', 20);
    return result;
  }).sort((a, b) => b.priority - a.priority || a.fingerprint.localeCompare(b.fingerprint));
}
