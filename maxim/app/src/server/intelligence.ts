import crypto from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {transaction} from './db';
import {type Context,reauthorize} from './auth';
import {command,event,uuid} from './commands';
import {candidateLock} from './sources';
import {intelligenceSchema,policyFor,intelligenceLock,capacity} from './intelligence-policy';
import {budgetView,reconcileReservations,reserveCost} from './intelligence-budget';
import {enqueueCycle,screening} from './intelligence-cycle';
import {config} from './config';
import {invariant,notFound} from './errors';
import {applicationLock} from './application-authority';

const patch=intelligenceSchema.partial();
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('save'),payload:z.object({expectedRevision:z.number().int().min(0),changes:patch,acknowledgeAutomation:z.boolean().default(false)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['pause','run']),payload:z.object({}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['approve_proposal','reject_proposal']),payload:z.object({id:uuid,acknowledgeAutomation:z.boolean().default(false)}).strict()}).strict(),
]);
async function save(tx:PoolClient,ctx:Context,revision:number,changes:z.infer<typeof patch>,ack:boolean){
 const w=ctx.workspaceId,p=await policyFor(tx,w),v=intelligenceSchema.parse({...p.value,...changes});
 invariant(p.revision===revision,'revision_conflict','Discovery settings changed. Refresh and review them again.',409);
 if(v.autoScan||v.autoScore||v.cleanupEnabled)invariant(ack,'automation_consent_required','Confirm scheduled requests, their spending allowance and cleanup protection policy.',409);
 if(v.autoScore){const c=config();invariant(Boolean(c.model.apiKey)&&v.pricingModel===c.model.model&&v.inputUsdPerMillion>0&&v.outputUsdPerMillion>0&&v.dailyBudgetCents>=reserveCost(v).cents&&v.dailyTokenBudget>=reserveCost(v).tokens,'pricing_review_required','Select the current model, review input/output prices and allow at least one conservatively reserved request.',409);}
 if(v.autoScan){const sources=(await tx.query("SELECT id FROM discovery_sources WHERE workspace_id=$1 AND id=ANY($2::uuid[]) AND enabled AND provider IN ('greenhouse','lever','ashby')",[w,v.sourceIds])).rows;invariant(sources.length>0&&sources.length===v.sourceIds.length,'select_public_sources','Select one to three enabled public boards.',409);}
 await tx.query('INSERT INTO discovery_policies(workspace_id,value) VALUES($1,$2) ON CONFLICT(workspace_id) DO UPDATE SET value=EXCLUDED.value,revision=discovery_policies.revision+1,updated_at=now(),next_scan_at=now(),next_score_at=now(),next_cleanup_at=now()',[w,JSON.stringify(v)]);
 await event(tx,ctx,w,'discovery_policy_saved',{revision:revision+1,autoScan:v.autoScan,autoScore:v.autoScore,cleanupEnabled:v.cleanupEnabled,maxActiveJobs:v.maxActiveJobs},revision+1);
 return {revision:revision+1};
}
export async function intelligenceCommand(ctx:Context,raw:unknown){
 invariant(ctx.isOwner,'not_found','Record not found.',404);const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  await candidateLock(tx,ctx.workspaceId);await applicationLock(tx,ctx.workspaceId);await intelligenceLock(tx,ctx.workspaceId);const p=await policyFor(tx,ctx.workspaceId);
  if(c.action==='run')return enqueueCycle(tx,ctx.workspaceId);
  if(c.action==='pause')return save(tx,ctx,p.revision,{autoScan:false,autoScore:false,cleanupEnabled:false},false);
  if(c.action==='save')return save(tx,ctx,c.payload.expectedRevision,c.payload.changes,c.payload.acknowledgeAutomation);
  const proposal=(await tx.query("SELECT * FROM intelligence_proposals WHERE workspace_id=$1 AND id=$2 AND status='pending' FOR UPDATE",[ctx.workspaceId,c.payload.id])).rows[0];if(!proposal)throw notFound();
  if(c.action==='approve_proposal')await save(tx,ctx,proposal.expected_revision,proposal.changes,c.payload.acknowledgeAutomation);
  await tx.query('UPDATE intelligence_proposals SET status=$1 WHERE workspace_id=$2 AND id=$3',[c.action==='approve_proposal'?'approved':'rejected',ctx.workspaceId,proposal.id]);return {id:proposal.id};
 });
}
export async function intelligenceView(ctx:Context){
 return transaction(async tx=>{
  await reauthorize(tx,ctx);const p=await policyFor(tx,ctx.workspaceId),w=ctx.workspaceId;
  const cycles=(await tx.query('SELECT c.*,x.status AS work_status,x.error_code FROM intelligence_cycles c LEFT JOIN work_items x ON x.id=c.work_id AND x.workspace_id=c.workspace_id WHERE c.workspace_id=$1 ORDER BY c.created_at DESC LIMIT 10',[w])).rows;
  const reservations=(await tx.query('SELECT id,evaluation_id,status,reserved_cents,charged_cents,created_at FROM evaluation_reservations WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 20',[w])).rows;
  const proposals=(await tx.query("SELECT * FROM intelligence_proposals WHERE workspace_id=$1 AND status='pending' ORDER BY created_at DESC LIMIT 10",[w])).rows;
  const s=await screening(tx,w),sources=(await tx.query('SELECT id,name,provider,enabled,industry FROM discovery_sources WHERE workspace_id=$1 ORDER BY name,id LIMIT 200',[w])).rows;
  return {policy:{value:p.value,revision:p.revision,active:p.active},capacity:await capacity(tx,w),budget:await budgetView(tx,w,p.value),reservation:reserveCost(p.value),model:config().model.model,sources,cycles,reservations,proposals,
   preview:{selected:s.selected,held:s.held,jobs:s.jobs.map(j=>({id:j.id,title:j.title,company:j.company})),evidenceAvailable:s.evidenceAvailable},asOf:new Date().toISOString()};
 });
}
export async function intelligenceTool(ctx:Context,rid:string,name:string,args:unknown){
 if(name==='read_discovery_settings'){
  z.object({}).strict().parse(args);const v=await intelligenceView(ctx);return {policy:v.policy,capacity:v.capacity,budget:v.budget,model:v.model,sources:v.sources,holds:v.preview.held.slice(0,10),requiresOwnerApproval:true};
 }
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 const p=z.object({expectedRevision:z.number().int().min(0),changesJson:z.string().max(4000),quote:z.string().min(1).max(4000)}).strict().parse(args);
 let changes:unknown;try{changes=JSON.parse(p.changesJson);}catch{invariant(false,'invalid_settings','Settings changes must be JSON.');}const value=patch.parse(changes);
 invariant(Object.keys(value).length>0,'empty_proposal','No settings changes were proposed.');
 return transaction(async tx=>{
  await reauthorize(tx,ctx);await intelligenceLock(tx,ctx.workspaceId);
  const user=(await tx.query("SELECT m.content FROM messages m JOIN runs r ON r.id=m.run_id AND r.workspace_id=m.workspace_id WHERE m.workspace_id=$1 AND m.run_id=$2 AND m.role='user' AND r.status='running' ORDER BY m.sequence DESC LIMIT 1",[ctx.workspaceId,rid])).rows[0];
  invariant(user?.content.text===p.quote&&/\b(change|set|adjust|limit|pause|enable|disable|scan|budget|frequency)\b/i.test(p.quote),'explicit_request_required','Quote the exact current settings request.');
  invariant((await policyFor(tx,ctx.workspaceId)).revision===p.expectedRevision,'revision_conflict','Read current settings before proposing changes.',409);
  const id=crypto.randomUUID();await tx.query('INSERT INTO intelligence_proposals(id,workspace_id,expected_revision,changes,reason) VALUES($1,$2,$3,$4,$5)',[id,ctx.workspaceId,p.expectedRevision,JSON.stringify(value),p.quote]);return {id,status:'pending_owner_review',view:'settings',changes:value};
 });
}
