import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
const repo=fileURLToPath(new URL('../../',import.meta.url)),temp=fs.realpathSync(os.tmpdir()),root=fs.mkdtempSync(path.join(temp,'maxim-native-proof-'));
const files=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:repo,encoding:'utf8'}).split('\0').filter(Boolean);
const excluded=file=>/^(?:cv\.md|article-digest\.md|applications\.md|portals\.yml|config\/profile\.yml|modes\/_profile\.md|\.env(?:\.|$)|data\/|reports\/|output\/|jds\/|interview-prep\/|writing-samples\/|batch\/(?:logs|tracker-additions|batch-input|batch-state)|maxim\/app\/(?:\.next|test-results|playwright-report|\.cache|node_modules)|maxim\/runtime\/target)/.test(file);
function safeRoot(){
 const actual=fs.realpathSync(root);
 if(!actual.startsWith(temp+path.sep)||!/^maxim-native-proof-[A-Za-z0-9]+$/.test(path.basename(actual))||fs.lstatSync(root).isSymbolicLink())throw Error('Unsafe native proof target.');
 return actual;
}
try{
 safeRoot();
 for(const file of [...new Set(files)]){
  if(excluded(file))continue;
  const source=path.join(repo,file);if(!fs.existsSync(source))continue;
  const stat=fs.lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink())continue;
  const target=path.resolve(root,file);if(!target.startsWith(root+path.sep))throw Error('Copy path escaped fixture.');
  fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target);
 }
 for(const folder of ['data/maxim','reports','output','jds','batch/logs','batch/tracker-additions','interview-prep'])fs.mkdirSync(path.join(root,folder),{recursive:true});
 fs.writeFileSync(path.join(root,'data/applications.md'),'# Applications Tracker\n\n| # | Date | Company | Role | Score | Status | PDF | Report | Notes |\n|---|---|---|---|---|---|---|---|---|\n');
 fs.writeFileSync(path.join(root,'data/pipeline.md'),'# Pipeline\n\nNo pending fixture roles.\n');
 fs.symlinkSync(path.join(repo,'node_modules'),path.join(root,'node_modules'),process.platform==='win32'?'junction':'dir');
 execFileSync('git',['init','--quiet'],{cwd:root,stdio:'pipe',windowsHide:true});
 const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','TEMP','TMP','LOCALAPPDATA','USERPROFILE','COMSPEC','PATHEXT','NUMBER_OF_PROCESSORS','HOME'].includes(key)));
 const result=spawnSync(process.execPath,[path.join(root,'test-all.mjs')],{cwd:root,env,stdio:'inherit',windowsHide:true,timeout:180000});
 if(result.error)throw Error('Native fixture suite could not finish: '+result.error.code);
 process.exitCode=result.status??1;
 console.log('Native proof used sanitized disposable data only; personal trackers were not opened or mutated.');
}finally{
 safeRoot();
 const modules=path.join(root,'node_modules');
 if(fs.existsSync(modules)){if(!fs.lstatSync(modules).isSymbolicLink())throw Error('Unexpected native fixture dependency directory.');if(process.platform==='win32')fs.rmdirSync(modules);else fs.unlinkSync(modules);}
 fs.rmSync(root,{recursive:true,force:true});
}
