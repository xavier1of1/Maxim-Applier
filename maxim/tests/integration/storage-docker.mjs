import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {createFixture,removeFixture,startTestDatabase,stopTestDatabase,cleanupTasks,fixtureDirectory,ensureTestRoot} from '../../lib/test-resources.mjs';
import {createCleanupPlan,applyCleanupPlan} from '../../lib/storage-maintenance.mjs';

const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:'pipe',windowsHide:true,timeout:15000}).trim();
const volumes=()=>new Set(docker(['volume','ls','--format','{{.Name}}']).split('\n').filter(Boolean));
test('three actual PostgreSQL fixture cycles leave no test container, anonymous volume or directory',{timeout:180000},async t=>{
 const before=volumes();
 for(let i=0;i<3;i++){
  const root=createFixture('maxim-storage-docker-'),id=crypto.randomUUID(),name='maxim-test-'+id,db='maxim_test_'+id.replaceAll('-','');let mounted=[];
  try{
   startTestDatabase({testMode:true,testContainer:name,privateRoot:root,databaseUrl:'postgresql://maxim:synthetic-storage-only@127.0.0.1:0/'+db});
   mounted=JSON.parse(docker(['inspect','--format','{{json .Mounts}}',name])).filter(m=>m.Type==='volume').map(m=>m.Name);assert.ok(mounted.length);
   let ready=false;const deadline=Date.now()+30000;for(let n=0;n<60&&Date.now()<deadline;n++){try{ready=docker(['exec',name,'psql','-X','-tA','-U','maxim','-d',db,'-c','SELECT current_database()'])===db;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert.ok(ready,'real fixture database becomes queryable');
  }finally{await cleanupTasks([()=>stopTestDatabase(name),()=>removeFixture(root,{allowCurrent:true})]);}
  const after=volumes();for(const volume of mounted)assert.ok(!after.has(volume),'anonymous fixture volume must be removed');
  assert.ok(!fs.existsSync(root));assert.ok(!docker(['ps','-a','--filter','name='+name,'--format','{{.Names}}']));
  t.diagnostic(JSON.stringify({cycle:i+1,fixtureVolumesRemoved:mounted.length,globalVolumeCount:after.size,baselineVolumeCount:before.size}));
 }
});
test('an interrupted owner is recoverable even after filesystem cleanup ran',{timeout:120000},t=>{
 const outer=fixtureDirectory(t,'maxim-storage-interruption-'),base=ensureTestRoot(path.join(outer,'MaximApply-TestTemp'));
 const moduleUrl=new URL('../../lib/test-resources.mjs',import.meta.url).href,id=crypto.randomUUID(),name='maxim-test-'+id;
 const code=`import {createFixture,removeFixture,startTestDatabase} from ${JSON.stringify(moduleUrl)};const root=createFixture('maxim-interrupted-docker-');startTestDatabase({testMode:true,testContainer:${JSON.stringify(name)},privateRoot:root,databaseUrl:${JSON.stringify('postgresql://maxim:synthetic-storage-only@127.0.0.1:0/maxim_test_'+id.replaceAll('-',''))}});removeFixture(root,{allowCurrent:true});console.log('interrupted');process.exit(23);`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{env:{...process.env,MAXIM_TEST_TEMP_ROOT:base},encoding:'utf8',windowsHide:true,timeout:100000});
 try{
  assert.equal(child.status,23,child.stderr);assert.equal(docker(['ps','-a','--filter','name='+name,'--format','{{.Names}}']),name);
  const mounted=JSON.parse(docker(['inspect','--format','{{json .Mounts}}',name])).filter(m=>m.Type==='volume').map(m=>m.Name);
  const plan=createCleanupPlan({base});assert.equal(plan.candidates.length,0);assert.equal(plan.dockerCandidates.length,1);
  const result=applyCleanupPlan(plan.planPath,{base});assert.deepEqual(result.deletedContainers,[name]);assert.equal(result.kept.length,0);
  const after=volumes();for(const volume of mounted)assert.ok(!after.has(volume));
 }finally{stopTestDatabase(name,{base});}
});
