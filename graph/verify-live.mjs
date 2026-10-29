import assert from 'node:assert/strict';
import { join } from 'node:path';
import { root } from '../infra/local.mjs';
import { fixture } from './lib/fixture.mjs';
import { readToken, localPort, queryLive, queryInventory, querySources } from './lib/live.mjs';
try {
  const token=readToken(join(root,'.local','tigergraph.token'));
  const port=localPort(process.env.TG_LOCAL_PORT??'14240');
  const data=fixture(), ids=data.vertices.CaseReport.map((v)=>v.id);
  const inventory=await queryInventory({port,token});
  for(const [type,rows] of Object.entries(data.vertices))assert.equal(inventory[type],rows.length);
  const run=(caseId,allowedCaseIds,maxHops=4)=>queryLive({port,token,caseId,allowedCaseIds,maxHops});
  const linked=await run(ids[0],ids);
  assert.equal(linked.classification,'SYNTHETIC_INVESTIGATIVE_LEAD');assert.equal(linked.paths.length,1);
  const p=linked.paths[0];
  assert.equal(p.source_case_id,ids[0]);assert.equal(p.target_case_id,ids[1]);
  assert.equal(p.account_id,'fx:account:shared-01');assert.notEqual(p.source_vpa_id,p.target_vpa_id);
  assert.equal(p.source_kind,'SYSTEM_INFERENCE');assert.equal(p.verification_status,'UNVERIFIED');
  assert.equal(p.review_status,'NEEDS_REVIEW');assert.equal(p.data_origin,'SYNTHETIC_FIXTURE');
  const refs=[['source_report_ref',ids[0],'CASE_REPORTED_VPA'],['source_settlement_ref',ids[0],'VPA_SETTLED_TO_ACCOUNT'],['target_settlement_ref',ids[1],'VPA_SETTLED_TO_ACCOUNT'],['target_report_ref',ids[1],'CASE_REPORTED_VPA']];
  const sources=await querySources({port,token,evidenceIds:refs.map(([key])=>p[key]),allowedCaseIds:ids});
  assert.equal(sources.length,4);
  for(const [key,caseId,relation] of refs){
    const expected=data.vertices.EvidenceRef.find((ref)=>ref.id===p[key]&&ref.case_id===caseId&&ref.relation_type===relation);
    assert(expected);
    const source=sources.find((ref)=>ref.id===p[key]);assert(source);
    for(const field of ['id','case_id','from_id','to_id','relation_type','fixture_kind','source_kind','verification_status','data_origin','synthetic'])assert.equal(source[field],expected[field]);
  }
  const scopedSources=await querySources({port,token,evidenceIds:refs.map(([key])=>p[key]),allowedCaseIds:[ids[0]]});
  assert.equal(scopedSources.length,2);assert(scopedSources.every((s)=>s.case_id===ids[0]));
  for(const id of [ids[2],ids[3],ids[4]])assert.deepEqual((await run(id,ids)).paths,[]);
  assert.deepEqual((await run(ids[0],[ids[0]])).paths,[]);
  assert.deepEqual((await run(ids[0],[])).paths,[]);
  assert.deepEqual((await run(ids[0],ids,3)).paths,[]);
  assert.equal((await run(ids[0],ids,5)).classification,'INVALID_SCOPE_OR_HOP_BOUND');
  console.log(JSON.stringify({status:'LIVE_FUNCTIONAL_CHECKS_PASSED',graph:'CaseGraphDemoV1',query:'find_case_links',synthetic:true,benchmark:false}));
}catch{
  // Never print tokens, raw server bodies, private paths or assertion values.
  console.error(JSON.stringify({status:'UNAVAILABLE_OR_VERIFICATION_FAILED',liveVerified:false,reason:'CHECK_T09_RUNTIME_TOKEN_AND_INSTALLED_T10_QUERY'}));
  process.exitCode=1;
}
