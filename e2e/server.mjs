// Test-only bootstrap: real API/Vite, isolated DB/storage, no fixture graph provider.
import 'reflect-metadata';
import cjsModule1 from '@nestjs/testing';
const {Test}=cjsModule1;
import {join,resolve,basename} from 'node:path';
import {lstat} from 'node:fs/promises';
import cjsModule4 from '../apps/api/dist/app.module.js';
const {AppModule}=cjsModule4;
import cjsModule5 from '../apps/api/dist/auth/config.js';
const {DemoConfig}=cjsModule5;
import cjsModule6 from '../apps/api/dist/auth/store.js';
const {LOCAL_DATABASE}=cjsModule6;
import cjsModule7 from '../apps/api/dist/db/connection.js';
const {connect}=cjsModule7;
import cjsModule8 from '../apps/api/dist/common/http.js';
const {configureHttp}=cjsModule8;
import cjsModule9 from '../apps/api/dist/evidence/storage.js';
const {EVIDENCE_DIRECTORY}=cjsModule9;
import cjsModule10 from '../apps/api/dist/investigations/client.js';
const {GraphConfig}=cjsModule10;
let app,web,stopping=false;
async function stop(){if(stopping)return;stopping=true;await web?.close();await app?.close();}
async function start(){
  const database=process.env.E2E_DATABASE;
  const parent=process.env.E2E_DIRECTORY;
  if(!/^casegraph_t12_[a-f0-9]{32}$/.test(database??'')||!parent||!basename(parent).startsWith('casegraph-t12-'))throw new Error('Invalid isolated environment');
  const stat=await lstat(parent);if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o777)!==0o700)throw new Error('Invalid private directory');
  const mode=process.env.E2E_GRAPH_MODE;if(!['unavailable','live'].includes(mode))throw new Error('Invalid graph mode');
  const port=Number(process.env.TIGERGRAPH_LOCAL_PORT??'14240');if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid graph port');
  const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(DemoConfig).useValue({enabled:true,ttlMs:1800000})
    .overrideProvider(LOCAL_DATABASE).useValue(connect(database)).overrideProvider(EVIDENCE_DIRECTORY).useValue(join(parent,'evidence'))
    .overrideProvider(GraphConfig).useValue(mode==='live'?{...new GraphConfig(),enabled:true}:{enabled:false,port}).compile();
  app=module.createNestApplication({logger:false});configureHttp(app);await app.listen(13000,'127.0.0.1');
  const {createServer}=await import('vite');
  web=await createServer({configFile:resolve('apps/web/vite.config.ts'),root:resolve('apps/web'),logLevel:'silent',server:{host:'127.0.0.1',port:15173,strictPort:true,proxy:{'/api':'http://127.0.0.1:13000'}}});
  await web.listen();console.log('CASEGRAPH_E2E_READY');
}
process.once('SIGTERM',()=>{void stop().then(()=>process.exit(0));});
process.once('SIGINT',()=>{void stop().then(()=>process.exit(0));});
void start().catch(async()=>{console.error('Isolated E2E server unavailable. Check prerequisites/ports.');await stop();process.exitCode=1;});
