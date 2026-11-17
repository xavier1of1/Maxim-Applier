import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {config} from './config';
import {transaction,database} from './db';
import {type Context,reauthorize,digest} from './auth';
import {command,event,uuid} from './commands';
import {candidateLock} from './sources';
import {applicationLock} from './application-authority';
import {applicationJournal,applicationProjection,publishApplicationProjection} from './application-projections';
import {markerLock,readMarker,marker,atomic,nativeRoot,safeTarget} from './projections';
import {collectLegacy} from './legacy-intake';
import {rollbackLegacySqlite} from './legacy-rollback';
import {invariant,notFound} from './errors';

const schema=z.object({commandId:uuid,action:z.enum(['prepare','activate','recover','rollback']),expectedRevision:z.number().int().positive(),transitionId:uuid.optional(),importId:uuid.optional(),projectionHash:z.string().length(64).optional(),confirmed:z.literal(true),reason:z.string().trim().min(3).max(1000)}).strict();
async function quietLegacy(){
 const file=pathToFileURL(path.resolve(/* turbopackIgnore: true */ process.cwd(),'../lib/application-write-gate.mjs')).href;
 const {awaitLegacyApplicationWriters}=await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ file);
 await awaitLegacyApplicationWriters(nativeRoot());
}
async function finalize(ctx:Context,id:string){
 return transaction(async tx=>{
  await reauthorize(tx,ctx);await candidateLock(tx,ctx.workspaceId);const authority=await applicationLock(tx,ctx.workspaceId);
  if(authority.transition_id!==id)return {owner:authority.owner,revision:authority.revision,publication:'superseded'};
  const transition=(await tx.query("SELECT * FROM ownership_transitions WHERE workspace_id=$1 AND id=$2 AND family='applications'",[ctx.workspaceId,id])).rows[0];if(!transition)throw notFound();
  if(authority.owner==='canonical'){
   const published=await publishApplicationProjection(tx,ctx.workspaceId,id,authority.revision);
   return {owner:'canonical',...published};
  }
  if(authority.owner==='legacy'&&transition.status==='rolled_back'&&transition.manifest.wasActive){
   await markerLock(tx);await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
   await marker({...await readMarker(),applications:'frozen',applicationTransitionId:id,reason:'application_rollback_publication'});
   await quietLegacy();
   const plan=await applicationProjection(tx,ctx.workspaceId,authority.revision);
   const sqlite=await rollbackLegacySqlite(tx,ctx.workspaceId,id,plan.applicationRecords);
   for(const [file,bytes]of Object.entries(plan.files))await atomic(path.join(/* turbopackIgnore: true */ nativeRoot(),file),bytes);
   await atomic(path.join(applicationJournal(id),'rollback-ids.json'),JSON.stringify(sqlite,null,2));
   await marker({...await readMarker(),applications:'legacy',applicationTransitionId:id,applicationRevision:authority.revision,applicationAsOf:plan.asOf,applicationFiles:plan.hashes,workspaceId:ctx.workspaceId,reason:'reviewed_application_rollback'});
   return {owner:'legacy',revision:authority.revision,asOf:plan.asOf,sqlite};
  }
  return {owner:authority.owner,revision:authority.revision};
 });
}
export async function applicationCutoverCommand(ctx:Context,raw:unknown){
 invariant(ctx.isOwner&&ctx.workspaceId===config().workspaceId,'not_found','Record not found.',404);
 const c=schema.parse(raw);
 const result=await command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);const authority=await applicationLock(tx,ctx.workspaceId);await markerLock(tx);
  await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
  invariant(authority.revision===c.expectedRevision,'revision_conflict','Application authority changed; review current state.',409);
  const candidate=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  if(c.action==='prepare'){
   invariant(authority.owner==='legacy','owner_active','Recover the staged transition or explicitly roll back the active owner first.',409);
   invariant(candidate.ownership==='canonical','candidate_authority_required','Activate reviewed candidate authority before application cutover.',409);
   invariant(c.importId,'import_required','Select the exact reviewed native import.');
   const imp=(await tx.query("SELECT * FROM legacy_imports WHERE workspace_id=$1 AND id=$2 AND status='imported'",[ctx.workspaceId,c.importId])).rows[0];if(!imp)throw notFound();
   const current=await collectLegacy();invariant(current.hash===imp.content_hash,'legacy_changed','Native sources changed since reviewed import. Capture/reconcile a new import.',409);
   const id=crypto.randomUUID(),revision=authority.revision+1,plan=await applicationProjection(tx,ctx.workspaceId,revision),baseline:Record<string,string|null>={};
   for(const [file,bytes]of Object.entries(plan.files)){
    const target=await safeTarget(path.join(/* turbopackIgnore: true */ nativeRoot(),file));
    try{const original=await fs.readFile(/* turbopackIgnore: true */ target);baseline[file]=crypto.createHash('sha256').update(original).digest('hex');await atomic(path.join(applicationJournal(id),'baseline',file),original);}
    catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')baseline[file]=null;else throw e;}
    await atomic(path.join(applicationJournal(id),'projection',file),bytes);
   }
   const manifest={sourceHash:current.hash,sourceHashes:imp.report.sourceHashes,importId:imp.id,counts:plan.counts,rawCounts:imp.report.counts,projection:plan.hashes,projectionHash:digest(JSON.stringify(plan.hashes)),baseline,priorTransitionId:authority.transition_id||null,wasActive:false,publicationProtocol:'DB owner commits before native publication; recovery never restores old files over acknowledged edits.'};
   await atomic(path.join(applicationJournal(id),'manifest.json'),JSON.stringify(manifest,null,2));
   await tx.query("INSERT INTO ownership_transitions(id,workspace_id,family,status,candidate_revision,manifest) VALUES($1,$2,'applications','staging',$3,$4)",[id,ctx.workspaceId,candidate.revision,JSON.stringify(manifest)]);
   await tx.query("UPDATE application_authority SET owner='staging',revision=$1,transition_id=$2,updated_at=now() WHERE workspace_id=$3",[revision,id,ctx.workspaceId]);
   await event(tx,ctx,id,'application_cutover_prepared',{revision,importId:imp.id,projectionHash:manifest.projectionHash,counts:plan.counts,reason:c.reason});
   return {id,status:'staging',revision,manifest};
  }
  invariant(c.transitionId,'transition_required','Select the exact prepared/active transition.');
  const transition=(await tx.query("SELECT * FROM ownership_transitions WHERE workspace_id=$1 AND id=$2 AND family='applications' FOR UPDATE",[ctx.workspaceId,c.transitionId])).rows[0];if(!transition)throw notFound();
  invariant(authority.transition_id===transition.id,'transition_superseded','This transition no longer owns application authority.',409);
  if(c.action==='activate'){
   invariant(authority.owner==='staging'&&transition.status==='staging','transition_stale','Prepare and review a current transition.',409);
   invariant(candidate.ownership==='canonical'&&candidate.revision===transition.candidate_revision,'candidate_changed','Candidate knowledge changed; recover and re-review the transition.',409);
   invariant(c.projectionHash===transition.manifest.projectionHash,'projection_review_required','Confirm the exact prepared projection hash.',409);
   for(const [file,expected]of Object.entries(transition.manifest.projection)){
    const bytes=await fs.readFile(path.join(applicationJournal(transition.id),'projection',file));
    invariant(crypto.createHash('sha256').update(bytes).digest('hex')===expected,'projection_changed','Prepared projection integrity failed.',409);
   }
   await marker({...await readMarker(),applications:'frozen',applicationTransitionId:transition.id,workspaceId:ctx.workspaceId,reason:'application_cutover'});
   await quietLegacy();
   const current=await collectLegacy();invariant(current.hash===transition.manifest.sourceHash,'legacy_changed','A legacy edit completed after review. It was preserved; recover and reconcile a fresh capture.',409);
   await tx.query("UPDATE application_authority SET owner='canonical',updated_at=now() WHERE workspace_id=$1",[ctx.workspaceId]);
   await tx.query("UPDATE ownership_transitions SET status='active',manifest=manifest||'{\"wasActive\":true}'::jsonb WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,transition.id]);
   await event(tx,ctx,transition.id,'application_authority_activated',{revision:authority.revision,reason:c.reason});
   return {id:transition.id,status:'active',revision:authority.revision};
  }
  if(c.action==='rollback'){
   invariant(authority.owner==='canonical'&&transition.status==='active','owner_inactive','Only the current canonical owner may be rolled back.',409);
   await marker({...await readMarker(),applications:'frozen',applicationTransitionId:transition.id,reason:'application_rollback'});
   const snapshot:Record<string,unknown>={};
   for(const table of ['applications','evaluations','application_packets','application_actions','legacy_key_map','events']){
    snapshot[table]=(await tx.query('SELECT * FROM '+table+' WHERE workspace_id=$1',[ctx.workspaceId])).rows;
   }
   await atomic(path.join(applicationJournal(transition.id),'rollback-state.json'),JSON.stringify({at:new Date().toISOString(),revision:authority.revision,snapshot},null,2));
   await tx.query("UPDATE application_authority SET owner='legacy',revision=revision+1,updated_at=now() WHERE workspace_id=$1",[ctx.workspaceId]);
   await tx.query("UPDATE ownership_transitions SET status='rolled_back' WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,transition.id]);
   await event(tx,ctx,transition.id,'application_authority_rolled_back',{preserved:'latest_acknowledged_canonical_state',reason:c.reason});
   return {id:transition.id,status:'rolled_back',revision:authority.revision+1};
  }
  if(authority.owner==='canonical')return {id:transition.id,status:'active',revision:authority.revision,recovery:'finish_canonical_publication'};
  if(authority.owner==='legacy'&&transition.manifest.wasActive)return {id:transition.id,status:'rolled_back',revision:authority.revision,recovery:'finish_legacy_publication'};
  invariant(authority.owner==='staging'&&transition.status==='staging','recovery_not_required','No matching interrupted preparation exists.',409);
  // No native file publication occurs before the canonical DB commit.
  // Therefore pre-commit recovery only unfreezes; it never overwrites legacy edits.
  await tx.query("UPDATE application_authority SET owner='legacy',revision=revision+1,transition_id=$1,updated_at=now() WHERE workspace_id=$2",[transition.manifest.priorTransitionId,ctx.workspaceId]);
  await tx.query("UPDATE ownership_transitions SET status='rolled_back' WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,transition.id]);
  await marker({...await readMarker(),applications:'legacy',applicationTransitionId:transition.manifest.priorTransitionId,reason:'application_preparation_recovered'});
  await event(tx,ctx,transition.id,'application_cutover_recovered',{legacyEdits:'preserved_without_overwrite',reason:c.reason});
  return {id:transition.id,status:'rolled_back',revision:authority.revision+1,recovery:'legacy_preserved'};
 });
 const publication=c.action==='prepare'?null:await finalize(ctx,result.id);
 return {...result,publication};
}
export async function applicationAuthorityView(ctx:Context){
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 const authority=(await database().query('SELECT * FROM application_authority WHERE workspace_id=$1',[ctx.workspaceId])).rows[0]||{owner:'legacy',revision:1};
 const transitions=(await database().query("SELECT id,status,candidate_revision,manifest,created_at FROM ownership_transitions WHERE workspace_id=$1 AND family='applications' ORDER BY created_at DESC LIMIT 10",[ctx.workspaceId])).rows;
 return {authority,transitions,marker:await readMarker()};
}
