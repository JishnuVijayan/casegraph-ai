// Explicit mock transport fixture only. Never imported by application code.
import { GraphPath, GraphSource } from '../src/investigations/model';
export const caseA='30000000-0000-4000-8000-000000000001';
export const caseB='30000000-0000-4000-8000-000000000002';
export const syntheticPath:GraphPath={source_case_id:caseA,source_vpa_id:'fx:vpa:01',account_id:'fx:account:shared-01',target_vpa_id:'fx:vpa:02',target_case_id:caseB,source_report_ref:'fx:evidence:01:case_reported_vpa',source_settlement_ref:'fx:evidence:01:vpa_settled_to_account',target_settlement_ref:'fx:evidence:02:vpa_settled_to_account',target_report_ref:'fx:evidence:02:case_reported_vpa',source_kind:'SYSTEM_INFERENCE',verification_status:'UNVERIFIED',review_status:'NEEDS_REVIEW',data_origin:'SYNTHETIC_FIXTURE'};
export const syntheticSources:GraphSource[]=[
  [syntheticPath.source_report_ref,caseA,'CASE_REPORTED_VPA'],[syntheticPath.source_settlement_ref,caseA,'VPA_SETTLED_TO_ACCOUNT'],
  [syntheticPath.target_settlement_ref,caseB,'VPA_SETTLED_TO_ACCOUNT'],[syntheticPath.target_report_ref,caseB,'CASE_REPORTED_VPA'],
].map(([id,case_id,relation])=>({id,case_id,from_id:relation==='CASE_REPORTED_VPA'?case_id:(case_id===caseA?syntheticPath.source_vpa_id:syntheticPath.target_vpa_id),to_id:relation==='CASE_REPORTED_VPA'?(case_id===caseA?syntheticPath.source_vpa_id:syntheticPath.target_vpa_id):syntheticPath.account_id,relation_type:relation as GraphSource['relation_type'],fixture_kind:relation==='CASE_REPORTED_VPA'?'FICTIONAL_CASE_SCENARIO':'FICTIONAL_SETTLEMENT_SCENARIO',source_kind:'SYSTEM_INFERENCE',verification_status:'UNVERIFIED',data_origin:'SYNTHETIC_FIXTURE',synthetic:true}));
