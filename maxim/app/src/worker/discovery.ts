import crypto from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import type {PoolClient} from 'pg';
import {database,transaction} from '../server/db';
import {config} from '../server/config';
import {digest} from '../server/auth';
import {checkLease,finishWork,type WorkItem} from '../server/work';
import {event} from '../server/commands';
import {DomainError,invariant} from '../server/errors';
import {DiscoveryError,secureGet} from '../server/discovery-network';
import {feedUrl,pageRecords,normalizeProvider,providerHosts,supported,type Source,type NormalizedJob} from '../server/discovery-providers';
import {domain} from '../server/domain';
import {applicationWritable,queueApplicationProjection} from '../server/application-authority';

const fallback='Review this source in a visible browser, or retry explicitly after fixing its configuration/cooldown. No access-control workaround is available.';
async function active(tx:PoolClient,item:WorkItem,source?:Source){
 await applicationWritable(tx,item.workspace_id);
 await checkLease(tx,item);
 const run=(await tx.query('SELECT * FROM discovery_runs WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[item.workspace_id,item.input.runId])).rows[0];
 invariant(run&&run.revision===item.input.revision&&run.work_id===item.id&&['queued','running'].includes(run.status),'search_superseded','Search no longer authorizes this result.',409);
 if(source){
  const live=(await tx.query('SELECT revision,enabled FROM discovery_sources WHERE workspace_id=$1 AND id=$2 FOR SHARE',[item.workspace_id,source.id])).rows[0];
  invariant(live?.enabled&&live.revision===source.revision,'source_changed','Source changed; start a new search.',409);
 }
 return run;
}
async function publishJob(tx:PoolClient,item:WorkItem,source:Source,page:{id:string;captured_at:string},job:NormalizedJob){
 const w=item.workspace_id;
 await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[w+':opening:'+job.openingKey]);
 const existing=(await tx.query('SELECT * FROM jobs WHERE workspace_id=$1 AND opening_key=$2 FOR UPDATE',[w,job.openingKey])).rows[0];
 const id=existing?.id||crypto.randomUUID(),identityConflict=Boolean(existing&&(existing.title!==job.title||existing.company!==job.company));
 const age=job.postedAt?(Date.now()-Date.parse(job.postedAt))/3600000:null;
 const profile=(await tx.query('SELECT profile FROM workspace_policies WHERE workspace_id=$1',[w])).rows[0];
 const policy=profile?.profile==='xavier-v1'?domain({operation:'job_policy',job:{title:job.title,description:job.description,locations:job.locations,locationText:job.location,salary:job.salary,postedAgeHours:age}}):{ok:true,eligibility:'review',allowed:false,flags:[{flagType:'policy',severity:'review',reason:'No approved policy profile for this candidate.'}]};
 if(!existing){
  await tx.query('INSERT INTO jobs(id,workspace_id,company,title,location,url,description,opening_key,source_platform,application_url,posted_at,source_updated_at,first_seen_at,last_seen_at,discovery_policy) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14)',[id,w,job.company,job.title,job.location,job.url,job.description,job.openingKey,source.provider,job.applicationUrl,job.postedAt,job.updatedAt,page.captured_at,JSON.stringify(policy)]);
 }else if(!identityConflict){
  const changed=existing.description!==job.description||existing.location!==job.location||existing.url!==job.url;
  await tx.query('UPDATE jobs SET location=$1,url=$2,description=$3,application_url=$4,posted_at=$5,source_updated_at=$6,last_seen_at=$7,discovery_policy=$8,revision=revision+$9,updated_at=CASE WHEN $9=1 THEN now() ELSE updated_at END WHERE workspace_id=$10 AND id=$11',[job.location,job.url,job.description,job.applicationUrl,job.postedAt,job.updatedAt,page.captured_at,JSON.stringify(policy),changed?1:0,w,id]);
 }
 await tx.query('INSERT INTO job_source_aliases(id,workspace_id,job_id,source_id,external_id,original_url,application_url,platform) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(workspace_id,source_id,external_id) DO NOTHING',[crypto.randomUUID(),w,id,source.id,job.externalId,job.url,job.applicationUrl,source.provider]);
 const alias=(await tx.query('SELECT job_id FROM job_source_aliases WHERE workspace_id=$1 AND source_id=$2 AND external_id=$3',[w,source.id,job.externalId])).rows[0];
 invariant(alias.job_id===id,'source_identity_conflict','A provider reused an external ID for a different opening. Manual reconciliation is required.',409);
 await tx.query('INSERT INTO job_observations(id,workspace_id,job_id,source_id,run_id,page_id,external_id,raw_fields,content_hash,source_revision,observed_at,posted_at,date_basis,policy,identity_conflict) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) ON CONFLICT(workspace_id,run_id,source_id,external_id) DO NOTHING',[crypto.randomUUID(),w,id,source.id,item.input.runId,page.id,job.externalId,JSON.stringify(job.raw),digest(JSON.stringify(job.raw)),source.revision,page.captured_at,job.postedAt,job.dateBasis,JSON.stringify(policy),identityConflict]);
 return {created:!existing,identityConflict,eligibility:policy.eligibility};
}
export async function discoverJobs(item:WorkItem,parentSignal?:AbortSignal){
 const signal=AbortSignal.any([AbortSignal.timeout(90000),...(parentSignal?[parentSignal]:[])]);
 const initial=await transaction(async tx=>{
  const run=await active(tx,item);
  const query=(await tx.query('SELECT * FROM discovery_queries WHERE workspace_id=$1 AND id=$2',[item.workspace_id,run.query_id])).rows[0];
  await tx.query("UPDATE discovery_runs SET status='running',started_at=coalesce(started_at,now()) WHERE workspace_id=$1 AND id=$2",[item.workspace_id,run.id]);
  await tx.query("UPDATE discovery_requests r SET status='interrupted',error_code='worker_interrupted',completed_at=now() FROM discovery_attempts a WHERE r.attempt_id=a.id AND r.workspace_id=a.workspace_id AND r.workspace_id=$1 AND r.run_id=$2 AND a.run_revision=$3 AND r.status='running'",[item.workspace_id,run.id,item.input.revision]);
  return {run,query};
 });
 const sources=initial.query.source_snapshots as Source[],terms=initial.query.terms as string[];
 let requests=Number((await database().query('SELECT count(*) FROM discovery_requests r JOIN discovery_attempts a ON a.id=r.attempt_id AND a.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND r.run_id=$2 AND a.run_revision=$3',[item.workspace_id,item.input.runId,item.input.revision])).rows[0].count),matched=0,created=0,conflicts=0,successes=0,failures=0,partialSources=0;
 for(const source of sources){
  if(signal.aborted)break;
  const attemptId=await transaction(async tx=>{
   await active(tx,item,source);
   return (await tx.query("INSERT INTO discovery_attempts(id,workspace_id,run_id,source_id,run_revision,source_revision,status,started_at) VALUES($1,$2,$3,$4,$5,$6,'running',now()) ON CONFLICT(workspace_id,run_id,source_id,run_revision) DO UPDATE SET status='running' RETURNING id",[crypto.randomUUID(),item.workspace_id,item.input.runId,source.id,item.input.revision,source.revision])).rows[0].id as string;
  });
  const pages:{id:string;captured_at:string;records:Record<string,unknown>[]}[]=[];
  let partial=false,status='success',errorCode:string|null=null,cooldown=0;
  try{
   invariant(supported.includes(source.provider),'unsupported','This source is manual-only; no automated coverage is claimed.');
   const sourceLive=(await database().query('SELECT next_retry_at FROM discovery_sources WHERE workspace_id=$1 AND id=$2',[item.workspace_id,source.id])).rows[0];
   invariant(!sourceLive.next_retry_at||new Date(sourceLive.next_retry_at).getTime()<=Date.now(),'quota_exceeded','Source cooldown has not elapsed.',409);
   for(let pageNumber=0;pageNumber<3;pageNumber++){
    if(signal.aborted)throw new DiscoveryError('request_cancelled','Search reached its absolute deadline or was cancelled.');
    const url=feedUrl(source,pageNumber);
    const cached=(await database().query('SELECT * FROM discovery_pages WHERE workspace_id=$1 AND run_id=$2 AND source_id=$3 AND source_revision=$4 AND page_number=$5 AND complete=true AND captured_at>now()-interval \'15 minutes\' ORDER BY captured_at DESC LIMIT 1',[item.workspace_id,item.input.runId,source.id,source.revision,pageNumber])).rows[0];
    let value:unknown,receivedAt:string,cachedFrom:string|null=null;
    if(cached){value=cached.payload;receivedAt=new Date(cached.captured_at).toISOString();cachedFrom=cached.id;}
    else{
     invariant(++requests<=6,'request_budget','Search request budget reached; remaining coverage is partial.');
     const delayMs=await transaction(async tx=>{
      await active(tx,item,source);
      const host=new URL(url).host;
      await tx.query('INSERT INTO discovery_host_pacing(host,next_at) VALUES($1,now()) ON CONFLICT DO NOTHING',[host]);
      const pace=(await tx.query('SELECT next_at FROM discovery_host_pacing WHERE host=$1 FOR UPDATE',[host])).rows[0];
      const due=Math.max(Date.now(),new Date(pace.next_at).getTime());
      await tx.query('UPDATE discovery_host_pacing SET next_at=$1 WHERE host=$2',[new Date(due+1000),host]);return due-Date.now();
     });
     if(delayMs>0)await wait(delayMs,undefined,{signal});
     await transaction(tx=>active(tx,item,source));
     const c=config(),fixture=c.testMode?c.discoveryFixtureOrigin:undefined;
     const target=fixture?new URL(new URL(url).pathname+new URL(url).search,fixture).href:url;
     const started=new Date().toISOString(),requestId=crypto.randomUUID();let response;
     await transaction(async tx=>{await active(tx,item,source);await tx.query('INSERT INTO discovery_requests(id,workspace_id,run_id,source_id,attempt_id,request_url,status,fixture_transport,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[requestId,item.workspace_id,item.input.runId,source.id,attemptId,url,'running',Boolean(fixture),started]);});
     try{
      response=await secureGet(target,{allowedHosts:providerHosts,fixtureOrigin:fixture,signal});
      try{value=JSON.parse(response.text);}catch{throw new DiscoveryError('schema_drift','Feed returned invalid JSON.');}
      pageRecords(source.provider,value);receivedAt=response.receivedAt;
      await transaction(async tx=>{await active(tx,item,source);await tx.query("UPDATE discovery_requests SET status='success',http_status=$1,bytes=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4",[response!.status,response!.bytes,item.workspace_id,requestId]);});
     }catch(e){
      const code=e instanceof DomainError?e.code:'transport_failed';
      await transaction(async tx=>{await active(tx,item,source);await tx.query("UPDATE discovery_requests SET status='failed',http_status=$1,error_code=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4",[e instanceof DiscoveryError?e.httpStatus||null:null,code,item.workspace_id,requestId]);});
      throw e;
     }
    }
    const records=pageRecords(source.provider,value);
    const saved=await transaction(async tx=>{
     await active(tx,item,source);
     return (await tx.query('INSERT INTO discovery_pages(id,workspace_id,run_id,source_id,attempt_id,source_revision,page_number,request_url,payload,content_hash,record_count,captured_at,cached_from,complete) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true) ON CONFLICT(workspace_id,attempt_id,page_number) DO UPDATE SET complete=true RETURNING id,captured_at',[crypto.randomUUID(),item.workspace_id,item.input.runId,source.id,attemptId,source.revision,pageNumber,url,JSON.stringify(value),digest(JSON.stringify(value)),records.length,receivedAt!,cachedFrom])).rows[0];
    });
    pages.push({...saved,records});
    if(source.provider!=='lever'||records.length<100)break;
    if(pageNumber===2)partial=true;
   }
  }catch(e){
   if(e instanceof DomainError&&['lease_lost','search_superseded','source_changed'].includes(e.code))throw e;
   errorCode=e instanceof DomainError?e.code:'transport_failed';status=errorCode;
   cooldown=e instanceof DiscoveryError?e.retryAfterSeconds||0:0;
  }
  // Retain successfully checkpointed pages even when a later page fails.
  let count=0;
  if(pages.length){
   try{
    const normalized=await normalizeProvider(source,pages.map(p=>p.records));
    const identities=new Set<string>();
    for(const job of normalized.slice(0,2000)){
     if(signal.aborted)throw new DiscoveryError('request_cancelled','Search reached its absolute deadline.');
     invariant(!identities.has(job.externalId),'schema_drift','The feed repeated a job identity within one result.');identities.add(job.externalId);
     if(!terms.some(term=>(job.title+' '+job.description).toLowerCase().includes(term.toLowerCase())))continue;
     const page=pages.find(p=>p.records.includes(job.raw))!;
     const result=await transaction(async tx=>{await active(tx,item,source);return publishJob(tx,item,source,page,job);});
     matched++;count++;if(result.created)created++;if(result.identityConflict)conflicts++;
    }
    if(normalized.length>2000)partial=true;
   }catch(e){if(e instanceof DomainError&&['lease_lost','search_superseded','source_changed'].includes(e.code))throw e;errorCode=e instanceof DomainError?e.code:'schema_drift';status=errorCode;}
  }
  if(errorCode){failures++;if(pages.length)partial=true;}else{successes++;if(!count)status='empty_success';}
  if(partial){partialSources++;status='partial';}
  await transaction(async tx=>{
   await active(tx,item,source);
   await tx.query('UPDATE discovery_attempts SET status=$1,error_code=$2,fallback=$3,record_count=$4,page_count=$5,completed_at=now() WHERE workspace_id=$6 AND id=$7',[status,errorCode,status==='success'||status==='empty_success'?null:fallback,count,pages.length,item.workspace_id,attemptId]);
   await tx.query("UPDATE discovery_sources SET status=$1,status_reason=$2,checked_at=now(),next_retry_at=CASE WHEN $3>0 THEN now()+$3*interval '1 second' ELSE null END WHERE workspace_id=$4 AND id=$5 AND revision=$6",[status,errorCode,cooldown,item.workspace_id,source.id,source.revision]);
  });
 }
 await transaction(async tx=>{
  await active(tx,item);
  const stopped=signal.aborted,missing=successes+failures<sources.length;
  const status=stopped||partialSources||missing?'partial':failures?(successes?'partial':'failed'):'completed';
  const counts={matched,created,identityConflicts:conflicts,successfulSources:successes,failedSources:failures,partialSources,requests,sourceCount:sources.length};
  await tx.query('UPDATE discovery_runs SET status=$1,counts=$2,error_code=$3,completed_at=now() WHERE workspace_id=$4 AND id=$5',[status,JSON.stringify(counts),stopped?'deadline_exceeded':missing?'incomplete_coverage':null,item.workspace_id,item.input.runId]);
  await event(tx,{workspaceId:item.workspace_id},String(item.input.runId),'discovery_search_finished',{status,counts},Number(item.input.revision));
  await queueApplicationProjection(tx,item.workspace_id);
  await finishWork(tx,item,{runId:item.input.runId,status,counts});
 });
}
