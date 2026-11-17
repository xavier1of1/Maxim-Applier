import crypto from 'node:crypto';
import {z} from 'zod';
import {database,transaction} from './db';
import {command,event,jobFor,uuid} from './commands';
import {type Context,reauthorize,digest} from './auth';
import {invariant,notFound} from './errors';
import {enqueue} from './work';
import {sourceDefinition,supported} from './discovery-providers';
import {applicationWritable} from './application-authority';

const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('add_source'),payload:z.object({name:z.string().trim().min(1).max(180),provider:z.enum(['greenhouse','lever','ashby','manual']),board:z.string().max(100).default(''),careersUrl:z.string().url().max(2048).optional()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_source_enabled'),payload:z.object({sourceId:uuid,expectedRevision:z.number().int().positive(),enabled:z.boolean()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('start_search'),payload:z.object({sourceIds:z.array(uuid).min(1).max(3),terms:z.array(z.string().trim().min(2).max(120)).max(10).default([])}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['cancel_search','retry_search']),payload:z.object({runId:uuid,expectedRevision:z.number().int().positive()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_discovery_state'),payload:z.object({jobId:uuid,expectedRevision:z.number().int().positive(),state:z.enum(['none','saved','dismissed'])}).strict()}).strict(),
]);
export async function discoveryCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  const w=ctx.workspaceId;
  if(['start_search','retry_search','set_discovery_state'].includes(c.action))await applicationWritable(tx,w);
  if(c.action==='add_source'){
   const p=c.payload,d=sourceDefinition(p.provider,p.board,p.careersUrl),id=crypto.randomUUID(),hash=digest(JSON.stringify(d));
   const prior=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 AND identity_hash=$2',[w,hash])).rows[0];
   if(prior)return prior;
   const row=(await tx.query('INSERT INTO discovery_sources(id,workspace_id,name,provider,board,careers_url,identity_hash) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[id,w,p.name,d.provider,d.board,d.careers_url,hash])).rows[0];
   await event(tx,ctx,id,'discovery_source_added',{provider:d.provider,automated:supported.includes(d.provider)},1);return row;
  }
  if(c.action==='set_source_enabled'){
   const p=c.payload,row=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.sourceId])).rows[0];
   if(!row)throw notFound();invariant(row.revision===p.expectedRevision,'revision_conflict','Source changed; refresh before editing.',409);
   return (await tx.query('UPDATE discovery_sources SET enabled=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING *',[p.enabled,w,p.sourceId])).rows[0];
  }
  if(c.action==='set_discovery_state'){
   const p=c.payload,j=await jobFor(tx,ctx,p.jobId);invariant(j.revision===p.expectedRevision,'revision_conflict','Role changed; refresh before saving.',409);
   await tx.query('INSERT INTO job_discovery_states(workspace_id,job_id,state) VALUES($1,$2,$3) ON CONFLICT(workspace_id,job_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()',[w,j.id,p.state]);
   await tx.query('UPDATE jobs SET archived=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3',[p.state==='dismissed',w,j.id]);
   await event(tx,ctx,j.id,'discovery_state_changed',{state:p.state},j.revision+1);return {id:j.id,state:p.state,revision:j.revision+1};
  }
  if(c.action==='start_search'){
   const ids=[...new Set(c.payload.sourceIds)],sources=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE',[w,ids])).rows;
   invariant(sources.length===ids.length,'not_found','Source not found.',404);
   invariant(sources.every(s=>s.enabled),'source_disabled','Enable the selected source before starting.',409);
   invariant(sources.every(s=>!s.next_retry_at||new Date(s.next_retry_at).getTime()<=Date.now()),'source_cooldown','A selected source is still in its recorded cooldown.',409);
   const candidate=(await tx.query('SELECT id,revision FROM candidates WHERE workspace_id=$1',[w])).rows[0];
   const prefs=(await tx.query("SELECT f.id,f.revision,f.value FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.field_key='preferences.roles' AND f.status='current' AND s.deleted_at IS NULL AND s.revision=f.source_revision",[w])).rows;
   const terms=c.payload.terms.length?c.payload.terms:prefs.flatMap(f=>Array.isArray(f.value)?f.value:[]).filter((v:unknown)=>typeof v==='string').slice(0,10);
   invariant(terms.length,'query_required','Enter role terms or approve preferences.roles in Candidate first.');
   const queryId=crypto.randomUUID(),runId=crypto.randomUUID(),filters={policy:'xavier-nova-dc-v1',maxSources:3,maxPagesPerSource:3,maxRequests:6,maxSeconds:90};
   await tx.query('INSERT INTO discovery_queries(id,workspace_id,terms,filters,source_snapshots,candidate_revision,preference_provenance) VALUES($1,$2,$3,$4,$5,$6,$7)',[queryId,w,terms,JSON.stringify(filters),JSON.stringify(sources),candidate.revision,JSON.stringify(c.payload.terms.length?[]:prefs.map(f=>({id:f.id,revision:f.revision})))]);
   const work=await enqueue(tx,w,'discover_jobs',runId+':1',{runId,revision:1});
   const row=(await tx.query('INSERT INTO discovery_runs(id,workspace_id,query_id,work_id) VALUES($1,$2,$3,$4) RETURNING *',[runId,w,queryId,work.id])).rows[0];
   await event(tx,ctx,runId,'discovery_search_queued',{queryId,terms,sourceIds:ids},1);return row;
  }
  const p=c.payload,row=(await tx.query('SELECT * FROM discovery_runs WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.runId])).rows[0];
  if(!row)throw notFound();invariant(row.revision===p.expectedRevision,'revision_conflict','Search changed; refresh before acting.',409);
  if(c.action==='cancel_search'){
   invariant(['queued','running'].includes(row.status),'search_finished','This search is no longer active.',409);
   await tx.query("UPDATE work_items SET status='cancelled',lease_token=null,lease_until=null,updated_at=now() WHERE workspace_id=$1 AND id=$2 AND status IN ('queued','leased')",[w,row.work_id]);
   await tx.query("UPDATE discovery_attempts SET status='cancelled',completed_at=now(),fallback='Retry explicitly to resume eligible pages.' WHERE workspace_id=$1 AND run_id=$2 AND status IN ('pending','running')",[w,row.id]);
   await tx.query("UPDATE discovery_runs SET status='cancelled',completed_at=now() WHERE workspace_id=$1 AND id=$2",[w,row.id]);
   await tx.query("UPDATE discovery_requests SET status='cancelled',error_code='cancelled',completed_at=now() WHERE workspace_id=$1 AND run_id=$2 AND status='running'",[w,row.id]);
   await event(tx,ctx,row.id,'discovery_search_cancelled',{},row.revision);return {...row,status:'cancelled'};
  }
  const workState=(await tx.query('SELECT status FROM work_items WHERE workspace_id=$1 AND id=$2',[w,row.work_id])).rows[0];
  invariant(['partial','failed','cancelled'].includes(row.status)||workState?.status==='failed','search_not_retryable','Only interrupted, partial, cancelled or failed searches can retry.',409);
  const q=(await tx.query('SELECT source_snapshots FROM discovery_queries WHERE workspace_id=$1 AND id=$2',[w,row.query_id])).rows[0];
  const sources=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 AND id=ANY($2::uuid[])',[w,q.source_snapshots.map((s:{id:string})=>s.id)])).rows;
  invariant(sources.every(s=>s.enabled&&(!s.next_retry_at||new Date(s.next_retry_at).getTime()<=Date.now())),'source_cooldown','Retry requires enabled sources outside their recorded cooldown.',409);
  invariant(sources.every(s=>q.source_snapshots.some((old:{id:string;revision:number})=>old.id===s.id&&old.revision===s.revision)),'source_changed','Source revisions changed; start a new search.',409);
  const revision=row.revision+1,work=await enqueue(tx,w,'discover_jobs',row.id+':'+revision,{runId:row.id,revision});
  await tx.query("UPDATE discovery_runs SET status='queued',revision=$1,work_id=$2,error_code=null,completed_at=null WHERE workspace_id=$3 AND id=$4",[revision,work.id,w,row.id]);
  await event(tx,ctx,row.id,'discovery_search_retried',{},revision);return {...row,revision,status:'queued',work_id:work.id};
 });
}
export async function discoveryView(ctx:Context){
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await reauthorize(tx,ctx);
  const w=ctx.workspaceId;
  const sources=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 ORDER BY name,id LIMIT 201',[w])).rows;
  const runs=(await tx.query("SELECT r.*,q.terms,q.filters,q.source_snapshots,q.candidate_revision,q.preference_provenance,w.status AS work_status,w.error_code AS work_error FROM discovery_runs r JOIN discovery_queries q ON q.id=r.query_id AND q.workspace_id=r.workspace_id LEFT JOIN work_items w ON w.id=r.work_id AND w.workspace_id=r.workspace_id WHERE r.workspace_id=$1 ORDER BY r.created_at DESC LIMIT 51",[w])).rows;
  const attempts=(await tx.query('SELECT a.* FROM discovery_attempts a WHERE a.workspace_id=$1 AND a.run_id=ANY($2::uuid[]) ORDER BY a.started_at DESC',[w,runs.slice(0,50).map(r=>r.id)])).rows;
  const jobs=(await tx.query("SELECT j.*,coalesce(s.state,'none') AS discovery_state FROM jobs j LEFT JOIN job_discovery_states s ON s.job_id=j.id AND s.workspace_id=j.workspace_id WHERE j.workspace_id=$1 AND j.opening_key IS NOT NULL ORDER BY j.last_seen_at DESC,j.id LIMIT 501",[w])).rows;
  const observations=(await tx.query('SELECT job_id,run_id,source_id,identity_conflict,observed_at,date_basis FROM job_observations WHERE workspace_id=$1 AND run_id=ANY($2::uuid[]) ORDER BY observed_at DESC LIMIT 2001',[w,runs.slice(0,50).map(r=>r.id)])).rows;
  return {sources:sources.slice(0,200).map(s=>({...s,stale:s.checked_at&&Date.now()-new Date(s.checked_at).getTime()>86400000})),runs:runs.slice(0,50),attempts,jobs:jobs.slice(0,500),observations:observations.slice(0,2000),partial:{sources:sources.length>200,runs:runs.length>50,jobs:jobs.length>500,observations:observations.length>2000},asOf:new Date().toISOString(),limits:{sourcesPerRun:3,pagesPerSource:3,requestsPerRun:6,secondsPerRun:90},coverage:'Selected public boards only; not LinkedIn/Indeed/Workday or universal site coverage.'};
 });
}
