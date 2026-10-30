import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { GraphConfig, TigerGraphClient } from '../src/investigations/client';
import { parsePath, parseSources, validateSources } from '../src/investigations/model';
import { caseA,caseB,syntheticPath,syntheticSources } from './graph-fixture';
test('strict path/source parsing rejects scope substitution and unsupported evidence',()=>{
  expect(parsePath(syntheticPath,caseA,[caseA,caseB])).toEqual(syntheticPath);
  expect(()=>parsePath(syntheticPath,caseA,[caseA])).toThrow();
  expect(()=>parsePath({...syntheticPath,source_report_ref:'https://malicious.invalid'},caseA,[caseA,caseB])).toThrow();
  expect(()=>parseSources([{...syntheticSources[0],verification_status:'EXTERNALLY_VERIFIED'}])).toThrow();
  expect(()=>validateSources([syntheticPath],syntheticSources.slice(1))).toThrow();
  expect(()=>validateSources([syntheticPath],syntheticSources.map((s)=>({...s,to_id:'fx:account:wrong'})))).toThrow();
  expect(()=>validateSources([syntheticPath],syntheticSources.map((s,i)=>i? s:{...s,case_id:caseB}))).toThrow();
});
test('disabled graph makes no request and real transport uses bounded fixed loopback endpoint',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'casegraph-t11-client-'));const token=join(dir,'app.token');
  try{
    await writeFile(token,'synthetic-test-token',{mode:0o600});
    const fetcher=jest.fn().mockResolvedValue(new Response(JSON.stringify({error:false,results:[{paths:[],classification:'SYNTHETIC_INVESTIGATIVE_LEAD'}]})));
    const disabled=new TigerGraphClient({enabled:false,port:14240} as GraphConfig,fetcher,token);
    await expect(disabled.execute('find_case_links',{},AbortSignal.timeout(1000))).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();
    const client=new TigerGraphClient({enabled:true,port:14240} as GraphConfig,fetcher,token);
    await client.execute('find_case_links',{case_id:caseA},AbortSignal.timeout(1000));
    expect(fetcher.mock.calls[0][0]).toBe('http://127.0.0.1:14240/restpp/query/CaseGraphDemoV1/find_case_links');
    expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:'error',headers:{Authorization:'Bearer synthetic-test-token'}});
    for(const response of [new Response('private error',{status:503}),new Response('x'.repeat(128*1024+1)),new Response('{"error":true}')]){
      fetcher.mockResolvedValueOnce(response);await expect(client.execute('find_case_links',{},AbortSignal.timeout(1000))).rejects.toThrow();
    }
  }finally{await rm(dir,{recursive:true,force:true});}
});
