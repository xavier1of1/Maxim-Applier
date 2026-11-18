import crypto from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {database,transaction} from '../db';
import {type Context,reauthorize} from '../auth';
import {command,event,uuid} from '../commands';
import {candidateLock} from '../sources';
import {currentPacket} from '../packets';
import {applicationWritable} from '../application-authority';
import {enqueue} from '../work';
import {questionPolicy,normalizeQuestion} from '../answer-policy';
import {assertUsable} from '../answer-validity';
import {invariant,notFound} from '../errors';
import {destination,type Field,type Observation} from './policy';

const rev=z.number().int().positive();
const base={sessionId:uuid,expectedRevision:rev};
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('open'),payload:z.object({applicationId:uuid,packetId:uuid,expectedApplicationRevision:rev,autosaveConsent:z.literal(true),privateConsent:z.boolean().default(false)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['observe','pause','close','resume','fill_known']),payload:z.object(base).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('handoff'),payload:z.object({...base,manualOnly:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('fill'),payload:z.object({...base,observationId:uuid,fieldId:uuid,evidence:z.object({kind:z.enum(['fact','answer_use']),id:uuid,revision:rev}).strict()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('attach_packet'),payload:z.object({...base,observationId:uuid,fieldId:uuid}).strict()}).strict(),
]);
export async function browserSession(tx:PoolClient,w:string,id:string){
 const s=(await tx.query('SELECT * FROM browser_sessions WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,id])).rows[0];if(!s)throw notFound();return s;
}
export async function browserEvidence(tx:PoolClient,ctx:Context,s:Record<string,any>,field:Field,evidence:{kind:string;id:string;revision:number}){
 const policy=questionPolicy(field.label);
 invariant(!['credential','attestation','self_id'].includes(policy.kind),'browser_manual_question','Credentials, declarations and voluntary self-identification stay manual.');
 if(evidence.kind==='fact'){
  const f=(await tx.query("SELECT f.*,s.deleted_at,s.revision AS live_source FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.id=$2",[ctx.workspaceId,evidence.id])).rows[0];
  invariant(f&&policy.factKey===f.field_key&&f.revision===evidence.revision&&f.status==='current'&&!f.deleted_at&&f.source_revision===f.live_source,'browser_evidence_stale','Use a current fact that exactly answers this observed question.',409);
  invariant(f.sensitivity==='standard'||s.private_consent&&f.sensitivity==='private','browser_private_review','Private data requires explicit local form disclosure consent.');
  invariant(typeof f.value==='string'||typeof f.value==='boolean','browser_value_type','This field requires a reviewed scalar answer.');return f.value;
 }
 const row=(await tx.query('SELECT u.*,a.*,u.revision AS use_revision,u.status AS use_status,u.answer_revision,q.exact_text,q.company,q.context,q.normalized_text FROM answer_uses u JOIN answer_memory a ON a.id=u.answer_id AND a.workspace_id=u.workspace_id JOIN answer_questions q ON q.id=u.question_id AND q.workspace_id=u.workspace_id WHERE u.workspace_id=$1 AND u.id=$2',[ctx.workspaceId,evidence.id])).rows[0];
 const job=(await tx.query('SELECT j.company FROM jobs j JOIN applications a ON a.job_id=j.id AND a.workspace_id=j.workspace_id WHERE a.workspace_id=$1 AND a.id=$2',[ctx.workspaceId,s.application_id])).rows[0];
 invariant(row&&row.use_status==='confirmed'&&row.use_revision===evidence.revision&&row.answer_revision===row.revision&&row.company===job.company.trim().toLowerCase()&&row.normalized_text===normalizeQuestion(field.label),'browser_answer_scope','Confirm a current answer reuse for this exact question and company.',409);
 await assertUsable(tx,ctx,row,false);
 invariant(row.sensitivity==='standard'||s.private_consent,'browser_private_review','Private answer use requires explicit local disclosure consent.');
 if(field.tag==='select')invariant(JSON.stringify([...(row.context.options||[])].sort())===JSON.stringify(field.options.map(o=>o.value).sort()),'browser_answer_options','Select options differ from the approved question.');
 return row.text;
}
export async function assertBrowserProgress(tx:PoolClient,ctx:Context,s:Record<string,any>){
 for(const [signature,record]of Object.entries(s.progress) as [string,{evidence?:{kind:string;id:string;revision:number}}][]){
  if(!record.evidence?.kind)continue;
  const field=(s.observation as Observation).fields.find(f=>f.signature===signature);
  invariant(field,'browser_progress_stale','An acknowledged control changed. Review this application again.',409);
  await browserEvidence(tx,ctx,s,field,record.evidence);
 }
}
export async function browserCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);await applicationWritable(tx,ctx.workspaceId);
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[ctx.workspaceId+':browser']);
  let s;
  if(c.action==='open'){
   const p=c.payload,b=await currentPacket(tx,ctx.workspaceId,p.packetId);
   invariant(b.application.id===p.applicationId&&b.application.revision===p.expectedApplicationRevision&&b.application.outcome==='not_submitted'&&b.application.status!=='archived','browser_application_stale','Select this current active application and approved packet.',409);
   invariant(!(await tx.query("SELECT 1 FROM browser_sessions WHERE workspace_id=$1 AND status NOT IN ('closed','failed')",[ctx.workspaceId])).rowCount,'browser_session_active','Close the existing dedicated browser session first.',409);
   const job=(await tx.query('SELECT * FROM jobs WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,b.application.job_id])).rows[0],d=destination(job.application_url||job.url||'');
   s=(await tx.query('INSERT INTO browser_sessions(id,workspace_id,application_id,packet_id,candidate_revision,provider,origin,url,actor_session,autosave_consent,private_consent) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *',[crypto.randomUUID(),ctx.workspaceId,p.applicationId,p.packetId,b.packet.candidate_revision,d.provider,d.origin,d.url,ctx.sessionId,true,p.privateConsent])).rows[0];
  }else{
   s=await browserSession(tx,ctx.workspaceId,c.payload.sessionId);
   invariant(s.revision===c.payload.expectedRevision,'revision_conflict','Browser progress changed. Refresh before acting.',409);
   invariant(!['closed','failed'].includes(s.status),'browser_session_closed','Open a new session instead.');
   invariant(c.action==='close'||s.status!=='manual_handoff','browser_manual_control','Automation is detached after handoff; only closing remains available.');
   invariant(!(await tx.query("SELECT 1 FROM browser_actions WHERE workspace_id=$1 AND session_id=$2 AND status IN ('queued','running')",[ctx.workspaceId,s.id])).rowCount,'browser_action_pending','Wait for the acknowledged action before another command.',409);
   if(['fill','fill_known','attach_packet','handoff'].includes(c.action)){
    const b=await currentPacket(tx,ctx.workspaceId,s.packet_id);
    invariant(b.packet.candidate_revision===s.candidate_revision,'browser_candidate_stale','Candidate or packet changed; start a fresh reviewed session.',409);
    invariant(['observed','review_ready'].includes(s.status),'browser_review_required','Re-observe the paused page before any field action.',409);
   if(c.action==='handoff')await assertBrowserProgress(tx,ctx,s);
   }
  }
  if(c.action==='fill'||c.action==='attach_packet'){
   const p=c.payload,observation=s.observation as Observation,field=observation.fields?.find(f=>f.id===p.fieldId);
   invariant(field&&observation.id===p.observationId,'browser_observation_stale','Select a current observed field.',409);
   if(c.action==='fill')await browserEvidence(tx,ctx,s,field,c.payload.evidence);
  }
  const actionId=crypto.randomUUID();
  await tx.query('INSERT INTO browser_actions(id,workspace_id,session_id,command_id,kind,field_id) VALUES($1,$2,$3,$4,$5,$6)',[actionId,ctx.workspaceId,s.id,c.commandId,c.action,'fieldId'in c.payload?c.payload.fieldId:null]);
  const work=await enqueue(tx,ctx.workspaceId,'browser_action',c.commandId,{sessionId:s.id,actionId,action:c.action,payload:c.payload,actorSession:ctx.sessionId});
  await tx.query('UPDATE browser_sessions SET actor_session=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3',[ctx.sessionId,ctx.workspaceId,s.id]);
  await event(tx,ctx,s.id,'browser_action_queued',{action:c.action,workId:work.id,applicationId:s.application_id},s.revision+1);
  return {sessionId:s.id,actionId,workId:work.id,revision:s.revision+1,status:'queued',submission:'not_performed'};
 });
}
export async function browserView(ctx:Context){
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await reauthorize(tx,ctx);
  const sessions=(await tx.query('SELECT s.*,j.company,j.title,p.pdf_hash FROM browser_sessions s JOIN applications a ON a.id=s.application_id AND a.workspace_id=s.workspace_id JOIN jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id JOIN application_packets p ON p.id=s.packet_id AND p.workspace_id=s.workspace_id WHERE s.workspace_id=$1 ORDER BY s.created_at DESC LIMIT 20',[ctx.workspaceId])).rows;
  const facts=(await tx.query("SELECT f.id,f.field_key,f.value,f.revision,f.sensitivity FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND s.deleted_at IS NULL AND f.source_revision=s.revision",[ctx.workspaceId])).rows;
  return {sessions:sessions.map(s=>({...s,choices:(s.observation.fields||[]).map((f:Field)=>{const policy=questionPolicy(f.label);return {fieldId:f.id,policy,facts:facts.filter(v=>v.field_key===policy.factKey&&(v.sensitivity==='standard'||s.private_consent&&v.sensitivity==='private'))};})})),actions:(await tx.query('SELECT id,session_id,kind,field_id,status,result,created_at FROM browser_actions WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100',[ctx.workspaceId])).rows,asOf:new Date().toISOString()};
 });
}
