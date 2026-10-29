import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EvidencePanel } from './EvidencePanel';

const row = { id: 'synthetic-source-id', mimeType: 'image/png', sizeBytes: 12, sha256: 'a'.repeat(64), createdAt: '2026-10-29T00:00:00Z' };
const success = (data: unknown) => ({ ok: true, json: async () => ({ data }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('uploads one FormData file with bearer authorization and displays the returned source manifest', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(success(row)).mockResolvedValueOnce(success([row]));
  vi.stubGlobal('fetch', fetch);
  const failures = vi.fn();
  render(<EvidencePanel token="synthetic-token" caseId="synthetic-case" owner busy={false} perform={async (operation) => { try { await operation(); } catch (e) { failures(e); } }} />);
  const file = new File(['synthetic-mocked-file'], 'synthetic.png', { type: 'image/png' });
  fireEvent.change(screen.getByLabelText('Synthetic PNG/JPEG file'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('checkbox'));
  // JSDOM does not update native file-input validity when files are injected.
  fireEvent.submit(screen.getByRole('button', { name: 'Upload immutable original' }).closest('form')!);
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
  expect(screen.queryByLabelText('Synthetic PNG/JPEG file')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence manifest' }));
  await screen.findByText(/Source ID: synthetic-source-id/);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh evidence manifest' }));
  await waitFor(() => expect(failures).toHaveBeenCalled());
  expect(screen.queryByText(/Source ID: synthetic-source-id/)).not.toBeInTheDocument();
});
