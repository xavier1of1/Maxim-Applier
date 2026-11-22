import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as transport from './transport.mjs';
const base=new URL('../vendor/career-ops-discovery/',import.meta.url),http=new URL('./transport.mjs',import.meta.url).href;
const reverse=new URL('./reverse-contract.mjs',import.meta.url).href;
const yaml=new URL('../app/node_modules/js-yaml/dist/js-yaml.mjs',import.meta.url).href;
const allowed=new Set(['fs','fs/promises','path','url','crypto','util','buffer','async_hooks','os']);
registerHooks({resolve(specifier,context,next){
 // robots-check needs address classification, not a socket-capable network module.
 if(specifier==='node:net'&&context.parentURL===new URL('robots-check.mjs',base).href)return {url:http,shortCircuit:true};
 if(specifier.endsWith('/_http.mjs')||specifier==='./_http.mjs')return {url:http,shortCircuit:true};
 if(specifier==='js-yaml')return {url:yaml,shortCircuit:true};
 if(specifier.startsWith('node:')||!specifier.startsWith('.')&&!specifier.startsWith('file:')&&!/^[A-Z]:/i.test(specifier)){
  if(!allowed.has(specifier.replace(/^node:/,'')))throw Object.assign(new Error('Unapproved provider dependency.'),{code:'dependency_refused'});
 }
 const r=next(specifier,context);
 if(r.url.startsWith('file:')&&!r.url.startsWith(base.href)&&r.url!==http&&r.url!==reverse&&r.url!==yaml)throw Object.assign(new Error('Provider import outside pinned source.'),{code:'dependency_refused'});
 return r;
}});
globalThis.fetch=transport.fetchResponse;
console.error=()=>{};console.log=()=>{};
const reply=message=>new Promise((resolve,reject)=>process.send(message,error=>error?reject(error):resolve()));
process.once('message',async m=>{
 if(m?.type!=='execute')return;
 try{
  if(m.operation==='boundary_probe'){
   const denied={};for(const [name,fn] of Object.entries({write:()=>writeFileSync(fileURLToPath(new URL('./forbidden.tmp',import.meta.url)),'no'),read:()=>readFileSync(m.forbiddenPath),spawn:()=>spawnSync(process.execPath,['--version'])}))try{fn();denied[name]=false;}catch{denied[name]=true;}
   await reply({type:'result',value:{denied,environmentKeys:Object.keys(process.env)}});return;
  }
  const lock=JSON.parse(readFileSync(new URL('source-lock.json',base),'utf8'));
  // Integrity is checked again in the execution process before any provider import.
  for(const [file,hash] of Object.entries(lock.hashes))if(createHash('sha256').update(readFileSync(new URL(file,base))).digest('hex')!==hash)throw new Error('Pinned source integrity failure.');
  if(m.operation==='catalog_load'){
   const {loadProviders}=await import(new URL('providers/_registry.mjs',base));
   const loaded=await loadProviders(fileURLToPath(new URL('providers/',base)));await reply({type:'result',value:{loaded:[...loaded.keys()]}});return;
  }
  if(m.operation==='inventory_contract'){
   const {SOURCES}=await import(reverse),source=SOURCES[m.family];
   if(!source)throw new Error('No upstream inventory for this family.');
   let rows=m.rows||[];
   if(m.text!==undefined)rows=source.parseDataset?source.parseDataset(m.text):JSON.parse(m.text);
   if(!Array.isArray(rows)||rows.length>100000)throw new Error('Inventory must be a bounded array.');
   await reply({type:'result',value:{dataset:source.dataset,restartOnResume:source.restartOnResume===true,rows:m.text!==undefined?rows:undefined,entries:rows.slice(0,m.maxEntries||20).map((row,index)=>{const entry=source.toEntry(row);return entry?{...entry,inventoryOrdinal:index}:null;}).filter(Boolean)}});return;
  }
  if(!/^[a-z0-9-]+$/.test(m.provider)||['local-parser','torre'].includes(m.provider))throw new Error('Provider execution refused.');
  const {default:installed}=await import(new URL('providers/'+m.provider+'.mjs',base));
  const {resolveProvider}=await import(new URL('providers/_registry.mjs',base));
  const {provider}=resolveProvider({...m.entry,provider:m.provider},new Map([[installed.id,installed]]),{skipIds:['local-parser']});
  const {normalizeUrl,aggregatorPostingId}=await import(new URL('url-key.mjs',base));
  const ctx={...transport.makeHttpCtx(),normalizePostingUrl:normalizeUrl,aggregatorPostingId,titleWanted:()=>true};
  if(m.provider==='a16z-speedrun-talent'&&m.entry.maximPublicFilters){
   const allowed={metro:/^dc$/,fn:/^(engineering|product|operations|customer|sales|other)(,(engineering|product|operations|customer|sales|other))*$/,posted:/^(24h|7d|30d)$/};
   ctx.fetchJson=(url,opts)=>{
    const u=new URL(url);if(u.hostname!=='speedrun-talent-network.com'||u.pathname!=='/api/v1/jobs')throw Error('Public filter endpoint mismatch.');
    for(const [key,value] of Object.entries(m.entry.maximPublicFilters))if(allowed[key]?.test(value))u.searchParams.set(key,value);else throw Error('Unreviewed public source filter.');
    return transport.fetchJson(u.href,opts);
   };
  }
  const comments=new Map();
  if(m.provider==='hackernews'){
   const {parseHnComment}=await import(new URL('providers/hackernews.mjs',base));
   const {htmlToText}=await import(new URL('providers/_html-to-text.mjs',base));
   ctx.fetchJson=async(url,opts)=>{
    const payload=await transport.fetchJson(url,opts);
    if(Array.isArray(payload?.children))for(const child of payload.children){
     if(!child||child.dead||child.deleted||typeof child.text!=='string')continue;
     const fallback=`https://news.ycombinator.com/item?id=${child.id||child.objectID||''}`,parsed=parseHnComment(child.text,fallback);
     if(parsed)comments.set(parsed.url,htmlToText(child.text).slice(0,50000));
    }
    return payload;
   };
  }
  const jobs=await provider.fetch(m.entry,ctx);
  if(!Array.isArray(jobs))throw new Error('Provider did not return a job array.');
  const {boardTruncation}=await import(new URL('lib/board-truncation.mjs',base));
  const out=[],max=m.maxRecords||500;let bytes=0;
  const offset=Number.isSafeInteger(m.recordOffset)&&m.recordOffset>=0&&jobs.length?m.recordOffset%jobs.length:0;
  const window=[...jobs.slice(offset),...jobs.slice(0,offset)].slice(0,max);
  for(const j of window){
   const row=JSON.parse(JSON.stringify(j));
   if(comments.has(row.url)){row.description=comments.get(row.url);row.descriptionEvidence={kind:'hiring_comment_not_full_jd'};}
   for(const key of Object.keys(row))if(typeof row[key]==='string')row[key]=row[key].slice(0,key==='description'?50000:4000);
   bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>8*1024*1024)break;out.push(row);
  }
  await reply({type:'result',value:{jobs:out,returned:jobs.length,partial:boardTruncation(jobs)||out.length<jobs.length?boardTruncation(jobs)||{reason:'record_or_output_cap'}:null}});
 }catch(e){
  const status=Number(e.status||e.statusCode),code=e.code||(status===429?'quota_exceeded':[401,403].includes(status)?'auth_or_challenge':'provider_failed');
  if(process.connected)await reply({type:'error',error:{code,message:String(e.message).slice(0,500)}}).catch(()=>{});
 }
 finally{if(process.connected)process.disconnect();}
});
