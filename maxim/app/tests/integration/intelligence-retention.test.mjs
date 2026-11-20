import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {apiCommand} from '../support/assisted-application.mjs';

test('compaction preserves protected evidence, rejects changed previews and restores compact identity',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{maxActiveJobs:20}});
 const ids=Array.from({length:24},()=>crypto.randomUUID());
 for(const id of ids)await h.sql("INSERT INTO jobs(id,workspace_id,company,title,location,description,posted_at,created_at,updated_at) VALUES($1,$2,'Retention Fixture','Full Stack Engineer','Reston, VA','About us\nRequirements\nRust and TypeScript experience\nBenefits\nHealth plan',now()-interval '40 days',now()-interval '40 days',now()-interval '40 days')",[id,h.c.workspaceId]);
 await h.sql("UPDATE jobs SET note='Human note must survive' WHERE id=$1",[ids[0]]);
 await h.request(h.a,'/api/commands',{method:'POST',body:{commandId:crypto.randomUUID(),action:'create_intent',payload:{jobId:ids[1]}}});
 const read=async path=>{const r=await h.request(h.a,path);assert.equal(r.status,200);return r.json();};
 let p=await read('/api/intelligence/cleanup');assert.equal(p.jobs.length,22);
 await apiCommand(h,'discovery','set_discovery_state',{jobId:ids[2],expectedRevision:1,state:'saved'});
 const apply=async fingerprint=>h.request(h.a,'/api/intelligence/retention',{method:'POST',body:{commandId:crypto.randomUUID(),action:'compact',payload:{fingerprint,confirmed:true}}});
 assert.equal((await apply(p.fingerprint)).status,409);
 p=await read('/api/intelligence/cleanup');assert.equal(p.jobs.length,21);
 const done=await apply(p.fingerprint);assert.equal(done.status,200);assert.equal((await done.json()).result.archived,21);
 const archived=await read('/api/archive');assert.equal(archived.total,21);assert.equal(archived.jobs[0].qualifications,'Requirements\nRust and TypeScript experience\n');
 assert.equal(archived.jobs[0].score,null);assert.equal((await(await h.request(h.b,'/api/archive')).json()).total,0);
 const cleared=(await h.sql("SELECT count(*)::int AS n FROM jobs WHERE workspace_id=$1 AND description='' AND compacted_at IS NOT NULL",[h.c.workspaceId])).rows[0].n;assert.equal(cleared,21);
 const protectedRows=(await h.sql('SELECT description FROM jobs WHERE id=ANY($1::uuid[])',[ids.slice(0,3)])).rows;assert.ok(protectedRows.every(j=>j.description.includes('Requirements')));
 const selected=archived.jobs[0];const restore=await h.request(h.a,'/api/intelligence/retention',{method:'POST',body:{commandId:crypto.randomUUID(),action:'restore',payload:{jobId:selected.job_id}}});assert.equal(restore.status,200);
 assert.equal((await read('/api/archive')).total,20);
 const restored=(await h.sql('SELECT * FROM jobs WHERE id=$1',[selected.job_id])).rows[0];assert.equal(restored.description,'');assert.equal(restored.archived,false);assert.equal(restored.compacted_at,null);
 // Submitted history is evidence-protected but does not permanently occupy lead slots.
 await h.sql("UPDATE applications SET outcome='submitted' WHERE job_id=$1",[ids[1]]);assert.equal((await read('/api/intelligence')).capacity.active,3);
 await h.sql("INSERT INTO work_items(id,workspace_id,kind,dedupe_key,input) VALUES($1,$2,'evaluate_job','busy-fixture','{}')",[crypto.randomUUID(),h.c.workspaceId]);
 p=await read('/api/intelligence/cleanup');assert.equal(p.busy,true);assert.equal(p.jobs.length,0);
});
