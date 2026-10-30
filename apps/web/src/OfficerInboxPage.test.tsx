import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OfficerInboxPage } from './OfficerInboxPage';

const token = 'a'.repeat(64);
const user = { id: 'synthetic-analyst', role: 'analyst', displayName: 'Fictional Analyst' };
const row = {
  id: 'synthetic-case', title: 'Lost money after fake UPI', status: 'REVIEW_REQUIRED',
  category: 'payment', synthetic: true, updatedAt: '2026-10-29T12:00:00.000Z',
};
const success = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ data }) });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('officer inbox lists submitted complaints and opens the report view', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success([row]))
    .mockResolvedValueOnce(success([])) // graph-leads for badge
    .mockResolvedValueOnce(success(row)) // case detail
    .mockResolvedValue(success([]));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={['/officer']}><OfficerInboxPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Continue as officer' }));
  await screen.findByRole('heading', { name: 'Submitted complaints' });
  expect(screen.getByText('Hackathon demo · synthetic data')).toBeVisible();
  expect(screen.queryByText(/Synthetic analyst/i)).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: /Lost money after fake UPI/ }));
  expect(await screen.findByRole('article', { name: 'Case report' })).toBeVisible();
  expect(await screen.findByRole('heading', { name: 'Screenshots', level: 3 })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Print / Save as PDF' })).toBeVisible();
  expect(screen.getByText(/ID synthetic-case|Reference/)).toBeTruthy();
});

test('shows empty submitted inbox copy when no REVIEW_REQUIRED cases exist', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValue(success([]));
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter initialEntries={['/officer']}><OfficerInboxPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Continue as officer' }));
  expect(await screen.findByText('No submitted complaints yet.')).toBeVisible();
});
