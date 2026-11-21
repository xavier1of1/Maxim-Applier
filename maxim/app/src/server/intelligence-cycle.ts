import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {transaction} from './db';
import {config} from './config';
import {domain} from './domain';
import {candidateLock} from './sources';
import {applicationWritable} from './application-authority';
import {compact} from './intelligence-retention';
import {policyFor,intelligenceLock,activeLead} from './intelligence-policy';
import {budgetView,reserveEvaluation,reconcileReservations} from './intelligence-budget';
import {jobFitJoin} from './job-fit';
import {engineSnapshot} from './evaluation-native';
import {queueCareerOpsEvaluation} from './evaluations';
import {queueDiscoverySearch} from './discovery';
import {enqueue,checkLease,finishWork,type WorkItem} from './work';
import {event} from './commands';
import {invariant,DomainError} from './errors';

export function screeningSummaries(jobs:Record<string,any>[]){
 const clip=(v:string,n:number)=>Buffer.from(v.replace(/[\x00-\x1f\x7f]/g,' ')).subarray(0,n).toString('utf8');
 return jobs.map(j=>{
  const summary={id:j.id,company:clip(j.company,200),title:clip(j.title,240),description:clip(j.description,1400),ageHours:j.age_hours===null?null:Number(j.age_hours),
   blocked:!j.discovery_policy?.flags?.some((f:{flagType:string;severity:string})=>f.flagType==='location'&&f.severity==='positive')||j.discovery_policy?.flags?.some((f:{severity:string})=>f.severity==='blocker'),
   fullPosting:!['summary','missing','unavailable'].includes(j.discovery_policy?.detailStatus),hasEvaluation:Boolean(j.evaluation_id&&(j.current||['queued','running','failed','cancelled','review_required'].includes(j.evaluation_status))),priority:j.discovery_policy?.flags?.some((f:{flagType:string})=>f.flagType==='connection_overlay'),holdReason:typeof j.automatic_hold==='string'?j.automatic_hold.slice(0,120):null};
  while(Buffer.byteLength(JSON.stringify(summary))>2000)summary.description=summary.description.slice(0,Math.floor(summary.description.length/2));
  return summary;
 });
}
export async function screening(tx:PoolClient,w:string){
 const p=await policyFor(tx,w),engine=await engineSnapshot();
 const facts=(await tx.query("SELECT f.field_key,f.value FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND f.sensitivity='standard' AND s.model_consent AND s.deleted_at IS NULL AND s.revision=f.source_revision AND s.classification<>'restricted'",[w])).rows;
 const evidenceTerms=[...new Set<string>(facts.filter(f=>f.field_key.startsWith('skills.')).flatMap(f=>(Array.isArray(f.value)?f.value:[f.value]).filter((v:unknown):v is string=>typeof v==='string').flatMap((v:string)=>v.split(/[,;\n|]+/)).map((v:string)=>v.trim()).filter((v:string)=>v.length>=3&&v.length<=60)))].slice(0,80);
 const targetTerms=p.value.terms.length?p.value.terms:facts.filter(f=>f.field_key==='preferences.roles').flatMap(f=>Array.isArray(f.value)?f.value:[]).slice(0,10);
 const cohort=activeLead+(p.value.scoringScope==='all_scanned'?' AND j.opening_key IS NOT NULL':'');
 const total=Number((await tx.query('SELECT count(*) FROM jobs j WHERE j.workspace_id=$1 AND '+cohort,[w])).rows[0].count),cycleCount=Number((await tx.query('SELECT count(*) FROM intelligence_cycles WHERE workspace_id=$1',[w])).rows[0].count),windowOffset=total>200?cycleCount*200%total:0;
 const jobSql=`SELECT j.id,j.company,j.title,left(j.description,1800) AS description,j.revision,j.posted_at,j.discovery_policy,h.reason AS automatic_hold,
 fit.id AS evaluation_id,fit.current,fit.status AS evaluation_status,EXTRACT(EPOCH FROM now()-j.posted_at)/3600 AS age_hours
 FROM jobs j ${jobFitJoin} LEFT JOIN intelligence_job_holds h ON h.workspace_id=j.workspace_id AND h.job_id=j.id AND h.job_revision=j.revision AND h.candidate_revision=(SELECT revision FROM candidates WHERE workspace_id=$1)
 WHERE j.workspace_id=$1 AND ${cohort}
 ORDER BY (coalesce(j.discovery_policy->'flags' @> '[{"flagType":"location","severity":"positive"}]',false) AND (fit.id IS NULL OR NOT coalesce(fit.current,false) AND fit.status IN ('completed','stale'))) DESC,
 j.posted_at DESC NULLS LAST,j.first_seen_at DESC NULLS LAST,j.id`;
 const jobs=(await tx.query(jobSql+' LIMIT 200 OFFSET $3',[w,engine.hash,windowOffset])).rows;
 if(windowOffset&&jobs.length<200)jobs.push(...(await tx.query(jobSql+' LIMIT $3',[w,engine.hash,200-jobs.length])).rows);
 const offset=Number((await tx.query("SELECT count(*) FROM evaluation_reservations WHERE workspace_id=$1 AND status<>'released'",[w])).rows[0].count);
 const result=domain({operation:'screen_jobs',explorationOffset:offset,policy:p.value,evidenceTerms,targetTerms,jobs:screeningSummaries(jobs)});
 return {policy:p,selected:result.selected as {id:string;reasons:unknown;evidenceTerms:string[]}[],held:result.held as {id:string;reason:string}[],jobs,targetTerms,evidenceAvailable:evidenceTerms.length>0,kind:result.kind,window:{offset:windowOffset,total,screened:jobs.length}};
}
export async function enqueueCycle(tx:PoolClient,w:string,kind='manual'){
 await intelligenceLock(tx,w);const p=await policyFor(tx,w);
 invariant(p.active,'intelligence_setup_required','Save discovery limits before running a cycle.',409);
 const prior=(await tx.query("SELECT c.id FROM intelligence_cycles c JOIN work_items x ON x.id=c.work_id AND x.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND x.status IN ('queued','leased') LIMIT 1",[w])).rows[0];if(prior)return prior;
 const id=crypto.randomUUID(),work=await enqueue(tx,w,'intelligence_cycle',id,{cycleId:id,policyRevision:p.revision,cleanupDue:p.value.cleanupEnabled&&new Date(p.next_cleanup_at).getTime()<=Date.now()});
 await tx.query('INSERT INTO intelligence_cycles(id,workspace_id,policy_revision,kind,work_id,receipt) VALUES($1,$2,$3,$4,$5,$6)',[id,w,p.revision,kind,work.id,JSON.stringify({policy:p.value})]);
 return {id,status:'queued'};
}
export async function tickIntelligence(){
 await transaction(async tx=>{
  await tx.query("UPDATE discovery_runs r SET status=CASE WHEN x.status='cancelled' THEN 'cancelled' ELSE 'failed' END,error_code=coalesce(x.error_code,'worker_interrupted'),completed_at=coalesce(r.completed_at,now()) FROM work_items x WHERE x.workspace_id=r.workspace_id AND x.id=r.work_id AND x.status IN ('failed','cancelled') AND r.status IN ('queued','running')");
  const interrupted=(await tx.query("SELECT DISTINCT r.workspace_id FROM evaluation_reservations r JOIN evaluations e ON e.workspace_id=r.workspace_id AND e.id=r.evaluation_id JOIN work_items x ON x.workspace_id=e.workspace_id AND x.id=e.work_id WHERE r.status IN ('reserved','sending') AND (x.status IN ('failed','completed','cancelled') OR x.lease_until<now()) LIMIT 20")).rows;
  for(const row of interrupted)await reconcileReservations(tx,row.workspace_id);
  const rows=(await tx.query("SELECT * FROM discovery_policies WHERE (value->>'autoScan'='true' AND next_scan_at<=now()) OR (value->>'autoScore'='true' AND next_score_at<=now()) OR (value->>'cleanupEnabled'='true' AND next_cleanup_at<=now()) ORDER BY updated_at LIMIT 10")).rows;
  for(const row of rows){await reconcileReservations(tx,row.workspace_id);await enqueueCycle(tx,row.workspace_id,'scheduled');const p=await policyFor(tx,row.workspace_id);
   await tx.query("UPDATE discovery_policies SET next_scan_at=CASE WHEN next_scan_at<=now() THEN now()+$1*interval '1 minute' ELSE next_scan_at END,next_score_at=CASE WHEN next_score_at<=now() THEN now()+$2*interval '1 minute' ELSE next_score_at END WHERE workspace_id=$3",[p.value.scanIntervalMinutes,p.value.scoreIntervalMinutes,row.workspace_id]);
   await tx.query("UPDATE discovery_policies SET next_cleanup_at=CASE WHEN next_cleanup_at<=now() THEN now()+interval '1 day' ELSE next_cleanup_at END WHERE workspace_id=$1",[row.workspace_id]);
  }
 });
}
export async function runIntelligenceCycle(item:WorkItem){
 await transaction(async tx=>{
  await candidateLock(tx,item.workspace_id);await applicationWritable(tx,item.workspace_id);await intelligenceLock(tx,item.workspace_id);await checkLease(tx,item);
  const p=await policyFor(tx,item.workspace_id),w=item.workspace_id;
  invariant(p.revision===item.input.policyRevision,'automation_revoked','Policy changed before this cycle ran.',409);
  const cycle=(await tx.query('SELECT * FROM intelligence_cycles WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,item.input.cycleId])).rows[0];
  invariant(cycle&&cycle.work_id===item.id,'cycle_changed','Cycle does not belong to this work item.',409);
  const receipt:Record<string,any>={selected:[],holds:[],runIds:[]};
  const c=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[w])).rows[0];
  if(p.value.cleanupEnabled&&(item.input.cleanupDue||cycle.kind==='manual'))receipt.cleanup=await compact(tx,w);
  if(p.value.autoScan){
   const recent=(await tx.query("SELECT 1 FROM discovery_runs r JOIN work_items x ON x.id=r.work_id AND x.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND (x.status IN ('queued','leased') OR r.created_at>now()-$2*interval '1 minute') LIMIT 1",[w,p.value.scanIntervalMinutes])).rowCount;
   if(!recent&&p.value.sourceIds.length){try{
    const eligible=(await tx.query('SELECT id FROM discovery_sources WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND enabled AND (next_retry_at IS NULL OR next_retry_at<=now())',[w,p.value.sourceIds])).rows.map(s=>s.id);
    const pool=p.value.sourceIds.filter((id:string)=>eligible.includes(id)),previous=Number((await tx.query('SELECT count(*) FROM intelligence_cycles WHERE workspace_id=$1 AND cardinality(run_ids)>0',[w])).rows[0].count);
    const batch=Math.min(p.value.sourcesPerCycle,p.value.maxMatches),offset=pool.length?previous*batch%pool.length:0,ids=[...pool.slice(offset),...pool.slice(0,offset)].slice(0,batch);
    invariant(ids.length,'source_cooldown','All selected sources are disabled or in cooldown.',409);
    const run=await queueDiscoverySearch(tx,{workspaceId:w},{sourceIds:ids,terms:p.value.terms,matchIn:'title'},{cycleId:cycle.id,policyRevision:p.revision,maxMatches:p.value.maxMatches});receipt.runIds.push(run.id);
   }catch(e){if(e instanceof DomainError)receipt.holds.push(e.code);else throw e;}}
   else receipt.holds.push(recent?'scan_interval_or_active_work':'select_public_sources');
  }
  if(p.value.autoScore&&c?.ownership==='canonical'){
   const screened=await screening(tx,w);receipt.held=screened.held;receipt.evidenceAvailable=screened.evidenceAvailable;
   const already=(await tx.query("SELECT 1 FROM evaluation_reservations WHERE workspace_id=$1 AND status IN ('reserved','sending') LIMIT 1",[w])).rowCount;
   if(already)receipt.holds.push('automatic_evaluation_pending');
   else for(const selected of screened.selected){
    const job=screened.jobs.find(j=>j.id===selected.id)!;
    try{
     await tx.query('SAVEPOINT automatic_candidate');
     const reservation=await reserveEvaluation(tx,w,cycle.id,p.revision,p.value);
     const e=await queueCareerOpsEvaluation(tx,{workspaceId:w},{jobId:job.id,expectedJobRevision:job.revision,expectedCandidateRevision:c.revision});
     await tx.query('UPDATE evaluation_reservations SET evaluation_id=$1 WHERE workspace_id=$2 AND id=$3',[e.id,w,reservation]);
     await tx.query("UPDATE work_items SET input=input||$1::jsonb,max_attempts=1 WHERE workspace_id=$2 AND id=$3",[JSON.stringify({autoReservationId:reservation}),w,e.workId]);receipt.selected.push({...selected,evaluationId:e.id});
     await tx.query('RELEASE SAVEPOINT automatic_candidate');
    }catch(e){if(e instanceof DomainError){
     await tx.query('ROLLBACK TO SAVEPOINT automatic_candidate');await tx.query('RELEASE SAVEPOINT automatic_candidate');receipt.holds.push(e.code);
     if(['evaluation_budget_exhausted','automation_not_authorized','candidate_authority_required','candidate_context_required','model_unconfigured','domain_unavailable','application_frozen','legacy_owner_active'].includes(e.code))break;
     await tx.query('INSERT INTO intelligence_job_holds(workspace_id,job_id,job_revision,candidate_revision,reason) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,job_id) DO UPDATE SET job_revision=EXCLUDED.job_revision,candidate_revision=EXCLUDED.candidate_revision,reason=EXCLUDED.reason,created_at=now()',[w,job.id,job.revision,c.revision,e.code]);
     continue;
    }throw e;}
   }
  }else receipt.holds.push(p.value.autoScore?'candidate_review_required':'automatic_scoring_disabled');
  receipt.budget=await budgetView(tx,w,p.value);
  await tx.query("UPDATE intelligence_cycles SET status='completed',run_ids=$1,receipt=receipt||$2::jsonb,completed_at=now() WHERE workspace_id=$3 AND id=$4",[receipt.runIds,JSON.stringify(receipt),w,cycle.id]);
  await event(tx,{workspaceId:w},cycle.id,'intelligence_cycle_planned',{selected:receipt.selected.length,holds:receipt.holds},p.revision);
  await finishWork(tx,item,{cycleId:cycle.id,...receipt});
 });
}
