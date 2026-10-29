import { useState } from 'react';
import { api } from './api';
export function InvestigationSharing({token,caseId,busy,perform}:{token:string;caseId:string;busy:boolean;perform:(operation:()=>Promise<void>)=>Promise<void>}) {
  const [grantId,setGrantId]=useState<string|null>(null);
  const [notice,setNotice]=useState('');
  return <section className="workspace-panel" aria-label="Investigation sharing">
    <h3>Share with the Fictional Demo Consortium</h3>
    <p>Sharing permits its demo analyst to read this case, evidence and reports and investigate graph leads. New drafts are private until explicitly shared.</p>
    <button disabled={busy} onClick={()=>void perform(async()=>{
      const grant=await api<{id:string}>(`/cases/${caseId}/shares`,token,{organizationId:'10000000-0000-4000-8000-000000000001',scope:'INVESTIGATE'},'POST');
      setGrantId(grant.id);setNotice('Investigation access explicitly granted.');
    })}>Share for investigation</button>
    {grantId&&<button disabled={busy} onClick={()=>void perform(async()=>{
      await api(`/cases/${caseId}/shares/${grantId}`,token,undefined,'DELETE');setGrantId(null);setNotice('Grant revoked. Any other active grant still applies.');
    })}>Revoke investigation access</button>}
    {notice&&<p role="status">{notice}</p>}
  </section>;
}
