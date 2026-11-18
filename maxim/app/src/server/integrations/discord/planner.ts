import type {PoolClient} from 'pg';
import {digest} from '../../auth';
import {engineSnapshot} from '../../evaluation-native';
import type {NotificationKind,Plan,PlanInput} from './types';

export const optionalProducers = {s7:'discord_s7_ready_tasks',s9:'discord_s9_ready_tasks'} as const;
type TaskGroup = {count:number;identity:string};
export async function producerTasks(tx:PoolClient,w:string,lane:'s7'|'s9',now:Date):Promise<{available:boolean;groups:Partial<Record<NotificationKind,TaskGroup>>}> {
 const name=optionalProducers[lane];
 const columns=(await tx.query(`SELECT a.attname FROM pg_attribute a WHERE a.attrelid=to_regclass($1) AND a.attnum>0 AND NOT a.attisdropped`,['public.'+name])).rows.map(r=>r.attname);
 if(!['workspace_id','task_id','revision','kind','status','due_at'].every(c=>columns.includes(c)))return {available:false,groups:{}};
 const allowed=lane==='s7'?['needs_response']:['networking_review','recruiter_reminder'];
 const rows=(await tx.query(`SELECT kind,count(DISTINCT task_id)::integer AS count,md5(string_agg(DISTINCT task_id::text,',' ORDER BY task_id::text)) AS identity
  FROM public.${name} WHERE workspace_id=$1 AND status='pending' AND kind=ANY($2::text[]) AND due_at<=$3 GROUP BY kind`,[w,allowed,now])).rows;
 return {available:true,groups:Object.fromEntries(rows.map(r=>[r.kind,{count:r.count,identity:r.identity}]))};
}
export async function canonicalCounts(tx:PoolClient,w:string,now:Date) {
 const applications=(await tx.query(`SELECT a.id,a.revision FROM applications a JOIN jobs j ON j.workspace_id=a.workspace_id AND j.id=a.job_id
  WHERE a.workspace_id=$1 AND a.status='intent' AND a.outcome='not_submitted' AND NOT j.archived ORDER BY a.id`,[w])).rows;
 const submitted=Number((await tx.query(`SELECT count(*) FROM applications WHERE workspace_id=$1 AND applied_at<=$2
  AND submitted_snapshot->>'source'='user_declaration' AND outcome IN ('submitted','responded','interviewing','offer','rejected','withdrawn')`,[w,now])).rows[0].count);
 const s7=await producerTasks(tx,w,'s7',now),s9=await producerTasks(tx,w,'s9',now);
 return {applications,s7,s9,counts:{submitted,applicationReview:applications.length,needsResponse:s7.groups.needs_response?.count||0,
  networkingReview:s9.groups.networking_review?.count||0,recruiterReminder:s9.groups.recruiter_reminder?.count||0}};
}
async function freshHighFit(tx:PoolClient,w:string,id:string|undefined,now:Date) {
 if(!id)return false;
 const r=(await tx.query(`SELECT j.revision,j.archived,j.posted_at,j.discovery_policy,c.revision AS candidate_revision,c.ownership,
  e.id,e.job_revision,e.candidate_revision AS evaluated_candidate_revision,e.status,e.score,e.tier,e.policy,e.input_snapshot,
  p.revision AS policy_revision,coalesce(pr.revision,0) AS review_revision,
  o.posted_at AS evidence_posted_at,o.date_basis,o.observed_at,o.identity_conflict,ds.enabled,dr.status AS source_status
  FROM jobs j JOIN candidates c ON c.workspace_id=j.workspace_id
  JOIN LATERAL (SELECT * FROM evaluations WHERE workspace_id=j.workspace_id AND job_id=j.id ORDER BY created_at DESC,id DESC LIMIT 1) e ON true
  LEFT JOIN workspace_policies p ON p.workspace_id=j.workspace_id
  LEFT JOIN job_policy_reviews pr ON pr.workspace_id=j.workspace_id AND pr.job_id=j.id AND pr.job_revision=j.revision
  LEFT JOIN LATERAL (SELECT * FROM job_observations WHERE workspace_id=j.workspace_id AND job_id=j.id ORDER BY observed_at DESC,id DESC LIMIT 1) o ON true
  LEFT JOIN discovery_sources ds ON ds.workspace_id=o.workspace_id AND ds.id=o.source_id
  LEFT JOIN discovery_runs dr ON dr.workspace_id=o.workspace_id AND dr.id=o.run_id
  WHERE j.workspace_id=$1 AND j.id=$2
  AND NOT EXISTS(SELECT 1 FROM job_discovery_states s WHERE s.workspace_id=j.workspace_id AND s.job_id=j.id AND s.state='dismissed')
  AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.workspace_id=j.workspace_id AND a.job_id=j.id AND (a.status='archived' OR a.outcome<>'not_submitted'))
  AND NOT EXISTS(SELECT 1 FROM fact_dependencies d WHERE d.workspace_id=e.workspace_id AND d.entity_id=e.id AND d.status='invalidated')`,[w,id])).rows[0];
 if(!r||r.archived||r.ownership!=='canonical'||r.status!=='completed'||!['T2','T3'].includes(r.tier)||Number(r.score)<4)return false;
 if(r.job_revision!==r.revision||r.evaluated_candidate_revision!==r.candidate_revision||r.policy?.allowed!==true||r.policy?.eligibility!=='eligible'||r.policy?.urgent!==true)return false;
 if(r.policy?.policyRevision!==r.policy_revision||(r.input_snapshot?.policyReviewRevision||0)!==r.review_revision)return false;
 const posted=Number(new Date(r.posted_at||NaN)),observed=Number(new Date(r.observed_at||NaN)),age=now.getTime()-posted;
 if(!Number.isFinite(age)||!Number.isFinite(observed)||age<0||age>48*3600000||observed>now.getTime()||now.getTime()-observed>24*3600000)return false;
 if(!r.enabled||r.identity_conflict||!['first_published','publishedAt'].includes(r.date_basis)||!['completed','partial'].includes(r.source_status))return false;
 if(Number(new Date(r.evidence_posted_at||NaN))!==posted||r.discovery_policy?.eligibility!=='eligible')return false;
 return (await engineSnapshot()).hash===r.input_snapshot?.engine?.hash;
}
export async function buildPlan(tx:PoolClient,w:string,input:PlanInput,now=new Date()):Promise<Plan> {
 const {applications,s7,s9,counts}=await canonicalCounts(tx,w,now);
 const base={kind:input.kind,...(input.entityId?{entityId:input.entityId}:{}),payloadRevision:1 as const,counts,asOf:now.toISOString()};
 let eligible=true,reason='eligible',content='',identity=input.kind as string;
 if(input.kind==='application_review'){
  eligible=applications.length>0;identity+=':'+digest(applications.map(a=>a.id).join(','));content=`Application review: ${counts.applicationReview} unresolved applications. Confirmed submissions: ${counts.submitted}.`;
 }else if(input.kind==='weekly_review'){
  content=`Weekly review: ${counts.submitted} confirmed submissions; ${counts.applicationReview} unresolved applications.`;
 }else if(input.kind==='resume_review'){
  content='Saturday resume/PDF review is due. Review current approved material in the private workspace.';
 }else if(input.kind==='high_fit'){
  eligible=await freshHighFit(tx,w,input.entityId,now);identity+=':'+input.entityId;
  content='1 eligible T2+ Career-Ops opening with verified posting time within 48 hours. Review in the private workspace.';
 }else{
  const lane=input.kind==='needs_response'?s7:s9,group=lane.groups[input.kind],count=group?.count||0;
  eligible=lane.available&&count>0;reason=lane.available?'eligible':'producer_unavailable';identity+=':'+(group?.identity||'empty');
  content=input.kind==='needs_response'?`Needs Response: ${count} unresolved tasks.`:input.kind==='networking_review'?`Networking review: ${count} unresolved tasks.`:`Manual recruiter reminders: ${count} due tasks.`;
 }
 if(!eligible&&reason==='eligible')reason=input.kind==='high_fit'?'freshness_or_policy_unproven':'no_unresolved_tasks';
 // Fixed templates only: no producer prose, names, contacts, candidate material or URLs.
 return {...base,eligible,reason,identity,payload:{content,allowed_mentions:{parse:[]},flags:4}};
}
