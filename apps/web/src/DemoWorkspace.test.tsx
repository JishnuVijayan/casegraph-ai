import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VictimFilingPage } from './VictimFilingPage';

const token = 'a'.repeat(64);
const user = { id: 'synthetic-user', role: 'victim', displayName: 'Priya Demo' };
const row = { id: 'synthetic-case', title: 'Lost money on fake UPI', status: 'DRAFT', synthetic: true, category: 'payment' };
const success = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ data }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderVictim() {
  return render(<MemoryRouter><VictimFilingPage /></MemoryRouter>);
}

function fillIntake() {
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Priya Demo' } });
  fireEvent.change(screen.getByLabelText('Mobile number'), { target: { value: '9876543210' } });
}

test('starts with name and mobile, then opens the complaint wizard', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(success({ token, user }));
  vi.stubGlobal('fetch', fetch);
  renderVictim();
  fillIntake();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText(/Priya Demo/);
  expect(fetch.mock.calls[0][0]).toContain('/auth/intake');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ displayName: 'Priya Demo', mobile: '9876543210' });
  expect(screen.getByRole('heading', { name: 'What happened?' })).toBeVisible();
  expect(screen.queryByText('Your cases')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Fictional identity')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('button', { name: 'Continue' });
});

test('shows unavailable intake truthfully without invented case data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503,
    json: async () => ({ error: { message: 'Local service unavailable. Check configuration and retry.' } }) }));
  renderVictim();
  fillIntake();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Local service unavailable');
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
});

test('creates the case and opens auto-upload zone without investigator tools', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success(row, 201))
    .mockResolvedValue(success([]));
  vi.stubGlobal('fetch', fetch);
  renderVictim();
  fillIntake();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Short description');
  fireEvent.change(screen.getByLabelText('Short description'), { target: { value: 'Lost money on fake UPI' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to uploads' }));
  await screen.findByText('Tap to add images');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
    title: 'Lost money on fake UPI', category: 'payment', syntheticAcknowledged: true,
  });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Run local OCR' })).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Claim type')).not.toBeInTheDocument();
  expect(screen.queryByText(/Synthetic /)).not.toBeInTheDocument();
});

test('skips questions when prepare finds nothing missing and submits', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success(row, 201))
    .mockImplementation((url: string, init?: { method?: string }) => {
      if (String(url).includes('/prepare') && init?.method === 'POST') {
        return success({ caseId: row.id, evidenceCount: 1, claimCount: 3, openQuestions: 0 });
      }
      if (String(url).includes('/submit') && init?.method === 'POST') {
        return success({
          caseId: row.id, status: 'REVIEW_REQUIRED', exportId: 'export-1', exportVersion: 1,
          leadsStatus: 'UNAVAILABLE', similarCaseCount: 0,
        }, 201);
      }
      if (String(url).includes('/evidence') && (!init?.method || init.method === 'GET')) {
        return success([{ id: 'ev-1', mimeType: 'image/png', sizeBytes: 12, sha256: 'a'.repeat(64), createdAt: '2026-10-29T00:00:00Z' }]);
      }
      return success([]);
    });
  vi.stubGlobal('fetch', fetch);
  renderVictim();
  fillIntake();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Short description');
  fireEvent.change(screen.getByLabelText('Short description'), { target: { value: 'UPI fraud' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to uploads' }));
  await screen.findByText('Ready');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('heading', { name: 'Ready to submit' });
  expect(screen.queryByRole('heading', { name: 'A few more details' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Submit complaint' }));
  expect(await screen.findByRole('heading', { name: 'Complaint submitted for review' })).toBeVisible();
  expect(screen.getByText(new RegExp(row.id))).toBeVisible();
});

test('auto-uploads chosen images and can remove them', async () => {
  const uploaded = { id: 'ev-new', mimeType: 'image/png', sizeBytes: 12, sha256: 'b'.repeat(64), createdAt: '2026-10-29T00:00:00Z' };
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success(row, 201))
    .mockResolvedValueOnce(success([]))
    .mockImplementation((url: string, init?: { method?: string }) => {
      if (String(url).includes('/evidence') && init?.method === 'POST') return success(uploaded, 201);
      if (String(url).includes('/evidence/') && init?.method === 'DELETE') return success({ removed: true, id: uploaded.id });
      if (String(url).includes('/evidence')) return success([]);
      return success([]);
    });
  vi.stubGlobal('fetch', fetch);
  renderVictim();
  fillIntake();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByLabelText('Short description');
  fireEvent.change(screen.getByLabelText('Short description'), { target: { value: 'UPI fraud' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to uploads' }));
  await screen.findByText('Tap to add images');
  const input = document.getElementById('evidence-file') as HTMLInputElement;
  const file = new File(['png'], 'shot.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText('Ready');
  expect(fetch.mock.calls.some((call) => String(call[0]).includes('/evidence') && call[1]?.method === 'POST')).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await waitFor(() => {
    expect(fetch.mock.calls.some((call) => String(call[0]).includes(`/evidence/${uploaded.id}`) && call[1]?.method === 'DELETE')).toBe(true);
  });
});
