import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import pg from 'pg';
import sharp from 'sharp';
import { root, readConfiguration, privateDirectory } from './local.mjs';
const database=`casegraph_t12_${randomUUID().replaceAll('-','')}`;
const args=process.argv.slice(2);
const live=args.includes('--live-graph');
let admin,parent,created=false,server,runner,interrupted=false;
function child(args,env,stdio='inherit'){return spawn(process.execPath,args,{cwd:root,env,stdio});}
function waitExit(process){return new Promise((resolve,reject)=>{process.once('error',reject);process.once('exit',(code)=>code===0?resolve():reject(new Error('Child failed')));});}
async function stop(process){
  if(!process||process.exitCode!==null||process.signalCode)return;
  await new Promise((resolve)=>{const timer=setTimeout(()=>process.kill('SIGKILL'),7000);process.once('exit',()=>{clearTimeout(timer);resolve();});process.kill('SIGTERM');});
}
async function unused(port){await new Promise((resolve,reject)=>{const socket=createServer();socket.once('error',reject);socket.listen(port,'127.0.0.1',()=>socket.close(resolve));});}
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{interrupted=true;runner?.kill('SIGTERM');server?.kill('SIGTERM');});
try{
  if(args.length>1||args.some((arg)=>arg!=='--live-graph'))throw new Error('Invalid E2E mode');
  privateDirectory(join(root,'.local'));
  await unused(13000);await unused(15173);
  const config=readConfiguration();
  if(live){
    const stat=await lstat(join(root,'.local','tigergraph-app.token'));
    if(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o777)!==0o600||stat.size<16||stat.size>4097)throw new Error('Live graph token prerequisite missing');
  }
  parent=await mkdtemp(join(tmpdir(),'casegraph-t12-'));
  await mkdir(join(parent,'fixtures'),{mode:0o700});
  for(let n=1;n<=6;n++){
    const amount=n===1?'INR 2500':n===2?'INR 800':`FICTIONAL NOTE ${n}`;
    const date=n===1?'2026-10-29':n===2?'2026-10-28':'Synthetic scenario only';
    const image=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="240"><rect width="100%" height="100%" fill="white"/><text x="30" y="75" font-family="Arial" font-size="50">SYNTHETIC ${date}</text><text x="30" y="155" font-family="Arial" font-size="50">${amount}</text></svg>`);
    await sharp(image).png().toFile(join(parent,'fixtures',`synthetic-${n}.png`));
  }
  admin=new pg.Pool({host:'127.0.0.1',port:Number(config.POSTGRES_PORT),user:'casegraph',password:config.POSTGRES_PASSWORD,database:'casegraph',connectionTimeoutMillis:3000});
  await admin.query(`CREATE DATABASE "${database}"`);created=true;
  const env={...process.env,PGPORT:config.POSTGRES_PORT,PGPASSWORD:config.POSTGRES_PASSWORD,E2E_DATABASE:database,E2E_DIRECTORY:parent,E2E_GRAPH_MODE:live?'live':'unavailable',TIGERGRAPH_ENABLED:live?'true':'false',TIGERGRAPH_LOCAL_PORT:live?(process.env.TIGERGRAPH_LOCAL_PORT??'14240'):'14240'};
  // Only the generated isolated DB is passed to this bootstrap, never the working DB.
  const bootstrap=child(['e2e/setup.mjs'],env);runner=bootstrap;await waitExit(bootstrap);runner=undefined;
  server=child(['e2e/server.mjs'],env,['ignore','pipe','pipe']);
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Server startup timeout')),30000);let output='';
    server.stdout.on('data',(chunk)=>{output+=chunk.toString();if(output.length>65536){clearTimeout(timer);reject(new Error('Startup output too large'));}if(output.includes('CASEGRAPH_E2E_READY')){clearTimeout(timer);resolve();}});
    server.once('error',()=>{clearTimeout(timer);reject(new Error('Server startup failed'));});server.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'));});
    server.stderr.resume(); // Suppress raw server diagnostics; they could contain private data.
  });
  if(interrupted)throw new Error('Interrupted');
  runner=child(['node_modules/@playwright/test/cli.js','test','--config','e2e/playwright.config.ts'],env);await waitExit(runner);runner=undefined;
  console.log(`PASS: browser workflow (${live?'real graph required':'graph unavailable expected'}); no API interception or fixture graph fallback.`);
}catch{console.error('E2E failed. Check test output, Chrome/Tesseract/local PostgreSQL and free ports 13000/15173. No working database was reset.');if(live)console.error('Live mode also requires a configured TigerGraph host/tunnel, installed queries and a private app token. Live acceptance is never silently skipped.');process.exitCode=1;}
finally{
  await stop(runner);await stop(server);
  if(created){try{await admin.query(`DROP DATABASE "${database}"`);}catch{console.error(`Cleanup pending for generated database ${database}; preserve working casegraph DB.`);process.exitCode=1;}}
  await admin?.end();
  if(parent)await rm(parent,{recursive:true,force:true});
  console.log('Owned E2E servers stopped; temporary synthetic files/database cleanup attempted. Working volume/config preserved.');
}
