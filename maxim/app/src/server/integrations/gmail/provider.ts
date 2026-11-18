import crypto from 'node:crypto';
import {z} from 'zod';
import {DomainError,invariant} from '../../errors';
import {readPrivate} from './private';

export const READ_SCOPE='https://www.googleapis.com/auth/gmail.readonly';
export const sourceId=z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const historyId=z.string().regex(/^\d{1,30}$/);
const header=z.object({name:z.string().max(200),value:z.string().max(16000)});
export const messageSchema=z.object({id:sourceId,threadId:sourceId,historyId:historyId.optional(),internalDate:z.string().regex(/^\d{1,16}$/),labelIds:z.array(z.string()).max(100).default([]),payload:z.object({headers:z.array(header).max(200),mimeType:z.string().optional(),body:z.object({data:z.string().max(1000000).optional()}).optional(),parts:z.array(z.unknown()).max(100).optional()})});
export type GmailMessage=z.infer<typeof messageSchema>;
export type Token={accessToken:string;refreshToken:string;expiresAt:number};
export interface MailProvider {
 authorization(state:string,challenge:string,redirect:string,email:string):string;
 exchange(code:string,verifier:string,redirect:string,signal:AbortSignal):Promise<Token>;
 refresh(token:Token,signal:AbortSignal):Promise<Token>;
 profile(token:Token,signal:AbortSignal):Promise<{emailAddress:string;historyId:string}>;
 thread(token:Token,id:string,body:boolean,signal:AbortSignal):Promise<GmailMessage[]>;
 history(token:Token,start:string,page:string|undefined,signal:AbortSignal):Promise<{historyId:string;nextPageToken?:string;messages:{id:string;threadId:string}[];deleted:string[]}>;
 message(token:Token,id:string,body:boolean,signal:AbortSignal):Promise<GmailMessage>;
 revoke(token:Token,signal:AbortSignal):Promise<void>;
}
export class GmailError extends DomainError {
 constructor(code:string,public retryable=false){super(code,'Gmail check failed ('+code+'). Review the account or retry after its cooldown.',503);}
}
// Fixed endpoints only: no generic request, send, modify or calendar capability.
export class GoogleGmail implements MailProvider {
 private client(){return z.object({clientId:z.string().min(1).max(512),clientSecret:z.string().max(512).optional()}).strict().parse(readPrivate('client'));}
 authorization(state:string,challenge:string,redirect:string,email:string){
  const u=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search=new URLSearchParams({client_id:this.client().clientId,redirect_uri:redirect,response_type:'code',scope:READ_SCOPE,state,code_challenge:challenge,code_challenge_method:'S256',access_type:'offline',prompt:'consent',login_hint:email}).toString();return u.href;
 }
 private async request(url:string,init:RequestInit,signal:AbortSignal,limit=2*1024*1024):Promise<unknown>{
  try{
   const r=await fetch(url,{...init,redirect:'error',signal:AbortSignal.any([signal,AbortSignal.timeout(8000)])});
   if(!r.ok){await r.body?.cancel();throw new GmailError(r.status===429?'quota_exceeded':r.status===401?'access_revoked':r.status===403?'access_denied':r.status===404?'cursor_or_source_missing':r.status===400?(url.endsWith('/token')?'invalid_grant':'invalid_cursor'):'provider_unavailable',r.status===429||r.status>=500);}
   const reader=r.body?.getReader();if(!reader)return {};
   const chunks:Uint8Array[]=[];let size=0;
   let completed=false;
   try{for(let i=0;i<10000;i++){const part=await reader.read();if(part.done){completed=true;break;}size+=part.value.length;if(size>limit)throw new GmailError('response_bound');chunks.push(part.value);}if(!completed)throw new GmailError('response_bound');}
   finally{await reader.cancel().catch(()=>{});}
   return size?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
  }catch(e){if(e instanceof DomainError)throw e;throw new GmailError(signal.aborted?'operation_cancelled':'timeout_or_network',!signal.aborted);}
 }
 private async token(form:Record<string,string>,signal:AbortSignal,old?:Token){
  const c=this.client();
  const raw=await this.request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({...form,client_id:c.clientId,...(c.clientSecret?{client_secret:c.clientSecret}:{})})},signal,65536);
  const t=z.object({access_token:z.string().min(1).max(8192),refresh_token:z.string().max(8192).optional(),expires_in:z.number().positive().max(86400),scope:z.string(),token_type:z.literal('Bearer')}).parse(raw);
  invariant(t.scope.split(' ').length===1&&t.scope===READ_SCOPE,'gmail_scope_denied','Only the exact Gmail read-only scope is permitted.',403);
  invariant(t.refresh_token||old?.refreshToken,'gmail_refresh_missing','Offline access was not granted. Reconnect with consent.',409);
  return {accessToken:t.access_token,refreshToken:t.refresh_token||old!.refreshToken,expiresAt:Date.now()+t.expires_in*1000};
 }
 exchange(code:string,verifier:string,redirect:string,signal:AbortSignal){return this.token({grant_type:'authorization_code',code,code_verifier:verifier,redirect_uri:redirect},signal);}
 refresh(t:Token,signal:AbortSignal){return this.token({grant_type:'refresh_token',refresh_token:t.refreshToken},signal,t);}
 private get(t:Token,route:string,signal:AbortSignal){return this.request('https://gmail.googleapis.com/gmail/v1/users/me/'+route,{headers:{Authorization:'Bearer '+t.accessToken}},signal);}
 async profile(t:Token,s:AbortSignal){return z.object({emailAddress:z.email(),historyId}).parse(await this.get(t,'profile',s));}
 private format(body:boolean){return body?'format=full':'format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=In-Reply-To';}
 async thread(t:Token,id:string,body:boolean,s:AbortSignal){const r=z.object({messages:z.array(messageSchema).max(25)}).parse(await this.get(t,'threads/'+sourceId.parse(id)+'?'+this.format(body),s));return r.messages;}
 async message(t:Token,id:string,body:boolean,s:AbortSignal){return messageSchema.parse(await this.get(t,'messages/'+sourceId.parse(id)+'?'+this.format(body),s));}
 async history(t:Token,start:string,page:string|undefined,s:AbortSignal){
  const q=new URLSearchParams({startHistoryId:historyId.parse(start),maxResults:'25',fields:'history(messagesAdded(message(id,threadId)),messagesDeleted(message(id,threadId))),historyId,nextPageToken'});if(page)q.set('pageToken',page);
  const ref=z.object({id:sourceId,threadId:sourceId}),entry=z.object({message:ref});
  const r=z.object({historyId,nextPageToken:z.string().max(2048).optional(),history:z.array(z.object({messagesAdded:z.array(entry).max(100).optional(),messagesDeleted:z.array(entry).max(100).optional()})).max(25).default([])}).parse(await this.get(t,'history?'+q,s));
  const messages=r.history.flatMap(h=>(h.messagesAdded||[]).map(e=>e.message)),deleted=r.history.flatMap(h=>(h.messagesDeleted||[]).map(e=>e.message.id));
  if(messages.length+deleted.length>100)throw new GmailError('page_bound');
  return {historyId:r.historyId,nextPageToken:r.nextPageToken,messages,deleted};
 }
 async revoke(t:Token,s:AbortSignal){await this.request('https://oauth2.googleapis.com/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({token:t.refreshToken||t.accessToken})},s,65536);}
}
export async function authorizedToken(provider:MailProvider,key:string,signal:AbortSignal,persist:(t:Token)=>Promise<void>){
 let t=readPrivate<Token>(key);
 if(t.expiresAt<Date.now()+60000){t=await provider.refresh(t,signal);await persist(t);}return t;
}
export function pkce(){const verifier=crypto.randomBytes(32).toString('base64url');return {verifier,challenge:crypto.createHash('sha256').update(verifier).digest('base64url')};}
