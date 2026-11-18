import {test,expect} from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {build} from 'esbuild';
import {harness} from '../support/harness.mjs';
import {authenticate} from '../../src/server/auth.ts';
import {executeCommand} from '../../src/server/commands.ts';
import {database} from '../../src/server/db.ts';
import {claimWork} from '../../src/server/work.ts';
import {gmailCommand,beginGmailOAuth,completeGmailOAuth} from '../../src/server/integrations/gmail/service.ts';
import {gmailView} from '../../src/server/integrations/gmail/reads.ts';
import {gmailWork} from '../../src/worker/gmail.ts';

let h,server,ctx,oldEnv,app,app2,state;
test.describe.configure({mode:'serial'});
const messages=[];
const provider={
 authorization(s){state=s;return 'https://accounts.google.com/o/oauth2/v2/auth';},
 async exchange(){return {accessToken:'fixture-access-only',refreshToken:'fixture-refresh-only',expiresAt:Date.now()+3600000};},
 async profile(){return {emailAddress:'ui@example.test',historyId:'100'};},
 async thread(_t,id){return messages.filter(m=>m.threadId===id);},
 async history(){return {historyId:'200',messages:[],deleted:[]};},
 async message(_t,id){return messages.find(m=>m.id===id);},
 async refresh(t){return t;},async revoke(){},
};
test.beforeAll(async()=>{
 h=await harness();oldEnv=process.env.MAXIM_RUNTIME_FILE;process.env.MAXIM_RUNTIME_FILE=h.runtime;
 ctx=await authenticate(new Request(h.c.origin,{headers:{cookie:h.a.cookie}}));
 for(const title of ['Engineer','Another Engineer']){
  const j=await executeCommand(ctx,{commandId:crypto.randomUUID(),action:'create_job',payload:{company:'UI Fixture',title,description:'Synthetic Gmail UI role'}});
  const a=await executeCommand(ctx,{commandId:crypto.randomUUID(),action:'create_intent',payload:{jobId:j.id}});if(!app)app=a;else app2=a;
 }
 messages.push(...['t1','t2'].map((id,i)=>({id:'ui-message-'+i,threadId:id,internalDate:String(Date.now()-60000),labelIds:['INBOX'],payload:{headers:[{name:'From',value:'recruiter@example.test'},{name:'To',value:'ui@example.test'},{name:'Subject',value:i?'Company-only fixture':'Reference '+app.id},{name:'Message-ID',value:'<ui-'+i+'@example.test>'}],mimeType:'text/plain',body:{data:Buffer.from('Synthetic fixture body').toString('base64url')}}})));
 const out=path.join(h.root,'gmail-ui');
 await build({entryPoints:['tests/support/gmail-ui.tsx'],outdir:out,bundle:true,platform:'browser',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},logLevel:'silent'});
 await h.stopServer();
 server=http.createServer(async(req,res)=>{
  try{
   if(req.url==='/'){
    res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});
    res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/gmail-ui.css"></head><body><main id="gmail-fixture" data-csrf="'+h.a.csrf+'"></main><script type="module" src="/gmail-ui.js"></script></body></html>');return;
   }
   if(['/gmail-ui.js','/gmail-ui.css'].includes(req.url)){
    res.writeHead(200,{'Content-Type':req.url.endsWith('.css')?'text/css':'text/javascript'});res.end(fs.readFileSync(path.join(out,req.url.slice(1))));return;
   }
   let body='';for await(const b of req){body+=b;if(body.length>65536)throw Error('Fixture request bound');}
   const post=req.method==='POST',request=new Request(h.c.origin+req.url,{method:req.method,headers:req.headers,...(post?{body}:{} )});
   const who=await authenticate(request,post);let value;
   if(req.url.startsWith('/api/gmail?'))value=await gmailView(who,Number(new URL(request.url).searchParams.get('offset')||0));
   else if(post&&req.url==='/api/gmail/commands'){
    value={result:await gmailCommand(who,JSON.parse(body))};
    if(JSON.parse(body).action==='sync')for(let i=0;i<10;i++){const item=await claimWork('gmail-ui-fixture',45);if(!item)break;await gmailWork(item,new AbortController().signal,provider);}
   }else{res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));
  }catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:e.code||'fixture_error',message:e.message}}));}
 });
 await new Promise(resolve=>server.listen(Number(new URL(h.c.origin).port),'127.0.0.1',resolve));
});
test.afterAll(async()=>{
 if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
 await database().end();if(oldEnv===undefined)delete process.env.MAXIM_RUNTIME_FILE;else process.env.MAXIM_RUNTIME_FILE=oldEnv;
 if(h)await h.close();
});
async function open(page){await page.context().addCookies([{name:'maxim_session',value:h.a.cookie.split('=')[1],url:h.c.origin,httpOnly:true,sameSite:'Strict'}]);await page.goto(h.c.origin);}
async function layout(page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}

test('actual Gmail component records consent and corrects evidence/tasks against isolated services',async({page})=>{
 await open(page);await page.getByRole('button',{name:'Review account consent',exact:true}).click();
 await page.getByLabel(/^Email address\b/).fill('ui@example.test');await page.getByLabel(/^Selected Gmail thread IDs\b/).fill('t1,t2');
 await page.getByLabel(/^I authorize read-only/).check();await page.getByRole('button',{name:'Record consent',exact:true}).click();
 await expect(page.getByRole('button',{name:'Connect Google account',exact:true})).toBeVisible();
 await beginGmailOAuth(ctx,{expectedRevision:1},provider);await completeGmailOAuth({state,code:'fixture-code'},provider);
 await page.getByRole('button',{name:'Refresh Gmail evidence',exact:true}).click();
 await page.getByRole('button',{name:'Check selected threads',exact:true}).click();await expect(page.getByText('Identifier suggestion',{exact:true})).toBeVisible();await expect(page.getByText('Unassigned',{exact:true}).first()).toBeVisible();
 await page.getByLabel('Review reason',{exact:true}).fill('Reviewed synthetic source identity');
 const evidence=page.locator('article').filter({hasText:'Reference '+app.id});
 await evidence.getByRole('combobox').selectOption(app2.id);await evidence.getByRole('button',{name:'Confirm application link',exact:true}).click();
 await evidence.getByRole('button',{name:'Needs response',exact:true}).click();await expect(page.getByText('UI Fixture - Another Engineer',{exact:true}).first()).toBeVisible();
 await evidence.getByRole('button',{name:'Withdraw incorrect link',exact:true}).click();await evidence.getByRole('combobox').selectOption(app.id);await evidence.getByRole('button',{name:'Confirm application link',exact:true}).click();
 await evidence.getByRole('button',{name:/^Correct task /}).click();await page.getByRole('button',{name:'Resolve response task',exact:true}).click();
 await expect(page.getByText('No open response tasks.',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('No open response tasks.',{exact:true})).toBeVisible();
 await layout(page);
 await page.screenshot({path:test.info().outputPath('gmail-desktop.png'),fullPage:true});
});
test('mobile consent and history fit; stale reads and revoke remain explicit',async({page})=>{
 await page.setViewportSize({width:390,height:844});await open(page);
 await page.getByRole('button',{name:'Consent settings',exact:true}).click();await layout(page);await page.screenshot({path:test.info().outputPath('gmail-mobile.png'),fullPage:true});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.route('**/api/gmail?*',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'fixture_offline',message:'Fixture read is offline'}})}));
 await page.getByRole('button',{name:'Refresh Gmail evidence',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Last-loaded evidence may be stale.');
 await expect(page.getByRole('button',{name:'Check selected threads',exact:true})).toBeDisabled();
 await page.unroute('**/api/gmail?*');await page.getByRole('button',{name:'Refresh Gmail evidence',exact:true}).click();
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Disconnect and revoke Google access',exact:true}).click();
 const item=await claimWork('gmail-ui-revoke',45);await gmailWork(item,new AbortController().signal,provider);
 await page.getByRole('button',{name:'Refresh Gmail evidence',exact:true}).click();await expect(page.getByText('revoked',{exact:true})).toBeVisible();await expect(page.getByText('Mail content is hidden while disconnected.',{exact:true})).toBeVisible();
 await layout(page);
});
