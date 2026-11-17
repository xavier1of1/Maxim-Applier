import test from "node:test";
import assert from "node:assert/strict";

import { assignTier,routeEvaluation } from "../../lib/tier-router.mjs";

test("maps Career-Ops score thresholds to Maxim tiers", () => {
  assert.equal(assignTier(3.49).tier, "T0");
  assert.equal(assignTier(3.5).tier, "T1");
  assert.equal(assignTier(3.99).tier, "T1");
  assert.equal(assignTier(4.0).tier, "T2");
  assert.equal(assignTier(4.49).tier, "T2");
  assert.equal(assignTier(4.5).tier, "T3");
});
test('absent, invalid, boolean and out-of-range scores stay unknown, never T0/T1',()=>{
 for(const score of [null,undefined,'',' ',true,false,'4.6oops',NaN,Infinity,0,-1,5.1]){
  assert.equal(assignTier(score).tier,null);assert.equal(routeEvaluation({score}).nextAction,'queue_review');
 }
 assert.equal(assignTier('4.6').tier,'T3');
});
test('connection priority cannot replace T0 or an unknown score',()=>{
 const flags=[{flagType:'connection_overlay',severity:'positive',reason:'Meaningful contact'}];
 assert.equal(routeEvaluation({score:3.2},flags).nextAction,'no_apply');
 assert.equal(routeEvaluation({score:null},flags).nextAction,'queue_review');
});
