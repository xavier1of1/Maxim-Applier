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
import {feedUrl,greenhousePostingUrl,matchesRoleTerms,pageRecords,normalizeProvider,providerHosts,supported,type Source,type NormalizedJob} from '../server/discovery-providers';
import {domain} from '../server/domain';
import {applicationWritable,queueApplicationProjection} from '../server/application-authority';
import {checkScanGrant} from '../server/intelligence-budget';
import {intelligenceLock,capacity} from '../server/intelligence-policy';

const fallback='Review this source in a visible browser, or retry explicitly after fixing its configuration/cooldown. No access-control workaround is available.';
type Posting={jobId:string;revision:number;externalId:string;openingKey:string};
async function currentPosting(tx:PoolClient,item:WorkItem,source:Source,posting:Posting){
 const row=(await tx.query('SELECT j.title,j.company FROM jobs j JOIN job_source_aliases a ON a.workspace_id=j.workspace_id AND a.job_id=j.id WHERE j.workspace_id=$1 AND j.id=$2 AND j.revision=$3 AND j.opening_key=$4 AND NOT j.archived AND a.source_id=$5 AND a.external_id=$6 FOR UPDATE OF j',[item.workspace_id,posting.jobId,posting.revision,posting.openingKey,source.id,posting.externalId])).rows[0];
 invariant(row,'posting_changed','The stored role or source identity changed. Review it before requesting details again.',409);
 return row;
}
async function active(tx:PoolClient,item:WorkItem,source?:Source){
 await applicationWritable(tx,item.workspace_id);
 await checkLease(tx,item);
 const run=(await tx.query('SELECT * FROM discovery_runs WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[item.workspace_id,item.input.runId])).rows[0];
 invariant(run&&run.revision===item.input.revision&&run.work_id===item.id&&['queued','running'].includes(run.status),'search_superseded','Search no longer authorizes this result.',409);
 const grant=(await tx.query('SELECT filters->\'automation\' AS grant FROM discovery_queries WHERE workspace_id=$1 AND id=$2',[item.workspace_id,run.query_id])).rows[0]?.grant;
 await checkScanGrant(tx,item.workspace_id,grant);
 if(source){
  const live=(await tx.query('SELECT revision,enabled FROM discovery_sources WHERE workspace_id=$1 AND id=$2 FOR SHARE',[item.workspace_id,source.id])).rows[0];
  invariant(live?.enabled&&live.revision===source.revision,'source_changed','Source changed; start a new search.',409);
 }
 return run;
}
async function publishJob(tx:PoolClient,item:WorkItem,source:Source,page:{id:string;captured_at:string},job:NormalizedJob,summaryOnly:boolean){
 const w=item.workspace_id;
 await intelligenceLock(tx,w);
 await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[w+':opening:'+job.openingKey]);
 const existing=(await tx.query('SELECT * FROM jobs WHERE workspace_id=$1 AND opening_key=$2 FOR UPDATE',[w,job.openingKey])).rows[0];
 if(existing?.compacted_at){await tx.query('UPDATE jobs SET last_seen_at=$1 WHERE workspace_id=$2 AND id=$3',[page.captured_at,w,existing.id]);await tx.query('UPDATE job_archive SET last_seen_at=$1 WHERE workspace_id=$2 AND job_id=$3',[page.captured_at,w,existing.id]);return {created:false,identityConflict:false,eligibility:'archived_compact'};}
 if(!existing&&!(await capacity(tx,w)).available)return {created:false,identityConflict:false,eligibility:'capacity_hold'};
 const id=existing?.id||crypto.randomUUID(),identityConflict=Boolean(existing&&(existing.title!==job.title||existing.company!==job.company));
 const age=job.postedAt?(Date.now()-Date.parse(job.postedAt))/3600000:null;
 const profile=(await tx.query('SELECT profile FROM workspace_policies WHERE workspace_id=$1',[w])).rows[0];
 const evaluated=profile?.profile==='xavier-v1'?domain({operation:'job_policy',job:{title:job.title,description:job.description,locations:job.locations,locationText:job.location,salary:job.salary,postedAgeHours:age}}):{ok:true,eligibility:'review',allowed:false,flags:[{flagType:'policy',severity:'review',reason:'No approved policy profile for this candidate.'}]};
 const policy={...evaluated,detailStatus:summaryOnly?'summary':'full',eligibility:summaryOnly&&evaluated.eligibility==='eligible'?'review':evaluated.eligibility};
 if(!existing){
  await tx.query('INSERT INTO jobs(id,workspace_id,company,title,location,url,description,opening_key,source_platform,application_url,posted_at,source_updated_at,first_seen_at,last_seen_at,discovery_policy,role_lane,industry,industry_provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13,$14,$15,$16,$17)',[id,w,job.company,job.title,job.location,job.url,job.description,job.openingKey,source.provider,job.applicationUrl,job.postedAt,job.updatedAt,page.captured_at,JSON.stringify(policy),domain({operation:'job_metadata',title:job.title}).lane,(source as Source&{industry?:string}).industry||null,(source as Source&{industry?:string}).industry?'Owner-confirmed source industry':null]);
 }else if(!identityConflict&&summaryOnly&&existing.description.trim().length>=50&&(!job.updatedAt||job.updatedAt===existing.source_updated_at?.toISOString())){
  await tx.query('UPDATE jobs SET last_seen_at=$1 WHERE workspace_id=$2 AND id=$3',[page.captured_at,w,id]);
 }else if(!identityConflict){
  const changed=existing.description!==job.description||existing.location!==job.location||existing.url!==job.url||existing.application_url!==job.applicationUrl;
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
 const posting=initial.query.filters.posting as Posting|undefined;
 const maxRequests=posting?1:6;
 let requests=Number((await database().query('SELECT count(*) FROM discovery_requests r JOIN discovery_attempts a ON a.id=r.attempt_id AND a.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND r.run_id=$2 AND a.run_revision=$3',[item.workspace_id,item.input.runId,item.input.revision])).rows[0].count),matched=0,created=0,conflicts=0,successes=0,failures=0,partialSources=0;
 for(const source of sources){
  if(signal.aborted)break;
  const attemptId=await transaction(async tx=>{
   await active(tx,item,source);
   return (await tx.query("INSERT INTO discovery_attempts(id,workspace_id,run_id,source_id,run_revision,source_revision,status,started_at) VALUES($1,$2,$3,$4,$5,$6,'running',now()) ON CONFLICT(workspace_id,run_id,source_id,run_revision) DO UPDATE SET status='running' RETURNING id",[crypto.randomUUID(),item.workspace_id,item.input.runId,source.id,item.input.revision,source.revision])).rows[0].id as string;
  });
  const pages:{id:string;captured_at:string;records:Record<string,unknown>[];summaryOnly:boolean}[]=[];
  let partial=false,status='success',errorCode:string|null=null,cooldown=0;
  try{
   invariant(supported.includes(source.provider),'unsupported','This source is manual-only; no automated coverage is claimed.');
   const sourceLive=(await database().query('SELECT next_retry_at FROM discovery_sources WHERE workspace_id=$1 AND id=$2',[item.workspace_id,source.id])).rows[0];
   invariant(!sourceLive.next_retry_at||new Date(sourceLive.next_retry_at).getTime()<=Date.now(),'quota_exceeded','Source cooldown has not elapsed.',409);
   async function fetchPage(url:string){
     invariant(requests<maxRequests,'request_budget','Search request budget reached; remaining coverage is partial.');
     const delayMs=await transaction(async tx=>{
      await active(tx,item,source);
      const host=new URL(url).host;
      await tx.query('INSERT INTO discovery_host_pacing(host,next_at) VALUES($1,now()) ON CONFLICT DO NOTHING',[host]);
      const pace=(await tx.query('SELECT next_at FROM discovery_host_pacing WHERE host=$1 FOR UPDATE',[host])).rows[0];
      const due=Math.max(Date.now(),new Date(pace.next_at).getTime());
      await tx.query('UPDATE discovery_host_pacing SET next_at=$1 WHERE host=$2',[new Date(due+1000),host]);return due-Date.now();
     });
     if(delayMs>0)await wait(delayMs,undefined,{signal});
     const c=config(),fixture=c.testMode?c.discoveryFixtureOrigin:undefined;
     const target=fixture?new URL(new URL(url).pathname+new URL(url).search,fixture).href:url;
     const started=new Date().toISOString(),requestId=crypto.randomUUID();let response;
     await transaction(async tx=>{await active(tx,item,source);if(posting)await currentPosting(tx,item,source,posting);await tx.query('INSERT INTO discovery_requests(id,workspace_id,run_id,source_id,attempt_id,request_url,status,fixture_transport,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[requestId,item.workspace_id,item.input.runId,source.id,attemptId,url,'running',Boolean(fixture),started]);});
     requests++;
     try{
      response=await secureGet(target,{allowedHosts:providerHosts,fixtureOrigin:fixture,signal});
      let value:unknown;
      try{value=JSON.parse(response.text);}catch{throw new DiscoveryError('schema_drift','Feed returned invalid JSON.');}
      if(posting)value={jobs:[value]};
      pageRecords(source.provider,value);
      await transaction(async tx=>{await active(tx,item,source);await tx.query("UPDATE discovery_requests SET status='success',http_status=$1,bytes=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4",[response!.status,response!.bytes,item.workspace_id,requestId]);});
      return {value,receivedAt:response.receivedAt};
     }catch(e){
      const code=e instanceof DomainError?e.code:'transport_failed';
      await transaction(async tx=>{await active(tx,item,source);await tx.query("UPDATE discovery_requests SET status='failed',http_status=$1,error_code=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4",[e instanceof DiscoveryError?e.httpStatus||null:null,code,item.workspace_id,requestId]);});
      throw e;
     }
   }
   for(let pageNumber=0;pageNumber<(posting?1:3);pageNumber++){
    if(signal.aborted)throw new DiscoveryError('request_cancelled','Search reached its absolute deadline or was cancelled.');
    let url=posting?greenhousePostingUrl(source,posting.externalId):feedUrl(source,pageNumber);
    const cached=(await database().query('SELECT * FROM discovery_pages WHERE workspace_id=$1 AND run_id=$2 AND source_id=$3 AND source_revision=$4 AND page_number=$5 AND complete=true AND captured_at>now()-interval \'15 minutes\' ORDER BY captured_at DESC LIMIT 1',[item.workspace_id,item.input.runId,source.id,source.revision,pageNumber])).rows[0];
    let value:unknown,receivedAt:string,cachedFrom:string|null=null;
    if(cached){value=cached.payload;receivedAt=new Date(cached.captured_at).toISOString();cachedFrom=cached.id;url=cached.request_url;}
    else{
     try{({value,receivedAt}=await fetchPage(url));}
     catch(e){
      if(posting||source.provider!=='greenhouse'||!(e instanceof DiscoveryError)||e.code!=='response_too_large'||requests>=maxRequests)throw e;
      url=feedUrl(source,pageNumber,true);
      ({value,receivedAt}=await fetchPage(url));
     }
    }
    const summaryOnly=!posting&&source.provider==='greenhouse'&&url===feedUrl(source,pageNumber,true);
    if(summaryOnly){partial=true;errorCode='expanded_feed_too_large';}
    let records=pageRecords(source.provider,value);const providerCount=records.length;
    const automation=initial.query.filters.automation;
    if(automation){
     const index=sources.indexOf(source),quota=Math.floor(automation.maxMatches/sources.length)+(index<automation.maxMatches%sources.length?1:0);
     const shift=records.length?Math.floor(Date.now()/3600000)*Math.max(1,quota)%records.length:0;
     const rotated=[...records.slice(shift),...records.slice(0,shift)],kept:Record<string,unknown>[]=[];let cacheBytes=100;
     for(const row of rotated){
      if(kept.length>=quota)break;
      if(!matchesRoleTerms({title:String(row.title||row.text||''),description:''},terms,'title'))continue;
      const bytes=Buffer.byteLength(JSON.stringify(row));if(cacheBytes+bytes>512000)continue;
      kept.push(row);cacheBytes+=bytes;
     }
     records=kept;value=source.provider==='lever'?kept:{jobs:kept};
     if(records.length<providerCount){partial=true;errorCode=errorCode||'bounded_intake';}
    }
    const saved=await transaction(async tx=>{
     await active(tx,item,source);
     return (await tx.query('INSERT INTO discovery_pages(id,workspace_id,run_id,source_id,attempt_id,source_revision,page_number,request_url,payload,content_hash,record_count,captured_at,cached_from,complete) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,true) ON CONFLICT(workspace_id,attempt_id,page_number) DO UPDATE SET complete=true RETURNING id,captured_at',[crypto.randomUUID(),item.workspace_id,item.input.runId,source.id,attemptId,source.revision,pageNumber,url,JSON.stringify(value),digest(JSON.stringify(value)),records.length,receivedAt!,cachedFrom])).rows[0];
    });
    pages.push({...saved,records,summaryOnly});
    if(source.provider!=='lever'||providerCount<100)break;
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
    if(posting)invariant(normalized.length===1&&normalized[0].externalId===posting.externalId&&normalized[0].openingKey===posting.openingKey&&normalized[0].description.trim().length>=50,'posting_details_unavailable','The provider did not return the saved opening with a full description.',409);
    const identities=new Set<string>();
    for(const job of normalized.slice(0,2000)){
     if(signal.aborted)throw new DiscoveryError('request_cancelled','Search reached its absolute deadline.');
     invariant(!identities.has(job.externalId),'schema_drift','The feed repeated a job identity within one result.');identities.add(job.externalId);
     if(!posting&&!matchesRoleTerms(job,terms,initial.query.filters.matchIn))continue;
     const page=pages.find(p=>p.records.includes(job.raw))!;
     const result=await transaction(async tx=>{
      await active(tx,item,source);
      const automation=initial.query.filters.automation;
      if(automation){const index=sources.indexOf(source),quota=Math.floor(automation.maxMatches/sources.length)+(index<automation.maxMatches%sources.length?1:0);
       const done=(await tx.query('SELECT count(*)::int AS n FROM job_observations WHERE workspace_id=$1 AND run_id=$2 AND source_id=$3',[item.workspace_id,item.input.runId,source.id])).rows[0].n;
       if(done>=quota)return {created:false,identityConflict:false,eligibility:'intake_limit'};
      }
      if(posting){const current=await currentPosting(tx,item,source,posting);invariant(current.title===job.title&&current.company===job.company,'posting_changed','The provider returned a changed opening. Review it manually.',409);}
      return publishJob(tx,item,source,page,job,page.summaryOnly);
     });
     if(['capacity_hold','intake_limit','archived_compact'].includes(String(result.eligibility))){partial=true;continue;}
     matched++;count++;if(result.created)created++;if(result.identityConflict)conflicts++;
    }
    if(normalized.length>2000)partial=true;
   }catch(e){if(e instanceof DomainError&&['lease_lost','search_superseded','source_changed'].includes(e.code))throw e;errorCode=e instanceof DomainError?e.code:'schema_drift';status=errorCode;}
  }
  if(errorCode&&!['expanded_feed_too_large','bounded_intake'].includes(errorCode)){failures++;if(pages.length)partial=true;}else{successes++;if(!count)status='empty_success';}
  if(partial){partialSources++;status='partial';}
  await transaction(async tx=>{
   await active(tx,item,source);
   const next=errorCode==='expanded_feed_too_large'?'Compact board only. Open an exact role in Jobs to fetch its full posting.':status==='success'||status==='empty_success'?null:fallback;
   await tx.query('UPDATE discovery_attempts SET status=$1,error_code=$2,fallback=$3,record_count=$4,page_count=$5,completed_at=now() WHERE workspace_id=$6 AND id=$7',[status,errorCode,next,count,pages.length,item.workspace_id,attemptId]);
   if(!posting)await tx.query("UPDATE discovery_sources SET status=$1,status_reason=$2,checked_at=now(),next_retry_at=CASE WHEN $3>0 THEN now()+$3*interval '1 second' ELSE null END WHERE workspace_id=$4 AND id=$5 AND revision=$6",[status,errorCode,cooldown,item.workspace_id,source.id,source.revision]);
   else if(cooldown>0)await tx.query("UPDATE discovery_sources SET next_retry_at=greatest(next_retry_at,now()+$1*interval '1 second') WHERE workspace_id=$2 AND id=$3 AND revision=$4",[cooldown,item.workspace_id,source.id,source.revision]);
  });
 }
 await transaction(async tx=>{
  await active(tx,item);
  const stopped=signal.aborted,missing=successes+failures<sources.length;
  const status=stopped||partialSources||missing?'partial':failures?(successes?'partial':'failed'):'completed';
  const counts={matched,created,identityConflicts:conflicts,successfulSources:successes,failedSources:failures,partialSources,requests,sourceCount:sources.length};
  const detailError=posting&&status!=='completed'?(await tx.query('SELECT error_code FROM discovery_attempts WHERE workspace_id=$1 AND run_id=$2 AND run_revision=$3 LIMIT 1',[item.workspace_id,item.input.runId,item.input.revision])).rows[0]?.error_code:null;
  await tx.query('UPDATE discovery_runs SET status=$1,counts=$2,error_code=$3,completed_at=now() WHERE workspace_id=$4 AND id=$5',[status,JSON.stringify(counts),stopped?'deadline_exceeded':missing?'incomplete_coverage':detailError||null,item.workspace_id,item.input.runId]);
  await event(tx,{workspaceId:item.workspace_id},String(item.input.runId),'discovery_search_finished',{status,counts},Number(item.input.revision));
  await queueApplicationProjection(tx,item.workspace_id);
  await finishWork(tx,item,{runId:item.input.runId,status,counts});
  if(!posting)await tx.query("UPDATE discovery_policies SET next_score_at=least(next_score_at,now()) WHERE workspace_id=$1 AND value->>'autoScore'='true'",[item.workspace_id]);
 });
}
