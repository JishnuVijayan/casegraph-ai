import { join } from 'node:path';
import { lstatSync, readFileSync, writeFileSync } from 'node:fs';
import { privateDirectory, root } from '../infra/local.mjs';
import { buildBundle } from './lib/bundle.mjs';
try {
  const {files}=buildBundle();
  privateDirectory(join(root,'.local'));
  const dir=join(root,'.local','graph-t10-bundle');privateDirectory(dir);
  // Verify all existing files before adding anything; never replace an operator's file.
  for(const [name,content] of Object.entries(files)) {
    const path=join(dir,name);let stat;
    try {stat=lstatSync(path);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(stat&&(!stat.isFile()||stat.isSymbolicLink()||(stat.mode&0o777)!==0o600||readFileSync(path,'utf8')!==content))throw new Error('Existing bundle differs; preserve it and choose an explicit reviewed migration.');
  }
  for(const [name,content] of Object.entries(files)) {
    try{writeFileSync(join(dir,name),content,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;}
  }
  console.log('Synthetic deployment bundle ready at .local/graph-t10-bundle. Runtime/compiler/loading/query execution NOT verified.');
}catch{console.error('Bundle unavailable or existing files differ. No existing file was overwritten.');process.exitCode=1;}
