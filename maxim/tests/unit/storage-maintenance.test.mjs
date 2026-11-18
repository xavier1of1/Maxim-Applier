import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {fixtureDirectory,createFixture,markerName,cleanupTasks,ensureTestRoot,removeFixture,startTestDatabase,stopTestDatabase,repositoryId,assertStorageHeadroom,fixtureMetadata} from '../../lib/test-resources.mjs';
import {createCleanupPlan,applyCleanupPlan,storageReport} from '../../lib/storage-maintenance.mjs';

const moduleUrl=new URL('../../lib/test-resources.mjs',import.meta.url).href;
test('database work refuses insufficient disk headroom before creating resources',()=>{
 assert.throws(()=>assertStorageHeadroom([{root:'synthetic-drive',minimumBytes:100,availableBytes:99}]),/Insufficient/);
 assert.equal(assertStorageHeadroom([{root:'synthetic-drive',minimumBytes:100,availableBytes:100}]).length,1);
});
function scope(t){const outer=fixtureDirectory(t,'maxim-storage-check-');const base=ensureTestRoot(path.join(outer,'MaximApply-TestTemp'));return {outer,base};}
function abandoned(base){
 const source=`import {createFixture} from ${JSON.stringify(moduleUrl)};import fs from 'node:fs';const dir=createFixture('maxim-interrupted-');fs.writeFileSync(dir+'/synthetic.txt','test bytes');console.log(dir);process.exit(23);`;
 const r=spawnSync(process.execPath,['--input-type=module','-e',source],{env:{...process.env,MAXIM_TEST_TEMP_ROOT:base},encoding:'utf8',windowsHide:true});
 assert.equal(r.status,23,r.stderr);return r.stdout.trim();
}
test('three cleanup cycles are preview-only until applied and leave no orphan fixtures',t=>{
 const {base}=scope(t);
 for(let i=0;i<3;i++){
  const root=abandoned(base),plan=createCleanupPlan({base});assert.ok(fs.existsSync(root));assert.equal(plan.candidates.length,1);
  const result=applyCleanupPlan(plan.planPath,{base});assert.equal(result.deleted.length,1);assert.equal(result.kept.length,0);assert.ok(!fs.existsSync(root));assert.ok(!fs.existsSync(plan.planPath));
  assert.equal(storageReport({base,docker:false}).fixtures.length,0);
 }
});
test('active owner, unknown folder and changed fixture are never deleted',t=>{
 const {base}=scope(t),active=createFixture('maxim-active-',base),unknown=path.join(base,'maxim-unknown-Abc123');fs.mkdirSync(unknown);
 const root=abandoned(base),plan=createCleanupPlan({base});assert.equal(plan.candidates.length,1);
 fs.writeFileSync(path.join(root,'changed.txt'),'changed after preview');const result=applyCleanupPlan(plan.planPath,{base});
 assert.equal(result.deleted.length,0);assert.equal(result.kept.length,1);assert.ok(fs.existsSync(active)&&fs.existsSync(unknown)&&fs.existsSync(root));
 removeFixture(active,{allowCurrent:true});
});
test('tampered plan cannot escape its root, delete a live folder or call Docker',t=>{
 const {base,outer}=scope(t),root=abandoned(base),plan=createCleanupPlan({base});
 const raw=JSON.parse(fs.readFileSync(plan.planPath));raw.candidates[0].path=outer;raw.candidates[0].container='maxim-test-'+crypto.randomUUID();fs.writeFileSync(plan.planPath,JSON.stringify(raw));
 let calls=0;const result=applyCleanupPlan(plan.planPath,{base,stopDatabase:()=>calls++});assert.equal(result.deleted.length,0);assert.equal(calls,0);assert.ok(fs.existsSync(root));
});
test('symbolic links and junctions are refused without touching their targets',t=>{
 const {base,outer}=scope(t),root=abandoned(base),target=path.join(outer,'keep');fs.mkdirSync(target);fs.writeFileSync(path.join(target,'data.txt'),'not disposable');
 const link=path.join(root,'linked');fs.symlinkSync(target,link,process.platform==='win32'?'junction':'dir');
 try{const plan=createCleanupPlan({base});assert.equal(plan.candidates.length,0);assert.match(plan.kept[0].reason,/unverified/);assert.equal(fs.readFileSync(path.join(target,'data.txt'),'utf8'),'not disposable');}finally{fs.unlinkSync(link);}
});
test('cleanup still attempts every resource when an earlier shutdown fails',async()=>{
 const calls=[];await assert.rejects(()=>cleanupTasks([()=>{calls.push('database');throw Error('offline');},()=>{calls.push('files');},()=>{calls.push('server');}]),AggregateError);assert.deepEqual(calls,['database','files','server']);
});
test('expired plans are rejected before deleting any data',t=>{
 const {base}=scope(t),root=abandoned(base),plan=createCleanupPlan({base,now:1000});assert.throws(()=>applyCleanupPlan(plan.planPath,{base,now:86402000}),/expired/);assert.ok(fs.existsSync(root));
});
test('test Docker uses bounded owned resources and never deletes an unlabeled container',t=>{
 const {base}=scope(t),root=createFixture('maxim-docker-check-',base),name='maxim-test-'+crypto.randomUUID(),calls=[];
 startTestDatabase({testMode:true,testContainer:name,privateRoot:root,databaseUrl:'postgresql://maxim:synthetic@127.0.0.1:12345/maxim_test_check'},'postgres:18.1',{execute:(_cmd,args)=>{calls.push(args);return args[0]==='inspect'?'[]':'';},checkSpace:()=>{}});
 assert.ok(calls[0].includes('--rm'));assert.ok(calls[0].includes('max-size=5m'));assert.ok(calls[0].includes('maxim.resource=test'));
 const execute=(_cmd,args)=>{calls.push(args);return args[0]==='inspect'?JSON.stringify({'maxim.resource':'test','maxim.repository':repositoryId,'maxim.owner-pid':String(process.pid)}):'';};
 stopTestDatabase(name,{execute,base});assert.deepEqual(calls.at(-1),['rm','--force','--volumes',name]);assert.ok(!fs.existsSync(path.join(base,'docker-resources',name+'.json')));
 assert.throws(()=>stopTestDatabase(name,{execute:()=>JSON.stringify({})}),/Unverified/);
 assert.throws(()=>stopTestDatabase('maxim-workspace-database-1',{execute}),/Unsafe/);
 removeFixture(root,{allowCurrent:true});
});
test('independent Docker records remain cleanable after the scratch directory is already gone',t=>{
 const {base}=scope(t),root=abandoned(base),m=fixtureMetadata(root),name='maxim-test-'+crypto.randomUUID();
 const dir=path.join(base,'docker-resources');fs.mkdirSync(dir);const file=path.join(dir,name+'.json');fs.writeFileSync(file,JSON.stringify({...m,containerName:name,volumes:[]}));removeFixture(root);
 const plan=createCleanupPlan({base});assert.equal(plan.candidates.length,0);assert.equal(plan.dockerCandidates.length,1);
 let stopped=false;const result=applyCleanupPlan(plan.planPath,{base,stopDatabase:(container)=>{assert.equal(container,name);stopped=true;fs.unlinkSync(file);}});
 assert.ok(stopped);assert.deepEqual(result.deletedContainers,[name]);assert.equal(result.kept.length,0);
});
test('same-size content changes are rejected even if timestamps are restored',t=>{
 const {base}=scope(t),root=abandoned(base),file=path.join(root,'synthetic.txt'),s=fs.statSync(file),plan=createCleanupPlan({base});
 fs.writeFileSync(file,'changed!!!');fs.utimesSync(file,s.atime,s.mtime);
 const r=applyCleanupPlan(plan.planPath,{base});assert.equal(r.deleted.length,0);assert.ok(fs.existsSync(root));
});
test('a genuinely failing test releases its scratch database through the registered hook',t=>{
 const {outer,base}=scope(t),file=path.join(outer,'deliberate-failure.test.mjs');
 fs.writeFileSync(file,`import test from 'node:test';import assert from 'node:assert/strict';import {fixtureDirectory} from ${JSON.stringify(moduleUrl)};test('deliberate failure fixture',t=>{const dir=fixtureDirectory(t,'maxim-failing-');console.log('ROOT '+dir);assert.fail('expected fixture failure');});`);
 const env={...process.env,MAXIM_TEST_TEMP_ROOT:base};delete env.NODE_TEST_CONTEXT;
 const r=spawnSync(process.execPath,['--test',file],{env,encoding:'utf8',windowsHide:true});assert.equal(r.status,1,r.stdout+r.stderr);
 const dir=r.stdout.match(/ROOT (.+)/)?.[1]?.trim();assert.ok(dir,r.stdout);assert.ok(!fs.existsSync(dir),'teardown must run despite the failed assertion');
});
test('abandoned owned browsers are closed before their fixture can be removed',t=>{
 const {base}=scope(t),root=abandoned(base),dir=path.join(root,'browser-sessions');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'synthetic.pid'),'test');
 const plan=createCleanupPlan({base});let closed=false;
 const r=applyCleanupPlan(plan.planPath,{base,closeBrowsers:()=>{closed=true;fs.unlinkSync(path.join(dir,'synthetic.pid'));}});
 assert.ok(closed);assert.equal(r.deleted.length,1);assert.ok(!fs.existsSync(root));
});
test('failed browser shutdown preserves its recovery records and can be retried',t=>{
 const {base}=scope(t),root=abandoned(base),dir=path.join(root,'browser-sessions');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'synthetic.pid'),'test');
 const plan=createCleanupPlan({base});
 const failed=applyCleanupPlan(plan.planPath,{base,closeBrowsers:()=>{throw Error('browser unavailable');}});
 assert.equal(failed.deleted.length,0);assert.match(failed.kept[0].reason,/browser unavailable/);assert.ok(fs.existsSync(path.join(dir,'synthetic.pid')));assert.ok(fs.existsSync(plan.planPath));
 const retried=applyCleanupPlan(plan.planPath,{base,closeBrowsers:()=>fs.unlinkSync(path.join(dir,'synthetic.pid'))});
 assert.equal(retried.deleted.length,1);assert.equal(retried.kept.length,0);assert.ok(!fs.existsSync(root));
});
