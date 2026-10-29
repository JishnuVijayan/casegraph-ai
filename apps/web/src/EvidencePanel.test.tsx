import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EvidencePanel } from './EvidencePanel';

const row = { id: 'synthetic-source-id', mimeType: 'image/png', sizeBytes: 12, sha256: 'a'.repeat(64), createdAt: '2026-10-29T00:00:00Z' };
const success = (data: unknown) => ({ ok: true, json: async () => ({ data }) });
const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
afterEach(() => {
  cleanup(); vi.unstubAllGlobals();
  if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate); else Reflect.deleteProperty(URL, 'createObjectURL');
  if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke); else Reflect.deleteProperty(URL, 'revokeObjectURL');
});

test('uploads one FormData file with bearer authorization and displays the returned source manifest', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(success(row)).mockResolvedValueOnce(success([row]));
  vi.stubGlobal('fetch', fetch);
  const failures = vi.fn();
  render(<EvidencePanel token="synthetic-token" caseId="synthetic-case" owner busy={false} perform={async (operation) => { try { await operation(); } catch (e) { failures(e); } }} />);
  const file = new File(['synthetic-mocked-file'], 'synthetic.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Image file'), { target: { files: [file] } });
  // JSDOM does not update native file-input validity when files are injected.
  fireEvent.submit(screen.getByRole('button', { name: 'Upload' }).closest('form')!);
  await screen.findByText(/Source ID: synthetic-source-id/);
  expect(fetch.mock.calls[0][1].body).toBeInstanceOf(FormData);
  expect(fetch.mock.calls[0][1].body.get('file').name).toBe('synthetic.png');
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-token');
  expect(fetch.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
  expect(screen.getByText(row.sha256)).toBeVisible();
  expect(failures).not.toHaveBeenCalled();
});

test('analysts get manifest/download controls without an upload control; failed refresh clears prior metadata', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(success([row])).mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Access denied.' } }) });
  vi.stubGlobal('fetch', fetch);
  const failures = vi.fn();
  render(<EvidencePanel token="synthetic-token" caseId="synthetic-case" owner={false} busy={false} perform={async (operation) => { try { await operation(); } catch (e) { failures(e); } }} />);
  expect(screen.queryByLabelText('Image file')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await screen.findByText(/Source ID: synthetic-source-id/);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await waitFor(() => expect(failures).toHaveBeenCalled());
  expect(screen.queryByText(/Source ID: synthetic-source-id/)).not.toBeInTheDocument();
});

test('runs local OCR and opens an authenticated crop for an unverified amount candidate', async () => {
  const region = { id: 'synthetic-region', kind: 'AMOUNT', text: 'INR 2500', confidence: 91 };
  const extraction = { status: 'SUCCEEDED', amountStatus: 'OBSERVED_IN_UPLOAD', verificationStatus: 'UNVERIFIED',
    outputText: 'Synthetic payment INR 2500', regions: [region] };
  const fetch = vi.fn()
    .mockResolvedValueOnce(success([row]))
    .mockResolvedValueOnce(success(extraction))
    .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['synthetic crop'], { type: 'image/png' }) })
    .mockResolvedValueOnce(success({ id: 'synthetic-claim' }));
  vi.stubGlobal('fetch', fetch);
  const create = vi.fn(() => 'blob:synthetic-crop'); const revoke = vi.fn(); const onClaimAdded = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
  render(<EvidencePanel token="synthetic-token" caseId="synthetic-case" owner busy={false} onClaimAdded={onClaimAdded} perform={async (operation) => operation()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence' }));
  await screen.findByText(/Source ID: synthetic-source-id/);
  fireEvent.click(screen.getByRole('button', { name: 'Run local OCR' }));
  fireEvent.click(await screen.findByRole('button', { name: /Review source region for INR 2500/ }));
  expect(await screen.findByRole('img', { name: /Source crop containing INR 2500/ })).toHaveAttribute('src', 'blob:synthetic-crop');
  expect(screen.getByText(/verification: UNVERIFIED/)).toBeVisible();
  expect(fetch.mock.calls[1][0]).toContain('/cases/synthetic-case/extractions');
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer synthetic-token');
  expect(fetch.mock.calls[2][0]).toContain('/regions/synthetic-region/crop');
  expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer synthetic-token');
  fireEvent.click(screen.getByRole('button', { name: /Save observed amount claim for INR 2500/ }));
  await waitFor(() => expect(onClaimAdded).toHaveBeenCalledOnce());
  expect(fetch.mock.calls[3][0]).toBe('/api/v1/cases/synthetic-case/claims');
  expect(JSON.parse(fetch.mock.calls[3][1].body)).toEqual({ type: 'payment_amount', sourceKind: 'OBSERVED_IN_UPLOAD', evidenceId: row.id, regionId: region.id });
  fireEvent.click(screen.getByRole('button', { name: 'Close source crop' }));
  await waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:synthetic-crop'));
});
