import crypto from 'node:crypto';
import {z} from 'zod';
import {transaction} from './db';
import {type Context,reauthorize} from './auth';
import {command,event,jobFor,uuid} from './commands';
import {applicationLock,queueApplicationProjection} from './application-authority';
import {collectLegacy,type LegacyBundle} from './legacy-intake';
import {invariant,notFound} from './errors';
import {canonicalJobUrl} from './application-duplicates';
import {storeArtifact,cleanUncommitted} from './private-artifacts';
import {nativeRoot} from './projections';
import path from 'node:path';

const reason=z.string().trim().min(3).max(1000);
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('stage_native'),payload:z.object({confirmedLocalRead:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('resolve_record'),payload:z.object({recordId:uuid,importId:uuid,expectedRevision:z.number().int().positive(),resolution:z.enum(['new_opening','link_existing','preserve_only']),jobId:uuid.optional(),company:z.string().trim().min(1).max(180).optional(),title:z.string().trim().min(1).max(200).optional(),outcome:z.enum(['not_submitted','submitted','responded','interviewing','offer','rejected','withdrawn','unknown']).default('unknown'),reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('commit_import'),payload:z.object({importId:uuid,expectedRevision:z.number().int().positive(),contentHash:z.string().length(64),confirmed:z.literal(true),acknowledgeRawIssues:z.boolean().default(false),reason}).strict()}).strict(),
]);
const summary=(row:Record<string,any>)=>({id:row.id,revision:row.revision,status:row.status,contentHash:row.content_hash,report:row.report,created_at:row.created_at});
function artifactPath(value:string){
 const relative=path.isAbsolute(value)?path.relative(nativeRoot(),value):value.replace(/^\.\//,'');
 const normalized=relative.replaceAll('\\','/');
 return /^(?:reports|output|jds)\//.test(normalized)&&!normalized.split('/').includes('..')?normalized:null;
}
export async function legacyImportCommand(ctx:Context,raw:unknown){
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 const c=schema.parse(raw),created:string[]=[];let committed=false;
 try{
  const result=await command(ctx,c.commandId,c,async tx=>{
   const authority=await applicationLock(tx,ctx.workspaceId);const w=ctx.workspaceId;
   invariant(authority.owner==='legacy','legacy_writer_retired','Native intake is retired after canonical cutover. Use current workspace commands, not reimported projections.',409);
   if(c.action==='stage_native'){
    const bundle=await collectLegacy(),prior=(await tx.query('SELECT * FROM legacy_imports WHERE workspace_id=$1 AND content_hash=$2',[w,bundle.hash])).rows[0];if(prior)return summary(prior);
    const id=crypto.randomUUID(),report={counts:bundle.counts,issues:bundle.issues,unresolved:bundle.records.length,sourceHashes:Object.fromEntries(bundle.files.map(f=>[f.path,f.hash])),normalization:'Separate from exact raw bytes/fields; no facts, packets or outcomes automatically approved.'};
    const row=(await tx.query('INSERT INTO legacy_imports(id,workspace_id,content_hash,raw_bundle,report) VALUES($1,$2,$3,$4,$5) RETURNING *',[id,w,bundle.hash,JSON.stringify(bundle),JSON.stringify(report)])).rows[0];
    const keys=new Set<string>();
    for(const record of bundle.records){
     invariant(!keys.has(record.sourceKey),'legacy_key_conflict','Duplicate physical source keys require correction before staging. Raw source was not changed.');keys.add(record.sourceKey);
     const priorMap=(await tx.query('SELECT job_id,application_id FROM legacy_key_map WHERE workspace_id=$1 AND source_key=$2',[w,record.sourceKey])).rows[0];
     const matches=record.normalized.url?(await tx.query('SELECT id,company,title,url FROM jobs WHERE workspace_id=$1',[w])).rows.filter(j=>canonicalJobUrl(j.url)===canonicalJobUrl(record.normalized.url)):[];
     const conflicts=[...record.issues,...(priorMap?['previously_mapped_review_required']:[]),...(matches.length?['existing_url_identity_review']:[])];
     await tx.query('INSERT INTO legacy_records(id,workspace_id,import_id,source_key,raw_fields,normalized,conflicts) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),w,id,record.sourceKey,JSON.stringify(record.raw),JSON.stringify({...record.normalized,suggestedJobIds:matches.map(j=>j.id),priorMap:priorMap||null}),JSON.stringify(conflicts)]);
    }
    await event(tx,ctx,id,'legacy_application_import_staged',{counts:bundle.counts,contentHash:bundle.hash});return summary(row);
   }
   const p=c.payload,imp=(await tx.query('SELECT * FROM legacy_imports WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.importId])).rows[0];if(!imp)throw notFound();
   invariant(imp.revision===p.expectedRevision&&imp.status!=='imported','revision_conflict','Import changed or was already committed.',409);
   if(c.action==='resolve_record'){
    const q=c.payload,row=(await tx.query('SELECT * FROM legacy_records WHERE workspace_id=$1 AND import_id=$2 AND id=$3 FOR UPDATE',[w,imp.id,q.recordId])).rows[0];if(!row)throw notFound();
    if(q.resolution==='link_existing'){invariant(q.jobId,'job_required','Select the exact existing opening ID.');await jobFor(tx,ctx,q.jobId);}
    if(q.resolution==='new_opening'){
     invariant(!row.normalized.priorMap,'existing_mapping_requires_review','This source key already maps to an opening. Link that exact opening or preserve raw-only; create a distinct opening separately for a materially different role.',409);
     invariant((q.company||row.normalized.company)&&(q.title||row.normalized.title),'identity_required','Review the company and role for this opening.');
    }
    const resolution={mode:q.resolution,jobId:q.jobId||null,company:q.company||row.normalized.company,title:q.title||row.normalized.title,outcome:q.outcome,reason:q.reason};
    await tx.query('UPDATE legacy_records SET resolution=$1 WHERE workspace_id=$2 AND id=$3',[JSON.stringify(resolution),w,row.id]);
    const unresolved=Number((await tx.query('SELECT count(*) FROM legacy_records WHERE workspace_id=$1 AND import_id=$2 AND resolution IS NULL',[w,imp.id])).rows[0].count);
    await tx.query("UPDATE legacy_imports SET revision=revision+1,status=$1,report=jsonb_set(report,'{unresolved}',$2::jsonb) WHERE workspace_id=$3 AND id=$4",[unresolved?'staging':'reviewed',JSON.stringify(unresolved),w,imp.id]);
    await event(tx,ctx,row.id,'legacy_record_reviewed',{importId:imp.id,sourceKey:row.source_key,resolution:q.resolution,reason:q.reason});return {id:imp.id,revision:imp.revision+1,status:unresolved?'staging':'reviewed',unresolved};
   }
   const q=c.payload;invariant(imp.content_hash===q.contentHash,'import_changed','Confirm the exact raw import hash.',409);
   invariant(!imp.report.issues.length||q.acknowledgeRawIssues,'raw_issue_review_required','Acknowledge the raw-only source issues after reviewing them.',409);
   const records=(await tx.query('SELECT * FROM legacy_records WHERE workspace_id=$1 AND import_id=$2 ORDER BY source_key',[w,imp.id])).rows;
   invariant(records.every(r=>r.resolution),'unresolved_import','Resolve every record, including deliberate raw-only preservation.',409);
   const bundle=imp.raw_bundle as LegacyBundle;let mapped=0,preserved=0;
   for(const row of records){
    const resolution=row.resolution,prior=(await tx.query('SELECT * FROM legacy_key_map WHERE workspace_id=$1 AND source_key=$2 FOR UPDATE',[w,row.source_key])).rows[0];
    if(resolution.mode==='preserve_only'){preserved++;continue;}
    let jobId=resolution.mode==='link_existing'?resolution.jobId:prior?.job_id;
    if(!jobId){jobId=crypto.randomUUID();await tx.query('INSERT INTO jobs(id,workspace_id,company,title,location,url,description) VALUES($1,$2,$3,$4,$5,$6,$7)',[jobId,w,resolution.company,resolution.title,row.normalized.location||'',row.normalized.url||null,'']);}
    else await jobFor(tx,ctx,jobId);
    invariant(!prior||prior.job_id===jobId,'legacy_mapping_conflict','This source key already maps to another opening. Preserve raw-only or explicitly reconcile the prior mapping; no silent remap is allowed.',409);
    let app=(await tx.query('SELECT * FROM applications WHERE workspace_id=$1 AND job_id=$2 FOR UPDATE',[w,jobId])).rows[0];
    const existing=Boolean(app);
    if(!app)app=(await tx.query('INSERT INTO applications(id,workspace_id,job_id,outcome,legacy_status) VALUES($1,$2,$3,$4,$5) RETURNING *',[crypto.randomUUID(),w,jobId,resolution.outcome,row.normalized.rawStatus||null])).rows[0];
    if(existing){
     invariant(app.outcome===resolution.outcome||app.outcome==='not_submitted','outcome_conflict','Existing application outcome conflicts with this import. Preserve-only or correct it explicitly before mapping.',409);
     if(app.outcome==='not_submitted'&&resolution.outcome!=='not_submitted')await tx.query('UPDATE applications SET outcome=$1,legacy_status=$2,revision=revision+1,updated_at=now() WHERE workspace_id=$3 AND id=$4',[resolution.outcome,row.normalized.rawStatus||null,w,app.id]);
    }
    const artifacts=[];
    for(const link of row.normalized.artifactPaths||[]){
     const normalized=artifactPath(link),file=normalized?bundle.files.find(f=>f.path===normalized):null;
     if(!file)continue;
     const bytes=Buffer.from(file.base64,'base64'),pdf=normalized!.toLowerCase().endsWith('.pdf');
     const artifact=await storeArtifact(tx,w,jobId,path.basename(normalized!),bytes,pdf?'application/pdf':'text/plain; charset=utf-8',created);
     artifacts.push({id:artifact.id,path:file.path,hash:artifact.content_hash,approved:false});
    }
    const snapshot={sourceKey:row.source_key,importId:imp.id,rawStatus:row.normalized.rawStatus,reviewedOutcome:resolution.outcome,scoreAtAction:row.normalized.score,rawTier:row.normalized.rawTier,scoreTrust:'legacy_raw_not_current_fit',rawFields:row.raw_fields,artifacts,source:'user_reviewed_legacy',reason:resolution.reason};
    if(resolution.outcome==='submitted'){
     const rawDate=String(row.normalized.appliedAt||''),day=/^\d{4}-\d{2}-\d{2}$/.test(rawDate),parsed=day?rawDate+'T00:00:00.000Z':rawDate;
     const at=Number.isFinite(Date.parse(parsed))?new Date(parsed):null;
     const submission={source:'user_reviewed_legacy',external:true,score:null,tier:null,legacyScoreAtAction:row.normalized.score,rawTier:row.normalized.rawTier,rawDate,datePrecision:day?'day':at?'timestamp':'unknown',packet:null,legacyArtifacts:artifacts,finalSubmissionAutomation:'not_implemented'};
     await tx.query('UPDATE applications SET submitted_snapshot=coalesce(submitted_snapshot,$1::jsonb),applied_at=coalesce(applied_at,$2) WHERE workspace_id=$3 AND id=$4',[JSON.stringify(submission),at,w,app.id]);
    }
    await tx.query("INSERT INTO legacy_key_map(workspace_id,source_key,job_id,application_id,raw_history) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,source_key) DO UPDATE SET raw_history=legacy_key_map.raw_history||EXCLUDED.raw_history",[w,row.source_key,jobId,app.id,JSON.stringify([snapshot])]);
    await tx.query('UPDATE legacy_records SET job_id=$1,application_id=$2,normalized=normalized||$3::jsonb WHERE workspace_id=$4 AND id=$5',[jobId,app.id,JSON.stringify({artifacts}),w,row.id]);
    await tx.query('INSERT INTO application_actions(id,workspace_id,application_id,event_type,actor_session,reason,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7)',[crypto.randomUUID(),w,app.id,'legacy_application_reconciled',ctx.sessionId,resolution.reason,JSON.stringify(snapshot)]);
    mapped++;
   }
   const report={...imp.report,mapped,preservedRawOnly:preserved,unresolved:0,reviewReason:q.reason,rawBytesRetained:true,stableIdsPreserved:true};
   await tx.query("UPDATE legacy_imports SET status='imported',revision=revision+1,report=$1 WHERE workspace_id=$2 AND id=$3",[JSON.stringify(report),w,imp.id]);
   await event(tx,ctx,imp.id,'legacy_application_import_committed',{mapped,preservedRawOnly:preserved,contentHash:imp.content_hash});
   await queueApplicationProjection(tx,w);return {id:imp.id,status:'imported',revision:imp.revision+1,contentHash:imp.content_hash,report};
  });committed=true;return result;
 }finally{if(!committed)await cleanUncommitted(created);}
}
export async function legacyView(ctx:Context,selection:{importId?:string;offset?:number}={}){
 invariant(ctx.isOwner,'not_found','Record not found.',404);
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await reauthorize(tx,ctx);
  const imports=(await tx.query('SELECT id,revision,status,content_hash,report,created_at FROM legacy_imports WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 20',[ctx.workspaceId])).rows;
  const importId=selection.importId?uuid.parse(selection.importId):imports[0]?.id,offset=z.number().int().min(0).max(100000).parse(selection.offset||0);
  const records=importId?(await tx.query('SELECT id,import_id,source_key,raw_fields,normalized,conflicts,resolution,job_id,application_id FROM legacy_records WHERE workspace_id=$1 AND import_id=$2 ORDER BY source_key OFFSET $3 LIMIT 50',[ctx.workspaceId,importId,offset])).rows:[];
  const total=importId?Number((await tx.query('SELECT count(*) FROM legacy_records WHERE workspace_id=$1 AND import_id=$2',[ctx.workspaceId,importId])).rows[0].count):0;
  return {imports:imports.map(summary),records,importId,offset,total,nextOffset:offset+records.length<total?offset+records.length:null,partial:total>records.length,asOf:new Date().toISOString()};
 });
}
