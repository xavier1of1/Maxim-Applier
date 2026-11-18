import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {repoRoot} from './path-utils.mjs';

export const owner='maxim-apply-tests';
export const repositoryId=crypto.createHash('sha256').update(fs.realpathSync(repoRoot).toLowerCase()).digest('hex');
export const markerName='.maxim-fixture.json';
export const rootMarker='.maxim-test-root.json';
export function assertPlainPath(target){
 const absolute=path.resolve(target);let cursor=absolute;
 for(let i=0;i<100;i++){
  if(fs.existsSync(cursor)&&fs.lstatSync(cursor).isSymbolicLink())throw Error('Linked storage paths are refused: '+cursor);
  const parent=path.dirname(cursor);if(parent===cursor)return absolute;cursor=parent;
 }
 throw Error('Storage path depth exceeded');
}
export function testTempRoot(){
 return path.resolve(process.env.MAXIM_TEST_TEMP_ROOT||(process.platform==='win32'?path.join(path.parse(repoRoot).root,'MaximApply-TestTemp'):path.join(os.tmpdir(),'MaximApply-TestTemp')));
}
export function validateTestRoot(base=testTempRoot(),create=false){
 base=assertPlainPath(base);
 const relative=path.relative(repoRoot,base),inside=relative===''||relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);
 if(base===path.parse(base).root||base===path.resolve(os.homedir())||inside||path.basename(base)!=='MaximApply-TestTemp')throw Error('Test root must be an external MaximApply-TestTemp directory');
 if(create)fs.mkdirSync(base,{recursive:true,mode:0o700});
 const file=path.join(base,rootMarker),expected={version:1,owner,repositoryId};
 if(fs.existsSync(file)){const value=readSmallJson(file);if(JSON.stringify(value)!==JSON.stringify(expected))throw Error('Test root belongs to another installation');}
 else if(create)fs.writeFileSync(file,JSON.stringify(expected),{flag:'wx',mode:0o600});
 else throw Error('Test root ownership is unverified');
 return base;
}
export const ensureTestRoot=(base=testTempRoot())=>validateTestRoot(base,true);
export function readSmallJson(file,limit=65536){
 assertPlainPath(file);if(fs.statSync(file).size>limit)throw Error('Storage marker is oversized');return JSON.parse(fs.readFileSync(file,'utf8'));
}
export function processAlive(pid){
 if(!Number.isSafeInteger(pid)||pid<=0)return false;
 try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}
}
export function createFixture(prefix='maxim-test-',base=ensureTestRoot()){
 if(!/^maxim-[a-z-]*-$/.test(prefix))throw Error('Invalid fixture prefix');
 base=ensureTestRoot(base);const root=fs.mkdtempSync(path.join(base,prefix));
 fs.writeFileSync(path.join(root,markerName),JSON.stringify({version:1,owner,repositoryId,pid:process.pid,createdAt:new Date().toISOString()}),{flag:'wx',mode:0o600});return root;
}
export function fixtureDirectory(t,prefix){
 const root=createFixture(prefix);t.after(()=>removeFixture(root,{allowCurrent:true}));return root;
}
export function fixtureMetadata(root){
 const absolute=assertPlainPath(root),base=path.dirname(absolute);
 validateTestRoot(base);
 if(!/^maxim-[a-z-]*[A-Za-z0-9]{6}$/.test(path.basename(absolute)))throw Error('Not a fixture directory');
 const m=readSmallJson(path.join(absolute,markerName));
 if(m.version!==1||m.owner!==owner||m.repositoryId!==repositoryId||!Number.isSafeInteger(m.pid)||m.pid<=0||!Number.isFinite(Date.parse(m.createdAt)))throw Error('Fixture ownership is unverified');
 return m;
}
export function directorySnapshot(root,{exclude=[]}={}){
 root=assertPlainPath(root);let bytes=0,count=0;const entries=[];
 function visit(dir){
  for(const e of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
   if(++count>100000)throw Error('Storage inventory bound exceeded');
   const file=path.join(dir,e.name),relative=path.relative(root,file);if(exclude.some(x=>relative===x||relative.startsWith(x+path.sep)))continue;
   const s=fs.lstatSync(file);
   if(s.isSymbolicLink())throw Error('Linked fixture contents are refused');
   if(s.isFile()&&s.size>128*1024*1024)throw Error('Fixture file exceeds the cleanup hashing bound');
   entries.push([path.relative(root,file),s.size,s.mtimeMs,s.isDirectory(),s.isFile()?crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'):null]);
   if(s.isDirectory())visit(file);else if(s.isFile())bytes+=s.size;else throw Error('Special files are refused');
  }
 }
 visit(root);return {bytes,files:count,fingerprint:crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex')};
}
export function removeFixture(root,{allowCurrent=false,fingerprint}={}){
 const m=fixtureMetadata(root);
 if(processAlive(m.pid)&&!(allowCurrent&&m.pid===process.pid))throw Error('Fixture owner is still running');
 const snapshot=directorySnapshot(root);if(fingerprint&&fingerprint!==snapshot.fingerprint)throw Error('Fixture changed after preview');
 fs.rmSync(path.resolve(root),{recursive:true,force:false,maxRetries:10,retryDelay:200});return snapshot.bytes;
}
export function testStorageEnv(){
 const base=ensureTestRoot();return {...process.env,...browserStorageEnv(),TEMP:base,TMP:base,TMPDIR:base,NODE_COMPILE_CACHE:path.join(base,'node-compile-cache')};
}
export function storageHeadroom(){
 const roots=new Map([[path.parse(testTempRoot()).root,2*1024**3]]);
 if(process.platform==='win32'&&process.env.LOCALAPPDATA){
  const disk=path.join(process.env.LOCALAPPDATA,'Docker/wsl/disk/docker_data.vhdx');
  if(fs.existsSync(disk)){const root=path.parse(fs.realpathSync(disk)).root;roots.set(root,Math.max(roots.get(root)||0,10*1024**3));}
 }
 return [...roots].map(([root,minimumBytes])=>{const s=fs.statfsSync(root);return {root,minimumBytes,availableBytes:s.bavail*s.bsize};});
}
export function assertStorageHeadroom(rows=storageHeadroom()){
 for(const row of rows)if(row.availableBytes<row.minimumBytes)throw Error('Insufficient test storage on '+row.root+': free disk before starting another database fixture');
 return rows;
}
export function browserStorageEnv(){
 const base=path.join(path.parse(repoRoot).root,'MaximApply-Browsers'),marker=path.join(base,'.maxim-browser-cache.json');
 if(process.platform!=='win32'||!fs.existsSync(marker))return {};
 const m=readSmallJson(marker);if(m.version!==1||m.owner!=='maxim-apply-browser-cache')throw Error('Browser cache ownership is unverified');
 return {PLAYWRIGHT_BROWSERS_PATH:assertPlainPath(path.join(base,'playwright'))};
}
export async function cleanupTasks(tasks){
 const errors=[];for(const task of tasks)try{await task();}catch(e){errors.push(e);}
 if(errors.length)throw new AggregateError(errors,'Some test resources could not be released; inspect owned leftovers');
}
function fixtureContainer(name){if(!/^maxim-test-[a-f0-9-]{36}$/.test(name))throw Error('Unsafe test container identity');return name;}
function updateDockerRecord(file,value){
 const temporary=file+'.'+crypto.randomUUID()+'.new';
 try{fs.writeFileSync(temporary,JSON.stringify(value),{flag:'wx',mode:0o600});fs.renameSync(temporary,file);}
 finally{fs.rmSync(temporary,{force:true});}
}
export function dockerResourceRecord(file,base=testTempRoot()){
 base=validateTestRoot(base);file=assertPlainPath(file);
 if(path.dirname(file)!==path.join(base,'docker-resources'))throw Error('Docker record escaped the test root');
 const m=readSmallJson(file);fixtureContainer(m.containerName);
 if(path.basename(file)!==m.containerName+'.json'||m.owner!==owner||m.repositoryId!==repositoryId||m.version!==1||!Number.isSafeInteger(m.pid)||m.pid<=0||!Array.isArray(m.volumes)||m.volumes.length>32||m.volumes.some(v=>!/^[a-f0-9]{64}$/.test(v)))throw Error('Docker record ownership is unverified');
 return m;
}
export function startTestDatabase(c,image='postgres:18.1',{execute=execFileSync,checkSpace=assertStorageHeadroom}={}){
 const name=fixtureContainer(c.testContainer),u=new URL(c.databaseUrl);
 if(!c.testMode||!/^\/maxim_test_[a-z0-9_]+$/.test(u.pathname)||u.hostname!=='127.0.0.1'||!/^postgres:18\.1(?:-alpine)?$/.test(image))throw Error('Unsafe test database');
 checkSpace();
 const m=fixtureMetadata(c.privateRoot);
 fs.writeFileSync(path.join(c.privateRoot,markerName),JSON.stringify({...m,container:name}),{mode:0o600});
 const records=path.join(path.dirname(c.privateRoot),'docker-resources');assertPlainPath(records);fs.mkdirSync(records,{recursive:true,mode:0o700});
 const file=path.join(records,name+'.json'),record={...m,containerName:name,volumes:[]};fs.writeFileSync(file,JSON.stringify(record),{flag:'wx',mode:0o600});
 execute('docker',['run','--detach','--rm','--name',name,'--label','maxim.resource=test','--label','maxim.repository='+repositoryId,'--label','maxim.owner-pid='+process.pid,'--log-driver','local','--log-opt','max-size=5m','--log-opt','max-file=2','-e','POSTGRES_PASSWORD','-e','POSTGRES_USER=maxim','-e','POSTGRES_DB='+u.pathname.slice(1),'-p','127.0.0.1:'+u.port+':5432',image],{env:{...process.env,POSTGRES_PASSWORD:decodeURIComponent(u.password)},stdio:'pipe',windowsHide:true,timeout:90000});
 const mounts=JSON.parse(execute('docker',['inspect','--format','{{json .Mounts}}',name],{encoding:'utf8',windowsHide:true,timeout:15000}));
 record.volumes=mounts.filter(m=>m.Type==='volume').map(m=>m.Name);if(record.volumes.some(v=>!/^[a-f0-9]{64}$/.test(v)))throw Error('Unexpected named fixture volume');
 updateDockerRecord(file,record);
}
export function stopTestDatabase(name,{execute=execFileSync,base=testTempRoot()}={}){
 fixtureContainer(name);
 const file=path.join(base,'docker-resources',name+'.json'),record=fs.existsSync(file)?dockerResourceRecord(file,base):null;
 if(record&&record.pid!==process.pid&&processAlive(record.pid))throw Error('Another test process still owns this record');
 const forget=()=>{if(record)fs.unlinkSync(file);};
 let raw;try{raw=execute('docker',['inspect','--format','{{json .Config.Labels}}',name],{encoding:'utf8',stdio:'pipe',windowsHide:true,timeout:15000});}
 catch(e){if(/No such (?:object|container)/i.test(String(e.stderr||''))){
   if(record)for(const volume of record.volumes){const names=String(execute('docker',['volume','ls','--filter','name=^'+volume+'$','--format','{{.Name}}'],{encoding:'utf8',windowsHide:true,timeout:15000})).trim();if(names===volume)execute('docker',['volume','rm',volume],{stdio:'pipe',windowsHide:true,timeout:15000});}
   forget();return;
  }throw Error('Docker cleanup could not verify the owned test container');}
 const labels=JSON.parse(raw);
 if(labels['maxim.resource']!=='test'||labels['maxim.repository']!==repositoryId)throw Error('Unverified test container; deletion refused');
 const pid=Number(labels['maxim.owner-pid']);if(!Number.isSafeInteger(pid)||pid<=0||pid!==process.pid&&processAlive(pid))throw Error('Another test process still owns this container');
 execute('docker',['rm','--force','--volumes',name],{stdio:'pipe',windowsHide:true,timeout:15000});
 forget();
}
