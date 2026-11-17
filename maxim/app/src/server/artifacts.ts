import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from './config';
import { database } from './db';
import { type Context } from './auth';
import { command, event, jobFor, uuid } from './commands';
import { invariant, notFound } from './errors';

const artifactRoot = () => path.join(config().privateRoot,'artifacts');
export async function uploadArtifact(ctx:Context,form:FormData) {
 const jobId=uuid.parse(form.get('jobId')),commandId=uuid.parse(form.get('commandId'));
 const file=form.get('file');
 invariant(file instanceof File,'invalid_file','Select a PDF, Markdown or text reference file.');
 invariant(file.size>0 && file.size<=10*1024*1024,'file_size','Reference files must be between 1 byte and 10 MB.',413);
 invariant(file.name===path.basename(file.name) && !/[\x00-\x1f\\/]/.test(file.name),'invalid_filename','File name is not valid.');
 const ext=path.extname(file.name).toLowerCase();
 invariant(['.pdf','.txt','.md'].includes(ext),'file_type','Only PDF, Markdown and text reference files are accepted.');
 const bytes=Buffer.from(await file.arrayBuffer()),hash=crypto.createHash('sha256').update(bytes).digest('hex');
 if(ext==='.pdf')invariant(bytes.subarray(0,5).toString()==='%PDF-','invalid_file','This file is not a readable PDF reference.');
 else invariant(!bytes.includes(0),'invalid_file','This reference must be plain text.');
 const name=file.name.slice(0,200),key=crypto.randomUUID(),root=artifactRoot(),target=path.join(root,key);
 let created=false,committed=false;
 try {
  const result=await command(ctx,commandId,{action:'attach_reference',jobId,hash,name},async tx=>{
   await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
   await jobFor(tx,ctx,jobId);
   await fs.mkdir(root,{recursive:true,mode:0o700});
   await fs.writeFile(target,bytes,{flag:'wx',mode:0o600});created=true;
   const id=crypto.randomUUID(),contentType=ext==='.pdf'?'application/pdf':'text/plain; charset=utf-8';
   await tx.query('INSERT INTO artifacts(id,workspace_id,job_id,name,storage_key,content_hash,bytes,content_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id,ctx.workspaceId,jobId,name,key,hash,bytes.length,contentType]);
   await event(tx,ctx,jobId,'reference_attached',{artifactId:id,name,bytes:bytes.length});
   return {id,job_id:jobId,name,bytes:bytes.length,content_type:contentType};
  });
  committed=true;return result;
 } finally { if(created&&!committed)await fs.unlink(target).catch(()=>{}); }
}
export async function downloadArtifact(ctx:Context,id:string) {
 uuid.parse(id);
 const r=await database().query('SELECT * FROM artifacts WHERE id=$1 AND workspace_id=$2',[id,ctx.workspaceId]);
 const a=r.rows[0];if(!a)throw notFound();
 uuid.parse(a.storage_key);
 const root=await fs.realpath(artifactRoot()),target=path.join(root,a.storage_key);
 const actual=await fs.realpath(target).catch(()=>null);
 invariant(actual && path.dirname(actual)===root,'artifact_unavailable','The reference file is unavailable.',503);
 const bytes=await fs.readFile(actual);
 invariant(crypto.createHash('sha256').update(bytes).digest('hex')===a.content_hash,'artifact_unavailable','Reference integrity check failed.',503);
 return new Response(new Uint8Array(bytes),{headers:{'Content-Type':a.content_type,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(a.name),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
