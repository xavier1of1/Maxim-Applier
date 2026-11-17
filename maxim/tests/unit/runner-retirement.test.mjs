import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fromRoot} from '../../lib/path-utils.mjs';
test('rejected runner has no package registration, importable mapper or browser executor',()=>{
 const pkg=JSON.parse(fs.readFileSync(fromRoot('package.json'),'utf8'));
 assert.equal(pkg.scripts['maxim:auto-apply'],undefined);assert.equal(pkg.scripts['maxim:auto-apply-browser'],undefined);
 for(const file of ['auto-apply-planner.mjs','application-form-mapper.mjs'])assert.equal(fs.existsSync(fromRoot('maxim/lib',file)),false);
 for(const file of ['auto-apply.mjs','auto-apply-browser.mjs']){
  const result=spawnSync(process.execPath,[fromRoot('maxim/scripts',file),'assist','example'],{encoding:'utf8'});
  assert.equal(result.status,1);assert.match(result.stderr,/retired/);assert.doesNotMatch(fs.readFileSync(fromRoot('maxim/scripts',file),'utf8'),/import |chromium|playwright/);
 }
 const cases=JSON.parse(fs.readFileSync(fromRoot('maxim/tests/fixtures/browser-safety-handoff.json'),'utf8'));assert.ok(cases.cases.length>=12);
});
