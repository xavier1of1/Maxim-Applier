import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {waitDatabase} from '../../scripts/environment.mjs';
import {interviewHarness} from '../support/interview-harness.mjs';
const id=()=>crypto.randomUUID();

test('S10 real isolated interview commands, worker, revision fencing and erasure',{timeout:240000},async t=>{
 const h=await interviewHarness({api:'responses'});t.after(()=>h.close());
 const json=async(auth,path,options={})=>{const r=await h.request(auth,path,options);return {status:r.status,...await r.json()};};
 const cmd=(action,payload,commandId=id(),auth=h.a)=>json(auth,'/api/interview/commands',{method:'POST',body:{commandId,action,payload}});
 const view=(sessionId,auth=h.a)=>json(auth,'/api/interview?job='+h.job.id+(sessionId?'&session='+sessionId:''));
 const start=async(extra={})=>{
  const j=(await h.sql('SELECT revision FROM jobs WHERE id=$1',[h.job.id])).rows[0];
  const c=(await h.sql('SELECT revision FROM candidates WHERE workspace_id=$1',[h.c.workspaceId])).rows[0];
  const r=await cmd('start_session',{jobId:h.job.id,expectedJobRevision:j.revision,expectedCandidateRevision:c.revision,mode:'project_defense',...extra});
  assert.equal(r.status,200,JSON.stringify(r));return r.result;
 };
 const save=async(s,text='I built a synthetic queue processor. We served 99 million users.',extra={})=>{
  const v=await view(s.id);assert.equal(v.status,200,JSON.stringify(v));
  const r=await cmd('save_attempt',{sessionId:s.id,expectedRevision:v.session.revision,text,hypothetical:false,...extra});assert.equal(r.status,200,JSON.stringify(r));return r.result;
 };
 let session,attempt;
 await t.test('agent starts the same service only for the exact live user request; returns no transcript',async()=>{
  const {interviewTool}=await import('../../src/server/interview/agent.ts');
  const conversation=id(),run=id(),auth=(await h.sql('SELECT id,csrf_token FROM sessions WHERE workspace_id=$1',[h.c.workspaceId])).rows[0];
  const ctx={workspaceId:h.c.workspaceId,sessionId:auth.id,csrfToken:auth.csrf_token,isOwner:true};
  const quote='Practice project defense for '+h.job.id;
  await h.sql("INSERT INTO conversations(id,workspace_id,title) VALUES($1,$2,'Synthetic practice request')",[conversation,h.c.workspaceId]);
  await h.sql("INSERT INTO runs(id,workspace_id,conversation_id,payload_hash,status) VALUES($1,$2,$3,'synthetic','running')",[run,h.c.workspaceId,conversation]);
  await h.sql("INSERT INTO messages(id,workspace_id,conversation_id,run_id,role,content) VALUES($1,$2,$3,$4,'user',$5)",[id(),h.c.workspaceId,conversation,run,JSON.stringify({text:quote})]);
  const args={jobId:h.job.id,expectedJobRevision:1,expectedCandidateRevision:1,mode:'project_defense',quote};
  await assert.rejects(()=>interviewTool(ctx,run,'start_interview_practice',{...args,quote:'Fabricated request '+h.job.id}),e=>e.code==='explicit_request_required');
  const result=await interviewTool(ctx,run,'start_interview_practice',args);
  assert.equal(result.status,'active');assert.ok(result.url.includes(result.id));
  assert.equal((await interviewTool(ctx,run,'start_interview_practice',args)).id,result.id);
  const summary=await interviewTool(ctx,run,'read_interview_practice',{jobId:h.job.id});assert.ok(summary.sessions.some(s=>s.id===result.id));assert.ok(!JSON.stringify(summary).includes('queue processor'));
  await h.sql("UPDATE runs SET status='cancelled' WHERE id=$1",[run]);
  await assert.rejects(()=>interviewTool(ctx,run,'start_interview_practice',{...args,mode:'system_design'}),e=>e.code==='explicit_request_required');
 });
 await t.test('disclosable current evidence only; workspace/auth/origin/csrf and strict schema deny escalation',async()=>{
  for(const [field,sensitivity,consent,classification] of [['projects.private','private',true,'public'],['projects.no_consent','standard',false,'public'],['projects.restricted','standard',true,'restricted']]){
   const source=id();await h.sql("INSERT INTO candidate_sources(id,workspace_id,name,format,content_hash,classification,model_consent,status) VALUES($1,$2,'Synthetic withheld','manual',$3,$4,$5,'approved')",[source,h.c.workspaceId,source,classification,consent]);
   await h.sql('INSERT INTO candidate_facts(id,workspace_id,field_key,value,source_id,source_revision,sensitivity) VALUES($1,$2,$3,$4,$5,1,$6)',[id(),h.c.workspaceId,field,JSON.stringify('WITHHELD_SYNTHETIC_'+field),source,sensitivity]);
  }
  session=await start({communityIntel:'Community suggests discussing queues. This is not verified.'});
  const v=await view(session.id);assert.equal(v.session.snapshot.facts.length,1);
  assert.equal(v.session.snapshot.facts[0].id,h.fact.id);assert.equal(v.session.snapshot.facts[0].source_revision,1);
  assert.match(v.session.snapshot.communityIntel.label,/Unverified/);
  assert.equal((await view(session.id,h.b)).status,404);
  assert.deepEqual((await json(h.b,'/api/interview')).sessions,[]);
  assert.equal((await json(null,'/api/interview')).status,401);
  const body={commandId:id(),action:'delete_session',payload:{sessionId:session.id,expectedRevision:1}};
  assert.equal((await json(h.a,'/api/interview/commands',{method:'POST',headers:{Origin:'https://untrusted.example'},body})).status,403);
  assert.equal((await json(h.a,'/api/interview/commands',{method:'POST',headers:{'x-csrf-token':'wrong'},body})).status,403);
  assert.equal((await cmd('approve_fact',{sessionId:session.id})).status,400);
  assert.equal((await cmd('save_attempt',{sessionId:session.id,expectedRevision:1,text:'Attempt',hypothetical:false,requestFeedback:true,modelConsent:false})).error.code,'model_consent_required');
  assert.equal((await cmd('save_attempt',{sessionId:session.id,expectedRevision:1,text:'Attempt',hypothetical:false,executeCode:true})).status,400);
 });
 await t.test('payload-bound idempotency, rollback and revision checks preserve one attempt',async()=>{
  const key=id(),payload={sessionId:session.id,expectedRevision:1,text:'Synthetic replay attempt.',hypothetical:false};
  const r=await cmd('save_attempt',payload,key);assert.equal(r.status,200);
  assert.deepEqual((await cmd('save_attempt',payload,key)).result,r.result);
  assert.equal((await cmd('save_attempt',{...payload,text:'Changed replay'},key)).status,409);
  assert.equal((await cmd('save_attempt',payload)).error.code,'revision_conflict');
  assert.equal((await view(session.id)).attempts.length,1);
  await h.sql("CREATE FUNCTION reject_interview_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='interview_attempt_saved' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$");
  await h.sql('CREATE TRIGGER reject_interview_event BEFORE INSERT ON events FOR EACH ROW EXECUTE FUNCTION reject_interview_event()');
  try{assert.equal((await cmd('save_attempt',{...payload,expectedRevision:2})).status,503);}finally{await h.sql('DROP TRIGGER reject_interview_event ON events');await h.sql('DROP FUNCTION reject_interview_event()');}
  assert.equal((await view(session.id)).attempts.length,1);
 });
 await t.test('real bounded fixture request, local/provider accounting, no truth promotion and restart persistence',async()=>{
  const before=(await h.sql('SELECT * FROM candidate_facts ORDER BY id')).rows;
  attempt=await save(session,undefined,{requestFeedback:true,modelConsent:true});
  assert.equal(attempt.status,'queued');await h.work();
  const v=await view(session.id),a=v.attempts.find(a=>a.id===attempt.attemptId);
  assert.equal(a.status,'completed');assert.equal(a.feedback.observations[0].assessment,'needs_evidence');
  assert.match(a.local_checks.join(' '),/Unsupported numeric claim/);
  assert.equal(a.accounting.exactProviderBilling,false);assert.equal(a.accounting.outputReserve,1024);assert.equal(a.usage.prompt_tokens,120);
  assert.ok(a.accounting.requestBytes<=32000);assert.ok(a.accounting.estimatedInputTokens+a.accounting.outputReserve<=8192);
  const request=h.captured.at(-1),input=JSON.parse(request.messages.at(-1).content);
  assert.equal(input.context.role.id,h.job.id);assert.equal(input.context.facts[0].source_revision,1);
  assert.equal(request.store,false);assert.equal(request.tools,undefined);
  assert.ok(!JSON.stringify(request).includes('WITHHELD_SYNTHETIC_'));
  assert.deepEqual((await h.sql('SELECT * FROM candidate_facts ORDER BY id')).rows,before);
  assert.equal(Number((await h.sql('SELECT count(*) FROM answer_memory')).rows[0].count),0);
  await h.stopServer();execFileSync('docker',['restart',h.container],{stdio:'pipe',windowsHide:true,timeout:30000});await waitDatabase(h.c.databaseUrl);await h.startServer();
  const restored=await view(session.id);assert.equal(restored.session.id,v.session.id);assert.equal(restored.session.revision,v.session.revision);assert.deepEqual(restored.attempts,v.attempts);
 });
 await t.test('all modes persist; hypothetical output stays hypothetical and missing evidence asks rather than fabricates',async()=>{
  for(const mode of ['behavioral','system_design']){
   const s=await start({mode,facts:[]});await save(s,'Hypothetically I would support 99 million users.',{requestFeedback:true,modelConsent:true,hypothetical:true});await h.work();
   const v=await view(s.id);assert.equal(v.session.mode,mode);assert.equal(v.attempts[0].hypothetical,true);
   assert.equal(v.attempts[0].feedback.observations[0].assessment,'hypothetical');assert.match(v.attempts[0].local_checks.join(' '),/No approved disclosable evidence/);
  }
 });
 await t.test('unconfigured provider is useful but never a fake completed model run',async()=>{
  const model={...h.c.model},n=h.captured.length;h.configure({model:{...model,apiKey:''}});
  try{
   const s=await start();await save(s,'A synthetic draft without a provider.',{requestFeedback:true,modelConsent:true});
   const v=await view(s.id);assert.equal(v.modelConfigured,false);assert.equal(v.attempts[0].status,'model_unconfigured');assert.equal(v.attempts[0].feedback,null);assert.ok(v.session.snapshot.prompts.length>0);assert.equal(h.captured.length,n);
  }finally{h.configure({model});}
 });
 await t.test('local budget and malformed model IDs refuse before transmission; provider failures are explicit',async()=>{
  for(const update of [{contextBudget:100},{model:{...h.c.model,model:'Not an API ID'}}]){
   const old={model:{...h.c.model},contextBudget:h.c.contextBudget||8192};h.configure(update);
   try{const n=h.captured.length,s=await start();await save(s,'Synthetic bounded request.',{requestFeedback:true,modelConsent:true});await h.work();const a=(await view(s.id)).attempts[0];assert.equal(a.status,'failed');assert.ok(['context_budget_exceeded','invalid_model_id'].includes(a.error_code));assert.equal(h.captured.length,n);}finally{h.configure(old);}
  }
  for(const mode of ['reject','malformed','truncated','oversize']){
   h.setProviderMode(mode);const s=await start();await save(s,'Synthetic failure request.',{requestFeedback:true,modelConsent:true});await h.work();const a=(await view(s.id)).attempts[0];assert.equal(a.status,'failed',mode);assert.equal(a.feedback,null,mode);assert.ok(['model_rejected','model_invalid_response','model_interrupted','model_output_limit'].includes(a.error_code),JSON.stringify(a));
  }
  h.setProviderMode('normal');
 });
 await t.test('cancel aborts an in-flight request and source revocation suppresses late feedback',async()=>{
  h.setProviderMode('slow');const s=await start();await save(s,'Synthetic slow answer.',{requestFeedback:true,modelConsent:true});
  let n=h.captured.length,work=h.work();
  while(h.captured.length===n)await h.delay(20);
  let v=await view(s.id);assert.equal((await cmd('cancel_feedback',{sessionId:s.id,expectedRevision:v.session.revision,attemptId:v.attempts[0].id})).status,200);
  await work;v=await view(s.id);assert.equal(v.attempts[0].status,'cancelled');assert.equal(v.attempts[0].feedback,null);
  const revoked=await start();await save(revoked,'Synthetic source-derived attempt.',{requestFeedback:true,modelConsent:true});n=h.captured.length;work=h.work();while(h.captured.length===n)await h.delay(20);
  await h.sql('UPDATE candidate_sources SET model_consent=false,consent_revision=consent_revision+1 WHERE id=$1',[h.fact.source_id]);
  await work;const r=await view(revoked.id);assert.equal(r.session.status,'deleted');assert.deepEqual(r.session.snapshot,{});assert.equal(r.attempts[0].text,'');assert.equal(r.attempts[0].feedback,null);
  const replay=await cmd('request_feedback',{sessionId:r.session.id,expectedRevision:r.session.revision,attemptId:r.attempts[0].id,modelConsent:true});assert.equal(replay.error.code,'interview_stale');
  await h.sql('UPDATE candidate_sources SET model_consent=true,consent_revision=consent_revision+1 WHERE id=$1',[h.fact.source_id]);h.setProviderMode('normal');
 });
 await t.test('45 second provider deadline terminates a hung request within the worker renewal window',async()=>{
  h.setProviderMode('hang');const s=await start();await save(s,'Synthetic deadline request.',{requestFeedback:true,modelConsent:true});
  const before=Date.now();await h.work();const elapsed=Date.now()-before;
  const a=(await view(s.id)).attempts[0];assert.equal(a.status,'failed');assert.equal(a.error_code,'interview_timeout');assert.equal(a.feedback,null);
  assert.ok(elapsed>=44000&&elapsed<60000,'45 second deadline, observed '+elapsed+' ms');h.setProviderMode('normal');
 });
 await t.test('fact corrections and role revisions invalidate without reusing stale evidence',async()=>{
  const s=await start();await save(s);await h.sql('UPDATE candidate_facts SET revision=revision+1,value=$1 WHERE id=$2',[JSON.stringify('Corrected synthetic queue evidence.'),h.fact.id]);
  const v=await view(s.id);assert.equal(v.session.status,'stale');assert.deepEqual(v.session.snapshot,{});assert.equal(v.attempts[0].feedback,null);
  const r=await cmd('save_attempt',{sessionId:s.id,expectedRevision:v.session.revision,text:'Reuse old evidence',hypothetical:false});assert.equal(r.error.code,'interview_stale');
  const current=await start();assert.equal((await view(current.id)).session.snapshot.facts[0].revision,2);
  await h.sql('UPDATE jobs SET revision=revision+1 WHERE id=$1',[h.job.id]);assert.equal((await view(current.id)).session.status,'stale');
 });
 await t.test('lost lease and expired auth cannot publish or trigger a hidden provider retry',async()=>{
  const {claimWork}=await import('../../src/server/work.ts');
  const s=await start();await save(s,'Uncertain interrupted request.',{requestFeedback:true,modelConsent:true});
  const item=await claimWork('lost-interview-fixture',2);await h.sql("UPDATE work_items SET lease_until=now()-interval '1 second' WHERE id=$1",[item.id]);
  const n=h.captured.length,v=await view(s.id);assert.equal(v.attempts[0].status,'interrupted');assert.equal(await claimWork('second-fixture'),null);assert.equal(h.captured.length,n);
  const auth=await start();await save(auth,'Expired authorization request.',{requestFeedback:true,modelConsent:true});
  await h.sql("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE workspace_id=$1",[h.c.workspaceId]);
  try{await h.work();assert.equal(h.captured.length,n);}finally{await h.sql("UPDATE sessions SET expires_at=now()+interval '1 hour' WHERE workspace_id=$1",[h.c.workspaceId]);}
  assert.equal((await view(auth.id)).attempts[0].error_code,'authentication_required');
 });
 await t.test('private retention and deletion erase content; idempotency results contain no transcript copies',async()=>{
  const s=await start();await save(s,'ERASE_SYNTHETIC_PRACTICE');
  let v=await view(s.id);assert.equal((await cmd('delete_session',{sessionId:s.id,expectedRevision:v.session.revision})).status,200);
  v=await view(s.id);assert.deepEqual(v.session.snapshot,{});assert.equal(v.attempts[0].text,'');assert.deepEqual(v.attempts[0].local_checks,[]);
  const exp=await start();await save(exp,'EXPIRE_SYNTHETIC_PRACTICE');await h.sql("UPDATE interview_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",[exp.id]);
  const expired=await view(exp.id);assert.equal(expired.session.status,'deleted');assert.equal(expired.attempts[0].text,'');
  const source=await start();await save(source,'SOURCE_ERASE_SYNTHETIC');await h.sql("UPDATE candidate_sources SET deleted_at=now(),status='deleted',revision=revision+1 WHERE id=$1",[h.fact.source_id]);
  assert.equal((await view(source.id)).attempts[0].text,'');
  const results=(await h.sql('SELECT result FROM commands WHERE workspace_id=$1',[h.c.workspaceId])).rows;
  assert.ok(!JSON.stringify(results).includes('SYNTHETIC_PRACTICE'));assert.ok(!JSON.stringify(results).includes('queue processor'));
 });
});
