import crypto from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {database,transaction} from './db';
import type {Context} from './auth';
import {command,event,uuid} from './commands';
import {candidateLock} from './sources';
import {questionInput,questionIdentity,questionPolicy,contentHash} from './answer-policy';
import {assertDisclosureText} from './candidate-context';
import {questionFor,answerFor,refsFor,validRefs,assertUsable,renderFactEvidence} from './answer-validity';
import {invalidateAnswerUses,eraseAnswer} from './answer-invalidation';
import {invariant,notFound} from './errors';

const revision=z.number().int().nonnegative(),reason=z.string().trim().min(3).max(500);
const ref=z.object({id:uuid,revision:z.number().int().positive()}).strict();
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('save_question'),payload:questionInput}).strict(),
 z.object({commandId:uuid,action:z.literal('draft_answer'),payload:z.object({
  questionId:uuid,text:z.string().trim().min(1).max(8000),facts:z.array(ref).max(20).default([]),
  expectedCandidateRevision:z.number().int().positive(),answerId:uuid.optional(),expectedRevision:revision.default(0),
  permission:z.enum(['company','cross_company','never']),modelConsent:z.boolean().default(false),sensitiveConsent:z.boolean().default(false),
  retentionDays:z.number().int().min(1).max(365).default(180),
 }).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('approve_answer'),payload:z.object({answerId:uuid,expectedRevision:revision,contentHash:z.string().regex(/^[a-f0-9]{64}$/),declarationConfirmed:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('revoke_answer'),payload:z.object({answerId:uuid,expectedRevision:revision,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('delete_answer'),payload:z.object({answerId:uuid,expectedRevision:revision,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('delete_question'),payload:z.object({questionId:uuid,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('prepare_reuse'),payload:z.object({answerId:uuid,expectedRevision:revision,questionId:uuid}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('confirm_reuse'),payload:z.object({useId:uuid,expectedRevision:revision,contentHash:z.string().regex(/^[a-f0-9]{64}$/),reviewed:z.literal(true)}).strict()}).strict(),
]);
export async function snapshotAnswer(tx:PoolClient,row:Record<string,any>,refs:Array<{id:string;revision:number}>){
 await tx.query('INSERT INTO answer_versions(workspace_id,answer_id,revision,snapshot) VALUES($1,$2,$3,$4)',[row.workspace_id,row.id,row.revision,JSON.stringify(row)]);
 for(const f of refs){
  await tx.query('INSERT INTO answer_fact_refs(workspace_id,answer_id,answer_revision,fact_id,fact_revision) VALUES($1,$2,$3,$4,$5)',[row.workspace_id,row.id,row.revision,f.id,f.revision]);
  await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'answer',$4) ON CONFLICT(workspace_id,fact_id,kind,entity_id) DO UPDATE SET fact_revision=EXCLUDED.fact_revision,status='current'",[row.workspace_id,f.id,f.revision,row.id]);
 }
}
export async function answerCommand(ctx:Context,raw:unknown,originRun?:string,originMode:'declaration'|'facts'='declaration'){
 const c=schema.parse(raw);
 invariant(!originRun||c.action==='draft_answer','tool_not_allowed','An agent may only draft an answer.');
 return command(ctx,c.commandId,{...c,...(originRun?{originRun}:{})},async tx=>{
  await candidateLock(tx,ctx.workspaceId);
  const candidate=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  if(c.action==='save_question'){
   const p=c.payload,k=questionIdentity(p);
   const q=(await tx.query("INSERT INTO answer_questions(id,workspace_id,company,exact_text,normalized_text,kind,fact_key,context,context_hash,tags,identity_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(workspace_id,identity_hash) DO UPDATE SET identity_hash=EXCLUDED.identity_hash RETURNING *",
    [crypto.randomUUID(),ctx.workspaceId,k.company,p.text,k.normalized,k.policy.kind,k.policy.factKey,JSON.stringify(k.context),k.contextHash,[...new Set(p.tags)].sort(),k.identityHash])).rows[0];
   await event(tx,ctx,q.id,'answer_question_recorded',{kind:q.kind});return q;
  }
  if(c.action==='delete_question'){
   const q=await questionFor(tx,ctx,c.payload.questionId);
   invariant(!(await tx.query("SELECT id FROM answer_memory WHERE workspace_id=$1 AND question_id=$2 AND status<>'deleted'",[ctx.workspaceId,q.id])).rowCount,'question_in_use','Delete its current answers before deleting the question.',409);
   invariant(!(await tx.query("SELECT id FROM answer_uses WHERE workspace_id=$1 AND question_id=$2 AND status IN ('draft','confirmed')",[ctx.workspaceId,q.id])).rowCount,'question_in_use','Delete the source answer before deleting a question with current reuse drafts.',409);
   await tx.query("UPDATE answer_questions SET exact_text='[Question erased]',normalized_text='',company='[erased]',context='{}',context_hash='',tags='{}',identity_hash='deleted:'||id WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,q.id]);
   await tx.query("UPDATE commands SET result=jsonb_build_object('redacted',true) WHERE workspace_id=$1 AND result->>'id'=$2",[ctx.workspaceId,q.id]);
   await event(tx,ctx,q.id,'answer_question_deleted',{});return {id:q.id,deleted:true};
  }
  if(c.action==='draft_answer'){
   const p=c.payload,q=await questionFor(tx,ctx,p.questionId);assertDisclosureText(p.text);
   invariant(candidate.revision===p.expectedCandidateRevision,'candidate_stale','Candidate knowledge changed. Review the source revisions before saving.',409);
   invariant(q.normalized_text&&q.kind!=='credential','question_unavailable','Choose a current, non-credential question.');
   invariant(!['attestation','self_id','compensation','availability','employer_relationship'].includes(q.kind)||p.permission!=='cross_company','scope_unsafe','This question requires company-specific manual review.');
   const refs=[...new Map(p.facts.map(f=>[f.id,f])).values()].sort((a,b)=>a.id.localeCompare(b.id));
   const values=await validRefs(tx,ctx.workspaceId,refs,p.modelConsent||Boolean(originRun&&originMode==='facts'));
   const levels=['standard','private','sensitive'],sensitivity=levels[Math.max(levels.indexOf(questionPolicy(q.exact_text).sensitivity),...values.map(f=>levels.indexOf(f.sensitivity)))];
   invariant(!p.modelConsent||sensitivity==='standard','disclosure_denied','Private/sensitive answers cannot enter general model context.');
   let previous=null;
   if(p.answerId){previous=await answerFor(tx,ctx,p.answerId);invariant(previous.question_id===q.id&&previous.revision===p.expectedRevision&&previous.status!=='deleted','revision_conflict','The answer changed or was deleted. Refresh before editing.',409);await invalidateAnswerUses(tx,ctx.workspaceId,previous.id);}
   else invariant(p.expectedRevision===0,'revision_conflict','New answers start at revision zero.',409);
   if(originRun){
    const run=(await tx.query("SELECT m.content FROM messages m JOIN runs r ON r.id=m.run_id AND r.workspace_id=m.workspace_id WHERE m.workspace_id=$1 AND m.run_id=$2 AND m.role='user' AND r.status='running' ORDER BY m.sequence DESC LIMIT 1",[ctx.workspaceId,originRun])).rows[0];
    invariant(run,'cancelled','The originating agent run is not active.',409);
    if(originMode==='declaration')invariant(typeof run.content.text==='string'&&run.content.text.includes(p.text),'evidence_mismatch','An agent answer draft must quote the exact current declaration.');
    else{
     invariant(candidate.ownership==='canonical'&&q.kind==='novel'&&values.length>0&&p.text===renderFactEvidence(values),'evidence_mismatch','Evidence drafts must preserve exact current, disclosable fact text.');
     await tx.query("UPDATE runs SET candidate_revision=$1 WHERE workspace_id=$2 AND id=$3",[candidate.revision,ctx.workspaceId,originRun]);
     for(const f of refs)await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'context',$4) ON CONFLICT DO NOTHING",[ctx.workspaceId,f.id,f.revision,originRun]);
    }
    invariant(!p.answerId&&!p.modelConsent&&!p.sensitiveConsent&&p.permission==='never','tool_not_allowed','Agent drafts cannot grant disclosure or reuse.');
   }
   const id=previous?.id||crypto.randomUUID(),rev=previous?previous.revision+1:1,expires=new Date(Date.now()+p.retentionDays*86400000).toISOString();
   const hash=contentHash({questionId:q.id,question:q.exact_text,context:q.context,text:p.text,refs,permission:p.permission,modelConsent:p.modelConsent,sensitiveConsent:p.sensitiveConsent,expiresAt:expires,candidateRevision:candidate.revision});
   const a=(await tx.query("INSERT INTO answer_memory(id,workspace_id,question_id,revision,text,permission,sensitivity,model_consent,sensitive_consent,candidate_revision,content_hash,origin_run,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT(id) DO UPDATE SET revision=EXCLUDED.revision,text=EXCLUDED.text,status='draft',permission=EXCLUDED.permission,sensitivity=EXCLUDED.sensitivity,model_consent=EXCLUDED.model_consent,sensitive_consent=EXCLUDED.sensitive_consent,candidate_revision=EXCLUDED.candidate_revision,content_hash=EXCLUDED.content_hash,origin_run=EXCLUDED.origin_run,expires_at=EXCLUDED.expires_at,updated_at=now() RETURNING *",
    [id,ctx.workspaceId,q.id,rev,p.text,p.permission,sensitivity,p.modelConsent,p.sensitiveConsent,candidate.revision,hash,originRun||null,expires])).rows[0];
   await snapshotAnswer(tx,a,refs);await event(tx,ctx,id,'answer_drafted',{questionId:q.id,permission:p.permission},rev);return a;
  }
  if(c.action==='prepare_reuse'){
   const p=c.payload,a=await answerFor(tx,ctx,p.answerId),target=await questionFor(tx,ctx,p.questionId),original=await questionFor(tx,ctx,a.question_id);
   invariant(candidate.ownership==='canonical','candidate_inactive','Activate reviewed candidate authority before reuse.',409);
   invariant(a.revision===p.expectedRevision,'revision_conflict','Answer changed; review its current revision.',409);
   const refs=await assertUsable(tx,ctx,a);
   invariant(target.normalized_text===original.normalized_text&&target.context_hash===original.context_hash,'context_mismatch','The new question/context differs. Draft and approve a specific answer instead.',409);
   invariant(target.company===original.company||a.permission==='cross_company','scope_denied','Cross-company reuse was not approved.',409);
   invariant(['novel','standard_fact'].includes(target.kind),'manual_only','This question requires a current application-specific declaration, not memory prefill.');
   const id=crypto.randomUUID(),snapshot={answerId:a.id,answerRevision:a.revision,questionId:target.id,question:target.exact_text,company:target.company,context:target.context,text:a.text,facts:refs,manualReview:true};
   const stored={...snapshot,contentHash:contentHash(snapshot)};
   const use=(await tx.query('INSERT INTO answer_uses(id,workspace_id,answer_id,answer_revision,question_id,snapshot) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id,ctx.workspaceId,a.id,a.revision,target.id,JSON.stringify(stored)])).rows[0];
   await tx.query("INSERT INTO answer_dependencies(workspace_id,answer_id,answer_revision,kind,entity_id) VALUES($1,$2,$3,'draft',$4)",[ctx.workspaceId,a.id,a.revision,id]);
   for(const f of refs)await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'draft',$4)",[ctx.workspaceId,f.id,f.revision,id]);
   await event(tx,ctx,id,'answer_reuse_prepared',{answerId:a.id,answerRevision:a.revision});return use;
  }
  if(c.action==='confirm_reuse'){
   const p=c.payload,use=(await tx.query('SELECT * FROM answer_uses WHERE id=$1 AND workspace_id=$2 FOR UPDATE',[p.useId,ctx.workspaceId])).rows[0];if(!use)throw notFound();
   invariant(use.status==='draft'&&use.revision===p.expectedRevision&&use.snapshot.contentHash===p.contentHash,'reuse_stale','The reuse draft changed. Review a new draft.',409);
   const a=await answerFor(tx,ctx,use.answer_id);invariant(a.revision===use.answer_revision&&candidate.ownership==='canonical','reuse_stale','The answer or candidate authority changed.',409);await assertUsable(tx,ctx,a);
   const result=(await tx.query("UPDATE answer_uses SET status='confirmed',revision=revision+1,updated_at=now() WHERE id=$1 AND workspace_id=$2 RETURNING *",[use.id,ctx.workspaceId])).rows[0];
   await event(tx,ctx,use.id,'answer_reuse_confirmed',{answerId:a.id,answerRevision:a.revision});return result;
  }
  const p=c.payload,a=await answerFor(tx,ctx,p.answerId);
  invariant(a.revision===p.expectedRevision&&a.status!=='deleted','revision_conflict','The answer changed or was deleted.',409);
  if(c.action==='delete_answer'){await eraseAnswer(tx,ctx.workspaceId,a.id);await event(tx,ctx,a.id,'answer_deleted',{backups:'separate_owner_retention',historicalSubmissions:'preserved'});return {id:a.id,deleted:true};}
  const refs=await refsFor(tx,ctx.workspaceId,a.id,a.revision);
  if(c.action==='approve_answer'){
   invariant(a.status==='draft'&&a.content_hash===c.payload.contentHash,'answer_stale','Review the exact current answer and permissions.',409);
   invariant(new Date(a.expires_at).getTime()>Date.now(),'answer_expired','This draft expired. Create and review a current answer.',409);
   invariant(a.candidate_revision===candidate.revision,'candidate_stale','Candidate knowledge changed since this draft.',409);
   if(a.origin_run)invariant((await tx.query("SELECT id FROM runs WHERE id=$1 AND workspace_id=$2 AND status='completed'",[a.origin_run,ctx.workspaceId])).rowCount,'run_incomplete','Only a completed agent draft can be reviewed.',409);
   await validRefs(tx,ctx.workspaceId,refs,a.model_consent);
  }
  const status=c.action==='approve_answer'?'approved':'revoked';
  await invalidateAnswerUses(tx,ctx.workspaceId,a.id);
  const saved=(await tx.query('UPDATE answer_memory SET status=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING *',[status,ctx.workspaceId,a.id])).rows[0];
  await snapshotAnswer(tx,saved,refs);await event(tx,ctx,a.id,c.action==='approve_answer'?'answer_approved':'answer_revoked',{questionId:a.question_id,permission:a.permission},saved.revision);return saved;
 });
}
export async function answerLibrary(ctx:Context,selectedQuestion:string|null=null){
 if(selectedQuestion!==null)uuid.parse(selectedQuestion);
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const questions=(await tx.query("SELECT * FROM answer_questions WHERE workspace_id=$1 AND normalized_text<>'' ORDER BY coalesce(id=$2::uuid,false) DESC,created_at DESC,id LIMIT 201",[ctx.workspaceId,selectedQuestion])).rows;
  const answers=(await tx.query("SELECT a.*,q.exact_text AS question,q.company,q.context,q.kind FROM answer_memory a JOIN answer_questions q ON q.id=a.question_id AND q.workspace_id=a.workspace_id WHERE a.workspace_id=$1 ORDER BY a.updated_at DESC LIMIT 201",[ctx.workspaceId])).rows;
  const enriched=[];for(const a of answers.slice(0,200))enriched.push({...a,facts:await refsFor(tx,ctx.workspaceId,a.id,a.revision),expired:new Date(a.expires_at).getTime()<=Date.now()});
  const uses=(await tx.query('SELECT * FROM answer_uses WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100',[ctx.workspaceId])).rows;
  return {questions:questions.slice(0,200),answers:enriched,uses,partial:questions.length>200||answers.length>200,asOf:new Date().toISOString()};
 });
}
export async function exportAnswers(ctx:Context){
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const questions=(await tx.query('SELECT * FROM answer_questions WHERE workspace_id=$1',[ctx.workspaceId])).rows;
  const answers=(await tx.query('SELECT * FROM answer_memory WHERE workspace_id=$1',[ctx.workspaceId])).rows;
  const versions=(await tx.query('SELECT * FROM answer_versions WHERE workspace_id=$1 ORDER BY answer_id,revision',[ctx.workspaceId])).rows;
  const refs=(await tx.query('SELECT * FROM answer_fact_refs WHERE workspace_id=$1',[ctx.workspaceId])).rows;
  const uses=(await tx.query('SELECT * FROM answer_uses WHERE workspace_id=$1',[ctx.workspaceId])).rows;
  return {version:1,exportedAt:new Date().toISOString(),questions,answers,versions,refs,uses};
 });
}

