import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {enqueue} from '../../work';
import {event} from '../../commands';
import {buildPlan} from './planner';
import type {PlanInput} from './types';

// Use the producer's domain transaction so event and notification commit together.
export async function enqueueDiscordEvent(tx:PoolClient,workspaceId:string,input:PlanInput,eventKey?:string,now=new Date()) {
 const s=(await tx.query('SELECT * FROM discord_settings WHERE workspace_id=$1 FOR UPDATE',[workspaceId])).rows[0];
 if(!s?.enabled||!s.confirmed_at||!s.destination_hash||!s.contents.includes(input.kind))return {queued:false,reason:'delivery_not_consented'};
 const plan=await buildPlan(tx,workspaceId,input,now);
 if(!plan.eligible)return {queued:false,reason:plan.reason};
 const key=eventKey||plan.identity,id=crypto.randomUUID();
 const inserted=await tx.query(`INSERT INTO discord_notifications(id,workspace_id,kind,entity_id,notification_key,destination_hash,destination_revision,planned_due_at,available_at,payload)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,$9) ON CONFLICT(workspace_id,destination_hash,notification_key,payload_revision) DO NOTHING RETURNING id`,
 [id,workspaceId,input.kind,input.entityId||null,key,s.destination_hash,s.destination_revision,now,JSON.stringify(plan.payload)]);
 if(!inserted.rowCount){const prior=(await tx.query('SELECT id,status FROM discord_notifications WHERE workspace_id=$1 AND destination_hash=$2 AND notification_key=$3 AND payload_revision=1',[workspaceId,s.destination_hash,key])).rows[0];return {queued:false,reason:'known_identity',...prior};}
 const work=await enqueue(tx,workspaceId,'discord_delivery',id,{notificationId:id});
 await tx.query('UPDATE work_items SET max_attempts=5 WHERE id=$1 AND workspace_id=$2',[work.id,workspaceId]);
 await tx.query('UPDATE discord_notifications SET work_id=$1 WHERE id=$2 AND workspace_id=$3',[work.id,id,workspaceId]);
 await event(tx,{workspaceId},id,'discord_notification_planned',{kind:input.kind,payloadRevision:1});
 return {queued:true,id,status:'pending'};
}
