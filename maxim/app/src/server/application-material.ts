import type {PoolClient} from 'pg';
import {invariant,notFound} from './errors';
import {engineSnapshot} from './evaluation-native';
import {domain} from './domain';
import {enqueue} from './work';
import {queueApplicationProjection} from './application-authority';

export async function applicationFor(tx:PoolClient,w:string,id:string){
 const row=(await tx.query('SELECT * FROM applications WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,id])).rows[0];if(!row)throw notFound();return row;
}
export async function currentEvaluation(tx:PoolClient,w:string,id:string){
 const e=(await tx.query('SELECT e.*,j.revision AS current_job_revision,c.revision AS current_candidate_revision,c.ownership FROM evaluations e JOIN jobs j ON j.id=e.job_id AND j.workspace_id=e.workspace_id JOIN candidates c ON c.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND e.id=$2 FOR UPDATE OF e',[w,id])).rows[0];
 if(!e)throw notFound();
 invariant(e.status==='completed'&&e.score!==null&&e.tier,'evaluation_unavailable','A complete valid Career-Ops evaluation is required.',409);
 invariant(e.ownership==='canonical'&&e.job_revision===e.current_job_revision&&e.candidate_revision===e.current_candidate_revision,'evaluation_stale','Candidate or job changed; evaluate the current revisions.',409);
 const engine=await engineSnapshot();invariant(engine.hash===e.input_snapshot.engine.hash,'engine_changed','Retained engine changed; evaluate again.',409);
 const review=(await tx.query('SELECT revision FROM job_policy_reviews WHERE workspace_id=$1 AND job_id=$2 AND job_revision=$3',[w,e.job_id,e.job_revision])).rows[0];
 invariant((review?.revision||0)===(e.input_snapshot.policyReviewRevision||0),'policy_changed','Reviewed posting policy changed; evaluate the current input.',409);
 const invalid=(await tx.query("SELECT 1 FROM fact_dependencies WHERE workspace_id=$1 AND entity_id=$2 AND status='invalidated' LIMIT 1",[w,id])).rowCount;
 invariant(!invalid,'evaluation_stale','Evaluation evidence is no longer current.',409);return e;
}
export async function jobPolicy(tx:PoolClient,w:string,job:Record<string,any>,tier?:string):Promise<Record<string,any>>{
 const profile=(await tx.query('SELECT * FROM workspace_policies WHERE workspace_id=$1',[w])).rows[0];
 if(profile?.profile!=='xavier-v1')return {ok:true,eligibility:'review',allowed:false,reviewRequired:true,urgent:false,flags:[{flagType:'policy',severity:'review',reason:'This candidate has no approved policy profile; Xavier defaults are not inherited.'}],policyRevision:profile?.revision||0};
 const observation=(await tx.query('SELECT raw_fields,policy FROM job_observations WHERE workspace_id=$1 AND job_id=$2 AND identity_conflict=false ORDER BY observed_at DESC LIMIT 1',[w,job.id])).rows[0];
 const raw=observation?.raw_fields||{},salary=raw.salaryRange?{min:raw.salaryRange.min,max:raw.salaryRange.max,currency:raw.salaryRange.currency,period:raw.salaryRange.interval==='per-year-salary'?'annual':raw.salaryRange.interval}:null;
 const components=raw.compensation?.summaryComponents;
 let structured=salary;
 if(components?.length===1){const c=components[0];if(c.compensationType==='Salary')structured={min:c.minValue,max:c.maxValue,currency:c.currencyCode,period:c.interval==='1 YEAR'?'annual':c.interval};}
 const review=(await tx.query('SELECT * FROM job_policy_reviews WHERE workspace_id=$1 AND job_id=$2 AND job_revision=$3',[w,job.id,job.revision])).rows[0];
 const result=domain({operation:'job_policy',tier,allowMaryland:review?.allow_maryland||false,overrideReason:review?.override_reason||'',prioritySignals:review?.priority_signals||[],job:{title:job.title,description:job.description,locations:[job.location,...(raw.secondaryLocations||[]).map((x:{location?:string})=>x.location).filter(Boolean)],salary:review?.salary||structured,postedAgeHours:job.posted_at?(Date.now()-new Date(job.posted_at).getTime())/3600000:null}});
 return {...result,policyRevision:profile.revision,policyReviewRevision:review?.revision||0};
}
export async function invalidateMaterial(tx:PoolClient,w:string,erase=false,factIds?:string[],sourceId?:string){
 const rows=(await tx.query("UPDATE evaluations e SET status='stale',revision=revision+1 WHERE workspace_id=$1 AND ($3 OR status IN ('queued','running','completed','review_required')) AND ($2::uuid[] IS NULL OR id IN(SELECT entity_id FROM fact_dependencies WHERE workspace_id=$1 AND fact_id=ANY($2::uuid[]))) AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM fact_dependencies d JOIN fact_versions v ON v.workspace_id=d.workspace_id AND v.fact_id=d.fact_id AND v.revision=d.fact_revision WHERE d.workspace_id=$1 AND d.entity_id=e.id AND v.source_id=$4)) RETURNING id,report_artifact_id",[w,factIds||null,erase,sourceId||null])).rows;
 const packets=(await tx.query("UPDATE application_packets p SET status='invalidated',revision=revision+1 WHERE workspace_id=$1 AND ($3 OR status IN ('draft','approved')) AND ($2::uuid[] IS NULL OR id IN(SELECT entity_id FROM fact_dependencies WHERE workspace_id=$1 AND fact_id=ANY($2::uuid[]))) AND ($4::uuid IS NULL OR EXISTS(SELECT 1 FROM fact_dependencies d JOIN fact_versions v ON v.workspace_id=d.workspace_id AND v.fact_id=d.fact_id AND v.revision=d.fact_revision WHERE d.workspace_id=$1 AND d.entity_id=p.id AND v.source_id=$4)) RETURNING *",[w,factIds||null,erase,sourceId||null])).rows;
 await tx.query("UPDATE applications SET workflow='packet_missing',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND outcome='not_submitted' AND id=ANY($2::uuid[])",[w,packets.map(p=>p.application_id)]);
 await tx.query("UPDATE work_items SET status='cancelled',error_code='evidence_changed',lease_until=null,updated_at=now() WHERE workspace_id=$1 AND status IN ('queued','leased') AND (input->>'evaluationId'=ANY($2::text[]) OR kind='build_packet')",[w,rows.map(r=>r.id)]);
 if(erase){
  await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
  const artifacts=[...rows.map(r=>r.report_artifact_id),...packets.flatMap(p=>[p.report_artifact_id,p.pdf_artifact_id])].filter(Boolean);
  for(const id of [...new Set<string>(artifacts)]){
   const historical=(await tx.query("SELECT 1 FROM application_actions WHERE workspace_id=$1 AND event_type='submission_recorded' AND (snapshot->'packet'->>'reportArtifactId'=$2 OR snapshot->'packet'->>'pdfArtifactId'=$2) LIMIT 1",[w,id])).rowCount;
   if(!historical){await tx.query("UPDATE artifacts SET deleted_at=now(),name='Erased derived material' WHERE workspace_id=$1 AND id=$2",[w,id]);await enqueue(tx,w,'purge_artifact',id,{artifactId:id});}
  }
  await tx.query("UPDATE evaluations SET input_snapshot=jsonb_build_object('redacted',true),explanation=null WHERE workspace_id=$1 AND id=ANY($2::uuid[])",[w,rows.map(r=>r.id)]);
  await tx.query("UPDATE application_packets SET evidence='[]',answers='[]' WHERE workspace_id=$1 AND id=ANY($2::uuid[])",[w,packets.map(p=>p.id)]);
  await tx.query("UPDATE work_items SET input=jsonb_build_object('redacted',true),result=jsonb_build_object('redacted',true) WHERE workspace_id=$1 AND id=ANY($2::uuid[])",[w,packets.map(p=>p.id)]);
 }
 await queueApplicationProjection(tx,w);
}
