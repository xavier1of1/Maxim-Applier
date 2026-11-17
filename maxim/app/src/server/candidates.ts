import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import type {Context} from './auth';
import {command,event,uuid} from './commands';
import {candidateLock,sourceFor} from './sources';
import {enqueue} from './work';
import {validateFacts,type TypedFact} from './domain';
import {invariant,notFound} from './errors';
import {assertDisclosureText} from './candidate-context';
import {invalidateFactAnswers,eraseSourceAnswers} from './answer-invalidation';
import {invalidateMaterial} from './application-material';

const revision=z.number().int().nonnegative();
const reason=z.string().trim().min(3).max(500);
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('review_fact'),payload:z.object({proposalId:uuid,expectedRevision:revision,expectedFactRevision:revision,decision:z.enum(['approve','replace','reject']),reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('manual_fact'),payload:z.object({fieldKey:z.string(),value:z.unknown(),expectedFactRevision:revision,modelConsent:z.boolean().default(false),reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('withdraw_fact'),payload:z.object({factId:uuid,expectedRevision:revision,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('source_consent'),payload:z.object({sourceId:uuid,expectedRevision:revision,allow:z.boolean()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('retry_source'),payload:z.object({sourceId:uuid,expectedRevision:revision}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('delete_source'),payload:z.object({sourceId:uuid,expectedRevision:revision,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('cancel_work'),payload:z.object({workId:uuid}).strict()}).strict(),
]);
export async function invalidateCandidate(tx:PoolClient,workspaceId:string,factId?:string){
 await invalidateMaterial(tx,workspaceId);
 const candidate=(await tx.query('UPDATE candidates SET revision=revision+1 WHERE workspace_id=$1 RETURNING revision,ownership',[workspaceId])).rows[0];
 if(candidate.ownership==='canonical')await enqueue(tx,workspaceId,'project_candidate',String(candidate.revision),{candidateRevision:candidate.revision});
 await tx.query("UPDATE candidate_contexts SET status='invalidated' WHERE workspace_id=$1 AND status='current'",[workspaceId]);
 if(factId){
  await tx.query("UPDATE fact_dependencies SET status='invalidated' WHERE workspace_id=$1 AND fact_id=$2 AND status='current'",[workspaceId,factId]);
  await invalidateFactAnswers(tx,workspaceId,[factId]);
 }
}
async function saveFact(tx:PoolClient,ctx:Context,fact:TypedFact,source:Record<string,unknown>,expected:number,why:string){
 if(source.model_consent)assertDisclosureText(JSON.stringify(fact.value));
 const previous=(await tx.query('SELECT * FROM candidate_facts WHERE workspace_id=$1 AND field_key=$2 FOR UPDATE',[ctx.workspaceId,fact.field_key])).rows[0];
 invariant((previous?.revision||0)===expected,'revision_conflict','This field changed. Review the current value before confirming.',409);
 const id=previous?.id||crypto.randomUUID(),rev=previous?previous.revision+1:1;
 const saved=(await tx.query("INSERT INTO candidate_facts(id,workspace_id,field_key,value,revision,source_id,source_revision,sensitivity) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,field_key) DO UPDATE SET value=EXCLUDED.value,revision=EXCLUDED.revision,source_id=EXCLUDED.source_id,source_revision=EXCLUDED.source_revision,sensitivity=EXCLUDED.sensitivity,status='current',approved_at=now(),updated_at=now() RETURNING *",
 [id,ctx.workspaceId,fact.field_key,JSON.stringify(fact.value),rev,source.id,source.revision,fact.sensitivity])).rows[0];
 await tx.query('INSERT INTO fact_versions(workspace_id,fact_id,revision,value,source_id,source_revision,status,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
 [ctx.workspaceId,id,rev,JSON.stringify(fact.value),source.id,source.revision,'current',why]);
 await invalidateCandidate(tx,ctx.workspaceId,id);
 if(source.origin_run)await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'context',$4) ON CONFLICT DO NOTHING",[ctx.workspaceId,id,rev,source.origin_run]);
 await event(tx,ctx,id,'candidate_fact_confirmed',{fieldKey:fact.field_key,sourceId:source.id,sensitivity:fact.sensitivity},rev);
 await tx.query("UPDATE candidate_sources SET status='approved' WHERE workspace_id=$1 AND id=$2 AND status='review_required' AND NOT EXISTS(SELECT 1 FROM fact_proposals WHERE workspace_id=$1 AND source_id=$2 AND status='pending')",[ctx.workspaceId,source.id]);
 return saved;
}
export async function retireSource(tx:PoolClient,ctx:Pick<Context,'workspaceId'>,source:Record<string,any>,eraseFacts:boolean){
 await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
 await tx.query("UPDATE work_items SET status='cancelled',error_code='source_retired',lease_until=null,updated_at=now() WHERE workspace_id=$1 AND input->>'sourceId'=$2 AND status IN ('queued','leased')",[ctx.workspaceId,source.id]);
 await tx.query("UPDATE fact_proposals SET status='withdrawn',value='null'::jsonb,quote='' WHERE workspace_id=$1 AND source_id=$2",[ctx.workspaceId,source.id]);
 if(eraseFacts){
  await invalidateMaterial(tx,ctx.workspaceId,true,undefined,String(source.id));
  await eraseSourceAnswers(tx,ctx.workspaceId,source.id);
  // Keep run/audit identities, but remove copies of source-derived private content.
  const runs=(await tx.query("SELECT DISTINCT m.run_id FROM messages m WHERE m.workspace_id=$1 AND (m.run_id=$3 OR EXISTS(SELECT 1 FROM fact_dependencies d JOIN fact_versions v ON v.fact_id=d.fact_id AND v.workspace_id=d.workspace_id WHERE d.workspace_id=$1 AND d.entity_id=m.run_id AND v.source_id=$2))",[ctx.workspaceId,source.id,source.origin_run||null])).rows.map(r=>r.run_id);
  if(runs.length){
   await tx.query("UPDATE messages SET content=jsonb_build_object('text','[Source-derived content erased]','redacted',true) WHERE workspace_id=$1 AND run_id=ANY($2::uuid[])",[ctx.workspaceId,runs]);
   await tx.query("UPDATE conversations SET title='Redacted conversation' WHERE workspace_id=$1 AND id IN (SELECT conversation_id FROM runs WHERE workspace_id=$1 AND id=ANY($2::uuid[]))",[ctx.workspaceId,runs]);
   await tx.query("UPDATE runs SET status='cancelled',error_code='source_deleted',completed_at=now() WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND status='running'",[ctx.workspaceId,runs]);
   await tx.query("UPDATE conversations SET active_run=null,lease_until=null WHERE workspace_id=$1 AND active_run=ANY($2::uuid[])",[ctx.workspaceId,runs]);
  }
  const facts=(await tx.query("UPDATE candidate_facts SET status='withdrawn',value='null'::jsonb,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND source_id=$2 RETURNING id",[ctx.workspaceId,source.id])).rows;
  for(const f of facts)await invalidateCandidate(tx,ctx.workspaceId,f.id);
  await tx.query("UPDATE fact_versions SET value=null,reason='source_deleted' WHERE workspace_id=$1 AND source_id=$2",[ctx.workspaceId,source.id]);
  await tx.query("UPDATE commands SET result=jsonb_build_object('redacted',true,'reason','source_deleted') WHERE workspace_id=$1 AND result->>'source_id'=$2",[ctx.workspaceId,source.id]);
  await tx.query("UPDATE candidate_contexts SET content='{}'::jsonb,status='invalidated' WHERE workspace_id=$1",[ctx.workspaceId]);
  await tx.query("UPDATE candidate_sources SET status='deleted',name='Deleted source',extracted_text=null,deleted_at=now(),revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,source.id]);
 }else await tx.query("UPDATE candidate_sources SET extracted_text=null,extraction_error='raw_retention_expired',updated_at=now() WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,source.id]);
 if(source.artifact_id){
  await tx.query("UPDATE artifacts SET deleted_at=now(),name=CASE WHEN $3 THEN 'Deleted source' ELSE name END WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,source.artifact_id,eraseFacts]);
  await enqueue(tx,ctx.workspaceId,'purge_artifact',String(source.artifact_id),{artifactId:source.artifact_id});
 }
}
export async function candidateCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);
  if(c.action==='manual_fact'){
   const p=c.payload,fact=validateFacts([{field_key:p.fieldKey,value:p.value}])[0];
   const source={id:crypto.randomUUID(),revision:1,model_consent:p.modelConsent};
   const text=fact.field_key+': '+JSON.stringify(fact.value);
   await tx.query("INSERT INTO candidate_sources(id,workspace_id,name,format,content_hash,classification,model_consent,status,extracted_text) VALUES($1,$2,'User declaration','manual',$3,'personal',$4,'review_required',$5)",
   [source.id,ctx.workspaceId,crypto.createHash('sha256').update(c.commandId).digest('hex'),p.modelConsent,text]);
   return saveFact(tx,ctx,fact,source,p.expectedFactRevision,p.reason);
  }
  if(c.action==='review_fact'){
   const p=c.payload;
   const proposal=(await tx.query('SELECT * FROM fact_proposals WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[p.proposalId,ctx.workspaceId])).rows[0];
   if(!proposal)throw notFound();
   invariant(proposal.status==='pending'&&proposal.revision===p.expectedRevision,'proposal_stale','This proposal is no longer current.',409);
   const source=await sourceFor(tx,ctx.workspaceId,proposal.source_id);
   invariant(!source.deleted_at&&source.revision===proposal.source_revision,'source_stale','The source changed. Extract and review it again.',409);
   if(p.decision==='reject'){
    await tx.query("UPDATE fact_proposals SET status='rejected',revision=revision+1 WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,proposal.id]);
    await event(tx,ctx,proposal.id,'candidate_proposal_rejected',{sourceId:source.id});
    await tx.query("UPDATE candidate_sources SET status='reviewed' WHERE id=$1 AND workspace_id=$2 AND NOT EXISTS(SELECT 1 FROM fact_proposals WHERE source_id=$1 AND workspace_id=$2 AND status='pending')",[source.id,ctx.workspaceId]);
    return {id:proposal.id,status:'rejected'};
   }
   const existing=(await tx.query('SELECT value,revision FROM candidate_facts WHERE workspace_id=$1 AND field_key=$2',[ctx.workspaceId,proposal.field_key])).rows[0];
   const conflict=Boolean(existing&&JSON.stringify(existing.value)!==JSON.stringify(proposal.value))||p.expectedFactRevision!==proposal.expected_fact_revision;
   invariant(p.decision==='replace'||!conflict,'fact_conflict','Review this conflict and explicitly replace the current value.',409);
   const fact=validateFacts([{field_key:proposal.field_key,value:proposal.value}])[0];
   const result=await saveFact(tx,ctx,fact,source,p.expectedFactRevision,p.reason);
   await tx.query("UPDATE fact_proposals SET status='approved',revision=revision+1 WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,proposal.id]);
   await tx.query("UPDATE candidate_sources SET status='approved' WHERE id=$1 AND workspace_id=$2 AND NOT EXISTS(SELECT 1 FROM fact_proposals WHERE source_id=$1 AND workspace_id=$2 AND status='pending')",[source.id,ctx.workspaceId]);
   return result;
  }
  if(c.action==='withdraw_fact'){
   const p=c.payload;
   const fact=(await tx.query("UPDATE candidate_facts SET status='withdrawn',revision=revision+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND revision=$3 RETURNING *",[p.factId,ctx.workspaceId,p.expectedRevision])).rows[0];
   invariant(fact,'revision_conflict','The field changed or is unavailable. Refresh before withdrawing.',409);
   await tx.query('INSERT INTO fact_versions(workspace_id,fact_id,revision,value,source_id,source_revision,status,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[ctx.workspaceId,fact.id,fact.revision,JSON.stringify(fact.value),fact.source_id,fact.source_revision,'withdrawn',p.reason]);
   await invalidateCandidate(tx,ctx.workspaceId,fact.id);
   await event(tx,ctx,fact.id,'candidate_fact_withdrawn',{fieldKey:fact.field_key},fact.revision);
   return fact;
  }
  if(c.action==='cancel_work'){
   const row=(await tx.query("UPDATE work_items SET status='cancelled',error_code='cancelled',lease_until=null,updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status IN ('queued','leased') RETURNING *",[c.payload.workId,ctx.workspaceId])).rows[0];
   if(!row){const exists=await tx.query('SELECT id FROM work_items WHERE id=$1 AND workspace_id=$2',[c.payload.workId,ctx.workspaceId]);if(!exists.rowCount)throw notFound();return {cancelled:false};}
   invariant(['extract_source','purge_artifact','project_candidate'].includes(row.kind),'work_scope','Use the application/discovery command for this work type.',409);
   if(row.input.sourceId)await tx.query("UPDATE candidate_sources SET status='failed',extraction_error='cancelled',updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status IN ('queued','running')",[row.input.sourceId,ctx.workspaceId]);
   await event(tx,ctx,row.id,'work_cancelled',{kind:row.kind});
   return {cancelled:true};
  }
  const p=c.payload,source=await sourceFor(tx,ctx.workspaceId,p.sourceId);
  invariant(source.revision===p.expectedRevision&&!source.deleted_at,'source_stale','The source changed or was deleted.',409);
  if(c.action==='delete_source'){
   await retireSource(tx,ctx,source,true);
   await event(tx,ctx,source.id,'candidate_source_deleted',{erasure:'current_source_proposals_facts_context',backupPolicy:'existing_private_backups_retained_until_explicit_purge'});
   return {id:source.id,status:'deleted'};
  }
  if(c.action==='source_consent'){
   if(c.payload.allow)assertDisclosureText(source.extracted_text||'');
   await tx.query("UPDATE fact_dependencies SET status='invalidated' WHERE workspace_id=$1 AND fact_id IN (SELECT id FROM candidate_facts WHERE workspace_id=$1 AND source_id=$2)",[ctx.workspaceId,source.id]);
   const affected=(await tx.query('SELECT id FROM candidate_facts WHERE workspace_id=$1 AND source_id=$2',[ctx.workspaceId,source.id])).rows;
   await invalidateFactAnswers(tx,ctx.workspaceId,affected.map(f=>f.id));
   if(source.format==='manual'){
    await tx.query('UPDATE candidate_sources SET model_consent=$1,consent_revision=consent_revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3',[c.payload.allow,ctx.workspaceId,source.id]);
    await invalidateCandidate(tx,ctx.workspaceId);
    await event(tx,ctx,source.id,'candidate_disclosure_changed',{allowed:c.payload.allow});
    return {id:source.id,status:source.status};
   }
   await tx.query("UPDATE work_items SET status='cancelled',error_code='consent_changed',lease_until=null WHERE workspace_id=$1 AND input->>'sourceId'=$2 AND status IN ('queued','leased')",[ctx.workspaceId,source.id]);
   await tx.query("UPDATE fact_proposals SET status='withdrawn' WHERE workspace_id=$1 AND source_id=$2 AND status='pending'",[ctx.workspaceId,source.id]);
   await tx.query("UPDATE candidate_sources SET model_consent=$1,consent_revision=consent_revision+1,status='queued',updated_at=now() WHERE workspace_id=$2 AND id=$3",[c.payload.allow,ctx.workspaceId,source.id]);
   await invalidateCandidate(tx,ctx.workspaceId);
   const work=await enqueue(tx,ctx.workspaceId,'extract_source',source.id+':consent:'+String(source.consent_revision+1),{sourceId:source.id,sourceRevision:source.revision,consentRevision:source.consent_revision+1,useModel:c.payload.allow});
   await event(tx,ctx,source.id,'candidate_disclosure_changed',{allowed:c.payload.allow});
   return {id:source.id,status:'queued',workId:work.id};
  }
  invariant(source.status==='failed','source_busy','Only failed sources can be retried.',409);
  await tx.query("UPDATE candidate_sources SET status='queued',extraction_error=null WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,source.id]);
  const work=await enqueue(tx,ctx.workspaceId,'extract_source',source.id+':retry:'+c.commandId,{sourceId:source.id,sourceRevision:source.revision,consentRevision:source.consent_revision,useModel:source.model_consent});
  return {id:source.id,status:'queued',workId:work.id};
 });
}
