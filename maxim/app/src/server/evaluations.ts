import crypto from 'node:crypto';
import {z} from 'zod';
import {type Context,digest} from './auth';
import {command,event,jobFor,uuid} from './commands';
import {candidateLock} from './sources';
import {enqueue} from './work';
import {invariant,notFound} from './errors';
import {config} from './config';
import {modelProfile} from './context-budget';
import {render} from './projections';
import {engineSnapshot,retainedPrompt} from './evaluation-native';
import {assertDisclosureText} from './candidate-context';
import {jobPolicy} from './application-material';
import {applicationWritable} from './application-authority';

const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('start_evaluation'),payload:z.object({jobId:uuid,expectedJobRevision:z.number().int().positive(),expectedCandidateRevision:z.number().int().positive()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('cancel_evaluation'),payload:z.object({evaluationId:uuid,expectedRevision:z.number().int().positive()}).strict()}).strict(),
]);
export async function evaluationCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);
  await applicationWritable(tx,ctx.workspaceId);
  if(c.action==='cancel_evaluation'){
   const p=c.payload,e=(await tx.query('SELECT * FROM evaluations WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[ctx.workspaceId,p.evaluationId])).rows[0];if(!e)throw notFound();
   invariant(e.revision===p.expectedRevision&&['queued','running'].includes(e.status),'evaluation_changed','Evaluation changed or already finished.',409);
   await tx.query("UPDATE evaluations SET status='cancelled',revision=revision+1,completed_at=now() WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,e.id]);
   await tx.query("UPDATE work_items SET status='cancelled',lease_until=null,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status IN ('queued','leased')",[ctx.workspaceId,e.work_id]);
   await event(tx,ctx,e.id,'evaluation_cancelled',{},e.revision+1);return {id:e.id,status:'cancelled',revision:e.revision+1};
  }
  const p=c.payload,j=await jobFor(tx,ctx,p.jobId),candidate=(await tx.query('SELECT * FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  invariant(candidate.ownership==='canonical','candidate_authority_required','Review and activate Candidate knowledge before evaluation.',409);
  invariant(j.revision===p.expectedJobRevision&&candidate.revision===p.expectedCandidateRevision,'revision_conflict','Candidate/job changed; review the current versions.',409);
  invariant(!j.archived&&j.description.trim().length>=50,'job_description_required','A current full job description is required before evaluation.',409);
  const facts=(await tx.query("SELECT f.*,s.model_consent,s.classification FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND f.sensitivity='standard' AND s.model_consent=true AND s.classification<>'restricted' AND s.deleted_at IS NULL AND s.revision=f.source_revision ORDER BY f.field_key",[ctx.workspaceId])).rows;
  invariant(facts.length>0&&facts.length<=300,'candidate_context_required','Approve model-disclosable facts within the bounded candidate context first.',409);
  facts.forEach(f=>assertDisclosureText(JSON.stringify(f.value)));assertDisclosureText(j.description);
  const engine=await engineSnapshot(),projection=render(candidate.revision,facts),prompt=await retainedPrompt(engine,projection),model=config().model;
  invariant(model.model&&model.apiKey,'model_unconfigured','Configure the evaluation model in Settings.',503);
  modelProfile(model.model,config().testMode);
  const policy=await jobPolicy(tx,ctx.workspaceId,j);
  const snapshot={job:{id:j.id,company:j.company,title:j.title,location:j.location,description:j.description,url:j.url,revision:j.revision},candidateRevision:candidate.revision,
   facts:facts.map(f=>({id:f.id,revision:f.revision,field_key:f.field_key,value:f.value,source_id:f.source_id,source_revision:f.source_revision})),engine,prompt,projection,policy,policyReviewRevision:policy.policyReviewRevision||0,model:model.model,provider:model.baseUrl};
  const inputHash=digest(JSON.stringify(snapshot));
  await tx.query("UPDATE evaluations e SET status='failed',error_code='worker_interrupted',revision=revision+1 WHERE e.workspace_id=$1 AND e.job_id=$2 AND e.status IN ('queued','running') AND EXISTS(SELECT 1 FROM work_items w WHERE w.id=e.work_id AND w.workspace_id=e.workspace_id AND w.status IN ('failed','cancelled'))",[ctx.workspaceId,j.id]);
  const prior=(await tx.query("SELECT id,status,revision,work_id FROM evaluations WHERE workspace_id=$1 AND job_id=$2 AND job_revision=$3 AND candidate_revision=$4 AND prompt_hash=$5 AND model=$6 AND provider=$7 AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1",[ctx.workspaceId,j.id,j.revision,candidate.revision,digest(prompt),model.model,model.baseUrl])).rows[0];if(prior)return prior;
  const id=crypto.randomUUID(),work=await enqueue(tx,ctx.workspaceId,'evaluate_job',id,{evaluationId:id});
  await tx.query("UPDATE evaluations SET status='stale',revision=revision+1 WHERE workspace_id=$1 AND job_id=$2 AND status IN ('completed','review_required')",[ctx.workspaceId,j.id]);
  await tx.query("UPDATE application_packets SET status='invalidated',revision=revision+1 WHERE workspace_id=$1 AND application_id IN(SELECT id FROM applications WHERE workspace_id=$1 AND job_id=$2) AND status IN ('draft','approved')",[ctx.workspaceId,j.id]);
  await tx.query("UPDATE applications SET workflow='packet_missing',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND job_id=$2 AND outcome='not_submitted'",[ctx.workspaceId,j.id]);
  await tx.query('INSERT INTO evaluations(id,workspace_id,job_id,work_id,job_revision,candidate_revision,input_snapshot,input_hash,prompt_hash,model,provider,policy) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',[id,ctx.workspaceId,j.id,work.id,j.revision,candidate.revision,JSON.stringify(snapshot),inputHash,digest(prompt),model.model,model.baseUrl,JSON.stringify(snapshot.policy)]);
  for(const f of facts)await tx.query("INSERT INTO fact_dependencies(workspace_id,fact_id,fact_revision,kind,entity_id) VALUES($1,$2,$3,'context',$4)",[ctx.workspaceId,f.id,f.revision,id]);
  await event(tx,ctx,id,'careerops_evaluation_queued',{jobId:j.id,candidateRevision:candidate.revision,inputHash,engineHash:engine.hash},1);
  return {id,status:'queued',revision:1,workId:work.id};
 });
}
