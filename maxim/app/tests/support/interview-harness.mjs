import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {appDir,repo,freePort,waitDatabase,sha,delay} from '../../scripts/environment.mjs';
import {createFixture,removeFixture,startTestDatabase,stopTestDatabase,cleanupTasks} from '../../../lib/test-resources.mjs';

// No default runtime, existing database, .env, access key or provider is consulted.
export async function interviewHarness(){
 if(process.env.MAXIM_RUNTIME_FILE)throw Error('Interview fixture refuses an inherited runtime selector.');
 const root=createFixture('maxim-test-interview-');
 const suffix=crypto.randomUUID(),container='maxim-test-'+suffix,name='maxim_test_'+suffix.replaceAll('-','');
 const password=crypto.randomBytes(24).toString('hex'),port=await freePort(),dbPort=await freePort();
 const timers=new Set(),captured=[];
 let providerMode='normal',app,modules,closed=false;
 const provider=http.createServer(async(req,res)=>{
  try{
   if(req.url!=='/v1/chat/completions'||req.method!=='POST'){res.writeHead(404).end();return;}
   let raw='';for await(const b of req){raw+=b;if(Buffer.byteLength(raw)>32000)throw Error('fixture_request_limit');}
   const body=JSON.parse(raw);captured.push(body);
   if(providerMode==='hang')return;
   if(providerMode==='reject'){res.writeHead(429).end('synthetic provider refusal');return;}
   if(providerMode==='malformed'){res.writeHead(200,{'Content-Type':'application/json'}).end('{bad');return;}
   if(providerMode==='oversize'){res.writeHead(200,{'Content-Type':'application/json'}).end('x'.repeat(65000));return;}
   const input=JSON.parse(body.messages.at(-1).content),fact=input.context.facts[0];
   const result={observations:[{claim:'99 million users',assessment:'supported',factIds:fact?[fact.id]:[]}],rubric:[{dimension:'grounding',feedback:'Use the reviewed project and ask for missing measurements.'},{dimension:'structure',feedback:'Separate personal actions from team outcomes.'}],followUpQuestions:['Which real result can you substantiate?']};
   const send=()=>res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({choices:[{finish_reason:providerMode==='truncated'?'length':'stop',message:{content:JSON.stringify(result)}}],usage:{prompt_tokens:120,completion_tokens:40}}));
   if(providerMode==='slow'){
    const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)send();},10000);timers.add(timer);
    res.once('close',()=>{clearTimeout(timer);timers.delete(timer);});
   }else send();
  }catch{if(!res.headersSent)res.writeHead(500);res.end();}
 });
 await new Promise(resolve=>provider.listen(0,'127.0.0.1',resolve));
 const u=new URL('postgresql://maxim@127.0.0.1:'+dbPort+'/'+name);u.password=password;
 const c={testMode:true,databaseUrl:u.toString(),origin:'http://127.0.0.1:'+port,privateRoot:root,workspaceId:crypto.randomUUID(),bootstrapKey:crypto.randomBytes(32).toString('hex'),model:{model:'fixture-model',apiKey:'synthetic-only-key',baseUrl:'http://127.0.0.1:'+provider.address().port+'/v1'}};
 if(!/^maxim_test_[a-f0-9]+$/.test(name)||!path.basename(root).startsWith('maxim-test-')||new URL(c.model.baseUrl).hostname!=='127.0.0.1')throw Error('Unsafe interview fixture');
 const runtime=path.join(root,'runtime.json');fs.writeFileSync(runtime,JSON.stringify(c),{mode:0o600});
 const sql=async(text,params=[])=>{const client=new pg.Client({connectionString:c.databaseUrl});await client.connect();try{return await client.query(text,params);}finally{await client.end();}};
 const other={workspaceId:crypto.randomUUID(),key:crypto.randomBytes(32).toString('hex')};
 let a,b,job,fact;
 async function startServer(){
  app=http.createServer(async(req,res)=>{
   try{
    if(req.url==='/fixture.js'&&c.bundle){res.writeHead(200,{'Content-Type':'text/javascript'}).end(c.bundle);return;}
    if(req.url==='/fixture.css'&&c.css){res.writeHead(200,{'Content-Type':'text/css'}).end(c.css);return;}
    if(new URL(req.url,c.origin).pathname==='/'&&c.bundle){res.writeHead(200,{'Content-Type':'text/html'}).end('<!doctype html><html lang="en" data-theme="light" data-astryx-theme="neutral"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fixture.css"></head><body><main id="root"></main><script src="/fixture.js"></script></body></html>');return;}
    const chunks=[];for await(const chunk of req){chunks.push(chunk);if(Buffer.concat(chunks).length>30000)throw Error('fixture_http_limit');}
    const request=new Request(c.origin+req.url,{method:req.method,headers:req.headers,...(chunks.length?{body:Buffer.concat(chunks)}:{})});
    const response=await modules.interviewHttp(request);
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
   }catch{res.writeHead(500).end('Fixture bridge failed');}
  });
  await new Promise(resolve=>app.listen(port,'127.0.0.1',resolve));
 }
 async function stopServer(){if(app){app.closeAllConnections();await new Promise(resolve=>app.close(resolve));app=undefined;}}
 async function close(){
  if(closed)return;closed=true;
  await cleanupTasks([stopServer,
   async()=>{for(const t of timers)clearTimeout(t);provider.closeAllConnections();await new Promise(resolve=>provider.close(resolve));},
   async()=>{if(modules)await modules.closeDatabase();},()=>{delete process.env.MAXIM_RUNTIME_FILE;},
   ()=>stopTestDatabase(container),()=>removeFixture(root,{allowCurrent:true}),
  ]);
 }
 try{
  startTestDatabase({...c,testContainer:container});
  await waitDatabase(c.databaseUrl);
  await sql('CREATE TABLE schema_migrations(version integer PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
  const directory=path.join(repo,'maxim/db/postgres');
  // Test this lane against the accepted S5 schema, independent of concurrent stage migrations.
  for(const file of fs.readdirSync(directory).filter(f=>/^(?:00[1-6]_[a-z_]+|010_interview)\.sql$/.test(f)).sort()){
   if(!/^\d{3}_[a-z_]+\.sql$/.test(file))throw Error('Migration would not be discoverable');
   await sql(fs.readFileSync(path.join(directory,file),'utf8'));await sql('INSERT INTO schema_migrations(version) VALUES($1)',[Number(file.slice(0,3))]);
  }
  for(const identity of [{workspaceId:c.workspaceId,key:c.bootstrapKey},other]){
   await sql('INSERT INTO workspaces(id,name,is_owner) VALUES($1,$2,true)',[identity.workspaceId,'Synthetic interview workspace']);
   await sql("INSERT INTO candidates(id,workspace_id,display_name,ownership) VALUES($1,$2,'Synthetic candidate','canonical')",[crypto.randomUUID(),identity.workspaceId]);
   await sql('INSERT INTO access_keys(key_hash,workspace_id) VALUES($1,$2)',[sha(identity.key),identity.workspaceId]);
  }
  const source=crypto.randomUUID();
  await sql("INSERT INTO candidate_sources(id,workspace_id,name,format,content_hash,classification,model_consent,status) VALUES($1,$2,'Public-style synthetic project','manual',$3,'public',true,'approved')",[source,c.workspaceId,sha(source)]);
  fact=(await sql("INSERT INTO candidate_facts(id,workspace_id,field_key,value,source_id,source_revision,sensitivity) VALUES($1,$2,'projects.summary',$3,$4,1,'standard') RETURNING *",[crypto.randomUUID(),c.workspaceId,JSON.stringify('Built a synthetic queue processor with Rust.'),source])).rows[0];
  job=(await sql('INSERT INTO jobs(id,workspace_id,company,title,description) VALUES($1,$2,$3,$4,$5) RETURNING *',[crypto.randomUUID(),c.workspaceId,'Synthetic Labs','Platform Engineer','Design reliable queue processing and discuss tradeoffs.'])).rows[0];
  process.env.MAXIM_RUNTIME_FILE=runtime;
  const [{interviewHttp},{closeDatabase},{claimWork},{practiceInterview},{login}]=await Promise.all([import('../../src/server/interview/http.ts'),import('../../src/server/db.ts'),import('../../src/server/work.ts'),import('../../src/worker/interview.ts'),import('../../src/server/auth.ts')]);
  modules={interviewHttp,closeDatabase,claimWork,practiceInterview};
  const loginAs=async key=>{const r=await login(key);return {cookie:'maxim_session='+r.token,csrf:r.csrfToken};};
  a=await loginAs(c.bootstrapKey);b=await loginAs(other.key);await startServer();
  const request=async(auth,url,options={})=>fetch(c.origin+url,{...options,headers:{Origin:c.origin,...(auth?{Cookie:auth.cookie,'x-csrf-token':auth.csrf}:{}),...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},...(options.body?{body:JSON.stringify(options.body)}:{})});
  return {root,c,runtime,container,job,fact,a,b,other,sql,captured,request,startServer,stopServer,close,delay,
   setProviderMode(mode){providerMode=mode;},
   configure(update){Object.assign(c,update);const {bundle,css,...runtimeConfig}=c;fs.writeFileSync(runtime,JSON.stringify(runtimeConfig));},
   async work(){const item=await claimWork('interview-fixture',60);if(!item)throw Error('Expected queued interview work');if(item.kind!=='interview_feedback')throw Error('Unexpected work kind');await practiceInterview(item);return item;},
  };
 }catch(error){await close().catch(()=>{});throw error;}
}
