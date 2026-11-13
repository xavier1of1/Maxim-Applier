import test from "node:test";
import assert from "node:assert/strict";

import { buildAutoApplyPlan, loadAutoApplyProfile } from "../../lib/auto-apply-planner.mjs";

const completeProfile = {
  candidate: {
    fullName: "Xavier Kubancik",
    email: "xavier@example.test",
    phone: "555-0100",
    location: "Northern Virginia / Washington, DC",
    streetAddress: "",
    city: "",
    state: "",
    postalCode: "",
    country: "United States",
    linkedin: "https://linkedin.example/xavier",
    portfolioUrl: "https://portfolio.example",
    github: "https://github.example/xavier",
  },
  narrative: {
    approvedPositioning:
      "I am a computer science engineer from Virginia Tech with experience in full-stack software engineering, systems engineering, automation, and entrepreneurship.",
    evidencePolicy: { no_fabrication: true },
  },
  education: {
    school: "Virginia Tech",
    fieldOfStudy: "Computer Science",
    degree: "",
  },
  knownAnswers: {
    workAuthorization: "Yes",
    requiresSponsorship: "No",
    activeClearance: "No",
    eligibleToObtainClearance: "Yes",
    willingToObtainClearance: "Yes",
    startDate: "Available with two weeks notice.",
    expectedSalaryText: "Negotiable based on role scope and total compensation.",
    expectedSalaryDefault: 100000,
    expectedSalaryHighFit: 110000,
    applicationSource: "",
    previousEmployerRelationship: "",
    conflictOfInterest: "",
    exportControlRestrictions: "",
    usPerson: "",
    selfIdDefault: "",
    selfIdGender: "",
    selfIdRaceEthnicity: "",
    selfIdHispanicLatino: "",
    selfIdVeteranStatus: "",
    selfIdDisabilityStatus: "",
  },
  reviewPolicies: {
    optionalSelfIdentification: "queue_for_review_until_policy_confirmed",
    unclearSalary: "queue_for_review",
    finalActionEnabled: false,
    noFabrication: true,
  },
  cv: {},
  missingProfileFields: [],
  warnings: [],
};

function readyApplication(overrides = {}) {
  return {
    id: "app_ready",
    company: "Federal Platform Labs",
    role: "Software Engineer, Mission Systems",
    job_url: "https://example.test/jobs/mission-systems",
    score: 4.6,
    tier: "T3",
    status: "ready_for_assisted_apply",
    report_path: "reports/fpl.md",
    pdf_path: "output/fpl.pdf",
    raw_payload_json: JSON.stringify({ packetReady: true, duplicate: { duplicateRisk: "low" } }),
    ...overrides,
  };
}

test("guided apply plan uses approved profile answers for a ready T3 application", () => {
  const plan = buildAutoApplyPlan(readyApplication(), {
    profile: completeProfile,
    now: new Date("2026-06-03T12:00:00Z"),
  });

  assert.equal(plan.ready, true);
  assert.equal(plan.readiness, "ready_for_guided_apply");
  assert.equal(plan.manualReviewRequired, true);
  assert.equal(plan.finalSubmissionAutomation, "not_implemented");
  assert.equal(plan.knownAnswers.candidateName, "Xavier Kubancik");
  assert.equal(plan.knownAnswers.country, "United States");
  assert.equal(plan.knownAnswers.city, "");
  assert.equal(plan.knownAnswers.educationSchool, "Virginia Tech");
  assert.equal(plan.knownAnswers.educationFieldOfStudy, "Computer Science");
  assert.equal(plan.knownAnswers.educationDegree, "");
  assert.equal(plan.knownAnswers.workAuthorization, "Yes");
  assert.equal(plan.knownAnswers.requiresSponsorship, "No");
  assert.equal(plan.knownAnswers.activeClearance, "No");
  assert.equal(plan.knownAnswers.willingToObtainClearance, "Yes");
  assert.equal(plan.knownAnswers.expectedSalaryNumeric, 110000);
  assert.equal(plan.packet.ready, true);
  assert.equal(plan.commands.browserInspect, "npm run maxim:auto-apply-browser -- inspect app_ready");
  assert.equal(plan.commands.browserAssistRecord, "npm run maxim:auto-apply-browser -- assist app_ready --record-started --write-report");
  assert.deepEqual(plan.reviewReasons, []);
});

test("guided apply plan holds incomplete or risky applications with specific review reasons", () => {
  const plan = buildAutoApplyPlan(
    readyApplication({
      tier: "T1",
      status: "duplicate_review_required",
      job_url: "",
      report_path: null,
      pdf_path: null,
      raw_payload_json: JSON.stringify({ packetReady: false, duplicate: { duplicateRisk: "high" } }),
    }),
    { profile: completeProfile },
  );

  assert.equal(plan.ready, false);
  assert.equal(plan.readiness, "held_for_review");
  assert.match(plan.reviewReasons.join("|"), /application_status_duplicate_review_required/);
  assert.match(plan.reviewReasons.join("|"), /tier_not_default_apply_queue/);
  assert.match(plan.reviewReasons.join("|"), /packet_not_ready/);
  assert.match(plan.reviewReasons.join("|"), /missing_job_url/);
  assert.match(plan.reviewReasons.join("|"), /duplicate_review_required/);
});

test("profile loader maps Xavier policy defaults into known answers", () => {
  const profile = loadAutoApplyProfile();

  assert.equal(profile.knownAnswers.workAuthorization, "Yes");
  assert.equal(profile.knownAnswers.requiresSponsorship, "No");
  assert.equal(profile.knownAnswers.activeClearance, "No");
  assert.equal(profile.knownAnswers.eligibleToObtainClearance, "Yes");
  assert.equal(profile.knownAnswers.willingToObtainClearance, "Yes");
  assert.equal(profile.knownAnswers.expectedSalaryDefault, 100000);
  assert.equal(profile.knownAnswers.expectedSalaryHighFit, 110000);
  assert.equal(profile.reviewPolicies.finalActionEnabled, false);
});

test("guided apply plan treats missing email or phone as readiness blockers", () => {
  const plan = buildAutoApplyPlan(readyApplication(), {
    profile: {
      ...completeProfile,
      candidate: { ...completeProfile.candidate, email: "", phone: "" },
      knownAnswers: { ...completeProfile.knownAnswers, email: "", phone: "" },
      missingProfileFields: ["email", "phone", "linkedin"],
    },
  });

  assert.equal(plan.ready, false);
  assert.match(plan.reviewReasons.join("|"), /profile_required_fields_missing_email_phone/);
});

test("guided apply plan can use a fallback source resume when tailored PDF is missing", () => {
  const plan = buildAutoApplyPlan(
    readyApplication({
      status: "packet_needed",
      pdf_path: null,
      raw_payload_json: JSON.stringify({ packetReady: false, duplicate: { duplicateRisk: "low" } }),
    }),
    {
      profile: {
        ...completeProfile,
        cv: {
          fallbackResumePdfPath: "data/maxim/imports/raw/resume_sources/Final Resume.pdf",
          fallbackResumeSource: "configured_profile_resume_pdf",
        },
      },
    },
  );

  assert.equal(plan.ready, true);
  assert.equal(plan.packet.ready, true);
  assert.equal(plan.packet.tailoredPdfReady, false);
  assert.equal(plan.packet.usingFallbackResume, true);
  assert.equal(plan.packet.pdfPath, "data/maxim/imports/raw/resume_sources/Final Resume.pdf");
  assert.match(plan.warnings.join("|"), /fallback source resume PDF/);
});

test("profile loader accepts environment overrides for private contact answers", () => {
  const previous = {
    email: process.env.MAXIM_CANDIDATE_EMAIL,
    phone: process.env.MAXIM_CANDIDATE_PHONE,
    linkedin: process.env.MAXIM_CANDIDATE_LINKEDIN,
    city: process.env.MAXIM_CANDIDATE_CITY,
    state: process.env.MAXIM_CANDIDATE_STATE,
    postalCode: process.env.MAXIM_CANDIDATE_POSTAL_CODE,
    relocation: process.env.MAXIM_RELOCATION_OPEN,
    sms: process.env.MAXIM_SMS_CONSENT,
    applicationSource: process.env.MAXIM_APPLICATION_SOURCE,
    previousEmployerRelationship: process.env.MAXIM_PREVIOUS_EMPLOYER_RELATIONSHIP,
    conflictOfInterest: process.env.MAXIM_CONFLICT_OF_INTEREST,
    exportControlRestrictions: process.env.MAXIM_EXPORT_CONTROL_RESTRICTIONS,
    usPerson: process.env.MAXIM_US_PERSON,
    selfIdDefault: process.env.MAXIM_SELF_ID_DEFAULT,
    selfIdVeteranStatus: process.env.MAXIM_SELF_ID_VETERAN_STATUS,
  };
  process.env.MAXIM_CANDIDATE_EMAIL = "xavier@example.test";
  process.env.MAXIM_CANDIDATE_PHONE = "555-0100";
  process.env.MAXIM_CANDIDATE_LINKEDIN = "https://linkedin.example/xavier";
  process.env.MAXIM_CANDIDATE_CITY = "Arlington";
  process.env.MAXIM_CANDIDATE_STATE = "VA";
  process.env.MAXIM_CANDIDATE_POSTAL_CODE = "22201";
  process.env.MAXIM_RELOCATION_OPEN = "yes";
  process.env.MAXIM_SMS_CONSENT = "no";
  process.env.MAXIM_APPLICATION_SOURCE = "Company careers page";
  process.env.MAXIM_PREVIOUS_EMPLOYER_RELATIONSHIP = "No";
  process.env.MAXIM_CONFLICT_OF_INTEREST = "No";
  process.env.MAXIM_EXPORT_CONTROL_RESTRICTIONS = "No";
  process.env.MAXIM_US_PERSON = "Yes";
  process.env.MAXIM_SELF_ID_DEFAULT = "Prefer not to answer";
  process.env.MAXIM_SELF_ID_VETERAN_STATUS = "I do not wish to answer";

  try {
    const profile = loadAutoApplyProfile();
    assert.equal(profile.candidate.email, "xavier@example.test");
    assert.equal(profile.candidate.phone, "555-0100");
    assert.equal(profile.candidate.linkedin, "https://linkedin.example/xavier");
    assert.equal(profile.candidate.city, "Arlington");
    assert.equal(profile.candidate.state, "VA");
    assert.equal(profile.candidate.postalCode, "22201");
    assert.equal(profile.knownAnswers.relocationOpen, true);
    assert.equal(profile.knownAnswers.smsConsent, false);
    assert.equal(profile.knownAnswers.applicationSource, "Company careers page");
    assert.equal(profile.knownAnswers.previousEmployerRelationship, "No");
    assert.equal(profile.knownAnswers.conflictOfInterest, "No");
    assert.equal(profile.knownAnswers.exportControlRestrictions, "No");
    assert.equal(profile.knownAnswers.usPerson, "Yes");
    assert.equal(profile.knownAnswers.selfIdDefault, "Prefer not to answer");
    assert.equal(profile.knownAnswers.selfIdVeteranStatus, "I do not wish to answer");
    assert.equal(profile.missingProfileFields.includes("email"), false);
    assert.equal(profile.missingProfileFields.includes("phone"), false);
  } finally {
    if (previous.email === undefined) delete process.env.MAXIM_CANDIDATE_EMAIL;
    else process.env.MAXIM_CANDIDATE_EMAIL = previous.email;
    if (previous.phone === undefined) delete process.env.MAXIM_CANDIDATE_PHONE;
    else process.env.MAXIM_CANDIDATE_PHONE = previous.phone;
    if (previous.linkedin === undefined) delete process.env.MAXIM_CANDIDATE_LINKEDIN;
    else process.env.MAXIM_CANDIDATE_LINKEDIN = previous.linkedin;
    if (previous.city === undefined) delete process.env.MAXIM_CANDIDATE_CITY;
    else process.env.MAXIM_CANDIDATE_CITY = previous.city;
    if (previous.state === undefined) delete process.env.MAXIM_CANDIDATE_STATE;
    else process.env.MAXIM_CANDIDATE_STATE = previous.state;
    if (previous.postalCode === undefined) delete process.env.MAXIM_CANDIDATE_POSTAL_CODE;
    else process.env.MAXIM_CANDIDATE_POSTAL_CODE = previous.postalCode;
    if (previous.relocation === undefined) delete process.env.MAXIM_RELOCATION_OPEN;
    else process.env.MAXIM_RELOCATION_OPEN = previous.relocation;
    if (previous.sms === undefined) delete process.env.MAXIM_SMS_CONSENT;
    else process.env.MAXIM_SMS_CONSENT = previous.sms;
    if (previous.applicationSource === undefined) delete process.env.MAXIM_APPLICATION_SOURCE;
    else process.env.MAXIM_APPLICATION_SOURCE = previous.applicationSource;
    if (previous.previousEmployerRelationship === undefined) delete process.env.MAXIM_PREVIOUS_EMPLOYER_RELATIONSHIP;
    else process.env.MAXIM_PREVIOUS_EMPLOYER_RELATIONSHIP = previous.previousEmployerRelationship;
    if (previous.conflictOfInterest === undefined) delete process.env.MAXIM_CONFLICT_OF_INTEREST;
    else process.env.MAXIM_CONFLICT_OF_INTEREST = previous.conflictOfInterest;
    if (previous.exportControlRestrictions === undefined) delete process.env.MAXIM_EXPORT_CONTROL_RESTRICTIONS;
    else process.env.MAXIM_EXPORT_CONTROL_RESTRICTIONS = previous.exportControlRestrictions;
    if (previous.usPerson === undefined) delete process.env.MAXIM_US_PERSON;
    else process.env.MAXIM_US_PERSON = previous.usPerson;
    if (previous.selfIdDefault === undefined) delete process.env.MAXIM_SELF_ID_DEFAULT;
    else process.env.MAXIM_SELF_ID_DEFAULT = previous.selfIdDefault;
    if (previous.selfIdVeteranStatus === undefined) delete process.env.MAXIM_SELF_ID_VETERAN_STATUS;
    else process.env.MAXIM_SELF_ID_VETERAN_STATUS = previous.selfIdVeteranStatus;
  }
});
