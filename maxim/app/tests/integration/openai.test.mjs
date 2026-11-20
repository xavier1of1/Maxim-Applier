import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {harness,streamResult} from '../support/harness.mjs';
import {until,preparedApplication} from '../support/assisted-application.mjs';

test('unknown model works through mounted Responses chat, approved evaluation and source interpretation',{timeout:180000},async t=>{
 const h=await harness({api:'responses'});t.after(()=>h.close());
 const post=(url,body,auth=h.a)=>h.request(auth,url,{method:'POST',body});
 assert.equal((await(await h.request(h.a,'/api/workspace')).json()).settings.model.api,'responses');
 h.providerRoutes.set('/v1/models',{body:{data:[{id:'future-text-model'},{id:'gpt-4.1-mini'},{id:'future-text-model'}]}});
 const original=fs.readFileSync(h.runtime,'utf8');
 assert.equal((await post('/api/settings/model/list',{},h.b)).status,404);
 const catalog=await post('/api/settings/model/list',{apiKey:'synthetic-unsaved-key'});
 assert.deepEqual(await catalog.json(),{models:['future-text-model','gpt-4.1-mini']});
 assert.equal(fs.readFileSync(h.runtime,'utf8'),original,'listing never persists unsaved credentials');
 assert.equal(h.providerRequests.at(-1).headers.authorization,'Bearer synthetic-unsaved-key');
 assert.equal(h.captured.length,0,'listing sends no prompts');
 const saved=await post('/api/settings/model',{model:'future-text-model'});assert.equal(saved.status,200);
 assert.equal((await saved.json()).model.api,'responses');
 const worker=await h.startWorker();
 try{
  const {job}=await preparedApplication(h);
  const c=await post('/api/conversations',{commandId:crypto.randomUUID(),jobId:job.id});
  const conversation=(await c.json()).conversation;
  const events=await streamResult(await post('/api/conversations/'+conversation.id+'/messages',{commandId:crypto.randomUUID(),text:'List my saved roles.'}));
  assert.equal(events.at(-1).event,'done',JSON.stringify(events));
  assert.ok(events.some(e=>e.event==='delta'&&e.data.text.includes('Assisted Fixture')));
  const last=h.captured.at(-1);assert.equal(last.endpoint,'/v1/responses');
  assert.ok(last.wire.input.some(i=>i.type==='reasoning'&&i.encrypted_content==='opaque-fixture'));
  assert.ok(last.wire.input.some(i=>i.type==='function_call_output'&&i.call_id));
  const f=new FormData();f.set('commandId',crypto.randomUUID());f.set('file',new File(['Built customer software using Rust and TypeScript.'],'synthetic-source.txt'));
  f.set('classification','personal');f.set('modelConsent','true');f.set('retentionDays','7');
  const uploaded=await post('/api/sources',f);assert.equal(uploaded.status,200);const {source}=await uploaded.json();
  const parsed=await until(async()=>{const d=await(await h.request(h.a,'/api/candidate')).json();return d.sources.find(s=>s.id===source.id&&s.status==='review_required')&&d;},'Responses source interpretation');
  assert.ok(parsed.proposals.some(p=>p.source_id===source.id&&p.field_key==='experience.fixture'));
  assert.equal(parsed.facts.some(p=>p.field_key==='experience.fixture'),false,'model proposals are not approved');
  assert.ok(h.captured.every(r=>r.endpoint==='/v1/responses'&&r.wire.store===false));
  assert.ok(h.captured.some(r=>r.wire.text?.format.type==='json_object'));
  assert.ok(h.captured.some(r=>r.wire.max_output_tokens===8192));
 }finally{await h.stopWorker(worker);}
});
