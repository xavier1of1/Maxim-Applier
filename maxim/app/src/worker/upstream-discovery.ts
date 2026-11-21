import crypto from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {database,transaction} from '../server/db';
import {config} from '../server/config';
import {digest} from '../server/auth';
import {event} from '../server/commands';
import {DomainError,invariant} from '../server/errors';
import {secureGet} from '../server/discovery-network';
import {type Source,matchesRoleTerms} from '../server/discovery-providers';
import {capability,publicUrl,upstreamEntry,upstreamNormalize,upstreamRun,upstreamCommit,type UpstreamRow} from '../server/upstream-discovery';
import {finishWork,type WorkItem} from '../server/work';
import {queueApplicationProjection} from '../server/application-authority';
import {active,publishJob} from './discovery';

export async function discoverMarketJobs(item:WorkItem,parentSignal?:AbortSignal){
 const signal=AbortSignal.any([AbortSignal.timeout(85000),...(parentSignal?[parentSignal]:[])]),w=item.workspace_id;
 const query=await transaction(async tx=>{
  const run=await active(tx,item);
  await tx.query("UPDATE discovery_runs SET status='running',started_at=coalesce(started_at,now()) WHERE workspace_id=$1 AND id=$2",[w,run.id]);
  await tx.query("UPDATE discovery_requests SET status='interrupted',error_code='worker_interrupted',completed_at=now() WHERE workspace_id=$1 AND run_id=$2 AND status='running'",[w,run.id]);
  return (await tx.query('SELECT * FROM discovery_queries WHERE workspace_id=$1 AND id=$2',[w,run.query_id])).rows[0];
 });
 const counts={matched:0,created:0,identityConflicts:0,successfulSources:0,failedSources:0,partialSources:0,requests:0,bytes:0,returned:0,uninspected:0,missingDescriptions:0,uniqueEmployers:0,sourceCount:query.source_snapshots.length};
 const employers=new Set<string>();
 for(const source of query.source_snapshots as Source[]){
  if(signal.aborted)break;
  const attempt=await transaction(async tx=>{
   await active(tx,item,source);
   return (await tx.query("INSERT INTO discovery_attempts(id,workspace_id,run_id,source_id,run_revision,source_revision,status,started_at) VALUES($1,$2,$3,$4,$5,$6,'running',now()) ON CONFLICT(workspace_id,run_id,source_id,run_revision) DO UPDATE SET status='running',started_at=now() RETURNING id",[crypto.randomUUID(),w,item.input.runId,source.id,item.input.revision,source.revision])).rows[0].id;
  });
  let status='success',errorCode:string|null=null,partial=false,admitted=0,returned=0,cooldown=0,sourceRequests=0;
  const captured=new Date().toISOString(),coverage:Record<string,unknown>={engine:'careerops-1.40.0',commit:upstreamCommit,kind:capability(source.provider)?.kind};
  try{
   const live=(await database().query('SELECT next_retry_at FROM discovery_sources WHERE workspace_id=$1 AND id=$2',[w,source.id])).rows[0];
   invariant(!live?.next_retry_at||new Date(live.next_retry_at).getTime()<=Date.now(),'quota_exceeded','Source cooldown has not elapsed.',409);
   const hosts=[...new Set([...(capability(source.provider)?.hosts||[]),publicUrl(source.careers_url).hostname])];
   async function request(url:string,options:{method?:string;body?:string;headers?:Record<string,string>}={}){
    invariant(counts.requests<18&&sourceRequests<12&&counts.bytes<20*1024*1024,'request_budget','Public search resource cap reached. Remaining coverage is uninspected.');
    const parsed=publicUrl(url),method=options.method||'GET';
    invariant(method==='GET'||method==='POST'&&source.provider==='workday'&&parsed.hostname.endsWith('.myworkdayjobs.com')&&/^\/wday\/cxs\/[^/]+\/[^/]+\/jobs$/.test(parsed.pathname),'request_method_refused','Only public reads and the audited Workday search POST are allowed.');
    invariant(!options.body||typeof options.body==='string'&&Buffer.byteLength(options.body)<=16000,'request_body_refused','Public search body exceeds its bound.');
    const headers:Record<string,string>={};for(const [k,v] of Object.entries(options.headers||{}))if(['accept','accept-language','content-type'].includes(k.toLowerCase())&&typeof v==='string'&&v.length<200)headers[k]=v;
    const delay=await transaction(async tx=>{
     await active(tx,item,source);
     await tx.query('INSERT INTO discovery_host_pacing(host,next_at) VALUES($1,now()) ON CONFLICT DO NOTHING',[parsed.host]);
     const r=(await tx.query('SELECT next_at FROM discovery_host_pacing WHERE host=$1 FOR UPDATE',[parsed.host])).rows[0],due=Math.max(Date.now(),new Date(r.next_at).getTime());
     await tx.query('UPDATE discovery_host_pacing SET next_at=$1 WHERE host=$2',[new Date(due+1100),parsed.host]);return due-Date.now();
    });
    if(delay)await wait(delay,undefined,{signal});
    const fixture=config().testMode?config().discoveryFixtureOrigin:undefined,target=fixture?new URL(parsed.pathname+parsed.search,fixture).href:url,id=crypto.randomUUID();
    await transaction(async tx=>{await active(tx,item,source);await tx.query("INSERT INTO discovery_requests(id,workspace_id,run_id,source_id,attempt_id,request_url,status,fixture_transport,started_at) VALUES($1,$2,$3,$4,$5,$6,'running',$7,now())",[id,w,item.input.runId,source.id,attempt,url,Boolean(fixture)]);});
    counts.requests++;sourceRequests++;
    try{
     const r=await secureGet(target,{allowedHosts:hosts,fixtureOrigin:fixture,content:'public',method:method as 'GET'|'POST',body:options.body,headers,byteLimit:5*1024*1024,signal});counts.bytes+=r.bytes;
     await transaction(async tx=>{await active(tx,item,source);await tx.query("UPDATE discovery_requests SET status='success',http_status=$1,bytes=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4",[r.status,r.bytes,w,id]);});return r;
    }catch(e){
     const x=e as {code?:string;httpStatus?:number;retryAfterSeconds?:number};cooldown=Math.max(cooldown,x.retryAfterSeconds||(['auth_or_challenge','quota_exceeded'].includes(x.code||'')?86400:0));
     await database().query("UPDATE discovery_requests SET status='failed',error_code=$1,http_status=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4",[x.code||'transport_failed',x.httpStatus||null,w,id]);throw e;
    }
   }
   const result=await upstreamRun(source.provider,upstreamEntry(source,query.terms),signal,request);
   returned=result.returned;counts.returned+=returned;partial=Boolean(result.partial);coverage.truncation=result.partial;
   const jobs=result.jobs,ids=new Set<string>();
   const pageId=crypto.randomUUID();
   // Raw HTML/JSON feed bodies are not stored. Retain compact normalized provenance once.
   await transaction(async tx=>{await active(tx,item,source);await tx.query('INSERT INTO discovery_pages(id,workspace_id,run_id,source_id,attempt_id,source_revision,page_number,request_url,payload,content_hash,record_count,captured_at,complete) VALUES($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,$11,$12)',[pageId,w,item.input.runId,source.id,attempt,source.revision,source.careers_url,JSON.stringify({engine:upstreamCommit,returned,retained:jobs.length}),digest(JSON.stringify(jobs)),jobs.length,captured,!partial]);});
   const quota=query.filters.automation?.maxMatches??100;
   for(const row of jobs){
    if(signal.aborted)break;
    if(admitted>=quota){partial=true;counts.uninspected++;continue;}
    try{
     const job=upstreamNormalize(source,row as UpstreamRow);
     if(ids.has(job.externalId))continue;ids.add(job.externalId);
     if(!matchesRoleTerms(job,query.terms,query.filters.matchIn))continue;
     const summary=capability(source.provider)?.description!=='full_when_present'||job.description.length<50;
     job.raw.discoveryProvenance={provider:source.provider,publisherUrl:job.url,applicationUrl:job.applicationUrl,upstreamCommit,description:summary?'summary_or_missing':'provider_full'};
     const saved=await transaction(async tx=>{await active(tx,item,source);return publishJob(tx,item,source,{id:pageId,captured_at:captured},job,summary);});
     if(['capacity_hold','intake_limit'].includes(String(saved.eligibility))){partial=true;counts.uninspected++;continue;}
     if(saved.eligibility==='archived_compact')continue;
     admitted++;counts.matched++;if(saved.created)counts.created++;if(saved.identityConflict)counts.identityConflicts++;if(summary)counts.missingDescriptions++;employers.add(job.company);
    }catch(e){if(e instanceof DomainError&&['lease_lost','search_superseded','source_changed'].includes(e.code))throw e;coverage.invalidRecords=Number(coverage.invalidRecords||0)+1;partial=true;}
   }
   counts.uninspected+=Math.max(0,returned-jobs.length);
  }catch(e){
   if(e instanceof DomainError&&['lease_lost','search_superseded','source_changed'].includes(e.code))throw e;
   errorCode=(e as {code?:string}).code||'provider_failed';status=errorCode;counts.failedSources++;
  }
  if(!errorCode){counts.successfulSources++;if(!admitted)status='empty_success';}
  if(partial){status='partial';counts.partialSources++;}
  coverage.returned=returned;coverage.admitted=admitted;coverage.requests=sourceRequests;
  await transaction(async tx=>{
   await active(tx,item,source);
   await tx.query('UPDATE discovery_attempts SET status=$1,error_code=$2,fallback=$3,record_count=$4,page_count=$5,coverage=$6,completed_at=now() WHERE workspace_id=$7 AND id=$8',[status,errorCode,errorCode?'Review source configuration/access or retry after its cooldown. No challenge bypass is attempted.':partial?'Bounded search; records outside the inspected window are not a negative finding.':null,admitted,sourceRequests,JSON.stringify(coverage),w,attempt]);
   await tx.query("UPDATE discovery_sources SET status=$1,status_reason=$2,checked_at=now(),next_retry_at=CASE WHEN $3>0 THEN now()+$3*interval '1 second' ELSE null END WHERE workspace_id=$4 AND id=$5 AND revision=$6",[status,errorCode,cooldown,w,source.id,source.revision]);
  });
 }
 counts.uniqueEmployers=employers.size;
 await transaction(async tx=>{
  await active(tx,item);
  const missing=counts.successfulSources+counts.failedSources<counts.sourceCount,status=signal.aborted||missing||counts.partialSources?'partial':counts.failedSources?(counts.successfulSources?'partial':'failed'):'completed';
  await tx.query('UPDATE discovery_runs SET status=$1,counts=$2,error_code=$3,completed_at=now() WHERE workspace_id=$4 AND id=$5',[status,JSON.stringify(counts),signal.aborted?'deadline_exceeded':missing?'incomplete_coverage':null,w,item.input.runId]);
  await event(tx,{workspaceId:w},String(item.input.runId),'discovery_search_finished',{status,counts},Number(item.input.revision));
  await queueApplicationProjection(tx,w);await finishWork(tx,item,{runId:item.input.runId,status,counts});
  await tx.query("UPDATE discovery_policies SET next_score_at=least(next_score_at,now()) WHERE workspace_id=$1 AND value->>'autoScore'='true'",[w]);
 });
}
