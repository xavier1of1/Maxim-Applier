import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as transport from './transport.mjs';
const base=new URL('../vendor/career-ops-discovery/',import.meta.url),http=new URL('./transport.mjs',import.meta.url).href;
const allowed=new Set(['fs','fs/promises','path','url','crypto','util','buffer','async_hooks']);
registerHooks({resolve(specifier,context,next){
 if(specifier.endsWith('/_http.mjs')||specifier==='./_http.mjs')return {url:http,shortCircuit:true};
 if(specifier.startsWith('node:')||!specifier.startsWith('.')&&!specifier.startsWith('file:')&&!/^[A-Z]:/i.test(specifier)){
  if(!allowed.has(specifier.replace(/^node:/,'')))throw Object.assign(new Error('Unapproved provider dependency.'),{code:'dependency_refused'});
 }
 const r=next(specifier,context);
 if(r.url.startsWith('file:')&&!r.url.startsWith(base.href)&&r.url!==http)throw Object.assign(new Error('Provider import outside pinned source.'),{code:'dependency_refused'});
 return r;
}});
globalThis.fetch=transport.fetchResponse;
console.error=()=>{};console.log=()=>{};
process.once('message',async m=>{
 if(m?.type!=='execute')return;
 try{
  if(m.operation==='boundary_probe'){
   const denied={};for(const [name,fn] of Object.entries({write:()=>writeFileSync(fileURLToPath(new URL('./forbidden.tmp',import.meta.url)),'no'),read:()=>readFileSync(m.forbiddenPath),spawn:()=>spawnSync(process.execPath,['--version'])}))try{fn();denied[name]=false;}catch{denied[name]=true;}
   process.send({type:'result',value:{denied,environmentKeys:Object.keys(process.env)}});process.disconnect();return;
  }
  const lock=JSON.parse(readFileSync(new URL('source-lock.json',base),'utf8'));
  // Integrity is checked again in the execution process before any provider import.
  for(const [file,hash] of Object.entries(lock.hashes))if(createHash('sha256').update(readFileSync(new URL(file,base))).digest('hex')!==hash)throw new Error('Pinned source integrity failure.');
  if(!/^[a-z0-9-]+$/.test(m.provider)||['local-parser','torre'].includes(m.provider))throw new Error('Provider execution refused.');
  const {default:installed}=await import(new URL('providers/'+m.provider+'.mjs',base));
  const {resolveProvider}=await import(new URL('providers/_registry.mjs',base));
  const {provider}=resolveProvider({...m.entry,provider:m.provider},new Map([[installed.id,installed]]),{skipIds:['local-parser']});
  const {normalizeUrl,aggregatorPostingId}=await import(new URL('url-key.mjs',base));
  const ctx={...transport.makeHttpCtx(),normalizePostingUrl:normalizeUrl,aggregatorPostingId,titleWanted:()=>true};
  const jobs=await provider.fetch(m.entry,ctx);
  if(!Array.isArray(jobs))throw new Error('Provider did not return a job array.');
  const {boardTruncation}=await import(new URL('lib/board-truncation.mjs',base));
  const out=[],max=m.maxRecords||500;let bytes=0;
  for(const j of jobs.slice(0,max)){
   const row=JSON.parse(JSON.stringify(j));
   for(const key of Object.keys(row))if(typeof row[key]==='string')row[key]=row[key].slice(0,key==='description'?50000:4000);
   bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>8*1024*1024)break;out.push(row);
  }
  process.send({type:'result',value:{jobs:out,returned:jobs.length,partial:boardTruncation(jobs)||out.length<jobs.length?boardTruncation(jobs)||{reason:'record_or_output_cap'}:null}});
 }catch(e){process.send({type:'error',error:{code:e.code||'provider_failed',message:String(e.message).slice(0,500)}});}
 finally{if(process.connected)process.disconnect();}
});
