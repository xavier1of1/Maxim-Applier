import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { execFileSync,spawnSync } from 'node:child_process';
import pg from 'pg';

export const appDir=fileURLToPath(new URL('../',import.meta.url));
export const repo=fileURLToPath(new URL('../../../',import.meta.url));
export const defaultConfigFile=path.join(process.env.LOCALAPPDATA||'', 'MaximApply','private','workspace','runtime.json');
export const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
export function readConfig(file=process.env.MAXIM_RUNTIME_FILE||defaultConfigFile){return JSON.parse(fs.readFileSync(file,'utf8'));}
export const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function freePort(preferred=0){
 return new Promise((resolve,reject)=>{
  const server=net.createServer();
  server.once('error',e=>{if(preferred&&e.code==='EADDRINUSE')freePort(0).then(resolve,reject);else reject(e);});
  server.listen(preferred,'127.0.0.1',()=>{const p=server.address().port;server.close(()=>resolve(p));});
 });
}
export async function waitDatabase(url){
 for(let i=0;i<60;i++){
  const client=new pg.Client({connectionString:url,connectionTimeoutMillis:1000});
  try{await client.connect();await client.query('SELECT 1');await client.end();return;}
  catch{await client.end().catch(()=>{});await delay(500);}
 }
 throw Error('PostgreSQL did not become ready.');
}
export async function migrate(c){
 const client=new pg.Client({connectionString:c.databaseUrl});await client.connect();
 try{
  await client.query('SELECT pg_advisory_lock(120031)');
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
  const directory=path.join(repo,'maxim/db/postgres');
  for(const file of fs.readdirSync(directory).filter(f=>/^\d{3}_[a-z_]+\.sql$/.test(f)).sort()){
   const version=Number(file.slice(0,3)),r=await client.query('SELECT version FROM schema_migrations WHERE version=$1',[version]);
   if(!r.rowCount){
    await client.query('BEGIN');
    try{await client.query(fs.readFileSync(path.join(directory,file),'utf8'));await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[version]);await client.query('COMMIT');}
    catch(e){await client.query('ROLLBACK');throw e;}
   }
  }
  await client.query('BEGIN');
  await client.query('INSERT INTO workspaces(id,name,is_owner) VALUES($1,$2,true) ON CONFLICT(id) DO NOTHING',[c.workspaceId,'Personal workspace']);
  await client.query('INSERT INTO candidates(id,workspace_id,display_name) VALUES($1,$2,$3) ON CONFLICT(workspace_id) DO NOTHING',[crypto.randomUUID(),c.workspaceId,'Local candidate']);
  await client.query("INSERT INTO workspace_policies(workspace_id,profile,approved_source) VALUES($1,'xavier-v1','Explicit project owner policy') ON CONFLICT(workspace_id) DO NOTHING",[c.workspaceId]);
  await client.query('INSERT INTO access_keys(key_hash,workspace_id) VALUES($1,$2) ON CONFLICT(key_hash) DO NOTHING',[sha(c.bootstrapKey),c.workspaceId]);
  await client.query('COMMIT');
 }finally{await client.query('SELECT pg_advisory_unlock(120031)').catch(()=>{});await client.end();}
}
export function protect(dir){
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 if(process.platform==='win32'){
  const user=execFileSync('whoami',{encoding:'utf8'}).trim();
  execFileSync('icacls',[dir,'/inheritance:r','/grant:r',user+':(OI)(CI)F','SYSTEM:(OI)(CI)F'],{stdio:'ignore',windowsHide:true});
 }
}
export function compose(c,args){
 const u=new URL(c.databaseUrl),envFile=path.join(c.privateRoot,'compose.env');
 fs.writeFileSync(envFile,'# Credentials are passed through the process environment.\n',{mode:0o600});
 return execFileSync('docker',['compose','--env-file',envFile,'-f',path.join(repo,'compose.yml'),...args],
  {env:{...process.env,MAXIM_DB_PASSWORD:decodeURIComponent(u.password),MAXIM_DB_PORT:u.port},stdio:['ignore','pipe','pipe'],windowsHide:true,timeout:180000});
}
export async function provision(){
 if(!process.env.LOCALAPPDATA)throw Error('This composition requires Windows local app storage.');
 const privateBase=path.join(process.env.LOCALAPPDATA,'MaximApply','private');protect(privateBase);
 const root=path.join(privateBase,'workspace');protect(root);
 let c;
 if(fs.existsSync(defaultConfigFile))c=readConfig(defaultConfigFile);
 else{
  const dbPort=await freePort(55432),url=new URL('postgresql://maxim@127.0.0.1:'+dbPort+'/maxim_workspace');
  url.password=crypto.randomBytes(32).toString('hex');
  c={databaseUrl:url.toString(),privateRoot:root,origin:'http://127.0.0.1:3010',workspaceId:crypto.randomUUID(),
   bootstrapKey:crypto.randomBytes(32).toString('base64url'),model:{baseUrl:'https://api.openai.com/v1',model:'',apiKey:''},testMode:false};
  fs.writeFileSync(defaultConfigFile,JSON.stringify(c,null,2),{flag:'wx',mode:0o600});
 }
 compose(c,['up','-d','--wait','database']);await waitDatabase(c.databaseUrl);await migrate(c);return c;
}
export function databaseContainer(c){
 if(c.testMode){
  if(!/^maxim-test-[a-f0-9-]+$/.test(c.testContainer||'') || !/^\/maxim_test_[a-z0-9_]+$/.test(new URL(c.databaseUrl).pathname))throw Error('Unsafe test database configuration.');
  return c.testContainer;
 }
 return compose(c,['ps','-q','database']).toString().trim();
}
export function snapshotDatabase(c,target){
 const container=databaseContainer(c);
 if(!container)throw Error('Workspace database is not running.');
 const database=new URL(c.databaseUrl).pathname.slice(1);
 const dump=execFileSync('docker',['exec',container,'pg_dump','-U','maxim','-d',database,'--no-owner','--no-privileges'],
  {maxBuffer:128*1024*1024,windowsHide:true,timeout:120000});
 fs.writeFileSync(target,dump,{flag:'wx',mode:0o600});
 return sha(dump);
}
export async function restoreDatabase(c,dump,targetName){
 if(!(c.testMode?/^maxim_test_restore_\d+$/:/^maxim_restore_\d+$/).test(targetName))throw Error('Only a new recovery database is allowed.');
 const container=databaseContainer(c);
 execFileSync('docker',['exec',container,'createdb','-U','maxim',targetName],{stdio:'pipe',windowsHide:true,timeout:30000});
 const result=spawnSync('docker',['exec','-i',container,'psql','-X','--set','ON_ERROR_STOP=1','-U','maxim','-d',targetName],
  {input:dump,maxBuffer:16*1024*1024,windowsHide:true,timeout:120000});
 if(result.status!==0)throw Error('Restore failed; the isolated recovery database was left for inspection.');
 const url=new URL(c.databaseUrl);url.pathname='/'+targetName;
 const client=new pg.Client({connectionString:url.toString()});await client.connect();
 try{return {jobs:Number((await client.query('SELECT count(*) FROM jobs')).rows[0].count),applications:Number((await client.query('SELECT count(*) FROM applications')).rows[0].count)};}
 finally{await client.end();}
}
