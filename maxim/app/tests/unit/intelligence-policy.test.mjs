import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,intelligenceSchema,intelligencePatch} from '../../src/server/intelligence-policy.ts';
test('discovery intelligence defaults are finite and never authorize spend or pruning',()=>{
 const p=defaults();assert.equal(p.maxActiveJobs,200);assert.equal(p.dailyBudgetCents,0);
 for(const key of ['autoScan','autoScore','cleanupEnabled'])assert.equal(p[key],false);
 assert.equal(p.evaluationsPerCycle,5);assert.equal(p.sourceIds.length,0);
});
test('patches never reset omitted automation, prices, pools or budgets to creation defaults',()=>{
 assert.deepEqual(intelligencePatch.parse({maxActiveJobs:100}),{maxActiveJobs:100});assert.deepEqual(intelligencePatch.parse({}),{});
 const prior={...defaults(),autoScan:true,dailyBudgetCents:500,terms:['Software']};const next=intelligenceSchema.parse({...prior,...intelligencePatch.parse({maxActiveJobs:100})});assert.equal(next.autoScan,true);assert.equal(next.dailyBudgetCents,500);assert.deepEqual(next.terms,['Software']);
});
test('policy bounds and unknown keys fail instead of enabling unbounded work',()=>{
 for(const p of [{maxActiveJobs:0},{maxActiveJobs:2001},{evaluationsPerCycle:21},{sourcesPerCycle:4},{scanIntervalMinutes:0},{rawRetentionDays:0},{dailyBudgetCents:-1},{timezone:'not/a-zone'},{timezone:'+03:00'},{secret:'bad'}])assert.throws(()=>intelligenceSchema.parse(p));
});
