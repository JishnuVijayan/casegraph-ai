import { readFileSync } from 'node:fs';
const bootstrap = JSON.parse(readFileSync(new URL('../../data/synthetic/bootstrap.json', import.meta.url),'utf8'));
export const GRAPH = 'CaseGraphDemoV1';
export const relationships = {
  CASE_REPORTED_VPA:['CaseReport','UPI_VPA'], CASE_REPORTED_PHONE:['CaseReport','PhoneNumber'],
  CASE_REPORTED_HANDLE:['CaseReport','SocialHandle'], CASE_REPORTED_DOMAIN:['CaseReport','PhishingDomain'],
  VPA_SETTLED_TO_ACCOUNT:['UPI_VPA','BankAccount'], RELATION_SUPPORTED_BY_EVIDENCE:['CaseReport','EvidenceRef'],
};
function settlementAccount(index) {
  if (index < 2) return 'fx:account:shared-01'; // cluster A
  if (index === 5 || index === 6) return 'fx:account:shared-02'; // cluster B
  if (index >= 7 && index <= 9) return 'fx:account:shared-03'; // cluster C
  return `fx:account:${String(index + 1).padStart(2, '0')}`;
}
export function fixture() {
  const vertices={CaseReport:[],UPI_VPA:[],BankAccount:[],PhoneNumber:[],SocialHandle:[],PhishingDomain:[],EvidenceRef:[]};
  const edges=Object.fromEntries(Object.keys(relationships).map((type)=>[type,[]]));
  for(const [index,c] of bootstrap.cases.entries()) {
    const n=String(index+1).padStart(2,'0');
    const vpa=`fx:vpa:${n}`, bank=settlementAccount(index);
    const phone=`fx:phone:${n}`, handle=`fx:handle:${n}`, domain=[3,4].includes(index)?'fx:domain:benign-shared.invalid':`fx:domain:${n}.invalid`;
    vertices.CaseReport.push({id:c.id,label:c.title,synthetic:true,generic_text_hint:[3,4].includes(index)?'FICTIONAL_GENERIC_GREETING':''});
    for(const [type,id] of [['UPI_VPA',vpa],['BankAccount',bank],['PhoneNumber',phone],['SocialHandle',handle],['PhishingDomain',domain]]) {
      if(!vertices[type].some((v)=>v.id===id))vertices[type].push({id,synthetic:true});
    }
    for(const [type,from,to] of [['CASE_REPORTED_VPA',c.id,vpa],['CASE_REPORTED_PHONE',c.id,phone],['CASE_REPORTED_HANDLE',c.id,handle],['CASE_REPORTED_DOMAIN',c.id,domain],['VPA_SETTLED_TO_ACCOUNT',vpa,bank]]) {
      const evidence_id=`fx:evidence:${n}:${type.toLowerCase()}`;
      const provenance={case_id:c.id,evidence_id,source_kind:'SYSTEM_INFERENCE',verification_status:'UNVERIFIED',review_status:'NEEDS_REVIEW',data_origin:'SYNTHETIC_FIXTURE',synthetic:true,observed_at:'2026-10-29 12:00:00'};
      vertices.EvidenceRef.push({id:evidence_id,case_id:c.id,relation_type:type,fixture_kind:type==='VPA_SETTLED_TO_ACCOUNT'?'FICTIONAL_SETTLEMENT_SCENARIO':'FICTIONAL_CASE_SCENARIO',source_kind:provenance.source_kind,verification_status:provenance.verification_status,data_origin:provenance.data_origin,synthetic:true,from_id:from,to_id:to});
      edges[type].push({from,to,...provenance});
      edges.RELATION_SUPPORTED_BY_EVIDENCE.push({from:c.id,to:evidence_id,...provenance});
    }
  }
  return {label:'FICTIONAL SYNTHETIC FIXTURE ONLY — no uploads or bank records',vertices,edges};
}
export function validateFixture(data) {
  if(data.vertices.CaseReport.length!==200) throw new Error('Expected 200 synthetic cases');
  for(const rows of Object.values(data.vertices)) {
    if(new Set(rows.map((v)=>v.id)).size!==rows.length || rows.some((v)=>v.synthetic!==true)) throw new Error('Invalid synthetic vertex identity');
  }
  const evidence=new Map(data.vertices.EvidenceRef.map((v)=>[v.id,v]));
  for(const [type,rows] of Object.entries(data.edges)) {
    const [fromType,toType]=relationships[type];
    if(new Set(rows.map((e)=>`${e.from}|${e.to}`)).size!==rows.length) throw new Error('Duplicate relation');
    for(const edge of rows) {
      const source=evidence.get(edge.evidence_id);
      if(!data.vertices[fromType].some((v)=>v.id===edge.from)||!data.vertices[toType].some((v)=>v.id===edge.to)||!source||source.case_id!==edge.case_id||edge.synthetic!==true||edge.source_kind!=='SYSTEM_INFERENCE'||edge.verification_status!=='UNVERIFIED'||edge.review_status!=='NEEDS_REVIEW'||edge.data_origin!=='SYNTHETIC_FIXTURE') throw new Error('Invalid synthetic source relationship');
      if(type.startsWith('CASE_')&&edge.from!==edge.case_id) throw new Error('Cross-case report');
      if(type==='RELATION_SUPPORTED_BY_EVIDENCE'&&(edge.from!==edge.case_id||edge.to!==edge.evidence_id)) throw new Error('Cross-case evidence');
      if(type==='VPA_SETTLED_TO_ACCOUNT'&&!data.edges.CASE_REPORTED_VPA.some((report)=>report.to===edge.from&&report.case_id===edge.case_id)) throw new Error('Settlement provenance is not owned by the reporting case');
      if(type!=='RELATION_SUPPORTED_BY_EVIDENCE'&&(source.relation_type!==type||source.from_id!==edge.from||source.to_id!==edge.to)) throw new Error('Mismatched evidence type');
    }
  }
  return data;
}
