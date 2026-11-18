import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {delay} from '../../scripts/environment.mjs';

export async function apiCommand(h,endpoint,action,payload,status=200,id=crypto.randomUUID(),auth=h.a){
 const r=await h.request(auth,'/api/'+endpoint+'/commands',{method:'POST',body:{commandId:id,action,payload}}),v=await r.json();
 assert.equal(r.status,status,JSON.stringify(v));return v.result||v;
}
export async function until(read,description='fixture state'){
 for(let i=0;i<300;i++){const value=await read();if(value)return value;await delay(200);}throw Error('Timed out waiting for '+description);
}
export async function preparedApplication(h){
 for(const [fieldKey,value,modelConsent]of [['candidate.name','Assisted Example',true],['projects.summary','Built customer integrations using Rust and TypeScript.',true],['candidate.email','synthetic@example.test',false]])await apiCommand(h,'candidate','manual_fact',{fieldKey,value,expectedFactRevision:0,modelConsent,reason:'Synthetic assisted-application acceptance fixture'});
 const person=await(await h.request(h.a,'/api/candidate')).json();
 const transition=await(await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'prepare',expectedRevision:person.candidate.revision}})).json();
 assert.equal((await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'activate',expectedRevision:person.candidate.revision,transitionId:transition.result.id}})).status,200);
 const result=await(await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_job',payload:{company:'Assisted Fixture',title:'Software Engineer',description:'Build customer software in Reston, VA. Salary: 100000 USD annually. [score:4.6]',location:'Reston, VA',url:'https://jobs.lever.co/assisted-fixture/'+crypto.randomUUID()}}})).json();
 const job=result.result;assert.ok(job?.id);
 await h.sql('UPDATE jobs SET application_url=$1 WHERE workspace_id=$2 AND id=$3',[h.c.discoveryFixtureOrigin+'/browser-form',h.c.workspaceId,job.id]);
 await apiCommand(h,'applications','set_job_policy',{jobId:job.id,expectedJobRevision:1,expectedPolicyRevision:0,salary:{flat:100000,currency:'USD',period:'annual'},sourceQuote:'Salary: 100000 USD annually.'});
 const app=(await(await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_intent',payload:{jobId:job.id}}})).json()).result;
 await apiCommand(h,'evaluations','start_evaluation',{jobId:job.id,expectedJobRevision:1,expectedCandidateRevision:person.candidate.revision});
 const evaluation=await until(async()=>{const v=await(await h.request(h.a,'/api/applications')).json();return v.evaluations.find(e=>e.job_id===job.id&&e.status==='completed');},'retained evaluation');
 let view=await(await h.request(h.a,'/api/applications')).json();
 await apiCommand(h,'packets','build_packet',{applicationId:app.id,evaluationId:evaluation.id,expectedApplicationRevision:view.applications.find(a=>a.id===app.id).revision,facts:person.facts.filter(f=>f.sensitivity==='standard').map(f=>({id:f.id,revision:f.revision})),tailoredSelection:true});
 const packet=await until(async()=>{const v=await(await h.request(h.a,'/api/applications')).json();return v.packets.find(p=>p.application_id===app.id&&p.status==='draft');},'real PDF packet');
 await apiCommand(h,'packets','approve_packet',{packetId:packet.id,expectedRevision:packet.revision,contentHash:packet.content_hash,confirmed:true,reason:'Reviewed exact synthetic report, PDF and evidence hashes'});
 view=await(await h.request(h.a,'/api/applications')).json();return {job,app:view.applications.find(a=>a.id===app.id),packet:view.packets.find(p=>p.id===packet.id),candidate:person.candidate};
}
export const applicationForm='<!doctype html><title>Synthetic Application Fixture</title><form method="POST" action="/browser-submit" enctype="multipart/form-data"><label>Full name<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Resume<input name="resume" type="file" required></label><label>Describe a customer project?<textarea name="project" required></textarea></label><button type="submit">Submit application</button></form><p>Isolated synthetic test, not a real employer application.</p>';
