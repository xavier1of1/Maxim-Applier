import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {z} from 'zod';
import type {Context} from './auth';
import {uuid} from './commands';
import {nativeRoot} from './projections';
import {uploadSource} from './sources';
import {invariant} from './errors';

function stableId(commandId:string,name:string){
 const h=crypto.createHash('sha256').update(commandId+':'+name).digest('hex');
 return h.slice(0,8)+'-'+h.slice(8,12)+'-4'+h.slice(13,16)+'-8'+h.slice(17,20)+'-'+h.slice(20,32);
}
export async function importLegacyCandidate(ctx:Context,raw:unknown){
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 const p=z.object({commandId:uuid}).strict().parse(raw),root=nativeRoot(),sources=[];
 await fs.mkdir(root,{recursive:true,mode:0o700});
 const actualRoot=await fs.realpath(root);
 for(const relative of ['cv.md','config/profile.yml','modes/_profile.md','article-digest.md']){
  const target=path.join(/* turbopackIgnore: true */ root,relative);
  let actual;try{actual=await fs.realpath(/* turbopackIgnore: true */ target);}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')continue;throw e;}
  invariant(actual.startsWith(actualRoot+path.sep)&&!(await fs.lstat(target)).isSymbolicLink(),'linked_source','Linked native sources outside the candidate root cannot be imported.');
  const bytes=await fs.readFile(actual),form=new FormData();
  form.set('file',new File([bytes],path.basename(relative)));
  form.set('commandId',stableId(p.commandId,relative));form.set('classification','personal');form.set('modelConsent','false');form.set('retentionDays','30');
  sources.push({...await uploadSource(ctx,form,relative.endsWith('.yml')),nativeFile:relative});
 }
 return {sources,approved:false,ownershipChanged:false};
}
