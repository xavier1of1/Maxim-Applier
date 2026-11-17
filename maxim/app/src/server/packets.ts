import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import {type Context,digest} from './auth';
import {command,event,jobFor,uuid} from './commands';
import {candidateLock} from './sources';
import {applicationFor,currentEvaluation,jobPolicy} from './application-material';
import {applicationWritable,queueApplicationProjection} from './application-authority';
import {artifactBytes} from './private-artifacts';
import {enqueue} from './work';
import {invariant,notFound} from './errors';
import {duplicateRisk} from './application-duplicates';

const ref=z.object({id:uuid,revision:z.number().int().positive()}).strict();
export async function packetFacts(tx:PoolClient,w:string,refs:{id:string;revision:number}[],allowPrivate:boolean){
 const ids=[...new Set(refs.map(r=>r.id))];invariant(ids.length===refs.length&&ids.length>0,'fact_selection','Select distinct approved facts.');
 const rows=(await tx.query("SELECT f.*,s.deleted_at,s.revision AS live_source_revision,s.classification FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.id=ANY($2::uuid[]) ORDER BY f.field_key",[w,ids])).rows;
 invariant(rows.length===ids.length&&rows.every(f=>f.status==='current'&&!f.deleted_at&&f.classification!=='restricted'&&f.source_revision===f.live_source_revision&&f.sensitivity!=='sensitive'&&(allowPrivate||f.sensitivity==='standard')&&refs.some(r=>r.id===f.id&&r.revision===f.revision)),'packet_evidence_stale','Packet facts are stale, restricted, sensitive or not explicitly permitted.',409);
 invariant(rows.some(f=>f.field_key==='candidate.name'&&typeof f.value==='string'),'candidate_name_required','Select an approved candidate.name fact.');return rows;
}
export async function currentPacket(tx:PoolClient,w:string,id:string){
 const p=(await tx.query('SELECT * FROM application_packets WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,id])).rows[0];if(!p)throw notFound();
 invariant(p.status==='approved','packet_not_approved','Review and approve this exact packet before using it.',409);
 const e=await currentEvaluation(tx,w,p.evaluation_id),app=await applicationFor(tx,w,p.application_id);
 invariant(e.job_revision===p.job_revision&&e.candidate_revision===p.candidate_revision,'packet_stale','Packet revisions are no longer current.',409);
 await packetFacts(tx,w,p.evidence.map((f:{id:string;revision:number})=>({id:f.id,revision:f.revision})),true);
 const deps=(await tx.query("SELECT 1 FROM answer_dependencies WHERE workspace_id=$1 AND entity_id=$2 AND status='invalidated' LIMIT 1",[w,p.id])).rowCount;
 invariant(!deps,'packet_stale','A packet answer was revoked or corrected.',409);
 for(const a of p.answers){
  const valid=(await tx.query("SELECT 1 FROM answer_uses u JOIN answer_memory a ON a.id=u.answer_id AND a.workspace_id=u.workspace_id WHERE u.workspace_id=$1 AND u.id=$2 AND u.status='confirmed' AND a.id=$3 AND a.revision=$4 AND a.status='approved' AND a.expires_at>now()",[w,a.useId,a.answerId,a.answerRevision])).rowCount;
  invariant(valid,'packet_stale','A packet answer is expired, consumed or no longer current.',409);
 }
 const job=(await tx.query('SELECT * FROM jobs WHERE workspace_id=$1 AND id=$2',[w,e.job_id])).rows[0],policy=await jobPolicy(tx,w,job,e.tier);
 invariant(['T1','T2','T3'].includes(e.tier)&&policy.eligibility==='eligible','policy_review_required','Current score/policy does not permit assisted application.',409);
 if(e.tier==='T1')invariant((await tx.query('SELECT 1 FROM strategic_overrides WHERE workspace_id=$1 AND application_id=$2 AND evaluation_id=$3 AND revoked_at IS NULL',[w,app.id,e.id])).rowCount,'strategic_override_required','The current T1 override is missing or revoked.',409);
 const report=await artifactBytes(tx,w,p.report_artifact_id,e.job_id),pdf=await artifactBytes(tx,w,p.pdf_artifact_id,e.job_id);
 invariant(report.row.content_hash===p.report_hash&&pdf.row.content_hash===p.pdf_hash,'packet_hash_changed','Approved packet bytes changed.',409);
 return {packet:p,evaluation:e,application:app};
}
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('build_packet'),payload:z.object({applicationId:uuid,evaluationId:uuid,expectedApplicationRevision:z.number().int().positive(),facts:z.array(ref).min(1).max(100),answerUseIds:z.array(uuid).max(30).default([]),allowPrivate:z.boolean().default(false),tailoredSelection:z.boolean().default(false)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('approve_packet'),payload:z.object({packetId:uuid,expectedRevision:z.number().int().positive(),contentHash:z.string().length(64),confirmed:z.literal(true),confirmedUntailored:z.boolean().default(false),duplicateReviewed:z.boolean().default(false),reason:z.string().trim().min(3).max(1000)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('revoke_packet'),payload:z.object({packetId:uuid,expectedRevision:z.number().int().positive(),reason:z.string().trim().min(3).max(1000)}).strict()}).strict(),
]);
export async function packetCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);await applicationWritable(tx,ctx.workspaceId);const w=ctx.workspaceId;
  if(c.action==='build_packet'){
   const p=c.payload,app=await applicationFor(tx,w,p.applicationId),e=await currentEvaluation(tx,w,p.evaluationId);
   invariant(app.status!=='archived','application_archived','Restore this application before preparing a packet.',409);
   invariant(app.revision===p.expectedApplicationRevision&&app.job_id===e.job_id,'revision_conflict','Application or evaluation changed.',409);
   invariant(Number(e.score)>=3,'packet_threshold','Retained native PDF-generation threshold is 3.0; this evaluation does not qualify.',409);
   const facts=await packetFacts(tx,w,p.facts,p.allowPrivate),answers=[];
   const job=await jobFor(tx,ctx,app.job_id);
   for(const id of [...new Set(p.answerUseIds)]){
    const u=(await tx.query("SELECT u.*,a.revision AS live_revision,a.status AS answer_status,a.expires_at,q.company FROM answer_uses u JOIN answer_memory a ON a.id=u.answer_id AND a.workspace_id=u.workspace_id JOIN answer_questions q ON q.id=u.question_id AND q.workspace_id=u.workspace_id WHERE u.workspace_id=$1 AND u.id=$2",[w,id])).rows[0];
    invariant(u?.status==='confirmed'&&u.answer_status==='approved'&&u.answer_revision===u.live_revision&&new Date(u.expires_at).getTime()>Date.now()&&u.company.trim().toLowerCase()===job.company.trim().toLowerCase(),'answer_not_ready','Select current confirmed answer reuses for this company.',409);answers.push({useId:u.id,answerId:u.answer_id,answerRevision:u.answer_revision,snapshot:u.snapshot});
   }
   const work=await enqueue(tx,w,'build_packet',c.commandId,{applicationId:app.id,evaluationId:e.id,jobId:job.id,jobRevision:job.revision,candidateRevision:e.candidate_revision,facts:facts.map(f=>({id:f.id,revision:f.revision})),allowPrivate:p.allowPrivate,untailored:!p.tailoredSelection,answers});
   await event(tx,ctx,app.id,'application_packet_queued',{workId:work.id,evaluationId:e.id,untailored:!p.tailoredSelection});
   return {workId:work.id,status:'queued',applicationId:app.id};
  }
  const p=c.payload,packet=(await tx.query('SELECT * FROM application_packets WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.packetId])).rows[0];if(!packet)throw notFound();
  invariant(packet.revision===p.expectedRevision,'revision_conflict','Packet changed; review its current revision.',409);
  const app=await applicationFor(tx,w,packet.application_id);
  if(c.action==='revoke_packet'){
   await tx.query("UPDATE application_packets SET status='revoked',revision=revision+1,approval_reason=$1 WHERE workspace_id=$2 AND id=$3",[p.reason,w,packet.id]);
   await tx.query("UPDATE applications SET workflow='packet_missing',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[w,app.id]);
   await event(tx,ctx,packet.id,'packet_revoked',{reason:p.reason},packet.revision+1);await queueApplicationProjection(tx,w);return {id:packet.id,status:'revoked',revision:packet.revision+1};
  }
  const approval=c.payload;
  invariant(app.status!=='archived','application_archived','Restore this application before approving a packet.',409);
  invariant(packet.status==='draft'&&packet.content_hash===approval.contentHash,'packet_changed','Review the exact unapproved packet hash.',409);
  const e=await currentEvaluation(tx,w,packet.evaluation_id),job=await jobFor(tx,ctx,app.job_id),policy=await jobPolicy(tx,w,job,e.tier);
  invariant(['T2','T3','T1'].includes(e.tier),'tier_no_apply','T0 is No Apply. A connection flag cannot override it.',409);
  if(e.tier==='T1')invariant((await tx.query('SELECT 1 FROM strategic_overrides WHERE workspace_id=$1 AND application_id=$2 AND evaluation_id=$3 AND revoked_at IS NULL',[w,app.id,e.id])).rowCount,'strategic_override_required','T1 requires an explicit strategic override for this evaluation.',409);
  invariant(policy.eligibility==='eligible','policy_review_required','Resolve blocked or unknown location/salary/clearance policy before approving an application packet.',409);
  invariant(!packet.untailored||approval.confirmedUntailored,'untailored_confirmation_required','Explicitly confirm use of this untailored resume.',409);
  const duplicates=await duplicateRisk(tx,w,job,app.id);invariant(duplicates.risk==='none'||approval.duplicateReviewed,'duplicate_review_required','Review the duplicate/reapplication warning before approval.',409);
  await packetFacts(tx,w,packet.evidence.map((f:{id:string;revision:number})=>({id:f.id,revision:f.revision})),true);
  const report=await artifactBytes(tx,w,packet.report_artifact_id,app.job_id),pdf=await artifactBytes(tx,w,packet.pdf_artifact_id,app.job_id);
  invariant(report.row.content_hash===packet.report_hash&&pdf.row.content_hash===packet.pdf_hash,'packet_hash_changed','Packet bytes changed; rebuild.',409);
  invariant(!(await tx.query("SELECT 1 FROM answer_dependencies WHERE workspace_id=$1 AND entity_id=$2 AND status='invalidated'",[w,packet.id])).rowCount,'packet_stale','Answer evidence changed.',409);
  await tx.query("UPDATE application_packets SET status='invalidated',revision=revision+1 WHERE workspace_id=$1 AND application_id=$2 AND status='approved'",[w,app.id]);
  await tx.query("UPDATE application_packets SET status='approved',approved_at=now(),approval_reason=$1,revision=revision+1 WHERE workspace_id=$2 AND id=$3",[p.reason,w,packet.id]);
  await currentPacket(tx,w,packet.id);
  await tx.query("UPDATE applications SET workflow='packet_ready',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[w,app.id]);
  await event(tx,ctx,packet.id,'application_packet_approved',{applicationId:app.id,evaluationId:e.id,reportHash:packet.report_hash,pdfHash:packet.pdf_hash,untailored:packet.untailored,reason:p.reason},packet.revision+1);
  await queueApplicationProjection(tx,w);return {id:packet.id,status:'approved',revision:packet.revision+1,contentHash:packet.content_hash};
 });
}
