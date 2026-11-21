import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {delay} from '../../scripts/environment.mjs';

test('board-wide discovery admits unknown employers through the retained store and reports coverage honestly',async t=>{
 const h=await harness();let worker;
 const command=async(action,payload,status=200,auth=h.a)=>{
  const r=await h.request(auth,'/api/discovery/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action,payload}}),b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b.result;
 };
 const view=async()=>await(await h.request(h.a,'/api/discovery')).json();
 const done=async id=>{for(let i=0;i<180;i++){const v=await view(),r=v.runs.find(r=>r.id===id);if(r&&!['queued','running'].includes(r.status))return {v,r};await delay(200);}throw Error('Upstream fixture timeout');};
 try{
  const pack=await command('enable_source_pack',{pack:'us_tech'});assert.equal(pack.sources.length,4);
  assert.equal((await command('enable_source_pack',{pack:'us_tech'})).sources[0].id,pack.sources[0].id);
  const s=await command('add_source',{name:'Remotive board',provider:'remotive'});
  h.providerRoutes.set('/api/remote-jobs',{body:{jobs:[{id:500,title:'Software Integration Engineer',company_name:'New Employer Labs',url:'https://remotive.com/remote-jobs/software-dev/500',candidate_required_location:'Arlington, VA',description:'<p>Build customer software integrations and automate operational workflows. Work with REST APIs and users to deliver reliable full-stack software.</p>',publication_date:'2026-11-21T10:00:00Z',job_type:'full_time'}]}});
  const run=await command('start_search',{sourceIds:[s.id],terms:['software'],matchIn:'title_and_description'});
  worker=await h.startWorker();const {v,r}=await done(run.id);
  assert.equal(r.status,'completed',JSON.stringify(v.attempts));assert.equal(r.counts.created,1);assert.equal(r.counts.uniqueEmployers,1);
  const job=v.jobs[0];assert.equal(job.company,'New Employer Labs');assert.equal(job.discovery_policy.detailStatus,'full');
  assert.ok(!v.sources.some(x=>x.name===job.company),'no employer preregistration');assert.equal(job.fit?.score??null,null);
  const again=await command('start_search',{sourceIds:[s.id],terms:['software']});assert.equal((await done(again.id)).r.counts.created,0);
  assert.equal((await h.sql('SELECT count(*)::int AS n FROM jobs WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].n,1);
  assert.equal((await(await h.request(h.b,'/api/discovery')).json()).jobs.length,0);
  assert.equal(v.catalog.providers.length,153);assert.equal(v.catalog.providers.find(c=>c.id==='torre').state,'retired');
  assert.ok(h.providerRequests.every(x=>!x.headers.cookie&&!x.headers.authorization));
  await command('add_source',{name:'Forbidden',provider:'local-parser',configuration:{parser:{command:'cmd.exe'}}},400);
  h.providerRoutes.set('/api/remote-jobs',{status:403,body:{}});
  const failed=await command('start_search',{sourceIds:[s.id],terms:['software']});const f=await done(failed.id);
  assert.equal(f.r.status,'failed');assert.equal(f.v.attempts.find(a=>a.run_id===failed.id).error_code,'auth_or_challenge');
  assert.equal((await h.sql('SELECT count(*)::int AS n FROM jobs WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].n,1,'challenge cannot become empty results or corrupt prior job');
 }finally{if(worker)await h.stopWorker(worker);await h.close();}
});
