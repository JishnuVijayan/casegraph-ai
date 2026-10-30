import { parsePrepareHints } from '../src/cases/prepare-parse';
import { questions } from '../src/clarifications/rules';

describe('parsePrepareHints', () => {
  it('extracts amount, UPI reference, and ISO incident time from OCR-like text', () => {
    const hints = parsePrepareHints(
      'Paid INR 2,500 via UPI/ABCD1234EFGH on 2026-10-28T14:30:00Z',
    );
    expect(hints.amounts[0]).toMatch(/INR\s*2,?500/i);
    expect(hints.references.some((ref) => /UPI\/ABCD1234EFGH/i.test(ref) || /ABCD1234EFGH/i.test(ref))).toBe(true);
    expect(hints.incidentTimes[0]).toBe('2026-10-28T14:30:00.000Z');
  });

  it('accepts slash dates and txn refs without inventing bank verification', () => {
    const hints = parsePrepareHints('Txn ID: XY987654  paid on 28/10/2026');
    expect(hints.references).toContain('XY987654');
    expect(hints.incidentTimes[0]).toBe('2026-10-28T00:00:00.000Z');
  });

  it('reads typical UPI success-screenshot OCR (amount, txn id, day-month time)', () => {
    const ocr = [
      'Payment successful',
      '₹1,200.00',
      'Paid to Merchant Name',
      '28 Oct 2026, 3:42 pm',
      'UPI transaction ID',
      '412345678901',
    ].join('\n');
    const hints = parsePrepareHints(ocr);
    expect(hints.amounts[0]).toBe('INR 1200.00');
    expect(hints.references).toContain('412345678901');
    expect(hints.incidentTimes[0]).toBe('2026-10-28T15:42:00.000Z');

    const open = questions([{
      id: 'payment-1',
      claims: [
        { id: 'a', type: 'payment_amount', rawValue: hints.amounts[0], sourceKind: 'VICTIM_RECOLLECTION' },
        { id: 'r', type: 'payment_reference', rawValue: hints.references[0], sourceKind: 'VICTIM_RECOLLECTION' },
        { id: 't', type: 'incident_time', rawValue: hints.incidentTimes[0], sourceKind: 'VICTIM_RECOLLECTION' },
      ],
    }]);
    expect(open).toEqual([]);
  });

  it('reads PhonePe-style labels and 12-hour clock next to the date', () => {
    const hints = parsePrepareHints(
      'Paid Rs. 500 Transaction ID 998877665544 on Oct 28, 2026 10:05 AM',
    );
    expect(hints.amounts[0]).toMatch(/INR 500/);
    expect(hints.references).toContain('998877665544');
    expect(hints.incidentTimes[0]).toBe('2026-10-28T10:05:00.000Z');
  });
});
