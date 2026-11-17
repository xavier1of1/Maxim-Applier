import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {database,transaction} from './db';
import {invariant} from './errors';

export type WorkItem={id:string;workspace_id:string;kind:string;input:Record<string,unknown>;lease_token:string;lease_owner:string;attempts:number;max_attempts:number};
export async function enqueue(tx:PoolClient,workspaceId:string,kind:string,key:string,input:unknown){
 const r=await tx.query('INSERT INTO work_items(id,workspace_id,kind,dedupe_key,input) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,kind,dedupe_key) DO UPDATE SET dedupe_key=EXCLUDED.dedupe_key RETURNING *',
 [crypto.randomUUID(),workspaceId,kind,key,JSON.stringify(input)]);
 return r.rows[0];
}
export async function claimWork(workerId:string,leaseSeconds=45):Promise<WorkItem|null>{
 invariant(leaseSeconds>=2&&leaseSeconds<=120,'invalid_lease','Worker lease out of bounds.');
 return transaction(async tx=>{
  await tx.query("UPDATE work_items SET status='failed',error_code='attempts_exhausted',updated_at=now() WHERE status='leased' AND lease_until<now() AND attempts>=max_attempts");
  const r=await tx.query("SELECT * FROM work_items WHERE ((status='queued' AND available_at<=now()) OR (status='leased' AND lease_until<now())) AND attempts<max_attempts ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1");
  if(!r.rows[0])return null;
  return (await tx.query("UPDATE work_items SET status='leased',attempts=attempts+1,lease_token=$1,lease_owner=$2,lease_until=now()+$3*interval '1 second',updated_at=now() WHERE id=$4 RETURNING *",
   [crypto.randomUUID(),workerId,leaseSeconds,r.rows[0].id])).rows[0];
 });
}
export async function checkLease(tx:PoolClient,item:WorkItem){
 const r=await tx.query("SELECT id FROM work_items WHERE id=$1 AND workspace_id=$2 AND lease_token=$3 AND lease_owner=$4 AND status='leased' AND lease_until>now() FOR UPDATE",
 [item.id,item.workspace_id,item.lease_token,item.lease_owner]);
 invariant(r.rowCount,'lease_lost','Work lease no longer authorizes publication.',409);
}
export async function renewWork(item:WorkItem,seconds=45){
 invariant(seconds>=2&&seconds<=120,'invalid_lease','Worker lease out of bounds.');
 const r=await database().query("UPDATE work_items SET lease_until=now()+$1*interval '1 second' WHERE id=$2 AND workspace_id=$3 AND lease_token=$4 AND lease_owner=$5 AND status='leased' AND lease_until>now() RETURNING id",
 [seconds,item.id,item.workspace_id,item.lease_token,item.lease_owner]);
 return Boolean(r.rowCount);
}
export async function finishWork(tx:PoolClient,item:WorkItem,result:unknown){
 await checkLease(tx,item);
 await tx.query("UPDATE work_items SET status='completed',result=$1,lease_until=null,updated_at=now() WHERE id=$2 AND workspace_id=$3 AND lease_token=$4",[JSON.stringify(result),item.id,item.workspace_id,item.lease_token]);
}
export async function failWork(item:WorkItem,code:string,retryable=false){
 const retry=retryable&&item.attempts<item.max_attempts;
 await database().query("UPDATE work_items SET status=$1,error_code=$2,available_at=now()+$3*interval '1 second',lease_until=null,updated_at=now() WHERE id=$4 AND workspace_id=$5 AND lease_token=$6 AND lease_owner=$7 AND status='leased' AND lease_until>now()",
 [retry?'queued':'failed',code,Math.min(30,2**item.attempts),item.id,item.workspace_id,item.lease_token,item.lease_owner]);
}
