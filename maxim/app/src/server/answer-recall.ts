import {z} from 'zod';
import type {Context} from './auth';
import {reauthorize} from './auth';
import {transaction} from './db';
import {candidateLock} from './sources';
import {questionInput,questionIdentity} from './answer-policy';
import {assertUsable,refsFor} from './answer-validity';
import {DomainError,invariant} from './errors';
import {assertDisclosureText} from './candidate-context';

export const recallInput=questionInput.extend({includePrivate:z.boolean().default(false)}).strict();
export async function recallAnswers(ctx:Context,raw:unknown,purpose:'human'|'model'='human',runId?:string){
 const p=recallInput.parse(raw),{includePrivate,...question}=p,k=questionIdentity(question);
 invariant(purpose!=='model'||!includePrivate,'disclosure_denied','Agent tools cannot request private field disclosure.');
 return transaction(async tx=>{
  await reauthorize(tx,ctx);await candidateLock(tx,ctx.workspaceId);
  const candidate=(await tx.query('SELECT ownership,revision FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  const base={asOf:new Date().toISOString(),candidateRevision:candidate.revision,question:question.text,company:k.company,policy:k.policy,candidates:[] as unknown[]};
  if(candidate.ownership!=='canonical')return {...base,state:'ask_user',reason:'candidate_authority_inactive'};
  if(runId)await tx.query("UPDATE runs SET candidate_revision=$1 WHERE workspace_id=$2 AND id=$3 AND status='running'",[candidate.revision,ctx.workspaceId,runId]);
  if(['credential','attestation','self_id'].includes(k.policy.kind))return {...base,state:'ask_user',reason:'manual_only_question'};
  if(k.policy.factKey){
   const f=(await tx.query("SELECT f.id,f.field_key,f.value,f.revision,f.source_id,f.source_revision,f.sensitivity,s.model_consent FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.field_key=$2 AND f.status='current' AND s.deleted_at IS NULL AND f.source_revision=s.revision",[ctx.workspaceId,k.policy.factKey])).rows[0];
   if(!f)return {...base,state:'ask_user',reason:'missing_standard_fact'};
   if(purpose==='model'&&(!f.model_consent||f.sensitivity!=='standard')||purpose==='human'&&f.sensitivity!=='standard'&&!includePrivate)return {...base,state:'ask_user',reason:'explicit_private_review_required'};
   assertDisclosureText(JSON.stringify(f.value));
   if(runId)await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'context',$4) ON CONFLICT DO NOTHING",[ctx.workspaceId,f.id,f.revision,runId]);
   return {...base,state:'standard_fact',candidates:[{type:'fact',id:f.id,fieldKey:f.field_key,value:f.value,revision:f.revision,sourceId:f.source_id,sourceRevision:f.source_revision,match:'typed_exact',requiresConfirmation:f.sensitivity!=='standard'}]};
  }
  const rows=(await tx.query("SELECT a.*,q.company,q.normalized_text,q.context_hash,q.exact_text AS exact_question,q.context,q.tags FROM answer_memory a JOIN answer_questions q ON q.id=a.question_id AND q.workspace_id=a.workspace_id WHERE a.workspace_id=$1 AND a.status='approved' AND a.expires_at>now() AND a.permission<>'never' AND (q.company=$2 OR a.permission='cross_company') AND (q.normalized_text=$3 OR q.tags&&$4::text[]) ORDER BY (q.company=$2) DESC,(q.normalized_text=$3) DESC,a.updated_at DESC LIMIT 25",[ctx.workspaceId,k.company,k.normalized,question.tags])).rows;
  const usable=[],related=[];let omittedForBudget=0;
  for(const a of rows){
   if(a.sensitivity!=='standard'&&!includePrivate)continue;
   try{await assertUsable(tx,ctx,a,purpose==='model');}catch(e){if(e instanceof DomainError)continue;throw e;}
   if(k.policy.manualReview&&a.company!==k.company)continue;
   const exact=a.normalized_text===k.normalized&&a.context_hash===k.contextHash;
   const item={type:'answer',id:a.id,revision:a.revision,text:a.text,questionId:a.question_id,question:a.exact_question,company:a.company,match:a.company===k.company?'company_first':'explicit_cross_company',context:a.context,permission:a.permission,facts:await refsFor(tx,ctx.workspaceId,a.id,a.revision),requiresConfirmation:true};
   if(exact){
    if(purpose==='model'&&Buffer.byteLength(JSON.stringify(item))>4000){omittedForBudget++;continue;}
    assertDisclosureText(a.text);usable.push(item);
   }
   else if(purpose==='human')related.push({...item,match:'related_not_reusable'});
  }
  const companyAnswers=usable.filter(a=>a.company===k.company),selected=(companyAnswers.length?companyAnswers:usable).slice(0,purpose==='model'?2:5);
  for(const a of selected)if(runId)await tx.query("INSERT INTO answer_dependencies(workspace_id,answer_id,answer_revision,kind,entity_id) VALUES($1,$2,$3,'context',$4) ON CONFLICT DO NOTHING",[ctx.workspaceId,a.id,a.revision,runId]);
  const ambiguous=new Set(selected.map(a=>a.text)).size>1;
  return {...base,state:ambiguous||k.policy.manualReview?'ask_user':selected.length?'review_answer':'ask_user',reason:ambiguous?'conflicting_approved_answers':selected.length?k.policy.manualReview?'special_question_requires_current_review':'approved_scoped_answer':omittedForBudget?'evidence_exceeds_tool_budget':'no_compatible_approved_answer',candidates:selected,related:related.slice(0,5),partial:rows.length===25,omittedForBudget};
 });
}

