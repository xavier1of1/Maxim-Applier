import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {preparedApplication,apiCommand,until,applicationForm} from '../support/assisted-application.mjs';

for(const rehearsal of [1,2])test('S11 mounted-product rehearsal '+rehearsal+' preserves lineage, recovery and manual control',async()=>{
 const h=await harness();let worker;
 const read=async route=>{const r=await h.request(h.a,route);assert.equal(r.status,200,route);return r.json();};
 const stable=()=>until(async()=>{const d=await read('/api/browser');return !d.actions.some(a=>['queued','running'].includes(a.status))&&d;},'mounted browser action');
 try{
  h.providerRoutes.set('/browser-form',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end(applicationForm);});
  worker=await h.startWorker();const f=await preparedApplication(h);
  for(const route of ['/api/browser','/api/gmail','/api/discord','/api/networking','/api/networking/metrics','/api/interview']){
   assert.equal((await h.request(null,route)).status,401,route+' is authenticated');await read(route);
  }
  for(const route of ['/api/gmail','/api/discord'])assert.ok((await h.request(h.b,route)).status>=400,'owner integrations deny the second identity');
  const before=await read('/api/applications');
  assert.equal(before.applications.find(a=>a.id===f.app.id).outcome,'not_submitted');
  assert.equal(before.packets.find(p=>p.id===f.packet.id).pdf_hash,f.packet.pdf_hash);
  const dump=path.join(h.root,'rehearsal.sql');h.snapshotDatabase(dump);
  const restored=await h.restoreDatabase(fs.readFileSync(dump),'maxim_test_restore_'+Date.now());assert.equal(restored.applications,1);
  await h.stopWorker(worker);worker=null;await h.stopServer();await h.startServer();worker=await h.startWorker();
  const after=await read('/api/applications');assert.equal(after.packets.find(p=>p.id===f.packet.id).content_hash,f.packet.content_hash);
  const payload={applicationId:f.app.id,packetId:f.packet.id,expectedApplicationRevision:after.applications.find(a=>a.id===f.app.id).revision,autosaveConsent:true,privateConsent:true};
  await h.sql('UPDATE jobs SET application_url=$1 WHERE workspace_id=$2 AND id=$3',['https://unsupported.example.test/job',h.c.workspaceId,f.job.id]);
  await apiCommand(h,'browser','open',payload,400);
  await h.sql('UPDATE jobs SET application_url=$1 WHERE workspace_id=$2 AND id=$3',[h.c.discoveryFixtureOrigin+'/browser-form',h.c.workspaceId,f.job.id]);
  await apiCommand(h,'browser','open',payload);let d=await stable(),s=d.sessions[0];assert.equal(s.status,'observed');
  await apiCommand(h,'browser','fill_known',{sessionId:s.id,expectedRevision:s.revision});d=await stable();s=d.sessions[0];
  assert.ok(Object.values(s.progress).some(p=>p.status==='attachment_selected'));
  const unknown=s.observation.fields.find(x=>x.name==='project');assert.ok(unknown);assert.equal(s.progress[unknown.signature],undefined,'unknown answers are not invented');
  await apiCommand(h,'browser','pause',{sessionId:s.id,expectedRevision:s.revision});d=await stable();s=d.sessions[0];assert.equal(s.status,'paused');
  await apiCommand(h,'browser','fill_known',{sessionId:s.id,expectedRevision:s.revision},409);
  await apiCommand(h,'browser','resume',{sessionId:s.id,expectedRevision:s.revision});d=await stable();s=d.sessions[0];assert.equal(s.status,'observed');
  await apiCommand(h,'browser','handoff',{sessionId:s.id,expectedRevision:s.revision,manualOnly:true});d=await stable();s=d.sessions[0];assert.equal(s.status,'manual_handoff');
  assert.equal((await read('/api/applications')).applications.find(a=>a.id===f.app.id).outcome,'not_submitted');
  await apiCommand(h,'browser','close',{sessionId:s.id,expectedRevision:s.revision});await stable();
  const privacy=h.captured.map(r=>JSON.stringify(r.body)).join('\n');assert.ok(!privacy.includes('synthetic@example.test'),'private contact facts stay out of model requests');
  assert.equal(Number((await h.sql('SELECT count(*) FROM discord_notifications')).rows[0].count),0,'disabled delivery never queues real sends');
  assert.equal(Number((await h.sql('SELECT count(*) FROM gmail_accounts')).rows[0].count),0,'tests do not connect a mailbox');
  assert.ok((await h.sql('SELECT 1 FROM events WHERE workspace_id=$1 AND entity_id=$2',[h.c.workspaceId,f.app.id])).rowCount,'same application retains its audit lineage');
 }finally{if(worker)await h.stopWorker(worker);await h.close();}
});
