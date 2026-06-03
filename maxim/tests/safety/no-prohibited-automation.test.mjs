import test from "node:test";
import assert from "node:assert/strict";

import { runSafetyCheck } from "../../scripts/website-safety-check.mjs";

test("safety scanner finds no prohibited platform automation patterns", () => {
  const result = runSafetyCheck();
  assert.equal(result.ok, true, JSON.stringify(result.findings));
});
