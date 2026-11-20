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

export async function screening(tx:PoolClient,w:string){
 const p=await policyFor(tx,w),engine=await engineSnapshot();
 const facts=(await tx.query("SELECT f.field_key,f.value FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND f.sensitivity='standard' AND s.model_consent AND s.deleted_at IS NULL AND s.revision=f.source_revision AND s.classification<>'restricted'",[w])).rows;
 const evidenceTerms=[...new Set<string>(facts.filter(f=>f.field_key.startsWith('skills.')).flatMap(f=>(Array.isArray(f.value)?f.value:[f.value]).filter((v:unknown):v is string=>typeof v==='string').flatMap((v:string)=>v.split(/[,;\n|]+/)).map((v:string)=>v.trim()).filter((v:string)=>v.length>=3&&v.length<=60)))].slice(0,80);
 const targetTerms=p.value.terms.length?p.value.terms:facts.filter(f=>f.field_key==='preferences.roles').flatMap(f=>Array.isArray(f.value)?f.value:[]).slice(0,10);
 const jobs=(await tx.query(`SELECT j.id,j.company,j.title,left(j.description,1800) AS description,j.revision,j.posted_at,j.discovery_policy,
 fit.id AS evaluation_id,fit.current,fit.status AS evaluation_status,EXTRACT(EPOCH FROM now()-j.posted_at)/3600 AS age_hours
 FROM jobs j ${jobFitJoin} WHERE j.workspace_id=$1 AND ${activeLead} ORDER BY j.posted_at DESC NULLS LAST,j.first_seen_at DESC NULLS LAST,j.id LIMIT 200`,[w,engine.hash])).rows;
 const result=domain({operation:'screen_jobs',policy:p.value,evidenceTerms,targetTerms,jobs:jobs.map(j=>({...j,ageHours:j.age_hours===null?null:Number(j.age_hours),blocked:!j.discovery_policy?.flags?.some((f:{flagType:string;severity:string})=>f.flagType==='location'&&f.severity==='positive')||j.discovery_policy?.flags?.some((f:{severity:string})=>f.severity==='blocker'),hasEvaluation:Boolean(j.evaluation_id&&(j.current||['queued','running','failed','cancelled','review_required'].includes(j.evaluation_status))),priority:j.discovery_policy?.flags?.some((f:{flagType:string})=>f.flagType==='connection_overlay')}))});
 return {policy:p,selected:result.selected as {id:string;reasons:unknown;evidenceTerms:string[]}[],held:result.held as {id:string;reason:string}[],jobs,targetTerms,evidenceAvailable:evidenceTerms.length>0,kind:result.kind};
}
export async function enqueueCycle(tx:PoolClient,w:string,kind='manual'){
 await intelligenceLock(tx,w);const p=await policyFor(tx,w);
 invariant(p.active,'intelligence_setup_required','Save discovery limits before running a cycle.',409);
 const prior=(await tx.query("SELECT c.id FROM intelligence_cycles c JOIN work_items x ON x.id=c.work_id AND x.workspace_id=c.workspace_id WHERE c.workspace_id=$1 AND x.status IN ('queued','leased') LIMIT 1",[w])).rows[0];if(prior)return prior;
 const id=crypto.randomUUID(),work=await enqueue(tx,w,'intelligence_cycle',id,{cycleId:id,policyRevision:p.revision});
 await tx.query('INSERT INTO intelligence_cycles(id,workspace_id,policy_revision,kind,work_id,receipt) VALUES($1,$2,$3,$4,$5,$6)',[id,w,p.revision,kind,work.id,JSON.stringify({policy:p.value})]);
 return {id,status:'queued'};
}
export async function tickIntelligence(){
 await transaction(async tx=>{
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
  if(p.value.cleanupEnabled)receipt.cleanup=await compact(tx,w);
  if(p.value.autoScan){
   const recent=(await tx.query("SELECT 1 FROM discovery_runs r JOIN work_items x ON x.id=r.work_id AND x.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND (x.status IN ('queued','leased') OR r.created_at>now()-$2*interval '1 minute') LIMIT 1",[w,p.value.scanIntervalMinutes])).rowCount;
   if(!recent&&p.value.sourceIds.length){try{const run=await queueDiscoverySearch(tx,{workspaceId:w},{sourceIds:p.value.sourceIds,terms:p.value.terms,matchIn:'title'},{cycleId:cycle.id,policyRevision:p.revision,maxMatches:p.value.maxMatches});receipt.runIds.push(run.id);}catch(e){if(e instanceof DomainError)receipt.holds.push(e.code);else throw e;}}
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
    }catch(e){if(e instanceof DomainError){await tx.query('ROLLBACK TO SAVEPOINT automatic_candidate');receipt.holds.push(e.code);break;}throw e;}
   }
  }else receipt.holds.push(p.value.autoScore?'candidate_review_required':'automatic_scoring_disabled');
  receipt.budget=await budgetView(tx,w,p.value);
  await tx.query("UPDATE intelligence_cycles SET status='completed',run_ids=$1,receipt=receipt||$2::jsonb,completed_at=now() WHERE workspace_id=$3 AND id=$4",[receipt.runIds,JSON.stringify(receipt),w,cycle.id]);
  await event(tx,{workspaceId:w},cycle.id,'intelligence_cycle_planned',{selected:receipt.selected.length,holds:receipt.holds},p.revision);
  await finishWork(tx,item,{cycleId:cycle.id,...receipt});
 });
}
