import type {PoolClient} from 'pg';
import {z} from 'zod';
import {type Context,digest,reauthorize} from './auth';
import {transaction} from './db';
import {command,event,uuid} from './commands';
import {candidateLock} from './sources';
import {applicationWritable} from './application-authority';
import {policyFor,intelligenceLock,capacity,protectedJob,activeLead} from './intelligence-policy';
import {engineSnapshot} from './evaluation-native';
import {jobFitJoin} from './job-fit';
import {domain} from './domain';
import {enqueue} from './work';
import {invariant,notFound} from './errors';

async function fence(tx:PoolClient,w:string){await candidateLock(tx,w);await applicationWritable(tx,w);await intelligenceLock(tx,w);}
async function plan(tx:PoolClient,w:string){
 const p=await policyFor(tx,w),cap=await capacity(tx,w),engine=await engineSnapshot();
 const busy=Boolean((await tx.query("SELECT 1 FROM work_items WHERE workspace_id=$1 AND status IN ('queued','leased') AND kind IN ('evaluate_job','discover_jobs','build_packet','browser_action') LIMIT 1",[w])).rowCount);
 const pool=busy?[]:(await tx.query(`SELECT j.*,row_to_json(fit) AS fit,(${activeLead}) AS active FROM jobs j ${jobFitJoin}
 WHERE j.workspace_id=$1 AND j.compacted_at IS NULL AND NOT (${protectedJob})
 ORDER BY coalesce(j.last_seen_at,j.updated_at,j.created_at),j.id LIMIT 2000`,[w,engine.hash])).rows;
 let excess=Math.max(0,cap.active-cap.limit);
 const jobs=pool.filter(j=>{const old=new Date(j.last_seen_at||j.updated_at||j.created_at).getTime()<Date.now()-p.value.idleArchiveDays*86400000;if(old||j.archived){if(j.active)excess=Math.max(0,excess-1);return true;}if(j.active&&excess>0){excess--;return true;}return false;}).slice(0,50);
 const runs=busy?[]:(await tx.query("SELECT id FROM discovery_runs WHERE workspace_id=$1 AND raw_compacted_at IS NULL AND status IN ('completed','partial','failed','cancelled') AND coalesce(completed_at,created_at)<now()-$2*interval '1 day' ORDER BY created_at,id LIMIT 20",[w,p.value.rawRetentionDays])).rows.map(r=>r.id);
 const fingerprint=digest(JSON.stringify({revision:p.revision,busy,cap,jobs:jobs.map(j=>({id:j.id,revision:j.revision,evaluation:j.fit?.id})),runs}));
 return {policy:p,cap,busy,jobs,runs,fingerprint};
}
export async function retentionPreview(ctx:Context){
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 return transaction(async tx=>{await reauthorize(tx,ctx);await fence(tx,ctx.workspaceId);const p=await plan(tx,ctx.workspaceId);
  return {fingerprint:p.fingerprint,revision:p.policy.revision,capacity:p.cap,busy:p.busy,jobs:p.jobs.map(j=>({id:j.id,revision:j.revision,title:j.title,company:j.company})),runs:p.runs.length,maximumBatch:50,asOf:new Date().toISOString()};});
}
export async function compact(tx:PoolClient,w:string,expected?:string){
 const p=await plan(tx,w);if(expected)invariant(p.fingerprint===expected,'cleanup_preview_changed','Jobs, protection, work or policy changed. Preview cleanup again.',409);
 invariant(p.policy.active,'intelligence_setup_required','Save retention settings before compaction.',409);
 if(p.busy)return {archived:0,rawRuns:0,hold:'active_application_work'};
 for(const j of p.jobs){
  const metadata=domain({operation:'job_metadata',title:j.title,description:j.description}),reason=j.archived?'dismissed':p.cap.active>p.cap.limit?'capacity':'idle';
  await tx.query(`INSERT INTO job_archive(workspace_id,job_id,title,company,posted_at,first_seen_at,last_seen_at,location,url,source,qualifications,score,tier,score_current,candidate_revision,industry,role_lane,reason)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
   ON CONFLICT(workspace_id,job_id) DO UPDATE SET qualifications=EXCLUDED.qualifications,score=EXCLUDED.score,tier=EXCLUDED.tier,score_current=EXCLUDED.score_current,candidate_revision=EXCLUDED.candidate_revision,industry=EXCLUDED.industry,role_lane=EXCLUDED.role_lane,reason=EXCLUDED.reason,archived_at=now(),restored_at=null`,
   [w,j.id,j.title,j.company,j.posted_at,j.first_seen_at,j.last_seen_at,j.location,j.url,j.source_platform,metadata.qualifications,j.fit?.score??null,j.fit?.tier??null,j.fit?.current||false,j.fit?.candidate_revision??null,j.industry,j.role_lane||metadata.lane,reason]);
  const reports=(await tx.query('SELECT a.id FROM artifacts a JOIN evaluations e ON e.workspace_id=a.workspace_id AND e.report_artifact_id=a.id WHERE e.workspace_id=$1 AND e.job_id=$2 AND a.deleted_at IS NULL',[w,j.id])).rows;
  await tx.query("UPDATE jobs SET description='',archived=true,compacted_at=now(),discovery_policy='{}',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[w,j.id]);
  await tx.query("UPDATE evaluations SET status='stale',input_snapshot=jsonb_build_object('compacted',true),explanation=null,output_manifest='{}',report_artifact_id=null,revision=revision+1 WHERE workspace_id=$1 AND job_id=$2",[w,j.id]);
  await tx.query("UPDATE job_observations SET raw_fields='{}',policy='{}' WHERE workspace_id=$1 AND job_id=$2",[w,j.id]);
  for(const a of reports){await tx.query('UPDATE artifacts SET deleted_at=now() WHERE workspace_id=$1 AND id=$2',[w,a.id]);await enqueue(tx,w,'purge_artifact',a.id,{artifactId:a.id});}
  await event(tx,{workspaceId:w},j.id,'job_compacted',{reason,archive:'job_archive',qualificationsRetained:Boolean(metadata.qualifications)});
 }
 if(p.runs.length){
  // Raw pages are cache checkpoints, never the authority for submitted evidence.
  await tx.query("UPDATE discovery_pages SET payload='{}' WHERE workspace_id=$1 AND run_id=ANY($2::uuid[])",[w,p.runs]);
  await tx.query("UPDATE job_observations o SET raw_fields='{}' FROM jobs j WHERE o.workspace_id=$1 AND o.run_id=ANY($2::uuid[]) AND j.workspace_id=o.workspace_id AND j.id=o.job_id AND NOT ("+protectedJob+")",[w,p.runs]);
  await tx.query('UPDATE discovery_runs SET raw_compacted_at=now() WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[w,p.runs]);
 }
 return {archived:p.jobs.length,rawRuns:p.runs.length};
}
export async function retentionCommand(ctx:Context,raw:unknown){
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 const c=z.discriminatedUnion('action',[
  z.object({commandId:uuid,action:z.literal('compact'),payload:z.object({fingerprint:z.string().length(64),confirmed:z.literal(true)}).strict()}).strict(),
  z.object({commandId:uuid,action:z.literal('restore'),payload:z.object({jobId:uuid}).strict()}).strict(),
 ]).parse(raw);
 return command(ctx,c.commandId,c,async tx=>{const w=ctx.workspaceId;await fence(tx,w);
  if(c.action==='compact')return compact(tx,w,c.payload.fingerprint);
  const a=(await tx.query('SELECT * FROM job_archive WHERE workspace_id=$1 AND job_id=$2 AND restored_at IS NULL FOR UPDATE',[w,c.payload.jobId])).rows[0];if(!a)throw notFound();
  invariant((await capacity(tx,w)).available,'job_capacity_reached','Archive another unprotected lead or increase capacity before restoring.',409);
  await tx.query("UPDATE jobs SET archived=false,compacted_at=null,description='',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[w,a.job_id]);
  await tx.query('UPDATE job_archive SET restored_at=now() WHERE workspace_id=$1 AND job_id=$2',[w,a.job_id]);
  await event(tx,ctx,a.job_id,'archived_job_restored',{detailsRequired:true,oldScore:'historical_only'});return {id:a.job_id,detailsRequired:true};
 });
}
export async function archiveView(ctx:Context,q:URLSearchParams){
 const offset=z.coerce.number().int().min(0).max(10000000).parse(q.get('offset')||0),search=z.string().max(200).parse(q.get('q')||'');
 return transaction(async tx=>{await reauthorize(tx,ctx);const params=[ctx.workspaceId,search];
  const where="workspace_id=$1 AND restored_at IS NULL AND ($2='' OR strpos(lower(company||' '||title||' '||coalesce(location,'')),lower($2))>0)";
  const rows=(await tx.query('SELECT * FROM job_archive WHERE '+where+' ORDER BY archived_at DESC,job_id LIMIT 51 OFFSET $3',[...params,offset])).rows;
  return {jobs:rows.slice(0,50),more:rows.length>50,offset,total:Number((await tx.query('SELECT count(*) FROM job_archive WHERE '+where,params)).rows[0].count),asOf:new Date().toISOString()};});
}
