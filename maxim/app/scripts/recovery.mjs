import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { snapshotDatabase,restoreDatabase,sha } from './environment.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const hash=/^[0-9a-f]{64}$/;
const journalPath=/^[0-9a-f-]{36}\/(?:manifest\.json|rollback-(?:facts|state|ids)\.json|(?:baseline|projection)\/(?:cv\.md|config\/profile\.yml|modes\/_profile\.md|article-digest\.md|applications\.md|data\/(?:applications\.md|pipeline\.md|maxim\/(?:dashboard-state\.json|canonical-application-state\.json|canonical-events\.jsonl))|(?:reports|output)\/\d+-maxim-[0-9a-f-]{36}\.(?:md|pdf)))$/;
function journalFile(root,relative){
 if(!journalPath.test(relative))throw Error('Invalid cutover recovery reference.');
 return path.join(root,...relative.split('/'));
}
function regular(file,root){
 const resolved=fs.realpathSync(file);
 if(!resolved.startsWith(fs.realpathSync(root)+path.sep)||fs.lstatSync(file).isSymbolicLink()||!fs.statSync(file).isFile())throw Error('Unsafe recovery file.');
 return resolved;
}
export async function backupWorkspace(c){
 const client=new pg.Client({connectionString:c.databaseUrl});await client.connect();
 try{
  // Uploads share this lock until metadata commits. Files are immutable after commit.
  await client.query('SELECT pg_advisory_lock(120032)');
  const id='workspace-'+Date.now(),root=path.join(c.privateRoot,'backups',id);
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  const entries=(await client.query('SELECT id,storage_key AS key,content_hash AS hash,bytes FROM artifacts WHERE deleted_at IS NULL ORDER BY id')).rows;
  const databaseHash=snapshotDatabase(c,path.join(root,'database.sql'));
  const journals=[],cutovers=path.join(c.privateRoot,'cutovers');
  const transitions=(await client.query("SELECT id,family FROM ownership_transitions WHERE family IN ('candidate','applications') ORDER BY id")).rows;
  const names=['manifest.json','rollback-facts.json',...['baseline','projection'].flatMap(prefix=>['cv.md','config/profile.yml','modes/_profile.md','article-digest.md'].map(file=>prefix+'/'+file))];
  for(const transition of transitions){
   let selected=names;
   if(transition.family==='applications'){
    const manifestFile=journalFile(cutovers,transition.id+'/manifest.json');
    const manifest=JSON.parse(fs.readFileSync(regular(manifestFile,cutovers),'utf8'));
    selected=['manifest.json','rollback-state.json','rollback-ids.json',...['baseline','projection'].flatMap(prefix=>Object.keys(manifest.projection||{}).map(file=>prefix+'/'+file))];
   }
   for(const name of [...new Set(selected)]){
   const relative=transition.id+'/'+name,source=journalFile(cutovers,relative);
   if(!fs.existsSync(source))continue;
   const bytes=fs.readFileSync(regular(source,cutovers)),target=journalFile(path.join(root,'cutovers'),relative);
   fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});
   fs.writeFileSync(target,bytes,{flag:'wx',mode:0o600});
   journals.push({path:relative,hash:sha(bytes),bytes:bytes.length});
  }
  }
  const artifacts=path.join(c.privateRoot,'artifacts');
  for(const e of entries){
   if(!uuid.test(e.key)||!hash.test(e.hash))throw Error('Invalid artifact metadata.');
   const source=regular(path.join(artifacts,e.key),artifacts),bytes=fs.readFileSync(source);
   if(sha(bytes)!==e.hash||bytes.length!==Number(e.bytes))throw Error('Source artifact integrity check failed.');
   fs.mkdirSync(path.join(root,'artifacts'),{recursive:true,mode:0o700});
   fs.writeFileSync(path.join(root,'artifacts',e.key),bytes,{flag:'wx',mode:0o600});
  }
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify({version:3,databaseHash,entries,journals},null,2),{flag:'wx',mode:0o600});
  return {backupId:id,artifacts:entries.length,cutoverFiles:journals.length,credentialsExcluded:true};
 }finally{await client.query('SELECT pg_advisory_unlock(120032)').catch(()=>{});await client.end();}
}
export async function restoreWorkspace(c,id){
 if(!/^workspace-\d+$/.test(id||''))throw Error('Choose a valid private workspace backup ID.');
 const root=path.join(c.privateRoot,'backups',id);
 const manifest=JSON.parse(fs.readFileSync(regular(path.join(root,'manifest.json'),root),'utf8'));
 if(![1,2,3].includes(manifest.version)||!hash.test(manifest.databaseHash)||!Array.isArray(manifest.entries)||manifest.entries.length>100000)throw Error('Invalid recovery manifest.');
 const journals=manifest.version>=2?manifest.journals:[];
 if(!Array.isArray(journals)||journals.length>100000)throw Error('Invalid cutover recovery manifest.');
 const journalKeys=new Set();
 for(const e of journals){
  if(!hash.test(e.hash)||journalKeys.has(e.path))throw Error('Invalid cutover recovery reference.');
  journalKeys.add(e.path);
  const bytes=fs.readFileSync(regular(journalFile(path.join(root,'cutovers'),e.path),root));
  if(sha(bytes)!==e.hash||bytes.length!==e.bytes)throw Error('Cutover backup integrity check failed.');
 }
 const dump=fs.readFileSync(regular(path.join(root,'database.sql'),root));
 if(sha(dump)!==manifest.databaseHash)throw Error('Database backup integrity check failed.');
 const keys=new Set();
 for(const e of manifest.entries){
  if(!uuid.test(e.key)||keys.has(e.key)||!hash.test(e.hash))throw Error('Invalid artifact recovery reference.');
  keys.add(e.key);
  const bytes=fs.readFileSync(regular(path.join(root,'artifacts',e.key),root));
  if(sha(bytes)!==e.hash||bytes.length!==Number(e.bytes))throw Error('Artifact backup integrity check failed.');
 }
 const name=(c.testMode?'maxim_test_restore_':'maxim_restore_')+Date.now();
 const counts=await restoreDatabase(c,dump,name),url=new URL(c.databaseUrl);url.pathname='/'+name;
 const client=new pg.Client({connectionString:url.toString()});await client.connect();
 try{
  const metadata=(await client.query('SELECT id,storage_key AS key,content_hash AS hash,bytes FROM artifacts WHERE deleted_at IS NULL ORDER BY id')).rows;
  if(JSON.stringify(metadata)!==JSON.stringify(manifest.entries))throw Error('Database and artifact backup references disagree.');
 }finally{await client.end();}
 const target=path.join(c.privateRoot,'recoveries',name,'artifacts');
 fs.mkdirSync(target,{recursive:true,mode:0o700});
 for(const e of manifest.entries)fs.copyFileSync(path.join(root,'artifacts',e.key),path.join(target,e.key),fs.constants.COPYFILE_EXCL);
 for(const e of journals){
  const targetFile=journalFile(path.join(c.privateRoot,'recoveries',name,'cutovers'),e.path);
  fs.mkdirSync(path.dirname(targetFile),{recursive:true,mode:0o700});
  fs.copyFileSync(journalFile(path.join(root,'cutovers'),e.path),targetFile,fs.constants.COPYFILE_EXCL);
 }
 return {recoveryDatabase:name,...counts,artifacts:manifest.entries.length,cutoverFiles:journals.length,originalsUnchanged:true};
}
