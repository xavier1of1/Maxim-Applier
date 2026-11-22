import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {config} from './config';
import {database,transaction} from './db';
import {reauthorize,type Context} from './auth';
import {command,event,uuid} from './commands';
import {candidateLock} from './sources';
import {checkLease,finishWork,type WorkItem} from './work';
import {invariant,notFound} from './errors';
import {assertDisclosureText} from './candidate-context';

const files=['cv.md','config/profile.yml','modes/_profile.md','article-digest.md'];
const hash=(bytes:string|Buffer)=>crypto.createHash('sha256').update(bytes).digest('hex');
export const nativeRoot=()=>config().testMode?path.join(config().privateRoot,'native'):path.resolve(/* turbopackIgnore: true */ process.cwd(),'../..');
const journalRoot=()=>path.join(config().privateRoot,'cutovers');
const markerFile=()=>path.join(nativeRoot(),'data/maxim/authority.json');
export async function safeTarget(target:string){
 const allowed=[nativeRoot(),journalRoot()].map(p=>path.resolve(/* turbopackIgnore: true */ p));
 const root=allowed.find(p=>target.startsWith(p+path.sep));
 invariant(root,'invalid_path','Projection target is outside its owned directory.');
 await fs.mkdir(root,{recursive:true,mode:0o700});
 const actualRoot=await fs.realpath(root);
 let cursor=root;
 for(const part of path.relative(root,target).split(path.sep)){
  cursor=path.join(cursor,part);
  try{
   const stat=await fs.lstat(cursor);
   invariant(!stat.isSymbolicLink(),'invalid_path','Linked projection paths are refused.');
   const actual=await fs.realpath(cursor);
   invariant(actual.startsWith(actualRoot+path.sep),'invalid_path','Projection path escaped its owned directory.');
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 }
 return target;
}
export async function atomic(target:string,bytes:string|Buffer){
 await safeTarget(target);
 await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});
 const temp=target+'.'+crypto.randomUUID()+'.new';
 await fs.writeFile(temp,bytes,{flag:'wx',mode:0o600});await fs.rename(temp,target);
}
export async function marker(value:unknown){await atomic(markerFile(),JSON.stringify(value,null,2));}
export async function readMarker(){
 try{
  const value=JSON.parse(await fs.readFile(markerFile(),'utf8'));
  invariant(value&&typeof value==='object'&&['candidate','applications'].every(k=>!value[k]||['legacy','canonical','frozen'].includes(value[k])),'authority_marker_unreadable','Authority marker is invalid; implicit legacy fallback is refused.',503);
  return value;
 }catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};invariant(false,'authority_marker_unreadable','Authority marker is unreadable; preserve and recover it before continuing.',503);}
}
export async function markerLock(tx:PoolClient){await tx.query('SELECT pg_advisory_xact_lock(120033)');}
async function current(tx:PoolClient,workspaceId:string){
 const candidate=(await tx.query('SELECT * FROM candidates WHERE workspace_id=$1 FOR UPDATE',[workspaceId])).rows[0];
 const facts=(await tx.query("SELECT f.*,s.model_consent,s.classification FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND s.deleted_at IS NULL AND f.source_revision=s.revision ORDER BY field_key",[workspaceId])).rows;
 return {candidate,facts};
}
export function render(revision:number,facts:Array<Record<string,any>>){
 const disclosed=facts.filter(f=>f.model_consent&&f.classification!=='restricted'&&f.sensitivity==='standard');
 for(const fact of disclosed)assertDisclosureText(JSON.stringify(fact.value));
 const values=new Map(disclosed.map(f=>[f.field_key,f.value]));
 const text=(v:unknown)=>typeof v==='string'?v:JSON.stringify(v);
 const lines=disclosed.map(f=>'- '+f.field_key+': '+text(f.value));
 const profile:Record<string,unknown>={candidate:{},cv:{output_format:'html'},maxim_projection:{candidate_revision:revision,approved_fields:disclosed.length,partial:disclosed.length!==facts.length}};
 const candidate:Record<string,unknown>={};
 for(const [from,to]of[['candidate.name','full_name'],['candidate.location','location'],['candidate.linkedin','linkedin'],['candidate.github','github'],['candidate.portfolio','portfolio_url']])if(values.has(from))candidate[to]=values.get(from);
 profile.candidate=candidate;
 if(values.has('preferences.roles'))profile.target_roles={primary:values.get('preferences.roles')};
 if(values.has('preferences.seniority')){
  const levels=values.get('preferences.seniority'),roles=values.get('preferences.roles');
  profile.target_roles={...(profile.target_roles as Record<string,unknown>||{}),seniority:levels,
   ...(Array.isArray(roles)&&Array.isArray(levels)?{archetypes:roles.map(name=>({name,level:levels.join(' / '),fit:'primary'}))}:{})};
 }
 if(values.has('positioning.headline'))profile.narrative={headline:values.get('positioning.headline')};
 const header='<!-- Generated approved, model-disclosable Career-Ops projection. Edit the candidate workspace, not this file. Revision '+revision+'. -->\n';
 return {
  'cv.md':header+'# '+(values.get('candidate.name')||'Candidate context')+'\n\n'+lines.join('\n')+'\n',
  'config/profile.yml':JSON.stringify(profile,null,2)+'\n',
  'modes/_profile.md':header+'# Reviewed Candidate Overrides\n\n'+lines.join('\n')+'\n',
  'article-digest.md':header+'# Reviewed Project Evidence\n\n'+disclosed.filter(f=>f.field_key.startsWith('projects.')).map(f=>'- '+text(f.value)).join('\n')+'\n',
 };
}
async function hashes(root:string){
 const result:Record<string,string|null>={};
 for(const file of files){try{const target=await safeTarget(path.join(/* turbopackIgnore: true */ root,file));result[file]=hash(await fs.readFile(/* turbopackIgnore: true */ target));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')result[file]=null;else throw e;}}
 return result;
}
async function syncFiles(tx:PoolClient,workspaceId:string,transitionId:string){
 await markerLock(tx);
 await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
 const {candidate,facts}=await current(tx,workspaceId);
 invariant(candidate.ownership==='canonical','owner_inactive','Candidate ownership is not canonical.',409);
 const output=render(candidate.revision,facts),sums:Record<string,string>={};
 await marker({...await readMarker(),candidate:'frozen',workspaceId,transitionId,reason:'projection_refresh'});
 for(const [file,content]of Object.entries(output)){await atomic(path.join(nativeRoot(),file),content);sums[file]=hash(content);}
 await marker({...await readMarker(),candidate:'canonical',workspaceId,transitionId,candidateRevision:candidate.revision,files:sums,disclosedCount:facts.filter(f=>f.model_consent&&f.sensitivity==='standard').length,asOf:new Date().toISOString()});
 return {revision:candidate.revision,files:sums};
}
export async function projectionWork(item:WorkItem){
 return transaction(async tx=>{
  await candidateLock(tx,item.workspace_id);await checkLease(tx,item);
  const transition=(await tx.query("SELECT id FROM ownership_transitions WHERE workspace_id=$1 AND family='candidate' AND status='active' ORDER BY created_at DESC LIMIT 1",[item.workspace_id])).rows[0];
  invariant(transition,'owner_inactive','No active candidate cutover.',409);
  const result=await syncFiles(tx,item.workspace_id,transition.id);
  await finishWork(tx,item,result);
 });
}
export async function authorityView(ctx:Context){
 const candidate=(await database().query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
 const transitions=(await database().query("SELECT id,status,candidate_revision,created_at,manifest FROM ownership_transitions WHERE workspace_id=$1 AND family='candidate' ORDER BY created_at DESC LIMIT 10",[ctx.workspaceId])).rows;
 return {candidate,transitions:transitions.map(t=>({...t,manifest:{baseline:t.manifest.baseline,projection:t.manifest.projection,factCount:t.manifest.factCount,disclosedCount:t.manifest.disclosedCount}})),projection:ctx.isOwner?await readMarker():null};
}
export async function projectionPreview(ctx:Context){
 return transaction(async tx=>{await candidateLock(tx,ctx.workspaceId);const state=await current(tx,ctx.workspaceId);return {revision:state.candidate.revision,files:render(state.candidate.revision,state.facts),factCount:state.facts.length,disclosedCount:state.facts.filter(f=>f.model_consent&&f.sensitivity==='standard').length};});
}
export async function cutoverCommand(ctx:Context,raw:unknown){
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 const c=z.object({commandId:uuid,action:z.enum(['prepare','activate','recover','rollback']),expectedRevision:z.number().int().positive(),transitionId:uuid.optional()}).strict().parse(raw);
 const result=await command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);
  await markerLock(tx);
  await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
  const state=await current(tx,ctx.workspaceId);
  invariant(state.candidate.revision===c.expectedRevision,'revision_conflict','Candidate knowledge changed. Review the projection again.',409);
  if(c.action==='prepare'){
   invariant(state.candidate.ownership!=='canonical','owner_active','Candidate ownership is already canonical.',409);
   invariant(state.facts.length>0,'facts_missing','Confirm at least one fact before preparing cutover.',409);
   const id=crypto.randomUUID(),root=path.join(journalRoot(),id),baseline=await hashes(nativeRoot()),output=render(state.candidate.revision,state.facts),projection:Record<string,string>={};
   await fs.mkdir(root,{recursive:true,mode:0o700});
   for(const file of files){
    if(baseline[file]!==null)await atomic(path.join(root,'baseline',file),await fs.readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ nativeRoot(),file)));
    await atomic(path.join(root,'projection',file),output[file as keyof typeof output]);projection[file]=hash(output[file as keyof typeof output]);
   }
   const manifest={baseline,projection,factCount:state.facts.length,disclosedCount:state.facts.filter(f=>f.model_consent&&f.sensitivity==='standard').length};
   await atomic(path.join(root,'manifest.json'),JSON.stringify(manifest,null,2));
   await tx.query("INSERT INTO ownership_transitions(id,workspace_id,family,status,candidate_revision,manifest) VALUES($1,$2,'candidate','staging',$3,$4)",[id,ctx.workspaceId,state.candidate.revision,JSON.stringify(manifest)]);
   await tx.query("UPDATE candidates SET ownership='staging' WHERE workspace_id=$1",[ctx.workspaceId]);
   await event(tx,ctx,id,'candidate_cutover_prepared',{revision:state.candidate.revision,factCount:state.facts.length});
   return {id,status:'staging',manifest};
  }
  invariant(c.transitionId,'transition_required','Select the exact prepared transition.');
  const transition=(await tx.query("SELECT * FROM ownership_transitions WHERE id=$1 AND workspace_id=$2 AND family='candidate' FOR UPDATE",[c.transitionId,ctx.workspaceId])).rows[0];
  if(!transition)throw notFound();
  const root=path.join(journalRoot(),transition.id);
  if(c.action==='activate'){
   invariant(transition.status==='staging'&&transition.candidate_revision===state.candidate.revision,'transition_stale','Prepare and review a fresh transition.',409);
   const actual=await hashes(nativeRoot()),prepared=await hashes(path.join(root,'projection'));
   invariant(files.every(file=>actual[file]===transition.manifest.baseline[file]),'legacy_changed','Native candidate files changed. Reconcile before activating.',409);
   invariant(files.every(file=>prepared[file]===transition.manifest.projection[file]),'projection_changed','Prepared projection integrity failed.',409);
   await marker({...await readMarker(),candidate:'frozen',workspaceId:ctx.workspaceId,transitionId:transition.id,reason:'candidate_cutover'});
   for(const file of files)await atomic(path.join(/* turbopackIgnore: true */ nativeRoot(),file),await fs.readFile(path.join(root,'projection',file)));
   await tx.query("UPDATE candidates SET ownership='canonical' WHERE workspace_id=$1",[ctx.workspaceId]);
   await tx.query("UPDATE ownership_transitions SET status='active' WHERE id=$1 AND workspace_id=$2",[transition.id,ctx.workspaceId]);
   await event(tx,ctx,transition.id,'candidate_authority_activated',{revision:state.candidate.revision});
   return {id:transition.id,status:'active'};
  }
  if(c.action==='rollback'){
   invariant(transition.status==='active'&&state.candidate.ownership==='canonical','owner_inactive','Only the active owner can be rolled back.',409);
   // Preserve every acknowledged fact privately; return file ownership with the latest permitted projection.
   await atomic(path.join(root,'rollback-facts.json'),JSON.stringify({revision:state.candidate.revision,facts:state.facts},null,2));
   await syncFiles(tx,ctx.workspaceId,transition.id);
   await marker({...await readMarker(),candidate:'frozen',reason:'candidate_rollback'});
   await tx.query("UPDATE candidates SET ownership='legacy' WHERE workspace_id=$1",[ctx.workspaceId]);
   await tx.query("UPDATE ownership_transitions SET status='rolled_back' WHERE id=$1 AND workspace_id=$2",[transition.id,ctx.workspaceId]);
   await event(tx,ctx,transition.id,'candidate_authority_rolled_back',{preservedRevision:state.candidate.revision,export:'private_rollback_facts',baseline:'retained'});
   return {id:transition.id,status:'rolled_back',preservedRevision:state.candidate.revision};
  }
  if(state.candidate.ownership!=='canonical'&&transition.status==='staging'){
   const existing=await readMarker();
   invariant(existing.candidate==='frozen'&&existing.transitionId===transition.id&&existing.workspaceId===ctx.workspaceId,'recovery_not_required','Only the matching interrupted transition can be recovered.',409);
   const actual=await hashes(nativeRoot());
   invariant(files.every(file=>actual[file]===transition.manifest.baseline[file]||actual[file]===transition.manifest.projection[file]),'legacy_changed','Native files contain additional edits. Preserve and reconcile them before recovery.',409);
   for(const file of files){
    if(transition.manifest.baseline[file]===null){
     const target=await safeTarget(path.resolve(nativeRoot(),file));
     invariant(target.startsWith(path.resolve(nativeRoot())+path.sep),'invalid_path','Invalid projection target.');
     await fs.unlink(target).catch(e=>{if(e.code!=='ENOENT')throw e;});
    }else await atomic(path.join(/* turbopackIgnore: true */ nativeRoot(),file),await fs.readFile(path.join(root,'baseline',file)));
   }
   await tx.query("UPDATE candidates SET ownership='legacy' WHERE workspace_id=$1",[ctx.workspaceId]);
   await event(tx,ctx,transition.id,'candidate_cutover_recovered',{owner:'legacy'});
  }
  return {id:transition.id,status:transition.status};
 });
 if(c.action!=='prepare')await transaction(async tx=>{
  await reauthorize(tx,ctx);await candidateLock(tx,ctx.workspaceId);
  const state=await current(tx,ctx.workspaceId);
  if(state.candidate.ownership==='canonical')await syncFiles(tx,ctx.workspaceId,result.id);
  else await marker({...await readMarker(),candidate:'legacy',workspaceId:ctx.workspaceId,transitionId:result.id,asOf:new Date().toISOString()});
 });
 return result;
}
