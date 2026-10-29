import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReviewPanel } from './ReviewPanel';

const ok = (data: unknown) => ({ ok: true, json: async () => ({ data }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('shows source observation separately from corrected interpretation and keeps history visible', async () => {
  const claim = { id: 'synthetic-claim', type: 'payment_amount', rawValue: 'INR 2600',
    normalizedValue: { currency: 'INR', amountMinorUnits: '260000' }, sourceKind: 'OBSERVED_IN_UPLOAD',
    verificationStatus: 'UNVERIFIED', sources: [{ evidenceId: 'synthetic-evidence', regionId: 'synthetic-region',
      observedText: 'INR 2500', textSpan: { start: 0, end: 8 }, boundingBox: { x: 0.1, y: 0.2, width: 0.4, height: 0.2 } }],
    revisions: [{ before: { rawValue: 'INR 2500', normalizedValue: { currency: 'INR', amountMinorUnits: '250000' } },
      after: { rawValue: 'INR 2600', normalizedValue: { currency: 'INR', amountMinorUnits: '260000' } },
      reason: 'Synthetic correction', changedAt: '2026-10-29T00:00:00Z' }] };
  const event = { id: 'synthetic-event', eventType: 'payment', occurredAt: '2026-10-28T00:00:00.000Z',
    precision: 'DATE_ONLY', uncertainty: 'Synthetic source date; not externally verified.', claims: [{ claimId: claim.id,
      type: claim.type, rawValue: claim.rawValue, sourceKind: claim.sourceKind, verificationStatus: claim.verificationStatus,
      evidenceId: 'synthetic-evidence', regionId: 'synthetic-region', observedText: 'INR 2500' }] };
  const updated = { ...claim, rawValue: 'INR 2700', normalizedValue: { currency: 'INR', amountMinorUnits: '270000' },
    revisions: [...claim.revisions, { before: claim.revisions[0].after,
      after: { rawValue: 'INR 2700', normalizedValue: { currency: 'INR', amountMinorUnits: '270000' } },
      reason: 'Synthetic correction', changedAt: '2026-10-29T01:00:00Z' }] };
  const fetch = vi.fn()
    .mockResolvedValueOnce(ok([claim])).mockResolvedValueOnce(ok([event]))
    .mockResolvedValueOnce(ok(updated)).mockResolvedValueOnce(ok([updated])).mockResolvedValueOnce(ok([event]));
  vi.stubGlobal('fetch', fetch);
  render(<ReviewPanel token="synthetic-token" caseId="synthetic-case" owner busy={false} refreshKey={0} perform={async (operation) => operation()} />);
  await screen.findByText('INR 2600');
  expect(screen.getAllByText(/OBSERVED_IN_UPLOAD · UNVERIFIED/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/observed “INR 2500”/).length).toBeGreaterThan(0);
  expect(screen.getByText(/payment · 2026-10-28 \(DATE_ONLY\)/)).toBeVisible();
  fireEvent.click(screen.getByText(/Revision history \(1\)/));
  expect(screen.getByText('Before: INR 2500')).toBeVisible();
  expect(screen.getByText('After: INR 2600')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Correct interpreted value'), { target: { value: 'INR 2700' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save correction with history' }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ rawValue: 'INR 2700', reason: undefined });
  expect(await screen.findByText('INR 2700')).toBeVisible();
});
