import {z} from 'zod';
import type {Context} from '../auth';
import {reauthorize} from '../auth';
import {transaction} from '../db';
import {uuid} from '../commands';
import {invariant,DomainError} from '../errors';
import {computeMetrics,type Attempt,type Cohort} from './metrics';
import {validateTargetDraft} from './service';

export function defaultCohort():Cohort {const now=new Date().toISOString();return {from:'1900-01-01T00:00:00Z',to:now,asOf:now,maturityDays:14};}
export async function networkingView(ctx:Context,selection:{importId?:string;offset?:number}={}){
 const offset=z.number().int().min(0).max(100000).parse(selection.offset||0),selected=selection.importId?uuid.parse(selection.importId):null;
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await reauthorize(tx,ctx);const w=ctx.workspaceId;
  const imports=(await tx.query('SELECT id,kind,source_key,name,content_hash,row_count,created_at FROM networking_imports WHERE workspace_id=$1 ORDER BY created_at DESC,id LIMIT 101',[w])).rows;
  const rows=selected?(await tx.query('SELECT id,import_id,row_number,raw_fields,raw_values,normalized,revision,resolution,contact_id FROM networking_import_rows WHERE workspace_id=$1 AND import_id=$2 ORDER BY row_number OFFSET $3 LIMIT 51',[w,selected,offset])).rows:[];
  const contacts=(await tx.query('SELECT id,revision,fields,strength FROM networking_contacts WHERE workspace_id=$1 ORDER BY fields->>\'name\',id OFFSET $2 LIMIT 101',[w,offset])).rows;
  const targets=(await tx.query('SELECT t.*,c.fields AS contact,j.company,j.title FROM networking_targets t JOIN networking_contacts c ON c.workspace_id=t.workspace_id AND c.id=t.contact_id JOIN jobs j ON j.workspace_id=t.workspace_id AND j.id=t.job_id WHERE t.workspace_id=$1 ORDER BY t.updated_at DESC,t.id LIMIT 101',[w])).rows;
  for(const t of targets){
   t.draftUsable=false;
   if(t.draft)try{await validateTargetDraft(tx,w,t);t.draftUsable=true;}catch(e){if(!(e instanceof DomainError))throw e;t.draftIssue=e.message;}
  }
  const tasks=(await tx.query('SELECT * FROM networking_recruiter_tasks WHERE workspace_id=$1 ORDER BY needs_response DESC,updated_at DESC,id LIMIT 101',[w])).rows;
  const jobs=(await tx.query("SELECT j.id,j.company,j.title FROM jobs j WHERE j.workspace_id=$1 AND NOT j.archived AND (EXISTS(SELECT 1 FROM evaluations e JOIN candidates c ON c.workspace_id=e.workspace_id WHERE e.workspace_id=j.workspace_id AND e.job_id=j.id AND e.job_revision=j.revision AND e.candidate_revision=c.revision AND e.status='completed' AND e.tier IN ('T2','T3')) OR EXISTS(SELECT 1 FROM job_policy_reviews p WHERE p.workspace_id=j.workspace_id AND p.job_id=j.id AND p.job_revision=j.revision AND 'connection'=ANY(p.priority_signals))) ORDER BY j.updated_at DESC LIMIT 101",[w])).rows;
  const facts=(await tx.query("SELECT f.id,f.revision,f.field_key,f.value FROM candidate_facts f JOIN candidate_sources s ON s.workspace_id=f.workspace_id AND s.id=f.source_id JOIN candidates c ON c.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND c.ownership='canonical' AND f.status='current' AND f.sensitivity='standard' AND s.classification<>'restricted' AND s.deleted_at IS NULL AND s.revision=f.source_revision ORDER BY f.field_key LIMIT 101",[w])).rows;
  return {imports:imports.slice(0,100),rows:rows.slice(0,50),contacts:contacts.slice(0,100),targets:targets.slice(0,100),tasks:tasks.slice(0,100),jobs:jobs.slice(0,100),facts:facts.slice(0,100),offset,selectedImport:selected,
   partial:{imports:imports.length>100,rows:rows.length>50,contacts:contacts.length>100,targets:targets.length>100,tasks:tasks.length>100,jobs:jobs.length>100,facts:facts.length>100},asOf:new Date().toISOString(),authority:'isolated authorized imports; no native contact/history writer cutover',manualOnly:true};
 });
}
export async function networkingMetrics(ctx:Context,cohort:Cohort=defaultCohort()){
 return transaction(async tx=>{
  await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');await reauthorize(tx,ctx);const w=ctx.workspaceId;
  const apps=(await tx.query(`SELECT a.id,a.created_at,s.snapshot AS submission,s.created_at AS submission_recorded_at,o.snapshot AS outcome_snapshot,o.created_at AS outcome_at,i.snapshot AS interview_snapshot,i.created_at AS interview_at,i.event_type AS interview_event_type
   FROM applications a
   LEFT JOIN LATERAL(SELECT snapshot,created_at FROM application_actions WHERE workspace_id=a.workspace_id AND application_id=a.id AND event_type='submission_recorded' AND created_at<=$2 ORDER BY created_at DESC,id DESC LIMIT 1)s ON true
   LEFT JOIN LATERAL(SELECT snapshot,created_at FROM application_actions WHERE workspace_id=a.workspace_id AND application_id=a.id AND event_type IN ('application_outcome_recorded','application_outcome_corrected') AND created_at<=$2 ORDER BY created_at DESC,id DESC LIMIT 1)o ON o.created_at>=s.created_at
   LEFT JOIN LATERAL(SELECT snapshot,created_at,event_type FROM application_actions WHERE workspace_id=a.workspace_id AND application_id=a.id AND created_at<=$2 AND (event_type='application_outcome_corrected' OR event_type='application_outcome_recorded' AND snapshot->>'outcome' IN ('interviewing','offer')) ORDER BY created_at DESC,id DESC LIMIT 1)i ON i.created_at>=s.created_at
   WHERE a.workspace_id=$1 AND a.created_at<=$2 ORDER BY a.id LIMIT 10001`,[w,cohort.asOf])).rows;
  const history=(await tx.query('SELECT h.id,h.identity_key,h.application_id,r.reviewed,r.reviewed_at FROM networking_history_attempts h JOIN LATERAL(SELECT reviewed,reviewed_at FROM networking_history_reviews WHERE workspace_id=h.workspace_id AND attempt_id=h.id AND reviewed_at<=$2 ORDER BY revision DESC LIMIT 1)r ON true WHERE h.workspace_id=$1 ORDER BY r.reviewed_at DESC,h.id LIMIT 10001',[w,cohort.asOf])).rows;
  invariant(apps.length+history.length<=10000,'metric_limit','At most 10,000 attempts are supported in one report; no truncated KPI is returned.');
  const records:Attempt[]=apps.map(a=>{
   const s=a.submission,latest=a.outcome_snapshot?.outcome||'unknown';
   const locationFlag=s?.policy?.flags?.find((f:{flagType:string})=>f.flagType==='location');
   // S5 did not snapshot location text. Only its immutable positive policy can establish compatibility.
   const location=typeof s?.location==='string'?s.location:locationFlag?.severity==='positive'?'Northern Virginia':'';
   return {identity:'application:'+a.id,submitted:Boolean(s)&&latest!=='not_submitted',submittedAt:s?.submittedAt||null,location,interview:['interviewing','offer'].includes(a.interview_snapshot?.outcome)?'accepted':'unknown',interviewAt:a.interview_at?new Date(a.interview_at).toISOString():null,outcome:latest,metadata:{score:s?.score,tier:s?.tier,variant:s?.packet?.untailored===true?'untailored':undefined},origin:'S5 user-declared action'};
  });
  const corrected=new Set(apps.filter(a=>a.outcome_snapshot?.outcome==='not_submitted').map(a=>'application:'+a.id));
  const interviewCorrections=new Map(apps.filter(a=>a.interview_event_type==='application_outcome_corrected'&&!['interviewing','offer'].includes(a.interview_snapshot?.outcome)).map(a=>['application:'+a.id,new Date(a.interview_at).getTime()]));
  for(const h of history){
   const r=h.reviewed;
   const reviewed:Attempt={identity:h.identity_key,submitted:r.submitted,submittedAt:r.submittedAt,location:r.location,interview:r.interview,interviewAt:r.interviewAt,outcome:r.interview==='accepted'?'interviewing':'unknown',metadata:{...r.metadata,source:r.source},origin:'reviewed history'};
   const canonical=records.find(a=>a.identity===h.identity_key);
   if(canonical&&!corrected.has(canonical.identity)){
    if(!canonical.submitted)Object.assign(canonical,reviewed);
    else{
     canonical.location=canonical.location||reviewed.location;
     if(canonical.interview==='unknown'&&(!interviewCorrections.has(canonical.identity)||new Date(h.reviewed_at).getTime()>interviewCorrections.get(canonical.identity)!)){canonical.interview=reviewed.interview;canonical.interviewAt=reviewed.interviewAt;}
     canonical.metadata={...reviewed.metadata,...Object.fromEntries(Object.entries(canonical.metadata||{}).filter(([,v])=>v!==null&&v!==undefined))};
    }
   }
   records.push(reviewed);
  }
  const result=computeMetrics(records,cohort);
  const raw=(await tx.query("SELECT count(*)::integer AS count FROM networking_import_rows r JOIN networking_imports i ON i.workspace_id=r.workspace_id AND i.id=r.import_id WHERE r.workspace_id=$1 AND i.kind='history' AND i.created_at<=$2 AND NOT EXISTS(SELECT 1 FROM networking_history_attempts h JOIN networking_history_reviews v ON v.workspace_id=h.workspace_id AND v.attempt_id=h.id WHERE h.workspace_id=r.workspace_id AND h.row_id=r.id AND v.reviewed_at<=$2)",[w,cohort.asOf])).rows[0].count;
  return {...result,unreviewedHistoryRows:raw,canonicalLocationBasis:'Immutable S5 submission policy; absent location evidence is unknown.',asOf:cohort.asOf};
 });
}
export async function rawNetworkingImport(ctx:Context,id:string){
 uuid.parse(id);return transaction(async tx=>{
  await reauthorize(tx,ctx);const row=(await tx.query('SELECT raw_bytes,content_hash FROM networking_imports WHERE workspace_id=$1 AND id=$2',[ctx.workspaceId,id])).rows[0];
  invariant(row,'not_found','Import not found.',404);return row as {raw_bytes:Buffer;content_hash:string};
 });
}
export async function networkingAgentRead(ctx:Context,input:unknown){
 const p=z.object({section:z.enum(['queue','metrics'])}).strict().parse(input);
 if(p.section==='metrics'){
  const m=await networkingMetrics(ctx);return {asOf:m.asOf,cohort:m.cohort,primary:m.primary,exclusions:m.exclusions,unreviewedHistoryRows:m.unreviewedHistoryRows,immature:m.immature,unknownOutcome:m.unknownOutcome,unknownInterview:m.unknownInterview,warnings:m.warnings,detailView:'networking'};
 }
 const v=await networkingView(ctx);
 return {asOf:v.asOf,manualOnly:true,partial:{...v.partial,toolSummary:v.targets.length>10},counts:{contacts:v.contacts.length,targets:v.targets.length,needsResponse:v.tasks.filter(t=>t.needs_response).length},targets:v.targets.slice(0,10).map(t=>({id:t.id,jobId:t.job_id,status:t.status,revision:t.revision,draftUsable:t.draftUsable})),detailView:'networking',privacy:'Contact identity, private research, raw history and candidate claims are withheld from agent context.'};
}
