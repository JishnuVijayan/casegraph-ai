import { useState } from 'react';
import { api, ApiFailure } from './api';
type Path = {source_case_id:string;source_vpa_id:string;account_id:string;target_vpa_id:string;target_case_id:string;source_kind:string;verification_status:string;data_origin:string};
type Lead = {id:string;createdAt:string;reviewStatus:string;origin:string;classification:string;path:Path;sourceRefs:{id:string;caseId:string;relation:string}[]};
type Source = {id:string;case_id:string;from_id:string;to_id:string;relation_type:string;fixture_kind:string;source_kind:string;verification_status:string;data_origin:string;synthetic:boolean};
export function AnalystPanel({token,caseId,busy,perform}:{token:string;caseId:string;busy:boolean;perform:(operation:()=>Promise<void>)=>Promise<void>}){
  const [leads,setLeads]=useState<Lead[]>([]);const [source,setSource]=useState<{capturedAt:string;source:Source}|null>(null);
  const [notice,setNotice]=useState('');const [error,setError]=useState('');
  async function run(operation:()=>Promise<void>){setError('');setNotice('');await perform(async()=>{
    try{await operation();}catch(failure){setLeads([]);setSource(null);setError(failure instanceof ApiFailure&&failure.status===503?'Investigation unavailable. Check the configured TigerGraph instance, token and installed queries.':failure instanceof Error?failure.message:'Investigation unavailable.');throw failure;}
  });}
  return <section aria-label="Analyst investigation" className="my-4 rounded border p-4">
    <h3 className="text-lg font-bold">Synthetic investigation leads</h3>
    <p>Explicit INVESTIGATE grants are required for every case in a path. A shared synthetic account is an investigative lead, not proof of criminal identity. Human review does not establish guilt or bank verification.</p>
    <button disabled={busy} onClick={()=>void run(async()=>{setLeads([]);setSource(null);const result=await api<{status:string;leads:Lead[]}>(`/investigations/${caseId}/graph-leads`,token,{maxHops:4},'POST');setLeads(result.leads);setNotice(result.leads.length?'TigerGraph query executed. Saved snapshots are shown below.':'TigerGraph query executed. No paths returned within your permitted scope.');})}>Run scoped TigerGraph query</button>
    <button disabled={busy} onClick={()=>void run(async()=>{setLeads([]);setSource(null);setLeads(await api<Lead[]>(`/investigations/${caseId}/graph-leads`,token));setNotice('Saved query snapshots loaded. Run the query to refresh.');})}>Read saved lead snapshots</button>
    {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
    <ul>{leads.map((lead)=><li key={lead.id} className="my-4 rounded border p-3">
      <p>{lead.classification} · {lead.reviewStatus}</p>
      <p>Saved query snapshot · {lead.createdAt} · {lead.path.data_origin} · {lead.path.source_kind} · {lead.path.verification_status}</p>
      <ol aria-label="Four-hop lead path" className="my-3 flex flex-wrap gap-2">{[
        ['Source case',lead.path.source_case_id,'→'],['Source VPA',lead.path.source_vpa_id,'→'],['Shared account',lead.path.account_id,'←'],['Target VPA',lead.path.target_vpa_id,'←'],['Target case',lead.path.target_case_id,''],
      ].map(([label,id,arrow],index)=><li key={`${lead.id}-${index}`} className="max-w-64 break-all rounded border p-2"><strong>{label}</strong><br/>{id} <span aria-hidden="true">{arrow}</span></li>)}</ol>
      <ul>{lead.sourceRefs.map((ref,index)=><li key={ref.id}><button disabled={busy} onClick={()=>void run(async()=>{setSource(null);setSource(await api<{capturedAt:string;source:Source}>(`/graph-leads/${lead.id}/sources/${encodeURIComponent(ref.id)}`,token));})}>Review edge {index+1} source: {ref.relation}</button></li>)}</ul>
      <button disabled={busy} onClick={()=>void run(async()=>{await api(`/graph-leads/${lead.id}/review`,token,{status:'REVIEWED'},'PATCH');setLeads((current)=>current.map((item)=>item.id===lead.id?{...item,reviewStatus:'REVIEWED'}:item));setNotice('Human review recorded; this does not verify the underlying allegation.');})}>Mark reviewed</button>
      <button disabled={busy} onClick={()=>void run(async()=>{await api(`/graph-leads/${lead.id}/review`,token,{status:'NOT_RELEVANT'},'PATCH');setLeads((current)=>current.map((item)=>item.id===lead.id?{...item,reviewStatus:'NOT_RELEVANT'}:item));})}>Mark not relevant</button>
    </li>)}</ul>
    {source&&<aside aria-label="Graph source details" className="rounded border p-3"><h4 className="font-bold">Synthetic fixture source snapshot</h4>
      <p>Captured {source.capturedAt}. This authored scenario reference is not an uploaded file or verified external record.</p>
      <dl>{Object.entries(source.source).map(([key,value])=><div key={key}><dt className="font-semibold">{key}</dt><dd className="break-all">{String(value)}</dd></div>)}</dl>
      <button onClick={()=>setSource(null)}>Close graph source</button>
    </aside>}
  </section>;
}
