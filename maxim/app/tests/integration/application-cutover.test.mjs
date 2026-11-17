import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {harness,streamResult} from '../support/harness.mjs';
import {appDir,delay,waitDatabase} from '../../scripts/environment.mjs';
import {backupWorkspace,restoreWorkspace} from '../../scripts/recovery.mjs';

test('S5 lossless import, in-flight legacy edit, canonical restart and latest-state rollback',async t=>{
 const h=await harness(),native=path.join(h.root,'native'),repo=path.resolve(appDir,'../..');
 const request=async(endpoint,body,expected=200)=>{
  const r=await h.request(h.a,'/api/'+endpoint,{method:'POST',body:{commandId:crypto.randomUUID(),...body}}),v=await r.json();
  assert.equal(r.status,expected,JSON.stringify(v));return v.result||v;
 };
 const get=async endpoint=>await(await h.request(h.a,'/api/'+endpoint)).json();
 const authority=()=>get('applications/authority');
 const until=async fn=>{for(let i=0;i<150;i++){const v=await fn();if(v)return v;await delay(200);}throw Error('Canonical projection fixture timed out.');};
 let legacyChild,legacyDone,firstApp,transition,imp,revision,worker;
 try{
  await request('candidate/commands',{action:'manual_fact',payload:{fieldKey:'candidate.name',value:'Migration Example',expectedFactRevision:0,modelConsent:true,reason:'Synthetic migration prerequisite'}});
  const c=await get('candidate'),prep=await request('candidate/cutover',{action:'prepare',expectedRevision:c.candidate.revision});
  await request('candidate/cutover',{action:'activate',expectedRevision:c.candidate.revision,transitionId:prep.id});
  const job=await request('commands',{action:'create_job',payload:{company:'Legacy | Labs',title:'Software Engineer',location:'Reston, VA',description:'A full synthetic job description used only for explicit migration identity checks.',url:'https://example.com/jobs/one'}});
  firstApp=await request('commands',{action:'create_intent',payload:{jobId:job.id}});
  for(const d of ['data/maxim/events','reports','output'])fs.mkdirSync(path.join(native,d),{recursive:true});
  const markdown='| # | Date | Company | Role | Score | Status | PDF | Report | Notes | URL |\n|---|---|---|---|---|---|---|---|---|---|\n|001|2026-06-02|Legacy \\| Labs|Software Engineer|4.2/5|Evaluated|No|[001](reports/001-legacy.md)|Exact raw note|https://example.com/jobs/one|\n|002||Legacy \\| Labs|Software Engineer||Evaluated|No|-|Different source ID|https://example.com/jobs/two|\n';
  fs.writeFileSync(path.join(native,'data/applications.md'),markdown);
  fs.writeFileSync(path.join(native,'data/pipeline.md'),'- https://example.com/jobs/two\n');
  fs.writeFileSync(path.join(native,'reports/001-legacy.md'),'# Evaluation: Legacy | Labs - Software Engineer\n\n**Score:** 4.2/5\n**URL:** https://example.com/jobs/one\n**PDF:** output/001-legacy.pdf\n');
  fs.writeFileSync(path.join(native,'output/001-legacy.pdf'),Buffer.from('%PDF-1.7\nUnapproved raw historical bytes, not the real-PDF proof.\n'));
  fs.writeFileSync(path.join(native,'data/maxim/events/2026-06-02.jsonl'),'{"event_type":"legacy_fixture","payload":{"raw":"unchanged"}}\n');
  const dbfile=path.join(native,'data/maxim/maxim.db'),db=new DatabaseSync(dbfile);
  try{
   db.exec(fs.readFileSync(path.join(repo,'maxim/db/schema.sql'),'utf8'));
   db.exec("INSERT INTO applications(id,job_id,company,role,status,score,tier,report_path,pdf_path,job_url,applied_at,raw_payload_json,created_at,updated_at) VALUES('app_legacy','job_legacy','Legacy | Labs','Software Engineer','Applied',4.2,'T2','reports/001-legacy.md','output/001-legacy.pdf','https://example.com/jobs/one','2026-06-02','{\"custom\":\"exact\"}','2026-06-02','2026-06-02'); CREATE TABLE raw_values(id INTEGER,exact_integer INTEGER,bytes BLOB); INSERT INTO raw_values VALUES(1,9007199254740993,x'00ff'); INSERT INTO contacts(id,name,created_at,updated_at) VALUES('contact_original','Untouched Contact','2026-06-02','2026-06-02');");
  }finally{db.close();}
  const before=fs.readFileSync(dbfile);
  const captureAndReview=async()=>{
   imp=await request('legacy/commands',{action:'stage_native',payload:{confirmedLocalRead:true}});
   const v=await get('legacy'),records=v.records.filter(r=>r.import_id===imp.id);
   for(const row of records){
    const mapped=row.normalized.priorMap?.job_id,one=row.normalized.url==='https://example.com/jobs/one';
    const mode=row.normalized.kind==='pipeline'?'preserve_only':mapped||one?'link_existing':'new_opening';
    const r=await request('legacy/commands',{action:'resolve_record',payload:{recordId:row.id,importId:imp.id,expectedRevision:imp.revision,resolution:mode,...(mode==='link_existing'?{jobId:mapped||job.id}:{}),outcome:one?'submitted':'not_submitted',reason:'Reviewed exact source identity, raw status and historical artifacts.'}});
    imp.revision=r.revision;
   }
   return request('legacy/commands',{action:'commit_import',payload:{importId:imp.id,expectedRevision:imp.revision,contentHash:imp.contentHash,confirmed:true,acknowledgeRawIssues:true,reason:'Owner reviewed every mapping and raw-only record.'}});
  };
  await t.test('raw bytes/fields/SQLite types survive; source repeats preserve canonical S1 IDs',async()=>{
   await captureAndReview();
   const repeated=await request('legacy/commands',{action:'stage_native',payload:{confirmedLocalRead:true}});assert.equal(repeated.id,imp.id);
   const v=await get('applications');assert.equal(v.applications.length,2);assert.ok(v.applications.some(a=>a.id===firstApp.id&&a.outcome==='submitted'));assert.equal(v.packets.length,0);
   const exported=await get('legacy/export/'+imp.id);
   assert.equal(Buffer.from(exported.files.find(f=>f.path==='data/applications.md').base64,'base64').toString(),markdown);
   assert.equal(exported.sqlite.raw_values[0].exact_integer.sqliteInteger,'9007199254740993');assert.equal(exported.sqlite.raw_values[0].bytes.sqliteBlob,'AP8=');
   assert.deepEqual(fs.readFileSync(dbfile),before);
   const map=await h.sql('SELECT * FROM legacy_key_map WHERE workspace_id=$1',[h.c.workspaceId]);assert.equal(map.rowCount,3);
   assert.equal(new Set(map.rows.filter(r=>r.source_key.includes('001')||r.source_key.includes('app_legacy')).map(r=>r.application_id)).size,1);
  });
  await t.test('freeze waits for a real in-flight writer and never restores old bytes over its acknowledged edit',async()=>{
   let a=(await authority()).authority;
   transition=await request('applications/cutover',{action:'prepare',expectedRevision:a.revision,importId:imp.id,confirmed:true,reason:'Reviewed first projection.'});
   const gate=pathToFileURL(path.join(repo,'maxim/lib/application-write-gate.mjs')).href,target=path.join(native,'data/applications.md');
   const source="import fs from 'node:fs';import {withLegacyApplicationWrite} from "+JSON.stringify(gate)+";await withLegacyApplicationWrite(async()=>{console.log('lease-held');await new Promise(r=>setTimeout(r,1400));fs.appendFileSync("+JSON.stringify(target)+",'\\n<!-- acknowledged legacy edit -->\\n');console.log('edited');},"+JSON.stringify(native)+");";
   legacyChild=spawn(process.execPath,['--input-type=module','-e',source],{cwd:repo,stdio:['ignore','pipe','pipe'],windowsHide:true});let text='';
   legacyChild.stdout.on('data',b=>{text+=b;});legacyDone=new Promise(resolve=>legacyChild.once('close',resolve));
   await until(()=>text.includes('lease-held'));
   await request('applications/cutover',{action:'activate',expectedRevision:transition.revision,transitionId:transition.id,projectionHash:transition.manifest.projectionHash,confirmed:true,reason:'Test in-flight edit protection.'},409);
   await legacyDone;assert.ok(text.includes('edited'));assert.match(fs.readFileSync(target,'utf8'),/acknowledged legacy edit/);
   assert.equal((await authority()).marker.applications,'frozen');
   await request('applications/cutover',{action:'recover',expectedRevision:transition.revision,transitionId:transition.id,confirmed:true,reason:'Recover without overwriting the acknowledged edit.'});
   assert.match(fs.readFileSync(target,'utf8'),/acknowledged legacy edit/);assert.equal((await authority()).authority.owner,'legacy');
  });
  await t.test('reviewed switch gates native/SQLite writers and survives real web/database restart',async()=>{
   await captureAndReview();let a=(await authority()).authority;
   transition=await request('applications/cutover',{action:'prepare',expectedRevision:a.revision,importId:imp.id,confirmed:true,reason:'Reviewed refreshed exact source snapshot.'});
   const active=await request('applications/cutover',{action:'activate',expectedRevision:transition.revision,transitionId:transition.id,projectionHash:transition.manifest.projectionHash,confirmed:true,reason:'Activate reconciled canonical writer.'});
   assert.equal(active.publication.owner,'canonical');assert.equal((await authority()).marker.applications,'canonical');
   const state=JSON.parse(fs.readFileSync(path.join(native,'data/maxim/canonical-application-state.json'),'utf8'));assert.ok(state.applications.some(a=>a.id===firstApp.id));
   assert.deepEqual(fs.readFileSync(dbfile),before);
   for(const relative of ['merge-tracker.mjs','normalize-statuses.mjs','dedup-tracker.mjs','maxim/lib/authority-gate.mjs','maxim/lib/application-write-gate.mjs']){
    fs.mkdirSync(path.dirname(path.join(native,relative)),{recursive:true});fs.copyFileSync(path.join(repo,relative),path.join(native,relative));
   }
   for(const file of ['merge-tracker.mjs','normalize-statuses.mjs','dedup-tracker.mjs']){
    const r=spawnSync(process.execPath,[path.join(native,file)],{cwd:native,encoding:'utf8',timeout:10000,windowsHide:true});assert.notEqual(r.status,0);assert.match(r.stderr,/canonical/);
   }
   const go=spawnSync('go',['test','./internal/data','-run','TestCanonicalProjectionFixture','-count=1'],{cwd:path.join(repo,'dashboard'),env:{...process.env,MAXIM_TEST_NATIVE_ROOT:native},encoding:'utf8',timeout:60000,windowsHide:true});assert.equal(go.status,0,go.stdout+go.stderr);
   worker=await h.startWorker();
   let app=(await get('applications')).applications.find(a=>a.id===firstApp.id);
   await request('applications/commands',{action:'record_outcome',payload:{applicationId:app.id,expectedRevision:app.revision,outcome:'responded',reason:'Actual owner-declared response after migration.'}});
   await until(async()=>{const a=await authority();return a.marker.applicationRevision===a.authority.revision&&fs.readFileSync(path.join(native,'data/applications.md'),'utf8').includes('Responded');});
   await h.stopServer();spawnSync('docker',['restart',h.container],{stdio:'ignore',windowsHide:true,timeout:60000});await waitDatabase(h.c.databaseUrl);await h.startServer();
   app=(await get('applications')).applications.find(a=>a.id===firstApp.id);assert.equal(app.outcome,'responded');
   assert.equal((await authority()).authority.owner,'canonical');
   const afterRestart=spawnSync('go',['test','./internal/data','-run','TestCanonicalProjectionFixture','-count=1'],{cwd:path.join(repo,'dashboard'),env:{...process.env,MAXIM_TEST_NATIVE_ROOT:native,MAXIM_TEST_EXPECTED_APPLICATION:app.id,MAXIM_TEST_EXPECTED_STATUS:'Responded'},encoding:'utf8',timeout:60000,windowsHide:true});
   assert.equal(afterRestart.status,0,afterRestart.stdout+afterRestart.stderr);
   const conversation=await request('conversations',{title:'Canonical restart agreement'});
   const events=await streamResult(await h.request(h.a,'/api/conversations/'+conversation.conversation.id+'/messages',{method:'POST',body:{commandId:crypto.randomUUID(),text:'[case:application-read] Show current applications after restart.'}}));
   const text=events.filter(e=>e.event==='delta').map(e=>e.data.text).join('');
   assert.ok(text.includes(app.id)&&text.includes('responded'),JSON.stringify(events));
  });
  await t.test('post-commit projection corruption freezes native reads and explicit recovery publishes current DB state',async()=>{
   const module=await import(pathToFileURL(path.join(repo,'maxim/lib/canonical-application-read.mjs')).href),file=path.join(native,'data/maxim/canonical-application-state.json');
   assert.equal(module.readApplicationProjection(native).ownership,'canonical');
   fs.appendFileSync(file,' ');assert.throws(()=>module.readApplicationProjection(native),/integrity/);
   const a=await authority();fs.writeFileSync(path.join(native,'data/maxim/authority.json'),JSON.stringify({...a.marker,applications:'frozen',reason:'synthetic_publication_interruption'}));
   assert.throws(()=>module.readApplicationProjection(native),/frozen/);
   await request('applications/cutover',{action:'recover',expectedRevision:a.authority.revision,transitionId:transition.id,confirmed:true,reason:'Recover interrupted publication from the latest acknowledged DB state.'});
   const recovered=module.readApplicationProjection(native);assert.ok(recovered.applications.some(a=>a.id===firstApp.id&&a.status==='responded'));
  });
  await t.test('rollback exports latest acknowledged state and retains unrelated SQLite rows; canonical writes then fail closed',async()=>{
   const a=(await authority()).authority;
   const result=await request('applications/cutover',{action:'rollback',expectedRevision:a.revision,transitionId:transition.id,confirmed:true,reason:'Reviewed return to latest legacy-compatible state.'});
   assert.equal(result.publication.owner,'legacy');assert.equal((await authority()).marker.applications,'legacy');
   const db=new DatabaseSync(dbfile,{readOnly:true});try{
    assert.equal(db.prepare("SELECT status FROM applications WHERE id='app_legacy'").get().status,'Responded');
    assert.equal(db.prepare("SELECT name FROM contacts WHERE id='contact_original'").get().name,'Untouched Contact');
    const stmt=db.prepare('SELECT exact_integer,bytes FROM raw_values');stmt.setReadBigInts(true);const raw=stmt.get();assert.equal(raw.exact_integer,9007199254740993n);assert.deepEqual(Buffer.from(raw.bytes),Buffer.from([0,255]));
   }finally{db.close();}
   assert.match(fs.readFileSync(path.join(native,'data/applications.md'),'utf8'),/Responded/);
   const app=(await get('applications')).applications.find(a=>a.id===firstApp.id);
   await request('applications/commands',{action:'record_outcome',payload:{applicationId:app.id,expectedRevision:app.revision,outcome:'offer',reason:'Must not create a second active writer.'}},409);
   assert.ok(fs.existsSync(path.join(h.root,'cutovers',transition.id,'rollback-state.json')));
  });
  await t.test('protected recovery preserves S5 DB identities, raw mappings and every application rollback journal',async()=>{
   const backup=await backupWorkspace(h.c),recovery=await restoreWorkspace(h.c,backup.backupId),name=recovery.recoveryDatabase;
   assert.equal((await h.sql('SELECT outcome FROM applications WHERE id=$1',[firstApp.id],name)).rows[0].outcome,'responded');
   assert.equal((await h.sql('SELECT count(*) FROM legacy_key_map WHERE workspace_id=$1',[h.c.workspaceId],name)).rows[0].count,'3');
   for(const file of ['manifest.json','rollback-state.json','rollback-ids.json']){
    assert.deepEqual(fs.readFileSync(path.join(h.root,'recoveries',name,'cutovers',transition.id,file)),fs.readFileSync(path.join(h.root,'cutovers',transition.id,file)));
   }
   assert.ok(recovery.cutoverFiles>0);
  });
 }finally{if(legacyChild?.exitCode===null){legacyChild.kill();await legacyDone;}await h.close();}
});
