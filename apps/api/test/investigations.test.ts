import { mkdtemp, readFile, readdir, writeFile, rm } from 'node:fs/promises';
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

test('Savanna config accepts only public HTTPS workspace origins and supported auth modes',()=>{
  const previous={...process.env};
  try{
    delete process.env.TIGERGRAPH_ENDPOINT;delete process.env.TIGERGRAPH_AUTH_MODE;
    expect(new GraphConfig().endpoint).toBeUndefined();
    for(const endpoint of ['http://demo.i.tgcloud.io','https://api.tgcloud.io','https://graph.svc','https://127.0.0.1','https://demo.i.tgcloud.io/path','https://user:secret@demo.i.tgcloud.io','https://demo.i.tgcloud.io?token=secret','https://demo.i.tgcloud.io#secret','https://demo.i.tgcloud.io:9000']){
      process.env.TIGERGRAPH_ENDPOINT=endpoint;expect(()=>new GraphConfig()).toThrow();
    }
    process.env.TIGERGRAPH_ENDPOINT='https://demo.i.tgcloud.io/';process.env.TIGERGRAPH_AUTH_MODE='secret';
    expect(new GraphConfig()).toMatchObject({endpoint:'https://demo.i.tgcloud.io',authMode:'secret'});
    process.env.TIGERGRAPH_AUTH_MODE='api-key';expect(()=>new GraphConfig()).toThrow();
  }finally{process.env=previous;}
});

test('user-reported Savanna results validate path and every source binding; fixtures are not live proof',async()=>{
  const observed=JSON.parse(await readFile(join(__dirname,'fixtures/savanna-observed.json'),'utf8'));
  const path=parsePath(observed.paths.results[0].paths[0],caseA,[caseA,caseB]);
  const sources=parseSources(observed.sources.results[0].sources);validateSources([path],sources);
  expect(path).toEqual(syntheticPath);expect(sources).toHaveLength(4);
  expect(()=>parsePath(path,caseA,[])).toThrow();
  expect(()=>parsePath(path,caseA,[caseA])).toThrow();
});

test('HTTPS uses fixed queries, private backend credentials and sanitized authentication/outage failures',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'casegraph-savanna-'));const token=join(dir,'app.token');
  try{
    await writeFile(token,'synthetic-test-token',{mode:0o600});
    const observed=JSON.parse(await readFile(join(__dirname,'fixtures/savanna-observed.json'),'utf8'));
    const fetcher=jest.fn().mockResolvedValue(new Response(JSON.stringify(observed.paths)));
    const config={enabled:true,port:14240,endpoint:'https://demo.i.tgcloud.io',authMode:'secret'} as GraphConfig;
    const client=new TigerGraphClient(config,fetcher,token);
    expect(await client.execute('find_case_links',{},AbortSignal.timeout(1000))).toEqual(observed.paths.results[0]);
    expect(fetcher.mock.calls[0][0]).toBe('https://demo.i.tgcloud.io/restpp/query/CaseGraphDemoV1/find_case_links');
    expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:'error',headers:{Authorization:'GSQL-Secret synthetic-test-token'}});
    for(const status of [401,403]){
      fetcher.mockResolvedValueOnce(new Response('secret upstream details',{status}));
      await expect(client.execute('get_lead_sources',{},AbortSignal.timeout(1000))).rejects.toMatchObject({status:502,message:'Bad Gateway'});
    }
    for(const response of [new Response('redirect',{status:302}),new Response('private',{status:503}),new Response('not JSON'),new Response('{"error":false,"results":[]}')]){
      fetcher.mockResolvedValueOnce(response);await expect(client.execute('find_case_links',{},AbortSignal.timeout(1000))).rejects.toMatchObject({status:503,message:'Service Unavailable'});
    }
    fetcher.mockRejectedValueOnce(new Error('private network details'));
    await expect(client.execute('find_case_links',{},AbortSignal.timeout(1000))).rejects.toMatchObject({status:503});
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({error:false,results:[{classification:'SYNTHETIC_INVESTIGATIVE_LEAD',paths:[]}]})));
    expect(await client.execute('find_case_links',{},AbortSignal.timeout(1000))).toMatchObject({paths:[]});
    const calls=fetcher.mock.calls.length;
    await expect(client.execute('find_case_links',{},AbortSignal.abort())).rejects.toMatchObject({status:503});expect(fetcher).toHaveBeenCalledTimes(calls);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('transport enforces its own timeout even without a caller deadline',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'casegraph-timeout-'));const token=join(dir,'app.token');
  try{
    await writeFile(token,'synthetic-test-token',{mode:0o600});
    const fetcher=jest.fn().mockImplementation((_url,options)=>new Promise((_resolve,reject)=>{
      options.signal.addEventListener('abort',()=>reject(new Error('timeout private details')),{once:true});
    }));
    const client=new TigerGraphClient({enabled:true,port:14240} as GraphConfig,fetcher,token);
    await expect(client.execute('find_case_links',{},new AbortController().signal)).rejects.toMatchObject({status:503});
  }finally{await rm(dir,{recursive:true,force:true});}
},15000);

// Regression guard: graph credentials/configuration remain backend-only.
test('frontend sources do not consume graph credentials or call Savanna directly',async()=>{
  const root=join(__dirname,'../../web/src');
  for(const name of await readdir(root,{recursive:true})){
    if(!/\.(tsx?|css)$/.test(name))continue;
    const source=await readFile(join(root,name),'utf8');
    expect(source).not.toMatch(/TIGERGRAPH_(?:ENDPOINT|AUTH_MODE|ENABLED|LOCAL_PORT|SECRET|TOKEN|PASSWORD)|GSQL-Secret|\.i\.tgcloud\.io|tigergraph-app\.token/);
  }
});
