import crypto from 'node:crypto';
import {transaction} from '../server/db';
import {config} from '../server/config';
import {checkLease,finishWork,type WorkItem} from '../server/work';
import {DomainError,invariant} from '../server/errors';
import {buildPlan} from '../server/integrations/discord/planner';
import {readDestination} from '../server/integrations/discord/private';
import {postDiscord} from '../server/integrations/discord/transport';
import {enqueueDiscordEvent} from '../server/integrations/discord/outbox';
import {scheduleWindow} from '../server/integrations/discord/schedule';

export async function deliverDiscord(item:WorkItem,signal?:AbortSignal) {
 invariant(item.kind==='discord_delivery'&&item.workspace_id===config().workspaceId,'discord_scope_denied','Delivery workspace is not authorized.',403);
 const prepared=await transaction(async tx=>{
  const w=item.workspace_id,s=(await tx.query('SELECT * FROM discord_settings WHERE workspace_id=$1 FOR UPDATE',[w])).rows[0];
  await checkLease(tx,item);
  const n=(await tx.query('SELECT * FROM discord_notifications WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,item.input.notificationId])).rows[0];
  invariant(n&&n.work_id===item.id,'not_found','Delivery not found.',404);
  if(!['pending','retry'].includes(n.status)){
   if(n.status==='sending'){
    await tx.query(`UPDATE discord_attempts SET status='uncertain',error_code='lease_interrupted',completed_at=now() WHERE workspace_id=$1 AND notification_id=$2 AND status='sending'`,[w,n.id]);
    await tx.query(`UPDATE discord_notifications SET status='uncertain',error_code='lease_interrupted',updated_at=now() WHERE workspace_id=$1 AND id=$2`,[w,n.id]);
   }
   await finishWork(tx,item,{status:n.status==='sending'?'uncertain':n.status});return null;
  }
  const now=new Date();
  let stopCode='';
  if(!s?.enabled||!s.contents.includes(n.kind)||s.destination_revision!==n.destination_revision||s.destination_hash!==n.destination_hash)stopCode='consent_or_destination_changed';
  else if(n.attempts>=5)stopCode='attempts_exhausted';
  if(stopCode){await tx.query(`UPDATE discord_notifications SET status='cancelled',error_code=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3`,[stopCode,w,n.id]);await finishWork(tx,item,{status:'cancelled'});return null;}
  const available=Math.max(Number(new Date(n.available_at)),s.next_send_at?Number(new Date(s.next_send_at)):0);
  if(available>now.getTime()){
   await tx.query(`UPDATE work_items SET status='queued',attempts=greatest(0,attempts-1),available_at=$1,lease_until=null WHERE workspace_id=$2 AND id=$3`,[new Date(available),w,item.id]);return null;
  }
  const plan=await buildPlan(tx,w,{kind:n.kind,...(n.entity_id?{entityId:n.entity_id}:{})},now);
  if(!plan.eligible||(!n.notification_key.startsWith('schedule:')&&plan.identity!==n.notification_key)){
   await tx.query(`UPDATE discord_notifications SET status='cancelled',error_code='no_longer_eligible',updated_at=now() WHERE workspace_id=$1 AND id=$2`,[w,n.id]);
   await finishWork(tx,item,{status:'cancelled'});return null;
  }
  let destination;
  try{destination=readDestination(s.secret_ref,s.destination_hash);}catch{
   await tx.query(`UPDATE discord_notifications SET status='failed',error_code='destination_unavailable',updated_at=now() WHERE workspace_id=$1 AND id=$2`,[w,n.id]);
   await finishWork(tx,item,{status:'failed'});return null;
  }
  // now() is transaction-stable; use wall time before an irreversible HTTP side effect.
  const headroom=await tx.query(`SELECT id FROM work_items WHERE workspace_id=$1 AND id=$2 AND lease_token=$3 AND lease_owner=$4
   AND status='leased' AND lease_until>clock_timestamp()+interval '12 seconds'`,[w,item.id,item.lease_token,item.lease_owner]);
  invariant(headroom.rowCount,'lease_lost','Delivery lease cannot cover the HTTP deadline.',409);
  const attempt=n.attempts+1;
  await tx.query(`UPDATE discord_notifications SET status='sending',attempts=$1,active_token=$2,payload=$3,updated_at=now() WHERE workspace_id=$4 AND id=$5`,[attempt,item.lease_token,JSON.stringify(plan.payload),w,n.id]);
  await tx.query(`INSERT INTO discord_attempts(id,workspace_id,notification_id,attempt,lease_token,status,started_at) VALUES($1,$2,$3,$4,$5,'sending',now())`,[crypto.randomUUID(),w,n.id,attempt,item.lease_token]);
  await tx.query(`UPDATE discord_settings SET next_send_at=now()+interval '2 seconds' WHERE workspace_id=$1`,[w]);
  return {id:n.id,attempt,destination,payload:plan.payload};
 });
 if(!prepared)return;
 if(signal?.aborted)return; // The persisted sending attempt is recovered as uncertain, never silently replayed.
 const outcome=await postDiscord(prepared.destination,prepared.payload,prepared.attempt,signal);
 try{await transaction(async tx=>{
  const w=item.workspace_id;
  await tx.query('SELECT workspace_id FROM discord_settings WHERE workspace_id=$1 FOR UPDATE',[w]);
  await checkLease(tx,item);
  const n=(await tx.query(`SELECT id FROM discord_notifications WHERE workspace_id=$1 AND id=$2 AND status='sending' AND active_token=$3 FOR UPDATE`,[w,prepared.id,item.lease_token])).rows[0];
  if(!n)return;
  const state=outcome.state==='retry'&&prepared.attempt>=5?'failed':outcome.state;
  const code=outcome.state==='retry'&&prepared.attempt>=5?'attempts_exhausted':outcome.code;
  const retryAt=state==='retry'?new Date(Date.now()+outcome.retrySeconds!*1000):null;
  await tx.query(`UPDATE discord_attempts SET status=$1,http_status=$2,error_code=$3,retry_at=$4,completed_at=now() WHERE workspace_id=$5 AND notification_id=$6 AND lease_token=$7 AND status='sending'`,
   [state==='accepted'?'accepted':state==='uncertain'?'uncertain':'rejected',outcome.httpStatus||null,code,retryAt,w,n.id,item.lease_token]);
  await tx.query(`UPDATE discord_notifications SET status=$1,error_code=$2,available_at=coalesce($3,available_at),accepted_at=$4,remote_message_id=$5,active_token=null,updated_at=now() WHERE workspace_id=$6 AND id=$7`,
   [state,code,retryAt,state==='accepted'?new Date():null,outcome.remoteId||null,w,n.id]);
  if(outcome.code==='destination_mismatch')await tx.query('UPDATE discord_settings SET enabled=false,revision=revision+1 WHERE workspace_id=$1',[w]);
  if(state==='retry'){
   await tx.query('UPDATE discord_settings SET next_send_at=greatest(next_send_at,$1) WHERE workspace_id=$2',[retryAt,w]);
   await tx.query(`UPDATE work_items SET status='queued',available_at=$1,lease_until=null,error_code=$2 WHERE workspace_id=$3 AND id=$4`,[retryAt,code,w,item.id]);
  }else await finishWork(tx,item,{status:state});
 });}catch(e){if(!(e instanceof DomainError&&e.code==='lease_lost'))throw e;}
}

// One bounded maintenance pass. No process-local timers or implicit delivery enablement.
export async function tickDiscord(now=new Date()) {
 return transaction(async tx=>{
  if(!(await tx.query(`SELECT to_regclass('public.discord_settings') AS relation`)).rows[0].relation)return {ready:false};
  const w=config().workspaceId,s=(await tx.query('SELECT * FROM discord_settings WHERE workspace_id=$1 FOR UPDATE SKIP LOCKED',[w])).rows[0];
  if(!s)return {ready:true,scheduled:0};
  const abandoned=(await tx.query(`SELECT n.id,n.work_id FROM discord_notifications n JOIN work_items wi ON wi.workspace_id=n.workspace_id AND wi.id=n.work_id
   WHERE n.workspace_id=$1 AND n.status='sending' AND (wi.status<>'leased' OR wi.lease_until<=$2) ORDER BY n.created_at LIMIT 20 FOR UPDATE OF n,wi`,[w,now])).rows;
  for(const n of abandoned){
   await tx.query(`UPDATE discord_attempts SET status='uncertain',error_code='lease_interrupted',completed_at=$1 WHERE workspace_id=$2 AND notification_id=$3 AND status='sending'`,[now,w,n.id]);
   await tx.query(`UPDATE discord_notifications SET status='uncertain',error_code='lease_interrupted',active_token=null,updated_at=$1 WHERE workspace_id=$2 AND id=$3`,[now,w,n.id]);
   await tx.query(`UPDATE work_items SET status='cancelled',lease_until=null,error_code='delivery_uncertain' WHERE workspace_id=$1 AND id=$2`,[w,n.work_id]);
  }
  await tx.query(`UPDATE discord_notifications n SET status='failed',error_code='worker_stopped_before_send',updated_at=$2
   FROM work_items wi WHERE n.workspace_id=$1 AND n.workspace_id=wi.workspace_id AND n.work_id=wi.id
   AND n.status IN ('pending','retry') AND wi.status IN ('failed','cancelled','completed')`,[w,now]);
  let scheduled=0;
  if(!s.enabled)return {ready:true,scheduled};
  const rows=(await tx.query(`SELECT *,anchor_date::text AS anchor FROM discord_schedules WHERE workspace_id=$1 AND enabled AND next_due_at<=$2 ORDER BY next_due_at LIMIT 3 FOR UPDATE`,[w,now])).rows;
  for(const r of rows){
   const window=scheduleWindow({kind:r.kind,timezone:r.timezone,anchorDate:r.anchor,localTime:r.local_time},now);
   if(window.previous&&window.previous>=new Date(r.next_due_at)&&s.contents.includes(r.kind)){
    const old=(await tx.query(`UPDATE discord_notifications SET status='cancelled',error_code='schedule_coalesced' WHERE workspace_id=$1 AND kind=$2 AND notification_key LIKE 'schedule:%' AND status IN ('pending','retry') RETURNING work_id`,[w,r.kind])).rows;
    for(const n of old)await tx.query(`UPDATE work_items SET status='cancelled',lease_until=null WHERE workspace_id=$1 AND id=$2 AND status IN ('queued','leased')`,[w,n.work_id]);
    const result=await enqueueDiscordEvent(tx,w,{kind:r.kind},`schedule:${r.id}:${window.previous.toISOString()}`,now);
    if(result.queued){scheduled++;await tx.query('UPDATE discord_notifications SET planned_due_at=$1 WHERE workspace_id=$2 AND id=$3',[window.previous,w,result.id]);}
   }
   await tx.query('UPDATE discord_schedules SET next_due_at=$1,last_slot_at=$2 WHERE workspace_id=$3 AND id=$4',[window.next,window.previous,w,r.id]);
  }
  for(const kind of ['needs_response','networking_review','recruiter_reminder'] as const){
   if(s.contents.includes(kind))await enqueueDiscordEvent(tx,w,{kind},undefined,now);
  }
  return {ready:true,scheduled};
 });
}
