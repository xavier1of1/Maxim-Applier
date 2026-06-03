import test from "node:test";
import assert from "node:assert/strict";

import { runAlignmentCheck } from "../../scripts/alignment-check.mjs";

test("Maxim fork changes stay inside documented project boundaries", () => {
  const result = runAlignmentCheck();
  assert.equal(result.ok, true, JSON.stringify(result.issues));
  assert.equal(result.comparedAgainst.length > 0, true);
});
