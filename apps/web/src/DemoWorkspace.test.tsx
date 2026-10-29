import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DemoWorkspace } from './DemoWorkspace';

const token = 'a'.repeat(64);
const user = { id: 'synthetic-user', role: 'victim', displayName: 'Fictional Victim A' };
const row = { id: 'synthetic-case', title: 'Synthetic test case', status: 'DRAFT', synthetic: true };
const success = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('signs in, reads scoped cases, and clears private UI on sign-out without persisting the token', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(success({ token, user })).mockResolvedValueOnce(success([row]))
    .mockResolvedValueOnce(success({ ...row, category: 'synthetic' })).mockResolvedValueOnce(success({ signedOut: true }));
  vi.stubGlobal('fetch', fetch);
  render(<DemoWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to local demo' }));
  await screen.findByText(/Signed in as Fictional Victim A/);
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${token}`);
  expect(localStorage.getItem('token')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Read case' }));
  await screen.findByRole('article', { name: 'Case details' });
  expect(screen.getByText(/No evidence or verified bank records/)).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('button', { name: 'Sign in to local demo' });
  expect(screen.queryByText(row.title)).not.toBeInTheDocument();
});

test('shows unavailable sign-in truthfully without invented case data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503,
    json: async () => ({ error: { message: 'Local service unavailable. Check configuration and retry.' } }) }));
  render(<DemoWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to local demo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Local service unavailable');
  expect(screen.queryByText(/Signed in as/)).not.toBeInTheDocument();
});

test('clears an earlier case detail before a denied read', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(success({ token, user })).mockResolvedValueOnce(success([row]))
    .mockResolvedValueOnce(success({ ...row, category: 'synthetic' }))
    .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: { message: 'Access denied.' } }) });
  vi.stubGlobal('fetch', fetch);
  render(<DemoWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Sign in to local demo' }));
  await screen.findByText(/Signed in as/);
  fireEvent.click(screen.getByRole('button', { name: 'Read case' }));
  await screen.findByRole('article', { name: 'Case details' });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Read case' })).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText('Case ID'), { target: { value: 'another-synthetic-case' } });
  fireEvent.click(screen.getByRole('button', { name: 'Read case' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
  expect(screen.queryByRole('article', { name: 'Case details' })).not.toBeInTheDocument();
});
