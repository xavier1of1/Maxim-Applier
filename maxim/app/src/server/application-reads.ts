import {transaction} from './db';
import {type Context,reauthorize} from './auth';
import {duplicateRisk} from './application-duplicates';
import {engineSnapshot} from './evaluation-native';
import {z} from 'zod';
import {uuid} from './commands';

export async function applicationView(ctx:Context,selection:{applicationId?:string;offset?:number}={}){
 const engine=await engineSnapshot();
 const offset=z.number().int().min(0).max(100000).parse(selection.offset||0),target=selection.applicationId?uuid.parse(selection.applicationId):null;
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await reauthorize(tx,ctx);const w=ctx.workspaceId;
  const candidate=(await tx.query('SELECT revision,ownership FROM candidates WHERE workspace_id=$1',[w])).rows[0];
  const appSql='SELECT a.*,j.company,j.title,j.location,j.url,j.description,j.opening_key,j.revision AS job_revision FROM applications a JOIN jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id WHERE a.workspace_id=$1';
  const page=(await tx.query(appSql+' ORDER BY a.updated_at DESC,a.id OFFSET $2 LIMIT 51',[w,offset])).rows,applications=page.slice(0,50);
  if(target&&!applications.some(a=>a.id===target)){const row=(await tx.query(appSql+' AND a.id=$2',[w,target])).rows[0];if(row)applications.unshift(row);}
  const jobIds=applications.map(a=>a.job_id),appIds=applications.map(a=>a.id);
  const evaluations=(await tx.query("SELECT e.id,e.job_id,e.revision,e.status,e.job_revision,e.candidate_revision,e.score,e.tier,e.archetype,e.legitimacy,e.liveness,e.policy,e.report_artifact_id,e.output_manifest,e.error_code,e.created_at,e.completed_at,e.accounting,e.usage,e.input_snapshot->'engine'->>'hash' AS engine_hash,left(e.explanation,3000) AS explanation,w.status AS work_status,w.error_code AS work_error FROM evaluations e LEFT JOIN work_items w ON w.id=e.work_id AND w.workspace_id=e.workspace_id WHERE e.workspace_id=$1 AND (e.job_id=ANY($2::uuid[]) OR NOT EXISTS(SELECT 1 FROM applications a WHERE a.workspace_id=e.workspace_id AND a.job_id=e.job_id)) ORDER BY (e.job_id=$3::uuid) DESC NULLS LAST,e.created_at DESC LIMIT 201",[w,jobIds,applications.find(a=>a.id===target)?.job_id||null])).rows.map(e=>({...e,current:e.status==='completed'&&e.candidate_revision===candidate.revision&&e.engine_hash===engine.hash&&applications.some(a=>a.job_id===e.job_id&&a.job_revision===e.job_revision)}));
  const packets=(await tx.query("SELECT p.*,EXISTS(SELECT 1 FROM answer_dependencies d WHERE d.workspace_id=p.workspace_id AND d.entity_id=p.id AND d.status='invalidated') OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.answers) r JOIN answer_memory a ON a.id=(r->>'answerId')::uuid AND a.workspace_id=p.workspace_id WHERE a.status<>'approved' OR a.revision<>(r->>'answerRevision')::integer OR a.expires_at<=now()) AS answer_stale FROM application_packets p WHERE p.workspace_id=$1 AND p.application_id=ANY($2::uuid[]) ORDER BY (p.application_id=$3::uuid) DESC NULLS LAST,p.created_at DESC LIMIT 201",[w,appIds,target])).rows.map(p=>({...p,evidence:p.evidence.map((f:{id:string;revision:number;field_key:string})=>({id:f.id,revision:f.revision,field_key:f.field_key})),answers:p.answers.map((a:{useId:string;answerId:string;answerRevision:number})=>({useId:a.useId,answerId:a.answerId,answerRevision:a.answerRevision})),current:!p.answer_stale&&evaluations.some(e=>e.id===p.evaluation_id&&e.current)}));
  const actions=(await tx.query('SELECT id,application_id,event_type,reason,snapshot,created_at FROM application_actions WHERE workspace_id=$1 AND application_id=ANY($2::uuid[]) ORDER BY (application_id=$3::uuid) DESC NULLS LAST,created_at DESC LIMIT 201',[w,appIds,target])).rows;
  const work=(await tx.query("SELECT id,kind,status,result,error_code,input->>'applicationId' AS application_id,input->>'evaluationId' AS evaluation_id,created_at FROM work_items WHERE workspace_id=$1 AND kind IN ('evaluate_job','build_packet','project_applications') ORDER BY created_at DESC LIMIT 100",[w])).rows;
  const reviews=(await tx.query('SELECT * FROM job_policy_reviews WHERE workspace_id=$1 AND job_id=ANY($2::uuid[])',[w,jobIds])).rows;
  const overrides=(await tx.query('SELECT * FROM strategic_overrides WHERE workspace_id=$1 AND application_id=ANY($2::uuid[]) ORDER BY created_at DESC LIMIT 100',[w,appIds])).rows;
  const duplicates:Record<string,unknown>={};
  for(const app of applications.slice(0,200))duplicates[app.id]=await duplicateRisk(tx,w,{...app,id:app.job_id},app.id);
  const authority=(await tx.query('SELECT * FROM application_authority WHERE workspace_id=$1',[w])).rows[0]||{owner:'legacy',revision:1};
  return {applications,evaluations:evaluations.slice(0,200),packets:packets.slice(0,200),actions:actions.slice(0,200),work,reviews,overrides,duplicates,authority,candidate,engineHash:engine.hash,offset,nextOffset:page.length>50?offset+50:null,partial:page.length>50||offset>0||evaluations.length>200||packets.length>200||actions.length>200,asOf:new Date().toISOString(),finalSubmissionAutomation:'not_implemented'};
 });
}
