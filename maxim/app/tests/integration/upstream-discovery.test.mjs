import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {delay} from '../../scripts/environment.mjs';
import {apiCommand} from '../support/assisted-application.mjs';

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
  const reverse=await command('enable_source_pack',{pack:'reverse_ats'});assert.equal(reverse.sources.length,9);
  assert.equal(reverse.sources.find(s=>s.provider==='reverse:workable').enabled,false);
  const directory=reverse.sources.find(s=>s.provider==='reverse:greenhouse');
  h.providerRoutes.set('/Feashliaa/job-board-aggregator/main/data/greenhouse_companies.json',{body:['newlabs','secondlabs','thirdlabs','fourthlabs','lastlabs']});
  for(const [i,slug] of ['newlabs','secondlabs','thirdlabs','fourthlabs','lastlabs'].entries())h.providerRoutes.set('/v1/boards/'+slug+'/jobs',{body:{jobs:[{id:700+i,title:'Software Engineer',absolute_url:'https://job-boards.greenhouse.io/'+slug+'/jobs/'+(700+i),location:{name:'Reston, VA'},content:'<p>Build customer software integrations and automate internal workflows using APIs.</p>'}]}});
  const reversed=await command('start_search',{sourceIds:[directory.id],terms:['software']});const first=await done(reversed.id);
  assert.equal(first.r.status,'partial',JSON.stringify(first.v.attempts.filter(a=>a.run_id===reversed.id)));assert.equal(first.r.counts.created,4);
  const attempt=first.v.attempts.find(a=>a.run_id===reversed.id);assert.equal(attempt.coverage.available,5);assert.equal(attempt.coverage.nextCursor,4);assert.equal(attempt.coverage.uninspected,1);
  const next=await command('start_search',{sourceIds:[directory.id],terms:['software']});const second=await done(next.id);
  assert.equal(second.r.counts.created,1,'rotating window reaches the fifth employer');
  assert.equal(h.providerRequests.filter(r=>r.url.includes('greenhouse_companies.json')).length,1,'directory cached, not repeatedly copied');
  assert.ok(second.v.jobs.some(j=>j.company==='lastlabs'));
  await apiCommand(h,'candidate','manual_fact',{fieldKey:'candidate.name',value:'Discovery Example',expectedFactRevision:0,modelConsent:true,reason:'Synthetic reviewed discovery fixture'});
  await apiCommand(h,'candidate','manual_fact',{fieldKey:'projects.summary',value:'Built software integrations and automated customer workflows.',expectedFactRevision:0,modelConsent:true,reason:'Synthetic reviewed discovery fixture'});
  const candidate=(await(await h.request(h.a,'/api/candidate')).json()).candidate;
  await command('save_search_profile',{expectedRevision:0,expectedCandidateRevision:candidate.revision,profile:{families:['software_delivery','product_engineering','automation','systems_integration']}});
  h.providerRoutes.set('/api/remote-jobs',{body:{jobs:[
   {id:600,title:'Customer Delivery Builder',company_name:'Unexpected Work Labs',url:'https://remotive.com/remote-jobs/software-dev/600',candidate_required_location:'Reston, VA',description:'<p>Use REST APIs and automate workflows. Deliver production software for customer requirements and technical implementation.</p>'},
   {id:601,title:'Software Engineer',company_name:'Clearance Required Labs',url:'https://remotive.com/remote-jobs/software-dev/601',candidate_required_location:'Reston, VA',description:'<p>Build software. An active TS/SCI security clearance is required at time of hire. Must currently hold an active clearance.</p>'},
  ]}});
  const rescued=await command('start_search',{sourceIds:[s.id],terms:['software engineer']});const third=await done(rescued.id);
  assert.equal(third.r.counts.created,2);const unconventional=third.v.jobs.find(j=>j.company==='Unexpected Work Labs');
  assert.equal(unconventional.discovery_policy.screening.reason,'responsibility_rescue');
  assert.equal(third.v.jobs.find(j=>j.company==='Clearance Required Labs').discovery_policy.eligibility,'blocked');
  const broad=pack.sources.find(s=>s.provider==='a16z-speedrun-talent');
  h.providerRoutes.set('/api/v1/jobs',{body:{jobs:[{id:900,title:'Customer Delivery Builder',company:'Detail Labs',url:'https://speedrun-talent-network.com/jobs/900',location:'Arlington, VA',published_at:'2026-11-21T10:00:00Z'}],total_pages:1}});
  h.providerRoutes.set('/jobs/900',async(req,res)=>{res.writeHead(200,{'Content-Type':'text/html'});res.end('<script type="application/ld+json">'+JSON.stringify({'@type':'JobPosting',title:'Customer Delivery Builder',hiringOrganization:{name:'Detail Labs'},description:'Build production software. Use REST APIs and automate workflows to serve customer requirements.',jobLocation:{address:{addressLocality:'Arlington',addressRegion:'VA'}}})+'</script>');});
  const enriched=await command('start_search',{sourceIds:[broad.id],terms:['software engineer']});const fourth=await done(enriched.id);
  assert.equal(fourth.r.counts.created,1,JSON.stringify(fourth.v.attempts.filter(a=>a.run_id===enriched.id)));
  const detailed=fourth.v.jobs.find(j=>j.company==='Detail Labs');assert.equal(detailed.discovery_policy.detailStatus,'full');assert.equal(detailed.discovery_policy.screening.reason,'responsibility_rescue');
  const prepared=(await(await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'prepare',expectedRevision:candidate.revision}})).json()).result;
  assert.equal((await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'activate',expectedRevision:candidate.revision,transitionId:prepared.id}})).status,200);
  await apiCommand(h,'evaluations','start_evaluation',{jobId:detailed.id,expectedJobRevision:detailed.revision,expectedCandidateRevision:candidate.revision});
  for(let i=0;i<180;i++){if((await view()).jobs.find(j=>j.id===detailed.id)?.fit?.current)break;await delay(200);}
  const evaluated=(await view()).jobs.find(j=>j.id===detailed.id);assert.equal(evaluated.fit.score,4.6);assert.equal(evaluated.fit.tier,'T3');
  const requestsBefore=h.captured.length;
  const held=(await h.sql("UPDATE evaluations SET status='review_required',error_code='score_conflict' WHERE workspace_id=$1 AND job_id=$2 RETURNING id,revision",[h.c.workspaceId,detailed.id])).rows[0];
  const repaired=await apiCommand(h,'evaluations','revalidate_evaluation',{evaluationId:held.id,expectedRevision:held.revision});
  assert.equal(h.captured.length,requestsBefore,'revalidation never sends another model request');
  assert.equal((await view()).jobs.find(j=>j.id===detailed.id).fit.current,true);
  const summaryId=crypto.randomUUID();await h.sql("INSERT INTO jobs(id,workspace_id,company,title,description,opening_key,discovery_policy) VALUES($1,$2,'Summary Labs','Software Engineer',$3,'summary:fixture','{\"detailStatus\":\"summary\"}')",[summaryId,h.c.workspaceId,'A long teaser without a verified full posting. '.repeat(5)]);
  await apiCommand(h,'evaluations','start_evaluation',{jobId:summaryId,expectedJobRevision:1,expectedCandidateRevision:candidate.revision},409);
  assert.equal(h.captured.length,requestsBefore,'summary is held before paid dispatch');
  await command('add_source',{name:'Forbidden',provider:'local-parser',configuration:{parser:{command:'cmd.exe'}}},400);
  h.providerRoutes.set('/api/remote-jobs',{status:403,body:{}});
  const failed=await command('start_search',{sourceIds:[s.id],terms:['software']});const f=await done(failed.id);
  assert.equal(f.r.status,'failed');assert.equal(f.v.attempts.find(a=>a.run_id===failed.id).error_code,'auth_or_challenge');
  assert.equal((await h.sql('SELECT count(*)::int AS n FROM jobs WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].n,10,'challenge cannot become empty results or corrupt prior jobs');
 }finally{if(worker)await h.stopWorker(worker);await h.close();}
});
