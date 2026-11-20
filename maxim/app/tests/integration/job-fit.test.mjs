import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {preparedApplication,apiCommand,until} from '../support/assisted-application.mjs';

test('stored Career-Ops fit sorts globally, stays scoped, and never ranks outdated evidence',{timeout:180000},async t=>{
 const h=await harness();t.after(()=>h.close());let worker=await h.startWorker();
 const read=async(url,auth=h.a)=>{const r=await h.request(auth,url);assert.equal(r.status,200);return r.json();};
 const f=await preparedApplication(h),jobs=[f.job];
 for(const [company,score] of [['Other Fixture',4.2],['Assisted Fixture',4.8]]){
  const r=await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_job',payload:{company,title:'Software Engineer '+score,location:'Reston, VA',description:'Build customer integrations using Rust and TypeScript in Reston, VA. [score:'+score+']'}}});
  assert.equal(r.status,200);const job=(await r.json()).result;jobs.push(job);
  await apiCommand(h,'evaluations','start_evaluation',{jobId:job.id,expectedJobRevision:job.revision,expectedCandidateRevision:f.candidate.revision});
  await until(async()=>{const d=await read('/api/workspace');return d.jobs.find(j=>j.id===job.id)?.fit?.current;},'fit completion');
 }
 await h.stopWorker(worker);worker=null;
 let d=await read('/api/workspace');assert.deepEqual(d.jobs.map(j=>j.fit.score),[4.8,4.6,4.2]);
 assert.equal(d.jobs[1].fit.report_artifact_id,f.packet.report_artifact_id);
 assert.equal(d.candidate.revision,f.candidate.revision);
 assert.deepEqual((await read('/api/workspace?sort=score_asc')).jobs.map(j=>j.fit.score),[4.2,4.6,4.8]);
 assert.equal((await read('/api/workspace',h.b)).jobs.length,0);
 // More than one snapshot page of newer unevaluated jobs must not bury an older high fit.
 await h.sql("UPDATE jobs SET updated_at=now()-interval '1 year' WHERE workspace_id=$1",[h.c.workspaceId]);
 await h.sql("INSERT INTO jobs(id,workspace_id,company,title,location,description,source_platform,opening_key,first_seen_at,last_seen_at) SELECT gen_random_uuid(),$1,'Recent unscored','Software Engineer '||n,'Reston, VA','Synthetic unscored role','greenhouse','fixture-'||n,now(),now() FROM generate_series(1,505) n",[h.c.workspaceId]);
 d=await read('/api/workspace');assert.equal(d.sourceStatus,'partial');assert.equal(d.jobs.length,500);assert.equal(d.jobs[0].id,jobs[2].id);assert.equal(d.jobs[3].fit,null);
 const recent=await read('/api/workspace?sort=recent&job='+f.job.id);assert.equal(recent.jobs.length,501);assert.equal(recent.jobs.at(-1).id,f.job.id);assert.equal(recent.jobs.at(-1).fit.score,4.6);
 const rev=(await read('/api/workspace?sort=recent&job='+f.job.id,h.b));assert.equal(rev.jobs.length,0);
 // The shared source reader returns the same fit and does not disclose raw report/profile text.
 await h.sql("UPDATE jobs SET source_platform='greenhouse',opening_key='evaluated-'||id WHERE id=ANY($1::uuid[])",[jobs.map(j=>j.id)]);
 const discovery=await read('/api/discovery');assert.equal(discovery.jobs[0].fit.score,4.8);assert.equal(discovery.jobs[0].description,undefined);
 await h.sql("UPDATE evaluations SET input_snapshot=jsonb_set(input_snapshot,'{engine,hash}','\"changed-engine\"') WHERE job_id=$1",[jobs[2].id]);
 d=await read('/api/workspace');assert.equal(d.jobs[0].id,f.job.id);assert.equal(d.jobs.find(j=>j.id===jobs[2].id)?.fit?.current||false,false);
 await h.sql('UPDATE candidates SET revision=revision+1 WHERE workspace_id=$1',[h.c.workspaceId]);
 d=await read('/api/workspace?job='+f.job.id);assert.equal(d.jobs.find(j=>j.id===f.job.id).fit.current,false);
 // A queued re-evaluation is not the old completed score; cancellation stays explicit.
 const candidate=d.candidate;
 const queued=await apiCommand(h,'evaluations','start_evaluation',{jobId:f.job.id,expectedJobRevision:f.job.revision,expectedCandidateRevision:candidate.revision});
 d=await read('/api/workspace?job='+f.job.id);let fit=d.jobs.find(j=>j.id===f.job.id).fit;assert.equal(fit.status,'queued');assert.equal(fit.score,null);assert.equal(fit.current,false);
 await apiCommand(h,'evaluations','cancel_evaluation',{evaluationId:queued.id,expectedRevision:queued.revision});
 fit=(await read('/api/workspace?job='+f.job.id)).jobs.find(j=>j.id===f.job.id).fit;assert.equal(fit.status,'cancelled');assert.equal(fit.current,false);
});
