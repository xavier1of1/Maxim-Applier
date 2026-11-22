import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
import {harness} from '../support/harness.mjs';
import {apiCommand,until} from '../support/assisted-application.mjs';
import {checkLease} from '../../src/server/work.ts';
import {assertAutoGrant} from '../../src/server/intelligence-budget.ts';
async function person(h){
 for(const [fieldKey,value]of [['candidate.name','Guard Fixture'],['skills.languages','Rust']])await apiCommand(h,'candidate','manual_fact',{fieldKey,value,expectedFactRevision:0,modelConsent:true,reason:'Synthetic guarded evaluation test'});
 const c=(await(await h.request(h.a,'/api/candidate')).json()).candidate;
 const p=await(await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'prepare',expectedRevision:c.revision}})).json();
 assert.equal((await h.request(h.a,'/api/candidate/cutover',{method:'POST',body:{commandId:crypto.randomUUID(),action:'activate',expectedRevision:c.revision,transitionId:p.result.id}})).status,200);
}
const policy={autoScore:true,dailyBudgetCents:1000,inputUsdPerMillion:1,outputUsdPerMillion:1,pricingModel:'fixture-model'};
async function job(h,description,minutes=0){const id=crypto.randomUUID();await h.sql("INSERT INTO jobs(id,workspace_id,company,title,location,description,posted_at,discovery_policy) VALUES($1,$2,$3,'Software Engineer','Reston, VA',$4,now()-$5*interval '1 minute',$6)",[id,h.c.workspaceId,'Guard '+id,description,minutes,JSON.stringify({flags:[{flagType:'location',severity:'positive'}]})]);return id;}

test('preflight failure releases unsent allowance; dispatch day and lease use wall-clock checks',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());await person(h);
 await job(h,'Rust engineering '+Array.from({length:1500},(_,n)=>crypto.createHash('sha256').update(String(n)).digest('hex')).join(''));
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{...policy,evaluationsPerCycle:1,evaluationsPerDay:1},acknowledgeAutomation:true});await apiCommand(h,'intelligence','run',{});await h.startWorker();
 const reservation=await until(async()=>{const v=(await h.sql('SELECT * FROM evaluation_reservations WHERE workspace_id=$1',[h.c.workspaceId])).rows[0];return v?.status==='released'&&v;},'unsent preflight reservation release');
 assert.equal(h.captured.length,0);const v=await(await h.request(h.a,'/api/intelligence')).json();assert.equal(v.budget.requests,0);assert.equal(v.budget.cents,0);
 const client=new pg.Client({connectionString:h.c.databaseUrl});await client.connect();const old=process.env.MAXIM_RUNTIME_FILE;process.env.MAXIM_RUNTIME_FILE=h.runtime;
 try{
  await client.query('BEGIN');
  await client.query("UPDATE evaluation_reservations SET status='reserved',created_at=clock_timestamp()-interval '1 day' WHERE id=$1",[reservation.id]);
  await assert.rejects(()=>assertAutoGrant(client,h.c.workspaceId,reservation.id),e=>e.code==='reservation_expired');await client.query('ROLLBACK');
  await client.query('BEGIN');const id=crypto.randomUUID(),token=crypto.randomUUID();
  await client.query("INSERT INTO work_items(id,workspace_id,kind,dedupe_key,input,status,lease_owner,lease_token,lease_until) VALUES($1,$2,'fixture_clock','clock','{}','leased','fixture',$3,clock_timestamp()+interval '150 milliseconds')",[id,h.c.workspaceId,token]);
  await client.query('SELECT pg_sleep(0.3)');
  await assert.rejects(()=>checkLease(client,{id,workspace_id:h.c.workspaceId,lease_token:token,lease_owner:'fixture'}),e=>e.code==='lease_lost');
 }finally{await client.query('ROLLBACK');await client.end();if(old===undefined)delete process.env.MAXIM_RUNTIME_FILE;else process.env.MAXIM_RUNTIME_FILE=old;}
});

test('posting-specific rejection does not block later eligible work or repeat forever',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());await person(h);
 const bad=await job(h,'Rust engineer building customer software. Wabtec confidential internal-only proprietary material must never enter a model request.');
 const good=await job(h,'Rust engineer building customer integrations and useful software for deployment teams.',1);
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{...policy,evaluationsPerCycle:2},acknowledgeAutomation:true});await apiCommand(h,'intelligence','run',{});await h.startWorker();
 await until(async()=>(await h.sql("SELECT 1 FROM evaluations WHERE workspace_id=$1 AND job_id=$2 AND status='completed'",[h.c.workspaceId,good])).rowCount,'later safe evaluation');
 assert.equal(h.captured.length,1);assert.equal((await h.sql('SELECT count(*) FROM evaluations WHERE job_id=$1',[bad])).rows[0].count,'0');
 assert.ok((await h.sql('SELECT reason FROM intelligence_job_holds WHERE job_id=$1',[bad])).rows[0].reason);
 await apiCommand(h,'intelligence','run',{});
 await until(async()=>(await h.sql("SELECT count(*)::int AS n FROM intelligence_cycles WHERE workspace_id=$1 AND status='completed'",[h.c.workspaceId])).rows[0].n>=2);
 assert.equal(h.captured.length,1);
});

test('rotating screening windows reach eligible jobs beyond a held 200-row prefix',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());await person(h);
 await h.sql("INSERT INTO jobs(id,workspace_id,company,title,description,posted_at,discovery_policy) SELECT gen_random_uuid(),$1,'Held prefix','Principal Engineer','Rust customer software with extensive leadership requirements.',now(),$2 FROM generate_series(1,200)",[h.c.workspaceId,JSON.stringify({flags:[{flagType:'location',severity:'positive'}]})]);
 const good=await job(h,'Rust engineering customer software integrations and delivery with an experienced team.',5);
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:policy,acknowledgeAutomation:true});await apiCommand(h,'intelligence','run',{});await h.startWorker();
 await until(async()=>(await h.sql("SELECT 1 FROM evaluations WHERE workspace_id=$1 AND job_id=$2 AND status='completed'",[h.c.workspaceId,good])).rowCount,'eligible role after held prefix');assert.equal(h.captured.length,1);
});

test('local complete candidates remain visible when the all-scanned window rotates into a global backlog',{timeout:120000},async t=>{
 const h=await harness();t.after(()=>h.close());await person(h);
 await h.sql("INSERT INTO jobs(id,workspace_id,company,title,location,description,opening_key,posted_at,discovery_policy) SELECT gen_random_uuid(),$1,'Global '||n,'Software Engineer','San Francisco, CA','Rust customer software integrations and useful production delivery.','global:'||n,now(),'{}' FROM generate_series(1,220) n",[h.c.workspaceId]);
 const local=await job(h,'Rust customer software integrations and useful production delivery.',60);
 await h.sql("UPDATE jobs SET opening_key='local:fixture' WHERE id=$1",[local]);
 await apiCommand(h,'intelligence','save',{expectedRevision:0,changes:{...policy,autoScore:false,scoringScope:'all_scanned',evaluationsPerCycle:1},acknowledgeAutomation:false});
 let v=await(await h.request(h.a,'/api/intelligence')).json();assert.equal(v.preview.selected[0].id,local);
 await apiCommand(h,'intelligence','run',{});await h.startWorker();
 await until(async()=>(await h.sql("SELECT 1 FROM intelligence_cycles WHERE workspace_id=$1 AND status='completed'",[h.c.workspaceId])).rowCount);
 v=await(await h.request(h.a,'/api/intelligence')).json();assert.equal(v.preview.window.offset,200);assert.equal(v.preview.selected[0].id,local);assert.equal(h.captured.length,0);
});
