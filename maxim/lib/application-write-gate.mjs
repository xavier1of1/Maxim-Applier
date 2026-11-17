import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readAuthority,assertLegacyWriteAllowed} from './authority-gate.mjs';

const defaultRoot=fileURLToPath(new URL('../../',import.meta.url)),held=new Map();
function location(root){
 const resolved=fs.realpathSync(root),parent=path.join(resolved,'data','maxim');
 let cursor=resolved;
 for(const part of ['data','maxim']){
  cursor=path.join(cursor,part);
  if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked application write-lock directories are refused.');
 }
 return path.join(parent,'application-write.lock');
}
function alive(pid){
 if(!Number.isInteger(pid)||pid<=0)return true;
 try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}
}
const leaseAlive=owner=>alive(owner.pid)||Boolean(owner.childPid&&alive(owner.childPid));
function ownerAt(lock){
 try{const value=JSON.parse(fs.readFileSync(path.join(lock,'owner.json'),'utf8'));if(!/^[a-f0-9-]{36}$/.test(value.token)||!Number.isInteger(value.pid))throw Error();return value;}
 catch{throw Error('Application write lease is unreadable. Preserve it and inspect the owning process before recovery.');}
}
function releaseFile(lock,token){
 if(!fs.existsSync(lock))return;
 if(fs.lstatSync(lock).isSymbolicLink()||fs.realpathSync(lock)!==lock)throw Error('Application lease escaped its owned directory.');
 const owner=ownerAt(lock);if(owner.token!==token)return;
 if(owner.childPid&&alive(owner.childPid))throw Error('An owned native batch child is still active; its write lease is retained.');
 const names=fs.readdirSync(lock);if(names.length!==1||names[0]!=='owner.json')throw Error('Unexpected files in application lease; cleanup refused.');
 fs.unlinkSync(path.join(lock,'owner.json'));fs.rmdirSync(lock);
}
export function beginLegacyApplicationWrite(root=defaultRoot){
 const resolved=fs.realpathSync(root),prior=held.get(resolved);
 if(prior){prior.depth++;return()=>{if(--prior.depth===0){releaseFile(prior.lock,prior.token);held.delete(resolved);}};}
 assertLegacyWriteAllowed('applications',resolved);
 const inherited=process.env.MAXIM_APPLICATION_WRITE_LEASE;
 if(inherited){
  const owner=ownerAt(location(resolved));
  if(owner.token!==inherited||!leaseAlive(owner))throw Error('Inherited application write lease is not active.');
  return ()=>{};
 }
 const lock=location(resolved);fs.mkdirSync(path.dirname(lock),{recursive:true});
 let acquired=false;
 for(let attempt=0;attempt<40&&!acquired;attempt++){
  try{fs.mkdirSync(lock);acquired=true;}catch(e){
   if(e.code!=='EEXIST')throw e;
   const owner=ownerAt(lock);if(!leaseAlive(owner)){releaseFile(lock,owner.token);continue;}
   Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);
  }
 }
 if(!acquired)throw Error('Application writer is busy; no mutation was acknowledged. Retry after it finishes.');
 const token=crypto.randomUUID(),entry={lock,token,depth:1};
 fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,token,startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});
 held.set(resolved,entry);
 const release=()=>{if(!held.has(resolved))return;if(--entry.depth===0){releaseFile(lock,token);held.delete(resolved);}};
 try{assertLegacyWriteAllowed('applications',resolved);}catch(e){release();throw e;}
 return release;
}
export function withLegacyApplicationWrite(fn,root=defaultRoot){
 const release=beginLegacyApplicationWrite(root);
 try{const value=fn();if(value&&typeof value.then==='function')return value.finally(release);release();return value;}catch(e){release();throw e;}
}
export async function awaitLegacyApplicationWriters(root=defaultRoot){
 const lock=location(root);
 for(let attempt=0;attempt<80;attempt++){
  if(!fs.existsSync(lock))return;
  const owner=ownerAt(lock);
  if(!leaseAlive(owner)){releaseFile(lock,owner.token);continue;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('A legacy application writer is still active. Frozen state is retained; wait, then recover/review. No process was killed.');
}
export function applicationReadState(root=defaultRoot){
 const state=readAuthority(root);return {owner:state.applications||'legacy',revision:state.applicationRevision||null,asOf:state.applicationAsOf||null,projection:true};
}
export function applicationWriteEnvironment(root=defaultRoot){
 const entry=held.get(fs.realpathSync(root));if(!entry)throw Error('No owned application write session exists.');
 return {MAXIM_APPLICATION_WRITE_LEASE:entry.token};
}
export function attachApplicationWriterChild(pid,root=defaultRoot){
 const entry=held.get(fs.realpathSync(root));if(!entry||!Number.isInteger(pid)||pid<=0)throw Error('Invalid owned writer child.');
 const owner=ownerAt(entry.lock);if(owner.token!==entry.token||owner.pid!==process.pid)throw Error('Writer child scope mismatch.');
 fs.writeFileSync(path.join(entry.lock,'owner.json'),JSON.stringify({...owner,childPid:pid}),{mode:0o600});
}
export function isManagedApplicationArtifact(file,root=defaultRoot){
 const parts=[];let cursor=path.resolve(file);
 for(let i=0;i<100&&!fs.existsSync(cursor);i++){parts.unshift(path.basename(cursor));const next=path.dirname(cursor);if(next===cursor)break;cursor=next;}
 const actual=path.join(fs.realpathSync(cursor),...parts),relative=path.relative(fs.realpathSync(root),actual).replaceAll('\\','/').toLowerCase();
 return /^(reports|output)(\/|$)/.test(relative);
}
process.once('exit',()=>{for(const entry of held.values())try{releaseFile(entry.lock,entry.token);}catch{}});
