import crypto from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {transaction} from '../server/db';
import {checkLease,finishWork,enqueue,type WorkItem} from '../server/work';
import {event} from '../server/commands';
import {digest} from '../server/auth';
import {DomainError,invariant} from '../server/errors';
import {accountFor,withdrawUnavailable} from '../server/integrations/gmail/service';
import {GoogleGmail,authorizedToken,messageSchema,type GmailMessage,type MailProvider,type Token} from '../server/integrations/gmail/provider';
import {readPrivate,writePrivate,removePrivate} from '../server/integrations/gmail/private';

type Checkpoint={phase:'backfill'|'history';index:number;historyId:string;since:string;pageToken?:string;pages:number;pending?:{id:string;threadId:string}[];deleted?:string[];nextHistoryId?:string;nextPageToken?:string;cycle:string};
async function active(tx:PoolClient,item:WorkItem,revoke=false){
 await checkLease(tx,item);const a=await accountFor(tx,item.workspace_id);
 invariant(a&&a.id===item.input.accountId&&a.revision===item.input.revision&&(revoke?a.status==='revoking':a.enabled&&a.status==='connected'),'gmail_consent_changed','Gmail consent changed before publication.',409);return a;
}
function headers(m:GmailMessage){
 const wanted=['from','to','subject','message-id','in-reply-to'];
 const result:Record<string,string>={};
 for(const h of m.payload.headers){const k=h.name.toLowerCase();if(wanted.includes(k)){invariant(result[k]===undefined,'gmail_headers_ambiguous','Duplicate identity headers need manual review.',409);result[k]=h.value;}}
 return result;
}
function address(value:string|undefined){
 const m=value?.trim().match(/^(?:[^<>]*<)?([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+)>?$/i);return m?.[1].toLowerCase();
}
function plainBody(m:GmailMessage){
 const fragments:string[]=[];let nodes=0;
 function part(raw:unknown,depth:number){
  invariant(++nodes<=100&&depth<=8,'gmail_body_bound','Message nesting exceeded the local bound.',409);
  const p=z.object({mimeType:z.string().optional(),filename:z.string().optional(),body:z.object({data:z.string().max(1000000).optional()}).optional(),parts:z.array(z.unknown()).max(100).optional()}).parse(raw);
  if(!p.filename&&p.mimeType==='text/plain'&&p.body?.data)fragments.push(Buffer.from(p.body.data,'base64url').toString('utf8'));
  for(const child of p.parts||[])part(child,depth+1);
 }
 part(m.payload,0);return fragments.join('\n').slice(0,16000);
}
async function publish(tx:PoolClient,item:WorkItem,a:Record<string,any>,raw:GmailMessage,cp:Checkpoint){
 const m=messageSchema.parse(raw);
 invariant(a.thread_ids.includes(m.threadId),'gmail_selection_mismatch','Provider returned an unselected thread.',409);
 const received=new Date(Number(m.internalDate));
 invariant(Number.isFinite(received.getTime())&&received.getTime()<=Date.now()+300000,'gmail_message_date','Invalid provider message date.',409);
 if(received<new Date(cp.since))return;
 const h=headers(m),from=address(h.from),direction=m.labelIds.includes('SENT')&&from===a.email?'outgoing':from&&from!==a.email?'incoming':'unknown';
 const body=a.retain_body?plainBody(m):null;
 const hash=digest(JSON.stringify({headers:h,body,date:m.internalDate,direction})),id=crypto.randomUUID();
 const r=await tx.query('INSERT INTO gmail_observations(id,workspace_id,account_id,message_id,thread_id,content_revision,source_url,received_at,expires_at,direction,headers,body,message_header_id,in_reply_to) VALUES($1,$2,$3,$4,$5,$6,$7,$8,now()+$9*interval \'1 day\',$10,$11,$12,$13,$14) ON CONFLICT(workspace_id,account_id,message_id,content_revision) DO NOTHING RETURNING id',[id,item.workspace_id,a.id,m.id,m.threadId,hash,'https://mail.google.com/mail/u/?authuser='+encodeURIComponent(a.email)+'#all/'+m.threadId,received,a.retention_days,direction,JSON.stringify(h),body,h['message-id']||null,h['in-reply-to']||null]);
 if(r.rowCount)await event(tx,{workspaceId:item.workspace_id},id,'gmail_evidence_observed',{accountId:a.id,direction});
}
async function cleanupGrant(item:WorkItem,signal:AbortSignal,provider:MailProvider){
 const record=async(tx:PoolClient)=>{
  await checkLease(tx,item);
  const r=(await tx.query("SELECT * FROM gmail_revocations WHERE workspace_id=$1 AND id=$2 AND account_id=$3 AND status='pending' FOR UPDATE",[item.workspace_id,item.input.revocationId,item.input.accountId])).rows[0];
  invariant(r,'gmail_cleanup_changed','Grant cleanup no longer authorizes this work.',409);return r;
 };
 const row=await transaction(record);
 try{
  await provider.revoke(readPrivate<Token>(row.token_key),signal);
  await transaction(async tx=>{
   await record(tx);
   await tx.query("UPDATE gmail_revocations SET status='revoked',error_code=null,completed_at=now() WHERE workspace_id=$1 AND id=$2",[item.workspace_id,row.id]);
   await finishWork(tx,item,{revoked:true});await event(tx,{workspaceId:item.workspace_id},row.account_id,'gmail_authorization_grant_revoked',{});
  });removePrivate(row.token_key);
 }catch(e){
  const code=e instanceof DomainError?e.code:'gmail_revoke_failed';
  await transaction(async tx=>{
   await record(tx);await tx.query('UPDATE gmail_revocations SET error_code=$1 WHERE workspace_id=$2 AND id=$3',[code,item.workspace_id,row.id]);
   await finishWork(tx,item,{failed:true,errorCode:code});
  }).catch(()=>{});
  if(code==='lease_lost'||code==='gmail_cleanup_changed')throw e;
 }
}
export async function gmailWork(item:WorkItem,outer:AbortSignal,provider:MailProvider=new GoogleGmail()){
 const signal=AbortSignal.any([outer,AbortSignal.timeout(35000)]),revoke=item.kind==='gmail_revoke';
 invariant(revoke||item.kind==='gmail_sync','gmail_work_kind','Unsupported Gmail work kind.');
 if(revoke&&item.input.revocationId)return cleanupGrant(item,signal,provider);
 let loaded=false;
 try{
  const a=await transaction(tx=>active(tx,item,revoke));loaded=true;
  if(revoke){
   const token=readPrivate<Token>(a.token_key);await provider.revoke(token,signal);
   await transaction(async tx=>{
    const current=await active(tx,item,true);
    await tx.query("UPDATE gmail_accounts SET status='revoked',token_key=null,enabled=false,error_code=null WHERE workspace_id=$1",[item.workspace_id]);
    await finishWork(tx,item,{revoked:true});await event(tx,{workspaceId:item.workspace_id},current.id,'gmail_revoked',{});
   });removePrivate(a.token_key);return;
  }
  const old=JSON.stringify(a.checkpoint),token=await authorizedToken(provider,a.token_key,signal,async fresh=>{
   await transaction(async tx=>{await active(tx,item);writePrivate(a.token_key,fresh);});
  });
  let cp=a.checkpoint as Checkpoint;
  if(!cp.phase){
   const profile=await provider.profile(token,signal);
   invariant(profile.emailAddress.toLowerCase()===a.email,'gmail_account_mismatch','Provider account changed.',403);
   cp={phase:'backfill',index:0,historyId:profile.historyId,since:new Date(Date.now()-a.lookback_days*86400000).toISOString(),pages:0,cycle:crypto.randomUUID()};
  }
  let messages:GmailMessage[]=[],deleted:string[]=[],complete=false;
  if(cp.phase==='backfill'){
   messages=await provider.thread(token,a.thread_ids[cp.index],a.retain_body,signal);
   invariant(messages.length<=25,'gmail_thread_bound','Selected thread exceeds the 25-message bound. Select a narrower thread.',409);
   cp={...cp,index:cp.index+1};if(cp.index>=a.thread_ids.length)cp.phase='history';
  }else{
   if(!cp.pending){
    invariant(cp.pages<20,'gmail_history_bound','History scan reached 20 pages. Explicitly reset the bounded checkpoint.',409);
    const page=await provider.history(token,cp.historyId,cp.pageToken,signal);
    invariant(BigInt(page.historyId)>=BigInt(cp.historyId),'gmail_cursor_regressed','Provider history watermark regressed; reset only after review.',409);
    invariant(page.messages.length+page.deleted.length<=100,'gmail_page_bound','History page exceeds the local bound.',409);
    cp={...cp,pending:[...new Map(page.messages.filter(m=>a.thread_ids.includes(m.threadId)).map(m=>[m.id,m])).values()],deleted:page.deleted,nextHistoryId:page.historyId,nextPageToken:page.nextPageToken,pages:cp.pages+1};
   }
   deleted=cp.deleted||[];cp.deleted=[];
   const batch=cp.pending!.slice(0,2);
   for(const ref of batch){
    // Recheck before every network read as well as before publication.
    await transaction(tx=>active(tx,item));
    const m=await provider.message(token,ref.id,a.retain_body,signal);
    invariant(m.id===ref.id&&m.threadId===ref.threadId,'gmail_source_mismatch','Provider message identity changed.',409);messages.push(m);
   }
   cp.pending=cp.pending!.slice(batch.length);
   if(!cp.pending.length){
    cp.pending=undefined;cp.pageToken=cp.nextPageToken;
    if(!cp.pageToken){cp.historyId=cp.nextHistoryId!;cp.pages=0;complete=true;}
    cp.nextHistoryId=undefined;cp.nextPageToken=undefined;
   }
  }
  signal.throwIfAborted();
  await transaction(async tx=>{
   const current=await active(tx,item);
   invariant(JSON.stringify(current.checkpoint)===old,'gmail_checkpoint_changed','A newer check superseded this result.',409);
   for(const m of messages)await publish(tx,item,current,m,cp);
   if(deleted.length)await tx.query("UPDATE gmail_observations SET withdrawn=true,body=null,headers='{}',message_header_id=null,in_reply_to=null WHERE workspace_id=$1 AND account_id=$2 AND message_id=ANY($3)",[item.workspace_id,current.id,deleted]);
   await tx.query("UPDATE gmail_observations SET withdrawn=true,body=null,headers='{}',message_header_id=null,in_reply_to=null WHERE workspace_id=$1 AND expires_at<=now()",[item.workspace_id]);
   await withdrawUnavailable(tx,item.workspace_id);
   await tx.query('UPDATE gmail_accounts SET checkpoint=$1,error_code=null,next_retry_at=null,last_success_at=CASE WHEN $2 THEN now() ELSE last_success_at END WHERE workspace_id=$3',[JSON.stringify(cp),complete,item.workspace_id]);
   await finishWork(tx,item,{observations:messages.length,complete});
   if(!complete)await enqueue(tx,item.workspace_id,'gmail_sync',item.id+':next',{accountId:current.id,revision:current.revision});
  });
 }catch(e){
  const code=e instanceof DomainError?e.code:e instanceof z.ZodError?'gmail_schema_drift':'gmail_operation_failed';
  // Only a still-current lease/consent can publish an integration failure.
  await transaction(async tx=>{
   const current=await active(tx,item,revoke);
   if(!revoke&&['access_revoked','access_denied','invalid_grant','gmail_account_mismatch'].includes(code))await tx.query("UPDATE gmail_accounts SET enabled=false,status='error',model_disclosure=false WHERE workspace_id=$1",[item.workspace_id]);
   await tx.query("UPDATE gmail_accounts SET error_code=$1,next_retry_at=now()+interval '1 minute' WHERE workspace_id=$2",[code,item.workspace_id]);
   await finishWork(tx,item,{failed:true,errorCode:code});
   await event(tx,{workspaceId:item.workspace_id},current.id,'gmail_check_failed',{code});
  }).catch(()=>{});
  if(code==='gmail_consent_changed'||code==='lease_lost')throw e;
  // Acknowledged failure is visible; the user controls retry/backfill and quotas.
  if(!loaded)throw e;
 }
}
