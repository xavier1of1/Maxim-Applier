import test from "node:test";
import assert from "node:assert/strict";

import { MaximPolicyEngine, expectedSalaryAnswer } from "../../lib/policy-engine.mjs";

const engine = new MaximPolicyEngine();

test("allows NoVA/DC and includes Gainesville and Manassas", () => {
  for (const locationText of ["Arlington, VA", "Washington, DC", "Gainesville, VA", "Manassas, VA"]) {
    const result = engine.evaluate({ locationText, salaryText: "$95,000 - $120,000" }, { tier: "T2" });
    assert.equal(result.allowed, true, locationText);
    assert.ok(result.flags.some((flag) => flag.flagType === "location" && flag.severity === "positive"));
  }
});

test("rejects Maryland-only roles by default while allowing multi-location NoVA/DC roles", () => {
  const maryland = engine.evaluate({ locationText: "Bethesda, MD", salaryText: "$100,000" }, { tier: "T2" });
  assert.equal(maryland.allowed, false);

  const multi = engine.evaluate({ locationText: "Bethesda, MD / Arlington, VA", salaryText: "$100,000" }, { tier: "T2" });
  assert.equal(multi.allowed, true);
});

test("applies salary policy for flat and range postings", () => {
  assert.equal(engine.evaluate({ locationText: "Arlington, VA", salaryText: "$84,000" }, { tier: "T2" }).allowed, false);
  assert.equal(engine.evaluate({ locationText: "Arlington, VA", salaryText: "$89,000" }, { tier: "T3" }).allowed, false);
  assert.equal(engine.evaluate({ locationText: "Arlington, VA", salaryText: "$80,000 - $95,000" }, { tier: "T3" }).allowed, true);
});

test("blocks active-clearance-only roles and preserves eligible-to-obtain posture", () => {
  const result = engine.evaluate({
    locationText: "Arlington, VA",
    salaryText: "$110,000",
    description: "Active TS/SCI clearance required on day one.",
  }, { tier: "T3" });
  assert.equal(result.allowed, false);
  assert.ok(result.flags.some((flag) => flag.flagType === "clearance"));
});

test("marks fresh T2+ roles urgent", () => {
  const result = engine.evaluate({
    locationText: "Washington, DC",
    salaryText: "$100,000",
    postedAt: "2026-06-01T12:00:00Z",
  }, { tier: "T2", now: new Date("2026-06-02T12:00:00Z") });
  assert.ok(result.flags.some((flag) => flag.flagType === "fresh" && flag.severity === "urgent"));
});

test("expected salary follows text, median/default, and high-fit rules", () => {
  assert.equal(expectedSalaryAnswer({ textAllowed: true }), "Negotiable based on role scope and total compensation.");
  assert.equal(expectedSalaryAnswer({ salaryText: "$90,000 - $120,000", tier: "T2" }), "105000");
  assert.equal(expectedSalaryAnswer({ salaryText: "$90,000 - $120,000", tier: "T3" }), "110000");
  assert.equal(expectedSalaryAnswer({ salaryText: "" }), "queue_for_review");
});
