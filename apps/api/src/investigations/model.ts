import { ServiceUnavailableException, ForbiddenException } from '@nestjs/common';
export type GraphPath = {
  source_case_id:string;source_vpa_id:string;account_id:string;target_vpa_id:string;target_case_id:string;
  source_report_ref:string;source_settlement_ref:string;target_settlement_ref:string;target_report_ref:string;
  source_kind:'SYSTEM_INFERENCE';verification_status:'UNVERIFIED';review_status:'NEEDS_REVIEW';data_origin:'SYNTHETIC_FIXTURE';
};
export type GraphSource = {id:string;case_id:string;from_id:string;to_id:string;relation_type:'CASE_REPORTED_VPA'|'VPA_SETTLED_TO_ACCOUNT';fixture_kind:'FICTIONAL_CASE_SCENARIO'|'FICTIONAL_SETTLEMENT_SCENARIO';source_kind:'SYSTEM_INFERENCE';verification_status:'UNVERIFIED';data_origin:'SYNTHETIC_FIXTURE';synthetic:true};
export type LeadSnapshot = {version:1;path:GraphPath;sources:GraphSource[]};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value))throw new ServiceUnavailableException();return value as Record<string,unknown>;}
function field(o:Record<string,unknown>,key:string,pattern:RegExp){const value=o[key];if(typeof value!=='string'||value.length>160||!pattern.test(value))throw new ServiceUnavailableException();return value;}
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const ref=/^fx:evidence:[a-z0-9:_-]+$/;
export function pathRefs(path:GraphPath){return [
  {id:path.source_report_ref,caseId:path.source_case_id,relation:'CASE_REPORTED_VPA',from:path.source_case_id,to:path.source_vpa_id},
  {id:path.source_settlement_ref,caseId:path.source_case_id,relation:'VPA_SETTLED_TO_ACCOUNT',from:path.source_vpa_id,to:path.account_id},
  {id:path.target_settlement_ref,caseId:path.target_case_id,relation:'VPA_SETTLED_TO_ACCOUNT',from:path.target_vpa_id,to:path.account_id},
  {id:path.target_report_ref,caseId:path.target_case_id,relation:'CASE_REPORTED_VPA',from:path.target_case_id,to:path.target_vpa_id},
];}
export function parsePath(value:unknown,root:string,allowed:string[]):GraphPath {
  const o=object(value);
  const path={source_case_id:field(o,'source_case_id',uuid),target_case_id:field(o,'target_case_id',uuid),
    source_vpa_id:field(o,'source_vpa_id',/^fx:vpa:[a-z0-9:_-]+$/),target_vpa_id:field(o,'target_vpa_id',/^fx:vpa:[a-z0-9:_-]+$/),account_id:field(o,'account_id',/^fx:account:[a-z0-9:_-]+$/),
    source_report_ref:field(o,'source_report_ref',ref),source_settlement_ref:field(o,'source_settlement_ref',ref),target_settlement_ref:field(o,'target_settlement_ref',ref),target_report_ref:field(o,'target_report_ref',ref),
    source_kind:o.source_kind,verification_status:o.verification_status,review_status:o.review_status,data_origin:o.data_origin};
  if(path.source_case_id!==root||!allowed.includes(path.source_case_id)||!allowed.includes(path.target_case_id))throw new ForbiddenException();
  if(path.source_case_id===path.target_case_id||path.source_vpa_id===path.target_vpa_id||path.source_kind!=='SYSTEM_INFERENCE'||path.verification_status!=='UNVERIFIED'||path.review_status!=='NEEDS_REVIEW'||path.data_origin!=='SYNTHETIC_FIXTURE'||new Set(pathRefs(path as GraphPath).map((r)=>r.id)).size!==4)throw new ServiceUnavailableException();
  return path as GraphPath;
}
export function parseSources(value:unknown):GraphSource[] {
  if(!Array.isArray(value)||value.length>80)throw new ServiceUnavailableException();
  const result=value.map((v)=>{
    const o=object(v);const id=field(o,'id',ref),case_id=field(o,'case_id',uuid);
    if(!['CASE_REPORTED_VPA','VPA_SETTLED_TO_ACCOUNT'].includes(String(o.relation_type))||o.fixture_kind!==(o.relation_type==='CASE_REPORTED_VPA'?'FICTIONAL_CASE_SCENARIO':'FICTIONAL_SETTLEMENT_SCENARIO')||o.source_kind!=='SYSTEM_INFERENCE'||o.verification_status!=='UNVERIFIED'||o.data_origin!=='SYNTHETIC_FIXTURE'||o.synthetic!==true)throw new ServiceUnavailableException();
    return {id,case_id,from_id:field(o,'from_id',/^[a-zA-Z0-9:_-]+$/),to_id:field(o,'to_id',/^[a-zA-Z0-9:_-]+$/),relation_type:o.relation_type,fixture_kind:o.fixture_kind,source_kind:o.source_kind,verification_status:o.verification_status,data_origin:o.data_origin,synthetic:true} as GraphSource;
  });
  if(new Set(result.map((r)=>r.id)).size!==result.length)throw new ServiceUnavailableException();return result;
}
export function validateSources(paths:GraphPath[],sources:GraphSource[]) {
  const refs=paths.flatMap(pathRefs),ids=new Set(refs.map((r)=>r.id));
  if(sources.length!==ids.size||sources.some((s)=>!ids.has(s.id)))throw new ServiceUnavailableException();
  for(const ref of refs)if(!sources.some((s)=>s.id===ref.id&&s.case_id===ref.caseId&&s.relation_type===ref.relation&&s.from_id===ref.from&&s.to_id===ref.to))throw new ServiceUnavailableException();
}
export function parseSnapshot(value:unknown,root:string,allowed:string[]):LeadSnapshot {
  const o=object(value);if(o.version!==1)throw new ServiceUnavailableException();
  const path=parsePath(o.path,root,allowed),sources=parseSources(o.sources);validateSources([path],sources);
  return {version:1,path,sources};
}
