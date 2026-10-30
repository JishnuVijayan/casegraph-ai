import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Brief, Session } from '../types.v2';
import { ToastProvider } from './toast';
import { Workspace } from './Workspace';

const session: Session = { token: 't', user: { id: 'u1', role: 'victim', displayName: 'Asha Nair' } };
const story = { id: 'n0', text: 'story', channel: 'typed' as const, createdAt: new Date().toISOString() };
const baseBrief = (over: Partial<Brief> = {}): Brief => ({
  caseId: 'c1', reference: 'CG-2026-000123', status: 'DRAFT', category: 'upi_payment_fraud', categoryLabel: 'UPI / payment fraud',
  title: 'New complaint', summary: '', totalLoss: null, completeness: { percent: 0, missing: [] },
  timeline: [], facts: [], entities: [], questions: [], evidence: [], narratives: [],
  analysis: { state: 'IDLE', updatedAt: null }, ...over,
});
const analysed = (over: Partial<Brief> = {}) => baseBrief({
  narratives: [story], summary: 'You lost money after a fake bank call.', totalLoss: { amount: 12000, currency: 'INR' },
  timeline: [{ id: 't1', at: null, atLabel: '12 Mar, evening', precision: 'APPROXIMATE', title: 'Fake bank call', detail: 'Asked for a code', kind: 'contact', sources: [{ type: 'STORY', label: 'You told us' }] }],
  facts: [{ id: 'f1', label: 'UPI ID', value: 'scam@upi', group: 'accounts', source: 'STORY' }],
  analysis: { state: 'READY', updatedAt: 'now' }, ...over,
});

let brief: Brief;
let calls: { method: string; path: string; body?: unknown }[];
let analyzeDelay = 0;

function mockFetch() {
  calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url).replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    let data: unknown = brief;
    if (method === 'POST' && path.endsWith('/narrative')) {
      const n = { id: 'n1', text: body.text, channel: body.channel, createdAt: new Date().toISOString() };
      brief = { ...brief, narratives: [...brief.narratives, n] }; data = n;
    } else if (path.endsWith('/analyze')) {
      if (analyzeDelay) await new Promise((r) => setTimeout(r, analyzeDelay));
      brief = analysed({ narratives: brief.narratives, questions: brief.questions }); data = brief;
    } else if (path.includes('/questions/')) {
      const qid = decodeURIComponent(path.split('/questions/')[1].split('/')[0]);
      brief = { ...brief, questions: brief.questions.map((q) => q.id === qid ? { ...q, status: body.answer === 'UNKNOWN' ? 'UNKNOWN' as const : 'ANSWERED' as const, answer: body.answer } : q) }; data = brief;
    } else if (method === 'PATCH') {
      brief = { ...brief, ...body }; data = brief;
    } else if (path.endsWith('/submit')) {
      brief = { ...brief, status: 'SUBMITTED' };
      data = { reference: brief.reference, status: 'SUBMITTED', similarCases: { status: 'NONE', count: 0 } };
    }
    return new Response(JSON.stringify({ data, requestId: 'r' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
}

function view() {
  return render(
    <MemoryRouter initialEntries={['/complaint/c1']}>
      <ToastProvider><Routes><Route path="/complaint/:caseId" element={<Workspace session={session} onAuthLost={() => {}} />} /></Routes></ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => { brief = baseBrief(); analyzeDelay = 0; localStorage.clear(); mockFetch(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('step 1: tell us what happened', () => {
  it('keeps Continue off until something is added, then sends the story and moves on', async () => {
    view();
    const box = await screen.findByLabelText('Describe what happened');
    const next = screen.getByRole('button', { name: 'Continue' });
    expect(next).toBeDisabled();
    fireEvent.change(box, { target: { value: 'A man called pretending to be my bank' } });
    expect(next).toBeEnabled();
    expect(calls.some((c) => c.path.endsWith('/narrative'))).toBe(false); // nothing sent until Continue
    fireEvent.click(next);
    await waitFor(() => expect(calls.find((c) => c.path === '/cases/c1/narrative')?.body).toEqual({ text: 'A man called pretending to be my bank', channel: 'typed' }));
    expect(await screen.findByRole('heading', { name: 'Check your story' }, { timeout: 5000 })).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/cases/c1/analyze')).toBe(true);
  });

  it('explains plainly when speaking is unsupported', async () => {
    view();
    expect(await screen.findByText(/Speaking is not available in this browser/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Speak instead/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not available/);
  });

  it('opens a draft that was never read on step 1', async () => {
    brief = baseBrief({ narratives: [story] });
    view();
    expect(await screen.findByRole('heading', { name: 'Tell us what happened' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
  });
});

describe('step 2: check your story', () => {
  it('shows friendly progress while AI works, then the summary and timeline', async () => {
    analyzeDelay = 150;
    brief = baseBrief({ narratives: [story] });
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Putting your story together' })).toBeInTheDocument();
    expect(screen.getAllByText('Reading your files…').length).toBeGreaterThan(0);
    expect(screen.getByText('Building your timeline')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Check your story' }, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText(/fake bank call\./)).toBeInTheDocument();
    expect(screen.getByText('Fake bank call')).toBeInTheDocument();
    expect(screen.getByText('scam@upi')).toBeInTheDocument();
    expect(screen.getAllByText('You told us').length).toBeGreaterThan(0);
    expect(screen.getByText(/₹\s?12,000/)).toBeInTheDocument();
  });

  it('resumes an analysed draft here and goes back to step 1 with everything kept', async () => {
    brief = analysed();
    view();
    expect(await screen.findByRole('heading', { name: 'Check your story' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add more details' }));
    expect(await screen.findByRole('heading', { name: 'Tell us what happened' })).toBeInTheDocument();
    expect(screen.getByText(/What you already told us \(1\)/)).toBeInTheDocument();
  });

  it('skips the questions step when nothing is open', async () => {
    brief = analysed();
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'This looks right, continue' }));
    expect(await screen.findByRole('heading', { name: 'Review and send' })).toBeInTheDocument();
  });

  it('says what went wrong in plain words and lets the person retry', async () => {
    brief = baseBrief({ narratives: [story] });
    view();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { code: 'X', message: 'Our reader is busy right now.' } }), { status: 503 })));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Our reader is busy right now.', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument();
  });
});

describe('step 2: quick questions', () => {
  const questions = [
    { id: 'q1', prompt: 'How much money did you lose?', why: 'It sets the size of the case.', status: 'OPEN' as const, options: ['Under 10,000'] },
    { id: 'q2', prompt: 'When did it happen?', why: 'It builds your timeline.', status: 'OPEN' as const },
  ];

  it('asks one question at a time and accepts "I don\'t know"', async () => {
    brief = analysed({ questions });
    view();
    expect(await screen.findByText(/2 questions are still open/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Answer now' }));
    expect(await screen.findByText('Question 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How much money did you lose?' })).toBeInTheDocument();
    expect(screen.getByText(/It sets the size of the case/)).toBeInTheDocument();
    expect(screen.queryByText('When did it happen?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Under 10,000' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/cases/c1/questions/q1/answer')?.body).toEqual({ answer: 'Under 10,000' }));
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: "I don't know" }));
    await waitFor(() => expect(calls.find((c) => c.path === '/cases/c1/questions/q2/answer')?.body).toEqual({ answer: 'UNKNOWN' }));
    // After the last answer everything is read once more, then the person lands on the Check step.
    expect(await screen.findByRole('heading', { name: 'Check your story' })).toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith('/analyze')).length).toBe(1);
  });

  it('keeps the questions steady while the person types, even if the server replaces them', async () => {
    brief = analysed({ questions });
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Answer now' }));
    expect(await screen.findByText('Question 1 of 2')).toBeInTheDocument();
    // Simulate a background re-analysis that deleted and recreated the open questions under new ids.
    brief = analysed({ questions: [{ id: 'n1', prompt: 'A brand new question', why: 'x', status: 'OPEN' as const }] });
    fireEvent.click(screen.getByRole('button', { name: 'Under 10,000' }));
    expect(await screen.findByText('Question 2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'When did it happen?' })).toBeInTheDocument();
    expect(screen.queryByText(/You are all set here/)).not.toBeInTheDocument();
  });

  it('can be skipped for now and answered later from the Check step', async () => {
    brief = analysed({ questions });
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'Answer now' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Skip for now' }));
    expect(await screen.findByRole('heading', { name: 'Check your story' })).toBeInTheDocument();
    expect(screen.getByText(/2 questions are still open/)).toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith('/analyze')).length).toBe(0); // nothing new was said, so nothing to re-read
  });
});

describe('step 4: review and send', () => {
  it('asks for a plain confirmation, submits, then shows the reference and next steps', async () => {
    brief = analysed();
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'This looks right, continue' }));
    expect(await screen.findByRole('heading', { name: 'Review and send' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Download my report/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Submit complaint' }));
    expect(await screen.findByText(/Officers will review it. You can still download your report./)).toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/submit'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Yes, send it' }));
    expect(await screen.findByRole('heading', { name: /has been sent/ })).toBeInTheDocument();
    expect(screen.getByText('CG-2026-000123', { selector: '.v-ref-num' })).toBeInTheDocument();
    expect(screen.getByText('What happens next')).toBeInTheDocument();
    expect(screen.getAllByText('cybercrime.gov.in').length).toBeGreaterThan(1);
    expect(screen.getAllByRole('link', { name: '1930' }).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Describe what happened')).not.toBeInTheDocument();
  });

  it('lets completed steps be tapped to go back', async () => {
    brief = analysed();
    view();
    fireEvent.click(await screen.findByRole('button', { name: 'This looks right, continue' }));
    await screen.findByRole('heading', { name: 'Review and send' });
    fireEvent.click(screen.getByRole('button', { name: /Go to step 1 of 4/ }));
    expect(await screen.findByRole('heading', { name: 'Tell us what happened' })).toBeInTheDocument();
  });
});
