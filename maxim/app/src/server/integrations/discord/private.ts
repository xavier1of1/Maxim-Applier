import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {config} from '../../config';
import {digest} from '../../auth';
import {DomainError,invariant} from '../../errors';

export function validateWebhook(raw:string) {
 try {
  const c=config(),u=new URL(raw);
  const fixture=c.testMode && u.protocol==='http:' && u.hostname==='127.0.0.1';
  invariant(fixture || (!c.testMode && u.protocol==='https:' && u.hostname==='discord.com' && !u.port),'invalid_destination','Use the existing private Discord webhook.');
  invariant(!u.username&&!u.password&&!u.search&&!u.hash&&/^\/api\/(?:v10\/)?webhooks\/\d{17,20}\/[A-Za-z0-9._-]{20,200}$/.test(u.pathname),'invalid_destination','Use a webhook URL without extra parameters.');
  return u.href;
 } catch {throw new DomainError('invalid_destination','The private destination is invalid.');}
}
export function storeDestination(webhook:string,channelId:string) {
 const value=validateWebhook(webhook),id=crypto.randomUUID(),root=path.join(config().privateRoot,'discord');
 fs.mkdirSync(root,{recursive:true,mode:0o700});
 fs.writeFileSync(path.join(root,id+'.json'),JSON.stringify({webhook:value,channelId}),{flag:'wx',mode:0o600});
 return {ref:id,hash:digest(value)};
}
export function readDestination(ref:string,expectedHash:string):{webhook:string;channelId:string} {
 try {
  invariant(/^[a-f0-9-]{36}$/.test(ref),'destination_unavailable','Private destination is unavailable.',503);
  const raw=fs.readFileSync(/* turbopackIgnore: true */ path.join(config().privateRoot,'discord',ref+'.json'),'utf8');
  invariant(Buffer.byteLength(raw)<=4096,'destination_unavailable','Private destination is unavailable.',503);
  const p=JSON.parse(raw),webhook=validateWebhook(p.webhook);
  invariant(digest(webhook)===expectedHash&&/^\d{17,20}$/.test(p.channelId),'destination_unavailable','Private destination is unavailable.',503);
  return {webhook,channelId:p.channelId};
 } catch {throw new DomainError('destination_unavailable','Private destination is unavailable. Reconfirm it in Discord settings.',503);}
}
export function destinationAvailable(ref:string|null,hash:string|null) {
 if(!ref||!hash)return false;
 try {readDestination(ref,hash);return true;}catch{return false;}
}
