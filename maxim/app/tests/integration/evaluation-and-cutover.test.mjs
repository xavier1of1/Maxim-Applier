import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {harness,streamResult} from '../support/harness.mjs';
import {delay} from '../../scripts/environment.mjs';
import {backupWorkspace,restoreWorkspace} from '../../scripts/recovery.mjs';

test('S5 retained evaluation, approved real PDF and truthful application lifecycle',async t=>{
 const h=await harness(),workers=[];
 const call=async(endpoint,action,payload,expected=200,id=crypto.randomUUID())=>{
  const r=await h.request(h.a,'/api/'+endpoint+'/commands',{method:'POST',body:{commandId:id,action,payload}}),value=await r.json();assert.equal(r.status,expected,JSON.stringify(value));return value.result||value;
 };
 const view=async()=>await(await h.request(h.a,'/api/applications')).json();
 const until=async fn=>{for(let i=0;i<250;i++){const r=await fn();if(r)return r;await delay(200);}throw Error('Lifecycle fixture timed out.');};
 let facts,candidate,job,app,evaluation,packet;
 try{
  await call('candidate','manual_fact',{fieldKey:'candidate.name',value:'Packet Example',expectedFactRevision:0,modelConsent:true,reason:'Synthetic packet fixture'});
  await call('candidate','manual_fact',{fieldKey:'projects.summary',value:'Built customer integrations using Rust and TypeScript.',expectedFactRevision:0,modelConsent:true,reason:'Synthetic approved evidence'});
  const person=await(await h.request(h.a,'/api/candidate')).json();candidate=person.candidate;facts=person.facts;
  const prepare=await(await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'prepare',expectedRevision:candidate.revision}})).json();
  assert.equal((await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'activate',transitionId:prepare.result.id,expectedRevision:candidate.revision}})).status,200);
  const create=async(id,score='4.6',extra='')=>{
   const jd='Build customer software and full-stack integrations with a team in Reston, VA. Salary: 100000 USD annually. [score:'+score+'] '+extra;
   const j=await(await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_job',payload:{company:'Lifecycle Fixture',title:'Software Engineer',description:jd,location:'Reston, VA',url:'https://example.com/jobs/'+id}}})).json();assert.ok(j.result);
   await call('applications','set_job_policy',{jobId:j.result.id,expectedJobRevision:1,expectedPolicyRevision:0,salary:{flat:100000,currency:'USD',period:'annual'},sourceQuote:'Salary: 100000 USD annually.'});
   const a=await(await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_intent',payload:{jobId:j.result.id}}})).json();return {job:j.result,app:a.result};
  };
  ({job,app}=await create('opening-one'));const second=await create('opening-two');
  await t.test('concurrent immutable invocations preserve native prompts, report identity and score/tier',async()=>{
   const id=crypto.randomUUID(),payload={jobId:job.id,expectedJobRevision:1,expectedCandidateRevision:candidate.revision};
   const e1=await call('evaluations','start_evaluation',payload,200,id),same=await call('evaluations','start_evaluation',payload,200,id);assert.equal(same.id,e1.id);
   const e2=await call('evaluations','start_evaluation',{...payload,jobId:second.job.id});
   workers.push(await h.startWorker(),await h.startWorker());
   await until(async()=>{const v=await view();return v.evaluations.filter(e=>[e1.id,e2.id].includes(e.id)&&e.status==='completed').length===2;});
   const v=await view();evaluation=v.evaluations.find(e=>e.id===e1.id);const other=v.evaluations.find(e=>e.id===e2.id);
   assert.equal(Number(evaluation.score),4.6);assert.equal(evaluation.tier,'T3');assert.equal(evaluation.policy.eligibility,'eligible');assert.equal(evaluation.liveness,'unconfirmed');
   assert.notEqual(evaluation.report_artifact_id,other.report_artifact_id);assert.equal(evaluation.output_manifest.jobId,job.id);assert.equal(other.output_manifest.jobId,second.job.id);
   const requests=h.captured.filter(c=>c.body.stream===false&&!c.body.response_format);assert.equal(requests.length,2);
   assert.ok(requests.every(r=>r.body.messages[0].content.includes('EVALUATION MODE (oferta.md)')&&r.body.messages[0].content.includes('article-digest.md')));
   assert.equal((await h.sql('SELECT id FROM applications WHERE workspace_id=$1',[h.c.workspaceId])).rowCount,2);
  });
  await t.test('real retained PDF binds reviewed facts and exact report hashes; untailored fallback is never implicitly approved',async()=>{
   const v=await view();app=v.applications.find(a=>a.id===app.id);
   const work=await call('packets','build_packet',{applicationId:app.id,evaluationId:evaluation.id,expectedApplicationRevision:app.revision,facts:facts.map(f=>({id:f.id,revision:f.revision})),tailoredSelection:false});
   const state=await until(async()=>{const v=await view(),workState=v.work.find(w=>w.id===work.workId);return workState?.status==='completed'?v:null;});
   packet=state.packets.find(p=>p.id===work.workId);
   assert.ok(packet,JSON.stringify(state.work.find(w=>w.id===work.workId)));
   assert.equal(packet.status,'draft');assert.equal(packet.untailored,true);
   const pdf=await h.request(h.a,'/api/artifacts/'+packet.pdf_artifact_id),bytes=Buffer.from(await pdf.arrayBuffer());
   assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1000);
   const p={packetId:packet.id,expectedRevision:1,contentHash:packet.content_hash,confirmed:true,reason:'Reviewed exact synthetic report, PDF and evidence.',duplicateReviewed:true};
   await call('packets','approve_packet',p,409);
   const id=crypto.randomUUID(),approved=await call('packets','approve_packet',{...p,confirmedUntailored:true},200,id);assert.equal(approved.status,'approved');
   assert.equal((await call('packets','approve_packet',{...p,confirmedUntailored:true},200,id)).id,packet.id);
   packet=(await view()).packets.find(p=>p.id===packet.id);assert.equal(packet.status,'approved');
  });
  await t.test('assistance, reviewed/filled and submitted remain separate; manual outcome carries exact score/tier/artifacts',async()=>{
   app=(await view()).applications.find(a=>a.id===app.id);
   await call('applications','mark_started',{applicationId:app.id,expectedRevision:app.revision,packetId:packet.id,reason:'User started a visible manual application.'});
   app=(await view()).applications.find(a=>a.id===app.id);assert.equal(app.workflow,'assist_running');assert.equal(app.outcome,'not_submitted');assert.equal(app.filled_at,null);
   await call('applications','mark_reviewed',{applicationId:app.id,expectedRevision:app.revision,packetId:packet.id,reason:'User reviewed a manually filled form.',filledManually:true});
   app=(await view()).applications.find(a=>a.id===app.id);assert.equal(app.workflow,'review_ready');assert.ok(app.filled_at);assert.equal(app.outcome,'not_submitted');
   const sent=await call('applications','record_submission',{applicationId:app.id,expectedRevision:app.revision,packetId:packet.id,external:false,confirmed:true,duplicateReviewed:true,reason:'User declares the final application was submitted manually.'});
   assert.equal(sent.snapshot.score,4.6);assert.equal(sent.snapshot.tier,'T3');assert.equal(sent.snapshot.packet.pdfHash,packet.pdf_hash);assert.equal(sent.snapshot.finalSubmissionAutomation,'not_implemented');
  });
  await t.test('malformed/identity-crossed reports remain review-required with null scores and no unrelated deletion',async()=>{
   for(const [score,extra]of[['4.6oops',''],['4.6','[wrong_identity]']]){
    const entry=await create(crypto.randomUUID(),score,extra),e=await call('evaluations','start_evaluation',{jobId:entry.job.id,expectedJobRevision:1,expectedCandidateRevision:candidate.revision});
    const row=await until(async()=>{const v=await view(),e2=v.evaluations.find(x=>x.id===e.id);return e2&&!['queued','running'].includes(e2.status)?e2:null;});
    assert.equal(row.status,'review_required');assert.equal(row.score,null);assert.equal(row.tier,null);
   }
   assert.equal((await h.request(h.a,'/api/artifacts/'+packet.pdf_artifact_id)).status,200);
  });
  await t.test('external manual submission needs no prepared packet, is scoped and keeps unknown score unknown',async()=>{
   const entry=await create('external'),v=await view();assert.ok(v.duplicates[entry.app.id].warning);
   const out=await call('applications','record_submission',{applicationId:entry.app.id,expectedRevision:entry.app.revision,external:true,confirmed:true,duplicateReviewed:true,reason:'Actual application completed outside the assistant.'});
   assert.equal(out.snapshot.score,null);assert.equal(out.snapshot.tier,null);assert.equal(out.snapshot.packet,null);
   const denied=await h.request(h.b,'/api/applications/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'record_outcome',payload:{applicationId:app.id,expectedRevision:1,outcome:'offer',reason:'Not authorized'}}});assert.equal(denied.status,404);
  });
  await t.test('a real killed evaluation worker retries with a new lease and only its own report artifact',async()=>{
   while(workers.length)await h.stopWorker(workers.pop());
   const entry=await create('worker-retry','4.6','[slow_evaluation]'),e=await call('evaluations','start_evaluation',{jobId:entry.job.id,expectedJobRevision:1,expectedCandidateRevision:candidate.revision});
   const firstWorker=await h.startWorker();workers.push(firstWorker);
   await until(()=>h.captured.some(c=>c.body.stream===false&&JSON.stringify(c.body).includes(entry.job.id)));
   const first=(await h.sql('SELECT lease_token FROM work_items WHERE workspace_id=$1 AND id=$2',[h.c.workspaceId,e.workId])).rows[0];
   await h.stopWorker(workers.pop());await h.sql("UPDATE work_items SET lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND id=$2 AND status='leased'",[h.c.workspaceId,e.workId]);
   workers.push(await h.startWorker());
   const row=await until(async()=>{const row=(await view()).evaluations.find(x=>x.id===e.id);return row?.status==='completed'?row:null;});
   assert.notEqual(row.output_manifest.invocation,first.lease_token);assert.equal(row.output_manifest.jobId,entry.job.id);
   assert.equal((await h.sql('SELECT attempts FROM work_items WHERE workspace_id=$1 AND id=$2',[h.c.workspaceId,e.workId])).rows[0].attempts,2);
   assert.equal((await h.sql('SELECT count(*) FROM artifacts WHERE workspace_id=$1 AND job_id=$2',[h.c.workspaceId,entry.job.id])).rows[0].count,'1');
   assert.equal((await h.sql('SELECT count(*) FROM applications WHERE workspace_id=$1 AND job_id=$2',[h.c.workspaceId,entry.job.id])).rows[0].count,'1');
  });
  await t.test('same-opening duplicate submissions need explicit review and never merge distinct records',async()=>{
   const entry=await create('opening-one'),v=await view();assert.equal(v.duplicates[entry.app.id].risk,'same_opening');
   const payload={applicationId:entry.app.id,expectedRevision:entry.app.revision,external:true,confirmed:true,reason:'Explicitly reviewed actual reapplication to the same opening.'};
   await call('applications','record_submission',payload,409);
   const recorded=await call('applications','record_submission',{...payload,duplicateReviewed:true});assert.equal(recorded.snapshot.duplicateRisk,'same_opening');
   assert.notEqual(recorded.id,app.id);assert.equal((await view()).applications.find(a=>a.id===app.id).outcome,'submitted');
  });
  await t.test('T0 cannot approve; T1 requires a revocable strategic override and archived packets are held',async()=>{
   for(const score of ['3.2','3.7']){
    const entry=await create('tier-'+score,score),e=await call('evaluations','start_evaluation',{jobId:entry.job.id,expectedJobRevision:1,expectedCandidateRevision:candidate.revision});
    await until(async()=>{const row=(await view()).evaluations.find(x=>x.id===e.id);return row?.status==='completed';});
    let a=(await view()).applications.find(x=>x.id===entry.app.id);
    const work=await call('packets','build_packet',{applicationId:a.id,evaluationId:e.id,expectedApplicationRevision:a.revision,facts:facts.map(f=>({id:f.id,revision:f.revision})),tailoredSelection:true});
    const p=await until(async()=>{const v=await view(),p=v.packets.find(p=>p.id===work.workId);return p||null;});
    const approval={packetId:p.id,expectedRevision:p.revision,contentHash:p.content_hash,confirmed:true,duplicateReviewed:true,reason:'Reviewed exact tier-bound packet.'};
    await call('packets','approve_packet',approval,409);
    if(score==='3.7'){
     await call('applications','strategic_override',{applicationId:a.id,evaluationId:e.id,expectedRevision:a.revision,reason:'Explicit strategic connection, not a replacement fit score.'});
     await call('packets','approve_packet',approval);
     a=(await view()).applications.find(x=>x.id===a.id);
     await call('applications','revoke_override',{applicationId:a.id,evaluationId:e.id,expectedRevision:a.revision,reason:'Withdraw this strategic override.'});
     a=(await view()).applications.find(x=>x.id===a.id);
     await call('applications','mark_started',{applicationId:a.id,expectedRevision:a.revision,packetId:p.id,reason:'Revoked packet must not authorize assistance.'},409);
    }
   }
   const entry=await create('archived'),e=await call('evaluations','start_evaluation',{jobId:entry.job.id,expectedJobRevision:1,expectedCandidateRevision:candidate.revision});
   await until(async()=>(await view()).evaluations.find(x=>x.id===e.id)?.status==='completed');
   const a=(await view()).applications.find(x=>x.id===entry.app.id);
   assert.equal((await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'set_intent_status',payload:{applicationId:a.id,expectedRevision:a.revision,status:'archived'}}})).status,200);
   await call('packets','build_packet',{applicationId:a.id,evaluationId:e.id,expectedApplicationRevision:a.revision+1,facts:facts.map(f=>({id:f.id,revision:f.revision}))},409);
  });
  await t.test('manual posting repair is attributable, while distinct URLs cannot overwrite an opening',async()=>{
   const entry=await create('repair');
   await call('applications','update_posting_details',{jobId:entry.job.id,expectedJobRevision:1,description:entry.job.description+' Additional exact posting text.',location:'Manassas, VA',url:entry.job.url,reason:'Owner corrected manually captured posting details.'});
   await call('applications','update_posting_details',{jobId:entry.job.id,expectedJobRevision:2,description:entry.job.description,location:'Reston, VA',url:'https://example.com/jobs/another-opening',reason:'Must not overwrite opening identity.'},409);
   assert.equal((await view()).applications.find(a=>a.id===entry.app.id).job_revision,2);
  });
  await t.test('agent queues the retained evaluator only on explicit UUID requests and reads the same IDs',async()=>{
   const entry=await create('agent');
   const c=await(await h.request(h.a,'/api/conversations',{method:'POST',body:{commandId:crypto.randomUUID(),title:'Application proof'}})).json();
   const chat=async text=>streamResult(await h.request(h.a,'/api/conversations/'+c.conversation.id+'/messages',{method:'POST',body:{commandId:crypto.randomUUID(),text}}));
   let events=await chat('[case:application-unrequested] '+entry.job.id+' rev 1 candidate '+candidate.revision);
   assert.ok(events.filter(e=>e.event==='delta').map(e=>e.data.text).join('').includes('explicit_request_required'));
   assert.equal((await view()).evaluations.some(e=>e.job_id===entry.job.id),false);
   events=await chat('[case:application-evaluate] evaluate '+entry.job.id+' rev 1 candidate '+candidate.revision);assert.ok(events.some(e=>e.event==='done'));
   await until(async()=>(await view()).evaluations.find(e=>e.job_id===entry.job.id)?.status==='completed');
   events=await chat('[case:application-read] Show application progress.');
   const text=events.filter(e=>e.event==='delta').map(e=>e.data.text).join('');
   assert.ok(text.includes(entry.app.id)&&text.includes(entry.job.id)&&text.includes('T3'),JSON.stringify(events));
  });
  await t.test('protected recovery restores exact real PDF bytes, evaluation score and submission snapshots',async()=>{
   const backup=await backupWorkspace(h.c),recovery=await restoreWorkspace(h.c,backup.backupId),name=recovery.recoveryDatabase;
   const restored=(await h.sql('SELECT submitted_snapshot FROM applications WHERE id=$1',[app.id],name)).rows[0];
   assert.equal(restored.submitted_snapshot.packet.pdfHash,packet.pdf_hash);assert.equal(restored.submitted_snapshot.score,4.6);
   const file=(await h.sql('SELECT storage_key,content_hash FROM artifacts WHERE id=$1',[packet.pdf_artifact_id],name)).rows[0];
   const bytes=fs.readFileSync(path.join(h.root,'recoveries',name,'artifacts',file.storage_key));
   assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),packet.pdf_hash);
  });
  await t.test('correction invalidates pending/approved material without changing submitted action history',async()=>{
   const old=(await view()).applications.find(a=>a.id===app.id).submitted_snapshot;
   const entry=await create('slow','4.6','[slow_evaluation]'),e=await call('evaluations','start_evaluation',{jobId:entry.job.id,expectedJobRevision:1,expectedCandidateRevision:candidate.revision});
   await until(async()=>(await view()).evaluations.find(x=>x.id===e.id)?.status==='running');
   await call('candidate','manual_fact',{fieldKey:'projects.summary',value:'Corrected exact customer integration evidence.',expectedFactRevision:1,modelConsent:true,reason:'Correction after packet approval and during another invocation.'});
   const v=await view();assert.ok(v.packets.filter(p=>p.status==='approved').length===0);assert.equal(v.evaluations.find(x=>x.id===e.id).status,'stale');
   assert.deepEqual(v.applications.find(a=>a.id===app.id).submitted_snapshot,old);
   assert.equal((await h.request(h.a,'/api/artifacts/'+packet.pdf_artifact_id)).status,200);
   const source=(await(await h.request(h.a,'/api/candidate')).json()).sources.find(s=>s.id===facts.find(f=>f.field_key==='projects.summary').source_id);
   if(source)await call('candidate','delete_source',{sourceId:source.id,expectedRevision:source.revision,reason:'Erase obsolete source-derived material.'});
   assert.equal((await h.request(h.a,'/api/artifacts/'+packet.pdf_artifact_id)).status,200);
  });
  await t.test('older applications have bounded pages and exact scoped deep-link history',async()=>{
   await h.sql("INSERT INTO jobs(id,workspace_id,company,title,description) SELECT gen_random_uuid(),$1,'Pagination fixture','Role '||n,'Synthetic page coverage only' FROM generate_series(1,51)n",[h.c.workspaceId]);
   await h.sql("INSERT INTO applications(id,workspace_id,job_id) SELECT gen_random_uuid(),workspace_id,id FROM jobs WHERE workspace_id=$1 AND company='Pagination fixture'",[h.c.workspaceId]);
   let v=await view();assert.equal(v.applications.length,50);assert.equal(v.nextOffset,50);
   v=await(await h.request(h.a,'/api/applications?application='+app.id)).json();assert.ok(v.applications.some(a=>a.id===app.id&&a.outcome==='submitted'));assert.ok(v.actions.some(a=>a.application_id===app.id&&a.event_type==='submission_recorded'));
   v=await(await h.request(h.a,'/api/applications?offset=50')).json();assert.ok(v.applications.length>0);assert.equal(v.nextOffset,null);
   v=await(await h.request(h.b,'/api/applications?application='+app.id)).json();assert.equal(v.applications.some(a=>a.id===app.id),false);
  });
  await t.test('abandoned private invocation cleanup preserves active leases and unknown files',async()=>{
   const root=path.join(h.root,'application-work'),old=path.join(root,crypto.randomUUID(),crypto.randomUUID()),activeToken=crypto.randomUUID(),active=path.join(root,crypto.randomUUID(),activeToken),when=new Date(Date.now()-2*86400000);
   for(const dir of [old,active]){fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'report.md'),'Synthetic private temporary output');fs.utimesSync(dir,when,when);}
   fs.writeFileSync(path.join(root,'unknown-preserved.txt'),'Unknown files require manual review.');
   await h.sql("INSERT INTO work_items(id,workspace_id,kind,dedupe_key,input,status,lease_token,lease_owner,lease_until) VALUES($1,$2,'evaluate_job',$3,'{}','leased',$4,'fixture-cleanup',now()+interval '5 minutes')",[crypto.randomUUID(),h.c.workspaceId,crypto.randomUUID(),activeToken]);
   const code="import {expireApplicationWork} from './src/server/private-artifacts.ts';import {database} from './src/server/db.ts';console.log(JSON.stringify(await expireApplicationWork()));await database().end();";
   const r=spawnSync(process.execPath,['--import','tsx','--input-type=module','-e',code],{cwd:process.cwd(),env:{...process.env,MAXIM_RUNTIME_FILE:h.runtime},encoding:'utf8',windowsHide:true,timeout:20000});
   assert.equal(r.status,0,r.stderr);assert.equal(fs.existsSync(old),false);assert.equal(fs.existsSync(active),true);assert.equal(fs.existsSync(path.join(root,'unknown-preserved.txt')),true);
  });
 }finally{await h.close();}
});
