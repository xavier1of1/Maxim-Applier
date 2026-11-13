import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadAutoApplyProfile, buildAutoApplyPlan } from "../../lib/auto-apply-planner.mjs";
import { mapApplicationFormFields } from "../../lib/application-form-mapper.mjs";

function withProfile(data, run) {
  const dir = fs.mkdtempSync(path.join(process.env.TMPDIR || os.tmpdir(), "assisted-safety-"));
  try {
    const profilePath = path.join(dir, "profile.json"); // JSON is valid YAML.
    fs.writeFileSync(profilePath, JSON.stringify(data));
    return run(loadAutoApplyProfile(profilePath), dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const application = {
  id: "fixture", company: "Fixture", role: "Fixture", tier: "T2",
  status: "ready_for_assisted_apply", job_url: "https://example.test/job",
  report_path: "fixture-report", pdf_path: null,
};

test("absent boolean answers stay unknown through the required-field mapper", () => {
  withProfile({}, (profile) => {
    const plan = buildAutoApplyPlan(application, { profile });
    const keys = ["workAuthorization", "requiresSponsorship", "activeClearance", "eligibleToObtainClearance", "willingToObtainClearance"];
    for (const key of keys) assert.equal(plan.knownAnswers[key] ?? "", "", key);
    const mapped = mapApplicationFormFields([
      { tagName: "select", label: "Are you authorized to work?", required: true },
      { tagName: "select", label: "Do you require visa sponsorship?", required: true },
      { tagName: "select", label: "Do you have an active clearance?", required: true },
      { tagName: "select", label: "Are you willing to obtain a clearance?", required: true },
    ], plan);
    assert.equal(mapped.safeFillCount, 0);
    assert.equal(mapped.requiredReviewCount, 4);
    assert.ok(mapped.review.every((item) => item.reason === "approved_answer_missing"));
  });
});

test("legacy fallback resume remains held and is never offered to the mapper", () => {
  withProfile({}, (profile, dir) => {
    const oldResume = path.join(dir, "Final Resume.pdf");
    fs.writeFileSync(oldResume, "historical fixture");
    profile.cv = { fallbackResumePdfPath: oldResume, fallbackResumeSource: "configured_profile_resume_pdf" };
    const plan = buildAutoApplyPlan({ ...application, status: "packet_needed" }, { profile });
    assert.equal(plan.packet.pdfPath, undefined);
    assert.equal(plan.packet.ready, false);
    assert.equal(plan.ready, false);
    assert.ok(plan.reviewReasons.includes("packet_not_ready"));
    const mapped = mapApplicationFormFields([{ tagName: "input", type: "file", label: "Resume", required: true }], plan);
    assert.equal(mapped.safeFillCount, 0);
    assert.equal(mapped.review[0].reason, "approved_answer_missing");
  });
});
