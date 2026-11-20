import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {reauthorize,type Context} from '../auth';
import {command,event,uuid} from '../commands';
import {transaction} from '../db';
import {config} from '../config';
import {invariant,notFound} from '../errors';
import {candidateContext,assertDisclosureText} from '../candidate-context';
import {candidateLock} from '../sources';
import {enqueue} from '../work';
import {localChecks,modeSchema,prompts,selectPracticeEvidence,type Evidence,type PracticeSnapshot} from './policy';

const revision=z.number().int().positive();
const target={sessionId:uuid,expectedRevision:revision};
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('start_session'),payload:z.object({jobId:uuid,expectedJobRevision:revision,expectedCandidateRevision:revision,mode:modeSchema,retentionDays:z.number().int().min(1).max(365).default(30),communityIntel:z.string().trim().max(1500).default(''),facts:z.array(z.object({id:uuid,revision}).strict()).max(8).optional()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('save_attempt'),payload:z.object({...target,text:z.string().trim().min(1).max(6000),hypothetical:z.boolean(),requestFeedback:z.boolean().default(false),modelConsent:z.boolean().default(false)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('request_feedback'),payload:z.object({...target,attemptId:uuid,modelConsent:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('cancel_feedback'),payload:z.object({...target,attemptId:uuid}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('delete_session'),payload:z.object(target).strict()}).strict(),
]);
export async function sessionFor(tx:PoolClient,workspaceId:string,id:string){
 const s=(await tx.query('SELECT * FROM interview_sessions WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[workspaceId,id])).rows[0];
 if(!s)throw notFound();return s;
}
export async function assertFresh(tx:PoolClient,workspaceId:string,s:Record<string,any>){
 invariant(s.status==='active'&&new Date(s.expires_at).getTime()>Date.now(),'interview_stale','Practice evidence changed, was revoked or expired. Start a new session with current evidence.',409);
 const c=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1 FOR SHARE',[workspaceId])).rows[0];
 const j=(await tx.query('SELECT revision,archived FROM jobs WHERE workspace_id=$1 AND id=$2 FOR SHARE',[workspaceId,s.job_id])).rows[0];
 invariant(c?.ownership==='canonical'&&c.revision===s.candidate_revision&&j&&!j.archived&&j.revision===s.job_revision,'interview_stale','Candidate authority or selected role changed. Start a new session.',409);
 const invalid=(await tx.query("SELECT e.fact_id FROM interview_evidence e JOIN candidate_facts f ON f.workspace_id=e.workspace_id AND f.id=e.fact_id JOIN candidate_sources x ON x.workspace_id=e.workspace_id AND x.id=e.source_id WHERE e.workspace_id=$1 AND e.session_id=$2 AND (f.status<>'current' OR f.sensitivity<>'standard' OR f.revision<>e.fact_revision OR f.source_id<>e.source_id OR f.source_revision<>e.source_revision OR x.revision<>e.source_revision OR NOT x.model_consent OR x.classification='restricted' OR x.deleted_at IS NOT NULL)",[workspaceId,s.id])).rowCount;
 invariant(!invalid,'interview_stale','A supporting source is no longer current or disclosable.',409);
}
async function queueFeedback(tx:PoolClient,ctx:Context,s:Record<string,any>,a:Record<string,any>){
 await tx.query('UPDATE interview_attempts SET model_consent=true,accounting=null,usage=null,feedback=null,error_code=null,work_id=null,auth_session_id=null,model=null,provider=null,completed_at=null WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,a.id]);
 const c=config();
 if(!c.model.model||!c.model.apiKey){
  await tx.query("UPDATE interview_attempts SET status='model_unconfigured',error_code='model_unconfigured' WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,a.id]);return 'model_unconfigured';
 }
 assertDisclosureText(JSON.stringify(s.snapshot));assertDisclosureText(a.text);
 const work=await enqueue(tx,ctx.workspaceId,'interview_feedback',a.id+':'+s.revision,{sessionId:s.id,attemptId:a.id,api:c.model.api});
 // A lost response is not permission to bill a second request automatically.
 await tx.query('UPDATE work_items SET max_attempts=1 WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,work.id]);
 await tx.query("UPDATE interview_attempts SET status='queued',work_id=$1,auth_session_id=$2,model=$3,provider=$4,error_code=null,feedback=null,completed_at=null WHERE workspace_id=$5 AND id=$6",[work.id,ctx.sessionId,c.model.model,c.model.baseUrl,ctx.workspaceId,a.id]);return 'queued';
}
export async function interviewCommand(ctx:Context,raw:unknown,invocation?:{runId:string;quote:string}){
 const c=schema.parse(raw);
 await expireInterviews(ctx.workspaceId);
 const current=c.action==='start_session'?await candidateContext(ctx,undefined,8000):null;
 return command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);
  if(c.action==='start_session'){
   if(invocation){
    const user=(await tx.query("SELECT m.content,r.status FROM runs r JOIN messages m ON m.workspace_id=r.workspace_id AND m.run_id=r.id WHERE r.workspace_id=$1 AND r.id=$2 AND m.role='user' ORDER BY m.sequence DESC LIMIT 1 FOR SHARE OF r",[ctx.workspaceId,uuid.parse(invocation.runId)])).rows[0];
    const modeRequest={project_defense:/\bproject[ -]defen[cs]e\b/i,behavioral:/\b(?:behavioral|star)\b/i,system_design:/\bsystem[ -]design\b/i}[c.payload.mode];
    invariant(user?.status==='running'&&typeof user.content.text==='string'&&user.content.text.trim()===invocation.quote.trim()&&/\b(?:practice|rehearse)\b/i.test(invocation.quote)&&invocation.quote.includes(c.payload.jobId)&&modeRequest.test(invocation.quote),'explicit_request_required','Use an exact current practice request naming the role UUID and selected mode.',409);
   }
   const p=c.payload,person=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1 FOR SHARE',[ctx.workspaceId])).rows[0];
   invariant(person?.ownership==='canonical','candidate_authority_inactive','Review and activate Candidate knowledge before evidence-grounded practice.',409);
   invariant(person.revision===p.expectedCandidateRevision&&current?.revision===person.revision,'revision_conflict','Candidate knowledge changed. Refresh before starting practice.',409);
   const contextId=current&&'id' in current?current.id:undefined;
   invariant(contextId,'candidate_authority_inactive','Current approved candidate context is unavailable.',409);
   const job=(await tx.query('SELECT * FROM jobs WHERE workspace_id=$1 AND id=$2 FOR SHARE',[ctx.workspaceId,p.jobId])).rows[0];
   if(!job)throw notFound();
   invariant(!job.archived&&job.revision===p.expectedJobRevision,'revision_conflict','The selected role changed or is archived.',409);
   const available=(current!.facts as Evidence[]).filter(f=>f.value!==null);
   const facts=p.facts?p.facts.map(r=>{
    const f=available.find(f=>f.id===r.id&&f.revision===r.revision);
    invariant(f,'evidence_unavailable','Selected evidence is not in the current bounded approved context.',409);return f;
   }):selectPracticeEvidence(available);
   invariant(Buffer.byteLength(JSON.stringify(facts))<=14000,'evidence_budget','Select fewer whole evidence fields for this focused practice session.',409);
   invariant(new Set(facts.map(f=>f.id)).size===facts.length,'duplicate_evidence','Select each evidence item once.');
   const snapshot:PracticeSnapshot={role:{id:job.id,revision:job.revision,company:job.company,title:job.title,description:job.description.slice(0,4000),descriptionOmitted:job.description.length>4000},candidateRevision:person.revision,contextId,facts,evidenceCoverage:{sourceStatus:current!.sourceStatus,available:available.length,selected:facts.length},prompts:prompts[p.mode],communityIntel:p.communityIntel?{text:p.communityIntel,label:'Unverified practice context; not guaranteed employer questions'}:null};
   assertDisclosureText(JSON.stringify(snapshot));
   const id=crypto.randomUUID();
   const s=(await tx.query("INSERT INTO interview_sessions(id,workspace_id,job_id,job_revision,candidate_revision,context_id,mode,snapshot,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+$9*interval '1 day') RETURNING *",[id,ctx.workspaceId,job.id,job.revision,person.revision,contextId,p.mode,JSON.stringify(snapshot),p.retentionDays])).rows[0];
   for(const f of facts)await tx.query('INSERT INTO interview_evidence(workspace_id,session_id,fact_id,fact_revision,source_id,source_revision) VALUES($1,$2,$3,$4,$5,$6)',[ctx.workspaceId,id,f.id,f.revision,f.source_id,f.source_revision]);
   await assertFresh(tx,ctx.workspaceId,s);
   await event(tx,ctx,id,'interview_session_started',{jobId:job.id,mode:p.mode,candidateRevision:person.revision},1);
   return {id,revision:1,status:'active'};
  }
  const p=c.payload,s=await sessionFor(tx,ctx.workspaceId,p.sessionId);
  invariant(s.revision===p.expectedRevision,'revision_conflict','This practice session changed. Refresh before saving.',409);
  if(c.action==='delete_session'){
   await tx.query('SELECT retire_interview_records($1,ARRAY[$2::uuid],true,$3)',[ctx.workspaceId,s.id,'interview_deleted']);
   await event(tx,ctx,s.id,'interview_session_deleted',{});return {id:s.id,status:'deleted',revision:s.revision+1};
  }
  if(c.action!=='cancel_feedback')await assertFresh(tx,ctx.workspaceId,s);
  let a,status:string;
  if(c.action==='save_attempt'){
   const p=c.payload;
   invariant(!p.requestFeedback||p.modelConsent,'model_consent_required','Explicitly allow disclosure of this practice attempt and context before requesting feedback.',409);
   invariant(Number((await tx.query('SELECT count(*) FROM interview_attempts WHERE workspace_id=$1 AND session_id=$2',[ctx.workspaceId,s.id])).rows[0].count)<50,'attempt_limit','This session has 50 attempts. Start a new focused practice session.',409);
   const hypothetical=p.hypothetical||s.mode==='system_design';
   a=(await tx.query("INSERT INTO interview_attempts(id,workspace_id,session_id,text,hypothetical,local_checks,status) VALUES($1,$2,$3,$4,$5,$6,'saved') RETURNING *",[crypto.randomUUID(),ctx.workspaceId,s.id,p.text,hypothetical,JSON.stringify(localChecks(p.text,s.snapshot.facts,hypothetical))])).rows[0];
   status=p.requestFeedback?await queueFeedback(tx,ctx,s,a):'saved';
  }else{
   a=(await tx.query('SELECT * FROM interview_attempts WHERE workspace_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE',[ctx.workspaceId,s.id,c.payload.attemptId])).rows[0];
   if(!a)throw notFound();
   if(c.action==='cancel_feedback'){
    invariant(['queued','running'].includes(a.status),'interview_not_running','This feedback request is no longer active.',409);
    await tx.query("UPDATE work_items SET status='cancelled',lease_until=null,error_code='cancelled',updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status IN ('queued','leased')",[ctx.workspaceId,a.work_id]);
    await tx.query("UPDATE interview_attempts SET status='cancelled',feedback=null,error_code='cancelled',completed_at=now() WHERE workspace_id=$1 AND id=$2",[ctx.workspaceId,a.id]);status='cancelled';
   }else{
    invariant(['saved','model_unconfigured','failed','cancelled','interrupted'].includes(a.status),'interview_not_retryable','This attempt is already active or has feedback. Save a new attempt.',409);
    status=await queueFeedback(tx,ctx,s,a);
   }
  }
  await tx.query('UPDATE interview_sessions SET revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,s.id]);
  await event(tx,ctx,s.id,'interview_attempt_'+status,{attemptId:a.id},s.revision+1);
  return {id:s.id,attemptId:a.id,status,revision:s.revision+1};
 });
}
export async function expireInterviews(workspaceId?:string){
 return transaction(async tx=>{
  const groups=(await tx.query("SELECT workspace_id,array_agg(id) AS ids FROM interview_sessions WHERE status<>'deleted' AND expires_at<=now() AND ($1::uuid IS NULL OR workspace_id=$1) GROUP BY workspace_id",[workspaceId||null])).rows;
  for(const g of groups){await candidateLock(tx,g.workspace_id);await tx.query('SELECT retire_interview_records($1,$2::uuid[],true,$3)',[g.workspace_id,g.ids,'interview_expired']);}
  await tx.query("UPDATE interview_attempts a SET status='interrupted',error_code='worker_interrupted',completed_at=now() FROM work_items w WHERE a.workspace_id=w.workspace_id AND a.work_id=w.id AND a.status IN ('queued','running') AND ($1::uuid IS NULL OR a.workspace_id=$1) AND (w.status IN ('failed','cancelled') OR (w.status='leased' AND w.lease_until<=now()))",[workspaceId||null]);
  await tx.query("UPDATE work_items w SET status='cancelled',lease_until=null,error_code='worker_interrupted' FROM interview_attempts a WHERE a.workspace_id=w.workspace_id AND a.work_id=w.id AND a.status='interrupted' AND w.status IN ('queued','leased') AND ($1::uuid IS NULL OR w.workspace_id=$1)",[workspaceId||null]);
 });
}
export async function interviewView(ctx:Context,raw:{jobId?:string;sessionId?:string}={}){
 const p=z.object({jobId:uuid.optional(),sessionId:uuid.optional()}).strict().parse(raw);
 await expireInterviews(ctx.workspaceId);
 return transaction(async tx=>{
  await reauthorize(tx,ctx);await candidateLock(tx,ctx.workspaceId);
  const sessions=(await tx.query('SELECT id,job_id,job_revision,candidate_revision,mode,revision,status,expires_at,created_at FROM interview_sessions WHERE workspace_id=$1 AND ($2::uuid IS NULL OR job_id=$2) ORDER BY created_at DESC,id LIMIT 51',[ctx.workspaceId,p.jobId||null])).rows;
  let session=null,attempts=[];
  if(p.sessionId){
   session=await sessionFor(tx,ctx.workspaceId,p.sessionId);
   if(p.jobId)invariant(session.job_id===p.jobId,'not_found','Record not found.',404);
   if(session.status==='active')await assertFresh(tx,ctx.workspaceId,session);
   attempts=(await tx.query('SELECT id,session_id,text,hypothetical,local_checks,status,feedback,accounting,usage,error_code,created_at FROM interview_attempts WHERE workspace_id=$1 AND session_id=$2 ORDER BY created_at,id',[ctx.workspaceId,session.id])).rows;
  }
  const runtime=config(),model=runtime.model;
  const candidate=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  const roles=(await tx.query('SELECT id,revision,company,title FROM jobs WHERE workspace_id=$1 AND archived=false ORDER BY updated_at DESC,id LIMIT 101',[ctx.workspaceId])).rows;
  return {sessions:sessions.slice(0,50),partial:sessions.length>50,session,attempts,candidate,roles:roles.slice(0,100),rolesPartial:roles.length>100,modelConfigured:Boolean(model.model&&model.apiKey),transportAvailable:true,prompts,asOf:new Date().toISOString()};
 });
}
