import path from 'node:path';
import fs from 'node:fs/promises';
import {database,transaction} from '../server/db';
import {checkLease,finishWork,type WorkItem} from '../server/work';
import {candidateLock} from '../server/sources';
import {domain} from '../server/domain';
import {evaluationCompletion} from '../server/evaluation-native';
import {event} from '../server/commands';
import {DomainError,invariant} from '../server/errors';
import {storeArtifact,cleanUncommitted,invocationDirectory,removeInvocation} from '../server/private-artifacts';
import {jobPolicy} from '../server/application-material';
import {digest} from '../server/auth';
import {applicationWritable,queueApplicationProjection} from '../server/application-authority';
import {enqueueDiscordEvent} from '../server/integrations/discord';

async function active(tx:import('pg').PoolClient,item:WorkItem){
 await candidateLock(tx,item.workspace_id);await applicationWritable(tx,item.workspace_id);await checkLease(tx,item);
 const e=(await tx.query('SELECT e.*,j.revision AS live_job_revision,c.revision AS live_candidate_revision,c.ownership FROM evaluations e JOIN jobs j ON j.id=e.job_id AND j.workspace_id=e.workspace_id JOIN candidates c ON c.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND e.id=$2 FOR UPDATE OF e',[item.workspace_id,item.input.evaluationId])).rows[0];
 invariant(e&&['queued','running'].includes(e.status)&&e.job_revision===e.live_job_revision&&e.candidate_revision===e.live_candidate_revision&&e.ownership==='canonical','evaluation_stale','Evaluation input changed or was cancelled.',409);
 invariant(digest(e.input_snapshot.prompt)===e.prompt_hash,'snapshot_changed','Evaluation prompt integrity failed.',409);return e;
}
export async function evaluateJob(item:WorkItem,parent?:AbortSignal){
 const signal=AbortSignal.any([AbortSignal.timeout(75000),...(parent?[parent]:[])]),created:string[]=[];
 let committed=false,dir:string|undefined;
 try{
  const e=await transaction(async tx=>{const e=await active(tx,item);await tx.query("UPDATE evaluations SET status='running' WHERE workspace_id=$1 AND id=$2",[item.workspace_id,e.id]);return e;});
  dir=await invocationDirectory(e.id,item.lease_token);
  await fs.writeFile(path.join(dir,'input.json'),JSON.stringify({evaluationId:e.id,inputHash:e.input_hash,promptHash:e.prompt_hash,jobId:e.job_id,candidateRevision:e.candidate_revision,leaseToken:item.lease_token}),{flag:'wx',mode:0o600});
  const result=await evaluationCompletion({prompt:e.input_snapshot.prompt,job:e.input_snapshot.job,model:e.model,provider:e.provider,api:e.input_snapshot.api||'chat_completions'},signal);
  await fs.writeFile(path.join(dir,'report.md'),result.report,{flag:'wx',mode:0o600});
  let parsed:Record<string,unknown>|null=null,invalid:string|null=null;
  try{parsed=domain({operation:'parse_evaluation',report:result.report,company:e.input_snapshot.job.company,title:e.input_snapshot.job.title});}catch(error){invalid=error instanceof DomainError?error.code:'invalid_report';}
  const oneLine=(v:unknown)=>String(v??'unknown').replace(/[\r\n]+/g,' ');
  const nativeReport=parsed?[
   '# Evaluation: '+oneLine(e.input_snapshot.job.company)+' - '+oneLine(e.input_snapshot.job.title),'',
   '**Date:** '+new Date().toISOString().slice(0,10),'**URL:** '+oneLine(e.input_snapshot.job.url||'unknown'),
   '**Archetype:** '+oneLine(parsed.archetype),'**Score:** '+parsed.score+'/5','**Legitimacy:** '+oneLine(parsed.legitimacy),
   '**PDF:** pending (immutable evaluation; approval tracked separately)','**Tool:** Career-Ops via '+e.model,
   '**Invocation:** '+e.id,'**Liveness:** unconfirmed','','---','',result.report,
  ].join('\n'):result.report;
  await transaction(async tx=>{
   await active(tx,item);
   const artifact=await storeArtifact(tx,item.workspace_id,e.job_id,e.id+'-report.md',Buffer.from(nativeReport),'text/plain; charset=utf-8',created);
   const job=(await tx.query('SELECT * FROM jobs WHERE workspace_id=$1 AND id=$2',[item.workspace_id,e.job_id])).rows[0],policy=await jobPolicy(tx,item.workspace_id,job,parsed?.tier as string|undefined);
   const manifest={evaluationId:e.id,jobId:e.job_id,invocation:item.lease_token,inputHash:e.input_hash,promptHash:e.prompt_hash,reportArtifactId:artifact.id,reportHash:artifact.content_hash,liveness:'unconfirmed'};
   await tx.query('UPDATE evaluations SET status=$1,score=$2,tier=$3,explanation=$4,archetype=$5,legitimacy=$6,policy=$7,report_artifact_id=$8,output_manifest=$9,error_code=$10,accounting=$11,usage=$12,revision=revision+1,completed_at=now() WHERE workspace_id=$13 AND id=$14',[invalid?'review_required':'completed',parsed?.score??null,parsed?.tier??null,parsed?.explanation??null,parsed?.archetype??null,parsed?.legitimacy??null,JSON.stringify(policy),artifact.id,JSON.stringify(manifest),invalid,JSON.stringify(result.accounting),JSON.stringify(result.usage),item.workspace_id,e.id]);
   await event(tx,{workspaceId:item.workspace_id},e.id,'careerops_evaluation_finished',{status:invalid?'review_required':'completed',score:parsed?.score??null,tier:parsed?.tier??null,reportArtifactId:artifact.id,liveness:'unconfirmed'},e.revision+1);
   if(!invalid)await enqueueDiscordEvent(tx,item.workspace_id,{kind:'high_fit',entityId:e.job_id});
   await queueApplicationProjection(tx,item.workspace_id);
   await finishWork(tx,item,{evaluationId:e.id,status:invalid?'review_required':'completed',manifest});
  });committed=true;
 }catch(error){
  const code=error instanceof DomainError?error.code:'evaluation_unavailable';
  await transaction(async tx=>{await candidateLock(tx,item.workspace_id);await applicationWritable(tx,item.workspace_id);await checkLease(tx,item);await tx.query("UPDATE evaluations SET status='failed',error_code=$1,revision=revision+1,completed_at=now() WHERE workspace_id=$2 AND id=$3 AND status IN ('queued','running')",[code,item.workspace_id,item.input.evaluationId]);await finishWork(tx,item,{evaluationId:item.input.evaluationId,status:'failed',error:code});}).catch(()=>{});
  if(['lease_lost','evaluation_stale'].includes(code))throw error;
 }finally{if(!committed)await cleanUncommitted(created);if(dir)await removeInvocation(dir);}
}
