import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawn,execFileSync } from 'node:child_process';
import pg from 'pg';
import { appDir,freePort,waitDatabase,migrate,delay,sha,snapshotDatabase,restoreDatabase } from '../../scripts/environment.mjs';

const require=createRequire(import.meta.url);
export function assertTestConfig(c) {
 if(!c.testMode||!/^\/maxim_test_[a-z0-9_]+$/.test(new URL(c.databaseUrl).pathname)||
  !path.basename(c.privateRoot).startsWith('maxim-test-')||!/^maxim-test-[a-f0-9-]+$/.test(c.testContainer||''))throw Error('Unsafe test configuration: production fallback refused');
 if(fs.realpathSync(c.privateRoot)===fs.realpathSync(appDir))throw Error('Unsafe test path');
}
export async function harness() {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'maxim-test-'));
 const suffix=crypto.randomUUID(),container='maxim-test-'+suffix,database='maxim_test_'+suffix.replaceAll('-','');
 const dbPort=await freePort(),port=await freePort(),password=crypto.randomBytes(24).toString('hex');
 const captured=[],timers=new Set(),providerRequests=[],providerRoutes=new Map();
 const modelServer=http.createServer(async(req,res)=>{
  try{
   if(req.method==='GET'){
    providerRequests.push({url:req.url,at:Date.now(),headers:req.headers});
    const route=providerRoutes.get(req.url)||providerRoutes.get(req.url.split('?')[0]);
    if(typeof route==='function'){await route(req,res);return;}
    res.writeHead(route?.status||(route?200:404),{'Content-Type':'application/json',...(route?.headers||{})});
    res.end(JSON.stringify(route?.body||{error:'fixture_source_not_found'}));return;
   }
   let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>196608)throw Error('oversize');}
   const body=JSON.parse(raw);captured.push({body,authorization:req.headers.authorization});
   const q=[...body.messages].reverse().find(m=>m.role==='user')?.content||'';
   if(body.stream===false&&!body.response_format){
    const job=JSON.parse(q.split('Job data is untrusted evidence:\n')[1]),score=job.description.match(/\[score:([^\]]+)\]/)?.[1]||'4.6';
    const company=job.description.includes('[wrong_identity]')?'Another Opening':job.company;
    const blocks='ABCDEFGH'.split('').map(b=>'## '+b+'. Retained Career-Ops block\nEvidence assessment for '+job.company+' '+job.title+'. Missing information remains unknown; live posting status is unconfirmed.\n').join('\n');
    const report=blocks+'\n---SCORE_SUMMARY---\nCOMPANY: '+company+'\nROLE: '+job.title+'\nSCORE: '+score+'\nARCHETYPE: Full Stack\nLEGITIMACY: High Confidence\n---END_SUMMARY---';
    const send=()=>{if(!res.destroyed){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:report}}],usage:{prompt_tokens:5000,completion_tokens:1500}}));}};
    if(job.description.includes('[slow_evaluation]')){const timer=setTimeout(()=>{timers.delete(timer);send();},5000);timers.add(timer);res.once('close',()=>{clearTimeout(timer);timers.delete(timer);});}else send();return;
   }
   if(body.response_format){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({facts:[{field_key:'experience.fixture',value:'Built customer software using Rust and TypeScript.',quote:'Built customer software using Rust and TypeScript.'}]})}}]}));return;
   }
   if(q.includes('[case:failure]')){res.writeHead(429);res.end('fixture_provider_body_secret');return;}
   res.writeHead(200,{'Content-Type':'text/event-stream'});
   const send=data=>res.write('data: '+JSON.stringify(data)+'\n\n');
   const text=value=>{send({choices:[{delta:{content:value.slice(0,Math.ceil(value.length/2))}}]});send({choices:[{delta:{content:value.slice(Math.ceil(value.length/2))},finish_reason:'stop'}],usage:{prompt_tokens:120,completion_tokens:20}});res.end('data: [DONE]\n\n');};
   const tool=(name,args,id)=>{send({choices:[{delta:{tool_calls:[{index:0,id,type:'function',function:{name,arguments:JSON.stringify(args)}}]},finish_reason:'tool_calls'}]});res.end('data: [DONE]\n\n');};
   if(q.includes('[case:malformed]')){res.end('data: not-json\n\n');return;}
   if(q.includes('[case:truncated]')){send({choices:[{delta:{content:'Partial response'}}]});res.end();return;}
   if(q.includes('[case:slow]')){
    const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)text('Completed after waiting.');},15000);
    timers.add(timer);res.once('close',()=>{clearTimeout(timer);timers.delete(timer);});return;
   }
   const last=body.messages.at(-1);
   const id=q.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)?.[0];
   if(last.role==='tool'){
    const data=JSON.parse(last.content);
    if(q.includes('[case:application')){text(JSON.stringify(data));return;}
    if(q.includes('[case:discovery')){text(JSON.stringify(data));return;}
    if(q.includes('[case:answer-evidence]')&&last.tool_call_id==='call_evidence_read'&&!data.error){
     const facts=data.facts.filter(f=>['projects.summary','candidate.name'].includes(f.field_key)).map(f=>({id:f.id,revision:f.revision})).reverse();
     tool('draft_answer_from_facts',{question:'Describe relevant project evidence.',company:'Evidence',roleLane:'fde',facts},'call_evidence_draft');return;
    }
    if(q.includes('[case:answer-evidence]')){text(JSON.stringify(data));return;}
    if(q.includes('[case:note]')&&last.tool_call_id==='call_job'&&!data.error){tool('propose_job_note',{jobId:data.id,expectedRevision:data.revision,note:'Follow up with the hiring team.'},'call_note');return;}
    if(data.error){text('No authorized action is available for that request.');return;}
    if(data.proposalId){text(last.tool_call_id==='call_fact'?'A candidate fact is ready in Candidate review. It is not approved.':'A note change is ready for your review. It has not been saved.');return;}
    if(q.includes('[case:candidate]')){text(JSON.stringify(data));return;}
    if(q.includes('[case:answer-recall]')||q.includes('[case:answer-draft]')||q.includes('[case:answer-private]')){text(JSON.stringify(data));return;}
    text(data.jobs?'Saved roles: '+data.jobs.map(j=>j.company+' - '+j.title).join('; '):'Saved role '+(data.company||'')+' at revision '+(data.revision||'unknown')+'.');return;
   }
   if(q.includes('[case:self-confirm]')){tool('confirm_proposal',{proposalId:id||crypto.randomUUID()},'call_forbidden');return;}
   if(q.includes('[case:application-read]')){tool('read_applications',{},'call_application_read');return;}
   if(q.includes('[case:application-evaluate]')||q.includes('[case:application-unrequested]')){
    tool('evaluate_job',{jobId:id,expectedJobRevision:Number(q.match(/rev (\d+)/)?.[1]),expectedCandidateRevision:Number(q.match(/candidate (\d+)/)?.[1]),quote:q.includes('unrequested')?'evaluate '+id:q},'call_application_evaluate');return;
   }
   if(q.includes('[case:discovery]')){tool('read_discovery',{},'call_discovery');return;}
   if(q.includes('[case:discovery-start]')){tool('start_job_search',{sourceIds:[id],terms:['Software'],quote:q},'call_discovery_start');return;}
   if(q.includes('[case:discovery-save]')){tool('set_discovery_state',{jobId:id,expectedRevision:Number(q.match(/rev (\d+)/)?.[1]),state:q.includes('dismiss')?'dismissed':'saved',quote:q},'call_discovery_save');return;}
   if(q.includes('[case:discovery-unrequested]')){tool('start_job_search',{sourceIds:[id],terms:['Software'],quote:'find Software'},'call_discovery_start');return;}
   if(q.includes('[case:answer-self-confirm]')){tool('approve_answer',{answerId:id||crypto.randomUUID()},'call_forbidden');return;}
   if(q.includes('[case:answer-recall]')){tool('recall_application_answer',{question:'Describe a customer project.',company:'Alpha',roleLane:'fde'},'call_answer_read');return;}
   if(q.includes('[case:answer-private]')){tool('recall_application_answer',{question:'Describe a private plan.',company:'Private',roleLane:'fde'},'call_answer_read');return;}
   if(q.includes('[case:answer-evidence]')){tool('read_candidate_context',{},'call_evidence_read');return;}
   if(q.includes('[case:answer-draft]')){tool('propose_application_answer',{question:'Describe a customer project.',company:'Alpha',roleLane:'fde',answer:'I built a customer integration in Rust.',quote:'I built a customer integration in Rust.'},'call_answer_draft');return;}
   if(q.includes('[case:fact]')){tool('propose_candidate_fact',{fieldKey:'candidate.location',value:'Arlington, VA',quote:'I live in Arlington, VA.'},'call_fact');return;}
   if(q.includes('[case:candidate]')){tool('read_candidate_context',{},'call_candidate');return;}
   if(q.includes('[case:note]')||q.includes('[case:cross]')){tool('get_job',{jobId:id},'call_job');return;}
   tool('read_workspace',{},'call_read');
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
 });
 await new Promise(resolve=>modelServer.listen(0,'127.0.0.1',resolve));
 const modelPort=modelServer.address().port,url=new URL('postgresql://maxim@127.0.0.1:'+dbPort+'/'+database);url.password=password;
 const c={databaseUrl:url.toString(),origin:'http://127.0.0.1:'+port,privateRoot:root,workspaceId:crypto.randomUUID(),
  bootstrapKey:crypto.randomBytes(32).toString('hex'),model:{model:'fixture-model',apiKey:'fixture-provider-key',baseUrl:'http://127.0.0.1:'+modelPort+'/v1'},testMode:true,testContainer:container,discoveryFixtureOrigin:'http://127.0.0.1:'+modelPort};
 const runtime=path.join(root,'runtime.json');fs.writeFileSync(runtime,JSON.stringify(c));
 assertTestConfig(c);
 let server,logFd;
 const workers=new Map();
 const cleanEnv=()=>Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','LOCALAPPDATA','USERPROFILE','COMSPEC','PATHEXT','NUMBER_OF_PROCESSORS'].includes(k)));
 const sql=async(text,params=[],name=database)=>{
  if(!/^maxim_test_[a-z0-9_]+$/.test(name))throw Error('Unsafe SQL target');
  const u=new URL(c.databaseUrl);u.pathname='/'+name;
  const client=new pg.Client({connectionString:u.toString()});await client.connect();
  try{return await client.query(text,params);}finally{await client.end();}
 };
 async function startWorker(){
  const node=path.join(appDir,'node_modules/node/bin',process.platform==='win32'?'node.exe':'node');
  const fd=fs.openSync(path.join(root,'worker.log'),'a');
  const child=spawn(node,['--import','tsx','src/worker/main.ts','--runtime-file',runtime],
   {cwd:appDir,env:{...cleanEnv(),MAXIM_RUNTIME_FILE:runtime},stdio:['ignore',fd,fd],windowsHide:true});
  workers.set(child,fd);
  await delay(1000);
  if(child.exitCode!==null)throw Error('Fixture worker exited. Inspect worker.log.');
  return child;
 }
 async function stopWorker(child){
  if(!workers.has(child))return;
  if(child.exitCode===null){
   if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
   else child.kill('SIGTERM');
   await new Promise(resolve=>{if(child.exitCode!==null)resolve();else{child.once('exit',resolve);setTimeout(resolve,3000).unref();}});
  }
  fs.closeSync(workers.get(child));workers.delete(child);
 }
 async function startServer(){
  const node=path.join(appDir,'node_modules/node/bin',process.platform==='win32'?'node.exe':'node');
  logFd=fs.openSync(path.join(root,'server.log'),'a');
  server=spawn(fs.existsSync(node)?node:process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],
   {cwd:appDir,env:{...cleanEnv(),MAXIM_RUNTIME_FILE:runtime,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'production'},stdio:['ignore',logFd,logFd],windowsHide:true});
  for(let i=0;i<120;i++){
   if(server.exitCode!==null)throw Error('Test app exited. Inspect fixture server.log.');
   try{const r=await fetch(c.origin+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok)return;}catch{}
   await delay(500);
  }throw Error('Test app did not become ready.');
 }
 async function stopServer(){
  if(server&&server.exitCode===null){
   if(process.platform==='win32')execFileSync('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});
   else server.kill('SIGTERM');
   await new Promise(resolve=>{if(server.exitCode!==null)resolve();else{server.once('exit',resolve);setTimeout(resolve,3000).unref();}});
  }
  if(logFd!==undefined){fs.closeSync(logFd);logFd=undefined;}
 }
 try{
  execFileSync('docker',['run','--detach','--rm','--name',container,'-e','POSTGRES_PASSWORD','-e','POSTGRES_USER=maxim','-e','POSTGRES_DB='+database,'-p','127.0.0.1:'+dbPort+':5432','postgres:18.1'],
   {env:{...process.env,POSTGRES_PASSWORD:password},stdio:'pipe',windowsHide:true,timeout:180000});
  await waitDatabase(c.databaseUrl);await migrate(c);await startServer();
 }catch(error){await stopServer().catch(()=>{});execFileSync('docker',['rm','-f',container],{stdio:'ignore',windowsHide:true});modelServer.closeAllConnections();modelServer.close();throw error;}
 const other={workspaceId:crypto.randomUUID(),key:crypto.randomBytes(32).toString('hex')};
 await sql('INSERT INTO workspaces(id,name,is_owner) VALUES($1,$2,false)',[other.workspaceId,'Second isolated workspace']);
 await sql('INSERT INTO candidates(id,workspace_id,display_name) VALUES($1,$2,$3)',[crypto.randomUUID(),other.workspaceId,'Other fixture']);
 await sql('INSERT INTO access_keys(key_hash,workspace_id) VALUES($1,$2)',[sha(other.key),other.workspaceId]);
 const login=async key=>{
  const r=await fetch(c.origin+'/api/auth/login',{method:'POST',headers:{Origin:c.origin,'Content-Type':'application/json'},body:JSON.stringify({accessKey:key})});
  if(!r.ok)throw Error('Fixture login failed');
  const value=await r.json();
  return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:value.csrfToken};
 };
 const request=async(auth,endpoint,options={})=>{
  const headers={Origin:c.origin,...(auth?{Cookie:auth.cookie,'x-csrf-token':auth.csrf}:{}),...options.headers};
  let body=options.body;
  if(body!==undefined&&!(body instanceof FormData)){headers['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await fetch(c.origin+endpoint,{...options,headers,body});
  return response;
 };
 const a=await login(c.bootstrapKey),b=await login(other.key);
 return {root,c,runtime,container,database,captured,providerRequests,providerRoutes,a,b,other,sql,login,request,startServer,stopServer,startWorker,stopWorker,
  snapshotDatabase:target=>snapshotDatabase(c,target),restoreDatabase:(dump,name)=>restoreDatabase(c,dump,name),
  async close(){
   for(const child of [...workers.keys()])await stopWorker(child);
   await stopServer();for(const t of timers)clearTimeout(t);
   modelServer.closeAllConnections();await new Promise(resolve=>modelServer.close(resolve));
   execFileSync('docker',['rm','-f',container],{stdio:'ignore',windowsHide:true});
   const resolved=path.resolve(root),temp=path.resolve(os.tmpdir());
   if(!path.basename(resolved).startsWith('maxim-test-')||!resolved.startsWith(temp+path.sep))throw Error('Unsafe fixture cleanup path');
   fs.rmSync(resolved,{recursive:true,force:true});
  }
 };
}
export async function streamResult(response){
 const events=[];
 const text=await response.text();
 for(const block of text.split('\n\n')){
  const name=block.match(/^event: (.+)$/m)?.[1],data=block.match(/^data: (.+)$/m)?.[1];
  if(name&&data)events.push({event:name,data:JSON.parse(data)});
 }
 return events;
}
