import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {z} from 'zod';
import {config} from './config';
import {database,transaction} from './db';
import {command,event,uuid} from './commands';
import type {Context} from './auth';
import {DomainError,invariant,notFound} from './errors';
import {enqueue} from './work';
import {validateDocument} from './document-parser';

export async function candidateLock(tx:import('pg').PoolClient,workspaceId:string){
 await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',['candidate:'+workspaceId]);
}
export async function sourceFor(tx:import('pg').PoolClient,workspaceId:string,id:string){
 const source=(await tx.query('SELECT * FROM candidate_sources WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[workspaceId,id])).rows[0];
 if(!source)throw notFound();return source;
}
export async function sourceBytes(workspaceId:string,id:string){
 const row=(await database().query('SELECT a.* FROM artifacts a JOIN candidate_sources s ON s.artifact_id=a.id AND s.workspace_id=a.workspace_id WHERE s.workspace_id=$1 AND s.id=$2 AND s.deleted_at IS NULL AND a.deleted_at IS NULL',[workspaceId,id])).rows[0];
 if(!row)throw notFound();
 uuid.parse(row.storage_key);
 const root=await fs.realpath(path.join(config().privateRoot,'artifacts')),actual=await fs.realpath(path.join(root,row.storage_key));
 invariant(path.dirname(actual)===root,'source_unavailable','Source file is unavailable.',503);
 const bytes=await fs.readFile(actual);
 invariant(crypto.createHash('sha256').update(bytes).digest('hex')===row.content_hash,'source_unavailable','Source integrity verification failed.',503);
 return bytes;
}
export async function uploadSource(ctx:Context,form:FormData,legacyYaml=false){
 const commandId=uuid.parse(form.get('commandId'));
 const classification=z.enum(['personal','public','restricted']).parse(form.get('classification'));
 invariant(classification!=='restricted','restricted_source','Restricted employer material cannot be uploaded or disclosed.');
 const consent=z.enum(['true','false']).parse(form.get('modelConsent')||'false')==='true';
 const retentionDays=z.coerce.number().int().min(1).max(365).parse(form.get('retentionDays')||30);
 const file=form.get('file');invariant(file instanceof File,'invalid_file','Select a supported source.');
 invariant(file.size>0&&file.size<=10*1024*1024,'file_size','Source must be between 1 byte and 10 MB.',413);
 const bytes=Buffer.from(await file.arrayBuffer()),format=validateDocument(file.name,bytes,legacyYaml);
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const storageKey=crypto.randomUUID(),root=path.join(config().privateRoot,'artifacts'),target=path.join(root,storageKey);
 let created=false,committed=false;
 try{
  const result=await command(ctx,commandId,{action:'upload_source',hash,name:file.name,classification,consent,retentionDays},async tx=>{
   await candidateLock(tx,ctx.workspaceId);
   await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
   const prior=(await tx.query('SELECT * FROM candidate_sources WHERE workspace_id=$1 AND content_hash=$2 FOR UPDATE',[ctx.workspaceId,hash])).rows[0];
   if(prior&&!prior.deleted_at)return {id:prior.id,status:prior.status,revision:prior.revision,duplicate:true};
   await fs.mkdir(root,{recursive:true,mode:0o700});await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});created=true;
   const artifactId=crypto.randomUUID(),id=prior?.id||crypto.randomUUID(),revision=prior?prior.revision+1:1;
   const contentType=format==='pdf'?'application/pdf':format==='docx'?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':'text/plain; charset=utf-8';
   await tx.query('INSERT INTO artifacts(id,workspace_id,name,storage_key,content_hash,bytes,content_type) VALUES($1,$2,$3,$4,$5,$6,$7)',[artifactId,ctx.workspaceId,file.name,storageKey,hash,bytes.length,contentType]);
   if(prior)await tx.query("UPDATE candidate_sources SET artifact_id=$1,name=$2,format=$3,revision=$4,classification=$5,model_consent=$6,retention_days=$7,status='queued',deleted_at=null,extracted_text=null,extraction_error=null,updated_at=now() WHERE id=$8 AND workspace_id=$9",[artifactId,file.name,format,revision,classification,consent,retentionDays,id,ctx.workspaceId]);
   else await tx.query('INSERT INTO candidate_sources(id,workspace_id,artifact_id,name,format,content_hash,classification,model_consent,retention_days) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,ctx.workspaceId,artifactId,file.name,format,hash,classification,consent,retentionDays]);
   const work=await enqueue(tx,ctx.workspaceId,'extract_source',id+':'+revision,{sourceId:id,sourceRevision:revision,consentRevision:prior?.consent_revision||1,useModel:consent});
   await event(tx,ctx,id,'candidate_source_uploaded',{format,bytes:bytes.length,revision,modelConsent:consent},revision);
   return {id,status:'queued',revision,workId:work.id,duplicate:false};
  });
  committed=true;return result;
 }finally{if(created&&!committed)await fs.unlink(target).catch(()=>{});}
}
export async function candidateView(ctx:Context){
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const candidate=(await tx.query('SELECT id,display_name,revision,ownership FROM candidates WHERE workspace_id=$1',[ctx.workspaceId])).rows[0];
  const sources=(await tx.query('SELECT s.id,s.artifact_id,s.name,s.format,s.revision,s.classification,s.model_consent,s.status,s.extraction_error,s.retention_days,s.created_at,s.deleted_at,(a.id IS NOT NULL AND a.deleted_at IS NULL) AS raw_available FROM candidate_sources s LEFT JOIN artifacts a ON a.id=s.artifact_id AND a.workspace_id=s.workspace_id WHERE s.workspace_id=$1 ORDER BY s.created_at DESC LIMIT 200',[ctx.workspaceId])).rows;
  const facts=(await tx.query("SELECT f.* FROM candidate_facts f JOIN candidate_sources s ON s.id=f.source_id AND s.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.status='current' AND s.deleted_at IS NULL AND f.source_revision=s.revision ORDER BY f.field_key",[ctx.workspaceId])).rows;
  const proposals=(await tx.query("SELECT p.*,f.value AS current_value,f.revision AS current_fact_revision FROM fact_proposals p JOIN candidate_sources s ON s.id=p.source_id AND s.workspace_id=p.workspace_id LEFT JOIN candidate_facts f ON f.workspace_id=p.workspace_id AND f.field_key=p.field_key WHERE p.workspace_id=$1 AND p.status='pending' AND s.deleted_at IS NULL AND p.source_revision=s.revision ORDER BY p.created_at,p.id LIMIT 500",[ctx.workspaceId])).rows;
  const work=(await tx.query("SELECT id,kind,input->>'sourceId' AS source_id,status,attempts,error_code,updated_at FROM work_items WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100",[ctx.workspaceId])).rows;
  const withdrawnFacts=(await tx.query("SELECT id,field_key,value,revision,source_id,status,sensitivity FROM candidate_facts WHERE workspace_id=$1 AND status='withdrawn' ORDER BY field_key",[ctx.workspaceId])).rows;
  const heartbeat=(await tx.query('SELECT max(last_seen) AS last_seen FROM worker_heartbeats')).rows[0].last_seen;
  return {candidate,sources,facts,withdrawnFacts,proposals,work,worker:{lastSeen:heartbeat,available:Boolean(heartbeat&&Date.now()-new Date(heartbeat).getTime()<30000)},asOf:new Date().toISOString()};
 });
}
export async function sourceView(ctx:Context,id:string){
 uuid.parse(id);
 const row=(await database().query('SELECT id,name,format,revision,status,model_consent,classification,extracted_text,extraction_error,deleted_at FROM candidate_sources WHERE id=$1 AND workspace_id=$2',[id,ctx.workspaceId])).rows[0];
 if(!row)throw notFound();return row;
}
