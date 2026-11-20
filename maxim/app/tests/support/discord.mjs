import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import pg from 'pg';
import {appDir,freePort,waitDatabase,migrate} from '../../scripts/environment.mjs';
import {createFixture,removeFixture,startTestDatabase,stopTestDatabase,cleanupTasks} from '../../../lib/test-resources.mjs';

export async function discordHarness({ui=false}={}) {
 const root=createFixture('maxim-test-discord-');
 const suffix=crypto.randomUUID(),container='maxim-test-'+suffix,databaseName='maxim_test_'+suffix.replaceAll('-','');
 const port=await freePort(),dbPort=await freePort(),password=crypto.randomBytes(24).toString('hex');
 const c={databaseUrl:`postgresql://maxim:${password}@127.0.0.1:${dbPort}/${databaseName}`,origin:`http://127.0.0.1:${port}`,privateRoot:root,
  bootstrapKey:crypto.randomBytes(32).toString('hex'),workspaceId:crypto.randomUUID(),testMode:true,testContainer:container,
  model:{model:'',apiKey:'',baseUrl:'http://127.0.0.1:1/v1'}};
 const runtime=path.join(root,'runtime.json');fs.writeFileSync(runtime,JSON.stringify(c),{mode:0o600});
 let created=false,pool,server,remote,db,prior=process.env.MAXIM_RUNTIME_FILE;
 const children=new Set(),requests=[];let route;
 let closed=false;
 const release=async()=>{
  if(closed)return;closed=true;
  await cleanupTasks([
   ...[...children].map(child=>async()=>{child.kill();await Promise.race([new Promise(resolve=>child.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,3000))]);}),
   async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}},
   async()=>{if(remote){remote.closeAllConnections();await new Promise(r=>remote.close(r));}},
   async()=>{if(pool)await pool.end();},async()=>{if(db)await db.closeDatabase();},
   ()=>{if(prior===undefined)delete process.env.MAXIM_RUNTIME_FILE;else process.env.MAXIM_RUNTIME_FILE=prior;},
   ()=>stopTestDatabase(container),()=>removeFixture(root,{allowCurrent:true}),
  ]);
 };
 try {
  startTestDatabase(c,'postgres:18.1-alpine');created=true;
  await waitDatabase(c.databaseUrl);await migrate(c);
  pool=new pg.Pool({connectionString:c.databaseUrl});
  process.env.MAXIM_RUNTIME_FILE=runtime;
  db=await import('../../src/server/db.ts');
  const auth=await import('../../src/server/auth.ts'),service=await import('../../src/server/integrations/discord/service.ts');
  const sessionId=crypto.randomUUID(),sessionToken=crypto.randomBytes(32).toString('hex'),csrf=crypto.randomUUID();
  await pool.query(`INSERT INTO sessions(id,token_hash,workspace_id,csrf_token,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')`,[sessionId,auth.digest(sessionToken),c.workspaceId,csrf]);
  const ctx={workspaceId:c.workspaceId,sessionId,csrfToken:csrf,isOwner:true};
  const second=crypto.randomUUID(),otherSession=crypto.randomUUID();
  await pool.query('INSERT INTO workspaces(id,name) VALUES($1,$2)',[second,'Discord other fixture']);
  await pool.query('INSERT INTO candidates(id,workspace_id,display_name) VALUES($1,$2,$3)',[crypto.randomUUID(),second,'Other fixture']);
  await pool.query(`INSERT INTO sessions(id,token_hash,workspace_id,csrf_token,expires_at) VALUES($1,$2,$3,$4,now()+interval '1 hour')`,[otherSession,auth.digest('other-fixture-session'),second,'other-fixture-csrf']);
  const other={workspaceId:second,sessionId:otherSession,csrfToken:'other-fixture-csrf',isOwner:false};
  remote=http.createServer(async(req,res)=>{
   let raw='';for await(const part of req)raw+=part;
   requests.push({url:req.url,headers:req.headers,body:JSON.parse(raw)});
   if(route)return route(req,res);
   res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({id:'123456789012345679',channel_id:'123456789012345678'}));
  });
  await new Promise(resolve=>remote.listen(0,'127.0.0.1',resolve));
  const webhook=`http://127.0.0.1:${remote.address().port}/api/webhooks/123456789012345678/discord_fixture_token_123456`;
  let bundle,css;
  if(ui){
   const {build}=await import('esbuild');
   bundle=await build({absWorkingDir:appDir,stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {DiscordView} from './src/components/maxim/discord';import {WorkspaceApi} from './src/components/maxim/api';import {Theme} from '@astryxdesign/core/theme';import {neutralTheme} from '@astryxdesign/theme-neutral/built';createRoot(document.getElementById('root')).render(React.createElement(Theme,{theme:neutralTheme,mode:'light'},React.createElement(DiscordView,{api:new WorkspaceApi('${csrf}',()=>{})})));`,resolveDir:appDir,loader:'tsx'},jsx:'automatic',bundle:true,write:false,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':JSON.stringify('production')},loader:{'.css':'empty'}});
   css=(await build({absWorkingDir:appDir,entryPoints:['src/app/globals.css'],bundle:true,write:false,loader:{'.woff2':'dataurl','.woff':'dataurl'}})).outputFiles[0].text;
  }
  server=http.createServer(async(req,res)=>{
   try{
    if(req.url==='/fixture.js'&&bundle){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(bundle.outputFiles[0].text);return;}
    if(req.url==='/fixture.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(css||'');return;}
    if(req.url==='/'&&bundle){res.writeHead(200,{'Content-Type':'text/html','Cache-Control':'no-store'});res.end(`<html data-theme="light" data-astryx-theme="neutral"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><main style="max-width:1100px;margin:auto;padding:16px"><div id="root"></div></main><script src="/fixture.js"></script></body></html>`);return;}
    let text='';for await(const part of req){text+=part;if(Buffer.byteLength(text)>8192)throw Error('oversize');}
    const headers=new Headers(Object.entries(req.headers).filter(([,v])=>typeof v==='string'));
    const request=new Request(c.origin+req.url,{method:req.method,headers});
    const context=await auth.authenticate(request,req.method==='POST');
    const input=text?JSON.parse(text):{};
    let output;
    if(req.method==='GET'&&req.url==='/api/discord')output=await service.discordView(context);
    else if(req.method==='POST'&&req.url==='/api/discord/plan')output={result:await service.discordPlan(context,input)};
    else if(req.method==='POST'&&req.url==='/api/discord/commands')output={result:await service.discordCommand(context,input)};
    else {res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(output));
   }catch(e){res.writeHead(e.status||400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:{code:e.code||'validation_failed',message:e.status?e.message:'Check notification fields.'}}));}
  });
  await new Promise(resolve=>server.listen(port,'127.0.0.1',resolve));
  const command=(action,payload,commandId=crypto.randomUUID(),context=ctx)=>service.discordCommand(context,{commandId,action,payload});
  const view=()=>service.discordView(ctx);
  const configure=async()=>command('configure_destination',{expectedRevision:(await view()).settings.revision,webhook,channelId:'123456789012345678',confirmedExisting:true});
  const consent=async(contents=['weekly_review'],enabled=true)=>{const s=(await view()).settings;return command('set_consent',{expectedRevision:s.revision,destinationRevision:s.destinationRevision,contents,enabled,confirmDestination:true});};
  const worker=()=>{
   const code=`import {claimWork} from './src/server/work.ts';import {database} from './src/server/db.ts';import {deliverDiscord} from './src/worker/discord.ts';const item=await claimWork('discord-fixture-process');if(item)await deliverDiscord(item);await database().end();`;
   const child=spawn(process.execPath,['--import','tsx','--input-type=module','--eval',code],{cwd:appDir,env:{...process.env,MAXIM_RUNTIME_FILE:runtime},stdio:['ignore','pipe','pipe'],windowsHide:true});children.add(child);
   let stderr='';child.stderr.on('data',b=>{stderr+=b;});
   const done=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>{children.delete(child);if(code===0)resolve();else reject(Error('Fixture worker stopped: '+stderr.slice(0,300)));});});
   done.catch(()=>{});return {child,done};
  };
  return {c,root,runtime,pool,ctx,other,requests,webhook,command,view,configure,consent,worker,service,
   sql:(sql,args)=>pool.query(sql,args),setRoute:r=>{route=r;},
   async request(endpoint,body,headers={}){return fetch(c.origin+endpoint,{method:body===undefined?'GET':'POST',headers:{Cookie:'maxim_session='+sessionToken,Origin:c.origin,'x-csrf-token':csrf,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});},
   cookie:{name:'maxim_session',value:sessionToken,url:c.origin,httpOnly:true,sameSite:'Strict'},
   close:release};
 }catch(e){
  try{await release();}catch(cleanup){throw new AggregateError([e,cleanup],'Discord fixture setup and cleanup failed');}
  throw e;
 }
}
