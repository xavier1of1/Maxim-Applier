import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {setTimeout as wait} from 'node:timers/promises';
import {appDir} from '../../scripts/environment.mjs';
import {harness} from '../support/harness.mjs';
import {authenticate} from '../../src/server/auth.ts';
import {executeCommand} from '../../src/server/commands.ts';
import {database} from '../../src/server/db.ts';
import {claimWork} from '../../src/server/work.ts';
import {gmailCommand,beginGmailOAuth,completeGmailOAuth} from '../../src/server/integrations/gmail/service.ts';
import {gmailView,gmailAgentView,expireGmail} from '../../src/server/integrations/gmail/reads.ts';
import {GmailError} from '../../src/server/integrations/gmail/provider.ts';
import {gmailWork} from '../../src/worker/gmail.ts';

test('S7 real isolated PostgreSQL commands/worker: consent, checkpoints, corrections and replay',async t=>{
 const h=await harness(),oldEnv=process.env.MAXIM_RUNTIME_FILE;process.env.MAXIM_RUNTIME_FILE=h.runtime;
 const ctx=await authenticate(new Request(h.c.origin,{headers:{cookie:h.a.cookie}})),other=await authenticate(new Request(h.c.origin,{headers:{cookie:h.b.cookie}}));
 const calls=[],messageMap=new Map();let history={historyId:'200',messages:[],deleted:[]},failure=null,hook=null,profileEmail='fixture@example.test',oauthState='';
 let child;
 const childWorker=script=>{
  fs.writeFileSync(path.join(h.root,'gmail-worker-script.json'),JSON.stringify(script));
  child=spawn(path.join(appDir,'node_modules/node/bin',process.platform==='win32'?'node.exe':'node'),['--import','tsx','tests/support/gmail-worker.mjs'],{cwd:appDir,env:{...process.env,MAXIM_RUNTIME_FILE:h.runtime},stdio:['ignore','pipe','pipe','ipc'],windowsHide:true});
  return child;
 };
 const provider={
  authorization(state,challenge,redirect,email){oauthState=state;calls.push({kind:'authorization',challenge,redirect,email});return 'https://accounts.google.com/o/oauth2/v2/auth?state='+state;},
  async exchange(code,verifier){calls.push({kind:'exchange',code,verifier});return {accessToken:'fixture-only-access',refreshToken:'fixture-only-refresh',expiresAt:Date.now()+3600000};},
  async refresh(token){calls.push({kind:'refresh'});return {...token,expiresAt:Date.now()+3600000};},
  async profile(){calls.push({kind:'profile'});return {emailAddress:profileEmail,historyId:'100'};},
  async thread(_token,id,body){calls.push({kind:'thread',id,body});if(failure)throw failure;if(hook)await hook();return [...messageMap.values()].filter(m=>m.threadId===id);},
  async history(_token,start,page){calls.push({kind:'history',start,page});if(failure)throw failure;return typeof history==='function'?history(start,page):history;},
  async message(_token,id,body){calls.push({kind:'message',id,body});if(hook)await hook();return messageMap.get(id);},
  async revoke(){calls.push({kind:'revoke'});if(failure)throw failure;},
 };
 const run=async(action,payload,commandId=crypto.randomUUID(),who=ctx)=>gmailCommand(who,{commandId,action,payload});
 const consent=async(overrides={})=>{const a=(await gmailView(ctx)).account;return run('consent',{expectedRevision:a?.revision||0,email:'fixture@example.test',threadIds:['thread1','thread2'],lookbackDays:7,retentionDays:7,retainBody:true,modelDisclosure:false,broadReadAccepted:true,selectionApproved:true,...overrides});};
 const account=async()=>(await gmailView(ctx)).account;
 const queue=async()=>run('sync',{expectedRevision:(await account()).revision});
 const step=async()=>{const item=await claimWork('gmail-fixture',45);assert.ok(item);assert.ok(item.kind.startsWith('gmail_'));await gmailWork(item,new AbortController().signal,provider);return item;};
 const drain=async()=>{for(let i=0;i<40;i++){const r=await h.sql("SELECT id FROM work_items WHERE workspace_id=$1 AND kind='gmail_sync' AND (status='queued' OR (status='leased' AND lease_until<now()))",[h.c.workspaceId]);if(!r.rowCount)return;await step();}throw Error('Gmail fixture continuation bound exceeded');};
 const message=(id,thread,subject,extra={})=>({id,threadId:thread,internalDate:String(Date.now()-60000),labelIds:['INBOX'],payload:{headers:[{name:'From',value:'Recruiter <recruiter@example.test>'},{name:'To',value:'fixture@example.test'},{name:'Subject',value:subject},{name:'Message-ID',value:'<'+id+'@example.test>'}],mimeType:'text/plain',body:{data:Buffer.from('private-fixture-body-'+id).toString('base64url')}},...extra});
 try{
  const job=await executeCommand(ctx,{commandId:crypto.randomUUID(),action:'create_job',payload:{company:'Fixture Company',title:'Engineer',description:'Fixture role'}}),job2=await executeCommand(ctx,{commandId:crypto.randomUUID(),action:'create_job',payload:{company:'Fixture Company',title:'Another Engineer',description:'Another fixture'}});
  const app=await executeCommand(ctx,{commandId:crypto.randomUUID(),action:'create_intent',payload:{jobId:job.id}}),app2=await executeCommand(ctx,{commandId:crypto.randomUUID(),action:'create_intent',payload:{jobId:job2.id}});
  messageMap.set('m1',message('m1','thread1','Reference '+app.id));messageMap.set('m2',message('m2','thread2','Fixture Company recruiter'));messageMap.set('unselected',message('unselected','thread3','Unrelated mailbox'));
  await t.test('consent, exact account, PKCE state replay and protected token custody',async()=>{
   await assert.rejects(()=>gmailView(other),e=>e.code==='not_found');await assert.rejects(()=>run('consent',{}),e=>e.name==='ZodError');
   await consent();assert.equal(calls.length,0);
   await beginGmailOAuth(ctx,{expectedRevision:1},provider);assert.equal(calls[0].challenge.length,43);
   await assert.rejects(()=>completeGmailOAuth({state:'x'.repeat(43),code:'fixture-code'},provider),e=>e.code==='gmail_oauth_state');
   await completeGmailOAuth({state:oauthState,code:'fixture-code'},provider);
   await assert.rejects(()=>completeGmailOAuth({state:oauthState,code:'fixture-code'},provider),e=>e.code==='gmail_oauth_state');
   assert.equal((await account()).status,'connected');
   assert.equal(crypto.createHash('sha256').update(calls.find(c=>c.kind==='exchange').verifier).digest('base64url'),calls[0].challenge);
   assert.equal((await gmailView({...other,isOwner:true})).account,null);
   const row=(await h.sql('SELECT token_key FROM gmail_accounts WHERE workspace_id=$1',[h.c.workspaceId])).rows[0];
   assert.equal(fs.existsSync(path.join(h.root,'gmail',row.token_key+'.json')),true);
   assert.ok(!JSON.stringify(await gmailView(ctx)).includes('fixture-only-access'));
  });
  const replyTest=async()=>{
   const source=(await gmailView(ctx)).observations.find(o=>o.message_id==='m2');
   const l=await run('confirm_link',{observationId:source.id,applicationId:app2.id,expectedApplicationRevision:1,expectedJobRevision:1,reason:'Review ambiguous source manually'});
   const response=await run('create_task',{linkId:l.id,expectedRevision:1,expectedApplicationRevision:1,reason:'Incoming question requires response'});
   const reply=message('reply','thread2','Re: fixture',{internalDate:String(Date.now()-1000),labelIds:['SENT']});
   reply.payload.headers=reply.payload.headers.map(h=>h.name==='From'?{...h,value:'fixture@example.test'}:h);reply.payload.headers.push({name:'In-Reply-To',value:'<m2@example.test>'});messageMap.set('reply',reply);
   const wrong=structuredClone(reply);wrong.id='wrong-reply';wrong.payload.headers=wrong.payload.headers.map(h=>h.name==='In-Reply-To'?{...h,value:'<unrelated@example.test>'}:h);messageMap.set(wrong.id,wrong);
   history={historyId:'350',messages:[{id:reply.id,threadId:'thread2'},{id:wrong.id,threadId:'thread2'}],deleted:[]};await queue();await drain();
   const observations=(await gmailView(ctx)).observations,valid=observations.find(o=>o.message_id===reply.id),invalid=observations.find(o=>o.message_id===wrong.id);
   await assert.rejects(()=>run('resolve_task',{taskId:response.id,expectedRevision:1,replyObservationId:invalid.id,reason:'Wrong reply must be rejected'}),e=>e.code==='gmail_reply_unattributable');
   await run('resolve_task',{taskId:response.id,expectedRevision:1,replyObservationId:valid.id,reason:'Confirmed directly attributable reply'});
   await queue();await drain();assert.equal((await gmailView(ctx)).tasks.find(t=>t.id===response.id).status,'resolved');
  };
  const retentionTest=async()=>{
   await consent({modelDisclosure:true});assert.ok(JSON.stringify(await gmailAgentView(ctx)).includes('private-fixture-body'));
   await consent({modelDisclosure:false});assert.ok(!JSON.stringify(await gmailAgentView(ctx)).includes('private-fixture-body'));
   const old=(await gmailView(ctx)).observations.find(o=>o.message_id==='m1');
   await h.sql("UPDATE gmail_observations SET expires_at=now()-interval '1 second' WHERE id=$1",[old.id]);await expireGmail();
   const view=await gmailView(ctx),expired=view.observations.find(o=>o.id===old.id);assert.equal(expired.withdrawn,true);assert.equal(expired.body,null);assert.ok(view.links.filter(l=>l.observation_id===old.id).every(l=>l.withdrawn_at));
   await queue();await drain();assert.equal((await gmailView(ctx)).observations.find(o=>o.id===old.id).withdrawn,true);
  };
  await t.test('restart checkpoint, duplicate source IDs, selected-only reads and identifier/ambiguity',async()=>{
   await queue();await step();const cp=(await h.sql('SELECT checkpoint FROM gmail_accounts WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].checkpoint;assert.equal(cp.index,1);
   const interrupted=childWorker({messages:[...messageMap.values()],history,pauseThread:'thread2'});
   const timeout=new AbortController();
   const [reading]=await Promise.race([once(interrupted,'message'),wait(15000,undefined,{signal:timeout.signal}).then(()=>{throw Error('Fixture child did not read its bounded step');})]);timeout.abort();
   const died=once(interrupted,'exit');interrupted.kill('SIGKILL');await died;
   assert.equal((await h.sql('SELECT checkpoint FROM gmail_accounts WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].checkpoint.index,1);
   await h.sql("UPDATE work_items SET lease_until=now()-interval '1 second' WHERE id=$1",[reading.workId]);
   const restarted=childWorker({messages:[...messageMap.values()],history});assert.equal((await once(restarted,'exit'))[0],0);child=null;
   let v=await gmailView(ctx);assert.equal(v.observations.length,2);assert.ok(v.account.last_success_at);
   assert.equal(v.observations.find(o=>o.message_id==='m1').suggestion.applicationId,app.id);assert.equal(v.observations.find(o=>o.message_id==='m2').suggestion.kind,'unassigned');
   assert.ok(!calls.some(c=>c.id==='thread3'||c.id==='unselected'));
   history={historyId:'300',messages:[{id:'m1',threadId:'thread1'},{id:'m1',threadId:'thread1'},{id:'unselected',threadId:'thread3'}],deleted:[]};await queue();await drain();v=await gmailView(ctx);assert.equal(v.observations.length,2);
   const agent=JSON.stringify(await gmailAgentView(ctx));assert.ok(!agent.includes('private-fixture-body')&&!agent.includes('fixture@example.test'));
  });
  let observation,link,task;
  await t.test('current scoped human links/tasks, correction, historical provenance and resolved replay',async()=>{
   observation=(await gmailView(ctx)).observations.find(o=>o.message_id==='m1');
   await assert.rejects(()=>run('confirm_link',{observationId:observation.id,applicationId:app.id,expectedApplicationRevision:2,expectedJobRevision:1,reason:'Fixture review'}),e=>e.code==='revision_conflict');
   await assert.rejects(()=>run('confirm_link',{observationId:observation.id,applicationId:crypto.randomUUID(),expectedApplicationRevision:1,expectedJobRevision:1,reason:'Fixture review'}),e=>e.code==='not_found');
   link=await run('confirm_link',{observationId:observation.id,applicationId:app2.id,expectedApplicationRevision:1,expectedJobRevision:1,reason:'Deliberately wrong fixture link'});
   task=await run('create_task',{linkId:link.id,expectedRevision:1,expectedApplicationRevision:1,reason:'Human response review'});
   await run('withdraw_link',{linkId:link.id,expectedRevision:1,reason:'Correct wrong fixture association'});
   link=await run('confirm_link',{observationId:observation.id,applicationId:app.id,expectedApplicationRevision:1,expectedJobRevision:1,reason:'Correct identifier association'});
   const withdrawn=(await gmailView(ctx)).tasks.find(x=>x.id===task.id);assert.equal(withdrawn.status,'withdrawn');
   task=await run('correct_task',{taskId:task.id,expectedRevision:withdrawn.revision,linkId:link.id,expectedLinkRevision:1,expectedApplicationRevision:1,reason:'Move response to corrected link'});assert.equal(task.status,'open');
   const reopened=(await gmailView(ctx)).tasks.find(t=>t.id===task.id);assert.equal(reopened.resolution,null);assert.equal(reopened.resolved_at,null);
   await run('resolve_task',{taskId:task.id,expectedRevision:task.revision,reason:'Resolved manually in fixture'});
   await queue();await drain();const replay=await run('create_task',{linkId:link.id,expectedRevision:1,expectedApplicationRevision:1,reason:'Replay must not reopen'});assert.equal(replay.status,'resolved');
   await run('withdraw_link',{linkId:link.id,expectedRevision:1,reason:'Review historical resolved association'});
   link=await run('confirm_link',{observationId:observation.id,applicationId:app.id,expectedApplicationRevision:1,expectedJobRevision:1,reason:'Reconfirm resolved source association'});
   const resolved=(await gmailView(ctx)).tasks.find(t=>t.id===task.id);
   assert.equal((await run('correct_task',{taskId:task.id,expectedRevision:resolved.revision,linkId:link.id,expectedLinkRevision:1,expectedApplicationRevision:1,reason:'Preserve resolved status during correction'})).status,'resolved');
   assert.equal((await gmailView(ctx)).links.length,3);assert.equal((await h.sql('SELECT outcome FROM applications WHERE id=$1',[app.id])).rows[0].outcome,'not_submitted');
   const events=JSON.stringify((await h.sql("SELECT payload FROM events WHERE event_type LIKE 'gmail_%'")).rows);assert.ok(!events.includes('private-fixture-body')&&!events.includes('fixture-only-refresh'));
  });
  await t.test('quota/expired cursor visible, old watermark preserved, explicit reset and lease loss fence',async()=>{
   const success=(await account()).last_success_at;failure=new GmailError('cursor_or_source_missing');await queue();await drain();assert.deepEqual((await account()).last_success_at,success);assert.equal((await account()).stale,true);
   await assert.rejects(()=>queue(),e=>e.code==='gmail_cooldown');await h.sql('UPDATE gmail_accounts SET next_retry_at=null WHERE workspace_id=$1',[h.c.workspaceId]);
   failure=new GmailError('quota_exceeded');await queue();await drain();assert.equal((await account()).error_code,'quota_exceeded');failure=null;
   await h.sql('UPDATE gmail_accounts SET next_retry_at=null WHERE workspace_id=$1',[h.c.workspaceId]);await run('reset_checkpoint',{expectedRevision:(await account()).revision});
   const item=await claimWork('gmail-expired-lease',45);await h.sql("UPDATE work_items SET lease_until=now()-interval '1 second' WHERE id=$1",[item.id]);
   assert.equal((await gmailView(ctx)).work.find(w=>w.id===item.id).lease_expired,true);
   await assert.rejects(()=>gmailWork(item,new AbortController().signal,provider),e=>e.code==='lease_lost');
   // Established work harness reclaims the expired lease and resumes the same checkpoint.
   await drain();assert.equal((await gmailView(ctx)).tasks.find(x=>x.id===task.id).status,'resolved');
  });
  await t.test('only a later directly attributable SENT reply can resolve a task',replyTest);
  await t.test('body model consent and retention are explicit, bounded and withdrawn durably',retentionTest);
  await t.test('partial history pages retry from their durable cursor without false freshness',async()=>{
   for(const id of ['paged1','paged2'])messageMap.set(id,message(id,'thread1','Paged fixture'));
   history=(_start,page)=>page==='page2'?{historyId:'600',messages:[{id:'paged2',threadId:'thread1'}],deleted:[]}:{historyId:'500',messages:[{id:'paged1',threadId:'thread1'}],deleted:[],nextPageToken:'page2'};
   const prior=(await account()).last_success_at;await queue();await step();
   const cp=(await h.sql('SELECT checkpoint FROM gmail_accounts WHERE workspace_id=$1',[h.c.workspaceId])).rows[0].checkpoint;assert.equal(cp.pageToken,'page2');assert.deepEqual((await account()).last_success_at,prior);
   failure=new GmailError('timeout_or_network');await drain();assert.deepEqual((await account()).last_success_at,prior);failure=null;
   await h.sql('UPDATE gmail_accounts SET next_retry_at=null WHERE workspace_id=$1',[h.c.workspaceId]);await queue();await drain();
   const rows=(await gmailView(ctx)).observations;assert.equal(rows.filter(o=>['paged1','paged2'].includes(o.message_id)).length,2);
   assert.equal(calls.filter(c=>c.kind==='history'&&c.page==='page2').length,2);
   history={historyId:'600',messages:[],deleted:[]};
  });
  await t.test('changed consent between enqueue/execution and in-flight publication prevents content',async()=>{
   history={historyId:'400',messages:[{id:'m3',threadId:'thread1'}],deleted:[]};messageMap.set('m3',message('m3','thread1','Fresh fixture message'));
   await queue();const item=await claimWork('gmail-consent-race',45);await consent({retainBody:false,modelDisclosure:false});
   const before=calls.length;await assert.rejects(()=>gmailWork(item,new AbortController().signal,provider),e=>e.code==='gmail_consent_changed');assert.equal(calls.length,before);
   await h.sql("UPDATE work_items SET status='failed',lease_until=null WHERE id=$1",[item.id]);
   await queue();hook=async()=>{hook=null;await run('purge_content',{expectedRevision:(await account()).revision});};
   await assert.rejects(()=>step(),e=>e.code==='gmail_consent_changed');
   assert.ok((await gmailView(ctx)).observations.every(o=>!o.body));
   await h.sql("UPDATE work_items SET status='failed',lease_until=null WHERE workspace_id=$1 AND status='leased'",[h.c.workspaceId]);
  });
  await t.test('externally revoked credentials disable ingestion and disclosure without stale publication',async()=>{
   failure=new GmailError('access_revoked');await queue();await drain();failure=null;
   assert.equal((await account()).enabled,false);assert.equal((await account()).status,'error');assert.equal((await account()).error_code,'access_revoked');
   assert.equal((await gmailView(ctx)).observations.length,0);await assert.rejects(()=>queue(),e=>e.code==='gmail_not_connected');
  });
  await t.test('disconnect disables immediately; revocation deletes protected token and hides mail',async()=>{
   const prior=(await h.sql('SELECT token_key FROM gmail_accounts WHERE workspace_id=$1',[h.c.workspaceId])).rows[0];
   await run('disconnect',{expectedRevision:(await account()).revision});assert.equal((await account()).enabled,false);assert.equal((await gmailView(ctx)).observations.length,0);
   failure=new GmailError('timeout_or_network');await step();assert.equal((await account()).status,'revoking');assert.equal(fs.existsSync(path.join(h.root,'gmail',prior.token_key+'.json')),true);
   failure=null;await run('disconnect',{expectedRevision:(await account()).revision});await step();assert.equal((await account()).status,'revoked');assert.equal(fs.existsSync(path.join(h.root,'gmail',prior.token_key+'.json')),false);
   await assert.rejects(()=>queue(),e=>e.code==='gmail_not_connected');
  });
  await t.test('wrong OAuth mailbox is refused and its grant is revoked without publishing content',async()=>{
   profileEmail='another@example.test';await beginGmailOAuth(ctx,{expectedRevision:(await account()).revision},provider);const before=calls.filter(c=>c.kind==='revoke').length;
   await assert.rejects(()=>completeGmailOAuth({state:oauthState,code:'fixture-code'},provider),e=>e.code==='gmail_account_mismatch');
   assert.equal(calls.filter(c=>c.kind==='revoke').length,before+1);assert.equal((await account()).status,'error');assert.equal((await account()).enabled,false);
  });
  await t.test('failed authorization cleanup retains a protected grant and has durable visible retry',async()=>{
   await beginGmailOAuth(ctx,{expectedRevision:(await account()).revision},provider);failure=new GmailError('timeout_or_network');
   await assert.rejects(()=>completeGmailOAuth({state:oauthState,code:'fixture-code'},provider),e=>e.code==='gmail_account_mismatch');
   let v=await gmailView(ctx);assert.equal(v.revocations.length,1);
   await assert.rejects(()=>beginGmailOAuth(ctx,{expectedRevision:v.account.revision},provider),e=>e.code==='gmail_revoke_pending');
   await step();v=await gmailView(ctx);assert.equal(v.revocations[0].error_code,'timeout_or_network');
   failure=null;await run('disconnect',{expectedRevision:v.account.revision});await step();assert.equal((await gmailView(ctx)).revocations.length,0);
  });
 }finally{
  if(child&&child.exitCode===null){const done=once(child,'exit');child.kill('SIGKILL');await done;}
  await database().end();if(oldEnv===undefined)delete process.env.MAXIM_RUNTIME_FILE;else process.env.MAXIM_RUNTIME_FILE=oldEnv;await h.close();
 }
});
