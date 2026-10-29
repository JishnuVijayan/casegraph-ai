import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QuestionsPanel } from './QuestionsPanel';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
test('asks one question with provenance and saves UNKNOWN without invented text', async () => {
  const q = {id:'synthetic-question',prompt:'Which amount do you recall?',status:'OPEN',isCurrent:true,
    context:{eventId:'synthetic-payment',claims:[{id:'synthetic-claim',rawValue:'INR 2500',sourceKind:'OBSERVED_IN_UPLOAD'}]},answer:null};
  const ok = (data:unknown) => ({ok:true,json:async()=>({data})});
  const fetch = vi.fn().mockResolvedValueOnce(ok([q])).mockResolvedValueOnce(ok({})).mockResolvedValueOnce(ok([{...q,status:'UNKNOWN',answer:{text:null}}]));
  vi.stubGlobal('fetch',fetch);
  render(<QuestionsPanel token="synthetic-token" caseId="synthetic-case" owner busy={false} perform={async (operation)=>operation()} />);
  fireEvent.click(screen.getByRole('button',{name:'Check payment details for questions'}));
  expect(await screen.findByText(q.prompt)).toBeVisible();
  expect(screen.getByText(/OBSERVED_IN_UPLOAD · UNVERIFIED/)).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Unknown / I can’t remember'}));
  await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(3));
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({status:'UNKNOWN'});
  expect(await screen.findByText('No current unanswered questions.')).toBeVisible();
});
