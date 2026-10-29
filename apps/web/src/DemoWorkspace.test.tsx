import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { VictimFilingPage } from './VictimFilingPage';

const token = 'a'.repeat(64);
const user = { id: 'synthetic-user', role: 'victim', displayName: 'Fictional Victim A' };
const row = { id: 'synthetic-case', title: 'Synthetic test case', status: 'DRAFT', synthetic: true, category: 'payment' };
const success = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function renderVictim() {
  return render(<MemoryRouter><VictimFilingPage /></MemoryRouter>);
}

test('signs in, opens a case from the list, and clears private UI on sign-out', async () => {
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success([row]))
    .mockResolvedValueOnce(success(row))
    .mockResolvedValueOnce(success([]))
    .mockResolvedValueOnce(success([]))
    .mockResolvedValueOnce(success({ signedOut: true }));
  vi.stubGlobal('fetch', fetch);
  renderVictim();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText(/Fictional Victim A/);
  expect(fetch.mock.calls[1][1].headers.Authorization).toBe(`Bearer ${token}`);
  expect(localStorage.getItem('token')).toBeNull();
  await screen.findByRole('article', { name: 'Case details' });
  expect(screen.getByRole('heading', { name: row.title })).toBeVisible();
  expect(screen.queryByLabelText('Case ID')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Grant access' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));
  await screen.findByRole('button', { name: 'Continue' });
  expect(screen.queryByRole('heading', { name: row.title })).not.toBeInTheDocument();
});

test('shows unavailable sign-in truthfully without invented case data', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503,
    json: async () => ({ error: { message: 'Local service unavailable. Check configuration and retry.' } }) }));
  renderVictim();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Local service unavailable');
  expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();
});

test('clears an earlier case detail before a denied list open', async () => {
  let caseReads = 0;
  const other = { ...row, id: 'another-synthetic-case', title: 'Another synthetic case' };
  const fetch = vi.fn().mockImplementation((url: string) => {
    if (url.endsWith('/auth/demo')) return success({ token, user });
    if (url.endsWith('/cases') && !url.includes('/cases/')) return success([row, other]);
    if (url.includes('/claims') || url.includes('/timeline')) return success([]);
    caseReads += 1;
    return caseReads === 1 ? success(row)
      : { ok: false, status: 403, json: async () => ({ error: { message: 'Access denied.' } }) };
  });
  vi.stubGlobal('fetch', fetch);
  renderVictim();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByRole('article', { name: 'Case details' });
  await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(other.title) })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: new RegExp(other.title) }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
  expect(screen.queryByRole('article', { name: 'Case details' })).not.toBeInTheDocument();
});

test('creates a draft without acknowledgment checkbox and still sends syntheticAcknowledged', async () => {
  const created = { ...row, id: 'synthetic-new-case', title: 'Synthetic new draft', category: 'other' };
  const fetch = vi.fn()
    .mockResolvedValueOnce(success({ token, user }))
    .mockResolvedValueOnce(success([row]))
    .mockResolvedValueOnce(success(row))
    .mockResolvedValueOnce(success([]))
    .mockResolvedValueOnce(success([]))
    .mockResolvedValueOnce(success(created))
    .mockResolvedValueOnce(success([row, created]));
  vi.stubGlobal('fetch', fetch);
  renderVictim();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText(/Fictional Victim A/);
  await screen.findByRole('article', { name: 'Case details' });
  fireEvent.change(screen.getByLabelText('Case title'), { target: { value: 'new draft' } });
  expect(screen.queryByRole('checkbox', { name: /fictional|synthetic draft|I understand/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Create draft' }));
  await waitFor(() => expect(fetch.mock.calls.some((call) => String(call[0]).endsWith('/cases') && call[1]?.method === 'POST')).toBe(true));
  const createCall = fetch.mock.calls.find((call) => String(call[0]).endsWith('/cases') && call[1]?.method === 'POST')!;
  expect(JSON.parse(createCall[1].body)).toEqual({ title: 'new draft', category: 'other', syntheticAcknowledged: true });
});

test('requires an explicit share action and can revoke the resulting investigation grant',async()=>{
  const fetch=vi.fn().mockImplementation((url:string,options:{method?:string}={})=>{
    if(url.endsWith('/auth/demo'))return success({token,user});
    if(url.endsWith('/cases'))return success([row]);
    if(url.endsWith('/claims')||url.endsWith('/timeline'))return success([]);
    if(url.endsWith('/shares'))return success({id:'synthetic-grant'});
    if(options.method==='DELETE')return success({revoked:true});
    return success(row);
  });
  vi.stubGlobal('fetch',fetch);renderVictim();
  fireEvent.click(screen.getByRole('button',{name:'Continue'}));
  await screen.findByRole('button',{name:'Share for investigation'});
  expect(fetch.mock.calls.some(([url])=>url.endsWith('/shares'))).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Share for investigation'}));
  const revoke=await screen.findByRole('button',{name:'Revoke investigation access'});
  const share=fetch.mock.calls.find(([url])=>url.endsWith('/shares'))!;
  expect(JSON.parse(share[1].body)).toMatchObject({scope:'INVESTIGATE'});
  fireEvent.click(revoke);await screen.findByText(/Grant revoked/);
  expect(fetch.mock.calls.some(([url,options])=>url.endsWith('/shares/synthetic-grant')&&options?.method==='DELETE')).toBe(true);
});
