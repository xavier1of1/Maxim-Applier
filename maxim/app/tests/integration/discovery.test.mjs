import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {harness,streamResult} from '../support/harness.mjs';
import {delay,appDir} from '../../scripts/environment.mjs';

const gh=(id,title='Software Engineer',location='Reston, VA')=>({id,title,absolute_url:'https://job-boards.greenhouse.io/fixture/jobs/'+id,location:{name:location},content:'<p>Build useful customer software.</p>',updated_at:'2026-11-16T12:00:00Z'});
const lever=(id,title='Other role')=>({id,text:title,hostedUrl:'https://jobs.lever.co/fixture/'+id,categories:{location:'Washington, DC'},description:'<p>Customer software.</p>',salaryRange:{min:90000,max:120000,currency:'USD',interval:'per-year-salary'}});
test('S4 discovery shared API, retained adapters, checkpoint recovery and honest coverage',async t=>{
 const nativePaths=['data/pipeline.md','data/scan-history.tsv'].map(p=>path.resolve(appDir,'../..',p));
 const before=nativePaths.map(p=>fs.existsSync(p)?fs.readFileSync(p):null),h=await harness();
 let worker;
 const request=async(action,payload,auth=h.a,commandId=crypto.randomUUID())=>{
  const r=await h.request(auth,'/api/discovery/commands',{method:'POST',body:{commandId,action,payload}});
  const value=await r.json();assert.equal(r.status,200,JSON.stringify(value));return value.result;
 };
 const view=async(auth=h.a)=>await(await h.request(auth,'/api/discovery')).json();
 const until=async(fn)=>{for(let i=0;i<150;i++){const v=await fn();if(v)return v;await delay(200);}throw Error('Discovery fixture timed out');};
 const done=id=>until(async()=>{const v=await view(),r=v.runs.find(r=>r.id===id);return r&&!['queued','running'].includes(r.status)?{v,r}:null;});
 try{
  const source=await request('add_source',{name:'Fixture',provider:'greenhouse',board:'fixture'});
  h.providerRoutes.set('/v1/boards/fixture/jobs',{body:{jobs:[gh(1),gh(2),gh(3,'Software Engineer','Gainesville, FL')],meta:{total:3}}});
  const manual=await request('add_source',{name:'Unsupported company',provider:'manual',careersUrl:'https://example.com/careers'});
  await t.test('new and repeated roles retain distinct IDs, unknown dates, policy and lineage',async()=>{
   const id=crypto.randomUUID(),run=await request('start_search',{sourceIds:[source.id,manual.id],terms:['Software']},h.a,id);
   assert.equal((await request('start_search',{sourceIds:[source.id,manual.id],terms:['Software']},h.a,id)).id,run.id);
   worker=await h.startWorker();let {v,r}=await done(run.id);
   assert.equal(r.status,'partial');assert.equal(v.jobs.length,3);assert.notEqual(v.jobs[0].id,v.jobs[1].id);
   assert.ok(v.attempts.some(a=>a.status==='unsupported'&&a.fallback));
   assert.equal(v.jobs.find(j=>j.url.endsWith('/3')).discovery_policy.eligibility,'blocked');
   assert.ok(v.jobs.every(j=>j.posted_at===null&&j.first_seen_at&&j.last_seen_at));
   assert.deepEqual(r.terms,['Software']);assert.equal(r.source_snapshots[0].revision,1);
   const j=v.jobs.find(j=>j.url.endsWith('/1'));
   await request('set_discovery_state',{jobId:j.id,expectedRevision:j.revision,state:'saved'});
   const second=await request('start_search',{sourceIds:[source.id],terms:['Software']});({v,r}=await done(second.id));
   assert.equal(r.status,'completed');assert.equal(r.counts.created,0);assert.equal(v.jobs.length,3);assert.equal(v.jobs.find(x=>x.id===j.id).discovery_state,'saved');
   assert.equal(v.jobs.find(x=>x.id===j.id).revision,j.revision,'bookmark-only changes do not invalidate a posting');
   const aliases=await h.sql('SELECT * FROM job_source_aliases WHERE workspace_id=$1',[h.c.workspaceId]);assert.equal(aliases.rowCount,3);
   const pages=await h.sql('SELECT * FROM discovery_pages WHERE workspace_id=$1',[h.c.workspaceId]);assert.equal(pages.rowCount,2);
   assert.equal((await view(h.b)).jobs.length,0);
   const denied=await h.request(h.b,'/api/discovery/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'set_discovery_state',payload:{jobId:j.id,expectedRevision:1,state:'dismissed'}}});assert.equal(denied.status,404);
  });
  await t.test('Ashby destination aliases reuse the opening, timestamps and annual compensation stay explicit',async()=>{
   const s=await request('add_source',{name:'Fixture',provider:'ashby',board:'aliases'});
   h.providerRoutes.set('/posting-api/job-board/aliases',{body:{jobs:[
    {id:'alias-one',title:'Software Engineer',jobUrl:gh(1).absolute_url,applyUrl:gh(1).absolute_url+'?apply=true',location:'Reston, VA',descriptionPlain:'Build useful customer software.',publishedAt:new Date(Date.now()-3600000).toISOString(),compensation:{summaryComponents:[{compensationType:'Salary',currencyCode:'USD',interval:'1 YEAR',minValue:90000,maxValue:120000}]}},
    {id:'unlisted',title:'Unlisted Software Engineer',jobUrl:'https://jobs.ashbyhq.com/aliases/unlisted',location:'Reston, VA',isListed:false},
   ]}});
   const run=await request('start_search',{sourceIds:[s.id],terms:['Software']});const {v,r}=await done(run.id);
   assert.equal(r.status,'completed');assert.equal(v.jobs.length,3);
   const j=v.jobs.find(j=>j.url.endsWith('/1'));assert.ok(j.posted_at);assert.equal(j.discovery_policy.eligibility,'eligible');assert.equal(j.discovery_policy.urgent,false);
   assert.equal((await h.sql('SELECT * FROM job_source_aliases WHERE workspace_id=$1 AND job_id=$2',[h.c.workspaceId,j.id])).rowCount,2);
   h.providerRoutes.set('/posting-api/job-board/aliases',{body:{jobs:[{id:'alias-one',title:'Materially Different Software Manager',jobUrl:gh(1).absolute_url,location:'Reston, VA'}]}});
   const next=await request('start_search',{sourceIds:[s.id],terms:['Software']});await done(next.id);
   const current=(await view()).jobs.find(x=>x.id===j.id);assert.equal(current.title,'Software Engineer');
   assert.equal((await h.sql('SELECT * FROM job_observations WHERE workspace_id=$1 AND run_id=$2 AND identity_conflict=true',[h.c.workspaceId,next.id])).rowCount,1);
  });
  await t.test('empty, quota, access, HTTP, redirect and schema failures are not empty success',async()=>{
   const fixtures=[
    ['empty',{body:{jobs:[]}},'empty_success'],
    ['quota',{status:429,headers:{'Retry-After':'120'},body:{}},'quota_exceeded'],
    ['access',{status:403,body:{}},'auth_or_challenge'],
    ['http',{status:503,body:{}},'http_failure'],
    ['redirect',{status:302,headers:{Location:'http://169.254.169.254/'},body:{}},'redirect_refused'],
    ['drift',{body:{results:[]}},'schema_drift'],
   ];
   for(const [board,route,status] of fixtures){
    const s=await request('add_source',{name:board,provider:'greenhouse',board});h.providerRoutes.set('/v1/boards/'+board+'/jobs',route);
    const run=await request('start_search',{sourceIds:[s.id],terms:['Software']});const {v,r}=await done(run.id);
    assert.equal(v.attempts.find(a=>a.run_id===run.id).status,status,status);assert.equal(r.status,status==='empty_success'?'completed':'failed');
    if(board==='quota'){
     const retry=await h.request(h.a,'/api/discovery/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'retry_search',payload:{runId:run.id,expectedRevision:1}}});assert.equal(retry.status,409);
    }
   }
   assert.ok(h.providerRequests.every(r=>!r.headers.authorization&&!r.headers.cookie));
  });
  await t.test('partial pagination retries use checkpoint pages, cooldowns, pacing and bounded requests',async()=>{
   const s=await request('add_source',{name:'Paged',provider:'lever',board:'paged'});
   const page0=Array.from({length:100},(_,i)=>lever('p'+i,i===0?'Software Engineer':'Other role'));
   const base='/v0/postings/paged?mode=json&limit=100&skip=';
   h.providerRoutes.set(base+'0',{body:page0});h.providerRoutes.set(base+'100',{status:429,body:{}});
   const run=await request('start_search',{sourceIds:[s.id],terms:['Software']});let {v,r}=await done(run.id);
   assert.equal(r.status,'partial');assert.equal(r.counts.requests,2);assert.equal(v.attempts.find(a=>a.run_id===run.id).error_code,'quota_exceeded');
   await h.sql('UPDATE discovery_sources SET next_retry_at=now()-interval \'1 second\' WHERE workspace_id=$1 AND id=$2',[h.c.workspaceId,s.id]);
   h.providerRoutes.set(base+'100',{body:[lever('p100','Software Engineer II')]});
   await request('retry_search',{runId:run.id,expectedRevision:1});({v,r}=await done(run.id));
   assert.equal(r.status,'completed');assert.equal(r.revision,2);assert.equal(r.counts.requests,1);
   assert.equal(h.providerRequests.filter(r=>r.url===base+'0').length,1);
   const cached=await h.sql('SELECT * FROM discovery_pages WHERE workspace_id=$1 AND run_id=$2 AND cached_from IS NOT NULL',[h.c.workspaceId,run.id]);assert.equal(cached.rowCount,1);
   const requests=h.providerRequests.filter(r=>r.url.startsWith('/v0/postings/paged'));assert.ok(requests[1].at-requests[0].at>=900);
  });
  await t.test('cancel fences late responses; killed worker recovers its saved page without native writes',async()=>{
   const s=await request('add_source',{name:'Restart',provider:'lever',board:'restart'}),base='/v0/postings/restart?mode=json&limit=100&skip=';
   h.providerRoutes.set(base+'0',{body:Array.from({length:100},(_,i)=>lever('r'+i,i===0?'Software Engineer':'Other role'))});
   h.providerRoutes.set(base+'100',async(_req,res)=>{await delay(7000);if(!res.destroyed){res.writeHead(200,{'Content-Type':'application/json'});res.end('[]');}});
   let run=await request('start_search',{sourceIds:[s.id],terms:['Software']});
   await until(()=>h.providerRequests.some(r=>r.url===base+'100'));
   await request('cancel_search',{runId:run.id,expectedRevision:1});await delay(400);
   assert.equal((await view()).runs.find(r=>r.id===run.id).status,'cancelled');
   await h.stopWorker(worker);worker=null;
   h.providerRoutes.set(base+'100',{body:[]});
   await request('retry_search',{runId:run.id,expectedRevision:1});
   worker=await h.startWorker();const final=await done(run.id);assert.equal(final.r.status,'completed');
   assert.equal(h.providerRequests.filter(r=>r.url===base+'0').length,1);
   await h.stopWorker(worker);worker=null;
   const crash=await request('start_search',{sourceIds:[source.id],terms:['Software']});
   await h.sql("UPDATE work_items SET status='leased',lease_owner='dead-process',lease_token=$1,lease_until=now()-interval '1 second',attempts=1 WHERE workspace_id=$2 AND id=$3",[crypto.randomUUID(),h.c.workspaceId,crash.work_id]);
   worker=await h.startWorker();assert.equal((await done(crash.id)).r.status,'completed');
   for(let i=0;i<nativePaths.length;i++)assert.deepEqual(fs.existsSync(nativePaths[i])?fs.readFileSync(nativePaths[i]):null,before[i]);
  });
  await t.test('explicit agent tools use the same IDs and reject invented actions',async()=>{
   const c=await(await h.request(h.a,'/api/conversations',{method:'POST',body:{commandId:crypto.randomUUID(),title:'Discovery fixture'}})).json();
   const events=await streamResult(await h.request(h.a,'/api/conversations/'+c.conversation.id+'/messages',{method:'POST',body:{commandId:crypto.randomUUID(),text:'[case:discovery] Show discovery history.'}}));
   assert.ok(events.some(e=>e.event==='tool'&&e.data.name==='read_discovery'));
   assert.ok(events.some(e=>e.event==='done'));
   const chat=async text=>streamResult(await h.request(h.a,'/api/conversations/'+c.conversation.id+'/messages',{method:'POST',body:{commandId:crypto.randomUUID(),text}}));
   let j=(await view()).jobs.find(j=>j.url.endsWith('/1'));
   let e=await chat('[case:discovery-save] save '+j.id+' rev '+j.revision);
   assert.ok(e.some(x=>x.event==='done'));assert.equal((await view()).jobs.find(x=>x.id===j.id).discovery_state,'saved');
   j=(await view()).jobs.find(x=>x.id===j.id);
   e=await chat('[case:discovery-save] dismiss '+j.id+' rev '+j.revision);
   assert.ok(e.some(x=>x.event==='done'));assert.equal((await view()).jobs.find(x=>x.id===j.id).discovery_state,'dismissed');
   const count=(await view()).runs.length;
   e=await chat('[case:discovery-unrequested] '+source.id);
   assert.ok(e.filter(x=>x.event==='delta').map(x=>x.data.text).join('').includes('explicit_request_required'),JSON.stringify(e));
   assert.equal((await view()).runs.length,count);
   e=await chat('[case:discovery-start] search Software '+source.id);
   assert.ok(e.some(x=>x.event==='done'));
   assert.equal((await view()).runs.length,count+1);await done((await view()).runs[0].id);
   await h.sql("UPDATE discovery_sources SET checked_at=now()-interval '2 days' WHERE workspace_id=$1 AND id=$2",[h.c.workspaceId,source.id]);
   assert.equal((await view()).sources.find(s=>s.id===source.id).stale,true);
  });
  await t.test('oversized Greenhouse board has compact coverage and exact on-demand details',async()=>{
   const source=await request('add_source',{name:'Compact Fixture',provider:'greenhouse',board:'compact'}),base='/v1/boards/compact/jobs';
   const compact={...gh(921),absolute_url:'https://job-boards.greenhouse.io/compact/jobs/921'};
   delete compact.content;
   const full={...compact,content:'<p>Build and maintain reliable customer integrations. Work with a small team to ship reviewed software.</p>'};
   h.providerRoutes.set(base+'?content=true',(_req,res)=>{res.writeHead(200,{'Content-Type':'application/json','Content-Length':6*1024*1024});res.end('{}');});
   h.providerRoutes.set(base,{body:{jobs:[compact,{...compact,id:922,title:'Marketing coordinator',absolute_url:compact.absolute_url.replace('921','922'),content:full.content}]}});
   const search=await request('start_search',{sourceIds:[source.id],terms:['Software'],matchIn:'title'});
   const {r,v}=await done(search.id);
   assert.equal(r.status,'partial');assert.equal(r.counts.requests,2);assert.equal(r.counts.created,1);
   assert.equal(v.attempts.find(a=>a.run_id===r.id).error_code,'expanded_feed_too_large');
   const j=v.jobs.find(x=>x.company==='Compact Fixture');assert.equal(j.discovery_policy.detailStatus,'summary');
   assert.equal((await h.sql('SELECT description FROM jobs WHERE id=$1',[j.id])).rows[0].description,'');
   const settle=id=>until(async()=>{const run=(await h.sql('SELECT * FROM discovery_runs WHERE id=$1',[id])).rows[0];return run.completed_at&&run;});
   h.providerRoutes.set(base+'/921',{body:{...full,id:922}});
   const rejected=await request('fetch_posting_details',{jobId:j.id,expectedRevision:j.revision});
   assert.equal((await settle(rejected.id)).error_code,'posting_details_unavailable');
   assert.equal((await h.sql('SELECT description FROM jobs WHERE id=$1',[j.id])).rows[0].description,'');
   const denied=await h.request(h.b,'/api/discovery/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'fetch_posting_details',payload:{jobId:j.id,expectedRevision:j.revision}}});
   assert.equal(denied.status,404);
   h.providerRoutes.set(base+'/921',{body:full});
   const detail=await request('fetch_posting_details',{jobId:j.id,expectedRevision:j.revision});
   const completed=await settle(detail.id);assert.equal(completed.status,'completed');assert.equal(completed.counts.requests,1);
   const hydrated=(await h.sql('SELECT id,description,revision FROM jobs WHERE id=$1',[j.id])).rows[0];
   assert.equal(hydrated.id,j.id);assert.equal(hydrated.revision,j.revision+1);assert.match(hydrated.description,/reliable customer integrations/);
   assert.equal((await view()).sources.find(s=>s.id===source.id).status,'partial','one detail does not make the board complete');
   assert.equal((await view()).runs.some(r=>r.id===detail.id),false,'detail retrieval does not replace the selected search');
   assert.ok(h.providerRequests.filter(p=>p.url===base+'/921').length===2);
   assert.ok(h.providerRequests.filter(p=>p.url.startsWith(base)).every(p=>!p.headers.authorization&&!p.headers.cookie));
  });
  await t.test('real killed process resumes a checkpoint with the same attempt and durable request budget',async()=>{
   await h.stopWorker(worker);worker=null;
   const s=await request('add_source',{name:'Crash',provider:'lever',board:'crash'}),base='/v0/postings/crash?mode=json&limit=100&skip=';
   h.providerRoutes.set(base+'0',{body:Array.from({length:100},(_,i)=>lever('cr'+i,i===0?'Software Engineer':'Other role'))});
   h.providerRoutes.set(base+'100',async(_req,res)=>{await delay(7000);if(!res.destroyed){res.writeHead(200,{'Content-Type':'application/json'});res.end('[]');}});
   const run=await request('start_search',{sourceIds:[s.id],terms:['Software']});
   worker=await h.startWorker();await until(()=>h.providerRequests.some(r=>r.url===base+'100'));
   await h.stopWorker(worker);worker=null;
   await h.sql("UPDATE work_items SET lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND id=$2 AND status='leased'",[h.c.workspaceId,run.work_id]);
   h.providerRoutes.set(base+'100',{body:[]});worker=await h.startWorker();
   const {r}=await done(run.id);assert.equal(r.status,'completed');assert.equal(r.counts.requests,3);
   assert.equal(h.providerRequests.filter(r=>r.url===base+'0').length,1);
   const requests=await h.sql('SELECT status,error_code FROM discovery_requests WHERE workspace_id=$1 AND run_id=$2',[h.c.workspaceId,run.id]);
   assert.equal(requests.rowCount,3);assert.ok(requests.rows.some(r=>r.status==='interrupted'&&r.error_code==='worker_interrupted'));
   const attempts=await h.sql('SELECT id FROM discovery_attempts WHERE workspace_id=$1 AND run_id=$2',[h.c.workspaceId,run.id]);assert.equal(attempts.rowCount,1);
  });
 }finally{await h.close();}
});
