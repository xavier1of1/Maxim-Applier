import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { appDir,defaultConfigFile,readConfig,provision,compose,freePort,delay,sha } from './environment.mjs';
import { backupWorkspace,restoreWorkspace } from './recovery.mjs';

const require=createRequire(import.meta.url),action=process.argv[2]||'start';
async function main(){
 if(action==='key'){console.log(readConfig().bootstrapKey);return;}
 if(action==='setup'){await provision();console.log('Workspace configured. Access key: npm --prefix maxim/app run key');return;}
 const c=action==='start'?await provision():readConfig(),pidFile=path.join(c.privateRoot,'server.json');
 if(action==='start'){
  if(fs.existsSync(pidFile)){
   const owned=JSON.parse(fs.readFileSync(pidFile));
   try{const response=await fetch(owned.origin+'/api/health',{signal:AbortSignal.timeout(1500)});const state=await response.json();if(response.ok&&state.application==='maxim-apply'&&state.installation===sha(c.workspaceId).slice(0,16)){console.log(owned.origin+'/maxim');return;}}catch{}
  }
  const preferred=Number(new URL(c.origin).port)||3010,port=await freePort(preferred);
  c.origin='http://127.0.0.1:'+port;
  fs.writeFileSync(defaultConfigFile,JSON.stringify(c,null,2),{mode:0o600});
  if(!fs.existsSync(path.join(appDir,'.next','BUILD_ID')))throw Error('Build the workspace first: npm --prefix maxim/app run build');
  const log=fs.openSync(path.join(c.privateRoot,'server.log'),'a',0o600);
  const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],
   {cwd:appDir,env:{...process.env,MAXIM_RUNTIME_FILE:defaultConfigFile,NEXT_TELEMETRY_DISABLED:'1'},detached:true,stdio:['ignore',log,log],windowsHide:true});
  child.unref();fs.closeSync(log);
  fs.writeFileSync(pidFile,JSON.stringify({pid:child.pid,origin:c.origin,startedAt:new Date().toISOString()}),{mode:0o600});
  for(let i=0;i<90;i++){try{const r=await fetch(c.origin+'/api/health',{signal:AbortSignal.timeout(1000)});if(r.ok){console.log(c.origin+'/maxim');console.log('Sign-in key: npm --prefix maxim/app run key');return;}}catch{}await delay(500);}
  throw Error('Workspace did not become ready; inspect the private server log.');
 }
 if(action==='stop'){
  if(fs.existsSync(pidFile)){
   const owned=JSON.parse(fs.readFileSync(pidFile));
   const {execFileSync}=await import('node:child_process');
   if(process.platform==='win32'){
    const cmd=execFileSync('powershell',['-NoProfile','-Command','(Get-CimInstance Win32_Process -Filter "ProcessId='+Number(owned.pid)+'").CommandLine'],{encoding:'utf8',windowsHide:true});
    if(cmd.trim()){
     if(!cmd.includes(require.resolve('next/dist/bin/next'))||!cmd.includes('--port '+new URL(owned.origin).port))throw Error('Saved PID is not an owned workspace server; refusing to stop it.');
     execFileSync('taskkill',['/PID',String(owned.pid),'/T','/F'],{stdio:'pipe',windowsHide:true});
    }
   }else process.kill(owned.pid,'SIGTERM');
   fs.unlinkSync(pidFile);
  }
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
