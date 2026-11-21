import {database,transaction} from '../server/db';
import {digest} from '../server/auth';
import {upstreamRun,publicUrl} from '../server/upstream-discovery';
import type {Source} from '../server/discovery-providers';
import type {WorkItem} from '../server/work';
import {invariant} from '../server/errors';
import {active} from './discovery';

type Contract={dataset:string;rows?:unknown[];entries:Record<string,unknown>[]};
async function contract(family:string,signal:AbortSignal,extra:Record<string,unknown>={}):Promise<Contract>{
 return await upstreamRun(family,{},signal,async()=>{throw Error('Inventory normalization cannot fetch.');},{operation:'inventory_contract',family,...extra}) as unknown as Contract;
}
export function rotateInventory<T>(rows:T[],offset:number,count:number){
 if(!rows.length)return [];
 const start=offset%rows.length;return [...rows.slice(start),...rows.slice(0,start)].slice(0,Math.min(count,rows.length));
}
export async function inventoryBatch(item:WorkItem,source:Source,signal:AbortSignal,fetchPublic:(url:string)=>Promise<{text:string}>,allowHost:(host:string)=>void){
 const family=source.provider.replace(/^reverse:/,'');
 invariant(family!=='workable','large_feed_deferred','Global Workable feed is explicitly deferred: approximately 140 MB compressed requires a reviewed streaming budget.');
 const definition=await contract(family,signal);publicUrl(definition.dataset);allowHost(new URL(definition.dataset).hostname);
 let saved=(await database().query('SELECT * FROM discovery_inventories WHERE workspace_id=$1 AND source_id=$2',[item.workspace_id,source.id])).rows[0];
 if(!saved||Date.now()-new Date(saved.fetched_at).getTime()>86400000){
  const response=await fetchPublic(definition.dataset),parsed=await contract(family,signal,{text:response.text,maxEntries:1}),rows=parsed.rows!;
  // Keep one compact directory per source, not every fetched document or tenant board.
  const bytes=JSON.stringify(rows);invariant(Buffer.byteLength(bytes)<=5*1024*1024,'inventory_too_large','Directory exceeds its storage budget.');
  saved=await transaction(async tx=>{
   await active(tx,item,source);
   const prior=(await tx.query('SELECT record_offset FROM discovery_inventories WHERE workspace_id=$1 AND source_id=$2 FOR UPDATE',[item.workspace_id,source.id])).rows[0];
   return (await tx.query('INSERT INTO discovery_inventories(workspace_id,source_id,entries,content_hash,available,record_offset,dataset_url) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(workspace_id,source_id) DO UPDATE SET entries=EXCLUDED.entries,content_hash=EXCLUDED.content_hash,available=EXCLUDED.available,record_offset=discovery_inventories.record_offset % greatest(EXCLUDED.available,1),fetched_at=now(),dataset_url=EXCLUDED.dataset_url RETURNING *',[item.workspace_id,source.id,bytes,digest(bytes),rows.length,Number(prior?.record_offset||0)%Math.max(rows.length,1),definition.dataset])).rows[0];
  });
 }
 const offset=saved.record_offset,rows=rotateInventory(saved.entries,offset,4);
 const selected=await contract(family,signal,{rows,maxEntries:4});
 for(const entry of selected.entries){publicUrl(String(entry.careers_url));allowHost(new URL(String(entry.careers_url)).hostname);}
 return {family,entries:selected.entries,coverage:{dataset:definition.dataset,inventoryAsOf:new Date(saved.fetched_at).toISOString(),inventoryHash:saved.content_hash,available:saved.available,cursor:offset,selected:rows.length,uninspected:Math.max(0,saved.available-rows.length),invalidEntries:rows.length-selected.entries.length},
  advance:async(consumed=rows.length)=>transaction(async tx=>{await active(tx,item,source);await tx.query('UPDATE discovery_inventories SET record_offset=($1::integer+$2::integer)%greatest(available,1) WHERE workspace_id=$3 AND source_id=$4 AND content_hash=$5',[offset,consumed,item.workspace_id,source.id,saved.content_hash]);})};
}
