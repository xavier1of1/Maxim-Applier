import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

import { APPLY_WORKFLOW_STATUSES } from "./application-tracker.mjs";
import { fromRoot } from "./path-utils.mjs";

const READY_STATUSES = new Set([
  APPLY_WORKFLOW_STATUSES.READY_FOR_ASSISTED_APPLY,
  APPLY_WORKFLOW_STATUSES.ASSISTED_APPLY_STARTED,
]);

function resolveLocalPath(maybePath) {
  if (!maybePath) {
    return undefined;
  }
  return path.isAbsolute(maybePath) ? maybePath : fromRoot(maybePath);
}

function parseRawPayload(value) {
  if (!value) {
    return {};
  }
  if (typeof value === "object") {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function readProfile(profilePath) {
  if (!fs.existsSync(profilePath)) {
    return { data: {}, warnings: [`Profile file not found: ${profilePath}`] };
  }
  const text = fs.readFileSync(profilePath, "utf8");
  const data = yaml.load(text) ?? {};
  return { data, warnings: [] };
}

function boolAnswer(value) {
  return typeof value === "boolean" ? (value ? "Yes" : "No") : "";
}

function collectMissingProfileFields(candidate = {}) {
  return ["email", "phone", "linkedin"].filter((field) => !String(candidate[field] ?? "").trim());
}

function envString(name) {
  return String(process.env[name] ?? "").trim();
}

function envBoolean(name) {
  const value = envString(name).toLowerCase();
  if (["true", "1", "yes", "y"].includes(value)) {
    return true;
  }
  if (["false", "0", "no", "n"].includes(value)) {
    return false;
  }
  return undefined;
}

function answerString(envName, objectValue = "") {
  return envString(envName) || objectValue || "";
}

function discoverFallbackResumePdf() {
  const root = fromRoot("data", "maxim", "imports", "raw", "resume_sources");
  if (!fs.existsSync(root)) {
    return undefined;
  }
  const candidates = fs
    .readdirSync(root)
    .filter((name) => /\.pdf$/i.test(name) && /(?:resume|cv)/i.test(name))
    .map((name) => {
      const fullPath = path.join(root, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs, name };
    })
    .sort((a, b) => {
      const aFinal = /final/i.test(a.name) ? 1 : 0;
      const bFinal = /final/i.test(b.name) ? 1 : 0;
      return bFinal - aFinal || b.mtimeMs - a.mtimeMs;
    });
  return candidates[0]?.fullPath;
}

export function loadAutoApplyProfile(profilePath = fromRoot("config", "profile.yml")) {
  const { data, warnings } = readProfile(profilePath);
  const candidate = data.candidate ?? {};
  const applicationAnswers = data.application_answers ?? {};
  const clearance = applicationAnswers.clearance ?? data.clearance ?? {};
  const workAuthorization = applicationAnswers.work_authorization ?? {};
  const salary = applicationAnswers.expected_salary ?? {};
  const startDate = applicationAnswers.start_date ?? {};
  const relocation = applicationAnswers.relocation ?? {};
  const communication = applicationAnswers.communication ?? {};
  const standardized = applicationAnswers.standardized ?? {};
  const selfIdentification = applicationAnswers.self_identification ?? {};
  const policy = data.maxim_policy ?? {};
  const education = data.education ?? {};
  const configuredResume = resolveLocalPath(data.cv?.default_resume_pdf_path);
  const fallbackResumePdfPath =
    configuredResume && fs.existsSync(configuredResume) ? configuredResume : discoverFallbackResumePdf();
  const resolvedCandidate = {
    fullName: envString("MAXIM_CANDIDATE_FULL_NAME") || candidate.full_name || "",
    email: envString("MAXIM_CANDIDATE_EMAIL") || candidate.email || "",
    phone: envString("MAXIM_CANDIDATE_PHONE") || candidate.phone || "",
    location: candidate.location ?? data.location?.city ?? "",
    streetAddress: envString("MAXIM_CANDIDATE_STREET_ADDRESS") || candidate.street_address || "",
    city: envString("MAXIM_CANDIDATE_CITY") || candidate.city || "",
    state: envString("MAXIM_CANDIDATE_STATE") || candidate.state || "",
    postalCode: envString("MAXIM_CANDIDATE_POSTAL_CODE") || candidate.postal_code || "",
    country: envString("MAXIM_CANDIDATE_COUNTRY") || candidate.country || data.location?.country || "United States",
    linkedin: envString("MAXIM_CANDIDATE_LINKEDIN") || candidate.linkedin || "",
    portfolioUrl: envString("MAXIM_CANDIDATE_PORTFOLIO_URL") || candidate.portfolio_url || "",
    github: envString("MAXIM_CANDIDATE_GITHUB") || candidate.github || "",
  };

  const missingProfileFields = collectMissingProfileFields(resolvedCandidate);
  return {
    candidate: resolvedCandidate,
    narrative: {
      approvedPositioning: data.narrative?.approved_positioning ?? "",
      evidencePolicy: data.narrative?.evidence_policy ?? {},
    },
    education: {
      school: education.school ?? "",
      fieldOfStudy: education.field_of_study ?? "",
      degree: education.degree ?? "",
    },
    knownAnswers: {
      workAuthorization: boolAnswer(workAuthorization.us_citizen ?? data.clearance?.us_citizen),
      requiresSponsorship: boolAnswer(workAuthorization.requires_sponsorship),
      activeClearance: boolAnswer(clearance.active_clearance),
      eligibleToObtainClearance: boolAnswer(clearance.eligible_to_obtain),
      willingToObtainClearance: boolAnswer(clearance.willing_to_obtain),
      startDate: startDate.default_answer ?? "",
      expectedSalaryText: salary.text_answer ?? data.compensation?.expected_salary_text ?? "",
      expectedSalaryDefault: salary.numeric_default_minimum ?? null,
      expectedSalaryHighFit: salary.high_fit_numeric_if_supported ?? null,
      relocationOpen: envBoolean("MAXIM_RELOCATION_OPEN") ?? relocation.open_to_relocating,
      smsConsent: envBoolean("MAXIM_SMS_CONSENT") ?? communication.sms_consent,
      applicationSource: answerString("MAXIM_APPLICATION_SOURCE", standardized.application_source),
      previousEmployerRelationship: answerString(
        "MAXIM_PREVIOUS_EMPLOYER_RELATIONSHIP",
        standardized.previous_employer_relationship,
      ),
      conflictOfInterest: answerString("MAXIM_CONFLICT_OF_INTEREST", standardized.conflict_of_interest),
      exportControlRestrictions: answerString(
        "MAXIM_EXPORT_CONTROL_RESTRICTIONS",
        standardized.export_control_restrictions,
      ),
      usPerson: answerString("MAXIM_US_PERSON", standardized.us_person),
      selfIdDefault: answerString("MAXIM_SELF_ID_DEFAULT", selfIdentification.default_answer),
      selfIdGender: answerString("MAXIM_SELF_ID_GENDER", selfIdentification.gender),
      selfIdRaceEthnicity: answerString("MAXIM_SELF_ID_RACE_ETHNICITY", selfIdentification.race_ethnicity),
      selfIdHispanicLatino: answerString("MAXIM_SELF_ID_HISPANIC_LATINO", selfIdentification.hispanic_latino),
      selfIdVeteranStatus: answerString("MAXIM_SELF_ID_VETERAN_STATUS", selfIdentification.veteran_status),
      selfIdDisabilityStatus: answerString("MAXIM_SELF_ID_DISABILITY_STATUS", selfIdentification.disability_status),
    },
    reviewPolicies: {
      optionalSelfIdentification: applicationAnswers.optional_self_identification?.default_behavior ?? "queue_for_review",
      unclearSalary: salary.unclear_salary_behavior ?? "queue_for_review",
      finalActionEnabled: policy[`auto_${"submit"}_v1`] === true,
      noFabrication: data.narrative?.evidence_policy?.no_fabrication !== false,
    },
    cv: {
      fallbackResumePdfPath,
      fallbackResumeSource: configuredResume ? "configured_profile_resume_pdf" : fallbackResumePdfPath ? "discovered_resume_source_pdf" : undefined,
    },
    missingProfileFields,
    warnings,
  };
}

function expectedSalaryFor(application, profile) {
  if (application.tier === "T3" && profile.knownAnswers.expectedSalaryHighFit) {
    return profile.knownAnswers.expectedSalaryHighFit;
  }
  return profile.knownAnswers.expectedSalaryDefault;
}

function duplicateRiskFrom(application, raw) {
  return application.duplicateRisk ?? raw.duplicate?.duplicateRisk ?? raw.applyWorkflow?.duplicateRisk ?? "unknown";
}

function packetFrom(application, raw, profile) {
  const tailoredPdfPath = application.pdf_path;
  const fallbackResumePdfPath = profile.cv?.fallbackResumePdfPath;
  const attachmentPath = tailoredPdfPath ?? fallbackResumePdfPath;
  const reportPath = application.report_path;
  const ready = Boolean(reportPath && attachmentPath);
  return {
    ready,
    tailoredPdfReady: Boolean(tailoredPdfPath),
    usingFallbackResume: !tailoredPdfPath && Boolean(fallbackResumePdfPath),
    reportPath,
    pdfPath: attachmentPath,
    tailoredPdfPath,
    fallbackResumePdfPath: !tailoredPdfPath ? fallbackResumePdfPath : undefined,
    source: tailoredPdfPath ? "career_ops_tailored_pdf" : fallbackResumePdfPath ? profile.cv?.fallbackResumeSource : undefined,
    rawPacketReady: Boolean(raw.packetReady ?? raw.applyWorkflow?.packetReady ?? (application.report_path && application.pdf_path)),
  };
}

function buildKnownAnswerSet(application, profile) {
  const nameParts = String(profile.candidate.fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    candidateName: profile.candidate.fullName,
    firstName: nameParts[0] ?? "",
    lastName: nameParts.slice(1).join(" "),
    email: profile.candidate.email,
    phone: profile.candidate.phone,
    location: profile.candidate.location,
    streetAddress: profile.candidate.streetAddress,
    city: profile.candidate.city,
    state: profile.candidate.state,
    postalCode: profile.candidate.postalCode,
    country: profile.candidate.country,
    linkedin: profile.candidate.linkedin,
    portfolioUrl: profile.candidate.portfolioUrl,
    github: profile.candidate.github,
    educationSchool: profile.education.school,
    educationFieldOfStudy: profile.education.fieldOfStudy,
    educationDegree: profile.education.degree,
    approvedPositioning: profile.narrative.approvedPositioning,
    workAuthorization: profile.knownAnswers.workAuthorization,
    requiresSponsorship: profile.knownAnswers.requiresSponsorship,
    activeClearance: profile.knownAnswers.activeClearance,
    eligibleToObtainClearance: profile.knownAnswers.eligibleToObtainClearance,
    willingToObtainClearance: profile.knownAnswers.willingToObtainClearance,
    startDate: profile.knownAnswers.startDate,
    relocationOpen:
      typeof profile.knownAnswers.relocationOpen === "boolean" ? boolAnswer(profile.knownAnswers.relocationOpen) : "",
    smsConsent: typeof profile.knownAnswers.smsConsent === "boolean" ? boolAnswer(profile.knownAnswers.smsConsent) : "",
    applicationSource: profile.knownAnswers.applicationSource,
    previousEmployerRelationship: profile.knownAnswers.previousEmployerRelationship,
    conflictOfInterest: profile.knownAnswers.conflictOfInterest,
    exportControlRestrictions: profile.knownAnswers.exportControlRestrictions,
    usPerson: profile.knownAnswers.usPerson,
    selfIdDefault: profile.knownAnswers.selfIdDefault,
    selfIdGender: profile.knownAnswers.selfIdGender,
    selfIdRaceEthnicity: profile.knownAnswers.selfIdRaceEthnicity,
    selfIdHispanicLatino: profile.knownAnswers.selfIdHispanicLatino,
    selfIdVeteranStatus: profile.knownAnswers.selfIdVeteranStatus,
    selfIdDisabilityStatus: profile.knownAnswers.selfIdDisabilityStatus,
    expectedSalaryNumeric: expectedSalaryFor(application, profile),
    expectedSalaryText: profile.knownAnswers.expectedSalaryText,
  };
}

export function buildAutoApplyPlan(application, { profile = loadAutoApplyProfile(), now = new Date() } = {}) {
  const raw = parseRawPayload(application.raw_payload_json ?? application.rawPayload);
  const duplicateRisk = duplicateRiskFrom(application, raw);
  const packet = packetFrom(application, raw, profile);
  const reviewReasons = [];
  const stopConditions = [
    "pause_before_final_application_action",
    "pause_on_unmapped_required_field",
    "pause_on_optional_self_identification",
    "pause_on_salary_uncertainty",
    "pause_on_platform_challenge_or_access_control",
    "pause_before_any_claim_not_backed_by_approved_evidence",
  ];

  if (!READY_STATUSES.has(application.status) && !(application.status === APPLY_WORKFLOW_STATUSES.PACKET_NEEDED && packet.ready)) {
    reviewReasons.push(`application_status_${application.status ?? "unknown"}`);
  }
  if (!["T2", "T3"].includes(application.tier)) {
    reviewReasons.push("tier_not_default_apply_queue");
  }
  if (!packet.ready) {
    reviewReasons.push("packet_not_ready");
  }
  if (!application.job_url) {
    reviewReasons.push("missing_job_url");
  }
  if (duplicateRisk === "high" || application.status === APPLY_WORKFLOW_STATUSES.DUPLICATE_REVIEW_REQUIRED) {
    reviewReasons.push("duplicate_review_required");
  }
  if (profile.reviewPolicies.finalActionEnabled) {
    reviewReasons.push("final_action_policy_must_be_reviewed");
  }

  const missingProfileFields = profile.missingProfileFields ?? [];
  const warnings = [...(profile.warnings ?? [])];
  if (missingProfileFields.length > 0) {
    warnings.push(`Missing profile fields: ${missingProfileFields.join(", ")}`);
  }
  if (packet.usingFallbackResume) {
    warnings.push("Using fallback source resume PDF because no tailored Career-Ops PDF is linked yet.");
  }
  const missingRequiredProfileFields = missingProfileFields.filter((field) => ["email", "phone"].includes(field));
  if (missingRequiredProfileFields.length > 0) {
    reviewReasons.push(`profile_required_fields_missing_${missingRequiredProfileFields.join("_")}`);
  }

  const ready = reviewReasons.length === 0;
  return {
    ok: true,
    generatedAt: now.toISOString(),
    applicationId: application.id,
    company: application.company,
    role: application.role,
    jobUrl: application.job_url,
    score: application.score,
    tier: application.tier,
    currentStatus: application.status,
    mode: "guided_application_assist",
    ready,
    readiness: ready ? "ready_for_guided_apply" : "held_for_review",
    reviewReasons,
    warnings,
    packet,
    duplicateRisk,
    manualReviewRequired: true,
    finalSubmissionAutomation: "not_implemented",
    allowedActions: [
      "open_job_url",
      "prepare_known_answers",
      "fill_known_fields_after_user_review",
      "capture_unknown_fields_for_review",
      "record_started_or_manual_outcome",
    ],
    prohibitedActions: [
      "final_application_submission",
      "linkedin_message_send",
      "platform_challenge_workaround",
      "hidden_platform_automation",
      "fabricated_candidate_claim",
    ],
    stopConditions,
    knownAnswers: buildKnownAnswerSet(application, profile),
    commands: {
      markStarted: `npm run maxim:application -- started ${application.id}`,
      assistant: "/career-ops apply",
      browserInspect: `npm run maxim:auto-apply-browser -- inspect ${application.id}`,
      browserAssist: `npm run maxim:auto-apply-browser -- assist ${application.id}`,
      browserAssistRecord: `npm run maxim:auto-apply-browser -- assist ${application.id} --record-started --write-report`,
      markManualOutcome: `npm run maxim:application -- submitted ${application.id}`,
    },
    nextAction: ready
      ? "Open the job URL, mark assisted apply started, use the known answers/report/PDF packet, and stop for Xavier review before the final application action."
      : "Resolve review reasons before starting guided application assist.",
  };
}

export function buildAutoApplyPlans(applications, options = {}) {
  const profile = options.profile ?? loadAutoApplyProfile(options.profilePath);
  const now = options.now ?? new Date();
  return applications.map((application) => buildAutoApplyPlan(application, { profile, now }));
}
