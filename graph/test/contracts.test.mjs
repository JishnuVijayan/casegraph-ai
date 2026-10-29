import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fixture, validateFixture } from '../lib/fixture.mjs';
import { buildBundle } from '../lib/bundle.mjs';
import { localPort, readToken, queryLive } from '../lib/live.mjs';
// OFFLINE REFERENCE ONLY: never imported by application code or live verification.
function referencePairs(data,allowed) {
  const pairs=[];
  for(const first of data.edges.CASE_REPORTED_VPA)for(const a of data.edges.VPA_SETTLED_TO_ACCOUNT) {
    if(first.to!==a.from||first.case_id!==a.case_id||!allowed.includes(first.case_id))continue;
    for(const b of data.edges.VPA_SETTLED_TO_ACCOUNT)for(const last of data.edges.CASE_REPORTED_VPA){
      if(a.to===b.to&&b.from===last.to&&last.case_id===b.case_id&&first.case_id!==last.case_id&&allowed.includes(last.case_id))pairs.push([first.case_id,last.case_id]);
    }
  }
  return pairs;
}
test('twenty fictional cases have valid typed provenance and only expected account pairs',()=>{
  const data=validateFixture(fixture()),ids=data.vertices.CaseReport.map((c)=>c.id);
  assert.deepEqual(referencePairs(data,ids),[[ids[0],ids[1]],[ids[1],ids[0]]]);
  assert.deepEqual(referencePairs(data,[ids[0]]),[]);assert.deepEqual(referencePairs(data,[]),[]);
  const benign=data.edges.CASE_REPORTED_DOMAIN.filter((e)=>[ids[3],ids[4]].includes(e.case_id));
  assert.equal(benign[0].to,benign[1].to);
  const broken=structuredClone(data);broken.edges.CASE_REPORTED_VPA[0].case_id=ids[1];
  assert.throws(()=>validateFixture(broken));
  const verified=structuredClone(data);verified.edges.VPA_SETTLED_TO_ACCOUNT[0].verification_status='EXTERNALLY_VERIFIED';
  assert.throws(()=>validateFixture(verified));
});
test('bundle is deterministic, preserves case IDs and contains no destructive reset or secret',()=>{
  const a=buildBundle(),b=buildBundle();assert.deepEqual(a,b);assert.equal(a.manifest.liveVerified,false);
  assert.equal(a.manifest.vertices.CaseReport,20);assert.equal(a.manifest.vertices.EvidenceRef,100);
  assert.equal(a.manifest.edges.VPA_SETTLED_TO_ACCOUNT,20);
  assert.doesNotMatch(a.files['schema.gsql'],/\bDROP\s+(GRAPH|ALL|VERTEX|EDGE)\b/i);
  assert.match(a.files['find_case_links.gsql'],/allowed_case_ids\.contains\(t.case_id\)/);
  assert.match(a.files['find_case_links.gsql'],/max_hops == 4/);
});
test('live verifier rejects invalid local configuration and unsafe token files',()=>{
  const dir=mkdtempSync(join(tmpdir(),'casegraph-t10-token-'));
  try{
    const token=join(dir,'token');writeFileSync(token,'synthetic-test-token',{mode:0o600});assert.equal(readToken(token),'synthetic-test-token');
    const link=join(dir,'link');symlinkSync(token,link);assert.throws(()=>readToken(link));
    const publicFile=join(dir,'public');writeFileSync(publicFile,'synthetic-test-token',{mode:0o644});assert.throws(()=>readToken(publicFile));
    for(const value of ['https://remote.invalid','0','70000','14240/path'])assert.throws(()=>localPort(value));
  }finally{rmSync(dir,{recursive:true,force:true});}
});
test('mock transport has no silent fallback and sends only the fixed installed query',async()=>{
  let captured;
  const result=await queryLive({port:14240,token:'synthetic-test-token',caseId:'synthetic-case',allowedCaseIds:['synthetic-case'],fetchImpl:async(url,options)=>{
    captured={url,options};return new Response(JSON.stringify({error:false,results:[{paths:[],classification:'SYNTHETIC_INVESTIGATIVE_LEAD'}]}));
  }});
  assert.deepEqual(result.paths,[]);assert.match(captured.url,/^http:\/\/127\.0\.0\.1:14240\/restpp\/query\/CaseGraphDemoV1\/find_case_links$/);
  assert.equal(captured.options.redirect,'error');assert.equal(captured.options.headers.Authorization,'Bearer synthetic-test-token');
  assert.deepEqual(JSON.parse(captured.options.body).allowed_case_ids,['synthetic-case']);
  for(const body of ['{"error":true}', '<html>login</html>',JSON.stringify({error:false,results:[{paths:[],classification:'verified criminals'}]}),'x'.repeat(128*1024+1)]){
    await assert.rejects(()=>queryLive({port:14240,token:'synthetic-test-token',caseId:'synthetic-case',allowedCaseIds:[],fetchImpl:async()=>new Response(body)}));
  }
  await assert.rejects(()=>queryLive({port:14240,token:'synthetic-test-token',caseId:'synthetic-case',allowedCaseIds:[],fetchImpl:async()=>{throw new Error('offline');}}));
});
