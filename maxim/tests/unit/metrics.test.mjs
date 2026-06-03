import test from "node:test";
import assert from "node:assert/strict";

import { createMetricSnapshot } from "../../lib/metrics.mjs";

test("analytics snapshot includes required Maxim segmentation fields", () => {
  const snapshot = createMetricSnapshot(
    [
      {
        company: "Federal Platform Labs",
        role: "Software Engineer",
        locationText: "Arlington, VA",
        score: 4.6,
        tier: "T3",
        source: "company_careers",
        roleLane: "software_engineering",
        salaryText: "$95,000 - $125,000",
        postedAt: "2026-06-01T12:00:00Z",
        status: "Interview",
        networkingStatus: "ready_to_send",
        connectionStrength: 2,
        pdfVariant: "mission_systems",
        companyType: "govtech",
        recruiterInvolvement: "needs_response_thread",
      },
      {
        company: "Remote Example",
        role: "Backend Engineer",
        locationText: "Remote",
        score: 3.8,
        tier: "T1",
        source: "linkedin",
        status: "Rejected",
      },
    ],
    new Date("2026-06-03T12:00:00Z"),
  );

  assert.equal(snapshot.primaryKpi.numerator, 1);
  assert.equal(snapshot.primaryKpi.denominator, 1);
  for (const field of [
    "scoreBand",
    "tier",
    "source",
    "roleLane",
    "salaryBand",
    "freshness",
    "networkingStatus",
    "connectionStrength",
    "pdfVariant",
    "companyType",
    "recruiterInvolvement",
  ]) {
    assert.ok(Array.isArray(snapshot.breakdowns[field]), field);
  }
  assert.equal(snapshot.breakdowns.scoreBand.some((segment) => segment.segmentValue === "4.5+"), true);
  assert.equal(snapshot.breakdowns.freshness.some((segment) => segment.segmentValue === "0-2d"), true);
});
