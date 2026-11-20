import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {transaction} from './db';
import {config} from './config';
import {policyFor,intelligenceLock,type IntelligencePolicy} from './intelligence-policy';
import {invariant} from './errors';
import type {WorkItem} from './work';

export function reserveCost(p:IntelligencePolicy){
 // Input UTF-8 bytes conservatively bound text tokens; framing is reserved separately.
 const input=196608+4096,output=8192;
 return {tokens:input+output,cents:Math.ceil((input*p.inputUsdPerMillion+output*p.outputUsdPerMillion)/10000)};
}
export async function budgetView(tx:PoolClient,w:string,p:IntelligencePolicy){
 const row=(await tx.query(`SELECT count(*) FILTER(WHERE status<>'released')::int AS requests,
 coalesce(sum(CASE WHEN status='released' THEN 0 WHEN status='settled' THEN charged_cents ELSE reserved_cents END),0)::float8 AS cents,
 coalesce(sum(CASE WHEN status='released' THEN 0 WHEN status='settled' AND usage IS NOT NULL THEN coalesce((usage->>'prompt_tokens')::int,0)+coalesce((usage->>'completion_tokens')::int,0) ELSE reserved_tokens END),0)::int AS tokens
 FROM evaluation_reservations WHERE workspace_id=$1 AND (created_at AT TIME ZONE $2)::date=(clock_timestamp() AT TIME ZONE $2)::date`,[w,p.timezone])).rows[0];
 return {...row,limitCents:p.dailyBudgetCents,limitRequests:p.evaluationsPerDay,limitTokens:p.dailyTokenBudget};
}
export async function reserveEvaluation(tx:PoolClient,w:string,cycleId:string,revision:number,p:IntelligencePolicy){
 await intelligenceLock(tx,w);const live=await policyFor(tx,w),c=config();
 invariant(live.revision===revision&&live.value.autoScore&&p.pricingModel===c.model.model&&p.inputUsdPerMillion>0&&p.outputUsdPerMillion>0,'automation_not_authorized','Review model pricing and automatic evaluation consent first.',409);
 const cost=reserveCost(p),used=await budgetView(tx,w,p);
 invariant(used.requests<p.evaluationsPerDay&&used.cents+cost.cents<=p.dailyBudgetCents&&used.tokens+cost.tokens<=p.dailyTokenBudget,'evaluation_budget_exhausted','Automatic evaluation allowance is exhausted. Review limits or wait for the next policy-local day.',409);
 const id=crypto.randomUUID();
 await tx.query('INSERT INTO evaluation_reservations(id,workspace_id,cycle_id,policy_revision,model,api,reserved_cents,reserved_tokens,created_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,clock_timestamp())',[id,w,cycleId,revision,c.model.model,c.model.api,cost.cents,cost.tokens]);return id;
}
export async function assertAutoGrant(tx:PoolClient,w:string,id:string){
 const r=(await tx.query('SELECT * FROM evaluation_reservations WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,id])).rows[0],p=await policyFor(tx,w),c=config();
 invariant(r&&p.value.autoScore&&p.revision===r.policy_revision&&r.model===c.model.model&&r.api===c.model.api&&p.value.pricingModel===c.model.model,'automation_revoked','Automatic scoring settings or model changed; queued work is held.',409);
 const day=(await tx.query('SELECT ($1::timestamptz AT TIME ZONE $2)::date=(clock_timestamp() AT TIME ZONE $2)::date AS current',[r.created_at,p.value.timezone])).rows[0];
 invariant(r.status!=='reserved'||day.current,'reservation_expired','A queued reservation crossed its policy-local day; create a new cycle after review.',409);return r;
}
export async function reconcileReservations(tx:PoolClient,w:string){
 await intelligenceLock(tx,w);
 await tx.query(`UPDATE evaluation_reservations r SET status=CASE WHEN r.status='reserved' THEN 'released' ELSE 'uncertain' END
 FROM evaluations e,work_items x WHERE r.workspace_id=$1 AND r.evaluation_id=e.id AND e.workspace_id=r.workspace_id AND x.id=e.work_id AND x.workspace_id=r.workspace_id
 AND r.status IN ('reserved','sending') AND (x.status IN ('failed','cancelled','completed') OR (x.status='leased' AND x.lease_until<now()))`,[w]);
}
export async function beginAutomaticDispatch(tx:PoolClient,item:WorkItem){
 const id=item.input.autoReservationId;if(!id)return;
 await intelligenceLock(tx,item.workspace_id);const r=await assertAutoGrant(tx,item.workspace_id,String(id));
 invariant(r.status==='reserved','automatic_send_uncertain','This request already entered dispatch. No automatic retransmission is permitted.',409);
 const other=await tx.query("SELECT 1 FROM evaluation_reservations WHERE workspace_id=$1 AND status='sending' AND id<>$2 LIMIT 1",[item.workspace_id,id]);
 invariant(!other.rowCount,'automatic_concurrency_limit','Another automatic request is in flight. Review the cycle rather than retrying invisibly.',409);
 await tx.query("UPDATE evaluation_reservations SET status='sending' WHERE workspace_id=$1 AND id=$2",[item.workspace_id,id]);
}
export async function finishAutomaticSpend(item:WorkItem,usage:Record<string,any>|null){
 const id=item.input.autoReservationId;if(!id)return;
 await transaction(async tx=>{
  await intelligenceLock(tx,item.workspace_id);
  const r=(await tx.query('SELECT r.*,c.receipt FROM evaluation_reservations r JOIN intelligence_cycles c ON c.id=r.cycle_id AND c.workspace_id=r.workspace_id WHERE r.workspace_id=$1 AND r.id=$2 FOR UPDATE OF r',[item.workspace_id,id])).rows[0];
  if(!r||['settled','released','uncertain'].includes(r.status))return;
  const input=usage?.prompt_tokens,output=usage?.completion_tokens,p=r.receipt.policy;
  if(Number.isInteger(input)&&input>=0&&Number.isInteger(output)&&output>=0&&p){
   const cents=Math.ceil((input*p.inputUsdPerMillion+output*p.outputUsdPerMillion)/10000);
   await tx.query("UPDATE evaluation_reservations SET status='settled',charged_cents=$1,usage=$2 WHERE workspace_id=$3 AND id=$4",[cents,JSON.stringify(usage),item.workspace_id,id]);
   if(cents>Number(r.reserved_cents))await tx.query("UPDATE discovery_policies SET value=jsonb_set(value,'{autoScore}','false'),revision=revision+1 WHERE workspace_id=$1",[item.workspace_id]);
  }else await tx.query("UPDATE evaluation_reservations SET status=CASE WHEN status='reserved' THEN 'released' ELSE 'uncertain' END WHERE workspace_id=$1 AND id=$2",[item.workspace_id,id]);
 });
}
export async function checkScanGrant(tx:PoolClient,w:string,grant:unknown){
 if(!grant)return;const g=grant as {policyRevision:number};const p=await policyFor(tx,w);
 invariant(p.active&&p.value.autoScan&&p.revision===g.policyRevision,'automation_revoked','Scheduled scanning was paused or its policy changed.',409);
}
