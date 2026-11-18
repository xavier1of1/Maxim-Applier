import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {harness,assertTestConfig} from '../support/harness.mjs';

export async function networkingFixture({ui=false}={}){
 const h=await harness();assertTestConfig(h.c);await h.stopServer();
 const oldRuntime=process.env.MAXIM_RUNTIME_FILE;process.env.MAXIM_RUNTIME_FILE=h.runtime;
 const {networkingRoute}=await import('../../src/server/networking/routes.ts');
 const {authenticate,checkOrigin,login}=await import('../../src/server/auth.ts');
 const {database}=await import('../../src/server/db.ts');
 let server,output=[];
 try{
  if(ui){
   const {build}=await import('esbuild'),app=fileURLToPath(new URL('../../',import.meta.url));
   const bundle=await build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{Theme}from'@astryxdesign/core/theme';import{neutralTheme}from'@astryxdesign/theme-neutral/built';import{NetworkingView}from'./src/components/maxim/networking';import{WorkspaceApi}from'./src/components/maxim/api';import'./src/app/globals.css';fetch('/api/session').then(r=>r.json()).then(s=>createRoot(document.getElementById('root')).render(<Theme theme={neutralTheme} mode="light"><main style={{padding:16,maxWidth:1100,margin:'auto'}}><h1>Networking</h1><NetworkingView api={new WorkspaceApi(s.csrfToken,()=>location.reload())}/></main></Theme>));`,resolveDir:app,loader:'tsx'},bundle:true,write:false,outdir:path.join(h.root,'ui'),format:'esm',platform:'browser',define:{'process.env.NODE_ENV':'"production"'},loader:{'.woff2':'dataurl','.woff':'dataurl'},logLevel:'silent'});
   output=bundle.outputFiles;
  }
  server=http.createServer(async(incoming,outgoing)=>{
   try{
    const chunks=[];let size=0;for await(const chunk of incoming){size+=chunk.length;if(size>2097152+65536)throw Object.assign(Error('Too large'),{status:413});chunks.push(chunk);}
    const req=new Request(h.c.origin+incoming.url,{method:incoming.method,headers:incoming.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})}),url=new URL(req.url);
    let response;
    if(url.pathname==='/networking-test'&&ui)response=new Response('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>',{headers:{'Content-Type':'text/html'}});
    else if(url.pathname==='/fixture.js'||url.pathname==='/fixture.css')response=new Response(output.find(f=>f.path.endsWith(url.pathname.endsWith('.js')?'.js':'.css'))?.text||'',{headers:{'Content-Type':url.pathname.endsWith('.js')?'text/javascript':'text/css'}});
    else if(url.pathname==='/api/auth/login'){
     checkOrigin(req);const auth=await login((await req.json()).accessKey);response=Response.json({csrfToken:auth.csrfToken},{headers:{'Set-Cookie':'maxim_session='+auth.token+'; HttpOnly; SameSite=Strict; Path=/'}});
    }else{
     const ctx=await authenticate(req,req.method==='POST');
     if(url.pathname==='/api/session')response=Response.json({csrfToken:ctx.csrfToken});
     else response=await networkingRoute(req,ctx)||new Response('Not found',{status:404});
    }
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));outgoing.end(Buffer.from(await response.arrayBuffer()));
   }catch(e){outgoing.writeHead(e.status||500,{'Content-Type':'application/json'});outgoing.end(JSON.stringify({error:{code:e.code||'fixture_failed',message:e.message}}));}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(new URL(h.c.origin).port,'127.0.0.1',resolve);});
  return {...h,async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await database().end();if(oldRuntime===undefined)delete process.env.MAXIM_RUNTIME_FILE;else process.env.MAXIM_RUNTIME_FILE=oldRuntime;await h.close();}};
 }catch(e){if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}await database().end().catch(()=>{});await h.close();throw e;}
}
export async function seedNetworking(h){
 const w=h.c.workspaceId,jobId=crypto.randomUUID(),sourceId=crypto.randomUUID(),factId=crypto.randomUUID();
 await h.sql("INSERT INTO jobs(id,workspace_id,company,title,location,description) VALUES($1,$2,'Synthetic Systems','Customer Engineer','Reston, VA','Synthetic opening for isolated S9 testing only.')",[jobId,w]);
 await h.sql("INSERT INTO job_policy_reviews(workspace_id,job_id,job_revision,priority_signals,source_quote) VALUES($1,$2,1,ARRAY['connection'],'Synthetic explicit connection priority')",[w,jobId]);
 await h.sql("UPDATE candidates SET ownership='canonical' WHERE workspace_id=$1",[w]);
 await h.sql("INSERT INTO candidate_sources(id,workspace_id,name,format,content_hash,classification,status,extracted_text) VALUES($1,$2,'Synthetic approved source','manual',$3,'personal','reviewed','Built a synthetic customer integration.')",[sourceId,w,crypto.createHash('sha256').update(sourceId).digest('hex')]);
 await h.sql("INSERT INTO candidate_facts(id,workspace_id,field_key,value,source_id,source_revision,sensitivity) VALUES($1,$2,'projects.summary',$3,$4,1,'standard')",[factId,w,JSON.stringify('Built a synthetic customer integration.'),sourceId]);
 return {jobId,factId,sourceId};
}
