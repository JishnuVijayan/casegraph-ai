import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OfficerApp from './OfficerApp';
import { brief, caseFile, row, similarCase } from './officer.fixtures';

type Handler = (url: string, init?: RequestInit) => unknown | Promise<unknown>;
function mockApi(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace('/api/v1', '');
    const key = Object.keys(routes).sort((a, b) => b.length - a.length).find((k) => url.startsWith(k));
    if (!key) return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Not found' } }), { status: 404 });
    const out = await routes[key]!(url, init);
    if (out instanceof Response) return out;
    return new Response(JSON.stringify({ data: out, requestId: 'r' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}
function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/officer/*" element={<OfficerApp />} /></Routes></MemoryRouter>);
}
const userEvent = {
  click: async (el: Element) => { fireEvent.click(el); },
  type: async (el: Element, text: string) => { fireEvent.change(el, { target: { value: text } }); },
  clear: async (el: Element) => { fireEvent.change(el, { target: { value: '' } }); },
  selectOptions: async (el: Element, v: string) => { fireEvent.change(el, { target: { value: v } }); },
  keyboard: async (k: string) => { act(() => { fireEvent.keyDown(document.body, { key: k.replace(/[{}]/g, '') }); }); },
};
const signedIn = () => sessionStorage.setItem('cg.officer.session.v2', JSON.stringify({ token: 't', officerId: 'CCU-1', displayName: 'CCU-1' }));

beforeEach(() => { sessionStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const rows = [
  row({ id: 'a', reference: 'CG-2026-000001', title: 'Old small loss', loss: { amount: 1000, currency: 'INR' }, similarCount: 0, submittedAt: '2026-08-01T00:00:00Z' }),
  row({ id: 'b', reference: 'CG-2026-000002', title: 'Huge investment loss', category: 'investment_scam', categoryLabel: 'Investment / trading scam', loss: { amount: 900000, currency: 'INR' }, similarCount: 2, submittedAt: '2026-08-05T00:00:00Z' }),
  row({ id: 'c', reference: 'CG-2026-000003', title: 'Mid courier fee', loss: { amount: 20000, currency: 'INR' }, similarCount: 5, submittedAt: '2026-08-09T00:00:00Z' }),
];
const titles = () => screen.getAllByRole('link').filter((a) => a.className.includes('o-title')).map((a) => a.textContent);

describe('sign-in', () => {
  it('signs in as an officer without any demo wording', async () => {
    const f = mockApi({ '/auth/demo': () => ({ token: 'tok', user: { id: 'u', role: 'analyst', displayName: 'X' } }), '/officer/cases': () => [] });
    renderAt('/officer');
    expect(screen.getByRole('heading', { name: 'Officer sign-in' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/demo|synthetic/i);
    await userEvent.type(screen.getByLabelText('Officer ID'), 'CCU-2041');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Submitted complaints' })).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem('cg.officer.session.v2')!).token).toBe('tok');
    expect(f).toHaveBeenCalled();
  });
});

describe('inbox', () => {
  it('filters by search and category, and sorts', async () => {
    signedIn(); mockApi({ '/officer/cases': () => rows });
    renderAt('/officer');
    await screen.findByText('Old small loss');
    expect(titles()).toEqual(['Mid courier fee', 'Huge investment loss', 'Old small loss']);
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'loss');
    expect(titles()).toEqual(['Huge investment loss', 'Mid courier fee', 'Old small loss']);
    await userEvent.selectOptions(screen.getByLabelText('Sort by'), 'similar');
    expect(titles()[0]).toBe('Mid courier fee');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'investment_scam');
    expect(titles()).toEqual(['Huge investment loss']);
    await userEvent.selectOptions(screen.getByLabelText('Category'), '');
    await userEvent.type(screen.getByLabelText('Search complaints'), '000001');
    expect(titles()).toEqual(['Old small loss']);
    await userEvent.clear(screen.getByLabelText('Search complaints'));
    await userEvent.type(screen.getByLabelText('Search complaints'), 'zzz');
    expect(screen.getByText('No complaints match')).toBeInTheDocument();
  });
  it('supports j/k/Enter keyboard navigation', async () => {
    signedIn(); mockApi({ '/officer/cases/b': () => caseFile(), '/officer/cases': () => rows });
    renderAt('/officer');
    await screen.findByText('Old small loss');
    await userEvent.keyboard('j');
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByRole('tab', { name: /Overview/ })).toBeInTheDocument();
  });
  it('shows an error with retry', async () => {
    signedIn(); mockApi({ '/officer/cases': () => new Response(JSON.stringify({ error: { message: 'Server is busy' } }), { status: 500 }) });
    renderAt('/officer');
    expect(await screen.findByText('Server is busy')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('shows an empty state', async () => {
    signedIn(); mockApi({ '/officer/cases': () => [] });
    renderAt('/officer');
    expect(await screen.findByText('No complaints yet')).toBeInTheDocument();
  });
});

describe('case file similar cases', () => {
  it('lists ranked similar cases with shared details', async () => {
    signedIn(); mockApi({ '/officer/cases/c1': () => caseFile() });
    renderAt('/officer/cases/c1');
    const panel = await screen.findByRole('complementary', { name: 'Similar cases' });
    expect(within(panel).getByText('CG-2026-000090')).toBeInTheDocument();
    expect(within(panel).getByText(/same phone number/)).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: 'Compare side by side' })).toHaveAttribute('href', '/officer/cases/c1/compare/c2');
    expect(within(panel).getByText('Case network')).toBeInTheDocument();
  });
  it('says plainly when nothing is similar', async () => {
    signedIn(); mockApi({ '/officer/cases/c1': () => caseFile({ similar: { status: 'NONE', cases: [] } }) });
    renderAt('/officer/cases/c1');
    expect(await screen.findByText('No earlier complaints share details with this one')).toBeInTheDocument();
  });
  it('shows the offline state and retries', async () => {
    signedIn();
    let n = 0;
    mockApi({ '/officer/cases/c1': () => (n++ === 0 ? caseFile({ similar: { status: 'UNAVAILABLE', cases: [] } }) : caseFile()) });
    renderAt('/officer/cases/c1');
    expect(await screen.findByText('Case network is offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('CG-2026-000090')).toBeInTheDocument();
  });
  it('saves a useful review', async () => {
    signedIn();
    const f = mockApi({ '/officer/cases/c1/similar/c2/review': () => ({}), '/officer/cases/c1': () => caseFile() });
    renderAt('/officer/cases/c1');
    await userEvent.click(await screen.findByRole('button', { name: /Useful/ }));
    await waitFor(() => expect(f.mock.calls.some(([u, i]) => String(u).endsWith('/review') && JSON.parse(String(i?.body)).status === 'USEFUL')).toBe(true));
    expect(screen.getByRole('button', { name: /Useful/ })).toHaveAttribute('aria-pressed', 'true');
  });
  it('shows "Not provided" for unknown answers', async () => {
    signedIn(); mockApi({ '/officer/cases/c1': () => caseFile() });
    renderAt('/officer/cases/c1?tab=answers');
    expect(await screen.findByText('Not provided')).toBeInTheDocument();
    expect(screen.getByText('On 1 October')).toBeInTheDocument();
  });
});

describe('compare view', () => {
  it('highlights shared details in both case files', async () => {
    signedIn();
    const other = brief({ caseId: 'c2', reference: 'CG-2026-000090', title: 'Courier fee paid by UPI', summary: 'Called from 9876500011 about a parcel.' });
    mockApi({
      '/officer/cases/c1/similar/c2': () => ({ brief: other, shared: [{ kind: 'phone', value: '9876500011', strength: 'STRONG' }] }),
      '/officer/cases/c1': () => caseFile(),
    });
    renderAt('/officer/cases/c1/compare/c2');
    expect(await screen.findByRole('heading', { name: /Comparing CG-2026-000101 with CG-2026-000090/ })).toBeInTheDocument();
    const marks = document.querySelectorAll('mark.o-mark');
    expect(marks.length).toBeGreaterThanOrEqual(2);
    expect(marks[0]!.textContent).toBe('9876500011');
    expect(screen.getByText(/does not show that the same person/)).toBeInTheDocument();
    expect(similarCase().score).toBe(86);
  });
});
