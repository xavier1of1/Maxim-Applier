import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import type {PoolClient} from 'pg';
import {config} from './config';
import {applicationLock} from './application-authority';
import {checkLease,finishWork,type WorkItem} from './work';
import {transaction} from './db';
import {markerLock,marker,readMarker,atomic,nativeRoot,safeTarget} from './projections';
import {artifactBytes} from './private-artifacts';
import {engineSnapshot} from './evaluation-native';
import {invariant} from './errors';

export const applicationJournal=(id:string)=>path.join(config().privateRoot,'cutovers',id);
const hash=(b:Buffer|string)=>crypto.createHash('sha256').update(b).digest('hex');
const cell=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('|','&#124;').replace(/[\r\n\t]+/g,' ');
export function nativeStatus(app:Record<string,any>){
 if(app.status==='archived')return 'Discarded';
 return ({submitted:'Applied',responded:'Responded',interviewing:'Interview',offer:'Offer',rejected:'Rejected',withdrawn:'Discarded'} as Record<string,string>)[app.outcome]||'Evaluated';
}
export async function applicationProjection(tx:PoolClient,w:string,revision:number){
 const engine=await engineSnapshot(),candidate=(await tx.query('SELECT revision FROM candidates WHERE workspace_id=$1',[w])).rows[0];
 const rows=(await tx.query('SELECT a.*,j.company,j.title,j.location,j.url,j.note,j.posted_at,j.revision AS job_revision FROM applications a JOIN jobs j ON j.id=a.job_id AND j.workspace_id=a.workspace_id WHERE a.workspace_id=$1 ORDER BY a.projection_number',[w])).rows;
 invariant(rows.length<=10000,'projection_limit','Application projection exceeds 10,000 records; nothing was published.');
 const files:Record<string,Buffer>={},asOf=new Date().toISOString(),applications=[],highConvictionJobs=[],todayActions=[];
 let tracker='<!-- Canonical Maxim Apply read projection. Revision '+revision+'. As of '+asOf+'. Offline reads may be stale; edits require workspace commands. -->\n# Applications\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n',total=0;
 for(const app of rows){
  const e=(await tx.query('SELECT * FROM evaluations WHERE workspace_id=$1 AND job_id=$2 ORDER BY created_at DESC LIMIT 1',[w,app.job_id])).rows[0];
  const current=Boolean(e?.status==='completed'&&e.candidate_revision===candidate.revision&&e.job_revision===app.job_revision&&e.input_snapshot.engine?.hash===engine.hash);
  const packet=(await tx.query("SELECT p.* FROM application_packets p WHERE p.workspace_id=$1 AND p.application_id=$2 AND p.status='approved' AND NOT EXISTS(SELECT 1 FROM answer_dependencies d WHERE d.workspace_id=p.workspace_id AND d.entity_id=p.id AND d.status='invalidated') AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p.answers) a JOIN answer_memory m ON m.id=(a->>'answerId')::uuid AND m.workspace_id=p.workspace_id WHERE m.status<>'approved' OR m.revision<>(a->>'answerRevision')::integer OR m.expires_at<=now()) ORDER BY p.approved_at DESC LIMIT 1",[w,app.id])).rows[0];
  let ready=Boolean(packet&&current&&packet.evaluation_id===e.id&&packet.candidate_revision===candidate.revision&&packet.job_revision===app.job_revision&&e.policy.eligibility==='eligible');
  const retained=app.submitted_snapshot?.packet,number=String(app.projection_number).padStart(3,'0');
  const legacyArtifacts=app.submitted_snapshot?.legacyArtifacts||[];
  const reportId=retained?.reportArtifactId||(e?.report_artifact_id||null)||legacyArtifacts.find((a:{path:string})=>a.path.endsWith('.md'))?.id;
  const pdfId=retained?.pdfArtifactId||(ready?packet.pdf_artifact_id:null)||legacyArtifacts.find((a:{path:string})=>a.path.endsWith('.pdf'))?.id;
  let reportPath='',pdfPath='';
  if(reportId){
   const a=await artifactBytes(tx,w,reportId,app.job_id).catch(()=>null);
   if(a){reportPath='reports/'+number+'-maxim-'+app.id+'.md';files[reportPath]=a.bytes;total+=a.bytes.length;}
  }
  if(pdfId){
   const a=await artifactBytes(tx,w,pdfId,app.job_id).catch(()=>null);
   if(a){pdfPath='output/'+number+'-maxim-'+app.id+'.pdf';files[pdfPath]=a.bytes;total+=a.bytes.length;}
  }
  if(ready&&(!reportPath||!pdfPath))ready=false;
  invariant(total<=64*1024*1024,'projection_limit','Artifact projection exceeds 64 MiB; no partial publication is accepted.');
  const score=current?Number(e.score):app.submitted_snapshot?.score??null,tier=current?e.tier:app.submitted_snapshot?.tier||'Unknown',status=nativeStatus(app);
  const notes=['MaximId='+app.id,'JobId='+app.job_id,app.workflow,'Outcome='+app.outcome,'Location='+app.location,!current?'Current fit unknown/stale':'Tier='+tier,retained?'Artifacts recorded at manual submission':ready?'Exact packet approved':legacyArtifacts.length?'Legacy artifacts unapproved; not readiness':'No approved packet',app.note].filter(Boolean).join('; ');
  const date=app.outcome!=='not_submitted'&&!app.applied_at?'Unknown':(app.applied_at||app.created_at).toISOString().slice(0,10);
  tracker+='| '+[app.projection_number,date,app.company,app.title,score===null?'?':score+'/5',status,pdfPath?'\u2705':'\u274c',reportPath?'['+number+']('+reportPath+')':'-',notes].map(cell).join(' | ')+' |\n';
  const flags=(current?e.policy.flags||[]:[]).map((f:{flagType:string;severity:string})=>f.flagType+':'+f.severity);
  const jobDto={ID:app.job_id,Company:app.company,Role:app.title,Score:score,Tier:tier,NextAction:!current?'evaluate_current_opening':e.tier==='T0'?'no_apply_reject':e.policy.eligibility!=='eligible'?'resolve_policy_review':ready?'manual_application_review':'prepare_approved_packet',Flags:flags};
  if(current&&['T2','T3'].includes(e.tier)&&e.policy.eligibility==='eligible')highConvictionJobs.push(jobDto);
  applications.push({id:app.id,jobID:app.job_id,company:app.company,role:app.title,status:app.outcome==='not_submitted'?app.workflow:app.outcome,score,tier,scoreKnown:score!==null,packetReady:ready,pdfPath,reportPath,jobURL:app.url||'',duplicateRisk:'review_in_workspace',nextAction:jobDto.NextAction});
  const postedAge=app.posted_at?(Date.now()-new Date(app.posted_at).getTime())/3600000:null;
  if(current&&['T2','T3'].includes(e.tier)&&e.policy.eligibility==='eligible'&&postedAge!==null&&postedAge>=0&&postedAge<=48&&app.outcome==='not_submitted')todayActions.push({ActionType:'urgent_job',Title:app.title,Detail:app.company,Status:ready?'packet_ready':'review_needed',Job:jobDto});
 }
 files['data/applications.md']=Buffer.from(tracker);files['applications.md']=Buffer.from(tracker);
 const pending=(await tx.query("SELECT j.id,j.url FROM jobs j LEFT JOIN applications a ON a.job_id=j.id AND a.workspace_id=j.workspace_id WHERE j.workspace_id=$1 AND NOT j.archived AND j.url IS NOT NULL AND (a.id IS NULL OR a.outcome='not_submitted') AND NOT EXISTS(SELECT 1 FROM evaluations e WHERE e.workspace_id=j.workspace_id AND e.job_id=j.id AND e.status='completed' AND e.job_revision=j.revision AND e.candidate_revision=$2) ORDER BY j.created_at LIMIT 10001",[w,candidate.revision])).rows;
 invariant(pending.length<=10000,'projection_limit','Pipeline projection exceeds 10,000 records.');
 files['data/pipeline.md']=Buffer.from('# Pending Evaluation\n\n<!-- Canonical read projection. As of '+asOf+'. Do not edit. -->\n\n'+pending.map(j=>'- '+j.url).join('\n')+'\n');
 const ranked=highConvictionJobs.sort((a,b)=>b.Score-a.Score),attentionCount=Math.ceil(ranked.length*.2);
 const conviction=ranked.map((j,i)=>({...j,Flags:[...j.Flags,...(i<attentionCount?['top20_attention']:[])]})).filter((j,i)=>j.Tier==='T3'||i<attentionCount||j.Flags.includes('connection_overlay:positive'));
 const snapshot={generatedAt:asOf,revision,ownership:'canonical',todayActions,highConvictionJobs:conviction,networkingQueue:[],recruiterInbox:[],applications,analytics:{TrackerRowCount:rows.length,NovaDCCompatibleCount:highConvictionJobs.length,SmallSampleWarning:'Historical/networking analytics await S9 adaptation; no trend is inferred.',PrimaryKPIDescription:'Interview rate for NoVA/DC-compatible roles',RecommendationScaffold:'Current application ownership is canonical.'}};
 files['data/maxim/dashboard-state.json']=Buffer.from(JSON.stringify(snapshot,null,2));
 files['data/maxim/canonical-application-state.json']=Buffer.from(JSON.stringify({asOf,revision,ownership:'canonical',applications,jobCount:pending.length},null,2));
 const events=(await tx.query('SELECT id,sequence,entity_id,event_type,revision,payload,created_at FROM events WHERE workspace_id=$1 ORDER BY sequence LIMIT 50001',[w])).rows;
 invariant(events.length<=50000,'projection_limit','Event projection exceeds 50,000 records.');
 files['data/maxim/canonical-events.jsonl']=Buffer.from(events.map(e=>JSON.stringify(e)).join('\n')+'\n');
 return {files,asOf,revision,applicationRecords:applications,counts:{applications:rows.length,pipeline:pending.length,events:events.length},hashes:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,hash(b)]))};
}
export async function publishApplicationProjection(tx:PoolClient,w:string,transitionId:string,revision:number){
 await markerLock(tx);await tx.query('SELECT pg_advisory_xact_lock_shared(120032)');
 const plan=await applicationProjection(tx,w,revision),prior=await readMarker();
 invariant(!prior.workspaceId||prior.workspaceId===w,'workspace_mismatch','Native projection belongs to another workspace.',409);
 await marker({...prior,applications:'frozen',applicationTransitionId:transitionId,reason:'application_projection_refresh'});
 for(const [file,bytes]of Object.entries(plan.files))await atomic(path.join(/* turbopackIgnore: true */ nativeRoot(),file),bytes);
 for(const [file,expected]of Object.entries(prior.applicationFiles||{})){
  if(plan.files[file]||!/^(reports|output)\/\d+-maxim-[a-f0-9-]{36}\.(md|pdf)$/.test(file))continue;
  const target=await safeTarget(path.join(/* turbopackIgnore: true */ nativeRoot(),file));
  try{
   const bytes=await fs.readFile(target);
   invariant(hash(bytes)===expected,'projection_edited','An obsolete generated artifact was edited outside the workspace. Preserve and reconcile it before recovery.',409);
   await fs.unlink(target);
  }catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 }
 await marker({...await readMarker(),applications:'canonical',applicationTransitionId:transitionId,applicationRevision:revision,applicationFiles:plan.hashes,applicationAsOf:plan.asOf,workspaceId:w});
 return {revision,asOf:plan.asOf,counts:plan.counts,files:plan.hashes};
}
export async function applicationProjectionWork(item:WorkItem){
 return transaction(async tx=>{
  const authority=await applicationLock(tx,item.workspace_id);await checkLease(tx,item);
  if(authority.owner!=='canonical'||authority.transition_id!==item.input.transitionId){await finishWork(tx,item,{skipped:'owner_changed'});return;}
  const result=await publishApplicationProjection(tx,item.workspace_id,authority.transition_id,authority.revision);
  await finishWork(tx,item,result);
 });
}
