import test from "node:test";
import assert from "node:assert/strict";

import { assignTier } from "../../lib/tier-router.mjs";

test("maps Career-Ops score thresholds to Maxim tiers", () => {
  assert.equal(assignTier(3.49).tier, "T0");
  assert.equal(assignTier(3.5).tier, "T1");
  assert.equal(assignTier(3.99).tier, "T1");
  assert.equal(assignTier(4.0).tier, "T2");
  assert.equal(assignTier(4.49).tier, "T2");
  assert.equal(assignTier(4.5).tier, "T3");
});
