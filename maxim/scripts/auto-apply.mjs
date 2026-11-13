import { fileURLToPath } from "node:url";
import path from "node:path";
import "dotenv/config";

import { queueEligibleApplications } from "../lib/application-tracker.mjs";
import { buildAutoApplyPlan, buildAutoApplyPlans, loadAutoApplyProfile } from "../lib/auto-apply-planner.mjs";
import { createStore } from "../lib/sqlite-store.mjs";
import { syncCareerOpsArtifacts } from "../lib/tracker-sync.mjs";

const command = process.argv[2] ?? "help";

function readFlag(name) {
  return process.argv.includes(name);
}

function readOption(name, fallback = undefined) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) {
    return exact.slice(name.length + 1);
  }
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function limitPlans(plans) {
  const limitValue = readOption("--limit");
  if (!limitValue) {
    return plans;
  }
  const limit = Number.parseInt(limitValue, 10);
  return Number.isFinite(limit) && limit >= 0 ? plans.slice(0, limit) : plans;
}

function visiblePlan(plan) {
  const knownAnswers = { ...plan.knownAnswers };
  for (const field of [
    "email",
    "phone",
    "linkedin",
    "streetAddress",
    "city",
    "state",
    "postalCode",
    "selfIdDefault",
    "selfIdGender",
    "selfIdRaceEthnicity",
    "selfIdHispanicLatino",
    "selfIdVeteranStatus",
    "selfIdDisabilityStatus",
  ]) {
    if (knownAnswers[field]) {
      knownAnswers[field] = "[configured]";
    }
  }
  return {
    applicationId: plan.applicationId,
    company: plan.company,
    role: plan.role,
    jobUrl: plan.jobUrl,
    score: plan.score,
    tier: plan.tier,
    currentStatus: plan.currentStatus,
    ready: plan.ready,
    readiness: plan.readiness,
    reviewReasons: plan.reviewReasons,
    warnings: plan.warnings,
    packet: plan.packet,
    duplicateRisk: plan.duplicateRisk,
    manualReviewRequired: plan.manualReviewRequired,
    finalSubmissionAutomation: plan.finalSubmissionAutomation,
    allowedActions: plan.allowedActions,
    prohibitedActions: plan.prohibitedActions,
    stopConditions: plan.stopConditions,
    knownAnswers,
    commands: plan.commands,
    nextAction: plan.nextAction,
  };
}

function recordPlan(store, plan) {
  store.appendAuditEvent({
    event_type: "application_assist_plan_generated",
    entity_type: "application",
    entity_id: plan.applicationId,
    reason: "Guided application assist plan generated for Xavier review",
    payload: {
      company: plan.company,
      role: plan.role,
      ready: plan.ready,
      readiness: plan.readiness,
      reviewReasons: plan.reviewReasons,
      manualReviewRequired: plan.manualReviewRequired,
    },
  });
}

function fail(message) {
  console.log(JSON.stringify({ ok: false, message }, null, 2));
  process.exit(1);
}

function help() {
  return {
    ok: false,
    message:
      "Commands: doctor, prepare [--ready-only] [--limit N] [--include-t1] [--record], plan [--ready-only] [--limit N] [--record], plan-one <application-id> [--record]. Plans prepare guided apply work and stop before final application action.",
  };
}

function makePlanResponse(store, { recorded = false } = {}) {
  const profile = loadAutoApplyProfile();
  const plans = limitPlans(
    buildAutoApplyPlans(store.listApplications(), { profile }).filter((plan) => (readFlag("--ready-only") ? plan.ready : true)),
  );
  if (recorded) {
    for (const plan of plans) {
      recordPlan(store, plan);
    }
  }
  return {
    count: plans.length,
    recorded,
    safety: {
      manualReviewRequired: true,
      finalSubmissionAutomation: "not_implemented",
      browserExecutor: "guided_fill_only",
    },
    plans: plans.map(visiblePlan),
  };
}

function profileDoctor() {
  const profile = loadAutoApplyProfile();
  const required = {
    email: Boolean(profile.candidate.email),
    phone: Boolean(profile.candidate.phone),
  };
  const recommended = {
    linkedin: Boolean(profile.candidate.linkedin),
    portfolioUrl: Boolean(profile.candidate.portfolioUrl),
    github: Boolean(profile.candidate.github),
    city: Boolean(profile.candidate.city),
    state: Boolean(profile.candidate.state),
    postalCode: Boolean(profile.candidate.postalCode),
    relocationOpen: typeof profile.knownAnswers.relocationOpen === "boolean",
    smsConsent: typeof profile.knownAnswers.smsConsent === "boolean",
    fallbackResumePdfPath: Boolean(profile.cv?.fallbackResumePdfPath),
  };
  const standardized = {
    applicationSource: Boolean(profile.knownAnswers.applicationSource),
    previousEmployerRelationship: Boolean(profile.knownAnswers.previousEmployerRelationship),
    conflictOfInterest: Boolean(profile.knownAnswers.conflictOfInterest),
    exportControlRestrictions: Boolean(profile.knownAnswers.exportControlRestrictions),
    usPerson: Boolean(profile.knownAnswers.usPerson),
    selfIdDefault: Boolean(profile.knownAnswers.selfIdDefault),
    selfIdGender: Boolean(profile.knownAnswers.selfIdGender),
    selfIdRaceEthnicity: Boolean(profile.knownAnswers.selfIdRaceEthnicity),
    selfIdHispanicLatino: Boolean(profile.knownAnswers.selfIdHispanicLatino),
    selfIdVeteranStatus: Boolean(profile.knownAnswers.selfIdVeteranStatus),
    selfIdDisabilityStatus: Boolean(profile.knownAnswers.selfIdDisabilityStatus),
  };
  return {
    ok: required.email && required.phone,
    required,
    recommended,
    standardized,
    missingRequired: Object.entries(required).filter(([, present]) => !present).map(([key]) => key),
    missingRecommended: Object.entries(recommended).filter(([, present]) => !present).map(([key]) => key),
    envKeys: {
      email: "MAXIM_CANDIDATE_EMAIL",
      phone: "MAXIM_CANDIDATE_PHONE",
      linkedin: "MAXIM_CANDIDATE_LINKEDIN",
      portfolioUrl: "MAXIM_CANDIDATE_PORTFOLIO_URL",
      github: "MAXIM_CANDIDATE_GITHUB",
      city: "MAXIM_CANDIDATE_CITY",
      state: "MAXIM_CANDIDATE_STATE",
      postalCode: "MAXIM_CANDIDATE_POSTAL_CODE",
      relocationOpen: "MAXIM_RELOCATION_OPEN",
      smsConsent: "MAXIM_SMS_CONSENT",
      applicationSource: "MAXIM_APPLICATION_SOURCE",
      previousEmployerRelationship: "MAXIM_PREVIOUS_EMPLOYER_RELATIONSHIP",
      conflictOfInterest: "MAXIM_CONFLICT_OF_INTEREST",
      exportControlRestrictions: "MAXIM_EXPORT_CONTROL_RESTRICTIONS",
      usPerson: "MAXIM_US_PERSON",
      selfIdDefault: "MAXIM_SELF_ID_DEFAULT",
      selfIdGender: "MAXIM_SELF_ID_GENDER",
      selfIdRaceEthnicity: "MAXIM_SELF_ID_RACE_ETHNICITY",
      selfIdHispanicLatino: "MAXIM_SELF_ID_HISPANIC_LATINO",
      selfIdVeteranStatus: "MAXIM_SELF_ID_VETERAN_STATUS",
      selfIdDisabilityStatus: "MAXIM_SELF_ID_DISABILITY_STATUS",
    },
    profileKeys: {
      email: "candidate.email",
      phone: "candidate.phone",
      linkedin: "candidate.linkedin",
      portfolioUrl: "candidate.portfolio_url",
      github: "candidate.github",
      streetAddress: "candidate.street_address",
      city: "candidate.city",
      state: "candidate.state",
      postalCode: "candidate.postal_code",
      relocationOpen: "application_answers.relocation.open_to_relocating",
      smsConsent: "application_answers.communication.sms_consent",
      applicationSource: "application_answers.standardized.application_source",
      previousEmployerRelationship: "application_answers.standardized.previous_employer_relationship",
      conflictOfInterest: "application_answers.standardized.conflict_of_interest",
      exportControlRestrictions: "application_answers.standardized.export_control_restrictions",
      usPerson: "application_answers.standardized.us_person",
      selfIdDefault: "application_answers.self_identification.default_answer",
      selfIdGender: "application_answers.self_identification.gender",
      selfIdRaceEthnicity: "application_answers.self_identification.race_ethnicity",
      selfIdHispanicLatino: "application_answers.self_identification.hispanic_latino",
      selfIdVeteranStatus: "application_answers.self_identification.veteran_status",
      selfIdDisabilityStatus: "application_answers.self_identification.disability_status",
      fallbackResumePdfPath: "cv.default_resume_pdf_path",
    },
    note: "Values are intentionally not printed. Set either config/profile.yml keys or .env MAXIM_* overrides.",
  };
}

if (command === "doctor") {
  console.log(JSON.stringify(profileDoctor(), null, 2));
} else if (command === "prepare") {
  const store = createStore();
  const syncResult = syncCareerOpsArtifacts({ store });
  const queueResult = queueEligibleApplications({ store, includeT1: readFlag("--include-t1") });
  const response = makePlanResponse(store, { recorded: readFlag("--record") });
  console.log(JSON.stringify({ ok: true, syncResult, queueResult, ...response }, null, 2));
} else if (command === "plan") {
  const store = createStore();
  console.log(JSON.stringify({ ok: true, ...makePlanResponse(store, { recorded: readFlag("--record") }) }, null, 2));
} else if (command === "plan-one") {
  const applicationId = process.argv[3];
  if (!applicationId) {
    fail("Usage: npm run maxim:auto-apply -- plan-one <application-id> [--record]");
  }
  const store = createStore();
  const application = store.getApplication(applicationId);
  if (!application) {
    fail(`Application not found: ${applicationId}`);
  }
  const plan = buildAutoApplyPlan(application, { profile: loadAutoApplyProfile() });
  if (readFlag("--record")) {
    recordPlan(store, plan);
  }
  console.log(JSON.stringify({ ok: true, recorded: readFlag("--record"), plan: visiblePlan(plan) }, null, 2));
} else if (command === "help" || command === "--help" || command === "-h") {
  console.log(JSON.stringify(help(), null, 2));
} else {
  fail(help().message);
}

export const scriptPath = path.resolve(fileURLToPath(import.meta.url));
