import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fixture, validateFixture, GRAPH } from './fixture.mjs';
const columns = {
  CaseReport:['id','label','synthetic','generic_text_hint'], UPI_VPA:['id','synthetic'],BankAccount:['id','synthetic'],
  PhoneNumber:['id','synthetic'],SocialHandle:['id','synthetic'],PhishingDomain:['id','synthetic'],
  EvidenceRef:['id','case_id','relation_type','fixture_kind','source_kind','verification_status','data_origin','synthetic'],
};
const edgeColumns=['from','to','case_id','evidence_id','source_kind','verification_status','review_status','data_origin','synthetic','observed_at'];
export function buildBundle() {
  const data=validateFixture(fixture());
  const files={};const loads=[];
  for(const [category,types] of [['VERTEX',data.vertices],['EDGE',data.edges]]) {
    for(const [type,rows] of Object.entries(types)) {
      const keys=category==='VERTEX'?columns[type]:edgeColumns;
      const csv=(value)=>`"${String(value).replaceAll('"','""')}"`;
      files[`${type}.csv`]=[keys.join(','),...rows.map((r)=>keys.map((key)=>csv(r[key])).join(','))].join('\n')+'\n';
      const variable=`f_${type}`;
      loads.push(`  DEFINE FILENAME ${variable}="/home/tigergraph/casegraph-t10/${type}.csv";\n  LOAD ${variable} TO ${category} ${type} VALUES (${keys.map((_,i)=>'$'+i).join(', ')}) USING header="true", separator=",";`);
    }
  }
  files['schema.gsql']=readFileSync(new URL('../gsql/schema.gsql',import.meta.url),'utf8');
  files['find_case_links.gsql']=readFileSync(new URL('../gsql/find_case_links.gsql',import.meta.url),'utf8');
  files['verify_fixture_inventory.gsql']=readFileSync(new URL('../gsql/verify_fixture_inventory.gsql',import.meta.url),'utf8');
  files['load.gsql']=`USE GRAPH ${GRAPH}\nCREATE LOADING JOB load_casegraph_fixture_v1 FOR GRAPH ${GRAPH} {\n${loads.join('\n')}\n}\n`;
  files['seed.gsql']=`USE GRAPH ${GRAPH}\nRUN LOADING JOB load_casegraph_fixture_v1\n`;
  const manifest={label:data.label,graph:GRAPH,liveVerified:false,vertices:Object.fromEntries(Object.entries(data.vertices).map(([k,v])=>[k,v.length])),edges:Object.fromEntries(Object.entries(data.edges).map(([k,v])=>[k,v.length])),files:Object.fromEntries(Object.keys(files).sort().map((name)=>[name,createHash('sha256').update(files[name]).digest('hex')]))};
  files['manifest.json']=JSON.stringify(manifest,null,2)+'\n';
  return {files,manifest};
}
