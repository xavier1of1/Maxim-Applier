import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import type {PoolClient} from 'pg';
import {config} from './config';
import {uuid} from './commands';
import {invariant,notFound} from './errors';

export async function artifactBytes(tx:PoolClient,w:string,id:string,jobId?:string){
 uuid.parse(id);
 const row=(await tx.query('SELECT * FROM artifacts WHERE workspace_id=$1 AND id=$2 AND deleted_at IS NULL',[w,id])).rows[0];
 if(!row)throw notFound();invariant(!jobId||row.job_id===jobId,'artifact_scope','Artifact belongs to another opening.',409);
 uuid.parse(row.storage_key);const root=await fs.realpath(path.join(config().privateRoot,'artifacts')),actual=await fs.realpath(path.join(root,row.storage_key));
 invariant(!(await fs.lstat(path.join(config().privateRoot,'artifacts'))).isSymbolicLink()&&!(await fs.lstat(path.join(root,row.storage_key))).isSymbolicLink(),'artifact_unavailable','Linked artifact paths are refused.',503);
 invariant(path.dirname(actual)===root,'artifact_unavailable','Artifact path escaped its protected root.',503);
 const stat=await fs.stat(actual);invariant(stat.size<=10*1024*1024,'artifact_unavailable','Artifact exceeds its bound.',503);
 const bytes=await fs.readFile(actual);
 invariant(crypto.createHash('sha256').update(bytes).digest('hex')===row.content_hash,'artifact_unavailable','Artifact integrity failed.',503);
 return {row,bytes};
}
export async function storeArtifact(tx:PoolClient,w:string,jobId:string,name:string,bytes:Buffer,type:string,created:string[]){
 invariant(bytes.length>0&&bytes.length<=10*1024*1024,'artifact_size','Generated artifact exceeds its bound.',413);
 await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
 const root=path.join(config().privateRoot,'artifacts');await fs.mkdir(root,{recursive:true,mode:0o700});
 invariant(!(await fs.lstat(root)).isSymbolicLink(),'artifact_unavailable','Linked artifact roots are refused.',503);
 const key=crypto.randomUUID(),id=crypto.randomUUID(),target=path.join(root,key),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});created.push(target);
 return (await tx.query('INSERT INTO artifacts(id,workspace_id,job_id,name,storage_key,content_hash,bytes,content_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[id,w,jobId,name,key,hash,bytes.length,type])).rows[0];
}
export async function cleanUncommitted(paths:string[]){
 const root=await fs.realpath(path.join(config().privateRoot,'artifacts')).catch(()=>null);if(!root)return;
 for(const file of paths){const actual=await fs.realpath(file).catch(()=>null);if(actual&&path.dirname(actual)===root)await fs.unlink(actual);}
}
export async function invocationDirectory(id:string,token:string){
 uuid.parse(id);uuid.parse(token);
 const root=path.join(config().privateRoot,'application-work');await fs.mkdir(root,{recursive:true,mode:0o700});
 invariant(!(await fs.lstat(root)).isSymbolicLink(),'invalid_path','Linked work roots are refused.');
 const actualRoot=await fs.realpath(root),dir=path.join(actualRoot,id,token);
 await fs.mkdir(dir,{recursive:true,mode:0o700});invariant(await fs.realpath(dir)===dir,'invalid_path','Linked invocation paths are refused.');
 return dir;
}
export async function removeInvocation(dir:string){
 const root=await fs.realpath(path.join(config().privateRoot,'application-work'));
 const actual=await fs.realpath(dir).catch(()=>null);
 invariant(actual&&actual===dir&&actual.startsWith(root+path.sep)&&path.relative(root,actual).split(path.sep).length===2,'invalid_path','Invocation cleanup target is outside its owned root.');
 await fs.rm(actual,{recursive:true,force:true});
}
export async function expireApplicationWork(){
 const root=path.join(config().privateRoot,'application-work'),stat=await fs.lstat(root).catch(()=>null);
 if(!stat)return;
 invariant(stat.isDirectory()&&!stat.isSymbolicLink(),'invalid_path','Linked work roots are refused.');
 const {database}=await import('./db');let inspected=0,removed=0;
 for(const job of await fs.readdir(root,{withFileTypes:true})){
  if(!job.isDirectory()||!uuid.safeParse(job.name).success)continue;
  for(const lease of await fs.readdir(path.join(root,job.name),{withFileTypes:true})){
   if(++inspected>200)return {inspected,removed,partial:true};
   if(!lease.isDirectory()||!uuid.safeParse(lease.name).success)continue;
   const dir=path.join(root,job.name,lease.name),s=await fs.lstat(dir);
   if(s.isSymbolicLink()||Date.now()-s.mtimeMs<86400000)continue;
   const active=await database().query("SELECT 1 FROM work_items WHERE lease_token=$1 AND status='leased' AND lease_until>now() LIMIT 1",[lease.name]);
   if(active.rowCount)continue;
   await removeInvocation(dir);removed++;
  }
 }
 return {inspected,removed,partial:false};
}
