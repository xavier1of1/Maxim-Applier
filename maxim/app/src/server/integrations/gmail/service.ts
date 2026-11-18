import crypto from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {config} from '../../config';
import {database,transaction} from '../../db';
import {reauthorize,digest,type Context} from '../../auth';
import {command,event,uuid} from '../../commands';
import {enqueue} from '../../work';
import {invariant} from '../../errors';
import {GoogleGmail,pkce,sourceId,type MailProvider,type Token} from './provider';
import {readPrivate,writePrivate,removePrivate} from './private';

const rev=z.number().int().positive(),reason=z.string().trim().min(3).max(500);
const schema=z.discriminatedUnion('action',[
 z.object({commandId:uuid,action:z.literal('consent'),payload:z.object({expectedRevision:z.number().int().nonnegative(),email:z.email().max(254),threadIds:z.array(sourceId).min(1).max(5),lookbackDays:z.number().int().min(1).max(30),retentionDays:z.number().int().min(1).max(30),retainBody:z.boolean(),modelDisclosure:z.boolean(),broadReadAccepted:z.literal(true),selectionApproved:z.literal(true)}).strict()}).strict(),
 z.object({commandId:uuid,action:z.enum(['sync','disconnect','reset_checkpoint','purge_content']),payload:z.object({expectedRevision:rev}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('confirm_link'),payload:z.object({observationId:uuid,applicationId:uuid,expectedApplicationRevision:rev,expectedJobRevision:rev,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('withdraw_link'),payload:z.object({linkId:uuid,expectedRevision:rev,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('create_task'),payload:z.object({linkId:uuid,expectedRevision:rev,expectedApplicationRevision:rev,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('correct_task'),payload:z.object({taskId:uuid,expectedRevision:rev,linkId:uuid,expectedLinkRevision:rev,expectedApplicationRevision:rev,reason}).strict()}).strict(),
 z.object({commandId:uuid,action:z.literal('resolve_task'),payload:z.object({taskId:uuid,expectedRevision:rev,reason,replyObservationId:uuid.optional()}).strict()}).strict(),
]);
export function owner(ctx:Context){invariant(ctx.isOwner,'not_found','Record not found.',404);}
export async function accountFor(tx:PoolClient,workspaceId:string){return (await tx.query('SELECT * FROM gmail_accounts WHERE workspace_id=$1 FOR UPDATE',[workspaceId])).rows[0];}
async function observationFor(tx:PoolClient,w:string,id:string){
 const o=(await tx.query('SELECT * FROM gmail_observations WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,id])).rows[0];
 invariant(o,'not_found','Record not found.',404);return o;
}
function available(a:Record<string,any>,o:Record<string,any>){invariant(a?.enabled&&a.status==='connected'&&a.thread_ids.includes(o.thread_id)&&!o.withdrawn&&new Date(o.expires_at).getTime()>Date.now(),'gmail_evidence_unavailable','This evidence is expired, withdrawn or no longer consented.',409);}
async function linkedFor(tx:PoolClient,w:string,id:string){const l=(await tx.query('SELECT * FROM gmail_links WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,id])).rows[0];invariant(l,'not_found','Record not found.',404);return l;}
async function applicationFor(tx:PoolClient,w:string,id:string){
 const a=(await tx.query('SELECT a.*,j.revision AS job_revision,j.archived AS job_archived FROM applications a JOIN jobs j ON j.workspace_id=a.workspace_id AND j.id=a.job_id WHERE a.workspace_id=$1 AND a.id=$2 FOR UPDATE OF a,j',[w,id])).rows[0];
 invariant(a,'not_found','Record not found.',404);return a;
}
async function queue(tx:PoolClient,w:string,a:Record<string,any>,key:string,kind='gmail_sync'){
 return enqueue(tx,w,kind,key,{accountId:a.id,revision:a.revision});
}
export async function gmailCommand(ctx:Context,raw:unknown){
 owner(ctx);const c=schema.parse(raw);
 return command(ctx,c.commandId,c,async tx=>{
  const w=ctx.workspaceId;
  await tx.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[w+':gmail']);
  let a=await accountFor(tx,w);
  if(c.action==='consent'){
   const p=c.payload;
   invariant((a?.revision||0)===p.expectedRevision,'revision_conflict','Gmail settings changed. Refresh.',409);
   invariant(!p.modelDisclosure||p.retainBody,'gmail_consent_invalid','Body disclosure requires body retention consent.');
   invariant(!a||a.expected_email===p.email.toLowerCase(),'gmail_account_fixed','Disconnect and remove this installation before selecting a different mailbox.',409);
   invariant(!a||!['authorizing','revoking'].includes(a.status),'gmail_busy','Finish authorization/revocation before changing consent.',409);
   if(!a){
    a=(await tx.query('INSERT INTO gmail_accounts(id,workspace_id,expected_email,thread_ids,lookback_days,retention_days,retain_body,model_disclosure) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[crypto.randomUUID(),w,p.email.toLowerCase(),[...new Set(p.threadIds)],p.lookbackDays,p.retentionDays,p.retainBody,p.modelDisclosure])).rows[0];
   }else{
    a=(await tx.query("UPDATE gmail_accounts SET revision=revision+1,thread_ids=$1,lookback_days=$2,retention_days=$3,retain_body=$4,model_disclosure=$5,consent_at=now(),checkpoint='{}',last_success_at=null,error_code=null,next_retry_at=null,enabled=(token_key IS NOT NULL AND status='connected') WHERE workspace_id=$6 RETURNING *",[[...new Set(p.threadIds)],p.lookbackDays,p.retentionDays,p.retainBody,p.modelDisclosure,w])).rows[0];
   }
   // A narrower retention/selection takes effect immediately, not at the next worker run.
   await tx.query("UPDATE gmail_observations SET body=CASE WHEN $1 THEN body ELSE null END,expires_at=LEAST(expires_at,observed_at+$2*interval '1 day') WHERE workspace_id=$3",[p.retainBody,p.retentionDays,w]);
   await tx.query("UPDATE gmail_observations SET body=null,headers='{}',withdrawn=true WHERE workspace_id=$1 AND NOT(thread_id=ANY($2))",[w,p.threadIds]);
   await withdrawUnavailable(tx,w);
   await event(tx,ctx,a.id,'gmail_consent_recorded',{revision:a.revision,selectedThreads:a.thread_ids.length,retainBody:p.retainBody,modelDisclosure:p.modelDisclosure,retentionDays:p.retentionDays},a.revision);
   return {id:a.id,revision:a.revision,status:a.status};
  }
  invariant(a,'not_found','Record not found.',404);
  if(['sync','disconnect','reset_checkpoint','purge_content'].includes(c.action)){
   const p=c.payload as {expectedRevision:number};
   invariant(a.revision===p.expectedRevision,'revision_conflict','Gmail settings changed. Refresh.',409);
   if(c.action==='disconnect'){
    a=(await tx.query("UPDATE gmail_accounts SET revision=revision+1,enabled=false,status=CASE WHEN token_key IS NULL THEN 'revoked' ELSE 'revoking' END,model_disclosure=false,checkpoint='{}',error_code=null WHERE workspace_id=$1 RETURNING *",[w])).rows[0];
    const states=(await tx.query('DELETE FROM gmail_oauth_states WHERE workspace_id=$1 RETURNING secret_key',[w])).rows;
    for(const s of states)removePrivate(s.secret_key);
    if(a.token_key)await queue(tx,w,a,c.commandId,'gmail_revoke');
    const pending=(await tx.query("SELECT id FROM gmail_revocations WHERE workspace_id=$1 AND status='pending'",[w])).rows;
    for(const r of pending)await enqueue(tx,w,'gmail_revoke',c.commandId+':'+r.id,{accountId:a.id,revocationId:r.id});
   }else if(c.action==='purge_content'){
    a=(await tx.query('UPDATE gmail_accounts SET revision=revision+1 WHERE workspace_id=$1 RETURNING *',[w])).rows[0];
    await tx.query("UPDATE gmail_observations SET body=null,headers='{}',message_header_id=null,in_reply_to=null,withdrawn=true WHERE workspace_id=$1",[w]);
    await withdrawUnavailable(tx,w);
   }else{
    invariant(a.enabled&&a.status==='connected','gmail_not_connected','Connect this account before checking mail.',409);
    invariant(!a.next_retry_at||new Date(a.next_retry_at).getTime()<=Date.now(),'gmail_cooldown','Wait for the displayed Gmail retry time.',409);
    if(c.action==='reset_checkpoint')a=(await tx.query("UPDATE gmail_accounts SET checkpoint='{}',last_success_at=null,error_code=null,revision=revision+1 WHERE workspace_id=$1 RETURNING *",[w])).rows[0];
    const active=await tx.query("SELECT id FROM work_items WHERE workspace_id=$1 AND kind='gmail_sync' AND input->>'revision'=$2 AND status IN ('queued','leased')",[w,String(a.revision)]);
    invariant(!active.rowCount,'gmail_busy','A Gmail check is already queued or running.',409);
    const work=await queue(tx,w,a,c.commandId);return {id:a.id,revision:a.revision,workId:work.id};
   }
   await event(tx,ctx,a.id,'gmail_'+c.action,{revision:a.revision},a.revision);return {id:a.id,revision:a.revision,status:a.status};
  }
  if(c.action==='confirm_link'){
   const p=c.payload,o=await observationFor(tx,w,p.observationId);available(a,o);
   const app=await applicationFor(tx,w,p.applicationId);
   invariant(app.revision===p.expectedApplicationRevision&&app.job_revision===p.expectedJobRevision&&!app.job_archived&&app.status!=='archived','revision_conflict','Review the current active application and posting before linking.',409);
   const prior=await tx.query('SELECT id FROM gmail_links WHERE workspace_id=$1 AND observation_id=$2 AND withdrawn_at IS NULL',[w,o.id]);
   invariant(!prior.rowCount,'gmail_link_exists','Withdraw the current link before correcting it.',409);
   const id=crypto.randomUUID();
   await tx.query("INSERT INTO gmail_links(id,workspace_id,observation_id,application_id,application_revision,job_revision,confidence,reviewer_session,reason) VALUES($1,$2,$3,$4,$5,$6,'human',$7,$8)",[id,w,o.id,app.id,app.revision,app.job_revision,ctx.sessionId,p.reason]);
   await event(tx,ctx,id,'gmail_link_confirmed',{observationId:o.id,applicationId:app.id,applicationRevision:app.revision,reviewer:ctx.sessionId,confidence:'human'});
   return {id,revision:1,applicationId:app.id};
  }
  if(c.action==='withdraw_link'){
   const p=c.payload,l=await linkedFor(tx,w,p.linkId);
   invariant(l.revision===p.expectedRevision&&!l.withdrawn_at,'revision_conflict','This link changed. Refresh.',409);
   await tx.query('UPDATE gmail_links SET withdrawn_at=now(),revision=revision+1 WHERE workspace_id=$1 AND id=$2',[w,l.id]);
   await tx.query("UPDATE gmail_response_tasks SET status='withdrawn',revision=revision+1,resolution='link_withdrawn',resolved_at=now() WHERE workspace_id=$1 AND link_id=$2 AND status='open'",[w,l.id]);
   await event(tx,ctx,l.id,'gmail_link_withdrawn',{applicationId:l.application_id,observationId:l.observation_id,reviewer:ctx.sessionId,outcomeReviewRequired:true});
   return {id:l.id,revision:l.revision+1,applicationId:l.application_id,outcomeReviewRequired:true};
  }
  if(c.action==='create_task'){
   const p=c.payload,l=await linkedFor(tx,w,p.linkId),o=await observationFor(tx,w,l.observation_id);available(a,o);
   const app=await applicationFor(tx,w,l.application_id);
   invariant(!l.withdrawn_at&&l.revision===p.expectedRevision&&app.revision===p.expectedApplicationRevision&&app.job_revision===l.job_revision&&app.status!=='archived'&&!app.job_archived,'revision_conflict','Link/application changed. Review it again.',409);
   invariant(o.direction==='incoming','gmail_task_source','Only an attributable incoming message can require a response.',409);
   const existing=(await tx.query('SELECT * FROM gmail_response_tasks WHERE workspace_id=$1 AND observation_id=$2',[w,o.id])).rows[0];
   // Tombstones are permanent across source revisions and link corrections.
   const replay=(await tx.query('SELECT t.id,t.status FROM gmail_response_tasks t JOIN gmail_observations x ON x.workspace_id=t.workspace_id AND x.id=t.observation_id WHERE t.workspace_id=$1 AND x.account_id=$2 AND x.message_id=$3 ORDER BY t.created_at LIMIT 1',[w,o.account_id,o.message_id])).rows[0];
   if(existing||replay)return existing||replay;
   const id=crypto.randomUUID();await tx.query('INSERT INTO gmail_response_tasks(id,workspace_id,link_id,observation_id,application_id) VALUES($1,$2,$3,$4,$5)',[id,w,l.id,o.id,l.application_id]);
   await event(tx,ctx,id,'gmail_response_required',{applicationId:l.application_id,observationId:o.id,reviewer:ctx.sessionId});return {id,revision:1,status:'open'};
  }
  if(c.action==='correct_task'){
   const p=c.payload,t=(await tx.query('SELECT * FROM gmail_response_tasks WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.taskId])).rows[0];
   invariant(t,'not_found','Record not found.',404);
   const l=await linkedFor(tx,w,p.linkId),o=await observationFor(tx,w,l.observation_id),prior=await observationFor(tx,w,t.observation_id);available(a,o);
   const app=await applicationFor(tx,w,l.application_id);
   invariant(t.revision===p.expectedRevision&&!l.withdrawn_at&&l.revision===p.expectedLinkRevision&&app.revision===p.expectedApplicationRevision&&app.job_revision===l.job_revision&&o.account_id===prior.account_id&&o.message_id===prior.message_id,'revision_conflict','Review the current task, corrected link and application.',409);
   const status=t.status==='withdrawn'&&t.resolution==='link_withdrawn'?'open':t.status;
   await tx.query("UPDATE gmail_response_tasks SET link_id=$1,observation_id=$2,application_id=$3,revision=revision+1,status=$4,resolution=CASE WHEN $4='open' THEN null ELSE resolution END,resolved_at=CASE WHEN $4='open' THEN null ELSE resolved_at END,resolved_by=CASE WHEN $4='open' THEN null ELSE resolved_by END,reply_observation_id=CASE WHEN $4='open' THEN null ELSE reply_observation_id END WHERE workspace_id=$5 AND id=$6",[l.id,o.id,l.application_id,status,w,t.id]);
   await event(tx,ctx,t.id,'gmail_response_corrected',{fromApplicationId:t.application_id,applicationId:l.application_id,fromLinkId:t.link_id,linkId:l.id,reviewer:ctx.sessionId,status});
   return {id:t.id,revision:t.revision+1,status};
  }
  invariant(c.action==='resolve_task','gmail_action','Unknown Gmail action.');
  const p=c.payload,t=(await tx.query('SELECT * FROM gmail_response_tasks WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[w,p.taskId])).rows[0];
  invariant(t,'not_found','Record not found.',404);invariant(t.revision===p.expectedRevision&&t.status==='open','revision_conflict','This response task changed. Refresh.',409);
  if(p.replyObservationId){
   const reply=await observationFor(tx,w,p.replyObservationId),source=await observationFor(tx,w,t.observation_id);available(a,reply);
   invariant(reply.account_id===source.account_id&&reply.thread_id===source.thread_id&&reply.direction==='outgoing'&&source.message_header_id&&reply.in_reply_to===source.message_header_id&&new Date(reply.received_at)>new Date(source.received_at),'gmail_reply_unattributable','Reply must be a later SENT message from this account directly replying to the source.',409);
  }
  await tx.query("UPDATE gmail_response_tasks SET status='resolved',revision=revision+1,resolution=$1,resolved_by=$2,reply_observation_id=$3,resolved_at=now() WHERE workspace_id=$4 AND id=$5",[p.replyObservationId?'attributable_reply':'manual',ctx.sessionId,p.replyObservationId||null,w,t.id]);
  await event(tx,ctx,t.id,'gmail_response_resolved',{applicationId:t.application_id,replyObservationId:p.replyObservationId||null,reviewer:ctx.sessionId});return {id:t.id,revision:t.revision+1,status:'resolved'};
 });
}
export async function withdrawUnavailable(tx:PoolClient,w:string){
 const links=await tx.query("UPDATE gmail_links l SET withdrawn_at=now(),revision=revision+1 WHERE l.workspace_id=$1 AND l.withdrawn_at IS NULL AND EXISTS(SELECT 1 FROM gmail_observations o WHERE o.workspace_id=l.workspace_id AND o.id=l.observation_id AND (o.withdrawn OR o.expires_at<=now())) RETURNING l.id,l.application_id,l.observation_id",[w]);
 for(const l of links.rows)await event(tx,{workspaceId:w},l.id,'gmail_source_withdrawn',{applicationId:l.application_id,observationId:l.observation_id,outcomeReviewRequired:true});
 await tx.query("UPDATE gmail_response_tasks t SET status='withdrawn',revision=revision+1,resolution='source_withdrawn',resolved_at=now() WHERE t.workspace_id=$1 AND t.status='open' AND EXISTS(SELECT 1 FROM gmail_links l WHERE l.workspace_id=t.workspace_id AND l.id=t.link_id AND l.withdrawn_at IS NOT NULL)",[w]);
}
export async function beginGmailOAuth(ctx:Context,raw:unknown,provider:MailProvider=new GoogleGmail()){
 owner(ctx);const p=z.object({expectedRevision:rev}).strict().parse(raw),key=crypto.randomUUID(),state=crypto.randomBytes(32).toString('base64url'),proof=pkce(),redirect=config().origin+'/api/gmail/callback';
 const result=await transaction(async tx=>{
  await reauthorize(tx,ctx);const a=await accountFor(tx,ctx.workspaceId);
  invariant(a&&a.revision===p.expectedRevision&&['disconnected','revoked','error'].includes(a.status)&&!a.token_key,'gmail_oauth_unavailable','Disconnect any previous grant, then refresh consent before connecting.',409);
  invariant(!(await tx.query("SELECT id FROM gmail_revocations WHERE workspace_id=$1 AND status='pending'",[ctx.workspaceId])).rowCount,'gmail_revoke_pending','Finish pending Google revocation before reconnecting.',409);
  const url=provider.authorization(state,proof.challenge,redirect,a.expected_email);
  writePrivate(key,{verifier:proof.verifier,redirect});
  await tx.query("UPDATE gmail_accounts SET status='authorizing',error_code=null WHERE workspace_id=$1",[ctx.workspaceId]);
  await tx.query("INSERT INTO gmail_oauth_states(state_hash,workspace_id,account_id,account_revision,session_id,secret_key,expires_at) VALUES($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')",[digest(state),ctx.workspaceId,a.id,a.revision,ctx.sessionId,key]);
  return {url};
 }).catch(e=>{removePrivate(key);throw e;});return result;
}
// State + one-use PKCE authorize this callback; Strict cookies need not cross Google's redirect.
export async function completeGmailOAuth(raw:unknown,provider:MailProvider=new GoogleGmail()){
 const p=z.object({state:z.string().min(32).max(128),code:z.string().min(1).max(4096).optional(),error:z.string().max(200).optional()}).strict().parse(raw);
 const state=await transaction(async tx=>{
  const s=(await tx.query('DELETE FROM gmail_oauth_states WHERE state_hash=$1 RETURNING *',[digest(p.state)])).rows[0];
  invariant(s&&new Date(s.expires_at).getTime()>Date.now(),'gmail_oauth_state','Authorization state expired or was already used.',409);
  return s;
 });
 const signal=AbortSignal.timeout(25000);let token:Token|undefined;
 try{
  invariant(p.code&&!p.error,'gmail_oauth_denied','Google authorization was not completed.',409);
  await transaction(async tx=>{
   const a=await accountFor(tx,state.workspace_id),s=await tx.query('SELECT id FROM sessions WHERE workspace_id=$1 AND id=$2 AND expires_at>now()',[state.workspace_id,state.session_id]);
   invariant(a&&a.revision===state.account_revision&&a.status==='authorizing'&&s.rowCount,'gmail_consent_changed','Consent/session changed before token exchange.',409);
  });
  const secret=readPrivate<{verifier:string;redirect:string}>(state.secret_key);
  token=await provider.exchange(p.code,secret.verifier,secret.redirect,signal);
  writePrivate(state.secret_key,token);
  const profile=await provider.profile(token,signal);
  await transaction(async tx=>{
   const a=await accountFor(tx,state.workspace_id),s=await tx.query('SELECT id FROM sessions WHERE workspace_id=$1 AND id=$2 AND expires_at>now()',[state.workspace_id,state.session_id]);
   invariant(a&&a.id===state.account_id&&a.revision===state.account_revision&&a.status==='authorizing'&&s.rowCount,'gmail_consent_changed','Consent/session changed during authorization.',409);
   invariant(profile.emailAddress.toLowerCase()===a.expected_email,'gmail_account_mismatch','Google returned a different account than the consented address.',403);
   await tx.query("UPDATE gmail_accounts SET email=$1,token_key=$2,status='connected',enabled=true,checkpoint='{}',error_code=null WHERE workspace_id=$3",[profile.emailAddress.toLowerCase(),state.secret_key,state.workspace_id]);
   await event(tx,{workspaceId:state.workspace_id},a.id,'gmail_connected',{revision:a.revision});
  });
 }catch(e){
  let cleanupPending=false;
  if(token){
   try{await provider.revoke(token,AbortSignal.timeout(8000));}
   catch{
    cleanupPending=true;writePrivate(state.secret_key,token);
    await transaction(async tx=>{
     const id=crypto.randomUUID();
     await tx.query('INSERT INTO gmail_revocations(id,workspace_id,account_id,token_key) VALUES($1,$2,$3,$4)',[id,state.workspace_id,state.account_id,state.secret_key]);
     await enqueue(tx,state.workspace_id,'gmail_revoke','oauth-cleanup:'+id,{accountId:state.account_id,revocationId:id});
     await event(tx,{workspaceId:state.workspace_id},state.account_id,'gmail_authorization_revoke_pending',{});
    });
   }
  }
  if(!cleanupPending)removePrivate(state.secret_key);
  await database().query("UPDATE gmail_accounts SET status='error',enabled=false,error_code='authorization_failed' WHERE workspace_id=$1 AND revision=$2 AND status='authorizing'",[state.workspace_id,state.account_revision]);throw e;
 }
 return {connected:true};
}
