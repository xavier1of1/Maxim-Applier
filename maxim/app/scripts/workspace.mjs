import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { appDir,defaultConfigFile,readConfig,provision,compose,freePort,delay,sha } from './environment.mjs';
import { backupWorkspace,restoreWorkspace } from './recovery.mjs';
import {closeOwnedBrowsers} from './browser-sessions.mjs';
import {browserStorageEnv} from '../../lib/test-resources.mjs';

const require=createRequire(import.meta.url),action=process.argv[2]||'start';
const workerPath=path.join(appDir,'src','worker','main.ts');
function processCommand(pid){
 if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid saved process identity.');
 if(process.platform==='win32')return execFileSync('powershell',['-NoProfile','-Command','(Get-CimInstance Win32_Process -Filter "ProcessId='+pid+'").CommandLine'],{encoding:'utf8',windowsHide:true}).trim();
 try{process.kill(pid,0);return execFileSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'}).trim();}catch{return '';}
}
function stopOwned(file,expected){
 if(!fs.existsSync(file))return;
 const owned=JSON.parse(fs.readFileSync(file)),cmd=processCommand(owned.pid);
 if(cmd){
  if(!expected(cmd,owned))throw Error('Saved PID is not an owned workspace process; refusing to stop it.');
  if(process.platform==='win32')execFileSync('taskkill',['/PID',String(owned.pid),'/T','/F'],{stdio:'pipe',windowsHide:true});
  else process.kill(owned.pid,'SIGTERM');
 }
 fs.unlinkSync(file);
}
async function ensureWorker(c){
 const file=path.join(c.privateRoot,'worker.json');
 if(fs.existsSync(file)){
  const saved=JSON.parse(fs.readFileSync(file)),cmd=processCommand(saved.pid);
  if(cmd.includes(workerPath)&&cmd.includes(defaultConfigFile))return;
  if(cmd)throw Error('Worker PID belongs to another process.');
  fs.unlinkSync(file);
 }
 const log=fs.openSync(path.join(c.privateRoot,'worker.log'),'a',0o600);
 const child=spawn(process.execPath,['--import','tsx',workerPath,'--runtime-file',defaultConfigFile],
  {cwd:appDir,env:{...process.env,...browserStorageEnv(),MAXIM_RUNTIME_FILE:defaultConfigFile},detached:true,stdio:['ignore',log,log],windowsHide:true});
 child.unref();fs.closeSync(log);
 fs.writeFileSync(file,JSON.stringify({pid:child.pid,startedAt:new Date().toISOString()}),{mode:0o600});
 await delay(1500);
 if(!processCommand(child.pid))throw Error('Worker did not start; inspect its private log.');
}
async function main(){
 if(action==='key'){console.log(readConfig().bootstrapKey);return;}
 if(action==='setup'){await provision();console.log('Workspace configured. Access key: npm --prefix maxim/app run key');return;}
 const c=action==='start'?await provision():readConfig(),pidFile=path.join(c.privateRoot,'server.json');
 if(action==='start'){
  if(fs.existsSync(pidFile)){
   const owned=JSON.parse(fs.readFileSync(pidFile));
   let healthy=false;
   try{const response=await fetch(owned.origin+'/api/health',{signal:AbortSignal.timeout(1500)});const state=await response.json();healthy=response.ok&&state.application==='maxim-apply'&&state.installation===sha(c.workspaceId).slice(0,16);}catch{}
   if(healthy){await ensureWorker(c);console.log(owned.origin+'/maxim');return;}
  }
  const preferred=Number(new URL(c.origin).port)||3010,port=await freePort(preferred);
  c.origin='http://127.0.0.1:'+port;
  fs.writeFileSync(defaultConfigFile,JSON.stringify(c,null,2),{mode:0o600});
  if(!fs.existsSync(path.join(appDir,'.next','BUILD_ID')))throw Error('Build the workspace first: npm --prefix maxim/app run build');
  const log=fs.openSync(path.join(c.privateRoot,'server.log'),'a',0o600);
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],
   {cwd:appDir,env:{...process.env,...browserStorageEnv(),MAXIM_RUNTIME_FILE:defaultConfigFile,NEXT_TELEMETRY_DISABLED:'1'},detached:true,stdio:['ignore',log,log],windowsHide:true});
  child.unref();fs.closeSync(log);
  fs.writeFileSync(pidFile,JSON.stringify({pid:child.pid,origin:c.origin,startedAt:new Date().toISOString()}),{mode:0o600});
  for(let i=0;i<90;i++){
   let ready=false;try{const r=await fetch(c.origin+'/api/health',{signal:AbortSignal.timeout(1000)});ready=r.ok;}catch{}
   if(ready){await ensureWorker(c);console.log(c.origin+'/maxim');console.log('Sign-in key: npm --prefix maxim/app run key');return;}
   await delay(500);
  }
  throw Error('Workspace did not become ready; inspect the private server log.');
 }
 if(action==='stop'){
  closeOwnedBrowsers(c);
  stopOwned(path.join(c.privateRoot,'worker.json'),cmd=>cmd.includes(workerPath)&&cmd.includes(defaultConfigFile));
  stopOwned(pidFile,(cmd,owned)=>cmd.includes(require.resolve('next/dist/bin/next'))&&cmd.includes('--port '+new URL(owned.origin).port));
  compose(c,['stop','database']);console.log('Workspace stopped; data retained.');return;
 }
 if(action==='backup'){
  console.log(JSON.stringify(await backupWorkspace(c)));return;
 }
 if(action==='restore'){
  console.log(JSON.stringify(await restoreWorkspace(c,process.argv[3])));return;
 }
 throw Error('Use setup, start, stop, key, backup or restore.');
}
main().catch(()=>{console.error('Workspace operation failed. Check Docker/configuration and the private log; no credentials are printed.');process.exitCode=1;});
