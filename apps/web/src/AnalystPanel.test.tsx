import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AnalystPanel } from './AnalystPanel';
// Explicit component fixture, not an application fallback or live result.
const path={source_case_id:'synthetic-case-a',source_vpa_id:'fx:vpa:01',account_id:'fx:account:shared-01',target_vpa_id:'fx:vpa:02',target_case_id:'synthetic-case-b',source_kind:'SYSTEM_INFERENCE',verification_status:'UNVERIFIED',data_origin:'SYNTHETIC_FIXTURE'};
const lead={id:'synthetic-lead',createdAt:'2026-10-29T00:00:00Z',reviewStatus:'NEEDS_REVIEW',origin:'TIGERGRAPH_QUERY_SNAPSHOT',classification:'SYNTHETIC_INVESTIGATIVE_LEAD',path,sourceRefs:[{id:'fx:evidence:01:case_reported_vpa',caseId:path.source_case_id,relation:'CASE_REPORTED_VPA'}]};
const ok=(data:unknown)=>({ok:true,json:async()=>({data})});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
test('renders a query snapshot path, scopes requests and shows source provenance and human review',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(ok({status:'QUERY_EXECUTED',leads:[lead]}))
    .mockResolvedValueOnce(ok({capturedAt:lead.createdAt,source:{id:lead.sourceRefs[0].id,case_id:path.source_case_id,relation_type:'CASE_REPORTED_VPA',fixture_kind:'FICTIONAL_CASE_SCENARIO',source_kind:'SYSTEM_INFERENCE',verification_status:'UNVERIFIED',data_origin:'SYNTHETIC_FIXTURE',synthetic:true}}))
    .mockResolvedValueOnce(ok({id:lead.id,reviewStatus:'REVIEWED'}));
  vi.stubGlobal('fetch',fetch);
  render(<AnalystPanel token="synthetic-token" caseId="synthetic-case-a" busy={false} perform={async(op)=>op()}/>);
  fireEvent.click(screen.getByRole('button',{name:'Run similar-case search'}));
  expect(await screen.findByLabelText('Four-hop lead path')).toBeVisible();
  expect(screen.getByText(/Saved query snapshot/)).toBeVisible();
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({maxHops:4});
  fireEvent.click(screen.getByRole('button',{name:/Review edge 1 source/}));
  expect(await screen.findByLabelText('Graph source details')).toHaveTextContent('Captured');
  fireEvent.click(screen.getByRole('button',{name:'Mark reviewed'}));
  await waitFor(()=>expect(screen.getByText(/SYNTHETIC_INVESTIGATIVE_LEAD · REVIEWED/)).toBeVisible());
  expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({status:'REVIEWED'});
});
test('graph outage clears earlier paths and never presents an empty query success',async()=>{
  const fetch=vi.fn().mockResolvedValueOnce(ok([lead])).mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:{message:'Local service unavailable.'}})});
  vi.stubGlobal('fetch',fetch);
  render(<AnalystPanel token="synthetic-token" caseId="synthetic-case-a" busy={false} perform={async(op)=>{try{await op();}catch{/* parent also displays controlled error */}}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Read saved lead snapshots'}));await screen.findByLabelText('Four-hop lead path');
  fireEvent.click(screen.getByRole('button',{name:'Run similar-case search'}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Similar-case search unavailable until TigerGraph is connected');
  expect(screen.queryByLabelText('Four-hop lead path')).not.toBeInTheDocument();
  expect(screen.queryByText(/No linked paths returned/)).not.toBeInTheDocument();
});
