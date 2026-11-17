import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {beginLegacyApplicationWrite,withLegacyApplicationWrite,isManagedApplicationArtifact} from '../../lib/application-write-gate.mjs';
import {readApplicationProjection} from '../../lib/canonical-application-read.mjs';
const fixture=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'maxim-authority-'));fs.mkdirSync(path.join(dir,'data/maxim'),{recursive:true});t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};
test('legacy writes are reentrant but frozen/canonical/corrupt markers never fall back',t=>{
 const root=fixture(t),marker=path.join(root,'data/maxim/authority.json');
 withLegacyApplicationWrite(()=>withLegacyApplicationWrite(()=>assert.ok(true),root),root);
 assert.equal(fs.existsSync(path.join(root,'data/maxim/application-write.lock')),false);
 for(const applications of ['frozen','canonical']){fs.writeFileSync(marker,JSON.stringify({applications}));assert.throws(()=>beginLegacyApplicationWrite(root),new RegExp(applications));}
 fs.writeFileSync(marker,'not-json');assert.throws(()=>beginLegacyApplicationWrite(root),/unreadable/);
});
test('canonical reads require exact projection hashes and revisions',t=>{
 const root=fixture(t),relative='data/maxim/canonical-application-state.json',file=path.join(root,relative),marker=path.join(root,'data/maxim/authority.json');
 const text=JSON.stringify({ownership:'canonical',revision:3,asOf:'2026-11-17',applications:[]});
 fs.writeFileSync(file,text);fs.writeFileSync(marker,JSON.stringify({applications:'canonical',applicationRevision:3,applicationFiles:{[relative]:crypto.createHash('sha256').update(text).digest('hex')}}));
 const result=readApplicationProjection(root);assert.equal(result.revision,3);assert.equal(result.offlineProjection,true);assert.equal(result.freshness,'as_of_projection_not_live_database');
 fs.appendFileSync(file,' ');assert.throws(()=>readApplicationProjection(root),/integrity/);
 fs.writeFileSync(marker,JSON.stringify({applications:'frozen'}));assert.throws(()=>readApplicationProjection(root),/frozen/);
});
test('Windows case and junction aliases cannot turn managed artifacts into private output',t=>{
 const root=fixture(t);fs.mkdirSync(path.join(root,'output'));
 assert.equal(isManagedApplicationArtifact(path.join(root,'output','resume.pdf'),root),true);
 if(process.platform==='win32'){
  assert.equal(isManagedApplicationArtifact(path.join(root,'OUTPUT','resume.pdf'),root),true);
  fs.symlinkSync(path.join(root,'output'),path.join(root,'alias'),'junction');
  assert.equal(isManagedApplicationArtifact(path.join(root,'alias','resume.pdf'),root),true);
 }
 assert.equal(isManagedApplicationArtifact(path.join(root,'private','resume.pdf'),root),false);
});
