import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import pg from 'pg';
import {execFileSync} from 'node:child_process';
import {waitDatabase} from '../../scripts/environment.mjs';
import {harness,streamResult} from '../support/harness.mjs';
const id=()=>crypto.randomUUID();
test('S3 actual answer memory, scoped recall, correction and context accounting',{timeout:240000},async t=>{
 const h=await harness();t.after(()=>h.close());
 const json=async(auth,url,options={})=>{const r=await h.request(auth,url,options);return {status:r.status,...await r.json()};};
 const command=(action,payload,commandId=id(),auth=h.a)=>json(auth,'/api/answers/commands',{method:'POST',body:{commandId,action,payload}});
 const person=()=>json(h.a,'/api/candidate');
 const fact=async(fieldKey,value,expectedFactRevision=0,modelConsent=true)=>{
  const r=await json(h.a,'/api/candidate/commands',{method:'POST',body:{commandId:id(),action:'manual_fact',payload:{fieldKey,value,expectedFactRevision,modelConsent,reason:'Synthetic exact candidate declaration'}}});
  assert.equal(r.status,200,JSON.stringify(r));return r.result;
 };
 const qInput=(company='Alpha',extra={})=>({text:'Describe a customer project.',company,roleLane:'fde',...extra});
 const question=async(company='Alpha',extra={})=>{const r=await command('save_question',qInput(company,extra));assert.equal(r.status,200,JSON.stringify(r));return r.result;};
 const draft=async(q,text,extra={})=>{
  const r=await command('draft_answer',{questionId:q.id,text,expectedCandidateRevision:(await person()).candidate.revision,permission:'company',modelConsent:true,facts:[],...extra});
  assert.equal(r.status,200,JSON.stringify(r));return r.result;
 };
 const approve=async(a,commandId=id(),auth=h.a)=>command('approve_answer',{answerId:a.id,expectedRevision:a.revision,contentHash:a.content_hash,declarationConfirmed:true},commandId,auth);
 const recall=(company='Alpha',extra={},auth=h.a)=>json(auth,'/api/answers/recall',{method:'POST',body:qInput(company,extra)});
 const library=()=>json(h.a,'/api/answers');
 const conversation=async()=>{const r=await json(h.a,'/api/conversations',{method:'POST',body:{commandId:id()}});assert.equal(r.status,200);return r.conversation;};
 const chat=async(c,text)=>{const r=await h.request(h.a,'/api/conversations/'+c.id+'/messages',{method:'POST',body:{commandId:id(),text}});assert.equal(r.status,200);return streamResult(r);};
 let name,project,alpha,beta,qa,qb,qaDraft;
 await t.test('unknown stays unknown; typed facts precede stored answers and private boolean needs local consent',async()=>{
  name=await fact('candidate.name','Memory Example');
  project=await fact('projects.summary','Built a customer integration in Rust.');
  await fact('authorization.active_clearance',false,0,false);
  let state=await person();
  const prep=await json(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:id(),action:'prepare',expectedRevision:state.candidate.revision}});
  assert.equal(prep.status,200);
  assert.equal((await json(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:id(),action:'activate',transitionId:prep.result.id,expectedRevision:state.candidate.revision}})).status,200);
  assert.equal((await recall('Alpha',{text:'Are you a U.S. citizen?'})).reason,'missing_standard_fact');
  assert.equal((await recall('Alpha',{text:'Do you have an active security clearance?'})).reason,'explicit_private_review_required');
  const explicit=await recall('Alpha',{text:'Do you have an active security clearance?',includePrivate:true});
  assert.equal(explicit.candidates[0].value,false);
  const wrongQ=await question('Alpha',{text:'What is your full name?'}),wrong=await draft(wrongQ,'A wrong name typed as an answer');
  assert.equal((await approve(wrong)).status,200);
  const r=await recall('Alpha',{text:'What is your full name?'});
  assert.equal(r.state,'standard_fact');assert.equal(r.candidates[0].value,'Memory Example');assert.equal(r.candidates[0].revision,name.revision);
 });
 await t.test('drafts cannot fill; exact approval, payload binding, stale candidate and replay are enforced',async()=>{
  qa=await question('Alpha');qb=await question('Beta');
  assert.equal((await question('Alpha')).id,qa.id);
  qaDraft=await draft(qa,'Company Alpha project answer',{facts:[{id:project.id,revision:project.revision}]});
  assert.equal((await recall()).state,'ask_user');
  assert.equal((await command('approve_answer',{answerId:qaDraft.id,expectedRevision:qaDraft.revision,contentHash:'0'.repeat(64),declarationConfirmed:true})).status,409);
  await fact('skills.language','Rust');
  assert.equal((await approve(qaDraft)).status,409);
  qaDraft=await draft(qa,'Company Alpha project answer',{answerId:qaDraft.id,expectedRevision:qaDraft.revision,facts:[{id:project.id,revision:project.revision}]});
  const key=id(),r=await approve(qaDraft,key);assert.equal(r.status,200);alpha=r.result;
  assert.equal((await approve(qaDraft,key)).result.revision,alpha.revision);
  assert.equal((await approve(qaDraft)).status,409);
  assert.equal((await approve(qaDraft,id(),h.b)).status,404);
  assert.equal((await recall('Alpha',{},h.b)).candidates.length,0);
 });
 await t.test('company-first lookup precedes explicitly allowed same-candidate cross-company answers',async()=>{
  const d=await draft(qb,'Cross-company project answer',{permission:'cross_company',facts:[{id:project.id,revision:project.revision}]});
  const r=await approve(d);assert.equal(r.status,200);beta=r.result;
  assert.equal((await recall()).candidates[0].id,alpha.id);
  const cross=await recall('Gamma');assert.equal(cross.candidates[0].id,beta.id);assert.equal(cross.candidates[0].match,'explicit_cross_company');
  assert.equal((await recall('Gamma',{roleLane:'backend'})).state,'ask_user');
  assert.equal((await recall('Gamma',{text:'Describe a project in C++?'})).state,'ask_user');
  const conflict=await draft(qa,'Different approved Alpha answer');assert.equal((await approve(conflict)).status,200);
  assert.equal((await recall()).reason,'conflicting_approved_answers');
  const current=(await library()).answers.find(a=>a.id===conflict.id);
  assert.equal((await command('revoke_answer',{answerId:current.id,expectedRevision:current.revision,reason:'Resolve conflicting synthetic answer'})).status,200);
 });
 await t.test('sensitive, expired, history-only and undeclared model-disclosure answers are withheld',async()=>{
  for(const text of ['What salary do you expect?','When can you start?','Have you ever worked here?']){
   const q=await question('Alpha',{text});
   assert.equal((await command('draft_answer',{questionId:q.id,text:'Current company-specific declaration',expectedCandidateRevision:(await person()).candidate.revision,permission:'cross_company',modelConsent:false})).status,400);
   const d=await draft(q,'Current private declaration',{modelConsent:false,sensitiveConsent:false});
   assert.equal((await approve(d)).status,200);
   assert.equal((await recall('Alpha',{text})).candidates.length,0);
  }
  assert.equal((await recall('Alpha',{text:'I certify all information is accurate'})).reason,'manual_only_question');
  assert.equal((await recall('Alpha',{text:'Veteran status?'})).reason,'manual_only_question');
  assert.equal((await command('save_question',qInput('Alpha',{text:'What is your password?'}))).status,400);
  const privateQ=await question('Private',{text:'Describe a private plan.'}),privateDraft=await draft(privateQ,'Undisclosed standard answer',{modelConsent:false});
  assert.equal((await approve(privateDraft)).status,200);
  assert.equal((await recall('Private',{text:'Describe a private plan.'})).candidates.length,1);
  const c=await conversation(),n=h.captured.length;assert.ok((await chat(c,'[case:answer-private] Read any approved plan.')).some(e=>e.event==='done'));
  assert.ok(!JSON.stringify(h.captured.slice(n)).includes('Undisclosed standard answer'));
  const historyQ=await question('History'),history=await draft(historyQ,'History-only declaration',{permission:'never',modelConsent:false});assert.equal((await approve(history)).status,200);
  assert.ok(!(await recall('History')).candidates.some(a=>a.id===history.id));
 });
 await t.test('reuse is a review draft; changed facts invalidate future reuse but submitted snapshots stay immutable',async()=>{
  const prepared=await command('prepare_reuse',{answerId:alpha.id,expectedRevision:alpha.revision,questionId:qa.id});
  assert.equal(prepared.status,200,JSON.stringify(prepared));assert.equal(prepared.result.status,'draft');
  const use=prepared.result,confirm=await command('confirm_reuse',{useId:use.id,expectedRevision:use.revision,contentHash:use.snapshot.contentHash,reviewed:true});
  assert.equal(confirm.status,200);assert.equal(confirm.result.status,'confirmed');
  assert.equal((await command('delete_question',{questionId:qa.id,reason:'Do not orphan active reuse'})).status,409);
  const second=await command('prepare_reuse',{answerId:alpha.id,expectedRevision:alpha.revision,questionId:qa.id});assert.equal(second.status,200);
  await h.sql("UPDATE answer_uses SET status='submitted' WHERE id=$1",[use.id]);
  const historical=(await h.sql('SELECT snapshot FROM answer_uses WHERE id=$1',[use.id])).rows[0].snapshot;
  project=await fact('projects.summary','Corrected customer integration evidence.',project.revision);
  assert.equal((await library()).answers.find(a=>a.id===alpha.id).status,'invalidated');
  assert.equal((await recall()).state,'ask_user');
  assert.equal((await command('confirm_reuse',{useId:second.result.id,expectedRevision:second.result.revision,contentHash:second.result.snapshot.contentHash,reviewed:true})).status,409);
  assert.deepEqual((await h.sql('SELECT snapshot FROM answer_uses WHERE id=$1',[use.id])).rows[0].snapshot,historical);
  const stale=(await library()).answers.find(a=>a.id===alpha.id);
  const corrected=await draft(qa,'Corrected Alpha project answer',{answerId:alpha.id,expectedRevision:stale.revision,facts:[{id:project.id,revision:project.revision}]});
  alpha=(await approve(corrected)).result;assert.ok(alpha);
  assert.equal((await recall()).candidates[0].text,'Corrected Alpha project answer');
  assert.equal((await h.sql("SELECT snapshot->>'text' AS text FROM answer_versions WHERE answer_id=$1 AND revision=$2",[alpha.id,qaDraft.revision+1])).rows[0].text,'Company Alpha project answer');
 });
 await t.test('agent uses the same revision; local/provider usage is separated and self-approval is denied',async()=>{
  const c=await conversation(),before=h.captured.length;
  const events=await chat(c,'[case:answer-recall] Read my project answer.');
  assert.ok(events.some(e=>e.event==='done'));
  const saved=(await json(h.a,'/api/conversations/'+c.id));
  const tool=JSON.parse(saved.messages.find(m=>m.role==='tool').content.text);
  assert.equal(tool.candidates[0].id,alpha.id);assert.equal(tool.candidates[0].revision,alpha.revision);
  assert.ok(JSON.stringify(h.captured.slice(before)).includes('Corrected Alpha project answer'));
  const accounting=(await h.sql('SELECT context_accounting FROM runs WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 1',[c.id])).rows[0].context_accounting;
  assert.equal(accounting.length,2);assert.equal(accounting[0].counter,'@microsoft/tiktokenizer@1.0.10');assert.equal(accounting[0].exactProviderBilling,false);
  assert.ok(accounting[0].estimatedInputTokens>accounting[0].providerUsage?.prompt_tokens||!accounting[0].providerUsage);
  const forbidden=await conversation();assert.ok((await chat(forbidden,'[case:answer-self-confirm] '+alpha.id)).some(e=>e.event==='done'));
  assert.equal((await library()).answers.find(a=>a.id===alpha.id).status,'approved');
  const drafted=await conversation();assert.ok((await chat(drafted,'[case:answer-draft] I built a customer integration in Rust.')).some(e=>e.event==='done'));
  const a=(await library()).answers.find(a=>a.origin_run&&(a.text==='I built a customer integration in Rust.'));
  assert.equal(a.status,'draft');assert.equal(a.permission,'never');assert.equal(a.model_consent,false);
  await h.sql("UPDATE runs SET status='cancelled' WHERE id=$1",[a.origin_run]);
  assert.equal((await approve(a)).status,409,'cancelled model runs cannot become approved memory');
  const evidence=await conversation();
  assert.ok((await chat(evidence,'[case:answer-evidence] Draft from my reviewed project facts.')).some(e=>e.event==='done'));
  const extracted=(await library()).answers.find(a=>a.company==='evidence');
  assert.equal(extracted.status,'draft');assert.equal(extracted.permission,'never');assert.equal(extracted.facts.length,2);
  assert.ok(extracted.text.includes('Memory Example'));assert.ok(extracted.text.includes('Corrected customer integration evidence.'));
  await h.stopServer();
  execFileSync('docker',['restart',h.container],{stdio:'pipe',windowsHide:true,timeout:30000});
  await waitDatabase(h.c.databaseUrl);await h.startServer();
  assert.equal((await recall()).candidates[0].revision,alpha.revision);
 });
 await t.test('unsupported and deliberately small context policies refuse before transmission',async()=>{
  const original=fs.readFileSync(h.runtime);
  try{
   for(const update of [{contextBudget:100},{model:{...h.c.model,model:'unverified-model'}}]){
    fs.writeFileSync(h.runtime,JSON.stringify({...h.c,...update}));
    const c=await conversation(),n=h.captured.length,events=await chat(c,'Read my saved workspace.');
    assert.ok(events.some(e=>e.event==='error'&&['context_budget_exceeded','unsupported_tokenizer'].includes(e.data.code)));
    assert.equal(h.captured.length,n);
   }
  }finally{fs.writeFileSync(h.runtime,original);}
 });
 await t.test('revocation excludes old answer history; deletion/export/retention preserve only submitted history',async()=>{
  const c=await conversation();assert.ok((await chat(c,'[case:answer-recall] Read current answer.')).some(e=>e.event==='done'));
  const lock=new pg.Client({connectionString:h.c.databaseUrl});await lock.connect();
  await h.sql("CREATE FUNCTION fixture_block_tool() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.role='tool' THEN PERFORM pg_advisory_xact_lock(420039); END IF; RETURN NEW; END $$");
  await h.sql('CREATE TRIGGER fixture_block_tool BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION fixture_block_tool()');
  await lock.query('BEGIN');await lock.query('SELECT pg_advisory_xact_lock(420039)');
  const n=h.captured.length,pending=chat(c,'[case:answer-recall] Read current answer.');
  try{
   let blocked=false;
   for(let i=0;i<100;i++){
    if(Number((await h.sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event='advisory' AND pid<>$1",[lock.processID])).rows[0].count)>0){blocked=true;break;}
    await new Promise(r=>setTimeout(r,50));
   }
   assert.equal(blocked,true,'tool result reached the real publication barrier');
   assert.equal((await command('revoke_answer',{answerId:alpha.id,expectedRevision:alpha.revision,reason:'Withdraw during in-flight tool publication'})).status,200);
  }finally{await lock.query('ROLLBACK');await lock.end();await h.sql('DROP TRIGGER fixture_block_tool ON messages');await h.sql('DROP FUNCTION fixture_block_tool()');}
  assert.ok((await pending).some(e=>e.event==='error'&&e.data.code==='cancelled'));
  assert.equal(h.captured.length-n,1,'revoked evidence never enters the next model request');
  await chat(c,'[case:answer-recall] Read current answer.');
  assert.ok(!JSON.stringify(h.captured.at(-1).body).includes('Corrected Alpha project answer'));
  const row=(await library()).answers.find(a=>a.id===alpha.id);
  assert.equal((await command('delete_answer',{answerId:row.id,expectedRevision:row.revision,reason:'Delete synthetic answer'})).status,200);
  const exported=await json(h.a,'/api/answers/export');
  assert.ok(!JSON.stringify(exported.answers).includes('Corrected Alpha project answer'));
  assert.ok(!JSON.stringify(exported.versions.filter(v=>v.answer_id===alpha.id)).includes('Company Alpha project answer'));
  assert.ok(exported.questions.find(q=>q.id===qa.id).context.roleLane,'other retained answers still own the shared question');
  const submitted=exported.uses.find(u=>u.answer_id===alpha.id&&u.status==='submitted');assert.equal(submitted.snapshot.text,'Company Alpha project answer');
  assert.ok(!JSON.stringify((await json(h.b,'/api/answers/export'))).includes('Company Alpha project answer'));
  const q=await question('Retention'),d=await draft(q,'Expire this synthetic declaration',{modelConsent:false}),a=(await approve(d)).result;
  await h.sql("UPDATE answer_memory SET expires_at=now()-interval '1 second' WHERE id=$1",[a.id]);
  assert.equal((await recall('Retention')).state,'ask_user');
  process.env.MAXIM_RUNTIME_FILE=h.runtime;
  const {expireAnswers}=await import('../../src/server/answer-retention.ts'),{database}=await import('../../src/server/db.ts');
  try{await expireAnswers();}finally{await database().end();delete process.env.MAXIM_RUNTIME_FILE;}
  assert.equal((await library()).answers.find(x=>x.id===a.id).status,'deleted');
 });
 await t.test('source erasure removes dependent answer copies but cannot broaden reuse to another identity',async()=>{
  const source=await fact('projects.erasure','Synthetic removable evidence');
  const q=await question('Erasure'),d=await draft(q,'Answer based on removable evidence',{facts:[{id:source.id,revision:source.revision}]}),a=(await approve(d)).result;
  const response=await json(h.a,'/api/candidate/commands',{method:'POST',body:{commandId:id(),action:'delete_source',payload:{sourceId:source.source_id,expectedRevision:1,reason:'Erase dependent synthetic source'}}});
  assert.equal(response.status,200,JSON.stringify(response));
  const exported=await json(h.a,'/api/answers/export');
  assert.equal(exported.answers.find(row=>row.id===a.id).status,'deleted');
  assert.deepEqual(exported.questions.find(row=>row.id===q.id).context,{});
  assert.ok(!JSON.stringify(exported.versions.filter(row=>row.answer_id===a.id)).includes('Answer based on removable evidence'));
  assert.equal((await recall('Erasure')).candidates.length,0);
 });
});

