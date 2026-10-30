import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { coreServiceEnabled } from '../common/core-services';
export const GRAPH_FETCH=Symbol('GRAPH_FETCH');
export const GRAPH_TOKEN_FILE=Symbol('GRAPH_TOKEN_FILE');
@Injectable()
export class GraphConfig {
  readonly enabled:boolean;readonly port:number;
  constructor(){
    this.enabled=coreServiceEnabled('TIGERGRAPH_ENABLED');
    const port=process.env.TIGERGRAPH_LOCAL_PORT??'14240';this.port=Number(port);
    if(!/^\d+$/.test(port)||!Number.isInteger(this.port)||this.port<1024||this.port>65535)throw new Error('Invalid TIGERGRAPH_LOCAL_PORT.');
  }
}
export const GRAPH_V2 = 'CaseGraphV2';
@Injectable()
export class TigerGraphClient {
  constructor(private readonly config:GraphConfig,@Inject(GRAPH_FETCH) private readonly fetcher:typeof fetch,@Inject(GRAPH_TOKEN_FILE) private readonly tokenFile:string){}
  get enabled(){return this.config.enabled;}
  /** Fail-closed: loopback only, private 0600 token file, no redirects, bounded response. Any failure => 503. */
  private async call(path:string,method:'GET'|'POST'|'DELETE',params:unknown,signal:AbortSignal):Promise<Record<string,unknown>[]> {
    try{
      if(!this.config.enabled||signal.aborted)throw new Error('Disabled');
      const handle=await open(this.tokenFile,constants.O_RDONLY|constants.O_NOFOLLOW);let token:string;
      try{const stat=await handle.stat();if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.size>4097)throw new Error('Invalid token file');token=(await handle.readFile('utf8')).trim();}finally{await handle.close();}
      if(!/^[A-Za-z0-9._~-]{16,4096}$/.test(token))throw new Error('Invalid token');
      const headers:Record<string,string>={Authorization:`Bearer ${token}`};
      if(method==='POST')headers['Content-Type']='application/json';
      const response=await this.fetcher(`http://127.0.0.1:${this.config.port}/restpp/${path}`,{method,redirect:'error',signal,headers,body:method==='POST'?JSON.stringify(params):undefined});
      if(!response.ok||!response.body)throw new Error('Unavailable');
      const reader=response.body.getReader();const chunks:Buffer[]=[];let total=0;
      try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>256*1024)throw new Error('Oversize');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(body?.error!==false||!Array.isArray(body.results))throw new Error('Invalid response');
      return body.results;
    }catch{throw new ServiceUnavailableException();}
  }
  async execute(query:'find_case_links'|'get_lead_sources',params:Record<string,unknown>,signal:AbortSignal):Promise<Record<string,unknown>> {
    const results=await this.call(`query/CaseGraphDemoV1/${query}`,'POST',params,signal);
    if(results.length!==1||!results[0]||typeof results[0]!=='object'||Array.isArray(results[0]))throw new ServiceUnavailableException();
    return results[0];
  }
  /** v2 case network: run an installed query on CaseGraphV2. Returns every PRINT block. */
  async queryV2(query:'similar_cases',params:Record<string,unknown>,signal:AbortSignal):Promise<Record<string,unknown>[]> {
    return this.call(`query/${GRAPH_V2}/${query}`,'POST',params,signal);
  }
  /** v2 case network: RESTPP upsert of vertices and edges. */
  async upsertV2(payload:{vertices?:unknown;edges?:unknown},signal:AbortSignal):Promise<void> {
    await this.call(`graph/${GRAPH_V2}`,'POST',payload,signal);
  }
  /** Remove a case's old MENTIONS edges before re-upserting (claims may have been corrected). */
  async clearMentionsV2(caseId:string,signal:AbortSignal):Promise<void> {
    if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(caseId))throw new ServiceUnavailableException();
    await this.call(`graph/${GRAPH_V2}/edges/Complaint/${caseId}/MENTIONS`,'DELETE',undefined,signal);
  }
}
