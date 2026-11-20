import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {apiCommand,until} from '../support/assisted-application.mjs';
test('scheduled source quotas, cache compaction and archived rescan identity are bounded',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());const sources=[];
 const posting=(board,id)=>({id,title:'Software Engineer',absolute_url:`https://job-boards.greenhouse.io/${board}/jobs/${id}`,location:{name:'Reston, VA'},content:'<h3>Requirements</h3><p>Rust and TypeScript engineering experience building customer integrations.</p><h3>Benefits</h3><p>Health plan.</p>'});
 for(let i=0;i<4;i++){
  const board='bounded'+i,s=await apiCommand(h,'discovery','add_source',{name:'Bounded Employer '+i,provider:'greenhouse',board});sources.push(s);
  await apiCommand(h,'discovery','set_source_industry',{sourceId:s.id,expectedRevision:s.revision,industry:'Technology'});
  h.providerRoutes.set(`/v1/boards/${board}/jobs`,{body:{jobs:Array.from({length:50},(_,n)=>posting(board,n+1))}});
 }
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{autoScan:true,sourceIds:sources.map(s=>s.id),sourcesPerCycle:2,terms:['Software'],maxMatches:6},acknowledgeAutomation:true});
 await apiCommand(h,'intelligence','run',{});await h.startWorker();
 await until(async()=>Number((await h.sql('SELECT count(*) FROM job_observations WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].count)===6,'six quota matches');
 await until(async()=>!(await h.sql("SELECT 1 FROM work_items WHERE workspace_id=$1 AND kind IN ('discover_jobs','intelligence_cycle') AND status IN ('queued','leased')",[h.c.workspaceId])).rowCount,'scan completion');
 await h.sql("UPDATE discovery_runs SET created_at=now()-interval '7 hours' WHERE workspace_id=$1",[h.c.workspaceId]);
 await apiCommand(h,'intelligence','run',{});
 await until(async()=>Number((await h.sql('SELECT count(*) FROM job_observations WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].count)===12,'rotation across four employers');
 await until(async()=>!(await h.sql("SELECT 1 FROM work_items WHERE workspace_id=$1 AND kind IN ('discover_jobs','intelligence_cycle') AND status IN ('queued','leased')",[h.c.workspaceId])).rowCount,'second scan completion');
 const grouped=(await h.sql('SELECT source_id,count(*)::int AS n FROM job_observations WHERE workspace_id=$1 GROUP BY source_id',[h.c.workspaceId])).rows;assert.equal(grouped.length,4);assert.ok(grouped.every(r=>r.n===3));
 assert.ok((await h.sql('SELECT record_count FROM discovery_pages WHERE workspace_id=$1',[h.c.workspaceId])).rows.every(r=>r.record_count===3));
 assert.equal(h.captured.length,0);assert.ok(h.providerRequests.every(r=>!r.headers.authorization&&!r.headers.cookie));
 await apiCommand(h,'intelligence','pause',{});
 await h.sql("UPDATE jobs SET last_seen_at=now()-interval '40 days',updated_at=now()-interval '40 days' WHERE workspace_id=$1",[h.c.workspaceId]);
 await h.sql("UPDATE discovery_runs SET completed_at=now()-interval '8 days' WHERE workspace_id=$1",[h.c.workspaceId]);
 const p=await(await h.request(h.a,'/api/intelligence/cleanup')).json();assert.equal(p.jobs.length,12);assert.equal(p.runs,2);
 const r=await h.request(h.a,'/api/intelligence/retention',{method:'POST',body:{commandId:crypto.randomUUID(),action:'compact',payload:{fingerprint:p.fingerprint,confirmed:true}}});assert.equal(r.status,200);
 assert.ok((await h.sql("SELECT payload FROM discovery_pages WHERE workspace_id=$1",[h.c.workspaceId])).rows.every(r=>Object.keys(r.payload).length===0));
 assert.ok((await h.sql("SELECT raw_fields FROM job_observations WHERE workspace_id=$1",[h.c.workspaceId])).rows.every(r=>Object.keys(r.raw_fields).length===0));
 for(const s of sources){const alias=(await h.sql('SELECT external_id FROM job_source_aliases WHERE workspace_id=$1 AND source_id=$2 LIMIT 1',[h.c.workspaceId,s.id])).rows[0];h.providerRoutes.set(`/v1/boards/${s.board}/jobs`,{body:{jobs:[posting(s.board,Number(alias.external_id))]}});}
 const run=await apiCommand(h,'discovery','start_search',{sourceIds:sources.slice(0,3).map(s=>s.id),terms:['Software']});
 await until(async()=>{const r=(await h.sql('SELECT status FROM discovery_runs WHERE id=$1',[run.id])).rows[0];return !['queued','running'].includes(r.status);},'archived rescan');
 const rows=(await h.sql('SELECT * FROM jobs WHERE workspace_id=$1',[h.c.workspaceId])).rows;assert.equal(rows.length,12);assert.ok(rows.every(j=>j.archived&&j.compacted_at&&j.description===''));
 const retry=await h.request(h.a,'/api/discovery/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'retry_search',payload:{runId:(await h.sql('SELECT id FROM discovery_runs WHERE workspace_id=$1 AND raw_compacted_at IS NOT NULL',[h.c.workspaceId])).rows[0].id,expectedRevision:1}}});assert.equal(retry.status,409);
});

test('per-source cursors visit both records with two boards and one match per cycle',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());const ids=[];
 for(const board of ['cursor-a','cursor-b']){
  const s=await apiCommand(h,'discovery','add_source',{name:board,provider:'greenhouse',board});ids.push(s.id);
  h.providerRoutes.set(`/v1/boards/${board}/jobs`,{body:{jobs:[1,2].map(id=>({id,title:'Software Engineer',absolute_url:`https://job-boards.greenhouse.io/${board}/jobs/${id}`,location:{name:'Reston, VA'},content:'Build reliable Rust integrations with customer engineering teams.'}))}});
 }
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{autoScan:true,sourceIds:ids,sourcesPerCycle:1,maxMatches:1,terms:['Software']},acknowledgeAutomation:true});const worker=await h.startWorker();
 for(let cycle=0;cycle<4;cycle++){
  if(cycle)await h.sql("UPDATE discovery_runs SET created_at=now()-interval '7 hours' WHERE workspace_id=$1",[h.c.workspaceId]);
  await apiCommand(h,'intelligence','run',{});
  await until(async()=>Number((await h.sql('SELECT count(*) FROM job_observations WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].count)>=cycle+1,'source-specific cursor advancement');
  await until(async()=>!(await h.sql("SELECT 1 FROM work_items WHERE workspace_id=$1 AND kind IN ('discover_jobs','intelligence_cycle') AND status IN ('queued','leased')",[h.c.workspaceId])).rowCount);
 }
 await apiCommand(h,'intelligence','pause',{});await h.stopWorker(worker);
 assert.equal((await h.sql('SELECT count(*) FROM jobs WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].count,'4');
});

test('raw cache expiry preserves normalized compensation and secondary-location policy evidence for live leads',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());const s=await apiCommand(h,'discovery','add_source',{name:'Live policy evidence',provider:'lever',board:'policy-cache'});
 const raw={id:'policy-one',text:'Software Engineer',hostedUrl:'https://jobs.lever.co/policy-cache/policy-one',categories:{location:'Washington, DC'},secondaryLocations:[{location:'Reston, VA'}],description:'Rust engineering customer software with a complete public role description.',salaryRange:{min:90000,max:120000,currency:'USD',interval:'per-year-salary'}};
 h.providerRoutes.set('/v0/postings/policy-cache',{body:[raw]});
 const run=await apiCommand(h,'discovery','start_search',{sourceIds:[s.id],terms:['Software']});await h.startWorker();
 await until(async()=>(await h.sql('SELECT status FROM discovery_runs WHERE id=$1',[run.id])).rows[0].status==='completed');
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{}});await h.sql("UPDATE discovery_runs SET completed_at=now()-interval '8 days' WHERE id=$1",[run.id]);
 const p=await(await h.request(h.a,'/api/intelligence/cleanup')).json();assert.equal(p.jobs.length,0);assert.equal(p.runs,1);
 assert.equal((await h.request(h.a,'/api/intelligence/retention',{method:'POST',body:{commandId:crypto.randomUUID(),action:'compact',payload:{fingerprint:p.fingerprint,confirmed:true}}})).status,200);
 const kept=(await h.sql('SELECT raw_fields FROM job_observations WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].raw_fields;
 assert.deepEqual(kept.salaryRange,raw.salaryRange);assert.deepEqual(kept.secondaryLocations,raw.secondaryLocations);assert.equal(kept.description,undefined);
 const j=(await h.sql('SELECT description,archived FROM jobs WHERE workspace_id=$1',[h.c.workspaceId])).rows[0];assert.equal(j.description,raw.description);assert.equal(j.archived,false);
});

test('bounded Lever intake rotates publication across fetched pages',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());const s=await apiCommand(h,'discovery','add_source',{name:'Paged cursor',provider:'lever',board:'page-cursor'});
 const rows=Array.from({length:150},(_,n)=>({id:String(n),text:'Software Engineer',hostedUrl:'https://jobs.lever.co/page-cursor/'+n,categories:{location:'Reston, VA'},description:'Build reliable Rust customer integrations across engineering teams.'}));
 h.providerRoutes.set('/v0/postings/page-cursor?mode=json&limit=100&skip=0',{body:rows.slice(0,100)});h.providerRoutes.set('/v0/postings/page-cursor?mode=json&limit=100&skip=100',{body:rows.slice(100)});
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{autoScan:true,sourceIds:[s.id],maxMatches:1,terms:['Software']},acknowledgeAutomation:true});await h.startWorker();
 for(let cycle=0;cycle<2;cycle++){
  if(cycle)await h.sql("UPDATE discovery_runs SET created_at=now()-interval '7 hours' WHERE workspace_id=$1",[h.c.workspaceId]);await apiCommand(h,'intelligence','run',{});
  await until(async()=>Number((await h.sql('SELECT count(*) FROM job_observations WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].count)>=cycle+1);
  await until(async()=>!(await h.sql("SELECT 1 FROM work_items WHERE workspace_id=$1 AND kind IN ('discover_jobs','intelligence_cycle') AND status IN ('queued','leased')",[h.c.workspaceId])).rowCount);
 }
 const external=(await h.sql('SELECT external_id FROM job_source_aliases WHERE workspace_id=$1',[h.c.workspaceId])).rows.map(r=>Number(r.external_id));assert.equal(external.length,2);assert.ok(external.some(id=>id>=100),'page two is not permanently hidden by the per-run match cap');
});
