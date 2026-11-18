import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {GoogleGmail,READ_SCOPE,pkce} from '../../src/server/integrations/gmail/provider.ts';
import {writePrivate} from '../../src/server/integrations/gmail/private.ts';
import {createFixture,removeFixture} from '../../../lib/test-resources.mjs';

test('S7 actual Google adapter is read-only, PKCE-bound and transport-bounded',async t=>{
 const root=createFixture('maxim-test-gmail-'),runtime=path.join(root,'runtime.json'),oldEnv=process.env.MAXIM_RUNTIME_FILE,oldFetch=globalThis.fetch;
 fs.writeFileSync(runtime,JSON.stringify({databaseUrl:'postgresql://maxim@127.0.0.1:1/maxim_test_gmail',origin:'http://127.0.0.1:3010',privateRoot:root,workspaceId:crypto.randomUUID(),bootstrapKey:'x'.repeat(32),model:{model:'fixture',apiKey:'fixture',baseUrl:'http://127.0.0.1:1/v1'},testMode:true}));
 process.env.MAXIM_RUNTIME_FILE=runtime;
 const calls=[],responses=[];
 globalThis.fetch=async(url,init)=>{calls.push({url,init});const r=responses.shift();if(r instanceof Error)throw r;return r;};
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
 const token={accessToken:'fixture-access',refreshToken:'fixture-refresh',expiresAt:Date.now()+3600000};
 try{
  writePrivate('client',{clientId:'fixture-client',clientSecret:'fixture-client-secret'});
  const provider=new GoogleGmail(),proof=pkce(),url=new URL(provider.authorization('fixture-state',proof.challenge,'http://127.0.0.1:3010/api/gmail/callback','fixture@example.test'));
  assert.equal(url.hostname,'accounts.google.com');assert.equal(url.searchParams.get('scope'),READ_SCOPE);assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.equal(proof.challenge,crypto.createHash('sha256').update(proof.verifier).digest('base64url'));
  responses.push(response({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,scope:READ_SCOPE,token_type:'Bearer'}));
  await provider.exchange('fixture-code',proof.verifier,'http://127.0.0.1:3010/api/gmail/callback',AbortSignal.timeout(2000));
  assert.equal(calls[0].url,'https://oauth2.googleapis.com/token');assert.equal(calls[0].init.body.get('code_verifier'),proof.verifier);assert.equal(calls[0].init.redirect,'error');
  await t.test('expanded scopes are rejected rather than reused',async()=>{
   responses.push(response({access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,scope:READ_SCOPE+' https://www.googleapis.com/auth/gmail.send',token_type:'Bearer'}));
   await assert.rejects(()=>provider.exchange('fixture-code',proof.verifier,'http://127.0.0.1:3010/api/gmail/callback',AbortSignal.timeout(2000)),e=>e.code==='gmail_scope_denied');
  });
  await t.test('history strings, duplicate IDs and metadata-only selection remain explicit',async()=>{
   responses.push(response({historyId:'900719925474099399',history:[{messagesAdded:[{message:{id:'m1',threadId:'t1'}},{message:{id:'m1',threadId:'t1'}}]}],nextPageToken:'next'}));
   const h=await provider.history(token,'900719925474099301',undefined,AbortSignal.timeout(2000));assert.equal(h.historyId,'900719925474099399');assert.equal(h.messages.length,2);
   responses.push(response({messages:[{id:'m1',threadId:'t1',internalDate:String(Date.now()),payload:{headers:[]}}]}));
   await provider.thread(token,'t1',false,AbortSignal.timeout(2000));
   assert.ok(calls.at(-1).url.includes('format=metadata'));assert.ok(calls.at(-1).url.includes('metadataHeaders=In-Reply-To'));
   assert.equal(calls.at(-1).init.headers.Authorization,'Bearer fixture-access');
  });
  await t.test('quota, stale cursor, redirects, oversized bodies and timeout never become empty success',async()=>{
   for(const [status,code] of [[429,'quota_exceeded'],[404,'cursor_or_source_missing'],[401,'access_revoked'],[400,'invalid_cursor']]){
    responses.push(response({private:'must-not-leak'},status));await assert.rejects(()=>provider.history(token,'1','bad',AbortSignal.timeout(2000)),e=>e.code===code&&!e.message.includes('must-not-leak'));
   }
   responses.push(new TypeError('fixture redirect refused'));await assert.rejects(()=>provider.profile(token,AbortSignal.timeout(2000)),e=>e.code==='timeout_or_network');
   responses.push(new Response('x'.repeat(2*1024*1024+1)));await assert.rejects(()=>provider.profile(token,AbortSignal.timeout(2000)),e=>e.code==='response_bound');
  });
  responses.push(new Response(null,{status:200}));await provider.revoke(token,AbortSignal.timeout(2000));
  assert.equal(calls.at(-1).url,'https://oauth2.googleapis.com/revoke');assert.equal(calls.at(-1).init.body.get('token'),'fixture-refresh');
  assert.ok(calls.every(c=>c.url.startsWith('https://gmail.googleapis.com/gmail/v1/users/me/')||['https://oauth2.googleapis.com/token','https://oauth2.googleapis.com/revoke'].includes(c.url)));
  assert.ok(calls.filter(c=>c.url.includes('gmail.googleapis.com')).every(c=>!c.init.method||c.init.method==='GET'));
 }finally{
  globalThis.fetch=oldFetch;if(oldEnv===undefined)delete process.env.MAXIM_RUNTIME_FILE;else process.env.MAXIM_RUNTIME_FILE=oldEnv;
  removeFixture(root,{allowCurrent:true});
 }
});
