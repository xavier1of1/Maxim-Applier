import test from 'node:test';
import assert from 'node:assert/strict';
import {defaults,intelligenceSchema} from '../../src/server/intelligence-policy.ts';
test('discovery intelligence defaults are finite and never authorize spend or pruning',()=>{
 const p=defaults();assert.equal(p.maxActiveJobs,200);assert.equal(p.dailyBudgetCents,0);
 for(const key of ['autoScan','autoScore','cleanupEnabled'])assert.equal(p[key],false);
 assert.equal(p.evaluationsPerCycle,5);assert.equal(p.sourceIds.length,0);
});
test('policy bounds and unknown keys fail instead of enabling unbounded work',()=>{
 for(const p of [{maxActiveJobs:0},{maxActiveJobs:2001},{evaluationsPerCycle:21},{scanIntervalMinutes:0},{rawRetentionDays:0},{dailyBudgetCents:-1},{timezone:'not/a-zone'},{secret:'bad'}])assert.throws(()=>intelligenceSchema.parse(p));
});
