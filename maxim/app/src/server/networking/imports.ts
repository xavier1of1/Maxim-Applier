import crypto from 'node:crypto';
import type {PoolClient} from 'pg';
import {z} from 'zod';
import type {Context} from '../auth';
import {command,event,uuid} from '../commands';
import {invariant} from '../errors';
import {parseImport,fields} from './import-parser';
import {contactFromRaw} from './policy';

export const hash=(value:string|Buffer)=>crypto.createHash('sha256').update(value).digest('hex');
export const sourceKey=z.string().trim().min(1).max(200);
export async function importNetworking(ctx:Context,input:{commandId:string;kind:'contacts'|'history';sourceKey:string;name:string;bytes:Buffer;authorized:true}){
 uuid.parse(input.commandId);sourceKey.parse(input.sourceKey);
 invariant(input.authorized===true,'import_authorization_required','Confirm that this is an authorized export.');
 const contentHash=hash(input.bytes);
 return command(ctx,input.commandId,{action:'networking_import',kind:input.kind,sourceKey:input.sourceKey,name:input.name,contentHash},async tx=>{
  const w=ctx.workspaceId;
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[w+':networking-import']);
  const prior=(await tx.query('SELECT id,row_count,content_hash FROM networking_imports WHERE workspace_id=$1 AND kind=$2 AND source_key=$3 AND content_hash=$4',[w,input.kind,input.sourceKey,contentHash])).rows[0];
  if(prior)return prior;
  const rows=parseImport(input.name,input.bytes,input.kind),id=crypto.randomUUID();
  await tx.query('INSERT INTO networking_imports(id,workspace_id,kind,source_key,name,content_hash,raw_bytes,row_count) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id,w,input.kind,input.sourceKey,input.name,contentHash,input.bytes,rows.length]);
  for(const row of rows){
   const f=fields(row.raw);let normalized:unknown,contactId:string|null=null;
   if(input.kind==='contacts'){
    const c=contactFromRaw(row.raw),key=f('id','contact id')||c.linkedinUrl.toLowerCase()||c.email.toLowerCase()||hash(JSON.stringify(row.raw));
    const saved=(await tx.query('INSERT INTO networking_contacts(id,workspace_id,identity_key,fields,strength) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,identity_key) DO UPDATE SET identity_key=EXCLUDED.identity_key RETURNING id',[crypto.randomUUID(),w,hash(input.sourceKey+'|'+key),JSON.stringify(c),c.strength])).rows[0];
    contactId=saved.id;normalized=c;
   }else normalized={company:f('company'),role:f('role','title'),location:f('location'),dateSubmitted:f('date submitted'),interviewRound:f('interview round'),applicationStatusRaw:f('application status','status'),legacyKey:f('legacy key','legacy id','id'),source:f('source'),link:f('link','url'),issues:['Unreviewed: dates, submission and interview evidence require explicit interpretation.']};
   await tx.query('INSERT INTO networking_import_rows(id,workspace_id,import_id,row_number,raw_fields,raw_values,normalized,contact_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),w,id,row.rowNumber,JSON.stringify(row.raw),JSON.stringify(row.values),JSON.stringify(normalized),contactId]);
  }
  await event(tx,ctx,id,'networking_imported',{kind:input.kind,contentHash,rows:rows.length},1);
  return {id,row_count:rows.length,content_hash:contentHash};
 });
}
export const historyReview=z.object({rowId:uuid,expectedRevision:z.number().int().positive(),applicationId:uuid.optional(),legacySourceKey:sourceKey.optional(),attemptKey:sourceKey.optional(),submitted:z.boolean(),submittedAt:z.string().datetime({offset:true}).nullable(),interview:z.enum(['accepted','rejected','unknown']),interviewAt:z.string().datetime({offset:true}).nullable(),interpretation:z.string().trim().min(3).max(2000),conflictAcknowledged:z.boolean(),metadata:z.object({score:z.number().min(1).max(5).optional(),tier:z.enum(['T0','T1','T2','T3']).optional(),source:z.string().max(200).optional(),lane:z.string().max(200).optional(),variant:z.string().max(200).optional(),networking:z.string().max(200).optional(),strength:z.number().int().min(1).max(3).optional(),postedAt:z.string().datetime({offset:true}).optional()}).strict().default({})}).strict();
export async function reviewHistory(tx:PoolClient,ctx:Context,raw:unknown){
 const p=historyReview.parse(raw),w=ctx.workspaceId;
 const row=(await tx.query("SELECT r.*,i.source_key,i.kind FROM networking_import_rows r JOIN networking_imports i ON i.id=r.import_id AND i.workspace_id=r.workspace_id WHERE r.id=$1 AND r.workspace_id=$2 FOR UPDATE OF r",[p.rowId,w])).rows[0];
 invariant(row&&row.kind==='history','not_found','History row not found.',404);
 invariant(row.revision===p.expectedRevision,'revision_conflict','History review changed; refresh.',409);
 invariant(!p.submittedAt||Date.parse(p.submittedAt)<=Date.now(),'future_submission','Submission must be in the past.');
 invariant(p.interview!=='accepted'||p.submitted&&p.submittedAt&&p.interviewAt&&Date.parse(p.interviewAt)>=Date.parse(p.submittedAt)&&Date.parse(p.interviewAt)<=Date.now(),'interview_evidence_required','Accepted interview evidence requires a reviewed submitted date and actual interview date.');
 invariant(p.interview!=='accepted'||Boolean(row.normalized.interviewRound),'interview_round_required','A soft Application Status alone is not high-trust interview evidence. Use canonical application outcome review instead.');
 invariant(!row.normalized.interviewRound||p.conflictAcknowledged,'history_interpretation_required','Explicitly acknowledge interpretation of the raw interview field, including conflicts.');
 let applicationId=p.applicationId;
 if(p.legacySourceKey){
  const mapped=(await tx.query('SELECT application_id FROM legacy_key_map WHERE workspace_id=$1 AND source_key=$2',[w,p.legacySourceKey])).rows[0];
  invariant(mapped?.application_id&&(!applicationId||applicationId===mapped.application_id),'legacy_mapping_conflict','Use the exact S5 legacy mapping, or reconcile it first.',409);applicationId=mapped.application_id;
 }
 if(applicationId)invariant((await tx.query('SELECT id FROM applications WHERE workspace_id=$1 AND id=$2',[w,applicationId])).rowCount,'not_found','Application not found.',404);
 invariant(applicationId||p.attemptKey,'attempt_identity_required','Map to S5 or declare a source-scoped opening/attempt key, not company/title similarity.');
 const identity=applicationId?'application:'+applicationId:'history:'+row.source_key+':'+p.attemptKey;
 const rowMapping=(await tx.query('SELECT identity_key FROM networking_history_attempts WHERE workspace_id=$1 AND row_id=$2',[w,row.id])).rows[0];
 invariant(!rowMapping||rowMapping.identity_key===identity,'history_identity_conflict','A reviewed row cannot silently become a second attempt. Preserve its established mapping.',409);
 const reviewed={...p,location:row.normalized.location,company:row.normalized.company,role:row.normalized.role,source:p.metadata.source||row.normalized.source};
 const existing=(await tx.query('SELECT id,row_id FROM networking_history_attempts WHERE workspace_id=$1 AND identity_key=$2 FOR UPDATE',[w,identity])).rows[0];
 invariant(!existing||existing.row_id===row.id,'duplicate_attempt','This attempt is already mapped. The duplicate raw row remains preserved and excluded.',409);
 const attempt=(await tx.query('INSERT INTO networking_history_attempts(id,workspace_id,identity_key,row_id,application_id,reviewed) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(workspace_id,identity_key) DO UPDATE SET reviewed=EXCLUDED.reviewed,revision=networking_history_attempts.revision+1,reviewed_at=now() RETURNING id,revision',[crypto.randomUUID(),w,identity,row.id,applicationId||null,JSON.stringify(reviewed)])).rows[0];
 await tx.query('INSERT INTO networking_history_reviews(workspace_id,attempt_id,revision,reviewed) VALUES($1,$2,$3,$4)',[w,attempt.id,attempt.revision,JSON.stringify(reviewed)]);
 await tx.query('UPDATE networking_import_rows SET resolution=$1,revision=revision+1 WHERE workspace_id=$2 AND id=$3',[JSON.stringify({attemptId:attempt.id,identity}),w,row.id]);
 await event(tx,ctx,attempt.id,'networking_history_reviewed',{rowId:row.id,submitted:p.submitted,interview:p.interview},attempt.revision);return attempt;
}
