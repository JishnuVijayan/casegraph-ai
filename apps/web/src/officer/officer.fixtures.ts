import type { Brief, OfficerCaseFile, OfficerCaseRow, SimilarCase } from '../types.v2';

export const brief = (over: Partial<Brief> = {}): Brief => ({
  caseId: 'c1', reference: 'CG-2026-000101', status: 'SUBMITTED', category: 'upi_payment_fraud', categoryLabel: 'UPI / payment fraud',
  title: 'Paid ₹48,000 to a fake courier agent', summary: 'The complainant paid a "customs fee" to 9876500011.', totalLoss: { amount: 48000, currency: 'INR' },
  completeness: { percent: 80, missing: ['Bank name'] },
  timeline: [{ id: 't1', at: '2026-10-01T10:00:00Z', atLabel: '1 Oct, 3:30 pm', precision: 'EXACT', title: 'Call received', detail: 'Caller said parcel was held.', kind: 'contact', sources: [{ type: 'STORY', label: 'Story' }] }],
  facts: [{ id: 'f1', label: 'Amount', value: '₹48,000', group: 'money', source: 'FILE', evidenceId: 'e1' }],
  entities: [{ kind: 'phone', value: '9876500011' }, { kind: 'upi', value: 'fastship@okaxis' }],
  questions: [{ id: 'q1', prompt: 'Which bank did you pay from?', why: 'Needed to trace the transfer', status: 'UNKNOWN' }, { id: 'q2', prompt: 'When did it happen?', why: 'Dates', status: 'ANSWERED', answer: 'On 1 October' }],
  evidence: [{ id: 'e1', name: 'payment.png', mime: 'image/png', sizeBytes: 2048, sha256: 'a'.repeat(64), kind: 'image', readStatus: 'READ', excerpt: 'Paid to fastship@okaxis' }],
  narratives: [], analysis: { state: 'READY', updatedAt: '2026-10-02T10:00:00Z' }, ...over,
});

export const similarCase = (over: Partial<SimilarCase> = {}): SimilarCase => ({
  caseId: 'c2', reference: 'CG-2026-000090', category: 'upi_payment_fraud', categoryLabel: 'UPI / payment fraud', title: 'Courier fee paid by UPI',
  summary: 'Same caller 9876500011.', loss: { amount: 15000, currency: 'INR' }, submittedAt: '2026-09-20T08:00:00Z', score: 86,
  shared: [{ kind: 'phone', value: '9876500011', strength: 'STRONG' }, { kind: 'url', value: 'fastship-track.in', strength: 'WEAK' }],
  reason: 'Also reported paying a courier fee to the same phone number.', ...over,
});

export const caseFile = (over: Partial<OfficerCaseFile> = {}): OfficerCaseFile => ({
  brief: brief(), victim: { name: 'Asha Menon', mobile: '9000012345' }, similar: { status: 'READY', cases: [similarCase()] }, ...over,
});

export const row = (over: Partial<OfficerCaseRow>): OfficerCaseRow => ({
  id: 'c1', reference: 'CG-2026-000101', title: 'Paid fake courier', category: 'upi_payment_fraud', categoryLabel: 'UPI / payment fraud',
  victimName: 'Asha Menon', victimMobileMasked: 'XXXXXX2345', loss: { amount: 48000, currency: 'INR' }, submittedAt: new Date().toISOString(),
  similarCount: 1, completenessPercent: 80, ...over,
});
