import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {repoRoot} from './path-utils.mjs';
import {closeOwnedBrowsers} from '../app/scripts/browser-sessions.mjs';
import {owner,repositoryId,testTempRoot,ensureTestRoot,validateTestRoot,readSmallJson,assertPlainPath,fixtureMetadata,directorySnapshot,processAlive,removeFixture,stopTestDatabase,storageHeadroom,dockerResourceRecord} from './test-resources.mjs';

export function dockerRecords(base){
 const directory=path.join(base,'docker-resources');if(!fs.existsSync(directory))return [];
 assertPlainPath(directory);
 return fs.readdirSync(directory).filter(n=>/^maxim-test-[a-f0-9-]{36}\.json$/.test(n)).map(n=>{const file=path.join(directory,n);try{return {file,record:dockerResourceRecord(file,base),fingerprint:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};}catch{return {file,unverified:true};}});
}

export function measure(root){
 if(!fs.existsSync(root))return {bytes:0,files:0,missing:true};
 let bytes=0,files=0,links=0,errors=0;
 function visit(file){try{const s=fs.lstatSync(file);if(s.isSymbolicLink()){links++;return;}if(s.isDirectory()){for(const e of fs.readdirSync(file))visit(path.join(file,e));}else{bytes+=s.size;files++;}}catch{errors++;}}
 visit(root);return {bytes,files,linksSkipped:links,readErrors:errors};
}
export function storageReport({base=testTempRoot(),docker=true}={}){
 const dirs=['node_modules','maxim/app/node_modules','maxim/app/.next','maxim/app/.cache','maxim/runtime/target','maxim/app/test-results','maxim/app/playwright-report'];
 const project=dirs.map(name=>({path:path.join(repoRoot,name),...measure(path.join(repoRoot,name))}));
 const fixtures=[];
 if(fs.existsSync(base)){
  try{validateTestRoot(base);for(const e of fs.readdirSync(base,{withFileTypes:true})){if(!e.isDirectory()||!e.name.startsWith('maxim-'))continue;const root=path.join(base,e.name);try{const m=fixtureMetadata(root);fixtures.push({path:root,pid:m.pid,active:processAlive(m.pid),container:m.container||null,...measure(root)});}catch{fixtures.push({path:root,status:'unverified_kept'});}}}catch(e){fixtures.push({status:'unverified_root_kept',error:e.message});}
 }
 let engine={available:false,status:'not_requested'};
 if(docker){const r=spawnSync('docker',['system','df','--format','json'],{encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:65536});engine=r.status===0?{available:true,summary:r.stdout.trim()}:{available:false,status:r.error?.code||'unresponsive'};}
 const external=[path.join(path.parse(repoRoot).root,'MaximApply-Browsers'),...(process.env.LOCALAPPDATA?[path.join(process.env.LOCALAPPDATA,'ms-playwright'),path.join(process.env.LOCALAPPDATA,'Docker/wsl/disk/docker_data.vhdx')]:[])].map(file=>({path:file,...measure(file),shared:file.includes('Docker')||file.includes('ms-playwright')}));
 return {asOf:new Date().toISOString(),project,external,headroom:storageHeadroom(),fixtureRoot:base,fixtures,ownedDockerRecords:dockerRecords(base).map(r=>({file:r.file,container:r.record?.containerName,active:r.record?processAlive(r.record.pid):null,unverified:r.unverified||false})),fixtureBytes:fixtures.reduce((n,x)=>n+(x.bytes||0),0),docker:engine,note:'No deletion. Links are not followed or double-counted. Shared browser caches and live/private database volumes are never cleanup candidates.'};
}
export function createCleanupPlan({base=testTempRoot(),now=Date.now()}={}){
 base=ensureTestRoot(base);const candidates=[],kept=[];
 for(const e of fs.readdirSync(base,{withFileTypes:true})){
  if(!e.isDirectory()||!e.name.startsWith('maxim-'))continue;
  const root=path.join(base,e.name);
  try{const m=fixtureMetadata(root);if(processAlive(m.pid)){kept.push({path:root,reason:'owner_running'});continue;}candidates.push({path:root,...directorySnapshot(root),container:m.container||null});}
  catch(e){kept.push({path:root,reason:'ownership_or_path_unverified'});}
 }
 const claimed=new Set(candidates.map(c=>c.container)),dockerCandidates=[];
 for(const r of dockerRecords(base)){if(r.unverified){kept.push({path:r.file,reason:'unverified_docker_record'});continue;}if(processAlive(r.record.pid)){kept.push({path:r.file,reason:'owner_running'});continue;}if(!claimed.has(r.record.containerName))dockerCandidates.push({path:r.file,container:r.record.containerName,fingerprint:r.fingerprint});}
 const plan={version:1,owner,repositoryId,id:crypto.randomUUID(),base,createdAt:now,expiresAt:now+86400000,candidates,dockerCandidates,kept};
 const directory=path.join(base,'storage-plans');assertPlainPath(directory);fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,plan.id+'.json');fs.writeFileSync(file,JSON.stringify(plan,null,2),{flag:'wx',mode:0o600});
 return {dryRun:true,planPath:file,reclaimableBytes:candidates.reduce((n,x)=>n+x.bytes,0),...plan};
}
export function applyCleanupPlan(file,{base=testTempRoot(),now=Date.now(),stopDatabase=stopTestDatabase,closeBrowsers=closeOwnedBrowsers}={}){
 base=validateTestRoot(base);file=assertPlainPath(file);
 if(path.dirname(file)!==path.join(base,'storage-plans')||! /^[a-f0-9-]{36}\.json$/.test(path.basename(file)))throw Error('Only a managed cleanup plan can be applied');
 const p=readSmallJson(file,1048576);
 if(p.version!==1||p.owner!==owner||p.repositoryId!==repositoryId||p.base!==base||p.id!==path.basename(file,'.json')||!Number.isFinite(p.createdAt)||!Number.isFinite(p.expiresAt)||p.expiresAt!==p.createdAt+86400000||p.expiresAt<now||p.createdAt>now||!Array.isArray(p.candidates)||p.candidates.length>1000)throw Error('Cleanup plan is invalid or expired');
 const result={deleted:[],deletedContainers:[],kept:[],reclaimedBytes:0};
 if(p.dockerCandidates!==undefined&&(!Array.isArray(p.dockerCandidates)||p.dockerCandidates.length>1000))throw Error('Invalid Docker cleanup plan');
 for(const c of p.candidates){
  try{
   if(path.dirname(path.resolve(c.path))!==base)throw Error('Cleanup target escaped the test root');
   const m=fixtureMetadata(c.path);if(processAlive(m.pid))throw Error('Fixture owner is running');
   const current=directorySnapshot(c.path);if(current.fingerprint!==c.fingerprint||current.bytes!==c.bytes||m.container!==(c.container||undefined))throw Error('Fixture changed after preview');
   let fingerprint=c.fingerprint;
   if(fs.existsSync(path.join(c.path,'browser-sessions'))){
    const fixed=directorySnapshot(c.path,{exclude:['browser-sessions']});closeBrowsers({privateRoot:c.path});
    if(directorySnapshot(c.path,{exclude:['browser-sessions']}).fingerprint!==fixed.fingerprint)throw Error('Non-browser fixture content changed during shutdown');
    fingerprint=directorySnapshot(c.path).fingerprint;
   }
   if(c.container)stopDatabase(c.container,{base});
   result.reclaimedBytes+=removeFixture(c.path,{fingerprint});result.deleted.push(c.path);
  }catch(e){result.kept.push({path:c.path,reason:e.message});}
 }
 for(const c of p.dockerCandidates||[]){
  try{const m=dockerResourceRecord(c.path,base);if(m.containerName!==c.container||processAlive(m.pid)||crypto.createHash('sha256').update(fs.readFileSync(c.path)).digest('hex')!==c.fingerprint)throw Error('Docker record changed or its owner is running');stopDatabase(c.container,{base});result.deletedContainers.push(c.container);}
  catch(e){result.kept.push({path:c.path,reason:e.message});}
 }
 if(!result.kept.length)fs.unlinkSync(file);
 return result;
}
