import crypto from 'node:crypto';
import {z} from 'zod';
import {database,transaction} from './db';
import {command,event,jobFor,uuid} from './commands';
import {type Context,reauthorize,digest} from './auth';
import {invariant,notFound} from './errors';
import {enqueue} from './work';
import {greenhousePostingUrl,sourceDefinition,supported} from './discovery-providers';
import {applicationWritable} from './application-authority';
import {engineSnapshot} from './evaluation-native';
import {jobFitJoin,jobFitOrder} from './job-fit';
import type {PoolClient} from 'pg';
import {capacity,policyFor} from './intelligence-policy';
import {upstreamCatalog,upstreamCommit,isMarketProvider,sourcePacks} from './upstream-discovery';
import {profileSaveSchema,saveSearchProfile,searchProfileView} from './search-profile';

const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('save_search_profile'),payload:profileSaveSchema}).strict(),
 z.object({commandId:uuid,action:z.literal('approve_search_profile'),payload:z.object({id:uuid}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('reject_search_profile'),payload:z.object({id:uuid}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('add_source'),payload:z.object({name:z.string().trim().min(1).max(180),provider:z.string().regex(/^(?:reverse:)?[a-z0-9-]{1,80}$/),board:z.string().max(100).default(''),careersUrl:z.string().url().max(2048).optional(),configuration:z.record(z.string(),z.unknown()).optional()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('enable_source_pack'),payload:z.object({pack:z.enum(['us_tech','remote','reverse_ats'])}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_source_enabled'),payload:z.object({sourceId:uuid,expectedRevision:z.number().int().positive(),enabled:z.boolean()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_source_industry'),payload:z.object({sourceId:uuid,expectedRevision:z.number().int().positive(),industry:z.string().trim().max(120)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('start_search'),payload:z.object({sourceIds:z.array(uuid).min(1).max(10),terms:z.array(z.string().trim().min(2).max(120)).max(10).default([]),matchIn:z.enum(['title','title_and_description']).default('title_and_description')}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('fetch_posting_details'),payload:z.object({jobId:uuid,expectedRevision:z.number().int().positive()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['cancel_search','retry_search']),payload:z.object({runId:uuid,expectedRevision:z.number().int().positive()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_discovery_state'),payload:z.object({jobId:uuid,expectedRevision:z.number().int().positive(),state:z.enum(['none','saved','dismissed'])}).strict()}).strict(),
]);
export async function discoveryCommand(ctx:Context,raw:unknown){
 const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  const w=ctx.workspaceId;
  if(c.action==='save_search_profile')return saveSearchProfile(tx,ctx,c.payload);
  if(c.action==='approve_search_profile'||c.action==='reject_search_profile'){
   invariant(ctx.isOwner,'not_found','Record not found.',404);
   const proposal=(await tx.query("SELECT p.* FROM discovery_profile_proposals p JOIN runs r ON r.workspace_id=p.workspace_id AND r.id=p.run_id WHERE p.workspace_id=$1 AND p.id=$2 AND p.status='pending' AND r.status='completed' FOR UPDATE OF p",[w,c.payload.id])).rows[0];if(!proposal)throw notFound();
   if(c.action==='approve_search_profile')await saveSearchProfile(tx,ctx,{expectedRevision:proposal.expected_revision,expectedCandidateRevision:proposal.candidate_revision,profile:proposal.value});
   await tx.query('UPDATE discovery_profile_proposals SET status=$1 WHERE workspace_id=$2 AND id=$3',[c.action==='approve_search_profile'?'approved':'rejected',w,proposal.id]);return {id:proposal.id};
  }
  if(c.action==='enable_source_pack'){
   invariant(ctx.isOwner,'not_found','Record not found.',404);await applicationWritable(tx,w);
   const added=[];
   for(const providerId of sourcePacks[c.payload.pack]){
    const provider=c.payload.pack==='reverse_ats'?'reverse:'+providerId:providerId;
    const d=sourceDefinition(provider,'',undefined),hash=digest(JSON.stringify(d)),deferred=provider==='reverse:workable';
    const row=(await tx.query('INSERT INTO discovery_sources(id,workspace_id,name,provider,board,careers_url,identity_hash,native_definition,enabled,status,status_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT(workspace_id,identity_hash) DO UPDATE SET enabled=EXCLUDED.enabled,revision=discovery_sources.revision+CASE WHEN discovery_sources.enabled IS DISTINCT FROM EXCLUDED.enabled THEN 1 ELSE 0 END RETURNING *',[crypto.randomUUID(),w,providerId+(c.payload.pack==='reverse_ats'?' discovery':''),provider,d.board,d.careers_url,hash,JSON.stringify('native_definition' in d?d.native_definition:null),!deferred,deferred?'unconfigured':'not_checked',deferred?'Large global feed requires an explicit streaming/resource budget.':null])).rows[0];added.push(row);
   }
   await event(tx,ctx,w,'discovery_source_pack_enabled',{pack:c.payload.pack,sourceIds:added.map(s=>s.id)},1);return {sources:added};
  }
  if(c.action==='set_source_industry'){
   invariant(ctx.isOwner,'not_found','Record not found.',404);await applicationWritable(tx,w);
   const p=c.payload,s=(await tx.query('UPDATE discovery_sources SET industry=$1,revision=revision+1 WHERE workspace_id=$2 AND id=$3 AND revision=$4 RETURNING *',[p.industry||null,w,p.sourceId,p.expectedRevision])).rows[0];
   invariant(s,'revision_conflict','Source changed; refresh before editing industry.',409);
   await tx.query("UPDATE jobs j SET industry=$1,industry_provenance='Owner-confirmed source industry' FROM job_source_aliases a WHERE a.workspace_id=$2 AND a.source_id=$3 AND j.workspace_id=a.workspace_id AND j.id=a.job_id",[p.industry||null,w,s.id]);
   await event(tx,ctx,s.id,'source_industry_confirmed',{industry:p.industry||null},s.revision);return s;
  }
  if(['start_search','retry_search','set_discovery_state','fetch_posting_details'].includes(c.action))await applicationWritable(tx,w);
  if(c.action==='add_source'){
   const p=c.payload,d=sourceDefinition(p.provider,p.board,p.careersUrl,p.configuration),id=crypto.randomUUID(),hash=digest(JSON.stringify(d));
   const prior=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 AND identity_hash=$2',[w,hash])).rows[0];
   if(prior)return prior;
   const row=(await tx.query('INSERT INTO discovery_sources(id,workspace_id,name,provider,board,careers_url,identity_hash,native_definition) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[id,w,p.name,d.provider,d.board,d.careers_url,hash,JSON.stringify('native_definition' in d?d.native_definition:null)])).rows[0];
   await event(tx,ctx,id,'discovery_source_added',{provider:d.provider,automated:supported.includes(d.provider)},1);return row;
  }
  if(c.action==='set_source_enabled'){
   const p=c.payload,row=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.sourceId])).rows[0];
   if(!row)throw notFound();invariant(row.revision===p.expectedRevision,'revision_conflict','Source changed; refresh before editing.',409);
   if(row.enabled===p.enabled)return row;
   const changed=(await tx.query('UPDATE discovery_sources SET enabled=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 RETURNING *',[p.enabled,w,p.sourceId])).rows[0];
   await event(tx,ctx,row.id,p.enabled?'discovery_source_enabled':'discovery_source_disabled',{provider:row.provider},changed.revision);
   return changed;
  }
  if(c.action==='set_discovery_state'){
   const p=c.payload,j=await jobFor(tx,ctx,p.jobId);invariant(j.revision===p.expectedRevision,'revision_conflict','Role changed; refresh before saving.',409);
   const old=(await tx.query('SELECT state FROM job_discovery_states WHERE workspace_id=$1 AND job_id=$2',[w,j.id])).rows[0];
   await tx.query('INSERT INTO job_discovery_states(workspace_id,job_id,state) VALUES($1,$2,$3) ON CONFLICT(workspace_id,job_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()',[w,j.id,p.state]);
   const archived=p.state==='dismissed'||j.archived&&old?.state!=='dismissed';
   invariant(!j.compacted_at||p.state==='dismissed','archive_restore_required','Restore compact history through Archive first.',409);
   if(j.archived&&!archived)invariant((await capacity(tx,w)).available,'job_capacity_reached','Active lead capacity reached.',409);
   const revision=j.revision+Number(j.archived!==archived);
   if(revision!==j.revision)await tx.query('UPDATE jobs SET archived=$1,revision=$2,updated_at=now() WHERE workspace_id=$3 AND id=$4',[archived,revision,w,j.id]);
   await event(tx,ctx,j.id,'discovery_state_changed',{state:p.state},revision);return {id:j.id,state:p.state,revision};
  }
  if(c.action==='fetch_posting_details'){
   const p=c.payload,j=await jobFor(tx,ctx,p.jobId);
   invariant(j.revision===p.expectedRevision&&!j.archived,'revision_conflict','This role changed; review it again.',409);
   if(j.source_platform!=='greenhouse'){
    const source=(await tx.query('SELECT s.*,a.external_id FROM job_source_aliases a JOIN discovery_sources s ON s.workspace_id=a.workspace_id AND s.id=a.source_id WHERE a.workspace_id=$1 AND a.job_id=$2 AND s.enabled ORDER BY a.created_at,a.id LIMIT 1 FOR SHARE OF s',[w,j.id])).rows[0];
    invariant(source&&j.opening_key,'posting_details_unavailable','No enabled, verified discovery source is available. Paste the full posting text manually.',409);
    invariant(!source.next_retry_at||new Date(source.next_retry_at).getTime()<=Date.now(),'source_cooldown','The source is still in cooldown.',409);
    const prior=(await tx.query("SELECT r.id,r.status FROM discovery_runs r JOIN discovery_queries q ON q.workspace_id=r.workspace_id AND q.id=r.query_id JOIN work_items x ON x.workspace_id=r.workspace_id AND x.id=r.work_id WHERE r.workspace_id=$1 AND q.filters->'posting'->>'jobId'=$2 AND x.status IN ('queued','leased') LIMIT 1",[w,j.id])).rows[0];if(prior)return prior;
    const queryId=crypto.randomUUID(),runId=crypto.randomUUID(),filters={engine:'careerops-1.40.0',upstreamCommit,posting:{jobId:j.id,revision:j.revision,externalId:source.external_id,openingKey:j.opening_key},maxRequests:1,maxSeconds:90};
    await tx.query("INSERT INTO discovery_queries(id,workspace_id,terms,filters,source_snapshots) VALUES($1,$2,'{}',$3,$4)",[queryId,w,JSON.stringify(filters),JSON.stringify([source])]);
    const work=await enqueue(tx,w,'discover_jobs',runId+':1',{runId,revision:1}),run=(await tx.query('INSERT INTO discovery_runs(id,workspace_id,query_id,work_id) VALUES($1,$2,$3,$4) RETURNING id,status',[runId,w,queryId,work.id])).rows[0];
    await event(tx,ctx,j.id,'posting_details_queued',{runId,sourceId:source.id},j.revision);return run;
   }
   invariant(j.source_platform==='greenhouse'&&j.opening_key,'posting_details_unavailable','No verified Greenhouse posting source is available.');
   const row=(await tx.query("SELECT s.*,a.external_id FROM job_source_aliases a JOIN discovery_sources s ON s.workspace_id=a.workspace_id AND s.id=a.source_id WHERE a.workspace_id=$1 AND a.job_id=$2 AND s.provider='greenhouse' AND s.enabled ORDER BY a.created_at,a.id LIMIT 1 FOR SHARE OF s",[w,j.id])).rows[0];
   invariant(row,'posting_details_unavailable','Enable this role\'s Greenhouse source before fetching details.',409);
   invariant(!row.next_retry_at||new Date(row.next_retry_at).getTime()<=Date.now(),'source_cooldown','This source is still in its recorded cooldown.',409);
   const {external_id,...source}=row;
   greenhousePostingUrl(source,external_id);
   const prior=(await tx.query("SELECT r.id,r.status FROM discovery_runs r JOIN discovery_queries q ON q.workspace_id=r.workspace_id AND q.id=r.query_id JOIN work_items w ON w.workspace_id=r.workspace_id AND w.id=r.work_id WHERE r.workspace_id=$1 AND q.filters->'posting'->>'jobId'=$2 AND w.status IN ('queued','leased') LIMIT 1",[w,j.id])).rows[0];
   if(prior)return prior;
   const queryId=crypto.randomUUID(),runId=crypto.randomUUID(),filters={posting:{jobId:j.id,revision:j.revision,externalId:external_id,openingKey:j.opening_key},maxSources:1,maxRequests:1,maxSeconds:90};
   await tx.query("INSERT INTO discovery_queries(id,workspace_id,terms,filters,source_snapshots) VALUES($1,$2,'{}',$3,$4)",[queryId,w,JSON.stringify(filters),JSON.stringify([source])]);
   const work=await enqueue(tx,w,'discover_jobs',runId+':1',{runId,revision:1});
   const run=(await tx.query('INSERT INTO discovery_runs(id,workspace_id,query_id,work_id) VALUES($1,$2,$3,$4) RETURNING id,status',[runId,w,queryId,work.id])).rows[0];
   await event(tx,ctx,j.id,'posting_details_queued',{runId,sourceId:source.id},j.revision);
   return run;
  }
  if(c.action==='start_search'){
   return queueDiscoverySearch(tx,ctx,c.payload);
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
  invariant(!row.raw_compacted_at,'search_history_compacted','Raw history was compacted. Start a new search instead of retrying old pages.',409);
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
export async function queueDiscoverySearch(tx:PoolClient,ctx:Pick<Context,'workspaceId'>,p:{sourceIds:string[];terms:string[];matchIn:string},automation?:{policyRevision:number;cycleId:string;maxMatches:number}){
   const w=ctx.workspaceId;await applicationWritable(tx,w);
   invariant(p.sourceIds.length>=1&&p.sourceIds.length<=10,'source_limit','A single provider run is limited to ten sources.');
   const ids=[...new Set(p.sourceIds)],sources=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE',[w,ids])).rows;
   invariant(sources.length===ids.length,'not_found','Source not found.',404);
   invariant(sources.every(s=>s.enabled),'source_disabled','Enable the selected source before starting.',409);
   const market=sources.some(s=>isMarketProvider(s.provider));
   invariant(market||sources.length<=3,'source_limit','Legacy employer-feed runs remain limited to three sources.');
   invariant(sources.every(s=>!s.next_retry_at||new Date(s.next_retry_at).getTime()<=Date.now()),'source_cooldown','A selected source is still in its recorded cooldown.',409);
   const candidate=(await tx.query('SELECT id,revision FROM candidates WHERE workspace_id=$1',[w])).rows[0];
   const prefs=(await tx.query("SELECT f.id,f.revision,f.value FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.field_key='preferences.roles' AND f.status='current' AND s.deleted_at IS NULL AND s.revision=f.source_revision",[w])).rows;
   const profile=market?(await searchProfileView(tx,w)).current:null;
   invariant(!profile?.stale,'search_profile_stale','Candidate knowledge changed. Review your search profile before broad discovery.',409);
   const terms=p.terms.length?p.terms:profile?profile.value.titleAliases.slice(0,10):prefs.flatMap(f=>Array.isArray(f.value)?f.value:[]).filter((v:unknown)=>typeof v==='string').slice(0,10);
   invariant(terms.length,'query_required','Enter role terms or approve preferences.roles in Candidate first.');
   const cursor=automation?Number((await tx.query('SELECT count(*) FROM intelligence_cycles WHERE workspace_id=$1 AND cardinality(run_ids)>0',[w])).rows[0].count):0;
   if(automation&&sources.length>1){const n=cursor%sources.length;sources.push(...sources.splice(0,n));}
   const sourceCursors:Record<string,number>={};
   if(automation)for(let i=0;i<sources.length;i++){
    const quota=Math.floor(automation.maxMatches/sources.length)+(i<automation.maxMatches%sources.length?1:0);
    const row=(await tx.query('INSERT INTO discovery_source_cursors(workspace_id,source_id,record_offset) VALUES($1,$2,$3) ON CONFLICT(workspace_id,source_id) DO UPDATE SET record_offset=discovery_source_cursors.record_offset+EXCLUDED.record_offset RETURNING record_offset',[w,sources[i].id,quota])).rows[0];
    sourceCursors[sources[i].id]=Number(row.record_offset)-quota;
   }
   const queryId=crypto.randomUUID(),runId=crypto.randomUUID(),filters={policy:'xavier-nova-dc-v1',matchIn:p.matchIn,maxSources:market?10:3,maxPagesPerSource:market?2:3,maxRequests:market?18:6,maxSeconds:90,...(market?{engine:'careerops-1.40.0',upstreamCommit,lookbackDays:(await policyFor(tx,w)).value.maxAgeDays,searchProfile:profile?{revision:profile.revision,candidateRevision:profile.candidate_revision,...profile.value}:null}:{}),...(automation?{automation:{...automation,sourceCursors}}:{})};
   await tx.query('INSERT INTO discovery_queries(id,workspace_id,terms,filters,source_snapshots,candidate_revision,preference_provenance) VALUES($1,$2,$3,$4,$5,$6,$7)',[queryId,w,terms,JSON.stringify(filters),JSON.stringify(sources),candidate.revision,JSON.stringify(p.terms.length?[]:prefs.map(f=>({id:f.id,revision:f.revision})))]);
   const work=await enqueue(tx,w,'discover_jobs',runId+':1',{runId,revision:1});
   const row=(await tx.query('INSERT INTO discovery_runs(id,workspace_id,query_id,work_id) VALUES($1,$2,$3,$4) RETURNING *',[runId,w,queryId,work.id])).rows[0];
   await event(tx,ctx,runId,'discovery_search_queued',{queryId,terms,sourceIds:ids},1);return row;
}
export async function discoveryView(ctx:Context,sort:string|null=null){
 const engine=await engineSnapshot();
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await reauthorize(tx,ctx);
  const w=ctx.workspaceId;
  const sources=(await tx.query('SELECT * FROM discovery_sources WHERE workspace_id=$1 ORDER BY name,id LIMIT 201',[w])).rows;
  const runs=(await tx.query("SELECT r.*,q.terms,q.filters,q.source_snapshots,q.candidate_revision,q.preference_provenance,w.status AS work_status,w.error_code AS work_error FROM discovery_runs r JOIN discovery_queries q ON q.id=r.query_id AND q.workspace_id=r.workspace_id LEFT JOIN work_items w ON w.id=r.work_id AND w.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND NOT (q.filters ? 'posting') ORDER BY r.created_at DESC LIMIT 51",[w])).rows;
  const attempts=(await tx.query('SELECT a.* FROM discovery_attempts a WHERE a.workspace_id=$1 AND a.run_id=ANY($2::uuid[]) ORDER BY a.started_at DESC',[w,runs.slice(0,50).map(r=>r.id)])).rows;
  const jobs=(await tx.query(`SELECT j.id,j.company,j.title,j.location,j.revision,j.archived,j.opening_key,j.url,j.source_platform,j.application_url,j.posted_at,j.first_seen_at,j.last_seen_at,j.updated_at,j.discovery_policy,coalesce(s.state,'none') AS discovery_state,row_to_json(fit) AS fit FROM jobs j LEFT JOIN job_discovery_states s ON s.job_id=j.id AND s.workspace_id=j.workspace_id ${jobFitJoin} WHERE j.workspace_id=$1 AND j.opening_key IS NOT NULL ORDER BY ${jobFitOrder(sort)} LIMIT 501`,[w,engine.hash])).rows;
  const observations=(await tx.query('SELECT job_id,run_id,source_id,identity_conflict,observed_at,date_basis FROM job_observations WHERE workspace_id=$1 AND run_id=ANY($2::uuid[]) ORDER BY observed_at DESC LIMIT 2001',[w,runs.slice(0,50).map(r=>r.id)])).rows;
  const profileProposals=(await tx.query("SELECT p.* FROM discovery_profile_proposals p JOIN runs r ON r.workspace_id=p.workspace_id AND r.id=p.run_id WHERE p.workspace_id=$1 AND p.status='pending' AND r.status='completed' ORDER BY p.created_at DESC LIMIT 10",[w])).rows;
  return {capacity:await capacity(tx,w),profileProposals,searchProfile:await searchProfileView(tx,w),catalog:{commit:upstreamCommit,providers:upstreamCatalog,packs:sourcePacks},sources:sources.slice(0,200).map(s=>({...s,stale:s.checked_at&&Date.now()-new Date(s.checked_at).getTime()>86400000})),runs:runs.slice(0,50),attempts,jobs:jobs.slice(0,500),observations:observations.slice(0,2000),partial:{sources:sources.length>200,runs:runs.length>50,jobs:jobs.length>500,observations:observations.length>2000},asOf:new Date().toISOString(),limits:{sourcesPerRun:10,pagesPerSource:2,requestsPerRun:18,secondsPerRun:90},coverage:'Pinned Career-Ops 1.40.0 catalog: 153 providers. Enabled boards and bounded reverse ATS discovery only; installed modules are not verified searches. No unrestricted LinkedIn/Indeed search.'};
 });
}
