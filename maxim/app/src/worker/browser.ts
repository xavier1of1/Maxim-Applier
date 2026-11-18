import crypto from 'node:crypto';
import type {Context} from '../server/auth';
import {reauthorize} from '../server/auth';
import {database,transaction} from '../server/db';
import {checkLease,finishWork,type WorkItem} from '../server/work';
import {currentPacket} from '../server/packets';
import {artifactBytes} from '../server/private-artifacts';
import {applicationWritable,queueApplicationProjection} from '../server/application-authority';
import {event} from '../server/commands';
import {candidateLock} from '../server/sources';
import {browserSession,browserEvidence,assertBrowserProgress} from '../server/browser/service';
import {BrowserExecutor} from '../server/browser/executor';
import type {Field,Observation} from '../server/browser/policy';
import {DomainError,invariant} from '../server/errors';
import {questionPolicy} from '../server/answer-policy';

const browsers=new Map<string,BrowserExecutor>();
export async function browserAction(item:WorkItem,signal?:AbortSignal){
 const id=String(item.input.sessionId),actionId=String(item.input.actionId),action=String(item.input.action),payload=item.input.payload as Record<string,any>;
 const ctx:Context={workspaceId:item.workspace_id,sessionId:String(item.input.actorSession),csrfToken:'',isOwner:false};
 let changed=false;
 try{
  const state=await transaction(async tx=>{
   await candidateLock(tx,item.workspace_id);await checkLease(tx,item);await reauthorize(tx,ctx);await applicationWritable(tx,item.workspace_id);
   const s=await browserSession(tx,item.workspace_id,id),a=(await tx.query('SELECT * FROM browser_actions WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[item.workspace_id,actionId])).rows[0];
   invariant(a?.session_id===id,'browser_action_scope','Browser action is not in this session.');
   if(a.status==='completed'){await finishWork(tx,item,{alreadyAcknowledged:true});return {done:true,s};}
   if(a.status!=='queued'){
    await tx.query("UPDATE browser_sessions SET status='paused',last_error='remote_outcome_uncertain',revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2",[item.workspace_id,id]);
    await tx.query("UPDATE browser_actions SET status='uncertain',result=$1,completed_at=now() WHERE workspace_id=$2 AND id=$3",[JSON.stringify({reason:'reobserve_before_retry'}),item.workspace_id,actionId]);
    await finishWork(tx,item,{status:'paused',reason:'remote_outcome_uncertain'});return {done:true,s};
   }
   if(s.worker_owner&&s.worker_owner!==item.lease_owner&&s.lease_until&&new Date(s.lease_until).getTime()>Date.now()){
    const alive=(await tx.query("SELECT 1 FROM worker_heartbeats WHERE worker_id=$1 AND last_seen>now()-interval '30 seconds'",[s.worker_owner])).rowCount;
    invariant(!alive,'browser_other_worker','Another live host worker owns this browser.');
   }
   if(!['close','pause','observe','resume'].includes(action))await currentPacket(tx,item.workspace_id,s.packet_id);
   if(action==='handoff')await assertBrowserProgress(tx,ctx,s);
   invariant(!signal?.aborted,'lease_lost','Browser command lost its execution lease.');
   await tx.query("UPDATE browser_actions SET status='running' WHERE workspace_id=$1 AND id=$2",[item.workspace_id,actionId]);
   await tx.query("UPDATE browser_sessions SET worker_owner=$1,lease_until=now()+interval '5 minutes',updated_at=now() WHERE workspace_id=$2 AND id=$3",[item.lease_owner,item.workspace_id,id]);return {done:false,s};
  });
  if(state.done)return;
  const s=state.s;let executor=browsers.get(id);
  if(!executor){executor=new BrowserExecutor(s.id,s.origin,s.url);browsers.set(id,executor);}
  let observation:Observation|undefined,status='observed',progress={...s.progress},result:Record<string,unknown>={submission:'not_performed'};
  if(action==='close'){await executor.close();browsers.delete(id);status='closed';}
  else if(action==='pause'){status='paused';}
  else if(action==='open'){changed=true;observation=await executor.open();}
  else if(action==='observe'||action==='resume'){observation=await executor.resume();changed=true;}
  else if(action==='handoff'){
   await executor.observe();invariant(!signal?.aborted,'lease_lost','Browser lease lost before handoff.');
   changed=true;await executor.handoff();status='manual_handoff';result={...result,automationDetached:true,manualSubmissionRequired:true};
  }else if(action==='fill_known'){
   executor.observation=s.observation;let current=s.observation as Observation,filled=0;
   const empty=new Set(['','false'].map(value=>requireHash(value===''?'':false)));
   for(const original of (s.observation as Observation).fields.slice(0,100)){
    if(filled>=10||signal?.aborted)break;
    const field=current.fields.find(f=>f.id===original.id),policy=field?questionPolicy(field.label):null;
    if(field?.type==='file'&&empty.has(field.valueHash)&&/\b(resume|cv|curriculum vitae)\b/i.test(field.label+' '+field.name)){
     const pdf=await transaction(async tx=>{await checkLease(tx,item);await reauthorize(tx,ctx);const p=await currentPacket(tx,item.workspace_id,s.packet_id);return (await artifactBytes(tx,item.workspace_id,p.packet.pdf_artifact_id,p.application.job_id)).bytes;});
     changed=true;current=(await executor.attach(field,current.id,pdf)).observation;filled++;progress[field.signature]={label:field.label,fieldId:field.id,status:'attachment_selected',at:new Date().toISOString(),evidence:{packetId:s.packet_id}};continue;
    }
    if(!field||!policy?.factKey||policy.manualReview||!empty.has(field.valueHash)||!['text','email','tel','url','checkbox','radio'].includes(field.type))continue;
    const value=await transaction(async tx=>{
     await candidateLock(tx,item.workspace_id);await checkLease(tx,item);await reauthorize(tx,ctx);await currentPacket(tx,item.workspace_id,s.packet_id);
     const f=(await tx.query("SELECT f.id,f.revision,f.sensitivity FROM candidate_facts f JOIN candidate_sources q ON q.id=f.source_id AND q.workspace_id=f.workspace_id WHERE f.workspace_id=$1 AND f.field_key=$2 AND f.status='current' AND q.deleted_at IS NULL AND q.revision=f.source_revision",[item.workspace_id,policy.factKey])).rows[0];
     if(!f||f.sensitivity==='sensitive'||f.sensitivity==='private'&&!s.private_consent)return null;
     const evidence={kind:'fact',id:f.id,revision:f.revision};return {value:await browserEvidence(tx,ctx,s,field,evidence),evidence};
    });
    if(!value)continue;changed=true;const applied=await executor.fill(field,current.id,value.value);current=applied.observation;filled++;
    progress[field.signature]={label:field.label,fieldId:field.id,status:'filled_locally',at:new Date().toISOString(),evidence:value.evidence};
   }
   observation=current;result={...result,filled,limit:10,transmission:'network_blocked_pending_manual_handoff'};
  }else if(action==='fill'||action==='attach_packet'){
   const field=(s.observation as Observation).fields.find((f:Field)=>f.id===payload.fieldId);invariant(field,'browser_observation_stale','The field observation is unavailable.');
   executor.observation=s.observation;
   const prepared=await transaction(async tx=>{
    await candidateLock(tx,item.workspace_id);await checkLease(tx,item);await reauthorize(tx,ctx);
    const b=await currentPacket(tx,item.workspace_id,s.packet_id);
    invariant(b.packet.candidate_revision===s.candidate_revision,'browser_candidate_stale','Candidate/packet changed.');
    if(action==='fill')return {value:await browserEvidence(tx,ctx,s,field,payload.evidence),pdf:null};
    return {value:null,pdf:(await artifactBytes(tx,item.workspace_id,b.packet.pdf_artifact_id,b.application.job_id)).bytes};
   });
   invariant(!signal?.aborted,'lease_lost','Browser command lost its lease.');
   changed=true;const outcome=action==='fill'?await executor.fill(field,payload.observationId,prepared.value):await executor.attach(field,payload.observationId,prepared.pdf!);
   changed=true;observation=outcome.observation;
   progress[field.signature]={label:field.label,fieldId:field.id,status:action==='fill'?'filled_locally':'attachment_selected',at:new Date().toISOString(),evidence:payload.evidence||{packetId:s.packet_id}};
   result={...result,transmission:outcome.transmission};
  }else throw new DomainError('browser_action_denied','Unsupported browser command.');
  await transaction(async tx=>{
   await candidateLock(tx,item.workspace_id);await checkLease(tx,item);await reauthorize(tx,ctx);await applicationWritable(tx,item.workspace_id);
   await browserSession(tx,item.workspace_id,id);
   if(!['close','pause','observe','resume'].includes(action))await currentPacket(tx,item.workspace_id,s.packet_id);
   await tx.query('UPDATE browser_sessions SET status=$1,observation=coalesce($2,observation),progress=$3,last_error=null,revision=revision+1,updated_at=now() WHERE workspace_id=$4 AND id=$5',[status,observation?JSON.stringify(observation):null,JSON.stringify(progress),item.workspace_id,id]);
   await tx.query("UPDATE browser_actions SET status='completed',result=$1,completed_at=now() WHERE workspace_id=$2 AND id=$3",[JSON.stringify(result),item.workspace_id,actionId]);
   if(action==='open'||action==='handoff'){
    await tx.query("UPDATE applications SET workflow=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 AND outcome='not_submitted'",[action==='handoff'?'review_ready':'assist_running',item.workspace_id,s.application_id]);
    await queueApplicationProjection(tx,item.workspace_id);
   }
   await event(tx,ctx,id,'browser_action_acknowledged',{action,status,applicationId:s.application_id,submission:'not_performed'});
   await finishWork(tx,item,{sessionId:id,status});
  });
 }catch(error){
  const code=error instanceof DomainError?error.code:'browser_unavailable';
  await transaction(async tx=>{
   await checkLease(tx,item);
   await tx.query("UPDATE browser_sessions SET status='paused',last_error=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3",[changed?'remote_outcome_uncertain':code,item.workspace_id,id]);
   await tx.query("UPDATE browser_actions SET status=$1,result=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4",[changed?'uncertain':'failed',JSON.stringify({error:code,submission:'not_performed',reobserveRequired:true}),item.workspace_id,actionId]);
  }).catch(()=>{});
  throw error;
 }
}
export async function closeBrowserSessions(){for(const browser of browsers.values())await browser.close().catch(()=>{});browsers.clear();}
function requireHash(value:unknown){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
