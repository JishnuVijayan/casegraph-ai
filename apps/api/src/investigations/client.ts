import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
export const GRAPH_FETCH=Symbol('GRAPH_FETCH');
export const GRAPH_TOKEN_FILE=Symbol('GRAPH_TOKEN_FILE');
@Injectable()
export class GraphConfig {
  readonly enabled:boolean;readonly port:number;
  constructor(){
    const enabled=process.env.TIGERGRAPH_ENABLED??'false';
    if(!['true','false'].includes(enabled))throw new Error('TIGERGRAPH_ENABLED must be true or false.');
    this.enabled=enabled==='true';
    const port=process.env.TIGERGRAPH_LOCAL_PORT??'14240';this.port=Number(port);
    if(!/^\d+$/.test(port)||!Number.isInteger(this.port)||this.port<1024||this.port>65535)throw new Error('Invalid TIGERGRAPH_LOCAL_PORT.');
  }
}
@Injectable()
export class TigerGraphClient {
  constructor(private readonly config:GraphConfig,@Inject(GRAPH_FETCH) private readonly fetcher:typeof fetch,@Inject(GRAPH_TOKEN_FILE) private readonly tokenFile:string){}
  async execute(query:'find_case_links'|'get_lead_sources',params:Record<string,unknown>,signal:AbortSignal):Promise<Record<string,unknown>> {
    try{
      if(!this.config.enabled||signal.aborted)throw new Error('Disabled');
      const handle=await open(this.tokenFile,constants.O_RDONLY|constants.O_NOFOLLOW);let token:string;
      try{const stat=await handle.stat();if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.size>4097)throw new Error('Invalid token file');token=(await handle.readFile('utf8')).trim();}finally{await handle.close();}
      if(!/^[A-Za-z0-9._~-]{16,4096}$/.test(token))throw new Error('Invalid token');
      const response=await this.fetcher(`http://127.0.0.1:${this.config.port}/restpp/query/CaseGraphDemoV1/${query}`,{method:'POST',redirect:'error',signal,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(params)});
      if(!response.ok||!response.body)throw new Error('Unavailable');
      const reader=response.body.getReader();const chunks:Buffer[]=[];let total=0;
      try{for(;;){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>128*1024)throw new Error('Oversize');chunks.push(Buffer.from(value));}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
      const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if(body?.error!==false||!Array.isArray(body.results)||body.results.length!==1||!body.results[0]||typeof body.results[0]!=='object'||Array.isArray(body.results[0]))throw new Error('Invalid response');
      return body.results[0];
    }catch{throw new ServiceUnavailableException();}
  }
}
