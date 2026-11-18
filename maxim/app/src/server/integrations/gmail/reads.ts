import {transaction} from '../../db';
import {reauthorize,type Context} from '../../auth';
import {owner,withdrawUnavailable} from './service';
import {removePrivate} from './private';

export async function gmailView(ctx:Context,offset=0){
 owner(ctx);
 if(!Number.isInteger(offset)||offset<0||offset>100000)throw Error('Invalid Gmail offset');
 return transaction(async tx=>{
  await reauthorize(tx,ctx);const w=ctx.workspaceId;
  await tx.query('SELECT id FROM gmail_accounts WHERE workspace_id=$1 FOR SHARE',[w]);
  await tx.query("UPDATE gmail_observations SET body=null,headers='{}',message_header_id=null,in_reply_to=null,withdrawn=true WHERE workspace_id=$1 AND expires_at<=now() AND NOT withdrawn",[w]);
  await withdrawUnavailable(tx,w);
  const account=(await tx.query('SELECT id,revision,expected_email,email,status,enabled,thread_ids,lookback_days,retention_days,retain_body,model_disclosure,consent_at,last_success_at,error_code,next_retry_at FROM gmail_accounts WHERE workspace_id=$1',[w])).rows[0]||null;
  const visible=account?.enabled&&account.status==='connected';
  const observations=visible?(await tx.query('SELECT id,message_id,thread_id,content_revision,source_url,received_at,observed_at,expires_at,direction,headers,body,withdrawn FROM gmail_observations WHERE workspace_id=$1 AND thread_id=ANY($2) ORDER BY observed_at DESC,id LIMIT 51 OFFSET $3',[w,account.thread_ids,offset])).rows:[];
  const links=(await tx.query('SELECT id,observation_id,application_id,application_revision,job_revision,revision,confidence,reviewer_session,withdrawn_at FROM gmail_links WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 201',[w])).rows;
  const tasks=(await tx.query('SELECT id,link_id,observation_id,application_id,revision,status,resolution,reply_observation_id,created_at,resolved_at FROM gmail_response_tasks WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 201',[w])).rows;
  const applications=(await tx.query('SELECT a.id,a.revision,a.outcome,j.revision AS job_revision,j.company,j.title FROM applications a JOIN jobs j ON j.workspace_id=a.workspace_id AND j.id=a.job_id WHERE a.workspace_id=$1 AND a.status<>\'archived\' AND NOT j.archived ORDER BY a.updated_at DESC LIMIT 201',[w])).rows;
  const work=(await tx.query("SELECT id,kind,status,error_code,updated_at,attempts,(status='leased' AND lease_until<=now()) AS lease_expired FROM work_items WHERE workspace_id=$1 AND kind IN ('gmail_sync','gmail_revoke') ORDER BY created_at DESC LIMIT 10",[w])).rows;
  const revocations=(await tx.query("SELECT id,status,error_code FROM gmail_revocations WHERE workspace_id=$1 AND status='pending'",[w])).rows;
  return {account:account?{...account,stale:Boolean(account.error_code)||!account.last_success_at||Date.now()-new Date(account.last_success_at).getTime()>15*60000}:null,observations:observations.slice(0,50).map(o=>{
   const text=JSON.stringify(o.headers)+' '+(o.body||'');
   const matches=applications.filter(a=>text.includes(a.id));
   return {...o,suggestion:matches.length===1?{kind:'identifier',applicationId:matches[0].id,applicationRevision:matches[0].revision,jobRevision:matches[0].job_revision}:{kind:'unassigned'}};
  }),links:links.slice(0,200),tasks:tasks.slice(0,200),applications:applications.slice(0,200),work,revocations,offset,more:observations.length>50,partial:{links:links.length>200,tasks:tasks.length>200,applications:applications.length>200},asOf:new Date().toISOString()};
 });
}
// Deliberately exclude account addresses, headers and source content by default.
export async function gmailAgentView(ctx:Context){
 const v=await gmailView(ctx);
 const allowed=v.account?.enabled&&v.account.model_disclosure;
 return {account:v.account?{id:v.account.id,status:v.account.status,lastSuccessAt:v.account.last_success_at,stale:v.account.stale,errorCode:v.account.error_code}:null,
  observations:v.observations.slice(0,10).map(o=>({id:o.id,direction:o.direction,withdrawn:o.withdrawn,...(allowed&&!o.withdrawn?{body:o.body?.slice(0,2000)}:{})})),
  links:v.links.map(l=>({id:l.id,observationId:l.observation_id,applicationId:l.application_id,withdrawnAt:l.withdrawn_at})),
  tasks:v.tasks.map(t=>({id:t.id,applicationId:t.application_id,status:t.status})),asOf:v.asOf};
}
export async function expireGmail(){
 await transaction(async tx=>{
  const accounts=(await tx.query('SELECT workspace_id FROM gmail_accounts ORDER BY workspace_id FOR UPDATE')).rows;
  const expired=(await tx.query('DELETE FROM gmail_oauth_states WHERE expires_at<=now() RETURNING workspace_id,account_revision,secret_key')).rows;
  for(const s of expired){
   removePrivate(s.secret_key);
   await tx.query("UPDATE gmail_accounts SET status='error',error_code='authorization_expired' WHERE workspace_id=$1 AND revision=$2 AND status='authorizing'",[s.workspace_id,s.account_revision]);
  }
  await tx.query("UPDATE gmail_observations SET body=null,headers='{}',message_header_id=null,in_reply_to=null,withdrawn=true WHERE expires_at<=now() AND NOT withdrawn");
  for(const a of accounts)await withdrawUnavailable(tx,a.workspace_id);
 });
}
