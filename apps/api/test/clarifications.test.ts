import { questions, Support } from '../src/clarifications/rules';
import { polishQuestions } from '../src/clarifications/bedrock';
const c = (id: string, type: string, rawValue: string): Support => ({ id, type, rawValue, sourceKind: 'VICTIM_RECOLLECTION' });
test('conflicts require explicitly grouped support and normalize INR and zoned times', () => {
  const support = [c('a', 'payment_amount', 'INR 2500'), c('b', 'payment_amount', 'Rs. 2600'),
    c('c', 'incident_time', '2026-10-29T12:00:00+05:30'), c('d', 'incident_time', '2026-10-29T07:00:00Z')];
  expect(questions([{ id: 'payment', claims: support }]).map((q) => q.kind)).toEqual(['AMOUNT_CONFLICT', 'TIME_CONFLICT', 'MISSING_REFERENCE']);
  expect(questions([{ id: 'one', claims: [support[0]] }, { id: 'two', claims: [support[1]] }]).some((q) => q.kind === 'AMOUNT_CONFLICT')).toBe(false);
  expect(questions([{ id: 'payment', claims: [support[0], c('b', 'payment_amount', 'Rs. 2,500'),
    support[2], c('d', 'incident_time', '2026-10-29T06:30:00Z'), c('e', 'payment_reference', 'synthetic-ref')] }])).toEqual([]);
});
test('ambiguous values do not invent conflicts; essentials gaps stay rule-gated', () => {
  // Non-empty amount text (even unnormalized OCR) suppresses MISSING_AMOUNT; bad times still ask.
  const support = [c('a', 'payment_amount', 'blurry'), c('b', 'incident_time', 'yesterday'), c('c', 'incident_time', '2026-10-29T12:00:00'), c('d', 'incident_time', '2026-02-30T12:00:00Z')];
  const first = questions([{ id: 'payment', claims: support }]);
  expect(first.map((q) => q.kind)).toEqual(['MISSING_TIME', 'MISSING_REFERENCE']);
  expect(questions([{ id: 'payment', claims: [...support].reverse() }])[0].fingerprint).toBe(first[0].fingerprint);
  expect(questions([{ id: 'payment', claims: [...support, c('d', 'statement', 'synthetic correction')] }])[0].fingerprint).not.toBe(first[0].fingerprint);
  expect(questions([{ id: 'payment', claims: [c('b', 'incident_time', 'yesterday')] }]).map((q) => q.kind))
    .toEqual(['MISSING_AMOUNT', 'MISSING_TIME', 'MISSING_REFERENCE']);
});
test('Bedrock polish only rewrites prompt text and never invents kinds', async () => {
  process.env.BEDROCK_ENABLED = 'true';
  const base = questions([{ id: 'payment', claims: [c('a', 'payment_amount', 'INR 100')] }]);
  const polished = await polishQuestions({
    invoke: async () => '{"prompt":"What UTR or reference do you remember for this payment?"}',
  }, base);
  expect(polished[0].kind).toBe(base[0].kind);
  expect(polished[0].fingerprint).toBe(base[0].fingerprint);
  expect(polished[0].prompt).toContain('UTR');
  const rejected = await polishQuestions({
    invoke: async () => '{"prompt":"Bank verified UTR is confirmed."}',
  }, base);
  expect(rejected[0].prompt).toBe(base[0].prompt);
  delete process.env.BEDROCK_ENABLED;
});
