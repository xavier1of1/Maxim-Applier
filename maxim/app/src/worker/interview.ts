import {setTimeout as wait} from 'node:timers/promises';
import {transaction} from '../server/db';
import {reauthorize} from '../server/auth';
import {candidateLock} from '../server/sources';
import {event} from '../server/commands';
import {checkLease,finishWork,type WorkItem} from '../server/work';
import {DomainError,invariant} from '../server/errors';
import {assertFresh,sessionFor} from '../server/interview/service';
import {interviewCompletion} from '../server/interview/model';

async function active(tx:import('pg').PoolClient,item:WorkItem){
 await candidateLock(tx,item.workspace_id);await checkLease(tx,item);
 const s=await sessionFor(tx,item.workspace_id,String(item.input.sessionId));
 await assertFresh(tx,item.workspace_id,s);
 const a=(await tx.query('SELECT * FROM interview_attempts WHERE workspace_id=$1 AND session_id=$2 AND id=$3 FOR UPDATE',[item.workspace_id,s.id,item.input.attemptId])).rows[0];
 invariant(a&&a.model_consent&&a.work_id===item.id&&['queued','running'].includes(a.status),'cancelled','Feedback consent or work authorization was withdrawn or superseded.',409);
 await reauthorize(tx,{workspaceId:item.workspace_id,sessionId:a.auth_session_id,csrfToken:'',isOwner:false});
 return {s,a};
}
export async function practiceInterview(item:WorkItem,parent?:AbortSignal){
 const stop=new AbortController(),monitorStop=new AbortController();
 const deadline=AbortSignal.timeout(45000),signal=AbortSignal.any([stop.signal,deadline,...(parent?[parent]:[])]);
 let monitor:Promise<void>|undefined;
 try{
  const {s,a}=await transaction(async tx=>{const r=await active(tx,item);await tx.query("UPDATE interview_attempts SET status='running' WHERE workspace_id=$1 AND id=$2",[item.workspace_id,r.a.id]);return r;});
  monitor=(async()=>{
   while(!monitorStop.signal.aborted){await wait(250,undefined,{signal:monitorStop.signal});await transaction(tx=>active(tx,item));}
  })().catch(()=>{if(!monitorStop.signal.aborted)stop.abort();});
  const result=await interviewCompletion({snapshot:s.snapshot,text:a.text,hypothetical:a.hypothetical,model:a.model,provider:a.provider,api:item.input.api==='responses'?'responses':'chat_completions'},signal,accounting=>transaction(async tx=>{
   await active(tx,item);signal.throwIfAborted();
   await tx.query('UPDATE interview_attempts SET accounting=$1 WHERE workspace_id=$2 AND id=$3',[JSON.stringify(accounting),item.workspace_id,a.id]);
  }));
  await transaction(async tx=>{
   await active(tx,item);signal.throwIfAborted();
   await tx.query("UPDATE interview_attempts SET status='completed',feedback=$1,accounting=$2,usage=$3,error_code=null,completed_at=now() WHERE workspace_id=$4 AND id=$5",[JSON.stringify(result.feedback),JSON.stringify(result.accounting),JSON.stringify(result.usage),item.workspace_id,a.id]);
   await event(tx,{workspaceId:item.workspace_id},s.id,'interview_feedback_completed',{attemptId:a.id});
   await finishWork(tx,item,{sessionId:s.id,attemptId:a.id,status:'completed'});
  });
 }catch(error){
  const code=deadline.aborted?'interview_timeout':signal.aborted?'cancelled':error instanceof DomainError?error.code:'interview_unavailable';
  await transaction(async tx=>{
   await candidateLock(tx,item.workspace_id);await checkLease(tx,item);
   const row=await tx.query("UPDATE interview_attempts SET status=$1,feedback=null,error_code=$2,completed_at=now() WHERE workspace_id=$3 AND id=$4 AND work_id=$5 AND status IN ('queued','running') RETURNING session_id",[code==='cancelled'?'cancelled':'failed',code,item.workspace_id,item.input.attemptId,item.id]);
   if(row.rowCount)await event(tx,{workspaceId:item.workspace_id},row.rows[0].session_id,'interview_feedback_failed',{attemptId:item.input.attemptId,code});
   await finishWork(tx,item,{attemptId:item.input.attemptId,status:'failed',error:code});
  }).catch(()=>{});
 }finally{monitorStop.abort();stop.abort();await monitor;}
}
