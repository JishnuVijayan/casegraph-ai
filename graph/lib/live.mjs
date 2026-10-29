import { constants, closeSync, fstatSync, openSync, readFileSync } from 'node:fs';
import { GRAPH } from './fixture.mjs';
export function readToken(path) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile()||(stat.mode&0o777)!==0o600||stat.size>4097)throw new Error('Invalid private token file');
    const token=readFileSync(fd,'utf8').trim();
    if(!/^[A-Za-z0-9._~-]{16,4096}$/.test(token))throw new Error('Invalid token');
    return token;
  }finally{closeSync(fd);}
}
export function localPort(value='14240') {
  if(!/^\d+$/.test(String(value)))throw new Error('Invalid local port');
  const port=Number(value);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');return port;
}
async function postInstalled(name,params,{port,token,fetchImpl=fetch}) {
  const response=await fetchImpl(`http://127.0.0.1:${localPort(port)}/restpp/query/${GRAPH}/${name}`,{
    method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),
    headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(params),
  });
  if(!response.ok||!response.body)throw new Error('Live query unavailable');
  const reader=response.body.getReader();let size=0;const chunks=[];
  try {
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>128*1024)throw new Error('Query response too large');chunks.push(Buffer.from(value));}
  }finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(data.error!==false||!Array.isArray(data.results)||data.results.length!==1)throw new Error('Invalid query result');
  return data.results[0];
}
export async function queryLive(options) {
  const {caseId,allowedCaseIds,maxHops=4}=options;
  const result=await postInstalled('find_case_links',{case_id:caseId,max_hops:maxHops,allowed_case_ids:allowedCaseIds},options);
  if(!Array.isArray(result.paths)||!['SYNTHETIC_INVESTIGATIVE_LEAD','INVALID_SCOPE_OR_HOP_BOUND'].includes(result.classification))throw new Error('Missing synthetic result label');
  return result;
}
export async function queryInventory(options) {
  return postInstalled('verify_fixture_inventory',{},options);
}
