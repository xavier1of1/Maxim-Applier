import crypto from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {type Context} from './auth';
import {command,event,jobFor,uuid} from './commands';
import {candidateLock} from './sources';
import {applicationFor,currentEvaluation,jobPolicy} from './application-material';
import {applicationWritable,queueApplicationProjection} from './application-authority';
import {currentPacket} from './packets';
import {duplicateRisk} from './application-duplicates';
import {invariant} from './errors';

const reason=z.string().trim().min(3).max(1000),rev=z.number().int().positive(),amount=z.number().finite().positive().max(10000000);
const salary=z.object({flat:amount.optional(),min:amount.optional(),max:amount.optional(),currency:z.string().length(3),period:z.enum(['annual','hour','month','unknown'])}).strict()
 .refine(s=>s.flat!==undefined&&s.min===undefined&&s.max===undefined||s.flat===undefined&&s.min!==undefined&&s.max!==undefined,'Specify one flat salary or both range bounds.');
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('update_posting_details'),payload:z.object({jobId:uuid,expectedJobRevision:rev,description:z.string().trim().min(50).max(100000),location:z.string().trim().max(300),url:z.string().url().max(2000).nullable(),reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_job_policy'),payload:z.object({jobId:uuid,expectedJobRevision:rev,expectedPolicyRevision:z.number().int().nonnegative(),salary:salary.nullable(),sourceQuote:z.string().min(3).max(2000),allowMaryland:z.boolean().default(false),overrideReason:z.string().max(1000).default(''),prioritySignals:z.array(z.enum(['connection','vt_alumni','recruiter','founder','target_company'])).max(5).default([])}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['strategic_override','revoke_override']),payload:z.object({applicationId:uuid,expectedRevision:rev,evaluationId:uuid,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['mark_started','mark_reviewed']),payload:z.object({applicationId:uuid,expectedRevision:rev,packetId:uuid,reason,filledManually:z.boolean().default(false)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('record_submission'),payload:z.object({applicationId:uuid,expectedRevision:rev,packetId:uuid.optional(),external:z.boolean(),confirmed:z.literal(true),duplicateReviewed:z.boolean().default(false),submittedAt:z.string().datetime({offset:true}).optional(),reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('record_outcome'),payload:z.object({applicationId:uuid,expectedRevision:rev,outcome:z.enum(['not_submitted','responded','interviewing','offer','rejected','withdrawn','unknown']),reason,correction:z.boolean().default(false)}).strict()}).strict(),
]);
async function action(tx:PoolClient,ctx:Context,app:Record<string,any>,type:string,why:string,snapshot:unknown){
 const id=crypto.randomUUID();
 await tx.query('INSERT INTO application_actions(id,workspace_id,application_id,event_type,actor_session,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[id,ctx.workspaceId,app.id,type,ctx.sessionId,why,JSON.stringify(snapshot)]);
 await event(tx,ctx,app.id,type,{actionId:id,reason:why,...snapshot as object},app.revision+1);
}
export async function applicationCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);await applicationWritable(tx,ctx.workspaceId);const w=ctx.workspaceId;
  if(c.action==='update_posting_details'){
   const p=c.payload,j=await jobFor(tx,ctx,p.jobId);
   invariant(j.revision===p.expectedJobRevision,'revision_conflict','Posting changed; refresh before correcting it.',409);
   invariant(!j.opening_key,'discovered_posting_immutable','Discovered postings retain their source evidence; review source updates instead.',409);
   if(p.url){const url=new URL(p.url);invariant(url.protocol==='https:'&&!url.username&&!url.password,'invalid_url','Use an HTTPS posting URL without credentials.');}
   invariant(!j.url||j.url===p.url,'opening_identity_changed','A different posting URL requires a distinct opening, not an overwrite.',409);
   await tx.query('UPDATE jobs SET description=$1,location=$2,url=$3,revision=revision+1,updated_at=now() WHERE workspace_id=$4 AND id=$5',[p.description,p.location,p.url,w,j.id]);
   await tx.query("UPDATE evaluations SET status='stale',revision=revision+1 WHERE workspace_id=$1 AND job_id=$2 AND status IN ('queued','running','completed','review_required')",[w,j.id]);
   await tx.query("UPDATE application_packets SET status='invalidated',revision=revision+1 WHERE workspace_id=$1 AND application_id IN(SELECT id FROM applications WHERE workspace_id=$1 AND job_id=$2) AND status IN ('draft','approved')",[w,j.id]);
   await tx.query("UPDATE applications SET workflow='packet_missing',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND job_id=$2 AND outcome='not_submitted'",[w,j.id]);
   await event(tx,ctx,j.id,'posting_details_corrected',{reason:p.reason,priorRevision:j.revision},j.revision+1);
   await queueApplicationProjection(tx,w);return {id:j.id,revision:j.revision+1};
  }
  if(c.action==='set_job_policy'){
   const p=c.payload,j=await jobFor(tx,ctx,p.jobId),old=(await tx.query('SELECT revision FROM job_policy_reviews WHERE workspace_id=$1 AND job_id=$2 FOR UPDATE',[w,j.id])).rows[0];
   invariant(j.revision===p.expectedJobRevision&&(old?.revision||0)===p.expectedPolicyRevision,'revision_conflict','Posting/policy changed; review the current values.',409);
   invariant(j.description.includes(p.sourceQuote),'policy_evidence_required','Quote the exact current job description supporting this review.');
   invariant(!p.allowMaryland||p.overrideReason.trim().length>=3,'override_reason_required','Maryland requires an explicit reason.');
   const revision=(old?.revision||0)+1;
   await tx.query('INSERT INTO job_policy_reviews(workspace_id,job_id,revision,job_revision,salary,allow_maryland,override_reason,priority_signals,source_quote) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(workspace_id,job_id) DO UPDATE SET revision=EXCLUDED.revision,job_revision=EXCLUDED.job_revision,salary=EXCLUDED.salary,allow_maryland=EXCLUDED.allow_maryland,override_reason=EXCLUDED.override_reason,priority_signals=EXCLUDED.priority_signals,source_quote=EXCLUDED.source_quote,created_at=now()',[w,j.id,revision,j.revision,JSON.stringify(p.salary),p.allowMaryland,p.overrideReason,[...new Set(p.prioritySignals)],p.sourceQuote]);
   await tx.query("UPDATE evaluations SET status='stale',revision=revision+1 WHERE workspace_id=$1 AND job_id=$2 AND status IN ('queued','running','completed','review_required')",[w,j.id]);
   await tx.query("UPDATE application_packets SET status='invalidated',revision=revision+1 WHERE workspace_id=$1 AND application_id IN(SELECT id FROM applications WHERE workspace_id=$1 AND job_id=$2) AND status IN ('draft','approved')",[w,j.id]);
   await tx.query("UPDATE applications SET workflow='packet_missing',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND job_id=$2 AND outcome='not_submitted'",[w,j.id]);
   await event(tx,ctx,j.id,'posting_policy_reviewed',{revision,jobRevision:j.revision,manualSourceQuote:p.sourceQuote,allowMaryland:p.allowMaryland},revision);
   await queueApplicationProjection(tx,w);return {jobId:j.id,revision,policy:await jobPolicy(tx,w,j)};
  }
  const p=c.payload,app=await applicationFor(tx,w,p.applicationId),job=await jobFor(tx,ctx,app.job_id);
  invariant(app.revision===p.expectedRevision,'revision_conflict','Application changed; refresh before recording an action.',409);
  if(c.action==='strategic_override'||c.action==='revoke_override'){
   const q=c.payload,e=await currentEvaluation(tx,w,q.evaluationId);
   invariant(e.job_id===app.job_id&&e.tier==='T1','override_not_applicable','A strategic override applies only to this opening and current T1 evaluation.',409);
   await tx.query('UPDATE strategic_overrides SET revoked_at=now() WHERE workspace_id=$1 AND application_id=$2 AND evaluation_id=$3 AND revoked_at IS NULL',[w,app.id,e.id]);
   if(c.action==='strategic_override')await tx.query('INSERT INTO strategic_overrides(id,workspace_id,application_id,evaluation_id,reason) VALUES($1,$2,$3,$4,$5)',[crypto.randomUUID(),w,app.id,e.id,q.reason]);
   await tx.query("UPDATE applications SET revision=revision+1,workflow='packet_missing',updated_at=now() WHERE workspace_id=$1 AND id=$2",[w,app.id]);
   if(c.action==='revoke_override')await tx.query("UPDATE application_packets SET status='invalidated',revision=revision+1 WHERE workspace_id=$1 AND application_id=$2 AND status='approved'",[w,app.id]);
   await action(tx,ctx,app,c.action,q.reason,{evaluationId:e.id,tier:e.tier});await queueApplicationProjection(tx,w);return {id:app.id,revision:app.revision+1,override:c.action==='strategic_override'};
  }
  if(c.action==='mark_started'||c.action==='mark_reviewed'){
   const q=c.payload,packet=await currentPacket(tx,w,q.packetId);
   invariant(app.status!=='archived'&&app.outcome==='not_submitted','application_inactive','Restore an active, unsubmitted application before recording assistance.',409);
   invariant(job.url,'posting_url_required','Record the posting URL before starting application assistance.',409);
   invariant(packet.application.id===app.id,'packet_scope','Packet belongs to another application.',409);
   const workflow=c.action==='mark_started'?'assist_running':'review_ready';
   await tx.query("UPDATE applications SET workflow=$1,assist_started_at=CASE WHEN $1='assist_running' THEN now() ELSE assist_started_at END,reviewed_at=CASE WHEN $1='review_ready' THEN now() ELSE reviewed_at END,filled_at=CASE WHEN $2 THEN now() ELSE filled_at END,revision=revision+1,updated_at=now() WHERE workspace_id=$3 AND id=$4",[workflow,q.filledManually,w,app.id]);
   await action(tx,ctx,app,c.action==='mark_started'?'application_assistance_started':'application_review_recorded',q.reason,{packetId:q.packetId,workflow,filledManually:q.filledManually,submission:'not_performed'});
   await queueApplicationProjection(tx,w);return {id:app.id,workflow,outcome:app.outcome,revision:app.revision+1};
  }
  if(c.action==='record_submission'){
   const q=c.payload,duplicates=await duplicateRisk(tx,w,job,app.id);
   invariant(duplicates.risk==='none'&&app.outcome!=='submitted'||q.duplicateReviewed,'duplicate_review_required','Review duplicate/reapplication history before recording another submission.',409);
   const submittedAt=q.submittedAt||new Date().toISOString();
   invariant(Date.parse(submittedAt)<=Date.now()+300000&&Date.parse(submittedAt)>=Date.parse('1900-01-01'),'invalid_submission_time','Submission time must be an actual past/current time.');
   let packet:Awaited<ReturnType<typeof currentPacket>>|null=null;
   if(!q.external){invariant(q.packetId,'packet_required','Select the current approved packet, or declare a legitimate external manual submission.');packet=await currentPacket(tx,w,q.packetId);invariant(packet.application.id===app.id,'packet_scope','Packet belongs to another application.',409);}
   else invariant(!q.packetId,'external_packet_unconfirmed','External manual submission is recorded without claiming an unverified packet was used.');
   const latest=(await tx.query("SELECT id,score,tier,policy,status FROM evaluations WHERE workspace_id=$1 AND job_id=$2 ORDER BY created_at DESC LIMIT 1",[w,job.id])).rows[0];
   const e=packet?.evaluation||latest,snapshot={jobId:job.id,company:job.company,title:job.title,url:job.url,evaluationId:e?.id||null,evaluationStatus:e?.status||'unknown',score:e?.score===null||e?.score===undefined?null:Number(e.score),tier:e?.tier||null,policy:e?.policy||{},candidateRevision:packet?.packet.candidate_revision||null,submittedAt,source:'user_declaration',external:q.external,duplicateRisk:duplicates.risk,
    packet:packet?{id:packet.packet.id,reportArtifactId:packet.packet.report_artifact_id,pdfArtifactId:packet.packet.pdf_artifact_id,reportHash:packet.packet.report_hash,pdfHash:packet.packet.pdf_hash,untailored:packet.packet.untailored}:null,finalSubmissionAutomation:'not_implemented'};
   await tx.query("UPDATE applications SET outcome='submitted',applied_at=$1,submitted_snapshot=$2,revision=revision+1,updated_at=now() WHERE workspace_id=$3 AND id=$4",[submittedAt,JSON.stringify(snapshot),w,app.id]);
   if(packet)for(const a of packet.packet.answers)await tx.query("UPDATE answer_uses SET status='submitted',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status='confirmed'",[w,a.useId]);
   await action(tx,ctx,app,'submission_recorded',q.reason,snapshot);await queueApplicationProjection(tx,w);return {id:app.id,outcome:'submitted',revision:app.revision+1,snapshot};
  }
  invariant(c.action==='record_outcome','action_denied','Unknown application action.');
  const q=c.payload;
  invariant(q.correction||!(q.outcome==='not_submitted'&&app.outcome!=='not_submitted'),'correction_required','Reversing recorded submission/outcome needs an explicit correction.',409);
  await tx.query('UPDATE applications SET outcome=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3',[q.outcome,w,app.id]);
  await action(tx,ctx,app,q.correction?'application_outcome_corrected':'application_outcome_recorded',q.reason,{from:app.outcome,outcome:q.outcome,source:'user_declaration'});
  await queueApplicationProjection(tx,w);return {id:app.id,outcome:q.outcome,revision:app.revision+1};
 });
}
