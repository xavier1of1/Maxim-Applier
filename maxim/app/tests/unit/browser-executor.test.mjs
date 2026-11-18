import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {BrowserExecutor} from '../../src/server/browser/executor.ts';
import {destination} from '../../src/server/browser/policy.ts';
import {createFixture,removeFixture} from '../../../lib/test-resources.mjs';

test('real agent-browser observes, fills, refuses stale values and blocks final effects before manual handoff',async()=>{
 const root=createFixture('maxim-test-browser-'),previous=process.env.MAXIM_RUNTIME_FILE;
 let submissions=0,submittedBytes=Buffer.alloc(0);const server=http.createServer(async(req,res)=>{
  if(req.method==='POST'){const chunks=[];for await(const chunk of req)chunks.push(chunk);submittedBytes=Buffer.concat(chunks);submissions++;res.end('accepted');return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><form action="/submit" method="POST" enctype="multipart/form-data"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email"></label><label hidden>Resume<input type="file" name="resume"></label><input type="hidden" name="csrf" value="fixture-token"><label>Team<select name="team"><option value="backend">Backend</option><option value="frontend">Frontend</option></select></label><label>Reason<textarea name="reason"></textarea></label><button type="submit">Submit application</button></form>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const runtime=path.join(root,'runtime.json');fs.writeFileSync(runtime,JSON.stringify({databaseUrl:'postgresql://maxim:fixture@127.0.0.1:5432/maxim_test_browser',origin,privateRoot:root,workspaceId:crypto.randomUUID(),bootstrapKey:'synthetic-access-key-not-production-12345',model:{model:'',apiKey:'',baseUrl:origin},testMode:true,discoveryFixtureOrigin:origin}));process.env.MAXIM_RUNTIME_FILE=runtime;
 const executor=new BrowserExecutor(crypto.randomUUID(),origin,origin+'/apply');
 try{
  assert.equal(destination('https://jobs.lever.co/example/123?source=public').url,'https://jobs.lever.co/example/123/apply?source=public');
  assert.equal(destination('https://jobs.lever.co/example/123/apply').url,'https://jobs.lever.co/example/123/apply');
  assert.throws(()=>destination('https://www.linkedin.com/jobs/view/123'),e=>e.code==='browser_unsupported');
  const first=await executor.open();assert.equal(first.fields.length,5);
  const name=first.fields.find(f=>f.name==='name');assert.ok(name);
  const filled=await executor.fill(name,first.id,'Synthetic Candidate');assert.ok(filled.observation.fields.find(f=>f.name==='name').valueHash!==name.valueHash);
  await assert.rejects(()=>executor.fill(name,first.id,'Overwritten'),e=>e.code==='browser_observation_stale');
  const pdf=Buffer.from('%PDF-1.7\nSynthetic approved packet bytes\n%%EOF');
  const attached=await executor.attach(filled.observation.fields.find(f=>f.name==='resume'),filled.observation.id,pdf);
  const selected=await executor.fill(attached.observation.fields.find(f=>f.name==='team'),attached.observation.id,'frontend');
  assert.ok(selected.observation.fields.find(f=>f.name==='team'));
  await executor.invoke('eval',{script:'history.pushState(null,"","/another-opening");true'});
  await assert.rejects(()=>executor.fill(selected.observation.fields.find(f=>f.name==='reason'),selected.observation.id,'Wrong opening'),e=>e.code==='browser_origin_changed');
  await executor.invoke('eval',{script:'history.pushState(null,"","/apply");true'});
  await executor.invoke('eval',{script:'document.forms[0].requestSubmit();true'}).catch(()=>{});
  await executor.invoke('eval',{script:'fetch("/submit",{method:"POST",body:"synthetic"}).catch(()=>{});true'});
  assert.equal(submissions,0,'browser network/DOM guards prevent final effects');
  const current=await executor.observe(),submit=current.fields.find(f=>f.type==='submit');
  if(submit)await assert.rejects(()=>executor.fill(submit,current.id,'x'),e=>e.code==='browser_action_denied');
  await executor.handoff();await executor.invoke('eval',{script:'document.forms[0].requestSubmit();true'}).catch(()=>{});
  for(let i=0;i<30&&!submissions;i++)await new Promise(r=>setTimeout(r,100));assert.equal(submissions,1,'only explicit manual handoff releases final-action guards');
  assert.ok(submittedBytes.includes(pdf),'manual form submission retains the exact selected PDF bytes');
 }finally{
  await executor.close().catch(()=>{});server.closeAllConnections();await new Promise(r=>server.close(r));
  if(previous===undefined)delete process.env.MAXIM_RUNTIME_FILE;else process.env.MAXIM_RUNTIME_FILE=previous;
  removeFixture(root,{allowCurrent:true});
 }
});
