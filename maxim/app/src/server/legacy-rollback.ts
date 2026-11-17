import path from 'node:path';
import fs from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import type {PoolClient} from 'pg';
import {nativeRoot,safeTarget,atomic} from './projections';
import {nativeStatus} from './application-projections';
import {invariant} from './errors';

function scalar(v:unknown){return v&&typeof v==='object'&&'sqliteInteger'in v?String((v as {sqliteInteger:string}).sqliteInteger):typeof v==='string'?v:'';}
export async function rollbackLegacySqlite(tx:PoolClient,w:string,transitionId:string,projected:Record<string,any>[]){
 const target=await safeTarget(path.join(nativeRoot(),'data/maxim/maxim.db'));
 await fs.mkdir(path.dirname(target),{recursive:true,mode:0o700});
 const schema=await fs.readFile(/* turbopackIgnore: true */ path.resolve(/* turbopackIgnore: true */ process.cwd(),'../db/schema.sql'),'utf8');
 const apps=(await tx.query('SELECT a.*,j.company,j.title,j.url,j.location,j.note FROM applications a JOIN jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id WHERE a.workspace_id=$1 ORDER BY a.projection_number',[w])).rows;
 const mappings=(await tx.query("SELECT m.*,r.raw_fields FROM legacy_key_map m LEFT JOIN LATERAL(SELECT raw_fields FROM legacy_records WHERE workspace_id=m.workspace_id AND source_key=m.source_key AND application_id=m.application_id ORDER BY id LIMIT 1) r ON true WHERE m.workspace_id=$1 AND m.source_key LIKE 'sqlite:applications:%'",[w])).rows;
 const now=new Date().toISOString(),db=new DatabaseSync(target,{allowExtension:false,defensive:true,timeout:2000});
 const exported=[];
 try{
  db.exec(schema);db.exec('BEGIN IMMEDIATE');
  for(const app of apps){
   const e=(await tx.query("SELECT id,score,tier,status,policy FROM evaluations WHERE workspace_id=$1 AND job_id=$2 ORDER BY created_at DESC LIMIT 1",[w,app.job_id])).rows[0];
   const projection=projected.find(p=>p.id===app.id);invariant(projection,'rollback_projection_missing','Reviewed rollback projection is incomplete.');
   const reportPath=projection.reportPath||null,pdfPath=projection.pdfPath||null;
   const known=Boolean(projection?.scoreKnown),score=known?projection.score:null,tier=projection?.tier||'Unknown';
   const refs=mappings.filter(m=>m.application_id===app.id);
   const targets=refs.length?refs.map(m=>({appId:m.source_key.slice('sqlite:applications:'.length),jobId:scalar(m.raw_fields?.job_id)||app.job_id})): [{appId:app.id,jobId:app.job_id}];
   for(const ref of targets){
    const old=db.prepare('SELECT raw_payload_json FROM applications WHERE id=?').get(ref.appId);
    let original=old?.raw_payload_json;try{const prior=JSON.parse(String(original||'{}'));if(prior.canonicalApplicationId===app.id&&prior.legacyRollback===transitionId)original=prior.legacyOriginalRawPayload;}catch{}
    const evalId=e?.id||'canonical-unscored-'+app.job_id,raw=JSON.stringify({canonicalApplicationId:app.id,canonicalJobId:app.job_id,legacyRollback:transitionId,outcome:app.outcome,workflow:app.workflow,submittedSnapshot:app.submitted_snapshot,legacyOriginalRawPayload:original||null});
    db.prepare("INSERT INTO career_ops_evaluations(id,report_path,pdf_path,company,role,score,source,job_url,location_text,summary,raw_payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET report_path=excluded.report_path,pdf_path=excluded.pdf_path,company=excluded.company,role=excluded.role,score=excluded.score,job_url=excluded.job_url,location_text=excluded.location_text,summary=excluded.summary,raw_payload_json=excluded.raw_payload_json,updated_at=excluded.updated_at")
     .run(evalId,reportPath,pdfPath,app.company,app.title,score,'canonical_rollback',app.url,app.location,known?'Retained Career-Ops evaluation':'Current fit unknown; do not treat as T0',raw,now,now);
    db.prepare("INSERT INTO maxim_jobs(id,evaluation_id,company,role,tier,status,next_action,explanation,career_ops_score,priority_overlay,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET evaluation_id=excluded.evaluation_id,company=excluded.company,role=excluded.role,tier=excluded.tier,status=excluded.status,next_action=excluded.next_action,explanation=excluded.explanation,career_ops_score=excluded.career_ops_score,updated_at=excluded.updated_at")
     .run(ref.jobId,evalId,app.company,app.title,tier,app.outcome==='not_submitted'?app.workflow:app.outcome,known?'review_application':'evaluate_current_opening','Preserved latest canonical state at reviewed rollback',score,0,now,now);
    db.prepare("INSERT INTO applications(id,job_id,career_ops_row_key,company,role,status,applied_at,score,tier,source,pdf_path,report_path,job_url,raw_payload_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET job_id=excluded.job_id,company=excluded.company,role=excluded.role,status=excluded.status,applied_at=excluded.applied_at,score=excluded.score,tier=excluded.tier,source=excluded.source,pdf_path=excluded.pdf_path,report_path=excluded.report_path,job_url=excluded.job_url,raw_payload_json=excluded.raw_payload_json,updated_at=excluded.updated_at")
     .run(ref.appId,ref.jobId,String(app.projection_number),app.company,app.title,nativeStatus(app),app.applied_at?.toISOString()||null,score,tier,'canonical_rollback',pdfPath,reportPath,app.url,raw,app.created_at.toISOString(),now);
    exported.push({canonicalApplicationId:app.id,legacyApplicationId:ref.appId,legacyJobId:ref.jobId,outcome:app.outcome});
   }
  }
  db.exec('COMMIT');
 }catch(e){try{db.exec('ROLLBACK');}catch{}throw e;}finally{db.close();}
 const events=(await tx.query('SELECT * FROM events WHERE workspace_id=$1 ORDER BY sequence LIMIT 50001',[w])).rows;
 invariant(events.length<=50000,'projection_limit','Rollback event export exceeds its bound.');
 const lines=events.map(e=>JSON.stringify({event_id:e.id,event_type:e.event_type,entity_type:'canonical_workspace',entity_id:e.entity_id,timestamp:e.created_at.toISOString(),actor:'canonical_workspace',reason:e.payload?.reason||'',payload:e.payload}));
 await atomic(path.join(nativeRoot(),'data/maxim/events/canonical-'+transitionId+'.jsonl'),lines.join('\n')+'\n');
 return {applications:apps.length,legacyRowsUpdated:exported.length,ids:exported,otherSqliteRows:'preserved_in_place',oldUnmappedRows:'preserved_not_deleted'};
}
