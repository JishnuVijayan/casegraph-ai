import { questions, Support } from '../src/clarifications/rules';
const c = (id: string, type: string, rawValue: string): Support => ({ id, type, rawValue, sourceKind: 'VICTIM_RECOLLECTION' });
test('conflicts require explicitly grouped support and normalize INR and zoned times', () => {
  const support = [c('a', 'payment_amount', 'INR 2500'), c('b', 'payment_amount', 'Rs. 2600'),
    c('c', 'incident_time', '2026-10-29T12:00:00+05:30'), c('d', 'incident_time', '2026-10-29T07:00:00Z')];
  expect(questions([{ id: 'payment', claims: support }]).map((q) => q.kind)).toEqual(['AMOUNT_CONFLICT', 'TIME_CONFLICT', 'MISSING_REFERENCE']);
  expect(questions([{ id: 'one', claims: [support[0]] }, { id: 'two', claims: [support[1]] }]).some((q) => q.kind === 'AMOUNT_CONFLICT')).toBe(false);
  expect(questions([{ id: 'payment', claims: [support[0], c('b', 'payment_amount', 'Rs. 2,500'),
    support[2], c('d', 'incident_time', '2026-10-29T06:30:00Z'), c('e', 'payment_reference', 'synthetic-ref')] }])).toEqual([]);
});
test('ambiguous values do not invent conflicts; fingerprints follow source interpretation', () => {
  const support = [c('a', 'payment_amount', 'blurry'), c('b', 'incident_time', 'yesterday'), c('c', 'incident_time', '2026-10-29T12:00:00'), c('d', 'incident_time', '2026-02-30T12:00:00Z')];
  const first = questions([{ id: 'payment', claims: support }]);
  expect(first.map((q) => q.kind)).toEqual(['MISSING_REFERENCE']);
  expect(questions([{ id: 'payment', claims: [...support].reverse() }])[0].fingerprint).toBe(first[0].fingerprint);
  expect(questions([{ id: 'payment', claims: [...support, c('d', 'statement', 'synthetic correction')] }])[0].fingerprint).not.toBe(first[0].fingerprint);
});
