import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {discordHarness} from '../support/discord.mjs';
import {claimWork} from '../../src/server/work.ts';
import {transaction} from '../../src/server/db.ts';
import {deliverDiscord,tickDiscord} from '../../src/worker/discord.ts';
import {enqueueDiscordEvent} from '../../src/server/integrations/discord/outbox.ts';
import {engineSnapshot} from '../../src/server/evaluation-native.ts';

test('S8 real PostgreSQL durable Discord delivery, privacy, consent and crash recovery',async t=>{
 const h=await discordHarness(),w=h.c.workspaceId;
 const run=async()=>{const item=await claimWork('discord-fixture-'+crypto.randomUUID());if(item)await deliverDiscord(item);return item;};
 const due=async()=>{await h.sql(`UPDATE work_items SET available_at=now()-interval '1 second' WHERE workspace_id=$1 AND kind='discord_delivery' AND status='queued'`,[w]);await h.sql(`UPDATE discord_notifications SET available_at=now()-interval '1 second' WHERE workspace_id=$1 AND status='retry'`,[w]);await h.sql('UPDATE discord_settings SET next_send_at=null WHERE workspace_id=$1',[w]);};
 const clear=async()=>{await h.sql('DELETE FROM discord_attempts WHERE workspace_id=$1',[w]);await h.sql('DELETE FROM discord_notifications WHERE workspace_id=$1',[w]);await h.sql(`DELETE FROM work_items WHERE workspace_id=$1 AND kind='discord_delivery'`,[w]);await h.sql('UPDATE discord_settings SET next_send_at=null WHERE workspace_id=$1',[w]);h.requests.length=0;h.setRoute(null);};
 const enqueue=async kind=>(await h.command('enqueue_now',{kind}));
 const status=async id=>(await h.sql('SELECT * FROM discord_notifications WHERE workspace_id=$1 AND id=$2',[w,id])).rows[0];
 const seedJob=async(extra={})=>{
  const job=crypto.randomUUID(),app=crypto.randomUUID();
  await h.sql('INSERT INTO jobs(id,workspace_id,company,title,description) VALUES($1,$2,$3,$4,$5)',[job,w,'Private fixture employer','Private fixture role','private_fixture_description@example.invalid']);
  await h.sql(`INSERT INTO applications(id,workspace_id,job_id,workflow,outcome,applied_at,submitted_snapshot,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[app,w,job,extra.workflow||'intent',extra.outcome||'not_submitted',extra.appliedAt||null,extra.snapshot?JSON.stringify(extra.snapshot):null,extra.status||'intent']);
  return {job,app};
 };
 try{
  const intent=await seedJob(),filled=await seedJob({workflow:'review_ready'});
  await seedJob({outcome:'submitted',appliedAt:new Date(),snapshot:{source:'user_declaration'}});
  await seedJob({outcome:'interviewing',appliedAt:new Date(),snapshot:{source:'user_declaration'}});
  await seedJob({outcome:'submitted',appliedAt:new Date(),snapshot:{source:'legacy_unconfirmed'}});
  await seedJob({status:'archived'});
  await t.test('unconfigured dry-run does not mutate any delivery or command state',async()=>{
   const before=await h.sql('SELECT (SELECT count(*) FROM commands) AS commands,(SELECT count(*) FROM events) AS events');
   const r=await h.service.discordPlan(h.ctx,{kind:'weekly_review'});
   assert.equal(r.counts.submitted,2);assert.equal(r.counts.applicationReview,2);
   assert.equal((await h.view()).settings.state,'unconfigured');
   assert.deepEqual((await h.sql('SELECT (SELECT count(*) FROM commands) AS commands,(SELECT count(*) FROM events) AS events')).rows,before.rows);
   assert.equal((await h.sql('SELECT * FROM discord_settings')).rowCount,0);assert.equal(h.requests.length,0);
   await assert.rejects(()=>h.service.discordView(h.other),e=>e.code==='not_found');
   assert.equal((await h.request('/api/discord',undefined,{Cookie:''})).status,401);
   assert.equal((await h.request('/api/discord/plan',{kind:'weekly_review'},{Origin:'https://example.invalid'})).status,403);
  });
  await t.test('private destination is idempotent, owner-only and disabled until exact consent',async()=>{
   const commandId=crypto.randomUUID(),p={expectedRevision:1,webhook:h.webhook,channelId:'123456789012345678',confirmedExisting:true};
   const a=await h.command('configure_destination',p,commandId),b=await h.command('configure_destination',p,commandId);assert.deepEqual(a,b);
   assert.equal((await h.view()).settings.enabled,false);assert.equal((await enqueue('weekly_review')).queued,false);
   await assert.rejects(()=>h.command('configure_destination',{...p,channelId:'123456789012345677'},commandId),e=>e.code==='idempotency_conflict');
   await assert.rejects(()=>h.command('configure_destination',p,crypto.randomUUID(),h.other),e=>e.code==='not_found');
   const text=JSON.stringify({view:await h.view(),commands:(await h.sql('SELECT * FROM commands')).rows,events:(await h.sql('SELECT * FROM events')).rows});
   assert.ok(!text.includes('discord_fixture_token'));assert.ok(!text.includes(h.webhook));
   assert.equal(fs.readdirSync(path.join(h.root,'discord')).length,1);
   await h.consent(['application_review','weekly_review','resume_review','high_fit','needs_response','networking_review','recruiter_reminder']);
   assert.equal((await h.view()).settings.enabled,true);assert.equal(h.requests.length,0);
  });
  await t.test('429 is rejected, retry survives a process restart, accepted replay is suppressed',async()=>{
   await clear();let calls=0;h.setRoute((_req,res)=>{if(++calls===1){res.writeHead(429,{'Content-Type':'application/json','Retry-After':'120'});res.end(JSON.stringify({retry_after:90,message:'private_fixture_remote_body'}));}else{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'123456789012345679',channel_id:'123456789012345678'}));}});
   const n=await enqueue('weekly_review'),start=Date.now();await run();
   let row=await status(n.id);assert.equal(row.status,'retry');assert.equal(row.attempts,1);assert.equal(row.accepted_at,null);assert.ok(Number(row.available_at)>=start+119000);
   assert.equal((await enqueue('weekly_review')).id,n.id);assert.equal(h.requests.length,1);
   await due();await h.worker().done;row=await status(n.id);
   assert.equal(row.status,'accepted');assert.equal(row.attempts,2);assert.equal(h.requests.length,2);
   assert.equal((await enqueue('weekly_review')).queued,false);await run();assert.equal(h.requests.length,2);
   assert.deepEqual((await h.sql('SELECT status FROM discord_attempts ORDER BY attempt')).rows.map(r=>r.status),['rejected','accepted']);
   assert.ok(h.requests.every(r=>r.url.endsWith('?wait=true')&&!r.headers.authorization&&!r.headers.cookie));
   assert.deepEqual(h.requests[0].body.allowed_mentions,{parse:[]});assert.equal(h.requests[0].body.flags,4);
   assert.ok(!JSON.stringify(h.requests).includes('private_fixture_description'));
  });
  await t.test('server errors have five bounded attempts; redirects and 4xx are terminal',async()=>{
   await clear();h.setRoute((_req,res)=>{res.writeHead(503);res.end('private_fixture_remote_body');});
   const n=await enqueue('weekly_review');for(let i=0;i<5;i++){await due();await run();}
   const row=await status(n.id);assert.equal(row.status,'failed');assert.equal(row.error_code,'attempts_exhausted');assert.equal(row.accepted_at,null);assert.equal(h.requests.length,5);
   await due();await run();assert.equal(h.requests.length,5);
   for(const code of [302,400,401,404]){await clear();h.setRoute((_req,res)=>{res.writeHead(code,{Location:'http://127.0.0.1:1/private'});res.end('private_fixture_remote_body');});const n=await enqueue('weekly_review');await run();assert.equal((await status(n.id)).status,'failed');assert.equal(h.requests.length,1);
    if(code===400){h.setRoute(null);await h.command('retry_failed',{notificationId:n.id,acknowledgeDuplicateRisk:true});await due();await run();assert.equal((await status(n.id)).status,'accepted');assert.equal((await status(n.id)).attempts,2);assert.equal(h.requests.length,2);await assert.rejects(()=>h.command('retry_failed',{notificationId:n.id,acknowledgeDuplicateRisk:true}),e=>e.code==='delivery_not_retryable');}
   }
  });
  await t.test('unknown acceptance and network failure require a visible operator duplicate-risk decision',async()=>{
   for(const code of [204,200,0]){
    await clear();h.setRoute((req,res)=>{if(!code){req.socket.destroy();return;}res.writeHead(code,{'Content-Type':'application/json'});res.end(code===200?'{}':'');});
    const n=await enqueue('weekly_review');await run();assert.equal((await status(n.id)).status,'uncertain');assert.equal((await status(n.id)).accepted_at,null);
    await due();await run();assert.equal(h.requests.length,1);
    if(code===0){await assert.rejects(()=>h.command('resolve_uncertain',{notificationId:n.id,decision:'retry'}));h.setRoute(null);await h.command('resolve_uncertain',{notificationId:n.id,decision:'retry',acknowledgeDuplicateRisk:true});await due();await run();assert.equal((await status(n.id)).status,'accepted');assert.equal(h.requests.length,2);}
    else await h.command('resolve_uncertain',{notificationId:n.id,decision:'cancel',acknowledgeDuplicateRisk:true});
   }
  });
  await t.test('private configuration cannot target real Discord in fixtures; missing secret never makes a POST',async()=>{
   await clear();const s=(await h.view()).settings;
   for(const webhook of ['https://discord.com/api/webhooks/123456789012345678/discord_fixture_token_123456','http://169.254.169.254/api/webhooks/123456789012345678/discord_fixture_token_123456',h.webhook+'?wait=false']){
    await assert.rejects(()=>h.command('configure_destination',{expectedRevision:s.revision,webhook,channelId:'123456789012345678',confirmedExisting:true}),e=>e.code==='invalid_destination');
   }
   const ref=(await h.sql('SELECT secret_ref FROM discord_settings WHERE workspace_id=$1',[w])).rows[0].secret_ref;
   const file=path.join(h.root,'discord',ref+'.json');fs.renameSync(file,file+'.missing');
   try{assert.equal((await h.view()).settings.state,'unconfigured');const n=await enqueue('weekly_review');await run();assert.equal((await status(n.id)).status,'failed');assert.equal((await status(n.id)).attempts,0);assert.equal(h.requests.length,0);}finally{fs.renameSync(file+'.missing',file);}
  });
  await t.test('stalled response body has a bounded deadline and is not accepted',async()=>{
   await clear();h.setRoute((_req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.write('{');});
   const n=await enqueue('weekly_review'),start=Date.now();await run();assert.ok(Date.now()-start>=9000);assert.ok(Date.now()-start<20000);
   const row=await status(n.id);assert.equal(row.status,'uncertain');assert.equal(row.error_code,'request_interrupted');assert.equal(row.accepted_at,null);assert.equal(h.requests.length,1);
  });
  await t.test('wrong-channel response disables delivery and cannot be accepted',async()=>{
   await clear();h.setRoute((_req,res)=>{res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'123456789012345679',channel_id:'123456789012345677'}));});
   const n=await enqueue('weekly_review');await run();assert.equal((await status(n.id)).status,'uncertain');assert.equal((await status(n.id)).error_code,'destination_mismatch');assert.equal((await h.view()).settings.enabled,false);
   await assert.rejects(()=>h.command('resolve_uncertain',{notificationId:n.id,decision:'retry',acknowledgeDuplicateRisk:true}),e=>e.code==='retry_denied');
   await h.consent(['application_review','weekly_review','resume_review','high_fit','needs_response','networking_review','recruiter_reminder']);
  });
  await t.test('worker exhaustion before send does not leave pending delivery forever',async()=>{
   await clear();const n=await enqueue('weekly_review'),row=await status(n.id);
   await h.sql(`UPDATE work_items SET status='failed',attempts=5 WHERE workspace_id=$1 AND id=$2`,[w,row.work_id]);await tickDiscord();
   assert.equal((await status(n.id)).status,'failed');assert.equal((await status(n.id)).error_code,'worker_stopped_before_send');assert.equal(h.requests.length,0);
   await clear();const queued=await enqueue('weekly_review'),short=await claimWork('short-discord-lease',2);
   await assert.rejects(()=>deliverDiscord(short),e=>e.code==='lease_lost');assert.equal((await status(queued.id)).attempts,0);assert.equal(h.requests.length,0);
  });
  await t.test('revocation fences a late HTTP response and destination rotation never retargets queued work',async()=>{
   await clear();let arrived,release;const seen=new Promise(r=>{arrived=r;}),gate=new Promise(r=>{release=r;});
   h.setRoute(async(_req,res)=>{arrived();await gate;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'123456789012345679',channel_id:'123456789012345678'}));});
   const n=await enqueue('weekly_review'),sending=run();await seen;await h.consent(['weekly_review'],false);release();await sending;
   assert.equal((await status(n.id)).status,'uncertain');assert.equal((await status(n.id)).accepted_at,null);
   await h.consent(['weekly_review']);await clear();const old=await enqueue('weekly_review');await h.configure();await run();assert.equal(h.requests.length,0);assert.equal((await status(old.id)).status,'cancelled');assert.equal((await h.view()).settings.enabled,false);
   await h.consent(['application_review','weekly_review','resume_review','high_fit','needs_response','networking_review','recruiter_reminder']);
  });
  await t.test('actual accepted-then-killed worker leaves uncertainty, fences old lease and makes no automatic duplicate',async()=>{
   await clear();let arrived,release;const seen=new Promise(r=>{arrived=r;}),gate=new Promise(r=>{release=r;});let lock;
   h.setRoute(async(_req,res)=>{lock=await h.pool.connect();await lock.query('BEGIN');await lock.query('SELECT * FROM discord_settings WHERE workspace_id=$1 FOR UPDATE',[w]);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'123456789012345679',channel_id:'123456789012345678'}));arrived();await gate;});
   const n=await enqueue('weekly_review'),worker=h.worker();await seen;
   const item=(await h.sql('SELECT * FROM work_items WHERE workspace_id=$1 AND id=$2',[w,(await status(n.id)).work_id])).rows[0];
   worker.child.kill();await worker.done.catch(()=>{});release();await lock.query('ROLLBACK');lock.release();
   await h.sql(`UPDATE work_items SET lease_until=now()-interval '1 second' WHERE workspace_id=$1 AND id=$2`,[w,item.id]);
   await tickDiscord();assert.equal((await status(n.id)).status,'uncertain');assert.equal((await status(n.id)).accepted_at,null);
   await assert.rejects(()=>deliverDiscord(item),e=>e.code==='lease_lost');await h.worker().done;assert.equal(h.requests.length,1);
  });
  await t.test('transaction rollback cannot leave a notification, event or work item',async()=>{
   await clear();const before=(await h.sql('SELECT count(*) FROM events')).rows[0].count;
   await assert.rejects(()=>transaction(async tx=>{await enqueueDiscordEvent(tx,w,{kind:'weekly_review'});throw Error('fixture rollback');}));
   assert.equal((await h.sql('SELECT * FROM discord_notifications')).rowCount,0);assert.equal((await h.sql(`SELECT * FROM work_items WHERE kind='discord_delivery'`)).rowCount,0);assert.equal((await h.sql('SELECT count(*) FROM events')).rows[0].count,before);
  });
  await t.test('persisted schedules coalesce missed weekly, daily and 21-day ticks with no replay',async()=>{
   await clear();for(const kind of ['weekly_review','resume_review','application_review'])await h.command('save_schedule',{expectedRevision:(await h.view()).settings.revision,kind,timezone:'America/New_York',anchorDate:'2026-10-24',localTime:'09:00',enabled:true});
   await h.sql(`UPDATE discord_schedules SET next_due_at='2026-10-24T13:00:00Z' WHERE workspace_id=$1`,[w]);
   const fake=new Date('2026-12-12T18:00:00Z');assert.equal((await tickDiscord(fake)).scheduled,3);
   const saved=(await h.sql('SELECT kind,next_due_at,last_slot_at FROM discord_schedules ORDER BY kind')).rows;
   assert.equal(saved.find(r=>r.kind==='resume_review').next_due_at.toISOString(),'2026-12-26T14:00:00.000Z');
   assert.equal((await tickDiscord(fake)).scheduled,0);assert.equal((await h.sql('SELECT * FROM discord_notifications')).rowCount,3);
   assert.equal(h.requests.length,0);await h.sql('UPDATE discord_schedules SET enabled=false');
  });
  await t.test('optional producer contracts are absent by default; resolution is checked again before delivery',async()=>{
   await clear();assert.equal((await h.service.discordPlan(h.ctx,{kind:'needs_response'})).reason,'producer_unavailable');
   await h.sql(`CREATE TABLE discord_s7_ready_tasks(workspace_id uuid,task_id uuid,revision integer,kind text,status text,due_at timestamptz,private_body text)`);
   await h.sql(`INSERT INTO discord_s7_ready_tasks VALUES($1,$2,1,'needs_response','pending',now(),'private_fixture_mail_body')`,[w,crypto.randomUUID()]);
   const n=await enqueue('needs_response');assert.equal(n.queued,true);await h.sql(`UPDATE discord_s7_ready_tasks SET status='resolved'`);await run();assert.equal((await status(n.id)).status,'cancelled');assert.equal((await enqueue('needs_response')).queued,false);assert.equal(h.requests.length,0);
   assert.ok(!JSON.stringify(await h.view()).includes('private_fixture_mail_body'));
   await h.sql(`INSERT INTO discord_s7_ready_tasks SELECT $1,gen_random_uuid(),1,'needs_response','pending',now(),'private_fixture_mail_body' FROM generate_series(1,1200)`,[w]);
   assert.equal((await h.service.discordPlan(h.ctx,{kind:'needs_response'})).counts.needsResponse,1200);
   await tickDiscord();const batch=(await h.sql(`SELECT * FROM discord_notifications WHERE kind='needs_response' AND status='pending'`)).rows[0];assert.ok(batch);
   await h.sql(`UPDATE discord_s7_ready_tasks SET status='resolved'`);await due();await run();assert.equal((await status(batch.id)).status,'cancelled');
   await h.sql(`CREATE TABLE discord_s9_ready_tasks(workspace_id uuid,task_id uuid,revision integer,kind text,status text,due_at timestamptz)`);
   const task=crypto.randomUUID();await h.sql(`INSERT INTO discord_s9_ready_tasks VALUES($1,$2,1,'recruiter_reminder','pending',now()),($1,$2,1,'recruiter_reminder','pending',now())`,[w,task]);
   assert.equal((await h.service.discordPlan(h.ctx,{kind:'recruiter_reminder'})).counts.recruiterReminder,1);
   const reminder=await enqueue('recruiter_reminder');await h.sql(`UPDATE discord_s9_ready_tasks SET status='resolved'`);await due();await run();assert.equal((await status(reminder.id)).status,'cancelled');
  });
  await t.test('fresh high-fit needs current retained evaluation and trustworthy S4 posted evidence',async()=>{
   await clear();const j=await seedJob(),source=crypto.randomUUID(),query=crypto.randomUUID(),runId=crypto.randomUUID(),attempt=crypto.randomUUID(),page=crypto.randomUUID(),evaluation=crypto.randomUUID(),posted=new Date(Date.now()-3600000);
   await h.sql(`UPDATE candidates SET ownership='canonical' WHERE workspace_id=$1`,[w]);
   await h.sql(`UPDATE jobs SET posted_at=$1,discovery_policy='{"eligibility":"eligible"}' WHERE workspace_id=$2 AND id=$3`,[posted,w,j.job]);
   await h.sql(`INSERT INTO discovery_sources(id,workspace_id,name,provider,careers_url,identity_hash) VALUES($1,$2,'Fixture','ashby','https://example.invalid','fixture')`,[source,w]);
   await h.sql(`INSERT INTO discovery_queries(id,workspace_id,terms,filters,source_snapshots) VALUES($1,$2,'{}','{}','[]')`,[query,w]);
   await h.sql(`INSERT INTO discovery_runs(id,workspace_id,query_id,status) VALUES($1,$2,$3,'completed')`,[runId,w,query]);
   await h.sql(`INSERT INTO discovery_attempts(id,workspace_id,run_id,source_id,run_revision,source_revision) VALUES($1,$2,$3,$4,1,1)`,[attempt,w,runId,source]);
   await h.sql(`INSERT INTO discovery_pages(id,workspace_id,run_id,source_id,attempt_id,source_revision,page_number,request_url,payload,content_hash,record_count,captured_at,complete) VALUES($1,$2,$3,$4,$5,1,1,'fixture','{}','fixture',1,now(),true)`,[page,w,runId,source,attempt]);
   await h.sql(`INSERT INTO job_observations(id,workspace_id,job_id,source_id,run_id,page_id,external_id,raw_fields,content_hash,source_revision,observed_at,posted_at,date_basis,policy) VALUES($1,$2,$3,$4,$5,$6,'fixture','{}','fixture',1,now(),$7,'publishedAt','{}')`,[crypto.randomUUID(),w,j.job,source,runId,page,posted]);
   await h.sql(`INSERT INTO evaluations(id,workspace_id,job_id,job_revision,candidate_revision,input_snapshot,input_hash,prompt_hash,model,provider,status,score,tier,policy) VALUES($1,$2,$3,1,1,$4,'fixture','fixture','fixture','fixture','completed',4.2,'T2','{"allowed":true,"eligibility":"eligible","urgent":true,"policyRevision":1}')`,[evaluation,w,j.job,JSON.stringify({engine:{hash:(await engineSnapshot()).hash}})]);
   const plan=()=>h.service.discordPlan(h.ctx,{kind:'high_fit',entityId:j.job});assert.equal((await plan()).eligible,true);
   for(const date of [null,new Date(Date.now()+3600000),new Date(Date.now()-72*3600000)]){await h.sql('UPDATE jobs SET posted_at=$1 WHERE workspace_id=$2 AND id=$3',[date,w,j.job]);assert.equal((await plan()).eligible,false);}
   await h.sql('UPDATE jobs SET posted_at=$1 WHERE workspace_id=$2 AND id=$3',[posted,w,j.job]);
   await h.sql(`UPDATE job_observations SET date_basis='unknown' WHERE job_id=$1`,[j.job]);assert.equal((await plan()).eligible,false);
   await h.sql(`UPDATE job_observations SET date_basis='publishedAt' WHERE job_id=$1`,[j.job]);
   const n=await h.command('enqueue_now',{kind:'high_fit',entityId:j.job});await h.sql('UPDATE jobs SET revision=revision+1 WHERE id=$1',[j.job]);await run();assert.equal((await status(n.id)).status,'cancelled');assert.equal(h.requests.length,0);
  });
  await t.test('resolved application batch is cancelled instead of sending a stale reminder',async()=>{
   await clear();const n=await enqueue('application_review');assert.equal(n.queued,true);
   await h.sql(`UPDATE applications SET status='archived' WHERE workspace_id=$1 AND outcome='not_submitted'`,[w]);await run();assert.equal((await status(n.id)).status,'cancelled');assert.equal((await enqueue('application_review')).queued,false);assert.equal(h.requests.length,0);
   const snapshot=JSON.stringify(await h.view());for(const secret of [h.webhook,'discord_fixture_token','private_fixture_description','private_fixture_remote_body'])assert.ok(!snapshot.includes(secret));
  });
 }finally{await h.close();}
});
