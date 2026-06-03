import test from "node:test";
import assert from "node:assert/strict";

import { planNotifications, suppressDuplicateNotifications } from "../../lib/notification-planner.mjs";

test("notification planner suppresses duplicate fingerprints", () => {
  const planned = planNotifications({
    jobs: [{ id: "job-1", tier: "T3", company: "Capitol Automation", role: "FDE", nextAction: "Act now" }],
    now: new Date("2026-06-02T12:00:00Z"),
  });
  assert.ok(planned.length > 0);
  const filtered = suppressDuplicateNotifications(planned, [planned[0].fingerprint]);
  assert.equal(filtered.some((item) => item.fingerprint === planned[0].fingerprint), false);
});
