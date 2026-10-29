import { BadGatewayException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
export const GRAPH_FETCH=Symbol('GRAPH_FETCH');
export const GRAPH_TOKEN_FILE=Symbol('GRAPH_TOKEN_FILE');
@Injectable()
export class GraphConfig {
  readonly enabled:boolean;readonly port:number;readonly endpoint?:string;readonly authMode:'bearer'|'secret';
  constructor(){
    const enabled=process.env.TIGERGRAPH_ENABLED??'false';
    if(!['true','false'].includes(enabled))throw new Error('TIGERGRAPH_ENABLED must be true or false.');
    this.enabled=enabled==='true';
    const authMode=process.env.TIGERGRAPH_AUTH_MODE??'bearer';
    if(authMode!=='bearer'&&authMode!=='secret')throw new Error('Invalid TIGERGRAPH_AUTH_MODE.');
    this.authMode=authMode;
    const endpoint=process.env.TIGERGRAPH_ENDPOINT;
    if(endpoint){
      let url:URL;
      try{url=new URL(endpoint);}catch{throw new Error('Invalid public Savanna workspace origin.');}
      // Public Savanna workspace origin only; never accept internal service URLs.
      if(url.protocol!=='https:'||!(/^[a-z0-9][a-z0-9-]*\.i\.tgcloud\.io$/.test(url.hostname))||url.port||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('Invalid public Savanna workspace origin.');
      this.endpoint=url.origin;
    }
    const port=process.env.TIGERGRAPH_LOCAL_PORT??'14240';this.port=Number(port);
    if(!/^\d+$/.test(port)||!Number.isInteger(this.port)||this.port<1024||this.port>65535)throw new Error('Invalid TIGERGRAPH_LOCAL_PORT.');
  }
}
@Injectable()
export class TigerGraphClient {
  constructor(private readonly config:GraphConfig,@Inject(GRAPH_FETCH) private readonly fetcher:typeof fetch,@Inject(GRAPH_TOKEN_FILE) private readonly tokenFile:string){}
  async execute(query:'find_case_links'|'get_lead_sources',params:Record<string,unknown>,signal:AbortSignal):Promise<Record<string,unknown>> {
    try{
      if(!this.config.enabled||signal.aborted||!['find_case_links','get_lead_sources'].includes(query))throw new Error('Disabled');
      const handle=await open(this.tokenFile,constants.O_RDONLY|constants.O_NOFOLLOW);let token:string;
      try{const stat=await handle.stat();if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.size>4097)throw new Error('Invalid token file');token=(await handle.readFile('utf8')).trim();}finally{await handle.close();}
      if(!/^[A-Za-z0-9._~-]{16,4096}$/.test(token))throw new Error('Invalid token');
      const boundedSignal=AbortSignal.any([signal,AbortSignal.timeout(10000)]);
      const origin=this.config.endpoint??`http://127.0.0.1:${this.config.port}`;
      const response=await this.fetcher(`${origin}/restpp/query/CaseGraphDemoV1/${query}`,{method:'POST',redirect:'error',signal:boundedSignal,headers:{Authorization:`${this.config.authMode==='secret'?'GSQL-Secret':'Bearer'} ${token}`,'Content-Type':'application/json'},body:JSON.stringify(params)});
      if(response.status===401||response.status===403){await response.body?.cancel().catch(()=>undefined);throw new BadGatewayException();}
      if(!response.ok||!response.body)throw new Error('Unavailable');
      const reader=response.body.getReader();const chunks:Buffer[]=[];let total=0;
      try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>128*1024)throw new Error('Oversize');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(body?.error!==false||!Array.isArray(body.results)||body.results.length!==1||!body.results[0]||typeof body.results[0]!=='object'||Array.isArray(body.results[0]))throw new Error('Invalid response');
      return body.results[0];
    }catch(error){if(error instanceof BadGatewayException)throw error;throw new ServiceUnavailableException();}
  }
}
