import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {harness} from '../support/harness.mjs';
import {apiCommand,until} from '../support/assisted-application.mjs';

test('crashed automatic sends retain allowance and are never automatically transmitted again',{timeout:90000},async t=>{
 const h=await harness();t.after(()=>h.close());
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{}});
 const [job,work,evaluation,cycle,reservation]=Array.from({length:5},()=>crypto.randomUUID()),w=h.c.workspaceId;
 await h.sql("INSERT INTO jobs(id,workspace_id,company,title,description) VALUES($1,$2,'Crash Fixture','Software Engineer','Synthetic interrupted request fixture')",[job,w]);
 await h.sql("INSERT INTO work_items(id,workspace_id,kind,dedupe_key,input,status,attempts,max_attempts,lease_owner,lease_token,lease_until) VALUES($1,$2,'evaluate_job',$5,$3,'leased',1,1,'crashed-worker',$4,now()-interval '1 minute')",[work,w,JSON.stringify({evaluationId:evaluation,autoReservationId:reservation}),crypto.randomUUID(),work]);
 await h.sql("INSERT INTO evaluations(id,workspace_id,job_id,work_id,status,job_revision,candidate_revision,input_snapshot,input_hash,prompt_hash,model,provider) VALUES($1,$2,$3,$4,'running',1,1,'{}','fixture','fixture','fixture-model','fixture')",[evaluation,w,job,work]);
 await h.sql("INSERT INTO intelligence_cycles(id,workspace_id,policy_revision,kind,receipt) VALUES($1,$2,1,'scheduled',$3)",[cycle,w,JSON.stringify({policy:{inputUsdPerMillion:1,outputUsdPerMillion:1}})]);
 await h.sql("INSERT INTO evaluation_reservations(id,workspace_id,cycle_id,evaluation_id,policy_revision,model,api,status,reserved_cents,reserved_tokens) VALUES($1,$2,$3,$4,1,'fixture-model','chat_completions','sending',25,208896)",[reservation,w,cycle,evaluation]);
 await h.startWorker();
 await until(async()=>{const row=(await h.sql('SELECT status FROM evaluation_reservations WHERE id=$1',[reservation])).rows[0];return row.status==='uncertain';},'uncertain spend reconciliation');
 assert.equal(h.captured.length,0);assert.equal((await h.sql('SELECT attempts FROM work_items WHERE id=$1',[work])).rows[0].attempts,1);
 const v=await(await h.request(h.a,'/api/intelligence')).json();assert.equal(v.budget.requests,1);assert.equal(v.budget.cents,25);assert.equal(v.reservations[0].status,'uncertain');
});
