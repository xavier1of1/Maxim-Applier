import test from "node:test";
import assert from "node:assert/strict";

import { parseTargetCompaniesCsv } from "../../lib/target-company-importer.mjs";

test("target company CSV importer preserves source and priority signals", () => {
  const targets = parseTargetCompaniesCsv(`company,priority,source_preference,connection_strength,location_focus,role_lanes,notes
"Federal Platform Labs",high,referral,3,"NoVA/DC","software; systems","mission fit"
Startup Co,medium,founder,2,DC,automation,`);

  assert.equal(targets.length, 2);
  assert.equal(targets[0].company, "Federal Platform Labs");
  assert.equal(targets[0].priority, "high");
  assert.equal(targets[0].sourcePreference, "referral");
  assert.equal(targets[0].connectionStrength, 3);
  assert.equal(targets[0].locationFocus, "NoVA/DC");
  assert.equal(targets[0].roleLanes, "software; systems");
  assert.equal(targets[0].notes, "mission fit");
  assert.equal(targets[1].sourcePreference, "founder");
});
