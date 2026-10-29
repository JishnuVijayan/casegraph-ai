import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OfficerInboxPage } from './OfficerInboxPage';

const token = 'b'.repeat(64);
const user = { id: 'synthetic-analyst', role: 'analyst', displayName: 'Fictional Analyst' };
const row = { id: 'synthetic-case', title: 'Synthetic shared case', status: 'DRAFT', category: 'payment', synthetic: true };
const success = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('officer signs in, lists complaints, and opens a read-only case report', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success([row]))
    .mockResolvedValueOnce(success(row))
    .mockResolvedValueOnce(success([]))
    .mockResolvedValueOnce(success([]));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={['/officer']}><OfficerInboxPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Continue as officer' }));
  await screen.findByText(/Officer workspace/);
  expect(screen.getByRole('heading', { name: 'Complaints' })).toBeVisible();
  fireEvent.click(await screen.findByRole('button', { name: /Synthetic shared case/ }));
  expect(await screen.findByRole('article', { name: 'Case report' })).toBeVisible();
  expect(screen.getByText(/ID synthetic-case/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Run similar-case search' })).toBeVisible();
  expect(screen.queryByLabelText('Image file')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Create draft' })).not.toBeInTheDocument();
});
