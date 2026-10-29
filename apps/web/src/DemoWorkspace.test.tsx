import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VictimFilingPage } from './VictimFilingPage';

const token = 'a'.repeat(64);
const user = { id: 'synthetic-user', role: 'victim', displayName: 'Priya Demo' };
const row = { id: 'synthetic-case', title: 'Synthetic payment complaint', status: 'DRAFT', synthetic: true, category: 'payment' };
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

test('creates the hidden case with syntheticAcknowledged and advances to uploads', async () => {
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
  await screen.findByLabelText('Image file');
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({
    title: 'Lost money on fake UPI', category: 'payment', syntheticAcknowledged: true,
  });
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

test('submits the complaint and shows confirmation', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success(row, 201))
    .mockResolvedValueOnce(success([])) // evidence list if any
    .mockImplementation((url: string, init?: { method?: string }) => {
      if (String(url).includes('/clarifications')) return success([]);
      if (String(url).endsWith('/shares')) return success({id:'synthetic-grant'});
      if (init?.method==='DELETE') return success({revoked:true});
      if (String(url).includes('/submit') && init?.method === 'POST') {
        return success({
          caseId: row.id, status: 'REVIEW_REQUIRED', exportId: 'export-1', exportVersion: 1,
          leadsStatus: 'UNAVAILABLE', similarCaseCount: 0,
        }, 201);
      }
      if (String(url).includes('/claims') || String(url).includes('/timeline')) return success([]);
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
  await screen.findByRole('button', { name: 'Continue to review details' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to review details' }));
  await screen.findByRole('button', { name: 'Continue to missing details' });
  fireEvent.click(screen.getByRole('button', { name: 'Continue to missing details' }));
  await screen.findByRole('button', { name: 'Submit complaint' });
  fireEvent.click(screen.getByRole('button', { name: 'Submit complaint' }));
  expect(await screen.findByRole('heading', { name: 'Complaint submitted for review' })).toBeVisible();
  expect(screen.getByText(new RegExp(row.id))).toBeVisible();
  expect(fetch.mock.calls.some(([url])=>String(url).endsWith('/shares'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Share for investigation'}));
  const revoke=await screen.findByRole('button',{name:'Revoke investigation access'});
  fireEvent.click(revoke);await screen.findByText(/Grant revoked/);
});
