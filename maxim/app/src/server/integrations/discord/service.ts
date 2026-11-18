import {z} from 'zod';
import type {PoolClient} from 'pg';
import {transaction} from '../../db';
import {command,event} from '../../commands';
import {type Context,digest} from '../../auth';
import {config} from '../../config';
import {invariant} from '../../errors';
import {storeDestination,destinationAvailable} from './private';
import {buildPlan,canonicalCounts} from './planner';
import {enqueueDiscordEvent} from './outbox';
import {scheduleWindow,validateSchedule} from './schedule';
import {kindSchema,planSchema} from './types';

const revision=z.number().int().positive(),uuid=z.string().uuid();
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('configure_destination'),payload:z.object({expectedRevision:revision,webhook:z.string().min(1).max(1024),channelId:z.string().regex(/^\d{17,20}$/),confirmedExisting:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('set_consent'),payload:z.object({expectedRevision:revision,destinationRevision:z.number().int().positive(),enabled:z.boolean(),contents:z.array(kindSchema).max(7),confirmDestination:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('save_schedule'),payload:z.object({expectedRevision:revision,kind:z.enum(['application_review','weekly_review','resume_review']),timezone:z.string().max(100),anchorDate:z.string().max(10),localTime:z.string().max(5),enabled:z.boolean()}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('enqueue_now'),payload:planSchema}).strict(),
 z.object({commandId:uuid,action:z.literal('resolve_uncertain'),payload:z.object({notificationId:uuid,decision:z.enum(['retry','cancel']),acknowledgeDuplicateRisk:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('retry_failed'),payload:z.object({notificationId:uuid,acknowledgeDuplicateRisk:z.literal(true)}).strict()}).strict(),
]);
async function owner(tx:PoolClient,ctx:Context) {
 const r=await tx.query('SELECT w.id FROM workspaces w JOIN sessions s ON s.workspace_id=w.id WHERE w.id=$1 AND w.is_owner AND s.id=$2 AND s.expires_at>now()',[ctx.workspaceId,ctx.sessionId]);
 invariant(ctx.isOwner&&ctx.workspaceId===config().workspaceId&&r.rowCount,'not_found','Record not found.',404);
}
async function cancelPending(tx:PoolClient,w:string,code:string) {
 await tx.query(`UPDATE discord_notifications SET status=CASE WHEN status='sending' THEN 'uncertain' ELSE 'cancelled' END,error_code=$2,updated_at=now()
  WHERE workspace_id=$1 AND status IN ('pending','retry','sending')`,[w,code]);
 await tx.query(`UPDATE discord_attempts SET status='uncertain',error_code=$2,completed_at=now() WHERE workspace_id=$1 AND status='sending'`,[w,code]);
 await tx.query(`UPDATE work_items SET status='cancelled',lease_until=null,error_code=$2 WHERE workspace_id=$1 AND kind='discord_delivery' AND status IN ('queued','leased')`,[w,code]);
}
export async function discordCommand(ctx:Context,raw:unknown) {
 const c=schema.parse(raw);
 const bound=c.action==='configure_destination'?{...c,payload:{...c.payload,webhook:digest(c.payload.webhook)}}:c;
 return command(ctx,c.commandId,bound,async tx=>{
  await owner(tx,ctx);const w=ctx.workspaceId;
  await tx.query('INSERT INTO discord_settings(workspace_id) VALUES($1) ON CONFLICT DO NOTHING',[w]);
  const s=(await tx.query('SELECT * FROM discord_settings WHERE workspace_id=$1 FOR UPDATE',[w])).rows[0];
  if('expectedRevision' in c.payload)invariant(s.revision===c.payload.expectedRevision,'revision_conflict','Discord settings changed. Refresh before saving.',409);
  if(c.action==='configure_destination'){
   const saved=storeDestination(c.payload.webhook,c.payload.channelId);
   await cancelPending(tx,w,'destination_changed');
   await tx.query(`UPDATE discord_settings SET destination_hash=$1,secret_ref=$2,destination_revision=destination_revision+1,confirmed_at=now(),enabled=false,contents='{}',revision=revision+1,next_send_at=null WHERE workspace_id=$3`,[saved.hash,saved.ref,w]);
   await event(tx,ctx,w,'discord_destination_configured',{destinationRevision:s.destination_revision+1});
   return {revision:s.revision+1,destinationRevision:s.destination_revision+1,enabled:false};
  }
  if(c.action==='set_consent'){
   const p=c.payload;
   invariant(p.destinationRevision===s.destination_revision&&destinationAvailable(s.secret_ref,s.destination_hash),'destination_unavailable','Privately configure and confirm the existing destination first.',409);
   invariant(!p.enabled||p.contents.length>0,'content_consent_required','Choose notification contents before enabling delivery.');
   await cancelPending(tx,w,'consent_changed');
   await tx.query('UPDATE discord_settings SET enabled=$1,contents=$2,revision=revision+1 WHERE workspace_id=$3',[p.enabled,[...new Set(p.contents)],w]);
   if(p.enabled){
    const schedules=(await tx.query('SELECT *,anchor_date::text AS anchor FROM discord_schedules WHERE workspace_id=$1',[w])).rows;
    for(const r of schedules){const window=scheduleWindow({kind:r.kind,timezone:r.timezone,anchorDate:r.anchor,localTime:r.local_time},new Date());await tx.query('UPDATE discord_schedules SET next_due_at=$1 WHERE workspace_id=$2 AND id=$3',[window.next,w,r.id]);}
   }
   await event(tx,ctx,w,'discord_consent_changed',{enabled:p.enabled,contents:p.contents});return {revision:s.revision+1,enabled:p.enabled};
  }
  if(c.action==='save_schedule'){
   const p=c.payload;validateSchedule(p);const next=scheduleWindow(p,new Date()).next;
   const r=await tx.query(`INSERT INTO discord_schedules(id,workspace_id,kind,timezone,anchor_date,local_time,enabled,next_due_at) VALUES(gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7)
    ON CONFLICT(workspace_id,kind) DO UPDATE SET timezone=EXCLUDED.timezone,anchor_date=EXCLUDED.anchor_date,local_time=EXCLUDED.local_time,enabled=EXCLUDED.enabled,next_due_at=EXCLUDED.next_due_at,revision=discord_schedules.revision+1 RETURNING id`,[w,p.kind,p.timezone,p.anchorDate,p.localTime,p.enabled,next]);
   await tx.query('UPDATE discord_settings SET revision=revision+1 WHERE workspace_id=$1',[w]);
   await event(tx,ctx,r.rows[0].id,'discord_schedule_saved',{kind:p.kind});return {id:r.rows[0].id,revision:s.revision+1,nextDueAt:next};
  }
  if(c.action==='enqueue_now')return enqueueDiscordEvent(tx,w,c.payload);
  const p=c.payload,r=(await tx.query('SELECT * FROM discord_notifications WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.notificationId])).rows[0];
  invariant(r,'not_found','Record not found.',404);
  invariant(r.status===(c.action==='retry_failed'?'failed':'uncertain'),'delivery_not_retryable','This delivery does not need that retry decision.',409);
  const decision=c.action==='retry_failed'?'retry':c.payload.decision;
  if(decision==='cancel')await tx.query(`UPDATE discord_notifications SET status='cancelled',error_code='operator_cancelled',updated_at=now() WHERE workspace_id=$1 AND id=$2`,[w,r.id]);
  else{
   invariant(s.enabled&&s.contents.includes(r.kind)&&s.destination_revision===r.destination_revision&&r.attempts<5,'retry_denied','Delivery needs current consent, unchanged destination and a remaining attempt.',409);
   await tx.query(`UPDATE discord_notifications SET status='retry',available_at=now(),active_token=null,error_code='operator_retry' WHERE workspace_id=$1 AND id=$2`,[w,r.id]);
   await tx.query(`UPDATE work_items SET status='queued',attempts=0,lease_token=null,lease_owner=null,lease_until=null,available_at=now() WHERE workspace_id=$1 AND id=$2`,[w,r.work_id]);
  }
  await event(tx,ctx,r.id,c.action==='retry_failed'?'discord_failure_retry_requested':'discord_uncertainty_resolved',{decision});return {id:r.id,status:decision==='retry'?'retry':'cancelled'};
 });
}
export async function discordPlan(ctx:Context,raw:unknown) {
 const input=planSchema.parse(raw);
 return transaction(async tx=>{await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await owner(tx,ctx);return buildPlan(tx,ctx.workspaceId,input);});
}
export async function discordView(ctx:Context) {
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');await owner(tx,ctx);const w=ctx.workspaceId;
  const s=(await tx.query('SELECT * FROM discord_settings WHERE workspace_id=$1',[w])).rows[0];
  const configured=Boolean(s&&destinationAvailable(s.secret_ref,s.destination_hash));
  const schedules=(await tx.query('SELECT id,kind,revision,enabled,timezone,anchor_date::text AS anchor_date,local_time,next_due_at,last_slot_at FROM discord_schedules WHERE workspace_id=$1 ORDER BY kind',[w])).rows;
  const notifications=(await tx.query('SELECT id,kind,status,attempts,planned_due_at,available_at,accepted_at,error_code,payload FROM discord_notifications WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 101',[w])).rows;
  const attempts=(await tx.query('SELECT notification_id,attempt,status,http_status,error_code,retry_at,started_at,completed_at FROM discord_attempts WHERE workspace_id=$1 AND notification_id=ANY($2::uuid[]) ORDER BY started_at DESC',[w,notifications.slice(0,100).map(n=>n.id)])).rows;
  const data=await canonicalCounts(tx,w,new Date());
  return {settings:{revision:s?.revision||1,destinationRevision:s?.destination_revision||0,configured,enabled:Boolean(s?.enabled&&configured),state:!configured?'unconfigured':s.enabled?'enabled':'disabled',contents:s?.contents||[]},
   schedules,notifications:notifications.slice(0,100),attempts,partial:notifications.length>100,counts:data.counts,producers:{s7:data.s7.available,s9:data.s9.available},asOf:new Date().toISOString()};
 });
}
