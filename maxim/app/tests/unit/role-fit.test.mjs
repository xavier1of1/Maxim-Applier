import test from 'node:test';
import assert from 'node:assert/strict';
import {currentScore,fitLabel,sortRoles,roleSort} from '../../src/components/maxim/role-fit.ts';
const fit=(score,current=true,status='completed')=>({score,current,status,tier:score>=4.5?'T3':'T2'});
test('only finite, current Career-Ops scores rank; missing or stale is not zero',()=>{
 assert.equal(currentScore(fit(4.6)),4.6);
 for(const value of [null,undefined,fit(4.9,false),fit(null),fit(NaN),fit('4.8'),fit(6),fit(0)])assert.equal(currentScore(value),null);
 assert.equal(fitLabel(fit(4.6)).label,'4.6/5 / T3');
 assert.equal(fitLabel(null).label,'Not evaluated');
 assert.equal(fitLabel(fit(4.9,false)).label,'Re-evaluation needed');
 for(const [status,label] of [['queued','Evaluation queued'],['running','Evaluating'],['failed','Evaluation failed'],['cancelled','Evaluation cancelled'],['review_required','Evaluation needs review']])assert.equal(fitLabel(fit(null,false,status)).label,label);
});
test('score order is numeric, unknown last in both directions, stable and never company-spread',()=>{
 const rows=[{id:'a',company:'A',fit:fit(4.9)},{id:'b',company:'A',fit:fit(4.6)},{id:'c',company:'B',fit:fit(4.2)},{id:'d',company:'B',fit:fit(5,false)},{id:'e',company:'A'}];
 assert.deepEqual(sortRoles(rows,'score_desc').map(j=>j.id),['a','b','c','d','e']);
 assert.deepEqual(sortRoles(rows,'score_asc').map(j=>j.id),['c','b','a','d','e']);
 assert.deepEqual(rows.map(j=>j.id),['a','b','c','d','e']);
 assert.deepEqual(sortRoles([{id:'b',company:'Z',updated_at:'2026-11-20'},{id:'a',company:'A',updated_at:'2026-11-19'}],'recent').map(j=>j.id),['b','a']);
 assert.deepEqual(sortRoles(rows,'company').map(j=>j.id),['a','b','e','c','d']);
 assert.equal(roleSort('invalid'),'score_desc');
});
