import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {preparedApplication,apiCommand,until,applicationForm} from '../support/assisted-application.mjs';

test('S6 real agent-browser, canonical packet, remembered unknown and denied final actions',async t=>{
 const h=await harness();let worker;
 const read=async()=>await(await h.request(h.a,'/api/browser')).json();
 const stable=async()=>until(async()=>{const d=await read();return !d.actions.some(a=>['queued','running'].includes(a.status))&&d;},'browser action acknowledgment');
 try{
  h.providerRoutes.set('/browser-form',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(applicationForm);});
  worker=await h.startWorker();const fixture=await preparedApplication(h);
  const payload={applicationId:fixture.app.id,expectedApplicationRevision:fixture.app.revision,packetId:fixture.packet.id,autosaveConsent:true,privateConsent:true};
  await apiCommand(h,'browser','open',{...payload,autosaveConsent:false},400);
  const id=crypto.randomUUID(),opened=await apiCommand(h,'browser','open',payload,200,id),same=await apiCommand(h,'browser','open',payload,200,id);assert.equal(opened.sessionId,same.sessionId);
  let d=await stable(),s=d.sessions[0];assert.equal(s.status,'observed',JSON.stringify(d.actions));assert.equal(s.observation.fields.length,4);
  await t.test('scope, arbitrary paths and final commands are denied',async()=>{
   await apiCommand(h,'browser','submit',{sessionId:s.id,expectedRevision:s.revision},400);
   await apiCommand(h,'browser','attach_packet',{sessionId:s.id,expectedRevision:s.revision,fieldId:s.observation.fields[0].id,observationId:s.observation.id,path:'.env'},400);
   await apiCommand(h,'browser','observe',{sessionId:s.id,expectedRevision:s.revision},404,crypto.randomUUID(),h.b);
  });
  await apiCommand(h,'browser','fill_known',{sessionId:s.id,expectedRevision:s.revision});d=await stable();s=d.sessions[0];
  assert.equal(s.status,'observed',JSON.stringify(d.actions));assert.equal(Object.values(s.progress).filter(p=>p.status==='filled_locally').length,2);assert.ok(Object.values(s.progress).some(p=>p.status==='attachment_selected'));
  const field=s.observation.fields.find(f=>f.name==='project');assert.ok(field);
  await t.test('an unknown is approved in S3, confirmed in exact scope and filled without a private browser cache',async()=>{
   const question=await apiCommand(h,'answers','save_question',{text:field.label,company:'Assisted Fixture',roleLane:'unspecified',answerType:'text',options:[],tags:[]});
   const answer=await apiCommand(h,'answers','draft_answer',{questionId:question.id,text:'I built customer integrations using Rust and TypeScript.',facts:[],expectedCandidateRevision:fixture.candidate.revision,permission:'company',modelConsent:false});
   const approved=await apiCommand(h,'answers','approve_answer',{answerId:answer.id,expectedRevision:answer.revision,contentHash:answer.content_hash,declarationConfirmed:true});
   const use=await apiCommand(h,'answers','prepare_reuse',{answerId:approved.id,expectedRevision:approved.revision,questionId:question.id});
   const confirmed=await apiCommand(h,'answers','confirm_reuse',{useId:use.id,expectedRevision:use.revision,contentHash:use.snapshot.contentHash,reviewed:true});
   await apiCommand(h,'browser','fill',{sessionId:s.id,expectedRevision:s.revision,fieldId:field.id,observationId:s.observation.id,evidence:{kind:'answer_use',id:confirmed.id,revision:confirmed.revision}});
   d=await stable();s=d.sessions[0];assert.equal(s.progress[field.signature].status,'filled_locally',JSON.stringify(d.actions));
   const library=await(await h.request(h.a,'/api/answers')).json();assert.equal(library.answers.length,1);assert.equal(library.answers[0].status,'approved');
   const revoked=await apiCommand(h,'answers','revoke_answer',{answerId:approved.id,expectedRevision:approved.revision,reason:'Synthetic correction after local filling'});
   await apiCommand(h,'browser','handoff',{sessionId:s.id,expectedRevision:s.revision,manualOnly:true},409);
   const corrected=await apiCommand(h,'answers','draft_answer',{answerId:approved.id,expectedRevision:revoked.revision,questionId:question.id,text:'I built reviewed customer integrations using Rust.',facts:[],expectedCandidateRevision:fixture.candidate.revision,permission:'company',modelConsent:false});
   const current=await apiCommand(h,'answers','approve_answer',{answerId:corrected.id,expectedRevision:corrected.revision,contentHash:corrected.content_hash,declarationConfirmed:true});
   const nextUse=await apiCommand(h,'answers','prepare_reuse',{answerId:current.id,expectedRevision:current.revision,questionId:question.id});
   const reviewed=await apiCommand(h,'answers','confirm_reuse',{useId:nextUse.id,expectedRevision:nextUse.revision,contentHash:nextUse.snapshot.contentHash,reviewed:true});
   const observed=s.observation.fields.find(f=>f.name==='project');
   await apiCommand(h,'browser','fill',{sessionId:s.id,expectedRevision:s.revision,fieldId:observed.id,observationId:s.observation.id,evidence:{kind:'answer_use',id:reviewed.id,revision:reviewed.revision}});
   d=await stable();s=d.sessions[0];assert.equal(s.progress[observed.signature].evidence.id,reviewed.id);
  });
  await apiCommand(h,'browser','pause',{sessionId:s.id,expectedRevision:s.revision});d=await stable();s=d.sessions[0];assert.equal(s.status,'paused');
  await apiCommand(h,'browser','resume',{sessionId:s.id,expectedRevision:s.revision});d=await stable();s=d.sessions[0];assert.equal(s.status,'observed');assert.equal(Object.keys(s.progress).length,4);
  const applications=await(await h.request(h.a,'/api/applications')).json();assert.equal(applications.applications.find(a=>a.id===fixture.app.id).outcome,'not_submitted');
  await apiCommand(h,'browser','handoff',{sessionId:s.id,expectedRevision:s.revision,manualOnly:true});d=await stable();s=d.sessions[0];assert.equal(s.status,'manual_handoff');
  await apiCommand(h,'browser','fill_known',{sessionId:s.id,expectedRevision:s.revision},400);
  await apiCommand(h,'browser','close',{sessionId:s.id,expectedRevision:s.revision});d=await stable();assert.equal(d.sessions[0].status,'closed');
 }finally{if(worker)await h.stopWorker(worker);await h.close();}
});
