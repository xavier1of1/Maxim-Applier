import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {harness,streamResult} from '../support/harness.mjs';
import {resumeText,pdfFixture,docxFixture} from '../support/documents.mjs';
import {delay,sha} from '../../scripts/environment.mjs';
import {backupWorkspace,restoreWorkspace} from '../../scripts/recovery.mjs';

const id=()=>crypto.randomUUID();
test('S2 reviewed onboarding, actual workers and candidate authority',{timeout:360000},async t=>{
 const h=await harness();
 process.env.MAXIM_RUNTIME_FILE=h.runtime;
 const {database,transaction}=await import('../../src/server/db.ts');
 const queue=await import('../../src/server/work.ts');
 const {extractSource,expireRawSources}=await import('../../src/worker/extraction.ts');
 t.after(async()=>{await database().end();await h.close();delete process.env.MAXIM_RUNTIME_FILE;});
 const json=async(auth,url,options={})=>{const r=await h.request(auth,url,options);return {status:r.status,...await r.json()};};
 const read=()=>json(h.a,'/api/candidate');
 const cmd=(action,payload,auth=h.a,commandId=id())=>json(auth,'/api/candidate/commands',{method:'POST',body:{commandId,action,payload}});
 const cut=(action,revision,transitionId,auth=h.a)=>json(auth,'/api/candidate/cutover',{method:'POST',body:{commandId:id(),action,expectedRevision:revision,...(transitionId?{transitionId}:{})}});
 const upload=async(name,bytes,consent=false,classification='personal')=>{
  const f=new FormData();f.set('commandId',id());f.set('file',new File([bytes],name));f.set('classification',classification);f.set('modelConsent',String(consent));f.set('retentionDays','30');
  return json(h.a,'/api/sources',{method:'POST',body:f});
 };
 const until=async(predicate,label)=>{
  for(let n=0;n<90;n++){const value=await predicate();if(value)return value;await delay(500);}
  assert.fail('Timed out: '+label);
 };
 const done=source=>until(async()=>{const r=await json(h.a,'/api/sources/'+source.id);return ['review_required','approved','failed'].includes(r.source.status)&&r.source;},'source extraction');
 const manual=(fieldKey,value,expectedFactRevision=0,modelConsent=false)=>cmd('manual_fact',{fieldKey,value,expectedFactRevision,modelConsent,reason:'Explicit synthetic candidate declaration'});
 const review=(p,decision='approve',revision=p.expected_fact_revision)=>cmd('review_fact',{proposalId:p.id,expectedRevision:p.revision,expectedFactRevision:revision,decision,reason:'Reviewed the exact synthetic source quotation'});
 let textSource,nameFact,worker;
 await t.test('uploads queue without approval; duplicate hashes preserve identity and disclosure',async()=>{
  const r=await upload('resume.txt',resumeText);assert.equal(r.status,200);textSource=r.source;
  assert.equal(textSource.status,'queued');assert.equal((await read()).facts.length,0);
  const duplicate=await upload('renamed.txt',resumeText,true);
  assert.equal(duplicate.source.id,textSource.id);assert.equal(duplicate.source.duplicate,true);
  assert.equal((await json(h.a,'/api/sources/'+textSource.id)).source.model_consent,false);
  assert.equal((await upload('private.txt','Internal use only',false,'restricted')).status,400);
  assert.equal((await upload('bad.exe','bad')).status,400);
  assert.equal((await h.request(h.b,'/api/sources/'+textSource.id)).status,404);
  assert.equal((await cmd('delete_source',{sourceId:textSource.id,expectedRevision:1,reason:'No access'},h.b)).status,404);
 });
 await t.test('two workers extract all four real formats once; restart preserves proposals',async()=>{
  const pdf=(await upload('resume.pdf',await pdfFixture())).source;
  const docx=(await upload('resume.docx',await docxFixture())).source;
  const md=(await upload('resume.md',resumeText+'\nMD fixture')).source;
  worker=await h.startWorker();const second=await h.startWorker();
  for(const s of [textSource,pdf,docx,md])assert.equal((await done(s)).status,'review_required');
  assert.equal((await read()).facts.length,0);
  const before=(await h.sql('SELECT id FROM fact_proposals WHERE source_id=$1 ORDER BY id',[textSource.id])).rows;
  await h.stopWorker(second);await h.stopWorker(worker);worker=await h.startWorker();
  assert.deepEqual((await h.sql('SELECT id FROM fact_proposals WHERE source_id=$1 ORDER BY id',[textSource.id])).rows,before);
  assert.equal((await h.sql("SELECT count(*) FROM work_items WHERE kind='extract_source' AND status='completed'")).rows[0].count,'4');
  assert.equal(h.captured.length,0);
 });
 await t.test('review rejects claims, confirms exact false, detects conflicts and stale writes',async()=>{
  const state=await read(),proposals=state.proposals.filter(p=>p.source_id===textSource.id);
  const p=proposals.find(p=>p.field_key==='candidate.name');
  const rejected=proposals.find(p=>p.field_key==='skills.languages');
  assert.equal((await review(rejected,'reject')).status,200);
  const r=await review(p);assert.equal(r.status,200);nameFact=r.result;
  const cleared=await review(proposals.find(p=>p.field_key==='authorization.active_clearance'));
  assert.equal(cleared.result.value,false);
  assert.equal((await manual('authorization.us_citizen','')).status,400);
  assert.equal((await manual('authorization.us_citizen',null)).status,400);
  const other=(await read()).proposals.find(p=>p.field_key==='candidate.name');
  assert.equal((await review(other,'approve',nameFact.revision)).status,409);
  const replaced=await review(other,'replace',nameFact.revision);
  assert.equal(replaced.status,200);assert.equal(replaced.result.revision,2);assert.equal(replaced.result.id,nameFact.id);nameFact=replaced.result;
  assert.equal((await manual('candidate.name','Stale',1)).status,409);
  const commandId=id(),payload={fieldKey:'preferences.roles',value:['Forward Deployed Engineer'],expectedFactRevision:0,modelConsent:true,reason:'Synthetic target-role confirmation'};
  const first=await cmd('manual_fact',payload,h.a,commandId);
  assert.equal((await cmd('manual_fact',payload,h.a,commandId)).result.id,first.result.id);
  assert.equal((await cmd('manual_fact',{...payload,value:['Different']},h.a,commandId)).status,409);
 });
 await t.test('denied and restricted text never reaches a model; consented interpretation only proposes',async()=>{
  const before=h.captured.length,restricted=(await upload('restricted.txt','Wabtec confidential internal engineering details',true)).source;
  assert.equal((await done(restricted)).status,'failed');assert.equal(h.captured.length,before);
  const consented=(await upload('allowed.txt',resumeText+'\nConsented synthetic source',true)).source;
  assert.equal((await done(consented)).status,'review_required');
  const calls=h.captured.slice(before);assert.equal(calls.length,1);
  const body=JSON.stringify(calls[0].body);assert.ok(!body.includes('alex.synthetic@example.org'));assert.ok(body.includes('[email withheld]'));
  assert.ok(!body.includes('confidential internal'));
  assert.equal((await read()).facts.some(f=>f.field_key==='experience.fixture'),false);
  assert.ok((await read()).proposals.some(p=>p.source_id===consented.id&&p.field_key==='experience.fixture'));
 });
 await t.test('lost leases and cancellation fence publication; expired lease is reclaimable',async()=>{
  await h.stopWorker(worker);
  const source=(await upload('lease.txt','candidate.name: Lease Example')).source;
  const first=await queue.claimWork('fixture-first',2);assert.equal(first.input.sourceId,source.id);
  await h.sql("UPDATE work_items SET lease_until=now()-interval '1 second' WHERE id=$1",[first.id]);
  const second=await queue.claimWork('fixture-second',45);assert.equal(second.id,first.id);assert.notEqual(second.lease_token,first.lease_token);
  await assert.rejects(()=>extractSource(first),e=>e.code==='lease_lost');
  await extractSource(second);
  assert.equal((await h.sql('SELECT count(*) FROM fact_proposals WHERE source_id=$1',[source.id])).rows[0].count,'1');
  const cancelled=(await upload('cancel.txt','candidate.name: Cancel Example')).source;
  const item=await queue.claimWork('fixture-cancel',45);
  assert.equal((await cmd('cancel_work',{workId:item.id})).result.cancelled,true);
  await assert.rejects(()=>extractSource(item),e=>e.code==='lease_lost');
  assert.equal((await h.sql('SELECT count(*) FROM fact_proposals WHERE source_id=$1',[cancelled.id])).rows[0].count,'0');
  assert.equal((await cmd('retry_source',{sourceId:cancelled.id,expectedRevision:1})).status,200);
  worker=await h.startWorker();assert.equal((await done(cancelled)).status,'review_required');
 });
 await t.test('crash while publication is blocked reclaims the real worker lease without duplicate proposals',async()=>{
  await h.stopWorker(worker);
  const source=(await upload('crash.txt','candidate.name: Crash Example')).source;
  const lock=await database().connect();await lock.query('BEGIN');
  await lock.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['candidate:'+h.c.workspaceId]);
  try{
   worker=await h.startWorker();
   await until(async()=>Number((await h.sql("SELECT count(*) FROM pg_stat_activity WHERE wait_event='advisory' AND pid<>$1",[lock.processID])).rows[0].count)>0,'worker parsed and waiting to publish');
   await h.stopWorker(worker);
  }finally{await lock.query('ROLLBACK');lock.release();}
  await h.sql("UPDATE work_items SET lease_until=now()-interval '1 second' WHERE input->>'sourceId'=$1 AND status='leased'",[source.id]);
  worker=await h.startWorker();assert.equal((await done(source)).status,'review_required');
  assert.equal((await h.sql('SELECT count(*) FROM fact_proposals WHERE source_id=$1',[source.id])).rows[0].count,'1');
  assert.equal((await h.sql("SELECT attempts FROM work_items WHERE input->>'sourceId'=$1",[source.id])).rows[0].attempts,2);
 });
 await t.test('native import is staging only; reviewed cutover, correction, refresh and rollback preserve edits',async()=>{
  const root=path.join(h.root,'native');fs.mkdirSync(path.join(root,'config'),{recursive:true});fs.mkdirSync(path.join(root,'modes'),{recursive:true});
  fs.writeFileSync(path.join(root,'cv.md'),'Legacy Example\ncandidate.name: Legacy Example');
  fs.writeFileSync(path.join(root,'config/profile.yml'),'candidate:\n  full_name: Legacy Example\n');
  fs.writeFileSync(path.join(root,'modes/_profile.md'),'Synthetic native overrides');
  fs.writeFileSync(path.join(root,'article-digest.md'),'Synthetic native evidence');
  const imported=await json(h.a,'/api/candidate/import-legacy',{method:'POST',body:{commandId:id()}});
  assert.equal(imported.sources.length,4);assert.equal(imported.approved,false);assert.equal(imported.ownershipChanged,false);
  assert.equal((await json(h.a,'/api/candidate/context')).sourceStatus,'staging_not_active');
  const current=(await read()).facts.find(f=>f.field_key==='candidate.name');
  const corrected=await manual('candidate.name','Approved Example',current.revision,true);assert.equal(corrected.status,200);
  let state=await read(),prepared=await cut('prepare',state.candidate.revision);assert.equal(prepared.status,200);
  assert.equal((await cut('activate',state.candidate.revision,prepared.result.id,h.b)).status,404);
  fs.appendFileSync(path.join(root,'cv.md'),'\nUnreconciled edit');
  assert.equal((await cut('activate',state.candidate.revision,prepared.result.id)).status,409);
  prepared=await cut('prepare',state.candidate.revision);
  const activation=await cut('activate',state.candidate.revision,prepared.result.id);assert.equal(activation.status,200,JSON.stringify(activation));
  let context=await json(h.a,'/api/candidate/context');
  assert.ok(context.facts.some(f=>f.value==='Approved Example'));assert.ok(!context.facts.some(f=>f.field_key==='authorization.active_clearance'));
  const {assertLegacyWriteAllowed,assertNativeCandidateCurrent}=await import('../../../../maxim/lib/authority-gate.mjs');
  assert.throws(()=>assertLegacyWriteAllowed('candidate',root),/canonical|workspace/i);
  await assertNativeCandidateCurrent(root);
  const original=fs.readFileSync(path.join(root,'cv.md'));
  fs.appendFileSync(path.join(root,'cv.md'),'\nUnapproved projection edit');
  await assert.rejects(()=>assertNativeCandidateCurrent(root),/projection changed/i);
  fs.writeFileSync(path.join(root,'cv.md'),original);
  const fact=(await read()).facts.find(f=>f.field_key==='candidate.name');
  const correction=await manual('candidate.name','Corrected Example',fact.revision,true);assert.equal(correction.status,200);
  assert.equal((await h.sql("SELECT status FROM candidate_contexts WHERE id=$1",[context.id])).rows[0].status,'invalidated');
  await until(()=>fs.readFileSync(path.join(root,'cv.md'),'utf8').includes('Corrected Example'),'projection refresh');
  const conv=(await json(h.a,'/api/conversations',{method:'POST',body:{commandId:id()}})).conversation;
  const chat=async()=>streamResult(await h.request(h.a,'/api/conversations/'+conv.id+'/messages',{method:'POST',body:{commandId:id(),text:'[case:candidate] Inspect approved candidate context.'}}));
  assert.ok((await chat()).some(e=>e.event==='done'));
  assert.ok(JSON.stringify(h.captured.at(-1).body).includes('Corrected Example'));
  assert.ok(!JSON.stringify(h.captured.at(-1).body).includes('alex.synthetic@example.org'));
  assert.equal((await cmd('source_consent',{sourceId:correction.result.source_id,expectedRevision:1,allow:false})).status,200);
  assert.ok((await chat()).some(e=>e.event==='done'));
  assert.ok(!JSON.stringify(h.captured.at(-1).body).includes('Corrected Example'),'revoked source absent even from previous chat turns');
  assert.equal((await cmd('source_consent',{sourceId:correction.result.source_id,expectedRevision:1,allow:true})).status,200);
  await until(()=>fs.readFileSync(path.join(root,'cv.md'),'utf8').includes('Corrected Example'),'consent projection refresh');
  state=await read();
  assert.equal((await cut('rollback',state.candidate.revision,prepared.result.id)).status,200);
  assert.equal((await read()).candidate.ownership,'legacy');
  assert.ok(fs.readFileSync(path.join(root,'cv.md'),'utf8').includes('Corrected Example'));
  const exported=JSON.parse(fs.readFileSync(path.join(h.root,'cutovers',prepared.result.id,'rollback-facts.json')));
  assert.ok(exported.facts.some(f=>f.value==='Corrected Example'));
  assert.doesNotThrow(()=>assertLegacyWriteAllowed('candidate',root));
 });
 await t.test('interrupted activation freezes native writes and recovers exact baseline; junction escape is refused',async()=>{
  const root=path.join(h.root,'native'),state=await read(),prepared=await cut('prepare',state.candidate.revision);
  assert.equal(prepared.status,200);
  const baseline=fs.readFileSync(path.join(root,'cv.md'));
  fs.copyFileSync(path.join(h.root,'cutovers',prepared.result.id,'projection','cv.md'),path.join(root,'cv.md'));
  fs.mkdirSync(path.join(root,'data/maxim'),{recursive:true});
  fs.writeFileSync(path.join(root,'data/maxim/authority.json'),JSON.stringify({candidate:'frozen',workspaceId:h.c.workspaceId,transitionId:prepared.result.id}));
  assert.equal((await cut('recover',state.candidate.revision,prepared.result.id)).status,200);
  assert.deepEqual(fs.readFileSync(path.join(root,'cv.md')),baseline);
  fs.renameSync(path.join(root,'config'),path.join(root,'config-saved'));
  const outside=path.join(h.root,'outside');fs.mkdirSync(outside);
  fs.symlinkSync(outside,path.join(root,'config'),'junction');
  try{assert.equal((await cut('prepare',state.candidate.revision)).status,400);assert.equal(fs.readdirSync(outside).length,0);}
  finally{fs.unlinkSync(path.join(root,'config'));fs.renameSync(path.join(root,'config-saved'),path.join(root,'config'));}
 });
 await t.test('agent proposes exact declarations, never approves; deletion erases dependent messages and private bytes',async()=>{
  const conv=(await json(h.a,'/api/conversations',{method:'POST',body:{commandId:id()}})).conversation;
  const response=await h.request(h.a,'/api/conversations/'+conv.id+'/messages',{method:'POST',body:{commandId:id(),text:'[case:fact] I live in Arlington, VA.'}});
  const events=await streamResult(response);assert.ok(events.some(e=>e.event==='done'));
  const proposal=(await read()).proposals.find(p=>p.field_key==='candidate.location');
  assert.ok(proposal);assert.equal((await read()).facts.some(f=>f.field_key==='candidate.location'),false);
  assert.equal((await review(proposal)).status,200);
  assert.equal((await cmd('delete_source',{sourceId:proposal.source_id,expectedRevision:1,reason:'Synthetic source erasure'})).status,200);
  const messages=(await json(h.a,'/api/conversations/'+conv.id)).messages;
  assert.ok(!JSON.stringify(messages).includes('Arlington, VA'));
  const row=(await h.sql('SELECT a.id,a.storage_key FROM artifacts a JOIN candidate_sources s ON s.artifact_id=a.id WHERE s.id=$1',[textSource.id])).rows[0];
  assert.equal((await h.request(h.b,'/api/artifacts/'+row.id)).status,404);
  assert.equal((await cmd('delete_source',{sourceId:textSource.id,expectedRevision:1,reason:'Delete synthetic resume'})).status,200);
  assert.equal((await h.request(h.a,'/api/artifacts/'+row.id)).status,404);
  await until(()=>!fs.existsSync(path.join(h.root,'artifacts',row.storage_key)),'physical erasure');
  assert.ok(!(await json(h.a,'/api/sources/'+textSource.id)).source.extracted_text);
 });
 await t.test('raw retention preserves confirmed truth, drops raw bytes/proposals; backup restores revisions',async()=>{
  await h.stopWorker(worker);
  const retained=await manual('projects.retained','Confirmed public synthetic project',0,true);
  await h.sql("UPDATE candidate_sources SET created_at=now()-interval '40 days' WHERE id=$1",[retained.result.source_id]);
  await expireRawSources();
  assert.equal((await json(h.a,'/api/sources/'+retained.result.source_id)).source.extracted_text,null);
  assert.ok((await read()).facts.some(f=>f.id===retained.result.id));
  const backup=await backupWorkspace(h.c),recovery=await restoreWorkspace(h.c,backup.backupId),restored=recovery.recoveryDatabase;
  assert.ok(recovery.cutoverFiles>0);
  const savedTransitions=(await h.sql("SELECT id FROM ownership_transitions WHERE family='candidate'")).rows;
  for(const item of savedTransitions)assert.deepEqual(
   fs.readFileSync(path.join(h.root,'recoveries',restored,'cutovers',item.id,'manifest.json')),
   fs.readFileSync(path.join(h.root,'cutovers',item.id,'manifest.json')));
  assert.equal((await h.sql('SELECT revision FROM candidate_facts WHERE id=$1',[retained.result.id],restored)).rows[0].revision,1);
  assert.equal((await h.sql('SELECT ownership FROM candidates WHERE workspace_id=$1',[h.c.workspaceId],restored)).rows[0].ownership,'legacy');
 });
});

